import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {open} from '../../src/index.ts';

// Independently captured pinned native snapshots, supplied by the producer.
// No fallback to a host SQLite or TS-created oracle.
const root=process.env.COMMON_CHECKPOINT_OUTPUT;
assert.ok(root,'COMMON_CHECKPOINT_OUTPUT must name fresh pinned capture output');
const native=JSON.parse(readFileSync(resolve(root,'native.json')));
for(const image of native.encodings)test(`retained ORDER/LIMIT aggregate ${image.encoding}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(readFileSync(image.file));let db;
 try{
  db=await open('https://fixture.invalid/derived-aggregate');
  for(const c of image.cases){
   if(c.prepare!==0){assert.throws(()=>db.prepare(c.sql),e=>e.code===c.prepare&&e.message===c.error);continue;}
   const s=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata,c.sql);
    for(const run of c.runs){const rows=[];let error;
     try{while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s.column(i))));}catch(e){error=e;}
     assert.deepEqual(rows,run.rows,c.sql);
     if(run.end===101){assert.equal(error,undefined,c.sql);s.reset();}
     else{assert.equal(error?.code,run.end,c.sql);assert.equal(error?.message,run.error,c.sql);assert.throws(()=>s.reset(),e=>e===error);}
    }
   }finally{try{s.finalize();}catch(e){assert.notEqual(c.runs[0].end,101);}}
  }
 }finally{db?.close();globalThis.fetch=old;}
});

function cell(v){if(v===null)return {type:'null'};if(typeof v==='bigint')return {type:'integer',value:String(v)};if(typeof v==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type:'real',ieee754be:b.toString('hex')};}if(typeof v==='string')return {type:'text',utf8Hex:Buffer.from(v).toString('hex')};return {type:'blob',hex:Buffer.from(v).toString('hex')}}
