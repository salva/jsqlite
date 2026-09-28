import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const root=path.resolve('test/fixtures');
const current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8'));
const generated=path.join(root,'generations',current.generationId,'generated');
async function serve(encoding){const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':body.length});r.end(body)});await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));return server;}
async function rows(statement){const out=[];while(await statement.step()==='row')out.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return out;}
async function admitted(db){const s=db.prepare('SELECT 1').statement;try{assert.deepEqual(await rows(s),[[1n]]);}finally{s.finalize();}}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} independent and correlated scalar aggregates keep destinations isolated`,async()=>{
 const server=await serve(encoding);let db,s;try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  s=db.prepare('SELECT a,(SELECT count(*) FROM t2 WHERE x=t1.a),(SELECT max(y) FROM t2 WHERE x=t1.a) FROM t1 WHERE t1.a>=1 ORDER BY a').statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['a','(SELECT count(*) FROM t2 WHERE x=t1.a)','(SELECT max(y) FROM t2 WHERE x=t1.a)']);
  assert.deepEqual(await rows(s),[[1n,2n,12n],[3n,1n,33n],[5n,0n,null],[7n,0n,null]]);s.reset();assert.deepEqual(await rows(s),[[1n,2n,12n],[3n,1n,33n],[5n,0n,null],[7n,0n,null]]);s.finalize();s=undefined;
  s=db.prepare('SELECT a,(SELECT count(*) FROM t2 WHERE x=t1.a)+(SELECT count(*) FROM t2 WHERE x=t1.a) FROM t1 WHERE t1.a=1').statement;
  assert.deepEqual(await rows(s),[[1n,4n]],'qualified outer binding composes across independent aggregate children');s.finalize();s=undefined;await admitted(db);
 }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} aggregate correlated EXISTS honors inner equality join, reset, limits, and cleanup`,async()=>{
 const sql='SELECT count(*) FROM t1 o WHERE EXISTS(SELECT 1 FROM t2 i JOIN t2 j ON j.x=i.x WHERE i.x=o.a)';
 const server=await serve(encoding);let db,s;try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));s=db.prepare(sql).statement;
  assert.deepEqual(s.columnMetadata(0),{name:'count(*)',declaredType:null,database:null,table:null,origin:null});assert.deepEqual(await rows(s),[[2n]]);s.reset();assert.deepEqual(await rows(s),[[2n]]);s.finalize();s=undefined;await admitted(db);
  // The set-probe optimization is valid for SQL equality, not NULL-safe IS.
  // The generic correlated loop must retain the inner NULL that matches o.c.
  s=db.prepare('SELECT count(*) FROM t1 o WHERE EXISTS(SELECT 1 FROM t2 i JOIN t2 j ON j.x=i.x WHERE i.z IS o.c)').statement;
  assert.deepEqual(await rows(s),[[1n]]);s.reset();assert.deepEqual(await rows(s),[[1n]],'NULL-safe IS reruns through the correlated loop');s.finalize();s=undefined;await admitted(db);
  db.closeDeferred();db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxWorkUnits:0}});s=db.prepare(sql).statement;
  await assert.rejects(s.step(),e=>e.kind==='limit'&&e.message==='statement exceeds maxWorkUnits');assert.throws(()=>s.finalize(),e=>e.kind==='limit'&&e.message==='statement exceeds maxWorkUnits');s=undefined;
  assert.doesNotThrow(()=>db.prepare('SELECT 1').statement.finalize(),'first error cleanup restores operation admission even though the connection limit remains');
  db.closeDeferred();db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await admitted(db);
 }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
