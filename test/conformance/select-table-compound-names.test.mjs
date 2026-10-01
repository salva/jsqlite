import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Paired with select-table-compound-names-native.py: first-arm names and
// WHERE/IN multirow arm exhaustion must survive compound producer composition.
test('table-backed compound derived resolves duplicate projected names',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const base='SELECT d.x,d."x:1" FROM (SELECT a AS x,b AS x FROM t1 WHERE a IN (1,3) UNION ALL SELECT a,b FROM t1 WHERE a=5) d';
  const stmt=db.prepare(base).statement;
  try{
   assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),['x','x:1']);
   for(let pass=0;pass<2;pass++){
    const rows=[];while(await stmt.step()==='row')rows.push([stmt.column(0),stmt.column(1),stmt.columnType(0),stmt.columnType(1)]);
    assert.deepEqual(rows,[[1n,2n,'integer','integer'],[3n,4n,'integer','integer'],[5n,6n,'integer','integer']]);if(!pass)stmt.reset();
   }
  }finally{stmt.finalize()}
  assert.throws(()=>db.prepare(base.replace('d."x:1"','d.missing')),e=>e.message.includes('no such column: d.missing'));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
