import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/identity-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
for(const image of native.encodings)test(`${image.encoding}: metadata cursor identity native controls`,async t=>{
 const bytes=Buffer.from(image.base64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const fetch=globalThis.fetch;let db;
 globalThis.fetch=async()=>new Response(bytes);
 try{
  db=await open('https://fixture.invalid/metadata-identity');
  for(const c of image.cases)await t.test(c.sql,async()=>{
   let st;
   try{
    st=db.prepare(c.sql).statement;
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),c.metadata);
    for(const expected of c.runs){
     const rows=[];
     while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{
      const v=st.column(i);assert.ok(v===null||typeof v==='bigint'||typeof v==='string');
      return {type:v===null?5:typeof v==='bigint'?1:3,value:typeof v==='bigint'?String(v):v};
     }));
     assert.deepEqual(rows,expected);st.reset();
    }
   }finally{st?.finalize();}
  });
 }finally{db?.close();globalThis.fetch=fetch;}
});
