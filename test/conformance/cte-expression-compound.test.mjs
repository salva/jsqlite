import {checkRetainedFillCancellation} from './retained-fill-cancellation.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
for(const encoding of ['utf8','utf16le','utf16be'])test(`enclosing CTE expression ALL ${encoding}`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/cte-expression');}finally{globalThis.fetch=old;}
 try{
  await checkRetainedFillCancellation(db,'WITH c AS MATERIALIZED (SELECT ?1 AS n FROM t1) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL SELECT count(*) FROM t1)',()=>4n);
  for(const sql of [
   'WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT a FROM c UNION ALL SELECT count(*) FROM t1)',
   "WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT EXISTS(SELECT a FROM c UNION ALL SELECT json_extract('bad','$') FROM t1)",
  ]){
   const statement=db.prepare(sql).statement;
   try{for(let cycle=0;cycle<2;cycle++){
    assert.equal(await statement.step(),'row');assert.equal(statement.columnType(0),'integer');assert.equal(statement.column(0),1n);
    assert.equal(await statement.step(),'done');statement.reset();
   }}finally{statement.finalize();}
  }
  for(const having of [0,1]){
   const statement=db.prepare(`WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT count(*) FROM c HAVING ${having} UNION ALL SELECT count(*) FROM t1)`).statement;
   try{for(let cycle=0;cycle<2;cycle++){
    assert.equal(await statement.step(),'row');assert.equal(statement.columnType(0),'integer');assert.equal(statement.column(0),4n);
    assert.equal(await statement.step(),'done');statement.reset();
   }}finally{statement.finalize();}
  }
  for(const [tail,want] of [
   ["SELECT json_extract('bad','$$') FROM t1",4n],
   ['SELECT count(*) FROM t1 LIMIT 1 OFFSET 1',4n],
   ['SELECT count(*) FROM t1 LIMIT 0',null],
  ]){
   const s=db.prepare(`WITH c AS MATERIALIZED (SELECT a FROM t1 LIMIT 2) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL ${tail})`).statement;
   try{for(let cycle=0;cycle<2;cycle++){
    assert.equal(await s.step(),'row');assert.equal(s.column(0),tail.includes('OFFSET')?4n:want===null?null:2n);
    assert.equal(await s.step(),'done');s.reset();
   }}finally{s.finalize();}
  }
  for(const [sql,meta,want] of [
   ['WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT count(*) AS left_count FROM c HAVING 1 UNION ALL SELECT count(*) AS right_count FROM t1',{name:'left_count',declaredType:null,database:null,table:null,origin:null},[4n,4n]],
   ['WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT a AS left_a FROM c UNION ALL SELECT count(*) AS right_count FROM t1',{name:'left_a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'},[1n,3n,5n,7n,4n]],
  ]){
   const s=db.prepare(sql).statement;
   try{assert.deepEqual(s.columnMetadata(0),meta);for(let cycle=0;cycle<2;cycle++){
    const rows=[];while(await s.step()==='row'){assert.equal(s.columnType(0),'integer');rows.push(s.column(0));}
    assert.deepEqual(rows,want);s.reset();
   }}finally{s.finalize();}
  }
  const errorStatement=db.prepare("WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT count(*) FROM c HAVING 0 UNION ALL SELECT json_extract('bad','$$') FROM t1)").statement;
  try{for(let cycle=0;cycle<2;cycle++){
   let saved;await assert.rejects(()=>errorStatement.step(),e=>{saved=e;return e.kind==='sqlite'&&e.message==='malformed JSON';});
   assert.throws(()=>errorStatement.reset(),e=>e===saved);
  }}finally{errorStatement.finalize();}
  const cancelled=db.prepare('WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL SELECT count(*) FROM t1)').statement;
  try{const controller=new AbortController();controller.abort('cte-before-step');
   await assert.rejects(()=>cancelled.step({signal:controller.signal}),e=>e.kind==='cancelled');
   assert.throws(()=>cancelled.reset(),e=>e.kind==='cancelled');
   assert.equal(await cancelled.step(),'row');assert.equal(cancelled.column(0),4n);
  }finally{cancelled.finalize();}
 }finally{db.close();}
 let bounded;const previous=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(bytes);bounded=await open('https://fixture.invalid/cte-budget',{limits:{maxPrivateEntries:0}});}finally{globalThis.fetch=previous;}
 try{
  const s=bounded.prepare('WITH c AS MATERIALIZED (SELECT a FROM t1) SELECT (SELECT count(*) FROM c HAVING 1 UNION ALL SELECT count(*) FROM t1)').statement;
  try{let saved;await assert.rejects(()=>s.step(),e=>{saved=e;return e.kind==='limit';});assert.throws(()=>s.reset(),e=>e===saved);}finally{s.finalize();}
  const s2=bounded.prepare('SELECT 1').statement;try{assert.equal(await s2.step(),'row');}finally{s2.finalize();}
 }finally{bounded.close();}
});
