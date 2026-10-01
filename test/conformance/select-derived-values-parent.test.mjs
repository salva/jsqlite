import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Paired with select-derived-values-parent-native.py (same pinned SQL/cells).
test('derived VALUES parent destination preserves typed cells, names, error and reset',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const sql="SELECT v.column1 AS n,v.column2 AS t,v.column3 AS b,v.column4 AS r FROM (VALUES(1,'a',x'00',1.5),(2,NULL,x'ff',2),(3,'z',x'7f',3)) AS v ORDER BY 1 DESC LIMIT 2";
  const stmt=db.prepare(sql).statement;
  try{
   assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),['n','t','b','r']);
   const expected=[[['integer',3n],['text','z'],['blob','7f'],['integer',3n]],[['integer',2n],['null',null],['blob','ff'],['integer',2n]]];
   for(let pass=0;pass<2;pass++){
    const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>[stmt.columnType(i),stmt.columnType(i)==='blob'?Buffer.from(stmt.column(i)).toString('hex'):stmt.column(i)]));
    assert.deepEqual(rows,expected);if(!pass)stmt.reset();
   }
  }finally{stmt.finalize()}
  assert.throws(()=>db.prepare('SELECT v.missing FROM (VALUES(1),(2)) v'),/no such column/);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
