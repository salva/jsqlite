import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/joined-metadata-window/native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
function cell(st,i){
 const type=st.columnType(i),v=st.column(i);
 if(type==='null')return {type};
 if(type==='integer')return {type,value:String(v)};
 if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')};}
 return type==='text'?{type,utf8Hex:Buffer.from(v).toString('hex')}:{type,hex:Buffer.from(v).toString('hex')};
}
for(const image of native.encodings)test(`${image.encoding}: joined metadata Window native parity`,async t=>{
 const bytes=Buffer.from(image.base64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/joined-metadata-window');}
 finally{globalThis.fetch=prior;}
 try{
  for(const c of image.cases)await t.test(c.sql,async()=>{
   const st=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),c.metadata);
    for(const expected of c.runs){
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>cell(st,i)));
     assert.deepEqual(rows,expected.rows);st.reset();
    }
   }finally{st.finalize();}
   const recovery=db.prepare('SELECT 1').statement;
   try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);}finally{recovery.finalize();}
  });
 }finally{db.close();}
});
