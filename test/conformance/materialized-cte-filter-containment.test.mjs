import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
// select.c materialization -> outer WHERE; native counterpart proves these are
// valid SQL. Temporary rejection is containment, not native row compatibility.
const producers=[
 'SELECT count(*) AS n FROM t1',
 'SELECT row_number() OVER () AS n FROM t1',
 'SELECT a AS n FROM t1 UNION SELECT a AS n FROM t1',
];
const filters=['n < 0','n+1 < 0','NULL','1','json_extract(\'bad\',\'$\')','n = ?1'];
for(const encoding of ['utf8','utf16le','utf16be'])test(`materialized fallback WHERE containment ${encoding}`,async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/materialized-filter');}finally{globalThis.fetch=old;}
 const temporary=e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary'&&e.message==='outer WHERE on this materialized CTE consumer is not implemented';
 async function control(sql,expected){
  const s=db.prepare(sql).statement;
  try{
   assert.deepEqual(s.columnMetadata(0),{name:'n',declaredType:null,database:null,table:null,origin:null});
   for(let cycle=0;cycle<2;cycle++){
    const rows=[];while(await s.step()==='row'){rows.push(s.column(0));assert.equal(s.columnType(0),'integer');}
    assert.deepEqual(rows,expected);s.reset();
   }
  }finally{s.finalize();}
 }
 try{
  for(const producer of producers.slice(1)){
   const prefix=`WITH c AS MATERIALIZED (${producer}) SELECT n FROM c`;
   for(const filter of filters){
    // Repeat failed prepares on the same connection; nothing is published.
    for(let i=0;i<2;i++)assert.throws(()=>db.prepare(`${prefix} WHERE ${filter}`),temporary);
    await control('WITH c AS MATERIALIZED (SELECT count(*) AS n FROM t1) SELECT n FROM c',[4n]);
   }
  }
  // ON is not a post-join WHERE; repeated readers keep their independent state.
  const join='WITH c AS MATERIALIZED (SELECT count(*) AS n FROM t1) SELECT x.n FROM c x JOIN c y ON x.n=y.n';
  await control(join,[4n]);
  assert.throws(()=>db.prepare(`${join} WHERE x.n < 0`),temporary);
  assert.throws(()=>db.prepare('WITH c AS MATERIALIZED (SELECT count(*) AS n FROM t1) SELECT n FROM c WHERE missing < 0'),e=>e.kind==='sqlite'&&e.message==='no such column: missing');
  const rebound=db.prepare('SELECT ?1 AS n').statement;
  try{for(const v of [4n,9n]){rebound.bind(1,v);assert.equal(await rebound.step(),'row');assert.equal(rebound.column(0),v);assert.equal(await rebound.step(),'done');rebound.reset();}}finally{rebound.finalize();}
 }finally{db.close();}
});
