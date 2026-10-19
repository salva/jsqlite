import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import fs from 'node:fs';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-b-mergepatch-native.json',import.meta.url),'utf8')).cases;
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// json.c:jsonMergePatch scans from iTStart and edits only the first matching
// target member per patch member. Repeated NULL patch members rescan the result.
for(const enc of ['utf8','utf16le','utf16be'])test(`mergepatch duplicate first match ${enc}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  const cases=[
   ["json_patch('{\"a\":1,\"a\":2}','{\"a\":null}')",'{"a":2}'],
   ["hex(jsonb_patch(jsonb('{\"a\":1,\"a\":2}'),jsonb('{\"a\":null}')))",'4C17611332'],
   ["json_patch('{\"a\":1,\"a\":2}','{\"a\":9}')",'{"a":9,"a":2}'],
   ["json_patch('{\"a\":1,\"a\":2}','{\"a\":null,\"a\":null}')",'{}'],
  ];
  const failures=[];
  for(const [expression,expected] of cases){
   const s=db.prepare(`SELECT ${expression}`).statement;
   try{for(let run=0;run<2;run++){
    assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'text');
    const actual=s.column(0);if(actual!==expected)failures.push({expression,run,expected,actual});
    assert.equal(await s.step(),'done');if(run===0)s.reset();
   }}finally{s.finalize()}
  }
  assert.deepEqual(failures,[]);
  for(const row of native){
   const execute=async()=>{
    const s=db.prepare(`SELECT ${row.expression}`).statement;
    try{for(let run=0;run<2;run++){
     assert.equal(await s.step(),'row',row.expression);
     assert.equal(s.columnType(0),row.type===5?'null':row.type===1?'integer':'text',row.expression);
     assert.equal(s.column(0),row.type===1?BigInt(row.value):row.value,row.expression);
     assert.equal(await s.step(),'done');if(run===0)s.reset();
    }}finally{s.finalize()}
   };
   if(row.rc===100)await execute();
   else await assert.rejects(execute,e=>e.kind==='sqlite'&&e.code===row.rc&&e.extendedCode===row.rc&&e.message===row.error,row.expression);
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
