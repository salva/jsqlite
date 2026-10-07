import assert from 'node:assert/strict';
import test from 'node:test';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';

test('task scheduling is bounded, ports close before resume, timer turns remain periodic',async()=>{
 const original=globalThis.MessageChannel, timer=globalThis.setTimeout;
 let live=0, maximum=0, messages=0, timers=0;
 globalThis.MessageChannel=class {
  constructor(){live+=2;maximum=Math.max(maximum,live);}
  port1={onmessage:null,close(){live--}};
  port2={close(){live--},postMessage:()=>{messages++;timer(()=>this.port1.onmessage?.({}),0)}};
 };
 globalThis.setTimeout=(fn,ms)=>{timers++;return timer(fn,ms)};
 try{const s=new ExecutionTaskScheduler();for(let i=0;i<24;i++){await s.yield();assert.equal(live,0)}assert.equal(maximum,2);assert.equal(messages,21);assert.equal(timers,3);s.reset();await s.yield();assert.equal(messages,22)}
 finally{globalThis.MessageChannel=original;globalThis.setTimeout=timer}
});
test('absent or throwing channel uses a real timer; partial resources close',async()=>{
 const original=globalThis.MessageChannel;let closed=0;
 try{globalThis.MessageChannel=undefined;await new ExecutionTaskScheduler().yield();
 globalThis.MessageChannel=class {port1={onmessage:null,close(){closed++}};port2={postMessage(){throw Error('unavailable')},close(){closed++}}};
 await new ExecutionTaskScheduler().yield();assert.equal(closed,2);
 globalThis.MessageChannel=class {constructor(){throw Error('constructor unavailable')}};
 await new ExecutionTaskScheduler().yield();assert.equal(closed,2);
 }finally{globalThis.MessageChannel=original}
});
