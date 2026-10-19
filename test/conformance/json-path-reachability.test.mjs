import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import fs from 'node:fs';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-b-path-reachability-native.json',import.meta.url),'utf8')).cases;
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';

// json.c:jsonLookupStep stops on NOTFOUND/shape mismatch before parsing tails.
for(const enc of ['utf8','utf16le','utf16be'])for(const [expression,expected,error] of [
 ["json_set('{}','$.a[1].',1)",'{}',false],
 ["json_set('{}','$.a[#-1].',1)",'{}',false],
 ["json_set('{\"a\":1}','$.a[0].',1)",'{"a":1}',false],
 ["json_set('{}','$.a[0].',1)",null,true],
 ["json_set('{}','$.a.b',1)",'{"a":{"b":1}}',false],
 ["json_insert('{}','$.a[1].',1)",'{}',false],
 ["json_replace('{}','$.a[0].',1)",'{}',false],
 ["json_remove('{}','$.a[0].')",'{}',false],
 ["json_set('[]','$[1].',1)",'[]',false],
 ["json_set('[]','$[0].',1)",null,true],
 ["json_set('{\"a\":{}}','$.a.',1)",null,true],
 ["json_set('{\"a\":1}','$.a.',1)",null,true],
 ["json_set('{\"a\":1}','$.a[bad',1)",'{"a":1}',false],
 ["json(jsonb_set(jsonb('{}'),'$.a[1].',1))",'{}',false],
 ["json(jsonb_set(jsonb('{}'),'$.a[#-1].',1))",'{}',false],
 ["json_extract('{}','$.a.')",null,false],
 ["json_extract('{\"a\":1}','$.a[bad')",null,false],
 ["json_extract('{\"a\":{}}','$.a.')",null,true],
 ["json_type('{}','$.a.')",null,false],
 ["json_array_length('{}','$.a.')",null,false],
 ["'{}' -> '$.a.'",null,false],
 ["'{}' ->> '$.a.'",null,false],
 ["jsonb_extract(jsonb('{}'),'$.a.')",null,false],
 ["hex(jsonb_set(jsonb('{}'),'$.a[1].',1))",'0C',false],
 ["hex(jsonb_remove(jsonb('{}'),'$.a.'))",'0C',false],
 ["json_array_insert('{}','$.a[1].',1)",null,true],
 ["json_set('{}','$.a[#-0].',1)",null,true],
 ["json_set('{}','$.a[1].',1,'$.b',2)",'{"b":2}',false],
])test(`incremental JSON path reachability ${enc}: ${expression}`,async()=>{
 const oracle=native.find(row=>row.expression===expression);assert.ok(oracle);
 if(error)assert.equal(oracle.rc,1);else{assert.equal(oracle.rc,100);assert.equal(oracle.value,expected);assert.equal(oracle.type,expected===null?5:3)}
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  if(error){await assert.rejects(async()=>{
   const s=db.prepare(`SELECT ${expression}`).statement;
   try{await s.step()}finally{s.finalize()}
  },e=>e.kind==='sqlite'&&e.code===1&&e.extendedCode===1&&e.message===oracle.error);return}
  const statement=db.prepare(`SELECT ${expression}`).statement;
  try{
   for(let run=0;run<2;run++){
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),expected===null?'null':'text');
    assert.equal(statement.column(0),expected);
    assert.equal(await statement.step(),'done');
    if(run===0)statement.reset();
   }
  }finally{statement.finalize()}
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
