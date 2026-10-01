import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Pinned select.c multiSelect UNION ALL writes each CteUse producer into
// sqlite3Select's materialized ephemeral destination before the parent join.
// Paired with select-cte-compound-composition-native.py.
test('materialized compound CTE pair composes into parent join destination',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const sql='WITH a AS MATERIALIZED (SELECT 1 AS x UNION ALL SELECT 2), b AS MATERIALIZED (SELECT 10 AS y UNION ALL SELECT 20) SELECT a.x,b.y FROM a JOIN b ON a.x=2 ORDER BY 1,2';
  const statement=db.prepare(sql).statement;
  try{
   assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),['x','y']);
   for(let pass=0;pass<2;pass++){
    const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:2},(_,i)=>[statement.columnType(i),statement.column(i)]));
    assert.deepEqual(rows,[[['integer',2n],['integer',10n]],[['integer',2n],['integer',20n]]]);
    if(pass===0)statement.reset();
   }
  }finally{statement.finalize()}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
