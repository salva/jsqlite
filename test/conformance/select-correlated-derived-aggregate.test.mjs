import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Paired with select-correlated-derived-aggregate-native.py: resolve.c linked
// NameContexts and expr.c correlated scalar re-entry, then select.c aggregate
// over a UNION ALL derived source; independent physical subquery is a control.
test('correlated scalar aggregate consumes compound derived rows in linked context',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const cases=[
   ['SELECT t.a,(SELECT count(*) FROM (SELECT 1 AS x UNION ALL SELECT 2) d WHERE d.x=t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1',[[['integer',1n],['integer',1n]],[['integer',3n],['integer',0n]]]],
   ['SELECT t.a,(SELECT sum(d.x) FROM (SELECT 1 AS x UNION ALL SELECT 2) d WHERE d.x=t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1',[[['integer',1n],['integer',1n]],[['integer',3n],['null',null]]]],
   ['SELECT t.a,(SELECT count(*) FROM t1 i WHERE i.a=t.a) AS n FROM t1 t WHERE t.a IN (1,3) ORDER BY 1',[[['integer',1n],['integer',1n]],[['integer',3n],['integer',1n]]]]
  ];
  for(const [sql,expected] of cases){const stmt=db.prepare(sql).statement;try{
   assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),['a','n']);
   for(let pass=0;pass<2;pass++){
    const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:2},(_,i)=>[stmt.columnType(i),stmt.column(i)]));
    assert.deepEqual(rows,expected);if(pass===0)stmt.reset();
   }
  }finally{stmt.finalize()}}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
