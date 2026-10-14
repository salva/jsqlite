import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {open} from '../../src/index.ts';
import {retainedGroupQueries} from './retained-group-cases.mjs';
const root=process.env.RETAINED_GROUP_EXTENDED;
assert.ok(root,'RETAINED_GROUP_EXTENDED required');
const native=JSON.parse(readFileSync(resolve(root,'native.json')));
for(const image of native.encodings)test(`retained group exact native ${image.encoding}`,async()=>{
 const fetch=globalThis.fetch;globalThis.fetch=async()=>new Response(readFileSync(image.file));let db;
 try{
  db=await open('https://fixture.invalid/group');
  assert.deepEqual(image.cases.map(c=>c.sql),retainedGroupQueries);
  for(const c of image.cases){
   if(c.prepare!==0){assert.throws(()=>db.prepare(c.sql),e=>e.code===c.prepare&&e.message===c.error);continue;}
   const s=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata);
    for(const run of c.runs){
     const rows=[];let error;
     try{while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const type=s.columnType(i),v=s.column(i);return type==='null'?{type}:{type,value:type==='integer'?v.toString():v}}));}catch(e){error=e;}
     assert.deepEqual(rows,run.rows,c.sql);
     if(run.end!==101){assert.equal(error?.code,run.end);assert.equal(error?.message,run.error);assert.throws(()=>s.reset(),e=>e===error);}else{assert.equal(error,undefined);s.reset();}
    }
   }finally{s.finalize()}
  }
 }finally{db?.closeDeferred();globalThis.fetch=fetch}
});
