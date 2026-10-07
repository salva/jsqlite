import test from 'node:test';
import assert from 'node:assert/strict';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
import {suspendExecutionTask} from './suspend-execution-task.mjs';

for(const channel of [true,false])test(`execution suspension gate retains real task and restores (${channel?'channel':'timer'})`,async()=>{
 const nativeChannel=globalThis.MessageChannel,original=ExecutionTaskScheduler.prototype.yield;
 if(!channel)globalThis.MessageChannel=undefined;
 const gate=suspendExecutionTask();
 try{
  let resumed=false;
  const task=new ExecutionTaskScheduler().yield().then(()=>{resumed=true});
  await gate.suspended;
  assert.equal(resumed,false);
  gate.release();await task;assert.equal(resumed,true);
  gate.restore();assert.equal(ExecutionTaskScheduler.prototype.yield,original);
  gate.restore();await new ExecutionTaskScheduler().yield();
 }finally{gate.restore();globalThis.MessageChannel=nativeChannel;}
});
