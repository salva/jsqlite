import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
const images=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/scalar-filter-native.json',import.meta.url)));
const native=JSON.parse(readFileSync(new URL('../../docs/research/beta6-destination-native.json',import.meta.url)));
assert.equal(native.sourceId,images.sourceId);
for(const variant of native.variants)test(`${variant.encoding}: FROM-backed aggregate destination guard union matches pinned C`,async()=>{
 const image=images.encodings.find(x=>x.encoding===variant.encoding),bytes=Buffer.from(image.base64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,st;
 try{
  db=await open('https://fixture.invalid/beta6-destination');
  for(const item of variant.cases){
   if(item.prepare){assert.throws(()=>db.prepare(item.sql),e=>e.code===item.prepare&&e.message===item.message);continue;}
   st=db.prepare(item.sql).statement;
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.metadata,item.sql);
   for(const run of item.runs){
    if(item.sql.includes('?1'))st.bind(1,run.binding===null?null:BigInt(run.binding));
    const rows=[];
    while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>({type:st.columnType(i),value:st.column(i)===null?null:String(st.column(i))})));
    assert.equal(run.end,101);assert.deepEqual(rows,run.rows,item.sql);st.reset();
   }
   st.finalize();st=undefined;
  }
  const sql='SELECT 7 IN (SELECT x FROM t GROUP BY x) AS member';
  st=db.prepare(sql).statement;
  const controller=new AbortController();controller.abort('destination-control');
  await assert.rejects(st.step({signal:controller.signal}),e=>e.kind==='cancelled');
  assert.throws(()=>st.reset(),e=>e.kind==='cancelled');st.finalize();st=undefined;
  db.close();db=undefined;
  db=await open('https://fixture.invalid/beta6-destination',{limits:{maxPrivateEntries:0}});
  st=db.prepare(sql).statement;let saved;
  await assert.rejects(st.step(),e=>{saved=e;return e.kind==='limit';});
  await assert.rejects(st.step(),e=>e===saved);assert.throws(()=>st.reset(),e=>e===saved);
  st.finalize();st=undefined;db.close();db=undefined;
 }finally{try{st?.finalize();}finally{db?.close();globalThis.fetch=previous;}}
});
