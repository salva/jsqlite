import assert from 'node:assert/strict';
import fs from 'node:fs';import http from 'node:http';import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
const root=path.resolve(new URL('../..',import.meta.url).pathname),fixture=path.join(root,'test/fixtures/expression-cursor/users-utf8.db');
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':fs.statSync(fixture).size});fs.createReadStream(fixture).pipe(r)});await new Promise((x,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',x)});
async function connection(environment,limits){return openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{[dateTimeEnvironmentOption]:environment,...(limits?{limits}:{})})}
async function row(statement){assert.equal(await statement.step(),'row');return Array.from({length:statement.columnCount},(_,i)=>statement.column(i))}
try{
 let clockCalls=0;const times=[946684800125n,978307200250n];const environment={nowUnixMilliseconds(){return times[clockCalls++]??times.at(-1)},localFieldsAtUnixSecond(){return null}};
 const db=await connection(environment);try{
  const {statement}=db.prepare("SELECT datetime('now'), current_timestamp, time('now'), current_time FROM users ORDER BY id");assert.equal(clockCalls,0);const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:4},(_,i)=>statement.column(i)));assert.equal(clockCalls,1);assert.deepEqual(rows,Array(3).fill(['2000-01-01 00:00:00','2000-01-01 00:00:00','00:00:00','00:00:00']));statement.finalize();
  const {statement:again}=db.prepare("SELECT unixepoch('subsec'), datetime('subsecond'), time('subsec')");assert.deepEqual(await row(again),[978307200.25,'2001-01-01 00:00:00.250','00:00:00.250']);assert.equal(clockCalls,2);assert.equal(await again.step(),'done');again.reset();assert.deepEqual(await row(again),[978307200.25,'2001-01-01 00:00:00.250','00:00:00.250']);assert.equal(clockCalls,3);again.finalize();
 }finally{db.close()}
 let localCalls=0;const localScript=[{year:2000,month:1,day:1,hour:2,minute:0,second:0},{year:2000,month:1,day:1,hour:4,minute:0,second:0},{year:2000,month:1,day:1,hour:2,minute:0,second:0}];const local={nowUnixMilliseconds(){throw new Error('clock must not be sampled')},localFieldsAtUnixSecond(){return localScript[localCalls++]??localScript.at(-1)}};const localDb=await connection(local);try{const {statement}=localDb.prepare("SELECT datetime('2000-01-01 00:00:00','localtime'), datetime('2000-01-01 02:00:00','utc')");try{assert.deepEqual(await row(statement),['2000-01-01 02:00:00','2000-01-01 00:00:00']);assert.equal(localCalls,3)}finally{statement.finalize()}}finally{localDb.close()}
 const failDb=await connection({nowUnixMilliseconds(){return 0n},localFieldsAtUnixSecond(){throw new Error('provider')}});try{const {statement}=failDb.prepare("SELECT datetime('2000-01-01','localtime')");await assert.rejects(statement.step(),e=>e.code===1&&e.message==='local time unavailable');assert.throws(()=>statement.reset(),e=>e.code===1&&e.message==='local time unavailable');statement.finalize()}finally{failDb.close()}
 let mappedSecond;const mappedDb=await connection({nowUnixMilliseconds(){return 0n},localFieldsAtUnixSecond(second){mappedSecond=second;return{year:2000,month:1,day:1,hour:0,minute:0,second:0}}});try{const {statement}=mappedDb.prepare("SELECT datetime('1900-01-01','localtime')");assert.equal(await statement.step(),'row');assert.equal(mappedSecond,946684800n);assert.equal(statement.columnText(0),'1900-01-01 00:00:00');statement.finalize()}finally{mappedDb.close()}
 for(const returned of [null,{year:2000,month:13,day:1,hour:0,minute:0,second:0},{year:2023,month:2,day:29,hour:0,minute:0,second:0},{year:2024,month:4,day:31,hour:0,minute:0,second:0}]){const invalidDb=await connection({nowUnixMilliseconds(){return 0n},localFieldsAtUnixSecond(){return returned}});try{const {statement}=invalidDb.prepare("SELECT datetime('2000-01-01','localtime')");let error;try{await statement.step()}catch(e){error=e}assert.equal(error?.code,1);assert.equal(error?.message,'local time unavailable');assert.throws(()=>statement.reset(),e=>e===error);statement.finalize()}finally{invalidDb.close()}}
 const leapDb=await connection({nowUnixMilliseconds(){return 0n},localFieldsAtUnixSecond(){return{year:2024,month:2,day:29,hour:12,minute:34,second:56}}});try{const {statement}=leapDb.prepare("SELECT datetime('2000-01-01','localtime')");assert.equal(await statement.step(),'row');assert.equal(statement.columnText(0),'2024-02-29 12:34:56');assert.equal(await statement.step(),'done');statement.reset();assert.equal(await statement.step(),'row');statement.finalize()}finally{leapDb.close()}
 const boundedEnv={nowUnixMilliseconds(){return 0n},localFieldsAtUnixSecond(){return null}};
 const sizeDb=await connection(boundedEnv,{maxResultBytes:9,maxWorkUnits:1000});try{const {statement}=sizeDb.prepare("SELECT date('2000-01-01')");let error;try{await statement.step()}catch(e){error=e}assert.deepEqual({kind:error?.kind,message:error?.message},{kind:'limit',message:'string or blob too big'});assert.throws(()=>statement.reset(),e=>e===error);statement.finalize();const {statement:reuse}=sizeDb.prepare("SELECT time('00:00')");assert.equal(await reuse.step(),'row');reuse.finalize()}finally{sizeDb.close()}
 // Interrupt at a real VM host-task completion, not a race between timer and
 // MessageChannel task sources. Delegate production transport unchanged. Native
 // vdbe.c OP_Function calls strftimeFunc synchronously; check_for_interrupt does
 // not promise a JS timer runs before a port. Host admission may space starts.
 const abortDb=await connection(boundedEnv,{maxResultBytes:1000000,maxWorkUnits:1000000});
 let abortStatement,primaryError;
 const originalYield=ExecutionTaskScheduler.prototype.yield;
 try{
  const format='x'.repeat(200000),{statement}=abortDb.prepare("SELECT strftime(?1,'2000-01-01')");abortStatement=statement;statement.bind(1,format);
  const abort=new AbortController(),reason=new Error('date abort');let tasks=0,inOperation=false;
  ExecutionTaskScheduler.prototype.yield=async function(){
   await originalYield.call(this);
   assert.equal(inOperation,true);assert.equal(abort.signal.aborted,false);
   tasks++;abort.abort(reason);
  };
  assert.equal(abort.signal.aborted,false);let error;
  inOperation=true;try{await statement.step({signal:abort.signal})}catch(e){error=e}finally{inOperation=false;ExecutionTaskScheduler.prototype.yield=originalYield}
  assert.equal(tasks,1);assert.deepEqual({kind:error?.kind,message:error?.message},{kind:'cancelled',message:'statement execution was cancelled'});assert.equal(error?.cause,reason);
  await assert.rejects(statement.step(),e=>e===error);assert.throws(()=>statement.reset(),e=>e===error);
  assert.equal(await statement.step(),'row');assert.equal(statement.columnText(0),format);assert.equal(await statement.step(),'done');
  statement.finalize();abortStatement=undefined;
 }catch(e){primaryError=e;throw e}finally{
  ExecutionTaskScheduler.prototype.yield=originalYield;
  // Finalize even after a failed assertion, and never replace its primary error
  // with the connection's unfinalized-statement error.
  let cleanupError;try{abortStatement?.finalize()}catch(e){cleanupError=e}
  try{abortDb.close()}catch(e){cleanupError??=e}
  if(!primaryError&&cleanupError)throw cleanupError;
 }
 // Preserve the original independent realclock/timer experiment. Either task
 // source may win: completion is legal; if interruption wins, validate it. This
 // is a host-order control, not credited as deterministic cancellation coverage.
 const timerDb=await connection(boundedEnv,{maxResultBytes:1000000,maxWorkUnits:1000000});
 let timerStatement,timerPrimary,timerDone;
 try{
  const format='x'.repeat(200000),{statement}=timerDb.prepare("SELECT strftime(?1,'2000-01-01')");timerStatement=statement;statement.bind(1,format);
  const abort=new AbortController(),reason=new Error('date timer abort');
  assert.equal(abort.signal.aborted,false);
  timerDone=new Promise(resolve=>setTimeout(()=>{abort.abort(reason);resolve()},0));
  let result,error;try{result=await statement.step({signal:abort.signal})}catch(e){error=e}
  if(error){assert.equal(error.kind,'cancelled');assert.equal(error.cause,reason);assert.throws(()=>statement.reset(),e=>e===error)}
  else{assert.equal(result,'row');assert.equal(statement.columnText(0),format);assert.equal(await statement.step(),'done');statement.reset()}
  await timerDone;assert.equal(abort.signal.aborted,true);
  assert.equal(await statement.step(),'row');assert.equal(statement.columnText(0),format);
  statement.finalize();timerStatement=undefined;
 }catch(e){timerPrimary=e;throw e}finally{
  await timerDone;
  let cleanupError;try{timerStatement?.finalize()}catch(e){cleanupError=e}
  try{timerDb.close()}catch(e){cleanupError??=e}
  if(!timerPrimary&&cleanupError)throw cleanupError;
 }
 const workDb=await connection(boundedEnv,{maxResultBytes:1000,maxWorkUnits:1000});try{const {statement}=workDb.prepare("SELECT strftime('abcdefghijklmnopqrstuvwxyz','2000-01-01')");let error;try{await statement.step({maxWorkUnits:25})}catch(e){error=e}assert.deepEqual({kind:error?.kind,message:error?.message},{kind:'limit',message:'statement exceeds maxWorkUnits'});assert.throws(()=>statement.reset(),e=>e===error);assert.equal(await statement.step({maxWorkUnits:100}),'row');assert.equal(statement.columnText(0),'abcdefghijklmnopqrstuvwxyz');statement.finalize()}finally{workDb.close()}
 let flagCalls=0;const flagDb=await connection({nowUnixMilliseconds(){return 0n},localFieldsAtUnixSecond(second){flagCalls++;return{year:2000,month:1,day:1,hour:2,minute:0,second:0}}});try{const {statement}=flagDb.prepare("SELECT datetime('2000-01-01Z','utc'),datetime('2000-01-01Z','localtime','localtime')");try{assert.deepEqual(await row(statement),['2000-01-01 00:00:00','2000-01-01 02:00:00']);assert.equal(flagCalls,1)}finally{statement.finalize()}}finally{flagDb.close()}
 console.log(JSON.stringify({outcome:'pass',seams:4}));
}finally{server.close()}
