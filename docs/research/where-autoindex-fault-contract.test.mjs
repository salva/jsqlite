// Self-test of pending fault driver, not production feature execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {interrupted} from './where-autoindex-pending-controls.mjs';
const errors=Object.fromEntries(['cancel','deadline','page','record','filter'].map(c=>[c,{name:'ExpectedError',message:c}]));
const work={buildRows:1,probes:1,absent:0,collisions:0};
const expected={errors,retry:{rows:[],columns:[],work},survivorRows:[[{type:'integer',value:'2'}]]};
function adapter(mutate=()=>{}) {
 const release=()=>({released:{ownerId:1,chargedBytes:10,refundedBytes:10,ownedBytes:0,openCursors:0,filterBytes:0,onceActive:false},independentBefore:{ownerId:2,ownedBytes:5},independentAfter:{ownerId:2,ownedBytes:5}});
 return {async interruptAfterProgress(phase,cause){
  assert.ok(phase==='build'||['cancel','deadline'].includes(cause));
  const error=Object.assign(new Error(cause),{name:'ExpectedError'});
  const r={...release(),phase,completedWork:1,error,reportedError:error,fallback:false};mutate(r,'failure');return r;
 },async reset(){},async execute(){const r={error:null,rows:[],columns:[],version:1,planKind:'automatic-index',executedOps:['OpenAutoindex','FilterAdd','Filter'],builds:1,insertedRecords:1,probes:1,filterAbsent:0,filterPresent:1,indexSeeks:1,collisionRejects:0,coveringTableLookups:0};mutate(r,'retry');return r},
 async resumeIndependent(){const r={ownerId:2,completedWork:1,error:null,rows:expected.survivorRows};mutate(r,'survivor');return r},
 async releasePartialBuild(){return release()}};
}
test('fault contract accepts reachable events with complete retry and survivor checks',async()=>{
 await interrupted(adapter(),expected);
});
test('fault contract rejects wrong errors, replay, missing refund and damaged survivor/retry',async()=>{
 for(const [phase,mutation] of [
 ['failure',r=>{r.error.name='WrongError'}],['failure',r=>{r.error.message='wrong'}],
 ['failure',r=>{r.fallback=true}],['failure',r=>{r.completedWork=0}],
 ['failure',r=>{r.released.refundedBytes=9}],
 ['retry',r=>{r.rows=[[{type:'null'}]]}],['retry',r=>{r.builds=0}],
 ['survivor',r=>{r.ownerId=1}],['survivor',r=>{r.completedWork=0}],['survivor',r=>{r.rows=[]}]])
  await assert.rejects(interrupted(adapter((r,p)=>{if(p===phase)mutation(r)}),expected));
});
