import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// Pinned pair: select-derived-window-no-where-native.py; select.c tag-select-0488.
test('materialized window-derived producer precedes outer ORDER/LIMIT without WHERE',async()=>{
 const root=path.resolve('test/fixtures'),current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8'));
 const bytes=fs.readFileSync(path.join(root,'generations',current.generationId,'generated/subquery-utf8.db'));
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});res.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,expected] of [['SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.r DESC LIMIT 2 OFFSET 1',[3n,2n]],['SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.r DESC LIMIT 0',[]]]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnCount,1);assert.equal(stmt.columnMetadata(0).name,'r');
    for(let i=0;i<2;i++){
     const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0))}
     assert.deepEqual(rows,expected);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d '),/no such column: d\.missing/);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});
