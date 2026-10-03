import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'SELECT t.a AS a,count(*) FILTER (WHERE t.a IN (1,3)) OVER (ORDER BY t.a) AS n FROM t1 t WHERE t.a>99 ORDER BY 1 LIMIT 1',names:['a','n'],rows:[]},
 {sql:"SELECT t.a AS a,count(*) FILTER (WHERE t.a BETWEEN 1 AND 3 COLLATE BINARY) OVER (ORDER BY t.a ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) AS n FROM t1 t ORDER BY 1",names:["a", "n"],rows:[[1n,0n],[3n,1n],[5n,2n],[7n,2n]]},
 {sql:"SELECT t.a AS a,sum(t.a) FILTER (WHERE NULL) OVER (ORDER BY t.a) AS n FROM t1 t ORDER BY 1",names:["a", "n"],rows:[[1n,null],[3n,null],[5n,null],[7n,null]]},
 // window.c windowFullScan peer/current identity branches; independently pin-checked before migration.
 {sql:'SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE GROUP) AS n FROM t1 ORDER BY a',names:['a','n'],rows:[[1n,null],[3n,null],[5n,3n],[7n,5n]]},
 {sql:'SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES) AS n FROM t1 ORDER BY a',names:['a','n'],rows:[[1n,null],[3n,3n],[5n,8n],[7n,12n]]},
 {sql:'SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS) AS n FROM t1 ORDER BY a',names:['a','n'],rows:[[1n,null],[3n,3n],[5n,8n],[7n,12n]]},
 // window.c step/return/inverse drain ordering; pin-confirmed before control migration.
 {sql:'SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS n FROM t1 ORDER BY a',names:['a','n'],rows:[[1n,null],[3n,3n],[5n,8n],[7n,12n]]},
 {sql:'SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND 1 FOLLOWING) AS n FROM t1 ORDER BY a',names:['a','n'],rows:[[1n,3n],[3n,8n],[5n,12n],[7n,7n]]},
 {sql:'SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND CURRENT ROW) AS n FROM t1 ORDER BY a',names:['a','n'],rows:[[1n,null],[3n,3n],[5n,5n],[7n,7n]]},
 // Joined selectInnerLoop direct/sorter iBreak controls, pin-confirmed before migration.
 {sql:'SELECT x.a AS a FROM t1 x JOIN t1 y ON x.a=y.a ORDER BY x.a DESC LIMIT 2 OFFSET 1',names:['a'],rows:[[5n],[3n]]},
 {sql:'SELECT x.a AS a FROM t1 x JOIN t1 y ON x.a=y.a WHERE x.a>99 ORDER BY x.a',names:['a'],rows:[]},
 {sql:'SELECT (SELECT x.a FROM t1 x JOIN t1 y ON x.a=y.a ORDER BY x.a DESC LIMIT 1 OFFSET 1) AS a',names:['a'],rows:[[5n]]},
 {sql:'SELECT x.a AS a FROM t1 x JOIN t1 y ON x.a=y.a LIMIT 2 OFFSET 1',names:['a'],rows:[[3n],[5n]]},
 // Physical source/drain controls independently confirmed against pin before migration.
 {sql:'SELECT DISTINCT a AS a FROM t1 ORDER BY a DESC LIMIT 2 OFFSET 1',names:['a'],rows:[[5n],[3n]]},
 {sql:'SELECT a AS a FROM t1 WHERE a>99 ORDER BY a LIMIT 1',names:['a'],rows:[]},
 {sql:'SELECT a AS a FROM t1 WHERE a>1 LIMIT 2 OFFSET 1',names:['a'],rows:[[5n],[7n]]},
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

test('window FILTER consumes linked rewrite carrier rather than local lookup',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(source,/ownedFilter.filterCarrier/);
 assert.doesNotMatch(source,/const bindColumns=\(expression:Expression,reduction:Reduction\)/,'live window FILTER duplicates expression resolution');
});

for(const [projection,message] of [['missing','no such column'],['a','ambiguous column name']])test(`linked resolver first error ${projection}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  assert.throws(()=>db.prepare(`SELECT ${projection},count(*) FILTER (WHERE t.a>1) OVER (ORDER BY t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a LIMIT 0`),e=>e.kind==='sqlite'&&e.code===1&&e.message.includes(message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
