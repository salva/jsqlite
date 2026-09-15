import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {JSQLiteError} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const capture=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('./cases/stage3-compound-values.json',import.meta.url),'utf8'));
const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);
const temporary=e=>e instanceof JSQLiteError&&e.kind==='unsupported'&&e.unsupportedClassification==='temporary';

test('all native-valid compound and VALUES contracts stop at typed unsupported prepare',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const attempted=capture.cases.filter(c=>c.ts.attempted.length);
  assert.equal(attempted.length,capture.accounting.tsPrepareAttempts);
  for(const c of attempted)assert.throws(()=>db.prepare(c.sql),temporary,c.id);
  assert.equal(capture.accounting.tsCreditedCases,0);
  const statement=db.prepare('SELECT 1').statement;assert.equal(await statement.step(),'row');statement.finalize();
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('VALUES production identity is preserved without consuming a fabricated result graph',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const sql of ['VALUES(1)','VALUES(1),(2)','VALUES(NULL),(1),(1.0),(\'1\'),(x\'31\')'])
   assert.throws(()=>db.prepare(sql),e=>temporary(e)&&e.message==='compound SELECTs, VALUES, and subqueries are not implemented',sql);
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
