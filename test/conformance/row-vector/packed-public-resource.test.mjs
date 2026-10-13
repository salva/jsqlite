import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from '../public-api-adapter.mjs';

// Actual public programs and limits: no synthetic VM, monkey-patched insertion,
// or host result evaluator. Reset/rebind reruns the same prepared owner.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
for(const schedule of ['conversion-budget','insert-entry-budget'])
test(`packed public ${encoding} ${correlated?'rebuild':'Once'} ${schedule} saved error and rebind recovery`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:schedule==='conversion-budget'?{maxPrivateBytes:65536}:{maxPrivateEntries:1}});
  const sql=`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q WHERE q.id<=?2${correlated?' AND q.id<=p.id':''}) AS hit FROM pairs p`;
  st=db.prepare(sql).statement;st.bind(1,schedule==='conversion-budget'?'x'.repeat(20000):'small');st.bind(2,4n);
  let first,rows=0;
  await assert.rejects(async()=>{while(await st.step()==='row')rows++},error=>{first=error;assert.equal(error.message,schedule==='conversion-budget'?'private state exceeds total byte limit':'private index entry limit');return error.kind==='limit'});
  // Uncorrelated producer fills before first row; correlated producer can
  // publish its first outer result before a later rebuild exceeds entries.
  if(!correlated||schedule==='conversion-budget')assert.equal(rows,0);
  else assert.ok(rows>0,'entry admission fails on a later correlated rebuild');
  assert.throws(()=>st.reset(),error=>error===first,'reset retains original admission error');
  // Smaller payload and one distinct RHS entry must fit the same immutable
  // program limits twice. This tests release/restart and Once reset, not merely
  // opening an unrelated connection after a failure.
  st.bind(1,'small');st.bind(2,1n);
  for(let run=0;run<2;run++){
   const actual=[];while(await st.step()==='row')actual.push([st.column(0),st.column(1)]);
   assert.deepEqual(actual,[[1n,1n],[2n,0n],[3n,null],[4n,1n]]);
   st.reset();
  }
  st.finalize();st=null;
  const recovery=db.prepare('SELECT 1').statement;try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);assert.equal(await recovery.step(),'done')}finally{recovery.finalize()}
 }finally{try{st?.finalize()}finally{await db?.closeDeferred();await new Promise(r=>server.close(r))}}
});

// Timer is armed only after step begins with a non-aborted signal. Correlated
// case first suspends at a public row with live private state, then interrupts
// the next rebuild. No scheduler/opcode interception is needed.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
test(`packed public ${encoding} ${correlated?'suspended rebuild':'Once fill'} in-flight abort then reset`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st,timer;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  st=db.prepare(`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q${correlated?' WHERE q.id<=p.id':''}) FROM pairs p`).statement;
  st.bind(1,'x'.repeat(200000));
  if(correlated){assert.equal(await st.step(),'row');assert.equal(st.column(0),1n);assert.equal(st.column(1),1n)}
  const controller=new AbortController();assert.equal(controller.signal.aborted,false);
  const pending=st.step({signal:controller.signal});
  timer=setTimeout(()=>controller.abort('interrupt live packed producer'),0);
  let first;
  await assert.rejects(pending,error=>{first=error;return error.kind==='cancelled'});
  assert.equal(controller.signal.aborted,true);
  clearTimeout(timer);
  // Deferred connection close is not requested here: the very same statement
  // must be able to reset and re-admit its private state after interruption.
  assert.throws(()=>st.reset(),error=>error===first);
  st.bind(1,'small');
  const rows=[];while(await st.step()==='row')rows.push(st.column(0));
  assert.deepEqual(rows,[1n,2n,3n,4n]);
  st.finalize();st=null;
 }finally{clearTimeout(timer);try{st?.finalize()}finally{await db?.closeDeferred();await new Promise(r=>server.close(r))}}
});

