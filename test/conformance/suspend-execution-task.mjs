import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';

// Observe the actual execution-owned host task, independent of timer/channel
// ordering. Keep the real yield/port cleanup, then hold its caller before resume.
export function suspendExecutionTask() {
 const original=ExecutionTaskScheduler.prototype.yield;
 let release,held=false,restoreDone=false;
 const suspended=new Promise(resolve=>{
  ExecutionTaskScheduler.prototype.yield=async function(){
   await original.call(this);
   if(!held){held=true;await new Promise(resume=>{release=resume;resolve()});}
  };
 });
 return {suspended,release:()=>release?.(),restore(){
  if(!restoreDone){ExecutionTaskScheduler.prototype.yield=original;restoreDone=true;}
  release?.();
 }};
}
