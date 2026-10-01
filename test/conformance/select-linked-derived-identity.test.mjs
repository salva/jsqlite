import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Paired with select-linked-derived-identity-native.py: linked NameContext
// retains rowid aliases and reports missing names before generating the producer.
test('scalar derived aggregate uses resolved outer identity, including rowid',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const prefix='SELECT t.a,(SELECT count(*) FROM (SELECT 1 AS x UNION ALL SELECT 2) d WHERE ';
  const suffix=') AS n FROM t1 AS t WHERE t.a IN (1,3) ORDER BY 1';
  for(const [whereClause,expected] of [
   ['d.x=t.rowid',[[1n,1n],[3n,0n]]],
   ['d.x=t.a',[[1n,1n],[3n,0n]]],
   ['d.x=t.b',[[1n,1n],[3n,0n]]]
  ]){
   const stmt=db.prepare(prefix+whereClause+suffix).statement;
   try{
    assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),['a','n']);
    for(let pass=0;pass<2;pass++){
     const rows=[];while(await stmt.step()==='row')rows.push([stmt.column(0),stmt.column(1),stmt.columnType(0),stmt.columnType(1)]);
     assert.deepEqual(rows,expected.map(([a,n])=>[a,n,'integer','integer']));if(!pass)stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  for(const [whereClause,error] of [['d.x=t.missing','no such column: t.missing'],['d.missing=t.a','no such column: d.missing']]){
   assert.throws(()=>db.prepare(prefix+whereClause+suffix),e=>e.message.includes(error));
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
