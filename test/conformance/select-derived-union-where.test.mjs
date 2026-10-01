import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

test('derived UNION ALL arm predicates, pinned public pair',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  for(const [where,limit,want] of [[' WHERE 0','',[[9n]]],[' WHERE 1','',[[7n],[9n]]],[' WHERE 0',' LIMIT 0',[]],[' WHERE 0',' LIMIT 1 OFFSET 0',[[9n]]],[' WHERE 1',' LIMIT 1 OFFSET 1',[[9n]]],[' WHERE 7=7',' LIMIT 1 OFFSET 1',[[9n]]],[' WHERE NULL','',[[9n]]]]){
   const stmt=db.prepare(`SELECT d.n FROM (SELECT 7 AS n${where} UNION ALL SELECT 9 AS n${limit}) d`).statement;
   try{for(let pass=0;pass<2;pass++){const got=[];while(await stmt.step()==='row')got.push([stmt.columnType(0),stmt.column(0)]);assert.deepEqual(got,want.map(([n])=>['integer',n]));if(!pass)stmt.reset()}}finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
