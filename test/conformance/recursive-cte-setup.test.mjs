import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
for(const enc of ['utf8','utf16le','utf16be'])test(`physical recursive setup ${enc}`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-${enc}.db`,import.meta.url)));
 let db;try{db=await open('https://fixture.invalid/cf04');
 // select.c sends ordinary GROUP/HAVING setup output to destQueue too.
 for(const [seed,expected] of [
  ['SELECT 1 GROUP BY 1 HAVING 1',[1n,2n]],
  ['SELECT 1 GROUP BY 1 HAVING 0',[]],
  ['SELECT DISTINCT 1',[1n,2n]],
  ['SELECT 1 WHERE 0',[]],
 ]){
  const s=db.prepare(`WITH RECURSIVE c(n) AS (${seed} UNION ALL SELECT n+1 FROM c WHERE n<2) SELECT n FROM c`).statement;
  try{assert.deepEqual(s.columnMetadata(0),{name:'n',declaredType:null,database:null,table:null,origin:null});
   for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row'){assert.equal(s.columnType(0),'integer');rows.push(s.column(0));}assert.deepEqual(rows,expected);s.reset();}
  }finally{s.finalize();}
 }
 const overflow=db.prepare('WITH RECURSIVE c(n) AS (SELECT abs(-9223372036854775808) UNION ALL SELECT n+1 FROM c WHERE n<2) SELECT n FROM c').statement;
 const isOverflow=e=>e.kind==='sqlite'&&e.code===1&&e.message==='integer overflow';
 try{await assert.rejects(overflow.step(),isOverflow);}finally{assert.throws(()=>overflow.finalize(),isOverflow);}
 for(const [seed,op,control,expected] of [
  ['SELECT a FROM t1','UNION ALL','',[1n,3n,5n,7n,2n,3n]],
  ['SELECT a FROM t1 WHERE a<0','UNION ALL','',[]],
  ['SELECT a FROM t1','UNION','',[1n,3n,5n,7n,2n]],
  ['SELECT a FROM t1','UNION ALL','ORDER BY 1 DESC',[7n,5n,3n,1n,2n,3n]],
  ['SELECT a FROM t1','UNION ALL','LIMIT 3 OFFSET 1',[3n,5n,7n]],
 ]){const s=db.prepare(`WITH RECURSIVE c(n) AS (${seed} ${op} SELECT n+1 FROM c WHERE n<3 ${control}) SELECT n FROM c`).statement;
 try{assert.deepEqual(s.columnMetadata(0),{name:'n',declaredType:null,database:null,table:null,origin:null});for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row'){assert.equal(s.columnType(0),'integer');rows.push(s.column(0));}assert.deepEqual(rows,expected);s.reset();}}finally{s.finalize();}}
 for(const [op,expected] of [['UNION',['a']],['UNION ALL',['a','A','A','A']]]){
  const s=db.prepare(`WITH RECURSIVE c(n) AS (SELECT CASE WHEN a=1 THEN 'a' ELSE 'A' END COLLATE nocase FROM t1 ${op} SELECT n FROM c WHERE 0) SELECT n FROM c`).statement;
  try{const rows=[];while(await s.step()==='row')rows.push(s.column(0));assert.deepEqual(rows,expected);}finally{s.finalize();}
 }
 for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){
  const s=db.prepare('WITH RECURSIVE c(n) AS (SELECT a FROM t1 UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT n FROM c').statement;
  try{await assert.rejects(s.step(options),e=>e.kind===kind);assert.throws(()=>s.reset(),e=>e.kind===kind);assert.equal(await s.step(),'row');}finally{s.finalize();}
 }
 const bound=db.prepare('WITH RECURSIVE c(n) AS (SELECT a FROM t1 WHERE a<?1 UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT n FROM c LIMIT ?2').statement;
 try{for(const [cutoff,expected] of [[0n,[]],[4n,[1n,3n]]]){bound.bind(1,cutoff);bound.bind(2,2n);const rows=[];while(await bound.step()==='row')rows.push(bound.column(0));assert.deepEqual(rows,expected);bound.reset();}}finally{bound.finalize();}
 for(const [sql,message] of [
  ['WITH RECURSIVE c(n) AS (SELECT wrong.a FROM t1 UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT n FROM c LIMIT 0','no such column: wrong.a'],
  ['WITH RECURSIVE c(n) AS (SELECT a FROM t1 UNION ALL SELECT n+1 FROM c WHERE n<3) SELECT wrong.n FROM c','no such column: wrong.n'],
 ])assert.throws(()=>db.prepare(sql),e=>e.kind==='sqlite'&&e.code===1&&e.message===message);
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
