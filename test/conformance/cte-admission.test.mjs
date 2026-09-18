import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const here=path.dirname(new URL(import.meta.url).pathname);
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');
const cteError=error=>error?.kind==='unsupported'&&error?.unsupportedClassification==='temporary'&&error?.message==='common table expressions are not implemented';
const recursiveCteError=error=>error?.kind==='unsupported'&&error?.unsupportedClassification==='temporary'&&error?.message==='recursive common table expressions are not implemented';

async function serverFor(body){
  const server=http.createServer((_request,response)=>{response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});response.end(body)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return server;
}
async function openBytes(body){const server=await serverFor(body);return{server,db:await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`))};}
async function reusable(db){
  const statement=db.prepare('SELECT 1').statement;
  try{assert.equal(await statement.step(),'row');assert.equal(statement.columnInteger(0),1n);assert.equal(await statement.step(),'done');}
  finally{statement.finalize();}
}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} executes WITH inside represented derived sources`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));const {server,db}=await openBytes(body);
  try{for(const [sql,expected] of [
    ['SELECT x FROM (WITH c(x) AS (VALUES(1)) SELECT x FROM c) AS d',[1n]],
    ['SELECT a FROM (WITH c(x) AS (SELECT a FROM t1) SELECT x AS a FROM c) AS d',[1n,3n,5n,7n]],
  ]){const statement=db.prepare(sql).statement,actual=[];try{while(await statement.step()==='row')actual.push(statement.columnInteger(0));assert.deepEqual(actual,expected)}finally{statement.finalize()}}db.close();}
  finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} executes persisted WITH view without caller scope capture`,async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jsqlite-cte-view-'));const database=path.join(directory,'view.db');fs.copyFileSync(path.join(generated,`subquery-${encoding}.db`),database);fs.chmodSync(database,0o600);
  execFileSync('python3',['-c',`import sqlite3,sys\nc=sqlite3.connect(sys.argv[1])\nc.execute("CREATE VIEW v_cte AS WITH c(x) AS (SELECT a FROM t1) SELECT x FROM c")\nc.commit();c.close()`,database]);
  const {server,db}=await openBytes(fs.readFileSync(database));try{const statement=db.prepare('WITH c(x) AS (VALUES(99)) SELECT x FROM v_cte').statement,actual=[];try{while(await statement.step()==='row')actual.push(statement.columnInteger(0));assert.deepEqual(actual,[1n,3n,5n,7n])}finally{statement.finalize()}db.close();}finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));fs.rmSync(directory,{recursive:true,force:true});}
});


for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} keeps nested-WITH and recursive ownership distinct`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('SELECT (WITH c(x) AS (VALUES(1)) SELECT x FROM c)'),cteError);
    assert.throws(()=>db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c) SELECT x FROM c'),recursiveCteError);
    await reusable(db);db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
