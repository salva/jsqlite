import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'SELECT t.a AS a,(SELECT CASE WHEN s.x BETWEEN 1 AND 3 THEN s.x+10 ELSE NULL END FROM t2 s WHERE s.x=t.a COLLATE BINARY) AS v FROM t1 t ORDER BY 1',names:['a','v'],rows:[[1n,11n],[3n,13n],[5n,null],[7n,null]]},
 {sql:"SELECT t.a AS a,(SELECT s.x FROM t2 s WHERE s.x=t.a COLLATE BINARY) AS v FROM t1 t ORDER BY 1",names:["a", "v"],rows:[[1n,1n],[3n,3n],[5n,null],[7n,null]]},
 {sql:"SELECT t.a AS a,(SELECT NULL FROM t2 s WHERE s.x=t.a) AS v FROM t1 t ORDER BY 1",names:["a", "v"],rows:[[1n,null],[3n,null],[5n,null],[7n,null]]},
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
     assert.deepEqual(actual,rows.map(row=>row.map(value=>[value===null?'null':'integer',value])));
     if(iteration===0)statement.reset();
    }
   }finally{statement.finalize()}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

test('scalar subquery consumer retires duplicate binding into carrier',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('// resolve.c:lookupName has already selected'),end=source.indexOf('    const onceRegister=',start);
 assert.ok(start>=0&&end>start);
 const owner=source.slice(start,end);
 assert.match(owner,/resolvedExpressionCarrier\(nested/);
 assert.doesNotMatch(owner,/const bind=|nested.columnUses.find/,'live scalar binder still walks/searches resolved reductions');
});

for(const [projection,message] of [['missing','no such column'],['a','ambiguous column name']])test(`linked resolver first error ${projection}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  assert.throws(()=>db.prepare(`SELECT ${projection},(SELECT s.x FROM t2 s WHERE s.x=t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a LIMIT 0`),e=>e.kind==='sqlite'&&e.code===1&&e.message.includes(message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
