import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

test('derived joined table producer rows and reset, pinned counterpart',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  for(const [sql,want] of [
   ['SELECT d.a,d.b FROM (SELECT x.a AS a,y.a AS b FROM t1 x JOIN t1 y ON y.a=x.a WHERE x.a<4 ORDER BY x.a LIMIT 2 OFFSET 1) d',[[3n,3n]]],
   ['SELECT d.a,d.b FROM (SELECT x.a AS a,y.a AS b FROM t1 x LEFT JOIN t1 y ON y.a=x.a+2 WHERE x.a<4 ORDER BY x.a LIMIT 2) d',[[1n,3n],[3n,5n]]],
   ['SELECT d.a,d.b FROM (SELECT x.a AS a,y.a AS b FROM t1 x JOIN t1 y ON y.a=x.a WHERE x.a<4 ORDER BY x.a LIMIT 0) d',[]]
  ]){
   const stmt=db.prepare(sql).statement;
   try{for(let pass=0;pass<2;pass++){const got=[];while(await stmt.step()==='row')got.push([stmt.column(0),stmt.column(1)]);assert.deepEqual(got,want);if(!pass)stmt.reset()}}finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
