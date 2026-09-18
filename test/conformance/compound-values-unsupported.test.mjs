import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {JSQLiteError} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);
const temporary=e=>e instanceof JSQLiteError&&e.kind==='unsupported'&&e.unsupportedClassification==='temporary';

test('compound producer shapes outside the bounded implementation reject atomically',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));
  for(const sql of [
   'SELECT a FROM left_meta UNION SELECT b FROM right_meta WHERE b=8',
   'SELECT a,a FROM left_meta UNION SELECT b,b FROM right_meta',
   'SELECT 1 UNION SELECT a FROM left_meta',
   'SELECT a+1 FROM left_meta UNION SELECT b FROM right_meta',
   'SELECT a FROM left_meta JOIN right_meta UNION SELECT b FROM right_meta',
  ])assert.throws(()=>db.prepare(sql),temporary,sql);
  const statement=db.prepare('SELECT 1').statement;assert.equal(await statement.step(),'row');statement.finalize();
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('implemented VALUES production identity remains structured and executable',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const [sql,expected] of [
   ['VALUES(1)',[1n]],
   ['VALUES(1),(2)',[1n,2n]],
   ["VALUES(NULL),(1),(1.0),('1'),(x'31')",[null,1n,1,'1',new Uint8Array([0x31])]],
  ]){
   const statement=db.prepare(sql).statement,actual=[];
   try{while(await statement.step()==='row')actual.push(statement.column(0));assert.deepEqual(actual,expected)}finally{statement.finalize()}
  }
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('residual recursive and unrepresented WITH graphs reject atomically',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const sql of ['WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q) SELECT x FROM q','SELECT * FROM (WITH q AS (VALUES(1)) SELECT * FROM q)']){
   assert.throws(()=>db.prepare(sql),temporary,sql);
  }
  const statement=db.prepare('SELECT 1').statement;assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);statement.finalize();
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
