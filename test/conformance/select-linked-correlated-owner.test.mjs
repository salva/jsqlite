import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'SELECT t.a AS a,(SELECT count(*) FROM t2 s WHERE s.x=t.a COLLATE BINARY) AS n FROM t1 t JOIN t1 u ON u.a=t.a ORDER BY 1',names:['a','n'],rows:[[1n,2n],[3n,1n],[5n,0n],[7n,0n]]},
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

test('joined correlated consumer uses reusable resolved-expression carrier',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('  const compileJoinSubquery='),end=source.indexOf('function compileInnerTableSelect(',start);
 assert.ok(start>=0&&end>start);
 assert.match(source.slice(start,end),/compileAggregateSelect\([\s\S]*linkedPlan:entry.plan/);
 assert.match(source,/resolvedExpressionCarrier\(aggregatePlan/);
 assert.match(source,/function bindResolvedExpression\(value:Expression,carrier:ResolvedExpressionCarrier/);
 assert.doesNotMatch(source.slice(start,end),/const bind=\(value:Expression,node:Reduction\)|entry.plan.columnUses.find/,'live consumer duplicates linked resolved expression traversal');
});

for(const [projection,message] of [['missing','no such column'],['a','ambiguous column name']])test(`linked resolver first error ${projection}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  assert.throws(()=>db.prepare(`SELECT ${projection},(SELECT count(*) FROM t2 s WHERE s.x=t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a LIMIT 0`),e=>e.kind==='sqlite'&&e.code===1&&e.message.includes(message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
