import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

test('derived set prefix and ALL tail bind/reset (paired pinned oracle)',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const [sql,passes] of [
   ['SELECT d.i FROM (SELECT ?1 AS i UNION SELECT 2 UNION ALL SELECT ?2) d',[[1n,3n,[1n,2n,3n]],[2n,4n,[2n,4n]]]],
   ['SELECT d.i FROM (SELECT ?1 AS i EXCEPT SELECT 2 UNION ALL SELECT ?2 LIMIT 2 OFFSET 1) d',[[1n,3n,[3n]],[2n,4n,[]]]]
  ]){
   const stmt=db.prepare(sql).statement;
   try{for(const [a,b,want] of passes){stmt.bind(1,a);stmt.bind(2,b);const rows=[];while(await stmt.step()==='row')rows.push([stmt.columnType(0),stmt.column(0)]);assert.deepEqual(rows,want.map(v=>['integer',v]));stmt.reset()}}finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