// Instrument only cleanup diagnostics and read-only budget observations. SQL,
// compilation, copy/insertion/control callbacks run unchanged through public
// Fetch. Throwing AFTER real close exercises primary-vs-secondary ordering.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
test(`packed public ${encoding} ${correlated?'rebuild':'Once'} deadline outranks close collision and refunds`,async()=>{
 const {PrivateKeyVmCursor}=await import('../../../src/internal/private-key-vm.ts');
 const {PrivateStateByteBudget}=await import('../../../src/internal/private-state.ts');
 const close=PrivateKeyVmCursor.prototype.close,reserve=PrivateStateByteBudget.prototype.reserve;
 const budgets=new Set();let peak=0,closes=0,db,st;
 const secondary=new Error('test secondary after actual private close');
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);const result=reserve.apply(this,args);peak=Math.max(peak,this.usedBytes);return result};
 PrivateKeyVmCursor.prototype.close=function(){closes++;close.call(this);throw secondary};
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  st=db.prepare(`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q${correlated?' WHERE q.id<=p.id':''}) FROM pairs p`).statement;
  st.bind(1,'x'.repeat(20000));
  assert.equal(await st.step(),'row');assert.equal(st.column(0),1n);
  let first;
  await assert.rejects(st.step({timeoutMs:0}),error=>{first=error;return error.kind==='timeout'});
  assert.notEqual(first,secondary);assert.ok(closes>0,'actual published cursor closed despite deadline');
  assert.ok(peak>0,'execution admitted private reservations');
  assert.ok(budgets.size>0);for(const budget of budgets)assert.equal(budget.usedBytes,0,'terminal failure releases all private reservations');
  const before=closes;assert.throws(()=>st.reset(),error=>error===first);assert.equal(closes,before,'reset does not close failed owners twice');
  PrivateKeyVmCursor.prototype.close=close;
  st.bind(1,'small');const rows=[];while(await st.step()==='row')rows.push(st.column(0));assert.deepEqual(rows,[1n,2n,3n,4n]);
  for(const budget of budgets)assert.equal(budget.usedBytes,0,'successful halt releases reservations too');
  st.finalize();st=null;
 }finally{
  PrivateKeyVmCursor.prototype.close=close;PrivateStateByteBudget.prototype.reserve=reserve;
  try{st?.finalize()}finally{await db?.closeDeferred();await new Promise(r=>server.close(r))}
 }
});

// Deadline expires in real task turns, not timeout0 at entry. Observer delegates
// unchanged scheduler; it does not delay, select an opcode, or inject an error.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
test(`packed public ${encoding} ${correlated?'rebuild':'Once'} live deadline across real task awaits`,async()=>{
 const {ExecutionTaskScheduler}=await import('../../../src/internal/task-scheduler.ts');
 const {PrivateStateByteBudget}=await import('../../../src/internal/private-state.ts');
 const yieldTask=ExecutionTaskScheduler.prototype.yield,reserve=PrivateStateByteBudget.prototype.reserve;
 let turns=0;const budgets=new Set();let db,st;
 ExecutionTaskScheduler.prototype.yield=function(){turns++;return yieldTask.call(this)};
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args)};
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  st=db.prepare(`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q${correlated?' WHERE q.id<=p.id':''}) FROM pairs p`).statement;
  st.bind(1,'x'.repeat(20000));
  if(correlated)assert.equal(await st.step(),'row');
  turns=0;let first;
  await assert.rejects(st.step({timeoutMs:20}),error=>{first=error;return error.kind==='timeout'});
  assert.ok(turns>0,'deadline crosses actual production scheduler awaits');
  assert.ok(budgets.size>0,'private state was admitted before expiry');
  for(const budget of budgets)assert.equal(budget.usedBytes,0,'deadline refunds execution reservations');
  assert.throws(()=>st.reset(),error=>error===first);
  st.bind(1,'small');const rows=[];while(await st.step()==='row')rows.push(st.column(0));assert.deepEqual(rows,[1n,2n,3n,4n]);
  for(const budget of budgets)assert.equal(budget.usedBytes,0);
  st.finalize();st=null;
 }finally{
  ExecutionTaskScheduler.prototype.yield=yieldTask;PrivateStateByteBudget.prototype.reserve=reserve;
  try{st?.finalize()}finally{await db?.closeDeferred();await new Promise(r=>server.close(r))}
 }
});

