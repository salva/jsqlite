import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
const images=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/scalar-filter-native.json',import.meta.url)));
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/scalar-bind-native.json',import.meta.url)));
assert.equal(native.sourceId,images.sourceId);
for(const variant of native.variants)test(`${variant.encoding}: scalar producer rebind and retained reset`,async()=>{
 const image=images.encodings.find(x=>x.encoding===variant.encoding),bytes=Buffer.from(image.base64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,st;
 try{
  db=await open('https://fixture.invalid/scalar-bind');st=db.prepare(native.sql).statement;
  for(const run of variant.runs){
   st.bind(1,run.binding);
   for(const expected of run.cycles){
    assert.equal(await st.step(),'row');assert.deepEqual(st.column(0),expected.type==='null'?null:BigInt(expected.value));
    assert.equal(await st.step(),'done');st.reset();
   }
  }
  st.clearBindings();assert.equal(await st.step(),'row');assert.equal(st.column(0),null);assert.equal(await st.step(),'done');st.reset();
  assert.throws(()=>st.bind(2,'t'),e=>e.code===25);
  st.bind(1,'t');assert.equal(await st.step(),'row');assert.equal(st.column(0),6n);assert.equal(await st.step(),'done');st.reset();
  // A cancellation error is saved until reset, then the same producer is reusable.
  const controller=new AbortController();controller.abort('scalar-control');
  await assert.rejects(st.step({signal:controller.signal}),e=>e.kind==='cancelled');
  assert.throws(()=>st.reset(),e=>e.kind==='cancelled');
  assert.equal(await st.step(),'row');assert.equal(st.column(0),6n);
  st.finalize();st=undefined;db.close();db=undefined;
  // RHS SRT_Set must respect private entry budgets and retain the saved error.
  db=await open('https://fixture.invalid/scalar-budget',{limits:{maxPrivateEntries:0}});
  st=db.prepare(native.sql).statement;st.bind(1,'t');
  await assert.rejects(st.step(),e=>e.kind==='limit');
  assert.throws(()=>st.reset(),e=>e.kind==='limit');
  st.bind(1,'missing');assert.equal(await st.step(),'row');assert.equal(st.column(0),null);
 }finally{try{st?.finalize();}finally{db?.close();globalThis.fetch=previous;}}
});
