import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Each case owns a new server and makes one fixture fetch. Advertise response
// connection closure before streaming starts: server.close() can otherwise race
// the HTTP response becoming idle and wait ~3 seconds per case. Do not destroy
// active sockets or weaken database/statement cleanup or the file watchdog.
async function startCaseFixtureServer(){
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));
 bridge.server.prependListener('request',(_request,response)=>response.setHeader('Connection','close'));
 return bridge;
}

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 2) SELECT x AS y FROM c ORDER BY 1',names:['y'],rows:[[1n],[1n]]},
 {sql:'WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 0) SELECT x AS y FROM c ORDER BY 1',names:['y'],rows:[]},
 {sql:'WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 1 OFFSET 2) SELECT x AS y FROM c ORDER BY 1',names:['y'],rows:[[3n]]},
 {sql:'WITH c AS MATERIALIZED (SELECT x FROM t2 LIMIT 2) SELECT l.x AS y FROM c l CROSS JOIN c r ORDER BY 1',names:['y'],rows:[[1n],[1n],[1n],[1n]]},
];
for(const encoding of ['utf8','utf16le','utf16be'])for(const {sql,names,rows} of cases)test(`derived compound destination ${encoding}: ${sql}`,async()=>{
 const bridge=await startCaseFixtureServer();let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-${encoding}`));
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

test('forced/repeated CTE fallback owns destination rather than completed child ops',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileCteDerivedSourcesFallback('),end=source.indexOf('\nfunction ',start+1);
 assert.ok(start>=0&&end>start);
 const owner=source.slice(start,end);
 assert.match(owner,/columns=compoundArmColumns\(source.select,schema\)/);
 assert.match(owner,/destination:SelectDest=\{kind:'ephemeral',cursor:owner\}/);
 assert.match(owner,/code:'OpenDup'/);
 assert.match(owner,/code:'Once'/);
 assert.doesNotMatch(owner,/inner\.ops|compileTableSelect\(source.select|compileScalarSelect\(source.select/,'live fallback still independently compiles/copies child');
});

test('forced CTE child missing identifier stays lexical before empty LIMIT',async()=>{
 const bridge=await startCaseFixtureServer();let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  assert.throws(()=>db.prepare('WITH c AS MATERIALIZED (SELECT missing AS x FROM t2 LIMIT 0) SELECT x FROM c ORDER BY 1'),error=>error.kind==='sqlite'&&error.code===1&&/no such column/.test(error.message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`materialized cursor ownership ${encoding} rebinds LIMIT and NULL input`,async()=>{
 const bridge=await startCaseFixtureServer();let db;let statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-${encoding}`));
  statement=db.prepare('WITH c AS MATERIALIZED (SELECT ?1 AS x FROM t1 LIMIT ?2 OFFSET ?3) SELECT x FROM c ORDER BY 1').statement;
  assert.equal(statement.columnCount,1);
  assert.deepEqual(statement.columnMetadata(0),{name:'x',declaredType:null,database:null,table:null,origin:null});
  for(const [values,expected] of [ [[4n,2n,0n],[4n,4n]],[[null,2n,1n],[null,null]],[[9n,0n,0n],[]],[[7n,1n,3n],[7n]],[[8n,2n,4n],[]],[[5n,2n,0n],[5n,5n]] ]){
   values.forEach((value,index)=>statement.bind(index+1,value));const rows=[];
   while(await statement.step()==='row'){assert.equal(statement.columnType(0),values[0]===null?'null':'integer');rows.push(statement.column(0));}
   assert.deepEqual(rows,expected);statement.reset();
  }
 }finally{statement?.finalize();db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
