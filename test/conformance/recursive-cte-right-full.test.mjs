import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
// Native 3.53.4 duplicate/false/NULL ON comparison: card-k-e status evidence.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`retained prefix RIGHT/FULL ${encoding}`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`../fixtures/recursive-join/${encoding}-corrected.sqlite`,import.meta.url)));let db;
 try{
  db=await open('https://fixture.invalid/recursive-right');
  const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/recursive-join/right-full-native.json',import.meta.url)));
  for(const c of capture.cases.filter(c=>c.encoding===encoding)){
   const s=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata,c.sql);
    for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const v=s.column(i);return v===null?{type:'null'}:{type:typeof v==='bigint'?'integer':typeof v,value:String(v)};}));assert.deepEqual(rows,c.rows,c.sql);s.reset();}
   }finally{s.finalize();}
  }
  const prefix='WITH RECURSIVE r(x) AS (VALUES(1),(1) UNION ALL SELECT x+1 FROM r WHERE x<2) ';
  const query=async(sql,expected)=>{const s=db.prepare(sql).statement;try{for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,expected,sql);s.reset();}}finally{s.finalize();}};
  for(const kind of ['RIGHT','FULL']){
   await query(prefix+`SELECT r.x,t.x FROM r ${kind} JOIN t ON r.x=t.x ORDER BY t.x,r.x`,[[1n,1n],[1n,1n],[2n,2n],[2n,2n],[null,3n]]);
   for(const on of ['0','NULL'])await query(prefix+`SELECT r.x,t.x FROM r ${kind} JOIN t ON ${on} ORDER BY t.x,r.x`,[...(kind==='FULL'?[[1n,null],[1n,null],[2n,null],[2n,null]]:[]),[null,1n],[null,2n],[null,3n]]);
   await query(prefix+`SELECT r.x,t.x FROM r ${kind} JOIN t ON r.x=t.x WHERE r.x IS NULL ORDER BY t.x`,[[null,3n]]);
   await query('WITH RECURSIVE r(x) AS (SELECT 1 WHERE 0 UNION ALL SELECT x+1 FROM r WHERE x<2) '+`SELECT r.x,t.x FROM r ${kind} JOIN t ON r.x=t.x ORDER BY t.x`,[[null,1n],[null,2n],[null,3n]]);
  }
  for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){
   const s=db.prepare(prefix+'SELECT r.x,t.x FROM r FULL JOIN t ON r.x=t.x').statement;
   try{await assert.rejects(s.step(options),e=>e.kind===kind);assert.throws(()=>s.reset(),e=>e.kind===kind);assert.equal(await s.step(),'row');}finally{s.finalize();}
  }
  // Cancel after a matched row and after an unmatched-drain row, preserving
  // first-error/reset semantics and independent admission for the next query.
  for(const on of ['r.x=t.x','0']){
   const s=db.prepare(prefix+`SELECT r.x,t.x FROM r RIGHT JOIN t ON ${on}`).statement;
   try{assert.equal(await s.step(),'row');await assert.rejects(s.step({signal:AbortSignal.abort()}),e=>e.kind==='cancelled');assert.throws(()=>s.reset(),e=>e.kind==='cancelled');assert.equal(await s.step(),'row');}finally{s.finalize();}
  }
  const long=db.prepare('WITH RECURSIVE r(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM r WHERE x<100000) SELECT r.x,t.x FROM r FULL JOIN t ON r.x=t.x').statement;
  const controller=new AbortController();let fired=false;const timer=setTimeout(()=>{fired=true;controller.abort();},0);
  try{await assert.rejects(long.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.equal(fired,true);assert.throws(()=>long.reset(),e=>e.kind==='cancelled');}finally{clearTimeout(timer);long.finalize();}
  for(const limits of [{maxPrivateEntries:1},{maxPrivateBytes:128}]){
   const limited=await open('https://fixture.invalid/recursive-right',{limits});
   try{const s=limited.prepare(prefix+'SELECT DISTINCT r.x,t.x FROM r FULL JOIN t ON r.x=t.x ORDER BY t.x').statement;
    try{let first;await assert.rejects(s.step(),e=>{first=e;return e.kind==='limit';});assert.throws(()=>s.reset(),e=>e===first);}finally{s.finalize();}
    const small=limited.prepare('SELECT 1').statement;try{assert.equal(await small.step(),'row');assert.equal(small.column(0),1n);}finally{small.finalize();}
   }finally{limited.closeDeferred();}
  }
  assert.throws(()=>db.prepare(prefix+'SELECT r.x FROM t RIGHT JOIN r ON r.x=t.x'),e=>e.kind==='unsupported');
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
