import test from 'node:test';
import assert from 'node:assert/strict';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Paired with select-derived-union-owner-native.py (pinned select.c:multiSelect TK_ALL).
test('zero-source aggregate, ordered scalar and unordered UNION ALL derived coroutine typed rows, shared limit/offset, reset',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const cases=[
   ['SELECT d.n FROM (SELECT count(*) AS n) d',[[['integer',1n]]]],
   ['SELECT d.n FROM (SELECT count(*) AS n WHERE 0) d',[[['integer',0n]]]],
   ['SELECT d.n FROM (SELECT count(*) AS n HAVING count(*)>0) d',[[['integer',1n]]]],
   ['SELECT d.n FROM (SELECT count(*) AS n HAVING count(*)>1) d',[]],
   ['SELECT d.n FROM (SELECT 1 AS n GROUP BY 1 HAVING count(*)>0) d',[[['integer',1n]]]],
   ['SELECT d.n FROM (SELECT 1 AS n GROUP BY 1 HAVING count(*)>1) d',[]],
   ['SELECT d.n FROM (SELECT 1 AS n GROUP BY 1 LIMIT 1 OFFSET 1) d',[]],


   ['SELECT d.n FROM (SELECT count(*) AS n ORDER BY n DESC LIMIT 1) d',[[['integer',1n]]]],
   ['SELECT d.n FROM (SELECT count(*) AS n ORDER BY 1 LIMIT 1 OFFSET 1) d',[]],


   ['SELECT d.n FROM (SELECT sum(2) AS n LIMIT 0) d',[]],
   ['SELECT d.i FROM (SELECT 7 AS i ORDER BY i LIMIT 1) d',[[['integer',7n]]]],
   ['SELECT d.i FROM (SELECT 7 AS i ORDER BY 1 DESC LIMIT 1 OFFSET 1) d',[]],
   ['SELECT d.i FROM (SELECT 7 AS i ORDER BY 1 LIMIT 0) d',[]],
   ["SELECT d.i,d.r,d.t,d.b,d.n FROM (SELECT 1 AS i,1.5 AS r,'é' AS t,x'00ff' AS b,NULL AS n UNION ALL SELECT 2,2.5,'z',x'ff',NULL) d",[[['integer',1n],['real',1.5],['text','é'],['blob','00ff'],['null',null]],[['integer',2n],['real',2.5],['text','z'],['blob','ff'],['null',null]]]],
   ['SELECT d.i FROM (SELECT 1 AS i UNION ALL SELECT 2 UNION ALL SELECT 3 LIMIT 1 OFFSET 1) d',[[['integer',2n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION SELECT 2) d',[[['integer',1n]],[['integer',2n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 LIMIT 1 OFFSET 1) d',[[['integer',2n]]]],

   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 EXCEPT SELECT 2) d',[[['integer',1n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 INTERSECT SELECT 1) d',[[['integer',1n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 EXCEPT SELECT 2 LIMIT 1 OFFSET 1) d',[]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 2) d',[[['integer',1n]],[['integer',2n]],[['integer',2n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 2 LIMIT 1 OFFSET 2) d',[[['integer',2n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 3 LIMIT 1) d',[[['integer',1n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT 1 UNION ALL SELECT 3 LIMIT 2 OFFSET 1) d',[[['integer',2n]],[['integer',3n]]]],
   ["SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' UNION SELECT 'z') d",[[['text','a']],[['text','z']]]],
   ["SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' LIMIT 1 OFFSET 1) d",[[['text','z']]]],
   ["SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' UNION ALL SELECT 'z') d",[[['text','a']],[['text','z']],[['text','z']]]],
   ["SELECT d.i FROM (SELECT 'z' AS i UNION SELECT 'a' EXCEPT SELECT 'z') d",[[['text','a']]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT NULL UNION SELECT 1.5) d',[[['null',null]],[['real',1.5]],[['integer',2n]]]],
   ['SELECT d.i FROM (SELECT 2 AS i UNION SELECT NULL UNION SELECT 1.5 LIMIT 1 OFFSET 1) d',[[['real',1.5]]]],
   ['SELECT d.i FROM (SELECT NULL AS i UNION SELECT NULL UNION ALL SELECT 1.5) d',[[['null',null]],[['real',1.5]]]],
   ["SELECT d.i FROM (SELECT x'ff' AS i UNION SELECT x'00' UNION SELECT x'ff') d",[[['blob','00']],[['blob','ff']]]],
   ["SELECT d.i FROM (SELECT x'ff' AS i EXCEPT SELECT x'ff' UNION ALL SELECT x'00') d",[[['blob','00']]]],
   ['SELECT d.i FROM (SELECT 1 AS i EXCEPT SELECT 1 UNION ALL SELECT 4) d',[[['integer',4n]]]],
   ['SELECT d.i FROM (SELECT 1 AS i INTERSECT SELECT 1 UNION ALL SELECT 4 LIMIT 1 OFFSET 1) d',[[['integer',4n]]]],
   ['SELECT d.i FROM (SELECT -2 AS i UNION SELECT 1+1 UNION SELECT 1) d',[[['integer',-2n]],[['integer',1n]],[['integer',2n]]]],
   ['SELECT d.i FROM (SELECT -2 AS i EXCEPT SELECT -2 UNION ALL SELECT 1+1) d',[[['integer',2n]]]],
   ['SELECT d.i FROM (SELECT 1+1 AS i UNION SELECT 2 UNION ALL SELECT 3) d',[[['integer',2n]],[['integer',3n]]]],
   ['SELECT d.i FROM (SELECT 1 AS i UNION ALL SELECT 2 LIMIT 0) d',[]],
   ['SELECT d.i FROM (SELECT 1 AS i UNION ALL SELECT 2 LIMIT 1) d LIMIT 0',[]]
  ];
  for(const [sql,expected] of cases){const stmt=db.prepare(sql).statement;
   try{for(let pass=0;pass<2;pass++){
    const got=[];while(await stmt.step()==='row')got.push(Array.from({length:stmt.columnCount},(_,i)=>[stmt.columnType(i),stmt.columnType(i)==='blob'?Buffer.from(stmt.column(i)).toString('hex'):stmt.column(i)]));
    assert.deepEqual(got,expected);if(!pass)stmt.reset();
   }}finally{stmt.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT 1 AS i UNION ALL SELECT 2) d'),/no such column/);
  assert.throws(()=>db.prepare('SELECT d.n FROM (SELECT count(*) AS n ORDER BY 2) d'),/ORDER BY term out of range|ORDER BY/);

 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
