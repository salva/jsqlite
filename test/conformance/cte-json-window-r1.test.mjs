import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {open} from '../../src/index.ts';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/cte-json-window-r1-native.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
function cell(st,i){
 const type=st.columnType(i),v=st.column(i);
 if(type==='null')return {type};
 if(type==='integer')return {type,value:String(v)};
 if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')};}
 return type==='text'?{type,utf8Hex:Buffer.from(v).toString('hex')}:{type,hex:Buffer.from(v).toString('hex')};
}
for(const variant of native.encodings)test(`R1 retained CTE JSON Window matrix ${variant.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${variant.encoding}-corrected.sqlite`,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/r1');}finally{globalThis.fetch=prior;}
 try{for(const c of variant.cases){
  assert.equal(c.prepare,0,c.id);const st=db.prepare(c.sql).statement;
  try{
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),c.columns,c.id+' metadata');
   for(let pass=0;pass<3;pass++){
    const rows=[];let failure;
    try{while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>cell(st,i)));}catch(e){failure=e;}
    assert.deepEqual(rows,c.runs[pass].rows,c.id+' run '+pass);
    if(c.runs[pass].end===101){assert.equal(failure,undefined);if(pass<2)st.reset();}
    else {assert.ok(failure,c.id+' expected native error');assert.match(failure.message,new RegExp(c.runs[pass].error));assert.throws(()=>st.reset(),e=>e===failure);break;}
   }
  }finally{st.finalize();}
 }}finally{db.close();}
});
for(const variant of native.encodings)test(`R1 same-composition timer suspension cancellation deadline ${variant.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${variant.encoding}-corrected.sqlite`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/r1-controls');}finally{globalThis.fetch=prior;}
 // Bounded lifecycle fixture, not a stress benchmark: 2,000 values per
 // physical row still suspend before output and admit real cancellation and
 // deadline failures on this route. Keep the same workload for restart; the
 // former 20,000-value fixture exceeded the unchanged 30s/file watchdog.
 const payload=JSON.stringify(Array.from({length:2000},(_,i)=>i%31));
 const sql=`WITH c AS (SELECT t.x,j.value FROM t JOIN json_each('${payload}') j) SELECT x,value,row_number() OVER (PARTITION BY x ORDER BY value) AS rn FROM c ORDER BY x,value`;
 try{
  let st=db.prepare(sql).statement,heartbeat=false;
  let timer=setTimeout(()=>{heartbeat=true;},0);
  try{assert.equal(await st.step(),'row');assert.equal(heartbeat,true,'host timer before first output');}finally{clearTimeout(timer);st.finalize();}
  st=db.prepare(sql).statement;const controller=new AbortController();let fired=false;
  timer=setTimeout(()=>{fired=true;controller.abort();},0);
  try{assert.equal(controller.signal.aborted,false);await assert.rejects(st.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.equal(fired,true);assert.throws(()=>st.reset(),e=>e.kind==='cancelled');assert.equal(await st.step(),'row');}finally{clearTimeout(timer);st.finalize();}
  st=db.prepare(sql).statement;
  try{await assert.rejects(st.step({timeoutMs:5}),e=>e.kind==='timeout');assert.throws(()=>st.reset(),e=>e.kind==='timeout');}finally{st.finalize();}
  const small=db.prepare(variant.cases.find(c=>c.id==='typed-peers').sql).statement;
  try{assert.equal(await small.step(),'row');}finally{small.finalize();}
 }finally{db.close();}
});
