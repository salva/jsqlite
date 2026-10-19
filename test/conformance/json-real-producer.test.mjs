import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Mem} from '../../src/internal/mem.ts';
import {jsonNodeFromSqlValue,renderJson} from '../../src/internal/json.ts';
test('SQL REAL admission normalizes NaN and retains INTEGER ownership',()=>{
 const m=new Mem();try{m.setDouble(NaN);assert.equal(renderJson(jsonNodeFromSqlValue(m)),'null');m.setDouble(-0);assert.equal(renderJson(jsonNodeFromSqlValue(m)),'0.0');m.setInt64(9223372036854775807n);assert.equal(renderJson(jsonNodeFromSqlValue(m)),'9223372036854775807')}finally{m.release()}
});
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
const oracle=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-json-real-native.json',import.meta.url)));
const encode=(t,v)=>({type:t,value:t==='blob'?Buffer.from(v).toString('hex'):v});
for(const enc of ['utf8','utf16le','utf16be'])test(`SQL REAL JSON producer ${enc}`,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  const raw=db.prepare("SELECT json_array(json('1e-7')),json_set('[]','$[#]',json('1e20'))").statement;
  try{assert.equal(await raw.step(),'row');assert.equal(raw.column(0),'[1e-7]');assert.equal(raw.column(1),'[1e20]');assert.equal(await raw.step(),'done')}finally{raw.finalize()}
  for(const q of oracle.rows.filter(r=>r.enc===enc)){
   const s=db.prepare(q.sql).statement,retained=[];
   const check=()=>{for(const r of retained)assert.deepEqual(r.values.map((v,i)=>encode(r.types[i],v)),q.expected,q.value+' retained')};
   try{
    assert.deepEqual(q.metadata.map((_,i)=>s.columnMetadata(i)),q.metadata.map(m=>({name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name})));
    for(let repeat=0;repeat<2;repeat++){
     assert.equal(await s.step(),'row');check();const types=q.expected.map((_,i)=>s.columnType(i)),values=types.map((_,i)=>s.column(i));
     assert.deepEqual(values.map((v,i)=>encode(types[i],v)),q.expected,q.value);retained.push({types,values});assert.equal(await s.step(),'done');check();s.reset();check();
    }
   }finally{s.finalize()}check();
  }
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