// Paired boundary ordering: control already pending at entry precedes RHS
// admission; once admission has failed, later control cannot replace saved rc.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
test(`packed public ${encoding} ${correlated?'rebuild':'Once'} paired control and entry admission ordering`,async()=>{
 const {PrivateStateByteBudget}=await import('../../../src/internal/private-state.ts');
 const {ExecutionTaskScheduler}=await import('../../../src/internal/task-scheduler.ts');
 const reserve=PrivateStateByteBudget.prototype.reserve,yieldTask=ExecutionTaskScheduler.prototype.yield;
 const budgets=new Set();let turns=0,db,st;
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args)};
 ExecutionTaskScheduler.prototype.yield=function(){turns++;return yieldTask.call(this)};
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxPrivateEntries:1}});
  st=db.prepare(`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q WHERE q.id<=?2${correlated?' AND q.id<=p.id':''}) FROM pairs p`).statement;
  st.bind(1,'x'.repeat(20000));st.bind(2,4n);
  const early=new AbortController();early.abort('already pending');let first;
  await assert.rejects(st.step({signal:early.signal}),error=>{first=error;return error.kind==='cancelled'});
  assert.equal(turns,0,'entry control wins before awaited private admission');
  assert.throws(()=>st.reset(),error=>error===first);
  const late=new AbortController();let admission,rows=0;turns=0;
  await assert.rejects(async()=>{while(await st.step({signal:late.signal})==='row')rows++},error=>{admission=error;return error.kind==='limit'&&error.message==='private index entry limit'});
  assert.ok(turns>0,'real admission failure follows production awaits');
  if(correlated)assert.ok(rows>0);else assert.equal(rows,0);
  late.abort('after admission failure');
  assert.throws(()=>st.reset(),error=>error===admission,'late cancellation cannot replace saved admission error');
  assert.ok(budgets.size>0);for(const budget of budgets)assert.equal(budget.usedBytes,0);
  st.bind(1,'small');st.bind(2,1n);const ids=[];while(await st.step()==='row')ids.push(st.column(0));assert.deepEqual(ids,[1n,2n,3n,4n]);
  for(const budget of budgets)assert.equal(budget.usedBytes,0);
  st.finalize();st=null;
 }finally{
  PrivateStateByteBudget.prototype.reserve=reserve;ExecutionTaskScheduler.prototype.yield=yieldTask;
  try{st?.finalize()}finally{await db?.closeDeferred();await new Promise(r=>server.close(r))}
 }
});

// Observe the complete production reservation peak, then replay the immutable
// program with exactly that admission limit and one byte less. No allocation,
// insertion, scheduler or budget failure is synthesized by the observer.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
test(`packed public ${encoding} ${correlated?'rebuild':'Once'} exact aggregate reservation peak boundary`,async()=>{
 const {PrivateStateByteBudget}=await import('../../../src/internal/private-state.ts');
 const reserve=PrivateStateByteBudget.prototype.reserve,replace=PrivateStateByteBudget.prototype.replace;
 let peak=0;const budgets=new Set();
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);const result=reserve.apply(this,args);peak=Math.max(peak,this.usedBytes);return result};
 PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);const result=replace.apply(this,args);peak=Math.max(peak,this.usedBytes);return result};
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url=`http://127.0.0.1:${server.address().port}/db`;
 const sql=`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q WHERE q.id<=?2${correlated?' AND q.id<=p.id':''}) FROM pairs p`;
 async function run(maxBytes,fail){let db,st;try{
  db=await openFixture(new Request(url),maxBytes===undefined?undefined:{limits:{maxPrivateBytes:maxBytes}});
  st=db.prepare(sql).statement;st.bind(1,'x'.repeat(2000));st.bind(2,4n);
  const rows=[];let first;
  const drain=async()=>{while(await st.step()==='row')rows.push([st.column(0),st.column(1)])};
  if(fail){await assert.rejects(drain(),error=>{first=error;return error.kind==='limit'&&error.message==='private state exceeds total byte limit'});assert.throws(()=>st.reset(),error=>error===first);
   st.bind(1,'small');st.bind(2,1n);while(await st.step()==='row'){};
  }else await drain();
  for(const budget of budgets)assert.equal(budget.usedBytes,0);
  st.finalize();st=null;return rows;
 }finally{try{st?.finalize()}finally{await db?.closeDeferred()}}}
 try{
  const baseline=await run();const admittedPeak=peak;assert.ok(admittedPeak>2000);
  peak=0;assert.deepEqual(await run(admittedPeak,false),baseline);assert.equal(peak,admittedPeak,'same program has deterministic peak');
  await run(admittedPeak-1,true);
 }finally{
  PrivateStateByteBudget.prototype.reserve=reserve;PrivateStateByteBudget.prototype.replace=replace;
  await new Promise(r=>server.close(r));
 }
});

