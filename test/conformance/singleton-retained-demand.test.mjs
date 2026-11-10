import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
for(const encoding of ['utf8','utf16le','utf16be'])test(`singleton retained demand ${encoding}`,async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/demand');}finally{globalThis.fetch=old;}
 const child="SELECT a AS n,json_extract('bad','$') AS unused FROM t1 LIMIT 1";
 try{
  // Exact red210 witness; two executions must preserve INTEGER and reset.
  for(const [sql,want] of [[`SELECT n FROM (${child})`,1n],[`SELECT n FROM (SELECT a AS n,17 AS unused FROM t1 LIMIT 1)`,1n]]){
   const s=db.prepare(sql).statement;try{for(let i=0;i<2;i++){assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'integer');assert.equal(s.column(0),want);assert.equal(await s.step(),'done');s.reset();}}finally{s.finalize();}
  }
  // A demanded failing slot must not be pruned, including star expansion.
  for(const sql of [`SELECT unused FROM (${child})`,`SELECT * FROM (${child})`]){
   const s=db.prepare(sql).statement;try{for(let i=0;i<2;i++){let saved;await assert.rejects(()=>s.step(),e=>{saved=e;return e.kind==='sqlite'&&e.message==='malformed JSON';});assert.throws(()=>s.reset(),e=>e===saved);}}finally{s.finalize();}
  }
  const p=db.prepare('SELECT n FROM (SELECT ?1 AS unused,?2 AS n FROM t1 LIMIT 1)').statement;
  try{assert.equal(p.parameterCount,2);for(const n of [9n,12n]){p.bind(1,'unused');p.bind(2,n);assert.equal(await p.step(),'row');assert.equal(p.column(0),n);p.reset();}}finally{p.finalize();}
  assert.throws(()=>db.prepare('SELECT n FROM (SELECT a AS n,missing AS unused FROM t1 LIMIT 1)'),e=>e.kind==='sqlite');
 }finally{db.close();}
});
