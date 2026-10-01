import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// Pinned pair: select-repeated-view-parent-native.py; select.c tag-select-0486/0488.
test('repeated nonflattenable view producer and independent readers',async()=>{
 const root=path.resolve('test/fixtures'),g=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8')).generationId;
 const bytes=fs.readFileSync(path.join(root,'generations',g,'generated/subquery-utf8.db'));
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [sql,expected] of [['SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1',[[1n,1n],[3n,3n],[5n,5n]]],['SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1 LIMIT 2 OFFSET 1',[[3n,3n],[5n,5n]]],['SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1 LIMIT 0',[]]]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnCount,2);assert.deepEqual([stmt.columnMetadata(0).name,stmt.columnMetadata(1).name],['a','a']);
    for(let cycle=0;cycle<2;cycle++){
     const rows=[];while(await stmt.step()==='row'){assert.deepEqual([stmt.columnType(0),stmt.columnType(1)],['integer','integer']);rows.push([stmt.column(0),stmt.column(1)])}
     assert.deepEqual(rows,expected,sql);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT x.missing FROM v_limited x JOIN v_limited y ON x.a=y.a'),/no such column: x\.missing/);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});
