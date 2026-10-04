import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
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
  const cancelled=db.prepare(sql).statement;bind(cancelled);
  const controller=new AbortController(),reason=new Error('joined WR live abort');
  const timer=setTimeout(()=>controller.abort(reason),0);let error;
  try{await assert.rejects(cancelled.step({signal:controller.signal}),e=>{error=e;return e.kind==='cancelled'&&e.cause===reason});}
  finally{clearTimeout(timer)}
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
 test(`joined WR private-byte admission error before publication and cleanup ${fixture.encoding}`,async()=>withBytes(fs.readFileSync(fixture.fixture),async db=>{
  const st=db.prepare("SELECT x.a,y.b FROM w x CROSS JOIN w y INDEXED BY wc WHERE y.c=x'ff' AND y.a=x.a ORDER BY y.b+0,x.a").statement;
  let error;await assert.rejects(st.step(),e=>{error=e;return e.kind==='limit'&&/byte limit/.test(e.message)});
  assert.ok(privateAccounting(st).indexSeeks>0,'sorter admission follows selected joined access');
  await assert.rejects(st.step(),e=>e===error);assert.throws(()=>st.reset(),e=>e===error);
  let repeated;await assert.rejects(st.step(),e=>{repeated=e;return e.kind==='limit'});assert.throws(()=>st.finalize(),e=>e===repeated);
  const fresh=db.prepare('SELECT x.a,y.b FROM w x CROSS JOIN w y INDEXED BY wc WHERE y.a=x.a').statement;
  assert.equal((await rows(fresh)).length,2);assert.ok(privateAccounting(fresh).indexNext>0);fresh.finalize();
 },{limits:{maxPrivateBytes:0}}));
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
