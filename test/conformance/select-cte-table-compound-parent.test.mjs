import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Pinned select.c multiSelect: table-backed filtered arms emit to the same
// CteUse materialization destination; parent joins the two CteUse cursors.
test('table-backed compound CTE producer and constant peer share parent join destination',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const sql='WITH a AS MATERIALIZED (SELECT a AS x FROM t1 WHERE a=3 UNION ALL SELECT a FROM t1 WHERE a=5), b AS MATERIALIZED (SELECT 10 AS y UNION ALL SELECT 20) SELECT a.x,b.y FROM a JOIN b ON a.x=3 ORDER BY 1,2';
  const stmt=db.prepare(sql).statement;
  try{
   assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),['x','y']);
   for(let pass=0;pass<2;pass++){
    const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:2},(_,i)=>[stmt.columnType(i),stmt.column(i)]));
    assert.deepEqual(rows,[[['integer',3n],['integer',10n]],[['integer',3n],['integer',20n]]]);
    if(pass===0)stmt.reset();
   }
  }finally{stmt.finalize()}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
