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
    for(const {id=null,source=null,assertion=null,phase=null,sql,name,expected} of [
      {sql:'WITH q(x) AS (VALUES(7)) SELECT x FROM q',name:'x',expected:[7n]},
      {sql:'WITH q(x) AS NOT MATERIALIZED (VALUES(8)) SELECT x FROM q',name:'x',expected:[8n]},
      {sql:'WITH RECURSIVE q(x) AS (VALUES(9)) SELECT x FROM q',name:'x',expected:[9n]},
      {sql:'WITH q(x) AS (SELECT a FROM t1) SELECT x FROM q',name:'x',expected:[1n,3n,5n,7n]},
      // Public read-only-fixture adaptations of the five pinned upstream
      // lexical discriminators. Keep each source assertion independently
      // identified so one passing branch cannot stand in for another.
      {id:'with1-3.4',source:'test/with1.test',assertion:'3.4',phase:'rows',sql:'WITH q(x) AS (VALUES(1)), q2 AS (WITH q(x) AS (VALUES(2)) SELECT x FROM q) SELECT x FROM q2',name:'x',expected:[2n]},
      {id:'with1-3.5',source:'test/with1.test',assertion:'3.5',phase:'rows',sql:'WITH q(x) AS (VALUES(3)), q2 AS (WITH unused(y) AS (VALUES(4)) SELECT x FROM q) SELECT x FROM q2',name:'x',expected:[3n]},
      {id:'with2-1.6',source:'test/with2.test',assertion:'1.6',phase:'rows',sql:'WITH x1(a) AS (SELECT a FROM t1), x2 AS (WITH unused(y) AS (VALUES(4)) SELECT a FROM x1) SELECT a FROM x2',name:'a',expected:[1n,3n,5n,7n]},
      {id:'with2-1.7',source:'test/with2.test',assertion:'1.7',phase:'rows',sql:'WITH q2 AS (WITH q(x) AS (VALUES(4)) SELECT x FROM q) SELECT x FROM q2',name:'x',expected:[4n]},
      {id:'with2-1.8',source:'test/with2.test',assertion:'1.8',phase:'rows',sql:'WITH q2 AS (WITH t1(a) AS (VALUES(99)) SELECT a FROM main.t1) SELECT a FROM q2',name:'a',expected:[1n,3n,5n,7n]},
    ]){
      if(id!==null){assert.equal(`${source.replace(/^test\//,'').replace(/\.test$/,'')}-${assertion}`,id);assert.equal(phase,'rows');}
      // Obtaining the statement proves successful prepare before typed row/DONE
      // observations for each independently identified upstream discriminator.
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
