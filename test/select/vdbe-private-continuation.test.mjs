import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {SorterCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {Mem} from '../../src/internal/mem.ts';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {VdbeHostAdmission} from '../../src/internal/vdbe-host-admission.ts';

test('mixed pending/void compare terms, stable merge publication and failed-sort cleanup',async()=>{
 const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:3,keyFieldCount:3,terms:[{},{},{}]});
 const m=n=>{const v=new Mem();v.setInt64(BigInt(n));return v};
 for(const failAt of [0,2,4]){
  const budget=new PrivateStateByteBudget(96),s=new SorterCursor(keyInfo,{maxEntries:3,maxKeyBytes:24,maxBytes:96},budget);
  for(const [last,payload] of [[2,20],[1,10],[1,11]])await s.insert([m(1),m(1),m(last)],[m(payload)],{checkpoint(){}});
  let count=0;const error=new Error('pending compare/merge failure');
  try{
   const pending=s.sort({checkpoint(units){assert.equal(units,1);count++;if(count===failAt)return Promise.reject(error);if(count%2===0)return Promise.resolve();}});
   // No partially merged ordering is published while comparison/move is pending.
   const original=[];for(let ok=s.first();ok;ok=s.next())original.push(s.data()[0].integerValue());
   assert.deepEqual(original,[20n,10n,11n]);assert.equal(budget.usedBytes,96);
   if(failAt){await assert.rejects(pending,e=>e===error);const unchanged=[];for(let ok=s.first();ok;ok=s.next())unchanged.push(s.data()[0].integerValue());assert.deepEqual(unchanged,original);}
   else{await pending;assert.equal(count,15,'three comparisons of three terms plus six merge moves');const rows=[];for(let ok=s.first();ok;ok=s.next())rows.push(s.data()[0].integerValue());assert.deepEqual(rows,[10n,11n,20n]);}
  }finally{s.close();assert.equal(budget.usedBytes,0);}
 }
});

// Observe the real VM-supplied control; do not reproduce its remaining-units loop.
// Pinned vdbe.c check_for_interrupt checks interrupt before progress; reset in
// vdbeaux.c halts partial execution before transferring the saved error.
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
function statement(){return new VdbeStatement({ops:[
 {code:'SorterOpen',p1:0,keyInfo:info},{code:'String',p1:'x'.repeat(1100),p2:0},
 {code:'SorterInsert',p1:0,keyStart:0,keyCount:1,payload:0,payloadCount:0},
 {code:'SorterSort',p1:0,emptyJump:7},{code:'SorterData',p1:0,p2:1,count:0},
 {code:'Integer',p1:19n,p2:1},{code:'ResultRow',p1:1,p2:1},{code:'Halt'}
],registers:2,columns:[{name:'n'}],parameters:[],encoding:'utf8',maxWorkUnits:10000,maxResultBytes:10000,privateStateLimits:{maxBytes:1100,maxEntries:1,maxKeyBytes:1100}},()=>{},()=>()=>{},()=>{});}

test('PRIVATE units>256 resumes multiple pending/void quanta exactly, failures clean up and reset',async()=>{
 const insert=SorterCursor.prototype.insert,host=VdbeHostAdmission.prototype.checkpoint;
 const clock=Date.now;
 try{for(const mode of ['success','cancel-before','cancel-after','deadline-before','deadline-after','throw','reject','cancel-after-late','deadline-after-late','reject-late']){
  let inInsert=false,reads=0,aborted=false,expired=false,quanta=[],charges=[],calls=0;
  const reason={mode},failure=new Error(mode);
  const signal={get aborted(){if(inInsert)reads++;return aborted},reason};
  Date.now=()=>expired?100:0;
  SorterCursor.prototype.insert=async function(key,payload,control){
   inInsert=true;
   try{return await insert.call(this,key,payload,{checkpoint(n=0){charges.push(n);return control.checkpoint(n)}})}finally{inInsert=false;}
  };
  VdbeHostAdmission.prototype.checkpoint=function(){
   assert.equal(inInsert,true,'host checkpoint is inside private insertion');
   quanta.push(reads);calls++;
   if(calls===1){
    if(mode==='throw')throw failure;
    if(mode==='reject')return Promise.reject(failure);
    if(mode.endsWith('before')){aborted=mode.startsWith('cancel');expired=mode.startsWith('deadline');}
    return Promise.resolve().then(()=>{if(mode.endsWith('after')){aborted=mode.startsWith('cancel');expired=mode.startsWith('deadline');}});
   }
   if(calls===3&&mode.endsWith('-late')){
    if(mode==='reject-late')return Promise.reject(failure);
    return Promise.resolve().then(()=>{aborted=mode.startsWith('cancel');expired=mode.startsWith('deadline');});
   }
   if(calls%2===1)return Promise.resolve(); // alternating pending/void
  };
  const s=statement();
  if(mode==='success'){
   assert.equal(await s.step({signal,timeoutMs:50}),'row');assert.equal(s.columnInteger(0),19n);
   assert.deepEqual(quanta,[253,509,765,1021]);
   assert.deepEqual(charges,[1101,0,0]);assert.equal(reads,1104,'each charged unit plus final and growth probes, no skip/duplicate');
   assert.equal(await s.step(),'done');s.reset();
  }else{
   let saved;await assert.rejects(s.step({signal,timeoutMs:50}),e=>{saved=e;return mode==='throw'||mode.startsWith('reject')?e===failure:e.kind===(mode.startsWith('cancel')?'cancelled':'timeout')});
   assert.deepEqual(quanta,mode.endsWith('-late')?[253,509,765]:[253]);assert.deepEqual(charges,[1101]);
   assert.equal(reads,(mode.endsWith('-late')?765:253)+(mode==='throw'||mode.startsWith('reject')?0:1),'first post-resume probe rejects before another debit');
   await assert.rejects(s.step(),e=>e===saved);assert.throws(()=>s.reset(),e=>e===saved);
   // A retry under the exact one-entry/1100-byte cap proves rollback/close released ownership.
   aborted=false;expired=false;calls=0;quanta=[];charges=[];reads=0;
   VdbeHostAdmission.prototype.checkpoint=()=>undefined;
   assert.equal(await s.step(),'row');assert.equal(s.columnInteger(0),19n);s.reset();
  }
  s.finalize();
 }}finally{SorterCursor.prototype.insert=insert;VdbeHostAdmission.prototype.checkpoint=host;Date.now=clock;}
});
