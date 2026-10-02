import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'SELECT sum(d.x ORDER BY d.x) AS s,count(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8) d',names:['s','n'],rows:[[8n,1n]]},
 {sql:'SELECT count(d.x) AS n FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d',names:['n'],rows:[[3n]]},
 {sql:'SELECT sum(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8) d',names:['n'],rows:[[8n]]},
 {sql:'SELECT count(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8 WHERE 0) d',names:['n'],rows:[[0n]]},
];
for(const {sql,names,rows} of cases)test(`derived compound destination: ${sql}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const statement=db.prepare(sql).statement;
  try{
    assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),names);
    for(let iteration=0;iteration<2;iteration++){
     const actual=[];while(await statement.step()==='row')actual.push(Array.from({length:statement.columnCount},(_,i)=>[statement.columnType(i),statement.column(i)]));
     assert.deepEqual(actual,rows.map(row=>row.map(value=>['integer',value])));
     if(iteration===0)statement.reset();
    }
   }finally{statement.finalize()}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

test('compound derived aggregate consumer retains enclosing allocation ownership',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileCompoundDerivedAggregate('),end=source.indexOf('function compileZeroSourceDerivedCount(',start);
 assert.ok(start>=0&&end>start);
 const owner=source.slice(start,end);
 assert.match(owner,/outputStart=builder.range\(outputs.length\)/);
 assert.match(owner,/emitSelectDestination\(ops,destination,outputStart,outputs.length\)/);
 assert.match(owner,/sorter:builder.cursor\(\)/);
 assert.doesNotMatch(owner,/let registers=builder.registers,nextCursor=builder.cursors|p1:1,p2:outputs.length/,'aggregate consumer detaches high-water and hardcodes output instead of owning destination');
});
