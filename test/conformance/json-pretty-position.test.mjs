import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
const oracle=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-pretty-position-native.json',import.meta.url)));
for(const enc of ['utf8','utf16le','utf16be'])test(`pretty consumed position ${enc}`,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));const failures=[];
  for(const row of oracle.rows.filter(r=>r.enc===enc)){
   const s=db.prepare('SELECT '+row.expression).statement;
   try{
    assert.deepEqual(s.columnMetadata(0),{name:row.metadata.name,declaredType:row.metadata.decltype,database:row.metadata.database_name,table:row.metadata.table_name,origin:row.metadata.origin_name});
    for(let repeat=0;repeat<2;repeat++){
     s.bind(1,Uint8Array.from(Buffer.from(row.hex,'hex')));
     let error;const state=await s.step().catch(e=>{error=e});
     if(row.result.error){assert.equal(error?.kind,'sqlite');assert.equal(error?.code,row.result.code);assert.equal(error?.message,row.result.error);await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s.reset(),e=>e===error)}
     else{assert.equal(error,undefined);assert.equal(state,'row');assert.equal(s.columnType(0),row.result.type);assert.equal(row.result.type==='integer'?String(s.column(0)):s.column(0),row.result.value);assert.equal(await s.step(),'done');s.reset()}
    }
    s.bind(1,'null');assert.equal(await s.step(),'row');assert.equal(await s.step(),'done');s.reset();
   }catch(e){failures.push({hex:row.hex,expr:row.expression,error:e.message})}finally{s.finalize()}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
