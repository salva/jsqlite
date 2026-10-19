import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import fs from 'node:fs';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// Original six-case reproducer is retained in the native case inventory.
// jsonLookupStep: nn>arrayCount precedes delimiter validation; ordinary numeric
// indices validate the delimiter first. Tests compare typed native results.
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-b-from-end-native.json',import.meta.url),'utf8'));
for(const enc of ['utf8','utf16le','utf16be'])test(`contextual JSON indices ${enc}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  for(const row of capture.cases){
   const execute=async()=>{const s=db.prepare(`SELECT ${row.expression}`).statement;try{
    for(let run=0;run<2;run++){
     assert.equal(await s.step(),'row',row.expression);
     assert.equal(s.columnType(0),({1:'integer',3:'text',5:'null'})[row.type],row.expression);
     assert.equal(s.column(0),row.type===1?BigInt(row.value):row.value,row.expression);
     assert.equal(await s.step(),'done');if(run===0)s.reset();
    }
   }finally{s.finalize()}};
   if(row.rc!==100)await assert.rejects(execute,e=>e.kind==='sqlite'&&e.code===row.rc&&e.extendedCode===row.rc&&e.message===row.error,row.expression);
   else await execute();
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
