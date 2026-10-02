import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'WITH d AS (SELECT x FROM t2 LIMIT 2) SELECT d.x,t.a FROM d CROSS JOIN t1 t ORDER BY t.a',names:['x','a'],rows:[[1n,1n],[1n,1n],[1n,3n],[1n,3n],[1n,5n],[1n,5n],[1n,7n],[1n,7n]]},
 {sql:'WITH d AS (SELECT x FROM t2 LIMIT 0) SELECT d.x,t.a FROM d CROSS JOIN t1 t ORDER BY t.a',names:['x','a'],rows:[]},
 {sql:'WITH d AS (SELECT x FROM t2 LIMIT 1 OFFSET 2) SELECT d.x,t.a FROM d CROSS JOIN t1 t ORDER BY t.a',names:['x','a'],rows:[[3n,1n],[3n,3n],[3n,5n],[3n,7n]]},
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

test('first-source retained child owns materialization destination without completed ops copy',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf(' if(derived&&derived.index===0&&select.from.items.length===2');
 const end=source.indexOf(' if(!derived||derived.index!==1',start);
 assert.ok(start>=0&&end>start);
 const owner=source.slice(start,end);
 assert.match(owner,/columns:compoundArmColumns\(derived.select,schema\)/);
 assert.match(owner,/destination:SelectDest=\{kind:'sorter',cursor:spool,keyCount:0\}/);
 assert.match(owner,/payload=builder.range\(inner.columns.length\)/);
 assert.doesNotMatch(owner,/inner\.ops|compileTableSelect\(derived.select|compileAggregateSelect\(derived.select/,'first-source still copies independently completed producer');
});

test('first-source CTE missing producer identifier stays lexical even LIMIT0',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  assert.throws(()=>db.prepare('WITH d AS (SELECT missing AS x FROM t2 LIMIT 0) SELECT d.x,t.a FROM d CROSS JOIN t1 t ORDER BY t.a'),error=>error.kind==='sqlite'&&error.code===1&&/no such column/.test(error.message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
