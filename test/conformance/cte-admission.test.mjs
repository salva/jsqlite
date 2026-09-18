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

const nested=[
  ['scalar','SELECT (WITH c(x) AS (VALUES(1)) SELECT x FROM c)'],
  ['exists','SELECT EXISTS(WITH c(x) AS (VALUES(1)) SELECT x FROM c)'],
  ['in','SELECT 1 IN (WITH c(x) AS (VALUES(1)) SELECT x FROM c)'],
  ['retained derived','SELECT x FROM (WITH c(x) AS (VALUES(1)) SELECT x FROM c) AS d'],
  ['flattening-adjacent derived','SELECT a FROM (WITH c(x) AS (SELECT a FROM t1) SELECT x AS a FROM c) AS d'],
  ['compound arm expression','SELECT 1 UNION ALL SELECT (WITH c(x) AS (VALUES(2)) SELECT x FROM c)'],
];
for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} rejects every reachable nested WITH before statement admission`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));
  const {server,db}=await openBytes(body);
  try{
    for(const [label,sql] of nested){assert.throws(()=>db.prepare(sql),cteError,label);await reusable(db);}
    // A successful close proves no rejected prepare was registered as a statement.
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} rejects WITH in a persisted view after schema loading`,async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'jsqlite-cte-view-'));
  const database=path.join(directory,'view.db');
  fs.copyFileSync(path.join(generated,`subquery-${encoding}.db`),database);
  fs.chmodSync(database,0o600);
  execFileSync('python3',['-c',`import sqlite3,sys\nc=sqlite3.connect(sys.argv[1])\nc.execute("CREATE VIEW v_cte AS WITH c(x) AS (SELECT a FROM t1) SELECT x FROM c")\nc.commit();c.close()`,database]);
  const {server,db}=await openBytes(fs.readFileSync(database));
  try{assert.throws(()=>db.prepare('SELECT x FROM v_cte'),cteError);await reusable(db);db.close();}
  finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));fs.rmSync(directory,{recursive:true,force:true});}
});
