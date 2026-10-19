import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';

// Pinned json.c:jsonLookupStep creates missing intermediate containers through
// jsonCreateEditSubstructure, for both missing labels and array append slots.
for(const [expression,expected] of [
 ["json_set('{}','$.a.b',1)",'{"a":{"b":1}}'],
 ["json_insert('{}','$.a[0]',1)",'{"a":[1]}'],
 ["json_set('[]','$[#].a',1)",'[{"a":1}]'],
 ["json(jsonb_set(jsonb('{}'),'$.a.b',1))",'{"a":{"b":1}}'],
 ["json_set('{}','$.a[1].b',1)",'{}'],
 ["json_set('{}','$.a[#-1].b',1)",'{}'],
 ["json_set('{}','$.a[#-0].b',1)",'{"a":[{"b":1}]}'],
 ["json_set('{\"a\":1}','$.a.b',2)",'{"a":1}'],
 ["json_replace('{}','$.a.b',1)",'{}'],
 ["json_remove('{}','$.a.b')",'{}'],
 ["json_set('{}','$.a.b',1,'$.a.c',2)",'{"a":{"b":1,"c":2}}'],
 ["json_array_insert('{}','$.a[0]',1)",'{"a":[1]}'],
 ["json_array_insert('[]','$[#][0]',1)",'[[1]]'],
 ["hex(jsonb_set(jsonb('{}'),'$.a.b',1))",'7C1A614C1A621331'],
])test(`missing JSON edit substructure: ${expression}`,async()=>{
 const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const statement=db.prepare(`SELECT ${expression}`).statement;
  try{
   for(let run=0;run<2;run++){
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),'text');
    assert.equal(statement.column(0),expected);
    assert.equal(await statement.step(),'done');
    if(run===0)statement.reset();
   }
  }finally{statement.finalize()}
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
