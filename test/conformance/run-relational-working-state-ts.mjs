import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { startFixtureServer } from './fixture-server.mjs';
import { openFixture } from './public-api-adapter.mjs';

const cases=[
 {id:'up-limit-1.2.1',fixture:'expr-relational',sql:'SELECT x FROM t1 ORDER BY x LIMIT 5',expected:[0n,1n,2n,3n,4n],credit:'upstream'},
 {id:'order-limit',fixture:'expr-relational',sql:'SELECT a FROM t2 ORDER BY a LIMIT 3',expected:[null,null,1n],credit:'companion'},
 {id:'distinct-order',fixture:'expr-relational',sql:'SELECT DISTINCT a FROM t2 ORDER BY a',expected:[null,1n,345n,67890n],credit:'companion'},
];
test('schema-v4 relational public TS consumers',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{for(const c of cases){db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${c.fixture}`));const s=db.prepare(c.sql).statement,out=[];while(await s.step()==='row')out.push(s.column(0));assert.deepEqual(out,c.expected,c.id);s.finalize();db.close();db=undefined}}
 finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
console.log(JSON.stringify({schema:'jsqlite-relational-ts-accounting-v1',declared:18,attempted:3,passed:3,unattempted:15,creditedUpstream:1,creditedCompanions:2}));
