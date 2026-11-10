import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {JSQLiteError} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);
const temporary=e=>e instanceof JSQLiteError&&e.kind==='unsupported'&&e.unsupportedClassification==='temporary';
const temporaryMessage=message=>e=>temporary(e)&&e.message===message;

test('compound producer shapes outside the bounded implementation reject atomically',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));
  for(const sql of [
   'SELECT 1 UNION SELECT a FROM left_meta',
   'SELECT a FROM left_meta JOIN right_meta UNION SELECT b FROM right_meta',
  ])assert.throws(()=>db.prepare(sql),temporary,sql);
  const statement=db.prepare('SELECT 1').statement;assert.equal(await statement.step(),'row');statement.finalize();
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

// These former exclusions are admitted by the filtered/projection compound slice.
// Pinned 3.53.4 preserves INTEGER/TEXT distinction despite both displaying 8.
test('admitted compound filter and projection preserve typed rows and reset',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));
  for(const [sql,expected] of [
   ['SELECT a FROM left_meta UNION SELECT b FROM right_meta WHERE b=8',[7n,'8']],
   ['SELECT a+1 FROM left_meta UNION SELECT b FROM right_meta',[8n,'8']],
  ]){
   statement=db.prepare(sql).statement;
   for(let run=0;run<2;run++){
    const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
    assert.deepEqual(rows,expected,sql);statement.reset();
   }
   statement.finalize();statement=undefined;
  }
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
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

test('supported recursive and expression-owned VALUES WITH execute',async()=>{
 const bridge=await startFixtureServer(fixtureRoot);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  const recursive='WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<3) SELECT x FROM q';
  const recursiveStatement=db.prepare(recursive).statement,rows=[];
  try{while(await recursiveStatement.step()==='row')rows.push(recursiveStatement.columnInteger(0));assert.deepEqual(rows,[1n,2n,3n])}finally{recursiveStatement.finalize()}
  const nested='SELECT (WITH q(x) AS (VALUES(1)) SELECT x FROM q)';
  const nestedStatement=db.prepare(nested).statement;
  try{
   assert.equal(nestedStatement.columnCount,1);
   assert.equal(nestedStatement.columnMetadata(0).name,'(WITH q(x) AS (VALUES(1)) SELECT x FROM q)');
   for(let run=0;run<2;run++){
    assert.equal(await nestedStatement.step(),'row');
    assert.equal(nestedStatement.columnType(0),'integer');assert.equal(nestedStatement.column(0),1n);
    assert.equal(await nestedStatement.step(),'done');nestedStatement.reset();
   }
  }finally{nestedStatement.finalize()}
  // Whole pinned queries: scalar FIRST replaces nonzero fractional LIMIT.
  for(const [suffix,value,type] of [['',7n,'integer'],[' LIMIT 0',null,'null'],[' LIMIT 1.5',7n,'integer'],[' LIMIT 1 OFFSET 1',9n,'integer']]){
   const sql='SELECT (WITH q(x) AS (VALUES(7),(9)) SELECT x FROM q'+suffix+')';
   const child=db.prepare(sql).statement;
   try{
    assert.equal(child.columnCount,1);assert.equal(child.columnMetadata(0).name,sql.slice(7));
    for(let run=0;run<2;run++){
     assert.equal(await child.step(),'row');assert.equal(child.columnType(0),type);assert.equal(child.column(0),value);
     assert.equal(await child.step(),'done');child.reset();
    }
   }finally{child.finalize()}
  }
  const statement=db.prepare('SELECT 1').statement;assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);statement.finalize();
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
