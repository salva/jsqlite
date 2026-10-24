import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
function statement(fail=false){return new VdbeStatement({encoding:'utf-8',registers:2,parameters:[],columns:[{name:'v'}],maxWorkUnits:10000,maxResultBytes:10000,privateStateLimits:{maxEntries:100,maxKeyBytes:1000,maxBytes:100000},ops:[
 {code:'Once',p1:1,p2:4,automaticTable:9},{code:'OpenAutoindex',p1:0,keyInfo},
 ...(fail?[{code:'Filter',p1:99,p2:4,p3:0,p4:1}]:[{code:'Integer',p1:1n,p2:0}]),
 {code:'Goto',p2:4},{code:'Column',p1:0,p2:0,p3:9},{code:'ResultRow',p1:0,p2:1},{code:'Halt'}
]},()=>{},()=>()=>{},()=>{});}

test('Once completion is distinct from OpenAutoindex and covering observation detects source reads',async()=>{
 const good=statement();try{
  assert.equal(await good.step(),'row');const snapshot=good.privateAccounting();
  assert.equal(snapshot.automaticBuilds,1);assert.equal(snapshot.builds,1);
  assert.equal(snapshot.onceActive,true);assert.ok(snapshot.openCursors>0);
  assert.equal(snapshot.coveringTableLookups,1,'must not publish constant zero');
  assert.equal(await good.step(),'done');assert.equal(good.privateAccounting().builds,1);
  assert.equal(good.privateAccounting().onceActive,false);assert.equal(good.privateAccounting().openCursors,0);
  good.reset();assert.equal(good.privateAccounting().builds,0);
  await good.step();assert.equal(good.privateAccounting().builds,1);
 }finally{good.finalize();}
 const bad=statement(true);try{
  await assert.rejects(bad.step());const snapshot=bad.privateAccounting();
  assert.equal(snapshot.automaticBuilds,1);assert.equal(snapshot.builds,0);
  assert.equal(snapshot.coveringTableLookups,0);
  assert.throws(()=>bad.reset());assert.equal(bad.privateAccounting().builds,0);
 }finally{bad.finalize();}
});
