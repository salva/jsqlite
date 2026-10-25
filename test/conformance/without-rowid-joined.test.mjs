import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const original=JSON.parse(fs.readFileSync(new URL('./cases/row-width-wr-joined-native.json',import.meta.url)));
const native=JSON.parse(fs.readFileSync(new URL('./cases/without-rowid-joined-native.json',import.meta.url)));
test('joined WR native controls pair lookup plans with exact bindings and label post-runtime resources',()=>{
 for(const v of native.variants){
  for(const c of v.lookup){assert.deepEqual(c.eqpBindings,c.runs[0].bindings);assert.deepEqual(c.eqp,c.runs[0].eqp);assert.deepEqual(c.program,c.runs[0].program);for(const r of c.runs){assert.ok(r.eqp.some(row=>JSON.stringify(row).includes('wr_c')));assert.ok(r.program.length>0)}}
  for(const c of v.postRuntimeNativeControls){assert.equal(c.timing,'post-runtime');assert.equal(c.tsBudgetEquivalent,false);assert.equal(c.stepCode,c.kind==='progress-interrupt'?9:18);assert.equal(c.resetCode,c.stepCode);assert.equal(c.recoveryCode,101);assert.equal(c.finalizeCode,0);assert.ok(c.recoveryRows.length>0)}
 }
});
async function withBytes(bytes,run,options){
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`),options);await run(db)}finally{try{db?.closeDeferred()}finally{await new Promise(r=>server.close(r))}}
}
function typed(st){return Array.from({length:st.columnCount},(_,i)=>{const type=st.columnType(i),v=st.column(i);return type==='integer'?{type,value:String(v)}:type==='text'?{type,utf8Hex:Buffer.from(v).toString('hex')}:type==='null'?{type}:{type,hex:Buffer.from(v).toString('hex')}})}
async function rows(st){const out=[];while(await st.step()==='row')out.push(typed(st));return out}
for(let vi=0;vi<original.variants.length;vi++){
 const fixture=original.variants[vi],bytes=fs.readFileSync(fixture.fixture);
 test(`joined WR typed metadata/reset/rebind native ${fixture.encoding}`,async()=>withBytes(bytes,async db=>{
  for(const c of native.variants[vi].cases){const st=db.prepare(c.sql).statement;
   try{for(let i=0;i<3;i++){const m=c.metadata[i];assert.deepEqual(st.columnMetadata(i),{name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name})}
    for(let ri=0;ri<c.runs.length;ri++){if(ri)st.reset();const run=c.runs[ri];run.bindings.forEach((v,i)=>st.bind(i+1,Uint8Array.from(Buffer.from(v.hex,'hex'))));assert.deepEqual(await rows(st),run.rows);if(run.bindings.length)assert.ok(privateAccounting(st).indexSeeks>0)}
   }finally{st.finalize()}
  }
 }));
 test(`joined WR selected corruption/off-path covering ${fixture.encoding}`,async()=>{
  const pageSize=bytes.readUInt16BE(16)||65536;
  // Fixture's catalog owns roots w=2, wc=3; mutate only the selected page tag.
  for(const [root,selected,offpath] of [[2,'sqlite_autoindex_w_1','wc'],[3,'wc','sqlite_autoindex_w_1']]){
   const bad=Buffer.from(bytes);bad[(root-1)*pageSize]=0;
   await withBytes(bad,async db=>{
    const sql=hint=>`SELECT x.a,y.b,hex(y.c) FROM w x INDEXED BY ${hint} CROSS JOIN w y INDEXED BY ${hint} WHERE y.a=x.a ORDER BY x.a,y.b`;
    const good=async()=>{const st=db.prepare(sql(offpath)).statement;try{assert.equal((await rows(st)).length,2)}finally{st.finalize()}};
    await good();const st=db.prepare(sql(selected)).statement;let error;
    try{await assert.rejects(rows(st),e=>{error=e;return e.kind==='sqlite'&&e.code===11});assert.throws(()=>st.finalize(),e=>e===error)}finally{if(!error)st.finalize()}
    await good();
   });
  }
 });
 test(`joined WR LEFT miss clears primary/secondary and limits latch ${fixture.encoding}`,async()=>{
  await withBytes(bytes,async db=>{
   const st=db.prepare("SELECT x.a,y.b FROM w x LEFT JOIN w y INDEXED BY wc ON y.c=x'ff' AND y.a=x.a ORDER BY x.a").statement;
   try{for(let i=0;i<2;i++){if(i)st.reset();const out=[];while(await st.step()==='row')out.push([st.column(0),st.column(1)]);assert.deepEqual(out,[['A',null],['é',1n]])}}finally{st.finalize()}
  });
  await withBytes(bytes,async db=>{const st=db.prepare(original.sql).statement;let error;await assert.rejects(st.step(),e=>{error=e;return e.kind==='limit'});await assert.rejects(st.step(),e=>e===error);assert.throws(()=>st.finalize(),e=>e===error)}, {limits:{maxWorkUnits:1}});
 });
}

for(const variant of native.variants)test(`joined WR required-primary movement ${variant.encoding}`,async()=>withBytes(fs.readFileSync(variant.lookupFixture),async db=>{
 for(const c of variant.lookup){const st=db.prepare(c.sql).statement;try{for(let i=0;i<c.runs.length;i++){if(i)st.reset();st.bind(1,c.runs[i].bindings[0]);assert.deepEqual(await rows(st),c.runs[i].rows);if(c.runs[i].rows.length)assert.ok(privateAccounting(st).indexSeeks>0)}}finally{st.finalize()}}
}));

// Source discriminators: vdbe.c check_for_interrupt/abort_due_to_interrupt,
// vdbeapi.c sqlite3_reset -> VdbeReset/Rewind, and transient sorter ownership.
// These are TS public budget/checkpoint policies, not native timers, quotas,
// or retroactive native-FIRST evidence. Keep postRuntimeNativeControls labeled.
for(const fixture of original.variants){
 test(`joined WR live cancellation/deadline reset and reuse ${fixture.encoding}`,async()=>withBytes(fs.readFileSync(fixture.fixture),async db=>{
  const sql=`SELECT x.a,y.b,hex('${'z'.repeat(256*1024)}') FROM w x CROSS JOIN w y INDEXED BY wc WHERE y.c=?1 AND y.a=x.a`;
  const bind=st=>st.bind(1,Uint8Array.of(255));
  // A timer queued before step has no portable ordering against MessageChannel.
  // Observe a genuine production task AFTER selected access, then keep that
  // admitted VM suspension pending until a real timer callback delivers abort.
  // The witness never throws a cancellation error or changes admission/work.
  async function witnessedStep(st,controller,reason,abort){
   const productionYield=ExecutionTaskScheduler.prototype.yield;
   let timer,observed=0,ticks=0;
   assert.equal(controller.signal.aborted,false);
   ExecutionTaskScheduler.prototype.yield=async function(){
    await productionYield.call(this);
    if(observed||privateAccounting(st).indexSeeks===0)return;
    observed++;
    assert.equal(controller.signal.aborted,false);
    assert.throws(()=>db.prepare('SELECT 1'),e=>e.kind==='misuse');
    await new Promise(resolve=>{timer=setTimeout(()=>{
     ticks++;if(abort)controller.abort(reason);resolve();
    },0)});
   };
   try{return await st.step({signal:controller.signal});}
   finally{
    clearTimeout(timer);ExecutionTaskScheduler.prototype.yield=productionYield;
    assert.equal(observed,1,'selected work reaches a real production suspension');
    assert.equal(ticks,1,'one actual host timer delivered inside the operation');
   }
  }
  // Negative control: the identical witness without abort must publish the
  // typed row. Holding a genuine task alone must not manufacture a rejection.
  const control=db.prepare(sql).statement;bind(control);
  try{assert.equal(await witnessedStep(control,new AbortController(),null,false),'row');
   assert.equal(control.columnType(0),'text');assert.equal(control.column(0),'é');
   assert.equal(control.columnType(1),'integer');assert.equal(control.column(1),1n);
   assert.equal(control.columnType(2),'text');assert.equal(control.column(2),'7A'.repeat(256*1024));
  }finally{control.finalize()}
  const cancelled=db.prepare(sql).statement;bind(cancelled);
  const controller=new AbortController(),reason=new Error('joined WR live abort');let error;
  await assert.rejects(witnessedStep(cancelled,controller,reason,true),e=>{error=e;return e.kind==='cancelled'&&e.cause===reason});
  assert.ok(privateAccounting(cancelled).indexSeeks>0,'live abort follows selected joined work');
  await assert.rejects(cancelled.step(),e=>e===error);
  assert.throws(()=>cancelled.reset(),e=>e===error);
  // Reset restored binding/state despite reporting the old error; explicit
  // rebind verifies that a subsequent execution has no stale physical row.
  cancelled.bind(1,Uint8Array.of(0));assert.equal(await cancelled.step(),'row');cancelled.finalize();
  const timed=db.prepare(sql).statement;bind(timed);
  const now=Date.now;Date.now=()=>privateAccounting(timed).indexSeeks>0?1002:1000;
  let timeout;try{await assert.rejects(timed.step({timeoutMs:2}),e=>{timeout=e;return e.kind==='timeout'&&e.message==='statement execution timed out'});}finally{Date.now=now}
  assert.ok(privateAccounting(timed).indexSeeks>0,'deadline expires after selected joined work');
  await assert.rejects(timed.step(),e=>e===timeout);assert.throws(()=>timed.finalize(),e=>e===timeout);
  const fresh=db.prepare(native.variants.find(v=>v.encoding===fixture.encoding).cases[1].sql).statement;
  fresh.bind(1,Uint8Array.of(255));assert.deepEqual(await rows(fresh),native.variants.find(v=>v.encoding===fixture.encoding).cases[1].runs[0].rows);fresh.finalize();
 }));
 test(`joined WR private-byte admission error before publication and cleanup ${fixture.encoding}`,async()=>{
  const bytes=fs.readFileSync(fixture.fixture);
  const sql="SELECT x.a,y.b FROM w x CROSS JOIN w y INDEXED BY wc WHERE y.c=x'ff' AND y.a=x.a ORDER BY y.b+0,x.a";
  const control=native.variants.find(v=>v.encoding===fixture.encoding).boundary.find(c=>c.sql===sql);
  const checkMetadata=st=>{assert.equal(st.columnCount,control.metadata.length);control.metadata.forEach((m,i)=>assert.deepEqual(st.columnMetadata(i),{name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name}))};
  let peak;
  await withBytes(bytes,async db=>{
   const st=db.prepare(sql).statement;
   checkMetadata(st);assert.deepEqual(await rows(st),control.runs[0].rows);peak=privateAccounting(st).highwaterBytes;
   assert.ok(peak>0);assert.ok(privateAccounting(st).indexSeeks>0);
   st.finalize();
  });
  for(const cap of [0,peak-1,peak])await withBytes(bytes,async db=>{
  const st=db.prepare(sql).statement;
  if(cap===peak){for(let run=0;run<2;run++){if(run)st.reset();checkMetadata(st);assert.deepEqual(await rows(st),control.runs[run].rows)}st.finalize();return;}
  // First public step must reject: draining rows would permit publication
  // before the later limit and would not prove this boundary.
  let error;await assert.rejects(st.step(),e=>{error=e;return e.kind==='limit'&&/byte limit/.test(e.message)});
  if(cap===0)assert.equal(privateAccounting(st).indexSeeks,0,'input backing rejects before selected access');
  else assert.ok(privateAccounting(st).indexSeeks>0,'whole-operation peak follows selected joined access');
  await assert.rejects(st.step(),e=>e===error);assert.throws(()=>st.reset(),e=>e===error);
  let repeated;await assert.rejects(st.step(),e=>{repeated=e;return e.kind==='limit'});assert.throws(()=>st.finalize(),e=>e===repeated);
  const released=privateAccounting(st);
  assert.equal(released.ownedBytes,0);assert.equal(released.memBytes,0);
  assert.equal(released.recordBytes,0);assert.equal(released.scratchBytes,0);
  assert.equal(released.chargedBytes,released.refundedBytes);
  // Same connection remains usable even at zero quota for numeric output.
  const survivor=db.prepare('SELECT 1').statement;
  assert.deepEqual(await rows(survivor),[[{type:'integer',value:'1'}]]);survivor.finalize();
  // The independent text-projection recovery has its own register demand;
  // original zero quota cannot admit it merely because the failed owner closed.
  await withBytes(bytes,async recovery=>{
   const recoverySql='SELECT x.a,y.b FROM w x CROSS JOIN w y INDEXED BY wc WHERE y.a=x.a';
   const expected=native.variants.find(v=>v.encoding===fixture.encoding).boundary.find(c=>c.sql===recoverySql);
   const fresh=recovery.prepare(recoverySql).statement;
   for(let run=0;run<2;run++){
    if(run)fresh.reset();
    expected.metadata.forEach((m,i)=>assert.deepEqual(fresh.columnMetadata(i),{name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name}));
    // Recovery has no ORDER BY: compare exact typed bags, not incidental
    // native/TS traversal order. Multiplicity and storage classes remain exact.
    const bag=rs=>rs.map(r=>JSON.stringify(r)).sort();
    assert.deepEqual(bag(await rows(fresh)),bag(expected.runs[run].rows));
    const account=privateAccounting(fresh);
    assert.ok(account.indexNext>0);assert.ok(account.chargedBytes>0);assert.ok(account.memHighwaterBytes>0);
    assert.equal(account.ownedBytes,0);assert.equal(account.chargedBytes,account.refundedBytes);
   }
   fresh.finalize();
  });
 },{limits:{maxPrivateBytes:cap}});
 });
}

// Operation work ceilings tighten (do not mutate) the prepared connection
// ceiling. Reset reports the saved error after restoring retained bindings.
for(const variant of native.variants)test(`joined WR operation work ceiling reset retains typed bindings ${variant.encoding}`,async()=>withBytes(fs.readFileSync(original.variants.find(v=>v.encoding===variant.encoding).fixture),async db=>{
 const c=variant.cases[1],st=db.prepare(c.sql).statement;
 st.bind(1,Uint8Array.of(255));let error;
 await assert.rejects(st.step({maxWorkUnits:1}),e=>{error=e;return e.kind==='limit'&&e.message==='statement exceeds maxWorkUnits'});
 await assert.rejects(st.step(),e=>e===error);
 assert.throws(()=>st.reset(),e=>e===error);
 // No rebind: the BLOB is retained, while the operation ceiling is not sticky.
 assert.deepEqual(await rows(st),c.runs[0].rows);
 assert.ok(privateAccounting(st).indexSeeks>0);st.finalize();
 const fresh=db.prepare(c.sql).statement;fresh.bind(1,Uint8Array.of(0));
 assert.deepEqual(await rows(fresh),c.runs[1].rows);fresh.finalize();
}));
