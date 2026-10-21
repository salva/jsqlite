import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStat4Samples} from '../../src/internal/schema.ts';
import {stat4Column} from '../../src/internal/stat4-skipscan.ts';
import {Stat4Probe} from '../../src/internal/stat4-probe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem,memToPublicInitial} from '../../src/internal/mem.ts';

function loaded(){
 const index={},bytes=new Uint8Array(1048576);bytes.set([3,0,8]);
 const states=loadStat4Samples(()=>[{name:'i',neq:'1 1',nlt:'0 0',ndlt:'0 0',bytes}],()=>index,
  ()=>({nSampleCol:2,nKeyCol:1,aiRowEst:[1n,1n]}),{maxBytes:2000000});
 return {sample:states.get(index).samples[0],bytes};
}
function watch(body){
 const original=Uint8Array.prototype.slice;let copied=0;
 try{Uint8Array.prototype.slice=function(...args){const result=original.apply(this,args);copied+=result.length;return result};body(()=>copied)}
 finally{Uint8Array.prototype.slice=original}
}
test('loader owned sample: scalar first check/reservation denial and retry never clone record',()=>{
 const {sample,bytes}=loaded(),destination=new Mem(),primary=new Error('denied');
 bytes.fill(255);const publicCopy=sample.p;publicCopy.fill(255);
 assert.deepEqual([...sample.p.subarray(0,3)],[3,0,8]);
 watch(copies=>{
  let reservations=0,live=0;
  const reserve=()=>{reservations++;live++;return ()=>{live--}};
  assert.throws(()=>stat4Column(sample,1,'utf-8',destination,()=>{throw primary},reserve),e=>e===primary);
  assert.equal(reservations,0);assert.equal(copies(),0);
  assert.throws(()=>stat4Column(sample,1,'utf-8',destination,()=>{},()=>{throw primary}),e=>e===primary);
  assert.equal(copies(),0);
  const release=stat4Column(sample,1,'utf-8',destination,()=>{},reserve);
  assert.equal(memToPublicInitial(destination),0n);destination.release();release();
  assert.equal(live,0);assert.equal(copies(),0);
 });
});
test('loader owned sample: packed probe first check rejection and retry never clone record',()=>{
 const {sample}=loaded(),primary=new Error('cancel');let reject=false,live=0;
 const probe=new Stat4Probe(new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:1,terms:[{},{}]}),()=>{if(reject)throw primary},()=>{live++;return ()=>{live--}});
 try{
  probe.setLiteral(0,null);probe.nField=1;
  watch(copies=>{
   reject=true;assert.throws(()=>probe.compare(sample),e=>e===primary);assert.equal(copies(),0);
   reject=false;assert.equal(probe.compare(sample),0);assert.equal(copies(),0);
  });
 }finally{probe.release()}
 assert.equal(live,0);
});
