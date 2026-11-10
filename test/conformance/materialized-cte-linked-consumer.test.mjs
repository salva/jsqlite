import {checkRetainedFillCancellation} from './retained-fill-cancellation.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
for(const encoding of ['utf8','utf16le','utf16be'])test(`CF01 linked retained consumer ${encoding}`,async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/cf01');}finally{globalThis.fetch=old;}
 const prefix='WITH c AS MATERIALIZED (SELECT count(*) AS n FROM t1)';
 async function check(sql,expected,binds=[null,null],metadata={name:'n',declaredType:null,database:null,table:null,origin:null}){
  const s=db.prepare(sql).statement;
  try{assert.deepEqual(s.columnMetadata(0),metadata);
   for(const value of binds){if(value!==null)s.bind(1,value);const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);assert.deepEqual(rows,typeof expected==='function'?expected(value):expected);s.reset();}
  }finally{s.finalize();}
 }
 try{
  await checkRetainedFillCancellation(db,'WITH c AS MATERIALIZED (SELECT ?1 AS n FROM t1 LIMIT 2) SELECT length(n) FROM c WHERE length(n)>0',v=>BigInt(v.length));
  // select.c:5315: CTE SrcItems retain even unused result expressions.
  const failing=db.prepare("WITH c AS MATERIALIZED (SELECT a AS n,json_extract('bad','$') AS unused FROM t1 LIMIT 1) SELECT n FROM c").statement;
  try{for(let cycle=0;cycle<2;cycle++){
   let saved;
   await assert.rejects(()=>failing.step(),e=>{saved=e;return e.kind==='sqlite'&&e.code===1&&e.message==='malformed JSON';});
   assert.throws(()=>failing.reset(),e=>e===saved);
   await check('WITH c AS MATERIALIZED (SELECT a AS n,17 AS unused FROM t1 LIMIT 1) SELECT n FROM c',[[ 'integer',1n ]],[null,null],{name:'n',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});
  }}finally{failing.finalize();}
  await check("WITH c AS MATERIALIZED (SELECT a AS n,json_extract('bad','$') AS unused FROM t1 WHERE 0 LIMIT 1) SELECT n FROM c",[],[null,null],{name:'n',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});
  // Singleton no-ORDER coroutine follows the same tag0440 demand owner.
  await check("SELECT n FROM (SELECT a AS n,json_extract('bad',char(36)) AS unused FROM t1 LIMIT 1)",[[ 'integer',1n ]],[null,null],{name:'n',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});
  // Ordinary retained ORDER/LIMIT sources still prune unused result columns.
  await check("SELECT n FROM (SELECT a AS n,json_extract('bad','$') AS unused FROM t1 ORDER BY a LIMIT 1) WHERE n>0",[[ 'integer',1n ]],[null,null],{name:'n',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});
  await check(`${prefix} SELECT n FROM c`,[['integer',4n]]);
  for(const predicate of ['n<0','n+1<0','NULL'])await check(`${prefix} SELECT n FROM c WHERE ${predicate}`,[]);
  await check(`${prefix} SELECT n FROM c WHERE 1`,[['integer',4n]]);
  await check(`${prefix} SELECT n+1 AS n FROM c`,[['integer',5n]]);
  await check(`${prefix} SELECT n FROM c WHERE n=?1`,v=>v===4n?[['integer',4n]]:[],[4n,9n]);
  await check(`${prefix} SELECT n FROM c LIMIT 0`,[]);
  await check(`${prefix} SELECT n FROM c LIMIT 1 OFFSET 1`,[]);
  await check('WITH c AS MATERIALIZED (SELECT a AS n FROM t1 ORDER BY a LIMIT 2) SELECT n AS n FROM c WHERE n>1 LIMIT 1',[[ 'integer',3n ]],[null,null],{name:'n',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});
  await check('WITH c AS MATERIALIZED (SELECT a AS n FROM t1 WHERE 0) SELECT n+1 AS n FROM c WHERE n>0',[]);
  for(const [expr,type,value] of [["1.25",'real',1.25],["'é'",'text','é'],["x'00ff'",'blob',new Uint8Array([0,255])],["NULL",'null',null]])
   await check(`WITH c AS MATERIALIZED (SELECT ${expr} AS n FROM t1 LIMIT 1) SELECT n FROM c`,[[type,value]]);
  const stopped=db.prepare(`${prefix} SELECT n FROM c WHERE n>0`).statement;
  try{const ac=new AbortController();ac.abort();await assert.rejects(()=>stopped.step({signal:ac.signal}),e=>e.kind==='cancelled');try{stopped.reset();}catch(e){assert.equal(e.kind,'cancelled');}assert.equal(await stopped.step(),'row');assert.equal(stopped.column(0),4n);stopped.reset();}finally{stopped.finalize();}
  const reserve=PrivateStateByteBudget.prototype.reserve,budgets=new Set();
  PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args);};
  let resource;
  try{
   resource=db.prepare('WITH c AS MATERIALIZED (SELECT ?1 AS n FROM t1 LIMIT 2) SELECT length(n) AS n FROM c WHERE length(n)>0').statement;resource.bind(1,'x'.repeat(500000));
   const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),1);let first;
   try{await assert.rejects(resource.step({signal:ac.signal}),e=>{first=e;return e.kind==='cancelled';});}finally{clearTimeout(timer);}
   for(const budget of budgets)assert.equal(budget.usedBytes,0,'cancel refunds retained state');
   assert.throws(()=>resource.reset(),e=>e===first);resource.bind(1,'ok');
   for(let cycle=0;cycle<2;cycle++){assert.equal(await resource.step(),'row');assert.equal(resource.column(0),2n);resource.reset();for(const budget of budgets)assert.equal(budget.usedBytes,0,'early reset refunds retained state');}
   assert.ok(budgets.size>0,'observed retained reservations');
  }finally{try{resource?.finalize();}finally{PrivateStateByteBudget.prototype.reserve=reserve;}}
  const s=db.prepare(`${prefix} SELECT n FROM c WHERE json_extract('bad','$')`).statement;
  try{for(let cycle=0;cycle<2;cycle++){await assert.rejects(()=>s.step(),e=>e.kind==='sqlite'&&e.message==='malformed JSON');assert.throws(()=>s.reset(),e=>e.kind==='sqlite'&&e.message==='malformed JSON');}}finally{s.finalize();}
 }finally{db.close();}
});
