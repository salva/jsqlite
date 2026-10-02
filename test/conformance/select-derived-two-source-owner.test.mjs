import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
const cases=[
 {sql:'SELECT t.a,d.x FROM t1 t CROSS JOIN (SELECT x FROM t2 LIMIT 2) d ORDER BY 1,2',names:['a','x'],rows:[[1n,1n],[1n,1n],[3n,1n],[3n,1n],[5n,1n],[5n,1n],[7n,1n],[7n,1n]]},
 {sql:'SELECT t.a,d.x FROM t1 t JOIN (SELECT x FROM t2 LIMIT 2) d ORDER BY 1,2',names:['a','x'],rows:[[1n,1n],[1n,1n],[3n,1n],[3n,1n],[5n,1n],[5n,1n],[7n,1n],[7n,1n]]},
 {sql:'SELECT t.a,d.x FROM t1 t CROSS JOIN (SELECT x FROM t2 LIMIT 0) d ORDER BY 1,2',names:['a','x'],rows:[]},
 {sql:'SELECT t.a,d.x FROM t1 t CROSS JOIN (SELECT x FROM t2 LIMIT 1 OFFSET 2) d ORDER BY 1,2',names:['a','x'],rows:[[1n,3n],[3n,3n],[5n,3n],[7n,3n]]},
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

test('two-source retained child uses owning destination rather than copied completed ops',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf(' if(!derived||derived.index!==1');
 const end=source.indexOf('\nfunction substituteViewExpression(',start);
 assert.ok(start>=0&&end>start);
 const owner=source.slice(start,end);
 assert.match(owner,/emitProducer\(\{kind:'coroutine',register:returnRegister,first:producerOutput\}\)/);
 assert.match(owner,/emitProducer\(\{kind:'ephemeral',cursor:ephemeral\}\)/);
 assert.match(owner,/p1:producerOutput\+innerColumn/);
 assert.match(owner,/columns:compoundArmColumns\(derived.select,schema\)/);
 assert.doesNotMatch(owner,/inner\.ops|compileTableSelect\(derived.select/,'two-source producer still compiles and copies completed child');
});
