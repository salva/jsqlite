import assert from 'node:assert/strict';
import test from 'node:test';
import {VdbeHostAdmission} from '../../src/internal/vdbe-host-admission.ts';
import {VdbeStatement} from '../../src/internal/vdbe.ts';

test('VM quantum 255/256/257, admission, saved rejection and reset',async()=>{
 const original=VdbeHostAdmission.prototype.checkpoint;
 let calls=0,active=false;const error=new Error('host rejection');
 try{for(const count of [255,256,257]){
  calls=0;VdbeHostAdmission.prototype.checkpoint=function(){calls++;assert.equal(active,true);return Promise.reject(error)};
  const program={ops:[...Array.from({length:count-1},()=>({code:'Integer',p1:1n,p2:0})),{code:'Halt'}],registers:1,columns:[],parameters:[],encoding:'utf8',maxWorkUnits:10000,maxResultBytes:1000000,privateStateLimits:{maxBytes:1000000,maxEntries:10000,maxKeyBytes:100000}};
  const s=new VdbeStatement(program,()=>{if(active)throw Error('busy')},()=>{assert.equal(active,false);active=true;return()=>{active=false}},()=>{});
  if(count<=256){assert.equal(await s.step(),'done');assert.equal(calls,0)}
  else{await assert.rejects(s.step(),e=>e===error);assert.equal(calls,1);assert.equal(active,false);assert.throws(()=>s.reset(),e=>e===error);VdbeHostAdmission.prototype.checkpoint=()=>undefined;assert.equal(await s.step(),'done');}
  s.finalize();
 }}finally{VdbeHostAdmission.prototype.checkpoint=original;}
});

test('VM admission preserves clock-zero reproducer, boundaries, reset and admission-start timing',async()=>{
 let time=0,tasks=0,resets=0,resolve;
 const scheduler={yield(){tasks++;return new Promise(r=>{resolve=r})},reset(){resets++}};
 const admission=new VdbeHostAdmission(scheduler,()=>time);
 let pending=admission.checkpoint();assert.equal(tasks,1);resolve();await pending;
 time=1;assert.equal(admission.checkpoint(),undefined);assert.equal(tasks,1); // original RED
 time=3.999;assert.equal(admission.checkpoint(),undefined);
 time=4;pending=admission.checkpoint();assert.equal(tasks,2);
 time=40;resolve();await pending;
 pending=admission.checkpoint();assert.equal(tasks,3,'long pending task counts towards admission-start interval');resolve();await pending;
 admission.reset();assert.equal(resets,1);time=0;
 pending=admission.checkpoint();assert.equal(tasks,4,'first after reset at zero');resolve();await pending;
 for(const clock of [-1,NaN,Infinity,0]){time=clock;pending=admission.checkpoint();assert.ok(pending);resolve();await pending;}
});

test('VM admission propagates clock and task failure without swallowing identity',async()=>{
 const error=new Error('clock');const a=new VdbeHostAdmission(undefined,()=>{throw error});
 assert.throws(()=>a.checkpoint(),e=>e===error);
 const rejection=new Error('task');const b=new VdbeHostAdmission({yield:()=>Promise.reject(rejection),reset(){}},()=>0);
 await assert.rejects(b.checkpoint(),e=>e===rejection);
 b.reset();await assert.rejects(b.checkpoint(),e=>e===rejection);
});

test('VM admission delivers real MessageChannel tasks and timer fallback',async()=>{
 const original=globalThis.MessageChannel;
 try{
  for(const fallback of [false,true]){
   if(fallback)globalThis.MessageChannel=undefined;
   let time=0;const a=new VdbeHostAdmission(undefined,()=>time);
   for(let i=0;i<9;i++){time=i*4;const promise=a.checkpoint();assert.ok(promise instanceof Promise);await promise;}
   a.reset();await a.checkpoint();
  }
 }finally{globalThis.MessageChannel=original;}
});
