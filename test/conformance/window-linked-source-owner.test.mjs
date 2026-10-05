import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:"SELECT t.a AS a,count(*) FILTER (WHERE t.a IN (1,3)) OVER (ORDER BY t.a ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) AS n FROM t1 t WHERE t.a BETWEEN 1 AND 5 COLLATE BINARY ORDER BY 1",names:["a", "n"],rows:[[1n,0n],[3n,1n],[5n,2n]]},
 {sql:"SELECT t.a AS a,sum(t.a) FILTER (WHERE NULL) OVER (ORDER BY t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1",names:["a", "n"],rows:[[1n,null],[3n,null]]},
 {sql:"SELECT t.a AS a,count(*) OVER (ORDER BY t.a) AS n FROM t1 t WHERE NULL ORDER BY 1 LIMIT 1",names:["a", "n"],rows:[]},
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

test('window source predicates consume rewrite-owned carrier',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.match(source,/const inputSelect:SelectNode=Object\.freeze\(\{[\s\S]*?resolved\.source/);
 assert.match(source,/compileInnerTableSelect\(inputSelect,[\s\S]*?consumeRow:/);
 assert.doesNotMatch(source,/const bindSourceExpression=\(reduction:Reduction\)/,'live window source walker duplicates linked resolution');
});

for(const [projection,message] of [['missing','no such column'],['a','ambiguous column name']])test(`linked resolver first error ${projection}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  assert.throws(()=>db.prepare(`SELECT t.a,count(*) FILTER (WHERE t.a>1) OVER (ORDER BY t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a WHERE ${projection}>0 LIMIT 0`),e=>e.kind==='sqlite'&&e.code===1&&e.message.includes(message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
