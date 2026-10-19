import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';

const oracle=JSON.parse(readFileSync(new URL('../../docs/research/card-r-e-aggregate-integration-native.json',import.meta.url)));
const encode=(type,value)=>({type,value:type==='integer'?String(value):type==='blob'?Buffer.from(value).toString('hex'):value});
const metadata=m=>({name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name});
// Keep the actual public values (not just their serialized copies) alive across
// subsequent rows, DONE, reset, rebind and finalize. BLOB aliasing is observable.
for(const enc of ['utf8'])test(`native JSON aggregate snapshots and lifecycle ${enc}`,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  for(const q of oracle.rows.filter(r=>r.enc===enc)){
   const s=db.prepare(q.sql).statement,retained=[];
   const checkRetained=()=>{for(const r of retained)assert.deepEqual(r.values.map((v,i)=>encode(r.types[i],v)),r.expected,`${q.id} retained result changed`)};
   try{
    assert.equal(s.columnCount,q.metadata.length);
    assert.deepEqual(q.metadata.map((_,i)=>s.columnMetadata(i)),q.metadata.map(metadata),q.id);
    // Repeat the entire error/recovery or nonempty/rebind sequence, not merely
    // separate prepares with unrelated lifetimes.
    for(let repeat=0;repeat<2;repeat++)for(const execution of q.executions){
     s.bind(1,BigInt(execution.binding));
     for(const expected of execution.rows){
      assert.equal(await s.step(),'row',q.id);checkRetained();
      const types=expected.map((_,i)=>s.columnType(i)),values=expected.map((_,i)=>s.column(i));
      assert.deepEqual(values.map((v,i)=>encode(types[i],v)),expected,q.id);
      retained.push({types,values,expected});
     }
     if(execution.error){
      let saved;await assert.rejects(s.step(),e=>{saved=e;return e.kind==='sqlite'&&e.code===execution.error.code&&e.message===execution.error.message});
      await assert.rejects(s.step(),e=>e===saved);
      assert.throws(()=>s.reset(),e=>e===saved);
     }else{
      assert.equal(await s.step(),'done',q.id);checkRetained();s.reset();
     }
     checkRetained();
    }
   }finally{s.finalize()}
   checkRetained();
   // Successful new admission after all reset/error/finalize paths.
   const next=db.prepare('SELECT 1').statement;
   try{assert.equal(await next.step(),'row');assert.equal(next.column(0),1n);assert.equal(await next.step(),'done')}finally{next.finalize()}
  }
  db.close();db=undefined;
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
