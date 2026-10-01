import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

test('derived DISTINCT scalar destination, pinned public pair',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  for(const [limit,want] of [['',[[7n]]],[' LIMIT 0',[]],[' LIMIT 2 OFFSET 1',[]],[' WHERE 0',[]]]){
   const stmt=db.prepare(`SELECT d.n FROM (SELECT DISTINCT 7 AS n${limit}) d`).statement;
   try{for(let pass=0;pass<2;pass++){const got=[];while(await stmt.step()==='row')got.push([stmt.column(0)]);assert.deepEqual(got,want);if(!pass)stmt.reset()}}finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
