import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// Paired pinned 3.53.4 select-derived-table-parent-native.py, select.c tag-select-0482.
test('table-backed derived coroutine rows/type/names/limits/reset/error/lifecycle',async()=>{
 const root=path.resolve('test/fixtures'),current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8'));
 const bytes=fs.readFileSync(path.join(root,'generations',current.generationId,'generated/subquery-utf8.db'));
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});res.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,expected] of [['SELECT d.a FROM (SELECT a FROM t1 LIMIT 2 OFFSET 1) d LIMIT 1 OFFSET 1',[5n]],['SELECT * FROM (SELECT a FROM t1 LIMIT 0) d',[]],['SELECT DISTINCT x FROM t2 UNION ALL SELECT 9 ORDER BY 1',[1n,3n,9n,9n]],['SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT DISTINCT x FROM t2 ORDER BY 1',[1n,1n,1n,3n,3n,9n]],['SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT count(*) HAVING NULL ORDER BY 1',[1n,1n,3n]],['SELECT x FROM t2 GROUP BY x HAVING 0 UNION ALL SELECT 9 ORDER BY 1',[9n]],['SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT count(*) HAVING 0 ORDER BY 1',[1n,1n,3n]],['SELECT x FROM t2 GROUP BY x HAVING x>1 UNION ALL SELECT 9 ORDER BY 1',[3n,9n,9n]],['SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT count(*) ORDER BY 1',[1n,1n,1n,3n]],['SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL VALUES (4),(5) UNION ALL SELECT 9 ORDER BY 1',[1n,1n,3n,4n,5n,9n]],['SELECT t2.x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT 9 ORDER BY 1',[1n,1n,3n,9n]],['SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2) d LIMIT 8',[1n,3n,9n,1n,1n,3n,9n]],['SELECT d.x FROM (SELECT x FROM t2 GROUP BY x HAVING x>1 UNION ALL SELECT x FROM t2) d LIMIT 8',[3n,9n,1n,1n,3n,9n]],['SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x) d LIMIT 8',[1n,1n,3n,9n,1n,3n,9n]],['SELECT d.x FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 1 OFFSET 1) d LIMIT 2',[3n]],['SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 0) d LIMIT 2',[]],['SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2 LIMIT 4 OFFSET 2) d LIMIT 3',[9n,1n,1n]],['SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 2) d LIMIT 5',[1n,1n]],['SELECT d.x FROM (SELECT x FROM t2 GROUP BY x HAVING 0 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 1 OFFSET 1) d LIMIT 2',[3n]],['SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 0) d LIMIT 2',[]],['SELECT d.x FROM (SELECT x FROM t2 GROUP BY x HAVING x>1 UNION ALL SELECT x FROM t2 GROUP BY x LIMIT 3 OFFSET 1) d LIMIT 2',[9n,1n]],['SELECT d.x FROM (SELECT DISTINCT x FROM t2 UNION ALL SELECT x FROM t2) d LIMIT 8',[1n,3n,9n,1n,1n,3n,9n]],['SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT DISTINCT x FROM t2 ORDER BY 1) d LIMIT 3 OFFSET 1',[1n,1n,3n]],['SELECT d.x FROM (SELECT count(*) AS x HAVING 0 UNION ALL SELECT count(*) UNION ALL SELECT 9 LIMIT 1 OFFSET 1) d LIMIT 2',[9n]],['SELECT d.x FROM (SELECT count(*) AS x UNION ALL SELECT 9 LIMIT 0) d LIMIT 2',[]],['SELECT d.x FROM (SELECT count(*) AS x HAVING 0 UNION ALL SELECT 2) d LIMIT 2',[2n]],['SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT count(*) HAVING NULL UNION ALL SELECT count(*) HAVING count(*)=1) d LIMIT 3',[2n,1n]],['SELECT d.x FROM (SELECT count(*) AS x UNION ALL SELECT count(*) WHERE 0 UNION ALL SELECT sum(4) LIMIT 1 OFFSET 1) d LIMIT 2',[0n]],['SELECT d.x FROM (SELECT count(*) AS x UNION ALL SELECT count(*) WHERE 0 UNION ALL SELECT sum(4)) d LIMIT 2 OFFSET 1',[0n,4n]],['SELECT d.x FROM (SELECT DISTINCT 1 AS x UNION SELECT DISTINCT 2) d LIMIT 2',[1n,2n]],['SELECT d.x FROM (SELECT DISTINCT 1 AS x UNION ALL SELECT DISTINCT 1 UNION ALL SELECT 2) d LIMIT 3',[1n,1n,2n]],['SELECT d.x FROM (SELECT 2 AS x UNION ALL SELECT DISTINCT 1 ORDER BY 1) d LIMIT 2',[1n,2n]],['SELECT d.x FROM (SELECT 1 AS x INTERSECT SELECT 1 WHERE NULL) d LIMIT 2',[]],['SELECT d.x FROM (SELECT 1 AS x WHERE 0 UNION SELECT 2) d LIMIT 2',[2n]],['SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT 2 WHERE NULL INTERSECT SELECT 1 UNION ALL SELECT 3 WHERE 0) d LIMIT 3',[1n]],['SELECT d.x FROM (SELECT a%3 AS x, count(*) AS n FROM t1 GROUP BY a%3 ORDER BY n, x LIMIT 3) d LIMIT 2 OFFSET 1',[2n,1n]],['SELECT d.x FROM (SELECT 2 AS x UNION SELECT 1 UNION SELECT 3 ORDER BY 1 DESC) d LIMIT 2 OFFSET 1',[2n,1n]],['SELECT d.x FROM (SELECT 6 AS x UNION ALL SELECT 8 INTERSECT SELECT 8 UNION ALL SELECT 9 ORDER BY 1 DESC) d LIMIT 2',[9n,8n]],['SELECT d.x FROM (SELECT 2 AS x, 1 AS y UNION VALUES(2,2),(2,1)) d LIMIT 2',[2n,2n]],['SELECT d.x FROM (SELECT 6 AS x, 1 AS y UNION ALL SELECT 8, 2 INTERSECT VALUES(6,1),(8,2) UNION ALL SELECT 9, 3) d LIMIT 3',[6n,8n,9n]],['SELECT d.x FROM (SELECT 2*3 AS x UNION VALUES(6),(7)) d LIMIT 2',[6n,7n]],['SELECT d.x FROM (SELECT 2*3 AS x UNION ALL SELECT 8 INTERSECT VALUES(6),(8) UNION ALL SELECT 9) d LIMIT 3',[6n,8n,9n]],['SELECT d.x FROM (SELECT 0 AS x UNION ALL VALUES(1),(2)) d LIMIT 2 OFFSET 1',[1n,2n]],['SELECT d.x FROM (SELECT 3 AS x UNION ALL VALUES(1),(2) UNION ALL SELECT 4 ORDER BY 1 LIMIT 3) d LIMIT 2 OFFSET 1',[2n,3n]],['SELECT d.x FROM (SELECT 2 AS x, 4 AS y UNION ALL SELECT 1, 3 ORDER BY 2, 1 LIMIT 2) d LIMIT 1 OFFSET 1',[2n]],['SELECT d.a FROM (SELECT a FROM t1 UNION ALL SELECT a FROM t1) d LIMIT 3 OFFSET 3',[7n,1n,3n]],['SELECT d.a FROM (SELECT a FROM t1 UNION SELECT a FROM t1) d LIMIT 2 OFFSET 1',[3n,5n]],['SELECT d.a FROM (SELECT a FROM t1 EXCEPT SELECT a FROM t1) d LIMIT 2',[]],['SELECT d.x FROM (SELECT DISTINCT a%2 AS x FROM t1) d',[1n]],['SELECT d.n FROM (SELECT count(*) AS n FROM t1 WHERE a>2 LIMIT 1) d',[3n]],['SELECT d.n FROM (SELECT count(*) AS n FROM t1 HAVING count(*)>9 LIMIT 1) d',[]],['SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 ORDER BY x) d',[1n]],['SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 HAVING count(*)>1 ORDER BY x) d',[1n]],['SELECT d.a FROM (SELECT a FROM t1 ORDER BY a LIMIT 2 OFFSET 1) d',[3n,5n]],['SELECT d.a FROM (SELECT a FROM t1 ORDER BY -a LIMIT 2) d',[7n,5n]]]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnCount,1);assert.equal(stmt.columnMetadata(0).name,sql.includes(' AS x')||(sql.startsWith('SELECT d.x')||sql.startsWith('SELECT t2.x')||sql.startsWith('SELECT x FROM')||sql.startsWith('SELECT DISTINCT x'))?'x':sql.includes(' AS n')?'n':'a');
    for(let i=0;i<2;i++){
     const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer',sql);rows.push(stmt.column(0))}
     assert.deepEqual(rows,expected);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  // Ordered grouped compounds still lack their merge producer.
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2 ORDER BY 1) d LIMIT 8'),error=>error.kind==='unsupported'&&error.unsupportedClassification==='temporary');
  for(const [sql,expected] of [
   ["SELECT 'a' COLLATE nocase AS x FROM t1 WHERE a=1 UNION ALL SELECT 'B' ORDER BY 1",['a','B']],
   ["SELECT 'a' AS x FROM t1 WHERE a=1 UNION ALL SELECT 'B' COLLATE nocase ORDER BY 1",['a','B']],
   ["SELECT 'a' COLLATE nocase AS x FROM t1 WHERE a=1 UNION ALL SELECT 'B' ORDER BY 1 COLLATE binary",['B','a']],
  ]){
   const stmt=db.prepare(sql).statement;assert.equal(stmt.columnMetadata(0).name,'x');
   for(let cycle=0;cycle<2;cycle++){const got=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'text');got.push(stmt.column(0));}assert.deepEqual(got,expected);stmt.reset();}stmt.finalize();
  }
  for(const [sql,table,origin] of [['SELECT d.x FROM (SELECT x FROM t2 GROUP BY x UNION ALL SELECT x FROM t2) d LIMIT 8','t2','x'],['SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2 GROUP BY x) d LIMIT 8','t2','x'],['SELECT d.x FROM (SELECT a AS x FROM t1 GROUP BY a UNION ALL SELECT x FROM t2) d LIMIT 8','t2','x'],['SELECT d.x FROM (SELECT a AS x FROM t1 UNION ALL SELECT x AS other FROM t2) d LIMIT 8','t2','x'],['SELECT d.x FROM (SELECT a AS x FROM t1 UNION SELECT x AS other FROM t2) d LIMIT 8','t2','x'],['SELECT a AS x FROM t1 UNION ALL SELECT x AS other FROM t2','t1','a'],['SELECT a AS x FROM t1 UNION SELECT x AS other FROM t2','t1','a']]){
   const statement=db.prepare(sql).statement;
   try{assert.deepEqual(statement.columnMetadata(0),{name:'x',declaredType:'INTEGER',database:'main',table,origin});}finally{statement.finalize();}
  }
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT a FROM t1 LIMIT 2) d'),/no such column/);
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT count(*) AS x HAVING missing UNION ALL SELECT 2) d LIMIT 2'),error=>error.kind==='sqlite'&&error.code===1&&error.message==='no such column: missing');
  const after=db.prepare('SELECT 1').statement;try{assert.equal(await after.step(),'row');assert.equal(after.column(0),1n)}finally{after.finalize()}

 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});

