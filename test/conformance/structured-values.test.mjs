import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);
test('structured multirow VALUES executes through the public prepared VDBE path',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db,s;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));s=db.prepare("VALUES (1,'a'),(2,'b'),(3,NULL)").statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['column1','column2']);
  const rows=[];while(await s.step()==='row')rows.push([s.column(0),s.column(1)]);assert.deepEqual(rows,[[1n,'a'],[2n,'b'],[3n,null]]);s.reset();assert.equal(await s.step(),'row');assert.deepEqual([s.column(0),s.column(1)],[1n,'a']);
 }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('VALUES width mismatch remains an atomic prepare error',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));assert.throws(()=>db.prepare('VALUES(1),(2,3)'),e=>e?.kind==='sqlite'&&e?.code===1);
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
