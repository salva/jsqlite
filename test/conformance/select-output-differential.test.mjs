import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);
const cases=[
  {sql:'SELECT 1 AS a, 2.0 AS b, NULL AS n',names:['a','b','n'],rows:[[['integer',1n],['real',2],['null',null]]]},
  {sql:'SELECT 1 AS v LIMIT 0',names:['v'],rows:[]},
  {sql:'SELECT 7 AS v UNION ALL SELECT 8 LIMIT 1 OFFSET 1',names:['v'],rows:[[['integer',8n]]]},
  {sql:'SELECT 7 AS v UNION ALL SELECT 8 AS v',names:['v'],rows:[[['integer',7n]],[['integer',8n]]]},
  {sql:'SELECT (SELECT 7) AS n, EXISTS(SELECT 8) AS e, 7 IN (SELECT 7) AS i',names:['n','e','i'],rows:[[['integer',7n],['integer',1n],['integer',1n]]]},
  {sql:'SELECT (SELECT 7 LIMIT 0) AS n, EXISTS(SELECT 8 LIMIT 0) AS e, 7 IN (SELECT 7 LIMIT 0) AS i',names:['n','e','i'],rows:[[['null',null],['integer',0n],['integer',0n]]]},
  {sql:'SELECT (SELECT 4 UNION SELECT 5 UNION ALL SELECT 9 LIMIT 1 OFFSET 1) AS n',names:['n'],rows:[[['integer',5n]]]},
];
test('public scalar/output destination first, empty, compound and reset retain pinned types and metadata',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const entry of cases){const s=db.prepare(entry.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),entry.names);
    for(let iteration=0;iteration<2;iteration++){
     const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));
     assert.deepEqual(rows,entry.rows);assert.equal(await s.step(),'done');
     if(iteration===0)s.reset();
    }
   }finally{s.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
