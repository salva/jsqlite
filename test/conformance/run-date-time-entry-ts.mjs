// Real-task delegation proves cache is not cleared at async suspension.
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
for(const encoding of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(new URL(`../fixtures/expression-cursor/users-${encoding}.db`,import.meta.url));const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let calls=0,afterSampleTasks=0,active=false,firstCalls=0;const original=ExecutionTaskScheduler.prototype.yield;
 ExecutionTaskScheduler.prototype.yield=async function(){await original.call(this);if(active&&calls>firstCalls)afterSampleTasks++};
 const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{[dateTimeEnvironmentOption]:{nowUnixMilliseconds(){return 946684800000n+BigInt(calls++)*10000n},localFieldsAtUnixSecond(){throw Error('unexpected local')}}});
 const statements=[];
 try{
  const prepare=sql=>{const s=db.prepare(sql).statement;statements.push(s);return s};
  // Large input charges real host tasks between the first and final clock calls.
  const s=prepare("SELECT datetime('now'),length(?1),datetime('now','+0 seconds'),(SELECT datetime('now'))");s.bind(1,'x'.repeat(300000));
  for(let execution=0;execution<2;execution++){
   firstCalls=calls;afterSampleTasks=0;active=true;try{assert.equal(await s.step(),'row')}finally{active=false}
   assert.ok(afterSampleTasks>0,'real task must complete after initial sample');assert.equal(calls,firstCalls+1);
   assert.equal(s.column(0),s.column(2));assert.equal(s.column(0),s.column(3));assert.equal(s.column(1),300000n);assert.equal(await s.step(),'done');s.reset();
  }
  // Independent statements must not inherit the prior statement sample.
  const a=prepare("SELECT datetime('now')"),b=prepare("SELECT datetime('now')");
  const base=calls;assert.equal(await a.step(),'row');assert.equal(await b.step(),'row');assert.notEqual(a.column(0),b.column(0));assert.equal(calls,base+2);
  assert.equal(await a.step(),'done');assert.equal(await b.step(),'done');
 }finally{ExecutionTaskScheduler.prototype.yield=original;for(const s of statements){try{s.reset()}catch{}s.finalize()}db.close();await new Promise(r=>server.close(r))}
}
console.log('clock entry/yield ownership: real tasks after acquisition, subquery, reset and independent statements /3 encodings; zero credit');
