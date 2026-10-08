import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {ReprepareContext} from '../../src/internal/reprepare.ts';
import {Stat4Probe} from '../../src/internal/stat4-probe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {memFromPublic,memToPublicInitial} from '../../src/internal/mem.ts';

// vdbemem.c valueFromExpr VARIABLE copies the old binding and applies affinity;
// ProbeFree owns all slots. TS conservative reservations are logical capacity,
// not native allocation sizes or JS heap. Assert their actual failure frontier.
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`${encoding}: bound probe reservation and progress frontiers release without mutating source`,()=>{
 const parsed=parseSql('SELECT CAST(:bound AS TEXT) COLLATE NOCASE').statement;
 const expression=parsed.result[0].reduction;
 const info=new KeyInfo({encoding,totalFieldCount:2,keyFieldCount:1,terms:[{},{}]});
 for(const value of ['λ😀\0'.repeat(512),Uint8Array.from({length:4096},(_,i)=>i%256)]){
  const source=memFromPublic(value,encoding),before=source.diagnostic();
  const primary=new Error('injected probe construction frontier');
  function run(cap=Infinity,failCheck=Infinity){
   let live=0,peak=0,checks=0,releases=0,reservations=0;
   const context=new ReprepareContext(parsed,[source]);let probe,failed=false;
   try{
    probe=new Stat4Probe(info,()=>{if(++checks===failCheck)throw primary},bytes=>{
     if(live+bytes>cap)throw primary;
     live+=bytes;peak=Math.max(peak,live);reservations++;let released=false;
     return ()=>{assert.equal(released,false);released=true;live-=bytes;releases++};
    },context);
    probe.setLiteral(0,'prior');probe.nRecValid=1;
    try{assert.equal(probe.setExpression(0,expression,'text'),true)}catch(error){
     assert.equal(memToPublicInitial(probe.values[0]),'prior','failed extraction must not replace prior slot');
     assert.equal(probe.nRecValid,1);throw error;
    }
    assert.notEqual(probe.values[0],source);assert.equal(typeof memToPublicInitial(probe.values[0]),'string');
    const capacity=live;
    assert.equal(probe.setExpression(0,expression,'text'),true);
    assert.equal(live,capacity,'same bound extraction reuses held capacity');
    assert.equal(context.mask,1);
   }catch(error){failed=true;assert.equal(error,primary)}finally{
    probe?.release();probe?.release();assert.equal(live,0);assert.equal(releases,reservations);
    assert.deepEqual(source.diagnostic(),before);assert.deepEqual(memToPublicInitial(source),value);
   }
   return {peak,checks,failed};
  }
  try{
   const baseline=run();assert.equal(baseline.failed,false);assert.ok(baseline.peak>4096);assert.ok(baseline.checks>1);
   const limited=run(baseline.peak-1);assert.equal(limited.failed,true);assert.ok(limited.peak<baseline.peak);
   const exact=run(baseline.peak);assert.equal(exact.failed,false);assert.equal(exact.peak,baseline.peak);
   // Every first-extraction progress checkpoint, including after reservation,
   // must unwind its held capacity and leave the caller binding untouched.
   // The repeat doubles extraction checks; stop before its second traversal.
   for(let checkpoint=1;checkpoint<=Math.floor(baseline.checks/2);checkpoint++)assert.equal(run(Infinity,checkpoint).failed,true);
  }finally{source.release()}
 }
});
