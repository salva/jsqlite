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
async function openBytes(body,options){const server=await serverFor(body);return{server,db:await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options)};}
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


for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} keeps nested-WITH residual distinct while executing bounded recursive ownership`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('SELECT (WITH c(x) AS (VALUES(1)) SELECT x FROM c)'),cteError);
    const statement=db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT x FROM c').statement;
    const actual=[];try{while(await statement.step()==='row')actual.push(statement.columnInteger(0));assert.deepEqual(actual,[1n,2n,3n,4n]);assert.equal(statement.columnMetadata(0).name,'x');}finally{statement.finalize()}
    await reusable(db);db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive UNION retains all-history duplicate suppression',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    const statement=db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION SELECT x+1 FROM c WHERE x<3 UNION SELECT x FROM c) SELECT x FROM c').statement;
    const actual=[];try{while(await statement.step()==='row')actual.push(statement.columnInteger(0));assert.deepEqual(actual,[1n,2n,3n]);}finally{statement.finalize()}
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive ORDER BY uses a priority queue',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    const statement=db.prepare('WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x*2 FROM q WHERE x<4 UNION ALL SELECT x*2+1 FROM q WHERE x<4 ORDER BY 1 DESC) SELECT x FROM q').statement;
    const actual=[];try{while(await statement.step()==='row')actual.push(statement.columnInteger(0));assert.deepEqual(actual,[1n,3n,7n,6n,2n,5n,4n]);}finally{statement.finalize()}
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive LIMIT and OFFSET control output and termination',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    const statement=db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c LIMIT 3 OFFSET 2) SELECT x FROM c').statement;
    const actual=[];try{while(await statement.step()==='row')actual.push(statement.columnInteger(0));assert.deepEqual(actual,[3n,4n,5n]);}finally{statement.finalize()}
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive validation reports pinned aggregate diagnostic at prepare',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT max(x) FROM c) SELECT x FROM c'),error=>error?.kind==='sqlite'&&error?.message==='recursive aggregate queries not supported');
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive validation reports pinned window diagnostic at prepare',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('WITH RECURSIVE i(x) AS (VALUES(1) UNION SELECT count(*) OVER () FROM i) SELECT * FROM i'),error=>error?.kind==='sqlite'&&error?.message==='cannot use window functions in recursive queries');
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive validation reports pinned width diagnostic at prepare',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('WITH RECURSIVE i(a,b) AS (VALUES(1) UNION ALL SELECT a+1,b FROM i) SELECT * FROM i'),error=>error?.kind==='sqlite'&&error?.message==='table i has 1 values for 2 columns');
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive validation reports pinned multiple-reference diagnostic',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('WITH RECURSIVE t(x) AS (VALUES(1) UNION ALL SELECT a.x+b.x FROM t a,t b) SELECT * FROM t'),error=>error?.kind==='sqlite'&&error?.message==='multiple references to recursive table: t');
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive validation reports pinned circular diagnostic at prepare',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('WITH RECURSIVE t(x) AS (SELECT x FROM t UNION ALL VALUES(1)) SELECT * FROM t'),error=>error?.kind==='sqlite'&&error?.message==='circular reference: t');
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive validation distinguishes nested second reference',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    assert.throws(()=>db.prepare('WITH RECURSIVE t(x) AS (VALUES(1) UNION ALL SELECT (SELECT x FROM t) FROM t) SELECT * FROM t'),error=>error?.kind==='sqlite'&&error?.message==='multiple recursive references: t');
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public recursive CTE composes with supported outer join consumer',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    const statement=db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<3) SELECT c.x, t.x FROM c JOIN (SELECT 2 AS x) AS t ON c.x=t.x').statement;
    try{assert.equal(await statement.step(),'row');assert.deepEqual([statement.columnInteger(0),statement.columnInteger(1)],[2n,2n]);assert.equal(await statement.step(),'done');}finally{statement.finalize()}
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public multiple recursive declarations compose through a supported cross join',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    const statement=db.prepare(`WITH RECURSIVE
      a(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM a WHERE x<2),
      b(y) AS (VALUES(10) UNION ALL SELECT y+10 FROM b WHERE y<20)
      SELECT x,y FROM a,b ORDER BY x,y`).statement;
    const actual=[];try{while(await statement.step()==='row')actual.push([statement.columnInteger(0),statement.columnInteger(1)]);assert.deepEqual(actual,[[1n,10n],[1n,20n],[2n,10n],[2n,20n]]);}finally{statement.finalize()}
    const reordered=db.prepare(`WITH RECURSIVE
      a(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM a WHERE x<2),
      b(y) AS (VALUES(10) UNION ALL SELECT y+10 FROM b WHERE y<20)
      SELECT x,y FROM a,b ORDER BY y DESC,x`).statement;
    const reorderedRows=[];try{while(await reordered.step()==='row')reorderedRows.push([reordered.columnInteger(0),reordered.columnInteger(1)]);assert.deepEqual(reorderedRows,[[1n,20n],[2n,20n],[1n,10n],[2n,10n]]);}finally{reordered.finalize()}
    await reusable(db);db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} multiple recursive declarations preserve explicit output collation and NULL ordering`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));const {server,db}=await openBytes(body);
  try{
    const statement=db.prepare(`WITH RECURSIVE
      a(x) AS (VALUES('a') UNION ALL SELECT 'B' FROM a WHERE x='a'),
      b(y) AS (VALUES(NULL) UNION ALL SELECT 'z' FROM b WHERE y IS NULL)
      SELECT x,y FROM a,b ORDER BY x COLLATE NOCASE ASC, y COLLATE NOCASE DESC NULLS FIRST`).statement;
    const actual=[];try{while(await statement.step()==='row')actual.push([statement.column(0),statement.column(1)]);assert.deepEqual(actual,[['a',null],['a','z'],['B',null],['B','z']]);}finally{statement.finalize()}
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('recursive queue is iterative and reset/rebind/finalize clean lifecycle state',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    const sql='WITH RECURSIVE c(x) AS (VALUES(?1) UNION ALL SELECT x+1 FROM c WHERE x<?2) SELECT x FROM c';
    const statement=db.prepare(sql).statement;
    try{
      statement.bind(1,1n);statement.bind(2,20000n);let rows=0,last=0n;while(await statement.step()==='row'){rows++;last=statement.columnInteger(0)}assert.equal(rows,20000);assert.equal(last,20000n);
      statement.reset();statement.bind(1,7n);statement.bind(2,9n);const actual=[];while(await statement.step()==='row')actual.push(statement.columnInteger(0));assert.deepEqual(actual,[7n,8n,9n]);
    }finally{statement.finalize()}
    await reusable(db);db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('recursive queue cleans state after work-limit, cancellation, and deadline errors',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  try{
    const sql='WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c) SELECT x FROM c';
    for(const options of [{maxWorkUnits:20},{signal:AbortSignal.abort('test')},{timeoutMs:0}]){
      const statement=db.prepare(sql).statement;try{await assert.rejects(async()=>{for(;;)await statement.step(options)},error=>['limit','cancelled','timeout'].includes(error?.kind));}finally{try{statement.reset()}catch{}statement.finalize()}
      await reusable(db);
    }
    db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('recursive queue, history, and output obey row and shared private-state limits',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));
  const cases=[
    [{maxRows:1},'WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<3) SELECT x FROM c','statement exceeds maxRows'],
    [{maxPrivateEntries:0},'WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<3) SELECT x FROM c','recursive queue exceeds entry limit'],
    [{maxPrivateKeyBytes:0},'WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<3) SELECT x FROM c','recursive queue row exceeds byte limit'],
    [{maxPrivateBytes:0},'WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<3) SELECT x FROM c','recursive queue exceeds total byte limit'],
    // UNION owns both the work queue and its all-history ephemeral index. With
    // a two-entry ceiling, the third distinct value fails in history insertion.
    [{maxPrivateEntries:2},'WITH RECURSIVE c(x) AS (VALUES(1) UNION SELECT x+1 FROM c WHERE x<3) SELECT x FROM c','ephemeral index exceeds entry limit'],
    [{maxPrivateKeyBytes:0},'WITH RECURSIVE c(x) AS (VALUES(1) UNION SELECT x+1 FROM c WHERE x<3) SELECT x FROM c','ephemeral key exceeds byte limit'],
  ];
  for(const [limits,sql,message] of cases){
    const {server,db}=await openBytes(body,{limits:{maxRows:100,maxPrivateEntries:100,maxPrivateKeyBytes:1024,maxPrivateBytes:4096,...limits}});
    let statement;
    try{
      statement=db.prepare(sql).statement;
      await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error?.kind==='limit'&&error?.message===message);
      assert.throws(()=>statement.reset(),error=>error?.kind==='limit'&&error?.message===message);
      statement.finalize();statement=undefined;
      await reusable(db);db.close();
    }finally{try{statement?.finalize()}catch{}try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  }
});

test('recursive execution observes cancellation delivered while VM work is yielded',async()=>{
  const body=fs.readFileSync(path.join(generated,'subquery-utf8.db'));const {server,db}=await openBytes(body);
  const timer=globalThis.setTimeout;let release,reached;
  const suspended=new Promise(resolve=>{reached=resolve});
  globalThis.setTimeout=(callback,ms,...args)=>{
    if(ms===0&&!release){release=()=>timer(callback,0,...args);reached();return 0}
    return timer(callback,ms,...args);
  };
  let statement;
  try{
    statement=db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<20000) SELECT x FROM c').statement;
    const controller=new AbortController();
    const pending=(async()=>{while(await statement.step({signal:controller.signal})==='row'){} })();
    await suspended;
    assert.throws(()=>db.prepare('SELECT 1'),error=>error?.kind==='misuse');
    controller.abort('recursive-yield-stop');release();
    await assert.rejects(pending,error=>error?.kind==='cancelled'&&error?.cause==='recursive-yield-stop');
    assert.throws(()=>statement.reset(),error=>error?.kind==='cancelled'&&error?.cause==='recursive-yield-stop');
    globalThis.setTimeout=timer;release=undefined;
    let rows=0;while(await statement.step()==='row')rows++;assert.equal(rows,20000);
    statement.finalize();statement=undefined;
    await reusable(db);db.close();
  }finally{globalThis.setTimeout=timer;try{release?.()}catch{}try{statement?.finalize()}catch{}try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} recursive matrix preserves typed rows metadata and queue controls`,async()=>{
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));const {server,db}=await openBytes(body);
  try{
    for(const [sql,expected] of [
      ['WITH RECURSIVE c(x) AS (VALUES(1) UNION SELECT x+1 FROM c WHERE x<3 UNION SELECT x FROM c) SELECT x FROM c',[1n,2n,3n]],
      ['WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x*2 FROM q WHERE x<4 UNION ALL SELECT x*2+1 FROM q WHERE x<4 ORDER BY 1 DESC) SELECT x FROM q',[1n,3n,7n,6n,2n,5n,4n]],
      ['WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c LIMIT 3 OFFSET 2) SELECT x FROM c',[3n,4n,5n]]]){
      const statement=db.prepare(sql).statement,actual=[];try{assert.equal(statement.columnMetadata(0).name,'x');while(await statement.step()==='row'){assert.equal(statement.columnType(0),'integer');actual.push(statement.columnInteger(0))}assert.deepEqual(actual,expected)}finally{statement.finalize()}
    }
    assert.throws(()=>db.prepare('WITH RECURSIVE i(x) AS (VALUES(1) UNION SELECT count(*) FROM i) SELECT * FROM i'),error=>error?.kind==='sqlite'&&error?.message==='recursive aggregate queries not supported');
    await reusable(db);db.close();
  }finally{try{db.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
