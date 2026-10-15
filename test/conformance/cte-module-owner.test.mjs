import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/cte-module-owner/native.json',import.meta.url)));
function cell(v){if(v===null)return {type:'null'};if(typeof v==='bigint')return {type:'integer',value:String(v)};if(typeof v==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type:'real',ieee754be:b.toString('hex')};}if(typeof v==='string')return {type:'text',utf8Hex:Buffer.from(v).toString('hex')};return {type:'blob',hex:Buffer.from(v).toString('hex')};}
for(const image of native.encodings)test(`CTE module source identity ${image.encoding}`,async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response(readFileSync(new URL(`../fixtures/cte-module-owner/${image.file}`,import.meta.url)));
 let db;
 try{
  db=await open('https://fixture.invalid/cte-module');
  for(const expected of image.cases){
   const s=db.prepare(expected.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),expected.metadata,expected.sql);
    for(const run of expected.runs){if(run.bindings)run.bindings.forEach((v,i)=>s.bind(i+1,typeof v==='number'?BigInt(v):v));const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s.column(i))));assert.deepEqual(rows,run.rows,expected.sql);s.reset();}
   }finally{s.finalize();}
  }
  assert.throws(()=>db.prepare('WITH c AS (SELECT x,js FROM t) SELECT j.value FROM c JOIN json_each(c.missing) j'),/no such column/);
  for(const sql of [
   'SELECT c.x,j.value FROM (SELECT x,js FROM t LIMIT 2) c JOIN json_each(c.js) j ORDER BY c.x,j.value',
   'SELECT c.x,sum(j.value) FROM (SELECT x,js FROM t LIMIT 2) c JOIN json_each(c.js) j GROUP BY c.x',
   "WITH RECURSIVE c(x,js) AS (SELECT 1,'[7]' UNION ALL SELECT x+1,js FROM c WHERE x<2) SELECT c.x,j.value FROM c JOIN json_each(c.js) j"
  ])assert.throws(()=>db.prepare(sql),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary',sql);
  assert.throws(()=>db.prepare('WITH c AS (SELECT x,js FROM t) SELECT c.rowid FROM c JOIN json_each(c.js) j'),/no such column/);
  const recovery=db.prepare('SELECT 1').statement;try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);}finally{recovery.finalize();}
 }finally{db?.close();globalThis.fetch=previous;}
});
