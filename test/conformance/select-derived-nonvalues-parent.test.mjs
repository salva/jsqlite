import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Paired with select-derived-nonvalues-parent-native.py, pinned 3.53.4.
test('ordered non-VALUES derived coroutine rows, names, limits, reset and error',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const stmt=db.prepare('SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT 1 ORDER BY 1 LIMIT 2) d ORDER BY 1 LIMIT 1 OFFSET 1').statement;
  try{
   assert.equal(stmt.columnCount,1);assert.equal(stmt.columnMetadata(0).name,'x');
   for(let pass=0;pass<2;pass++){
    assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),2n);
    assert.equal(await stmt.step(),'done');stmt.reset();
   }
  }finally{stmt.finalize()}
  const zero=db.prepare('SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT 1 ORDER BY 1 LIMIT 0) d ORDER BY 1').statement;
  try{assert.equal(await zero.step(),'done')}finally{zero.finalize()}
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT 2 AS x UNION ALL SELECT 1 ORDER BY 1 LIMIT 1) d'),/no such column/);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
