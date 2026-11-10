import assert from 'node:assert/strict';
import {EphemeralIndexCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';

// Observe OP_Insert's real retained cursor after insertion, before the VDBE
// resumes its fill. Added work checkpoints force the existing host-task path;
// no rows/reservations or cancellation results are synthesized by this probe.
export async function checkRetainedFillCancellation(db,sql,want){
 const insert=EphemeralIndexCursor.prototype.insert;
 const reserve=PrivateStateByteBudget.prototype.reserve;
 const yieldTask=ExecutionTaskScheduler.prototype.yield;
 const budgets=new Set();let armed=false,held=false,release,notify;
 const suspended=new Promise(resolve=>{notify=resolve;});
 PrivateStateByteBudget.prototype.reserve=function(...args){const result=reserve.apply(this,args);budgets.add(this);return result;};
 ExecutionTaskScheduler.prototype.yield=async function(){
  await yieldTask.call(this);
  if(armed&&!held){held=true;await new Promise(resolve=>{release=resolve;notify();});}
 };
 EphemeralIndexCursor.prototype.insert=async function(key,control,...args){
  await insert.call(this,key,control,...args);
  if(!held){
   assert.ok(this.size>0,'real retained cursor contains an inserted record');
   assert.ok([...budgets].some(b=>b.usedBytes>0),'positive live retained-fill budget');
   armed=true;
   for(let i=0;!held&&i<10000;i++)await control.checkpoint(1);
   assert.ok(held,'fill reached real execution-task suspension');
  }
 };
 let s,pending,timer;
 try{
  s=db.prepare(sql).statement;s.bind(1,'live');
  const controller=new AbortController();let saved;
  pending=s.step({signal:controller.signal}).then(value=>{throw Error(`unexpected result before abort: ${value}`);},e=>{saved=e;assert.equal(e.kind,'cancelled');});
  await Promise.race([suspended,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('retained fill did not suspend')),5000);})]);
  assert.ok([...budgets].some(b=>b.usedBytes>0),'positive bytes remain while fill is suspended');
  controller.abort('retained-fill');release();await pending;
  assert.ok(saved);assert.throws(()=>s.reset(),e=>e===saved);
  for(const b of budgets)assert.equal(b.usedBytes,0,'cancel refunds shared budget');
  // Restore observation before checking unmodified execution/reset/rebind reuse.
  EphemeralIndexCursor.prototype.insert=insert;
  ExecutionTaskScheduler.prototype.yield=yieldTask;
  for(const value of ['ok','again']){
   s.bind(1,value);assert.equal(await s.step(),'row');assert.equal(s.column(0),want(value));
   s.reset();for(const b of budgets)assert.equal(b.usedBytes,0,'early reset refunds shared budget');
  }
 }finally{
  clearTimeout(timer);release?.();
  try{if(pending)await pending;}finally{
   try{s?.finalize();}finally{
    EphemeralIndexCursor.prototype.insert=insert;
    PrivateStateByteBudget.prototype.reserve=reserve;
    ExecutionTaskScheduler.prototype.yield=yieldTask;
   }
  }
 }
}
