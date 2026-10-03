import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const cases=[
 ['WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT x FROM c',[1n,2n,3n,4n]],
 ['WITH RECURSIVE c(x) AS (VALUES(1) UNION SELECT x+1 FROM c WHERE x<3 UNION SELECT x FROM c) SELECT x FROM c',[1n,2n,3n]],
 ['WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x*2 FROM q WHERE x<4 UNION ALL SELECT x*2+1 FROM q WHERE x<4 ORDER BY 1 DESC) SELECT x FROM q',[1n,3n,7n,6n,2n,5n,4n]],
 ['WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT x FROM c LIMIT 2 OFFSET 1',[2n,3n]],
 ['WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<8 LIMIT 3 OFFSET 1) SELECT x FROM c LIMIT 2 OFFSET 1',[3n,4n]],
 ['WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT x FROM c LIMIT 0',[]],
 ['WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT x FROM c LIMIT -1 OFFSET 2',[3n,4n]],
];
test('public recursive queue, distinct and priority consumers retain pinned types, metadata and reset',async()=>{
 const server=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/empty`));
  for(const [sql,expected] of cases){const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnMetadata(0).name,'x');
    for(let iteration=0;iteration<2;iteration++){
     const rows=[];while(await stmt.step()==='row')rows.push([stmt.columnType(0),stmt.column(0)]);
     assert.deepEqual(rows,expected.map(x=>['integer',x]));assert.equal(await stmt.step(),'done');
     if(iteration===0)stmt.reset();
    }
   }finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.server.close(e=>e?reject(e):resolve()))}
});
test('recursive producer allocates queue/history cursors, register ranges and exit labels from shared builder',()=>{
 const text=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const producer=text.slice(text.indexOf('export function compileRecursiveCteSelect('),text.indexOf('export function compileRecursiveAggregateSelect('));
 assert.match(producer,/selectProgramBuilder\.cursor\(\)/);
 assert.match(producer,/selectProgramBuilder\.label\(\)/);
 assert.doesNotMatch(producer,/maximum\s*\+=/);
});

test('recursive outer LIMIT0 still resolves missing output before execution',async()=>{
 const server=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/empty`));
 assert.throws(()=>db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT missing FROM c LIMIT 0'),e=>e.code===1&&e.message==='no such column: missing');
 }finally{db?.closeDeferred();await new Promise(r=>server.server.close(r))}
});