// Fault at the inner lease boundary, before cursor/arena final refunds, not
// after the entire owner close. Real lease revocation itself still completes.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
test(`packed public ${encoding} ${correlated?'rebuild':'Once'} inner cleanup diagnostic before owner refund`,async()=>{
 const {PrivatePageLease}=await import('../../../src/internal/private-blobkey-pages.ts');
 const {PrivateStateByteBudget}=await import('../../../src/internal/private-state.ts');
 const release=PrivatePageLease.prototype.release,reserve=PrivateStateByteBudget.prototype.reserve;
 const budgets=new Set();let armed=false,faults=0,remainingAtFault=0,db,st;
 const secondary=new Error('inner lease diagnostic before owner refund');
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args)};
 PrivatePageLease.prototype.release=function(){release.call(this);if(armed){faults++;for(const b of budgets)remainingAtFault+=b.usedBytes;throw secondary}};
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  st=db.prepare(`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q${correlated?' WHERE q.id<=p.id':''}) FROM pairs p`).statement;
  st.bind(1,'x'.repeat(20000));assert.equal(await st.step(),'row');
  armed=true;let primary;
  await assert.rejects(st.step({timeoutMs:0}),e=>{primary=e;return e.kind==='timeout'});
  armed=false;assert.ok(faults>0);assert.ok(remainingAtFault>0,'diagnostic occurs with owner charges still live');
  for(const b of budgets)assert.equal(b.usedBytes,0,'close continues past inner failure to final refund');
  assert.throws(()=>st.reset(),e=>e===primary);assert.notEqual(primary,secondary);
  st.bind(1,'small');const ids=[];while(await st.step()==='row')ids.push(st.column(0));assert.deepEqual(ids,[1n,2n,3n,4n]);
  for(const b of budgets)assert.equal(b.usedBytes,0);st.finalize();st=null;
 }finally{
  armed=false;PrivatePageLease.prototype.release=release;PrivateStateByteBudget.prototype.reserve=reserve;
  try{st?.finalize()}finally{await db?.closeDeferred();await new Promise(r=>server.close(r))}
 }
});

// Deliver a public signal only after a real scheduler task resolves while
// private bytes are live. The same program without delivery reaches admission.
for(const encoding of ['utf8','utf16le','utf16be'])for(const correlated of [false,true])
test(`packed public ${encoding} ${correlated?'rebuild':'Once'} live task cancellation precedes pending entry admission`,async()=>{
 const {ExecutionTaskScheduler}=await import('../../../src/internal/task-scheduler.ts');
 const {PrivateStateByteBudget}=await import('../../../src/internal/private-state.ts');
 const yieldTask=ExecutionTaskScheduler.prototype.yield,reserve=PrivateStateByteBudget.prototype.reserve;
 const budgets=new Set();let deliver=false,delivered=false,signalOwner,db,st;
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args)};
 ExecutionTaskScheduler.prototype.yield=async function(){await yieldTask.call(this);if(deliver&&!delivered&&[...budgets].some(b=>b.usedBytes>0)){delivered=true;signalOwner.abort('live task delivery')}};
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxPrivateEntries:1}});
  st=db.prepare(`SELECT p.id,(p.a,?1) IN (SELECT q.a,?1 FROM pairs q WHERE q.id<=?2${correlated?' AND q.id<=p.id':''}) FROM pairs p`).statement;
  st.bind(1,'x'.repeat(20000));st.bind(2,4n);signalOwner=new AbortController();deliver=true;
  let first;await assert.rejects(async()=>{while(await st.step({signal:signalOwner.signal})==='row'){}},e=>{first=e;return e.kind==='cancelled'});
  assert.equal(delivered,true);for(const b of budgets)assert.equal(b.usedBytes,0);assert.throws(()=>st.reset(),e=>e===first);
  deliver=false;signalOwner=new AbortController();let admission;
  await assert.rejects(async()=>{while(await st.step({signal:signalOwner.signal})==='row'){}},e=>{admission=e;return e.kind==='limit'&&e.message==='private index entry limit'});
  for(const b of budgets)assert.equal(b.usedBytes,0);assert.throws(()=>st.reset(),e=>e===admission);
  st.bind(1,'small');st.bind(2,1n);const ids=[];while(await st.step()==='row')ids.push(st.column(0));assert.deepEqual(ids,[1n,2n,3n,4n]);
  for(const b of budgets)assert.equal(b.usedBytes,0);st.finalize();st=null;
 }finally{
  deliver=false;ExecutionTaskScheduler.prototype.yield=yieldTask;PrivateStateByteBudget.prototype.reserve=reserve;
  try{st?.finalize()}finally{await db?.closeDeferred();await new Promise(r=>server.close(r))}
 }
});
