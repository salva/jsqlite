import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'SELECT sum(d.x) AS s,count(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8 WHERE 0) d',names:['s','n'],rows:[[null,0n]]},
 {sql:"SELECT sum(d.x ORDER BY d.x) AS s,count(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8) d",names:["s", "n"],rows:[[8n,1n]]},
 {sql:"SELECT sum(d.x) AS s,count(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT NULL) d",names:["s", "n"],rows:[[null,0n]]},
 {sql:"SELECT sum(d.x) AS s,avg(d.x) AS a FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 1 UNION ALL SELECT 2.0) d",names:["s", "a"],rows:[[3.0,1.5]]},
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
     assert.deepEqual(actual,rows.map(row=>row.map(value=>[value===null?'null':typeof value==='number'?'real':'integer',value])));
     if(iteration===0)statement.reset();
    }
   }finally{statement.finalize()}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

test('compound aggregate consumes semantic phase carrier instead of name-based forRow',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileCompoundDerivedAggregate(');const branch=source.slice(start,source.indexOf('function ',start+10));
 assert.match(branch,/entry.phase.arguments\[index\]/);
 assert.match(branch,/entry.phase.accumulator.register/);
 assert.match(branch,/phase.output.register/);
 assert.match(branch,/phase:'source-row'/);
 assert.doesNotMatch(branch,/const forRow=\(expression:Expression,row:number\)/,'aggregate source-row walker re-resolves names rather than consuming linked phase ownership');
});
for(const name of ['missing','d.missing'])test(`aggregate lexical first error ${name}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
 assert.throws(()=>db.prepare(`SELECT sum(${name}) FROM (SELECT x FROM t2 UNION ALL SELECT NULL) d`),error=>error.kind==='sqlite'&&error.code===1&&error.message.includes(`no such column: ${name}`));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
