import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Paired with select-derived-scalar-owner-native.py, select.c tag-select-0482.
test('zero-source derived coroutine typed rows, zero/offset, reset and errors',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const cases=[
   ["SELECT d.i,d.r,d.t,d.b,d.n FROM (SELECT 7 AS i,1.5 AS r,'é' AS t,x'00ff' AS b,NULL AS n) d",[['integer',7n],['real',1.5],['text','é'],['blob','00ff'],['null',null]]],
   ['SELECT d.i FROM (SELECT 7 AS i WHERE 0) d',null],
   ['SELECT d.i FROM (SELECT 7 AS i LIMIT 0 OFFSET 1) d',null],
   ['SELECT d.i FROM (SELECT 7 AS i LIMIT 1 OFFSET 1) d',null]
  ];
  for(const [sql,expected] of cases){const stmt=db.prepare(sql).statement;
   try{for(let pass=0;pass<2;pass++){
    if(expected){assert.equal(await stmt.step(),'row');assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>[stmt.columnType(i),stmt.columnType(i)==='blob'?Buffer.from(stmt.column(i)).toString('hex'):stmt.column(i)]),expected)}
    assert.equal(await stmt.step(),'done');if(!pass)stmt.reset();
   }}finally{stmt.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT 7 AS i) d'),/no such column/);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
