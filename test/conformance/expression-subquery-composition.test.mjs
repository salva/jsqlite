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
 }finally{try{s?.finalize();}finally{try{db?.close();}finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}}}
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
 }finally{try{s?.finalize();}finally{try{db?.close();}finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}}}
});

// pragma.c declares eponymous columns before select.c analyzes AggInfo.
// The correlated Filter must feed that same aggregate owner on every outer row.
for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} correlated metadata module feeds grouped AggInfo and resets`,async()=>{
 const server=await serve(encoding);let db,s;try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  s=db.prepare("SELECT p.name,count(*) AS n FROM t1 JOIN pragma_table_info(CASE WHEN t1.a>0 THEN 't1' ELSE 'missing' END) p GROUP BY p.name ORDER BY p.name").statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),[
   {name:'name',declaredType:null,database:'main',table:'pragma_table_info',origin:'name'},
   {name:'n',declaredType:null,database:null,table:null,origin:null}]);
  for(let run=0;run<3;run++){assert.deepEqual(await rows(s),[['a',4n],['b',4n],['c',4n]]);if(run<2)s.reset();}
  s.finalize();s=undefined;await admitted(db);
 }finally{try{s?.finalize();}finally{try{db?.close();}finally{await new Promise(resolve=>server.close(resolve));}}}
});

// select.c:selectInnerLoop excludes EList execution for SRT_Exists, including
// the joined no-SrcItem fallback (ORDER BY selects that lowering route).
for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} joined no-source EXISTS skips values but validates projection`,async()=>{
 const server=await serve(encoding);let db,s;try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  const prefix='SELECT t1.a, EXISTS(',suffix=') FROM t1 JOIN t2 ON x=a';
  const cases=[
   ["SELECT json('bad') ORDER BY 1",[[1n,1n],[1n,1n],[3n,1n]]],
   ["SELECT json('bad') WHERE t1.a=1 ORDER BY 1",[[1n,1n],[1n,1n],[3n,0n]]],
   ["SELECT json('bad') ORDER BY 1 LIMIT 0",[[1n,0n],[1n,0n],[3n,0n]]],
   ["SELECT json('bad') ORDER BY 1 LIMIT 1 OFFSET 1",[[1n,0n],[1n,0n],[3n,0n]]],
   ["SELECT json('bad') UNION ALL SELECT json('bad') LIMIT 1 OFFSET 1",[[1n,1n],[1n,1n],[3n,1n]]],
   ["SELECT json('bad') UNION ALL SELECT json('bad') LIMIT 1 OFFSET 2",[[1n,0n],[1n,0n],[3n,0n]]],
   ["SELECT json('bad') WHERE 0 UNION ALL SELECT json('bad')",[[1n,1n],[1n,1n],[3n,1n]]],
  ];
  for(const [child,expected] of cases){s=db.prepare(prefix+child+suffix).statement;assert.deepEqual(await rows(s),expected);s.reset();assert.deepEqual(await rows(s),expected);s.finalize();s=undefined;}
  assert.throws(()=>db.prepare(prefix+'SELECT missing_column ORDER BY 1 LIMIT 0'+suffix),e=>e.kind==='sqlite'&&/no such column/.test(e.message));
  s=db.prepare("SELECT t1.a,(SELECT json('bad') ORDER BY 1) FROM t1 JOIN t2 ON x=a").statement;
  await assert.rejects(()=>rows(s),e=>e.kind==='sqlite'&&/malformed JSON/.test(e.message));
  try{s.finalize();}catch(e){assert.match(e.message,/malformed JSON/);}s=undefined;await admitted(db);
 }finally{try{s?.finalize();}finally{try{db?.close();}finally{await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}}}
});
