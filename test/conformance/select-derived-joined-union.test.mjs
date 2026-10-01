import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

test('joined UNION ALL derived destination, pinned public pair',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const inner='SELECT x.a AS a,y.a AS b FROM t1 x JOIN t1 y ON y.a=x.a WHERE x.a<4 UNION ALL SELECT x.a,y.a FROM t1 x LEFT JOIN t1 y ON y.a=x.a+2 WHERE x.a<4';
  for(const [suffix,want] of [['',[[1n,1n],[3n,3n],[1n,3n],[3n,5n]]],[' ORDER BY 1',[[1n,1n],[1n,3n],[3n,3n],[3n,5n]]]]){
   const stmt=db.prepare(`SELECT d.a,d.b FROM (${inner}) d${suffix}`).statement;
   try{for(let pass=0;pass<2;pass++){const got=[];while(await stmt.step()==='row')got.push([stmt.columnType(0),stmt.column(0),stmt.columnType(1),stmt.column(1)]);assert.deepEqual(got,want.map(([a,b])=>['integer',a,'integer',b]));if(!pass)stmt.reset()}}finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