test('ordered compound CAST and unary plus retain column collation but other operators do not',async()=>{
 const bytes=fs.readFileSync('test/fixtures/in-list/orders-utf8.db');
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});res.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [expr,expected] of [['CAST(note AS TEXT)',[null,'Alpha','beta']],['+note',[null,'Alpha','beta']],["note||''",[null,'ALPHA','Alpha','beta']]]){
   const stmt=db.prepare(`SELECT DISTINCT ${expr} AS x FROM orders ORDER BY 1`).statement;
   try{for(let cycle=0;cycle<2;cycle++){const got=[];while(await stmt.step()==='row'){const value=stmt.column(0);assert.equal(stmt.columnType(0),value===null?'null':'text');got.push(value);}assert.deepEqual(got,expected,expr);stmt.reset();}}finally{stmt.finalize();}
  }
  for(const [expr,expected] of [['CAST(note AS TEXT)',[null,'Alpha','beta','Z']],['+note',[null,'Alpha','beta','Z']],["note||''",[null,'ALPHA','Alpha','Z','beta']]]){
   const stmt=db.prepare(`SELECT DISTINCT ${expr} AS x FROM orders UNION ALL SELECT 'Z' ORDER BY 1`).statement;
   try{for(let cycle=0;cycle<2;cycle++){const got=[];while(await stmt.step()==='row'){const value=stmt.column(0);assert.equal(stmt.columnType(0),value===null?'null':'text');got.push(value);}assert.deepEqual(got,expected,expr);stmt.reset();}}finally{stmt.finalize();}
  }
  {
   const stmt=db.prepare("SELECT DISTINCT note AS x FROM orders UNION ALL SELECT 'Z' ORDER BY 1").statement;
   try{for(let cycle=0;cycle<2;cycle++){const got=[];while(await stmt.step()==='row'){const value=stmt.column(0);assert.equal(stmt.columnType(0),value===null?'null':'text');got.push(value);}assert.deepEqual(got,[null,'Alpha','beta','Z']);stmt.reset();}}finally{stmt.finalize();}
  }
  for(const [expr,expected] of [["min(note,'Z')",'beta'],["max(note,'Z')",'Z'],["min(note,'Z' COLLATE binary)",'beta'],["min('Z',note)",'beta'],["min('Z' COLLATE binary,note)",'Z'],["min(note||'','Z')",'Z'],["nullif(note,'BETA')",null]]){
   const stmt=db.prepare(`SELECT ${expr} AS x FROM orders WHERE id=11`).statement;
   try{for(let cycle=0;cycle<2;cycle++){assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),expected===null?'null':'text');assert.equal(stmt.column(0),expected,expr);assert.equal(await stmt.step(),'done');stmt.reset();}}finally{stmt.finalize();}
  }
  for(const [expr,expected] of [["note||'' = 'alpha'",0n],["lower(note) = 'ALPHA'",0n],["CASE WHEN 1 THEN note END = 'alpha'",0n],["CAST(note AS TEXT) = 'alpha'",1n],["+note = 'alpha'",1n],["'alpha' = note",1n],["(note||'') COLLATE nocase = 'alpha'",1n],["min(note,'Z') = 'Alpha'",1n]]){
   const stmt=db.prepare(`SELECT ${expr} AS x FROM orders WHERE id=10`).statement;
   try{for(let cycle=0;cycle<2;cycle++){assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),expected,expr);assert.equal(await stmt.step(),'done');stmt.reset();}}finally{stmt.finalize();}
  }
  for(const [expr,expected] of [['CAST(note AS TEXT)',['a','Alpha']],['+note',['a','Alpha']],["note||''",['Alpha','a']]]){
   const stmt=db.prepare(`SELECT ${expr} AS x FROM orders WHERE id=10 UNION ALL SELECT 'a' ORDER BY 1`).statement;
   try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const got=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'text');got.push(stmt.column(0));}assert.deepEqual(got,expected);stmt.reset();}}finally{stmt.finalize();}
  }
 }finally{if(db)await db.close();await new Promise(resolve=>server.close(resolve));}
});
