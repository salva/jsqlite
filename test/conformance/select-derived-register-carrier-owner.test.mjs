import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:"SELECT t.a AS a,(SELECT count(d.x) FROM (SELECT 1 AS x UNION ALL SELECT NULL) d WHERE d.x=t.a COLLATE BINARY) AS n FROM t1 t ORDER BY 1 LIMIT 0",names:['a','n'],rows:[]},

 {sql:"SELECT t.a AS a,(SELECT count(d.x) FROM (SELECT 1 AS x UNION ALL SELECT 1 UNION ALL SELECT NULL) d WHERE d.x=t.a COLLATE BINARY) AS n FROM t1 t ORDER BY 1",names:["a", "n"],rows:[[1n,2n],[3n,0n],[5n,0n],[7n,0n]]},
 {sql:"SELECT t.a AS a,(SELECT sum(d.x) FROM (SELECT NULL AS x UNION ALL SELECT NULL) d WHERE d.x=t.a COLLATE BINARY) AS n FROM t1 t ORDER BY 1",names:["a", "n"],rows:[[1n,null],[3n,null],[5n,null],[7n,null]]},
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

test('derived scalar aggregate owns resolved register phase rather than local walker',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(source,/phase:'producer-row'/);
 assert.match(source,/const argNodes=resolvedExpressionCarrier\(nested/);
 assert.doesNotMatch(source,/const bindDerived=\(value:Expression,node:Reduction\)/,'live register payload binder duplicates linked resolution');
});

for(const [projection,message] of [['missing','no such column'],['a','ambiguous column name']])test(`linked resolver first error ${projection}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  assert.throws(()=>db.prepare(`SELECT ${projection},(SELECT count(d.x) FROM (SELECT 1 AS x UNION ALL SELECT NULL) d WHERE d.x=t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a LIMIT 0`),e=>e.kind==='sqlite'&&e.code===1&&e.message.includes(message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
