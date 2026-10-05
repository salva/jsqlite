import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
{sql:"SELECT d.a,sum(CAST(d.a AS REAL)) FILTER (WHERE d.a<5) FROM (SELECT a FROM t1 UNION ALL SELECT a FROM t1) d GROUP BY d.a ORDER BY d.a",names:["a", "sum(CAST(d.a AS REAL)) FILTER (WHERE d.a<5)"],rows:[[1n,2.0],[3n,6.0],[5n,null],[7n,null]]},
{sql:"SELECT d.a AS k,min(d.a),sum(d.a ORDER BY d.a DESC) AS s FROM (SELECT a FROM t1 UNION ALL SELECT a FROM t1 WHERE NULL) d WHERE d.a>1 GROUP BY 1 HAVING s>3 ORDER BY s DESC",names:["k", "min(d.a)", "s"],rows:[[7n,7n,7n],[5n,5n,5n]]},
{sql:'SELECT a,sum(a) FROM t1 GROUP BY 1 ORDER BY a',names:['a','sum(a)'],rows:[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]},
{sql:'SELECT CAST(a AS REAL) AS k,sum(a) AS s FROM t1 GROUP BY 1 HAVING s>1 ORDER BY k DESC',names:['k','s'],rows:[[7.0,7n],[5.0,5n],[3.0,3n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE t.a>1 GROUP BY t.a HAVING s>2 ORDER BY k",names:["k", "s"],rows:[[3n,3n],[5n,5n],[7n,7n]]},
{sql:"SELECT CAST(t.a AS REAL) AS k,sum(CAST(t.a AS REAL)) AS s FROM t1 t WHERE CASE WHEN t.a>0 THEN 1 ELSE abs(-9223372036854775808) END GROUP BY t.a ORDER BY k",names:["k", "s"],rows:[[1.0,1.0],[3.0,3.0],[5.0,5.0],[7.0,7.0]]},
{sql:"SELECT t.a AS a,count(DISTINCT t.a) AS n,sum(t.a) FILTER (WHERE t.a<5) AS s FROM t1 t WHERE t.a>0 GROUP BY t.a ORDER BY a",names:["a", "n", "s"],rows:[[1n,1n,1n],[3n,1n,3n],[5n,1n,null],[7n,1n,null]]},
{sql:"SELECT min(t.a-t.a) AS m,t.a AS a FROM t1 t WHERE t.a>1 GROUP BY t.a-t.a ORDER BY m",names:["m", "a"],rows:[[0n,3n]]},
{sql:"SELECT sum(t.a) AS s FROM t1 t WHERE NULL GROUP BY t.a",names:["s"],rows:[]}
,
{sql:"SELECT t.a AS k,sum(u.a) AS s,count(DISTINCT u.a) AS n FROM t1 t LEFT JOIN t1 u ON t.a=u.a AND u.a<5 GROUP BY t.a ORDER BY k",names:["k","s","n"],rows:[[1n,1n,1n],[3n,3n,1n],[5n,null,0n],[7n,null,0n]]},
{sql:"SELECT sum(CAST(u.a AS REAL)) FILTER (WHERE u.a<5) AS s,count(DISTINCT u.a) AS n,min(t.a-t.a) AS m,t.a AS a FROM t1 t JOIN t1 u ON t.a=u.a AND CASE WHEN t.a>0 THEN 1 ELSE abs(-9223372036854775808) END",names:["s","n","m","a"],rows:[[4.0,4n,0n,1n]]}
,
{sql:"SELECT min(t.a-t.a) AS m,(t.a BETWEEN 1 AND 3) AS b,(t.a IN (1,3)) AS i,sum(CASE WHEN t.a>0 THEN CAST(t.a AS REAL) ELSE abs(-9223372036854775808) END) AS s FROM t1 t GROUP BY t.a-t.a",names:["m","b","i","s"],rows:[[0n,1n,1n,16.0]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t GROUP BY t.a HAVING EXISTS(SELECT 1 FROM t1 u WHERE u.a=t.a AND u.a<5) ORDER BY k",names:["k","s"],rows:[[1n,1n],[3n,3n]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE EXISTS(SELECT 1 FROM t1 u WHERE u.a=t.a AND u.a<5) GROUP BY t.a ORDER BY k",names:["k","s"],rows:[[1n,1n],[3n,3n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t GROUP BY t.a HAVING EXISTS(SELECT 1 FROM t1 t WHERE t.a=1) ORDER BY k",names:["k","s"],rows:[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t GROUP BY t.a HAVING EXISTS(SELECT 1 FROM t1 u WHERE u.a=t.a) ORDER BY k",names:["k","s"],rows:[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s,(SELECT u.a FROM t1 u ORDER BY abs(u.a-t.a),u.a LIMIT 1) AS near FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","near"],rows:[[1n,1n,1n],[3n,3n,3n],[5n,5n,5n],[7n,7n,7n]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE t.a=(SELECT u.a FROM t1 u ORDER BY abs(u.a-t.a),u.a LIMIT 1) GROUP BY t.a ORDER BY k",names:["k","s"],rows:[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,(SELECT u.a FROM t1 u WHERE u.a<t.a ORDER BY u.a DESC LIMIT 1) AS prev FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","prev"],rows:[[1n,1n,null],[3n,3n,1n],[5n,5n,3n],[7n,7n,5n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,(SELECT t.a FROM t1 t ORDER BY t.a DESC LIMIT 1) AS last FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","last"],rows:[[1n,1n,7n],[3n,3n,7n],[5n,5n,7n],[7n,7n,7n]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(u.a+t.a) FROM t1 u) AS total FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","total"],rows:[[1n,1n,20n],[3n,3n,28n],[5n,5n,36n],[7n,7n,44n]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE (SELECT sum(u.a+t.a) FROM t1 u)>25 GROUP BY t.a ORDER BY k",names:["k","s"],rows:[[3n,3n],[5n,5n],[7n,7n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(CAST(u.a+t.a AS REAL)) FROM t1 u) AS total FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","total"],rows:[[1n,1n,20],[3n,3n,28],[5n,5n,36],[7n,7n,44]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(t.a) FROM t1 t) AS total FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","total"],rows:[[1n,1n,16n],[3n,3n,16n],[5n,5n,16n],[7n,7n,16n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,(SELECT sum(CASE WHEN u.a<t.a THEN u.a END) FROM t1 u) AS prev FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","prev"],rows:[[1n,1n,null],[3n,3n,1n],[5n,5n,4n],[7n,7n,9n]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s,1 IN (SELECT t.a FROM t1 u) AS hit FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","hit"],rows:[[1n,1n,1n],[3n,3n,0n],[5n,5n,0n],[7n,7n,0n]]}
,
{sql:"SELECT t.a AS k,sum(t.a) AS s FROM t1 t WHERE 1 IN (SELECT t.a FROM t1 u) GROUP BY t.a ORDER BY k",names:["k","s"],rows:[[1n,1n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,1 IN (SELECT t.a FROM t1 t) AS hit FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","hit"],rows:[[1n,1n,1n],[3n,3n,1n],[5n,5n,1n],[7n,7n,1n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,NULL IN (SELECT t.a FROM t1 u LIMIT 0) AS hit FROM t1 t GROUP BY t.a ORDER BY k",names:["k","s","hit"],rows:[[1n,1n,0n],[3n,3n,0n],[5n,5n,0n],[7n,7n,0n]]},
{sql:"SELECT t.a AS k,sum(t.a) AS s,1 NOT IN (SELECT u.a FROM t1 v) AS hit FROM t1 t LEFT JOIN t1 u ON u.a=t.a AND u.a<5 GROUP BY t.a ORDER BY k",names:["k","s","hit"],rows:[[1n,1n,0n],[3n,3n,1n],[5n,5n,null],[7n,7n,null]]}
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
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});

test('ordinary aggregate WHERE consumes linked source carrier',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/where=whereTree\?resolve\(whereTree\)/,'aggregate source predicate still uses independent spelling resolver');
});

for(const expression of ['missing','sum(sum(t.a))'])test(`ordinary first error ${expression} LIMIT0`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
 assert.throws(()=>db.prepare(`SELECT sum(${expression}) FROM t1 t LIMIT 0`),error=>error.kind==='sqlite'&&error.code===1&&error.message.includes(expression==='missing'?'no such column: missing':'misuse of aggregate function sum()'));
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});

test('aggregate ON source-row consumer is linked to lexical owner',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const owner=source.slice(source.indexOf('export function compileAggregateSelect('),source.indexOf('export class Vdbe'));
 assert.doesNotMatch(owner,/resolve\(expressionFromReduction\((?:on\.reduction!|source\.item\.on\.reduction)\)\)/,'both grouped and ungrouped ON must use the resolved source-row carrier, not independent spelling lookup');
});

test('grouped compound stream retains parent metadata and shared private rejection',async()=>{
 const {open}=await import('../../src/index.ts');const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 const sql='SELECT d.a,sum(d.a) FROM (SELECT a FROM t1 UNION ALL SELECT a FROM t1) d GROUP BY d.a';
 try{
  db=await open(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`),{limits:{maxPrivateEntries:0}});
  const s=db.prepare(sql).statement;
  assert.deepEqual(s.columnMetadata(0),{name:'a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});
  await assert.rejects(s.step(),e=>e.kind==='limit');
  try{s.finalize()}catch{}
  const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
