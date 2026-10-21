import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/generated-aggregate-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
for(const image of native.encodings)test(`${image.encoding}: generated metadata arguments`,async t=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const fetch=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.invalid/generated-metadata');
  for(const c of image.cases)await t.test(c.sql,async()=>{
   const st=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),c.metadata);
    for(const expected of c.runs){
     const rows=[];let failure;
     try{while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{
      const v=st.column(i);return {type:v===null?5:typeof v==='bigint'?1:typeof v==='number'?2:typeof v==='string'?3:4,value:typeof v==='bigint'?String(v):v instanceof Uint8Array?Buffer.from(v).toString('hex'):v};
     }));}catch(e){failure=e;}
     assert.deepEqual(rows,expected.rows);
     if(expected.rc===101){assert.equal(failure,undefined);st.reset();}
     else{assert.equal(failure?.code,expected.rc);assert.equal(failure?.message,expected.error);assert.throws(()=>st.reset(),e=>e.code===expected.rc&&e.message===expected.error);}
    }
   }finally{st.finalize();}
  });
 }finally{db?.close();globalThis.fetch=fetch;}
});
for(const image of native.encodings)for(const mode of ['work','abort','deadline'])
test(`${image.encoding}: aggregate metadata ${mode} saved error/reset`,async()=>{
 const saved=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(image.base64,'base64'));let db,st;
 try{
  db=await open('https://fixture.invalid/aggregate-control');
  st=db.prepare('SELECT count(*),sum(p.cid) FROM outer_t t LEFT JOIN pragma_table_info(t.v) p ON p.cid=0').statement;
  const controller=new AbortController();controller.abort();
  const options=mode==='work'?{maxWorkUnits:1}:mode==='abort'?{signal:controller.signal}:{timeoutMs:0};let failure;
  await assert.rejects(st.step(options),e=>{failure=e;return e.kind===(mode==='work'?'limit':mode==='abort'?'cancelled':'timeout')});
  assert.throws(()=>st.reset(),e=>e===failure);
  for(let run=0;run<2;run++){assert.equal(await st.step(),'row');assert.equal(st.column(0),4n);assert.equal(st.column(1),0n);assert.equal(await st.step(),'done');st.reset();}
 }finally{st?.finalize();db?.close();globalThis.fetch=saved;}
});
