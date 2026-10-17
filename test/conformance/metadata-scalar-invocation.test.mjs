import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
const images=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/scalar-filter-native.json',import.meta.url)));
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/scalar-invocation-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
// Native replaces random() through sqlite3_create_function; public execution
// observes the same deterministic counter through the random() entropy boundary.
// Neither compiler nor execution opcodes are patched. This is not RNG quality testing.
for(const variant of native.variants)test(`${variant.encoding}: scalar Once, conditional invocation and in-progress cancellation`,async()=>{
 const image=images.encodings.find(x=>x.encoding===variant.encoding),bytes=Buffer.from(image.base64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const fetch=globalThis.fetch,crypto=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 let calls=0,abort;const controller=new AbortController();let db,st;
 globalThis.fetch=async()=>new Response(bytes);
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(array){
  calls++;new DataView(array.buffer,array.byteOffset,array.byteLength).setBigInt64(0,BigInt(calls));
  abort?.();return array;
 }}});
 const values=()=>[st.column(0),st.column(1)].map(x=>{assert.ok(x===null||typeof x==='bigint','preserve INTEGER/NULL storage class');return x===null?null:String(x);});
 try{
  db=await open('https://fixture.invalid/scalar-invocation');
  for(const c of variant.cases){
   st=db.prepare(c.sql).statement;
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),c.metadata);
   for(const run of c.runs){
    calls=0;st.bind(1,run.binding);const rows=[];
    while(await st.step()==='row')rows.push(values());
    assert.deepEqual(rows,run.rows,`${c.name}/${run.binding}`);assert.equal(calls,run.calls,c.name);st.reset();
   }
   st.finalize();st=undefined;
  }
  // Abort only after random() is evaluated by the correlated aggregate child.
  // Thus a pre-step rejection cannot satisfy this control. Drain is unordered
  // to allow either row publication or cancellation at the next checkpoint.
  st=db.prepare(variant.cases.find(c=>c.name==='correlated').sql).statement;st.bind(1,'t');calls=0;
  abort=()=>controller.abort('after scalar producer progress');let saved;
  try{while(await st.step({signal:controller.signal})==='row'){}assert.fail('expected cancellation');}catch(e){saved=e;assert.equal(e.kind,'cancelled');}
  assert.ok(calls>=1,'producer must have executed before abort');abort=undefined;
  await assert.rejects(st.step(),e=>e===saved);
  assert.throws(()=>st.reset(),e=>e===saved);
  calls=0;const rows=[];while(await st.step()==='row')rows.push(values());
  const expected=variant.cases.find(c=>c.name==='correlated').runs[0];
  assert.deepEqual(rows,expected.rows);assert.equal(calls,expected.calls);st.reset();
 }finally{
  try{st?.finalize();}finally{db?.close();globalThis.fetch=fetch;if(crypto)Object.defineProperty(globalThis,'crypto',crypto);else delete globalThis.crypto;}
 }
});
