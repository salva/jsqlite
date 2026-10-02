import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE t.a>1 GROUP BY t.a HAVING s>2 ORDER BY k",names:["k", "s"],rows:[[3n,3n],[5n,5n],[7n,7n]]},
{sql:"SELECT CAST(t.a AS REAL) AS k,sum(CAST(t.a AS REAL)) AS s FROM t1 t WHERE CASE WHEN t.a>0 THEN 1 ELSE abs(-9223372036854775808) END GROUP BY t.a ORDER BY k",names:["k", "s"],rows:[[1.0,1.0],[3.0,3.0],[5.0,5.0],[7.0,7.0]]},
{sql:"SELECT t.a AS a,count(DISTINCT t.a) AS n,sum(t.a) FILTER (WHERE t.a<5) AS s FROM t1 t WHERE t.a>0 GROUP BY t.a ORDER BY a",names:["a", "n", "s"],rows:[[1n,1n,1n],[3n,1n,3n],[5n,1n,null],[7n,1n,null]]},
{sql:"SELECT min(t.a-t.a) AS m,t.a AS a FROM t1 t WHERE t.a>1 GROUP BY t.a-t.a ORDER BY m",names:["m", "a"],rows:[[0n,3n]]},
{sql:"SELECT sum(t.a) AS s FROM t1 t WHERE NULL GROUP BY t.a",names:["s"],rows:[]}
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

test('ordinary aggregate WHERE consumes linked source carrier',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/where=whereTree\?resolve\(whereTree\)/,'aggregate source predicate still uses independent spelling resolver');
});

for(const expression of ['missing','sum(sum(t.a))'])test(`ordinary first error ${expression} LIMIT0`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
 assert.throws(()=>db.prepare(`SELECT sum(${expression}) FROM t1 t LIMIT 0`),error=>error.kind==='sqlite'&&error.code===1&&error.message.includes(expression==='missing'?'no such column: missing':'misuse of aggregate function sum()'));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
