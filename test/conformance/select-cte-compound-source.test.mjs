import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// Pinned pair select-cte-compound-source-native.py; select.c:multiSelect,
// sqlite3Select; resolve.c:resolveSelectStep.
test('compound arm CTE source identity and destination remain in one statement',async()=>{
 const root=path.resolve('test/fixtures'),g=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8')).generationId;
 const bytes=fs.readFileSync(path.join(root,'generations',g,'generated/subquery-utf8.db'));
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,expected] of [
   ['WITH q(x) AS (VALUES(1)) SELECT x FROM q UNION ALL SELECT 2',[[1n],[2n]]],
   ['WITH q(x) AS MATERIALIZED (VALUES(1)) SELECT x FROM q UNION ALL SELECT 2',[[1n],[2n]]],
   ['WITH q(x) AS NOT MATERIALIZED (VALUES(1)) SELECT x FROM q UNION ALL SELECT x FROM q',[[1n],[1n]]],
  ]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnCount,1);assert.equal(stmt.columnMetadata(0).name,'x');
    for(let cycle=0;cycle<2;cycle++){
     const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push([stmt.column(0)])}
     assert.deepEqual(rows,expected,sql);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  assert.throws(()=>db.prepare('WITH q(x) AS (VALUES(1)) SELECT missing FROM q UNION ALL SELECT 2'),error=>error?.kind==='sqlite'&&error.code===1&&/no such column: missing/.test(error.message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});
