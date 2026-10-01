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
  for(const [sql,expected] of [['SELECT d.a FROM (SELECT a FROM t1 LIMIT 2 OFFSET 1) d LIMIT 1 OFFSET 1',[5n]],['SELECT * FROM (SELECT a FROM t1 LIMIT 0) d',[]],['SELECT d.x FROM (SELECT DISTINCT a%2 AS x FROM t1) d',[1n]],['SELECT d.n FROM (SELECT count(*) AS n FROM t1 WHERE a>2 LIMIT 1) d',[3n]],['SELECT d.n FROM (SELECT count(*) AS n FROM t1 HAVING count(*)>9 LIMIT 1) d',[]],['SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 ORDER BY x) d',[1n]],['SELECT d.x FROM (SELECT a%2 AS x FROM t1 GROUP BY a%2 HAVING count(*)>1 ORDER BY x) d',[1n]],['SELECT d.a FROM (SELECT a FROM t1 ORDER BY a LIMIT 2 OFFSET 1) d',[3n,5n]],['SELECT d.a FROM (SELECT a FROM t1 ORDER BY -a LIMIT 2) d',[7n,5n]]]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnCount,1);assert.equal(stmt.columnMetadata(0).name,sql.includes(' AS x')?'x':sql.includes(' AS n')?'n':'a');
    for(let i=0;i<2;i++){
     const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0))}
     assert.deepEqual(rows,expected);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT a FROM t1 LIMIT 2) d'),/no such column/);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});
