import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const here=path.dirname(new URL(import.meta.url).pathname);
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');

async function serve(body){
  const server=http.createServer((_request,response)=>{
    response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});
    response.end(body);
  });
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return server;
}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} executes ordinary one-use CTE sources`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));
  const server=await serve(body);
  let db;
  let statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    for(const [sql,name,expected] of [
      ['WITH q(x) AS (VALUES(7)) SELECT x FROM q','x',[7n]],
      ['WITH q(x) AS NOT MATERIALIZED (VALUES(8)) SELECT x FROM q','x',[8n]],
      ['WITH RECURSIVE q(x) AS (VALUES(9)) SELECT x FROM q','x',[9n]],
      ['WITH q(x) AS (SELECT a FROM t1) SELECT x FROM q','x',[1n,3n,5n,7n]],
    ]){
      statement=db.prepare(sql).statement;
      assert.equal(statement.columnCount,1);
      assert.equal(statement.columnMetadata(0).name,name);
      const actual=[];while(await statement.step()==='row'){assert.equal(statement.columnType(0),'integer');actual.push(statement.columnInteger(0));}
      assert.deepEqual(actual,expected);
      statement.finalize();statement=undefined;
    }
  }finally{
    statement?.finalize();
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} plans multiple, repeated, and MATERIALIZED CTE sources`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));
  const server=await serve(body);let db;let statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    for(const [sql,expected] of [
      ['WITH q1(x) AS (VALUES(1)), q2(y) AS (VALUES(2)) SELECT x,y FROM q1 CROSS JOIN q2',[[1n,2n]]],
      ['WITH q(x) AS (VALUES(1),(2)) SELECT a.x,b.x FROM q AS a JOIN q AS b ON a.x=b.x ORDER BY 1',[[1n,1n],[2n,2n]]],
      ['WITH q(x) AS MATERIALIZED (VALUES(3)) SELECT x FROM q',[[3n]]],
    ]){
      statement=db.prepare(sql).statement;const rows=[];
      while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.columnInteger(i)));
      assert.deepEqual(rows,expected,sql);statement.finalize();statement=undefined;
    }
  }finally{statement?.finalize();try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} composes ordinary CTEs with supported relational routes`,async()=>{
 const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));const server=await serve(body);let db;let statement;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));for(const [sql,expected] of [
  ['WITH q(x) AS (SELECT a FROM t1) SELECT t2.x,q.x FROM t2 CROSS JOIN q ORDER BY 1,2',[[1n,1n],[1n,3n],[1n,5n],[1n,7n],[1n,1n],[1n,3n],[1n,5n],[1n,7n],[3n,1n],[3n,3n],[3n,5n],[3n,7n],[9n,1n],[9n,3n],[9n,5n],[9n,7n]]],
  ['WITH q(x) AS (SELECT a FROM t1) SELECT x,count(*) FROM q GROUP BY x ORDER BY x',[[1n,1n],[3n,1n],[5n,1n],[7n,1n]]],
  ['WITH q(x) AS (VALUES(1)) SELECT x FROM q UNION ALL SELECT 2',[[1n],[2n]]],
 ]){statement=db.prepare(sql).statement;const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.columnInteger(i)));assert.deepEqual(rows,expected,sql);statement.finalize();statement=undefined;}}
 finally{statement?.finalize();try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
