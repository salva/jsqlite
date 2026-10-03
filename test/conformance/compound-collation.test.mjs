import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);

async function rows(sql){
  const bridge=await startFixtureServer(root);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(sql).statement;const result=[];
    while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
    statement.reset();const reset=[];
    while(await statement.step()==='row')reset.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
    assert.deepEqual(reset,result,'reset preserves compound rows and storage classes');
    statement.finalize();statement=undefined;return result;
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
}

// Pinned 3.53.4 oracle capture: work product collation-oracle/native.json.
// These discriminate select.c:multiSelectCollSeq and
// multiSelectByMergeKeyInfo's explicit ORDER COLLATE override.
test('scalar set KeyInfo takes the first explicit result collation left-to-right',async()=>{
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase UNION SELECT 'A'"),[['A']]);
  assert.deepEqual(await rows("SELECT 'a' UNION SELECT 'A' COLLATE nocase"),[['A']]);
  assert.deepEqual(await rows("SELECT 'a ' COLLATE rtrim UNION SELECT 'a'"),[['a']]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase,1 UNION SELECT 'A',1"),[['A',1n]]);
  // expr.c:sqlite3ExprCollSeq propagates EP_Collate through admitted function
  // argument lists; these pinned-oracle cases prevent root-only inspection.
  assert.deepEqual(await rows("SELECT coalesce('a' COLLATE nocase,'x') UNION SELECT 'A'"),[['A']]);
  assert.deepEqual(await rows("SELECT nullif('a' COLLATE nocase,'z') UNION SELECT 'A'"),[['A']]);
  assert.deepEqual(await rows("SELECT min('a' COLLATE nocase,'a') UNION SELECT 'A'"),[['A']]);
  assert.deepEqual(await rows("SELECT max('a' COLLATE nocase,'a') UNION SELECT 'A'"),[['A']]);
});

test('compound ORDER inherits result collation and explicit COLLATE overrides it',async()=>{
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x UNION ALL SELECT 'B' UNION ALL SELECT 'A' ORDER BY x"),[['a'],['A'],['B']]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x UNION ALL SELECT 'B' UNION ALL SELECT 'A' ORDER BY x COLLATE binary"),[['A'],['B'],['a']]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x UNION SELECT 'B' UNION SELECT 'A' ORDER BY x COLLATE binary"),[['A'],['B']]);
});

test('collation equality preserves operator-specific representative and storage class',async()=>{
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase UNION SELECT 'A'"),[['A']]);
  assert.deepEqual(await rows('SELECT 1.0 COLLATE nocase INTERSECT SELECT 1'),[[1]]);
});

test('scalar and structured VALUES set prefixes hand off to trailing UNION ALL',async()=>{
  assert.deepEqual(await rows("SELECT 1 UNION SELECT 1 UNION ALL SELECT 1"),[[1n],[1n]]);
  assert.deepEqual(await rows("SELECT 1 UNION SELECT 1.0 UNION ALL SELECT 1.0"),[[1],[1]]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase UNION SELECT 'A' UNION ALL SELECT 'a'"),[['A'],['a']]);
  assert.deepEqual(await rows("VALUES(1),(1) UNION VALUES(1) UNION ALL VALUES(1),(2)"),[[1n],[1n],[2n]]);
  assert.deepEqual(await rows("SELECT 1 UNION SELECT 1 UNION ALL SELECT 2 ORDER BY 1 DESC LIMIT 2 OFFSET 1"),[[1n]]);
  assert.deepEqual(await rows("VALUES(1),(1) UNION VALUES(1) UNION ALL SELECT 2 UNION ALL SELECT 1 ORDER BY 1 DESC"),[[2n],[1n],[1n]]);
});

// Independent pinned C API matrix captured before repair in
// checkpoint-collation-red/native.json; select.c convertCompoundSelectToSubquery.
test('alternative compound ORDER collations sort after set production',async()=>{
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x INTERSECT SELECT 'A' ORDER BY x COLLATE binary"),[['a']]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x EXCEPT SELECT 'A' ORDER BY x COLLATE binary"),[]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x UNION SELECT 'B' UNION SELECT 'A' ORDER BY x COLLATE nocase"),[['A'],['B']]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x UNION SELECT 'A' UNION ALL SELECT 'a' ORDER BY x COLLATE binary"),[['A'],['a']]);
  assert.deepEqual(await rows("SELECT 'a ' COLLATE rtrim AS x UNION SELECT 'a' ORDER BY x COLLATE binary"),[['a']]);
  assert.deepEqual(await rows("SELECT 1 AS x UNION SELECT 1.0 UNION ALL SELECT NULL ORDER BY x DESC"),[[1],[null]]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x UNION SELECT 'B' UNION SELECT 'A' ORDER BY x COLLATE binary LIMIT 1 OFFSET 1"),[['B']]);
  assert.deepEqual(await rows("SELECT 'a' COLLATE nocase AS x UNION SELECT 'A' ORDER BY x COLLATE binary LIMIT 0"),[]);
});
