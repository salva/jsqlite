import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
{sql:"SELECT sum(t.a) AS a FROM t1 t HAVING a>10 ORDER BY a",names:["a"],rows:[]},
{sql:"SELECT sum(t.a) AS s FROM t1 t HAVING s>10 ORDER BY s",names:["s"],rows:[[16n]]},
{sql:"SELECT t.a AS a,count(*) AS n FROM t1 t GROUP BY t.a HAVING n>0 ORDER BY n+t.a DESC",names:["a", "n"],rows:[[7n,1n],[5n,1n],[3n,1n],[1n,1n]]},
{sql:"SELECT min(t.a-t.a) AS m,t.a AS a FROM t1 t HAVING m=0 ORDER BY m+a",names:["m", "a"],rows:[[0n,1n]]},
{sql:"SELECT sum(CAST(t.a AS REAL) ORDER BY t.a DESC) AS s FROM t1 t HAVING s>10 ORDER BY s+1",names:["s"],rows:[[16.0]]},
{sql:"SELECT sum(t.a) FILTER (WHERE t.a<5) AS s,count(DISTINCT t.a) AS n FROM t1 t HAVING s=4 AND n=4 ORDER BY s+n",names:["s", "n"],rows:[[4n,4n]]},
{sql:"SELECT sum(t.a) AS s,count(*) AS n FROM t1 t WHERE NULL HAVING s IS NULL AND n=0 ORDER BY n",names:["s", "n"],rows:[[null,0n]]},
{sql:"SELECT sum(t.a) AS s FROM t1 t HAVING CASE WHEN s=16 THEN 1 ELSE abs(-9223372036854775808) END ORDER BY s",names:["s"],rows:[[16n]]}
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

test('aggregate alias edge retires independent spelling lowering',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/const lowerAlias=\(e:Expression/,'HAVING/ORDER aggregate aliases still use independent phase-less walker');
});

for(const expression of ['missing','sum(sum(t.a))'])test(`ordinary first error ${expression} LIMIT0`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
 assert.throws(()=>db.prepare(`SELECT sum(${expression}) FROM t1 t LIMIT 0`),error=>error.kind==='sqlite'&&error.code===1&&error.message.includes(expression==='missing'?'no such column: missing':'misuse of aggregate function sum()'));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
