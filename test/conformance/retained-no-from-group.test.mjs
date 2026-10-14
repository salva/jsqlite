import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve('test/fixtures');
const current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8'));
for(const encoding of ['utf8','utf16le','utf16be'])test(`retained no-FROM GROUP ${encoding} destinations and reset`,async()=>{
 const bytes=fs.readFileSync(path.join(root,'generations',current.generationId,`generated/subquery-${encoding}.db`));
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [producer,expected] of [
   ['SELECT 9 AS x GROUP BY 1',1n],['SELECT NULL AS x GROUP BY 1',1n],
   ['SELECT 9 AS x GROUP BY 9+0',1n],['SELECT 9 AS x WHERE 0 GROUP BY 1',0n],
   ['SELECT 9 AS x GROUP BY 1 HAVING x=9',1n],['SELECT 9 AS x GROUP BY 1 HAVING x=8',0n],
   ['SELECT 9 AS x GROUP BY 1 LIMIT 0',0n],['SELECT 9 AS x GROUP BY 1 LIMIT 1 OFFSET 1',0n],
   ["SELECT 'Hi' AS x GROUP BY x HAVING group_concat(x ORDER BY x DESC)='Hi'",1n],
   ['SELECT 9 AS x GROUP BY x HAVING count(*) FILTER (WHERE x=9)=1',1n],
   ['SELECT 9 AS x GROUP BY x HAVING max((x))=9',1n],
  ]){
   const sql=`SELECT (SELECT count(*) FROM (${producer}) d) AS n, EXISTS(SELECT count(*) FROM (${producer}) d) AS hit`;
   const stmt=db.prepare(sql).statement;
   const oracleRoot=process.env.RETAINED_GROUP_ORACLE;
   const oracle=oracleRoot?JSON.parse(fs.readFileSync(path.join(oracleRoot,'native.json'),'utf8')).encodings.find(image=>image.encoding.toLowerCase().replaceAll('-','')===encoding).cases.find(item=>item.sql===sql):null;
   if(oracleRoot)assert.ok(oracle,sql);
   try{
    if(oracle){assert.equal(oracle.prepare,0);assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i)),oracle.metadata);assert.deepEqual(oracle.runs.map(run=>run.rows),Array.from({length:2},()=>[[{type:'integer',value:expected.toString()},{type:'integer',value:'1'}]]));assert.ok(oracle.runs.every(run=>run.end===101));}
    assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i)),['n','hit'].map(name=>({name,declaredType:null,database:null,table:null,origin:null})));
    for(let pass=0;pass<2;pass++){
     assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),expected);
     assert.equal(stmt.columnType(1),'integer');assert.equal(stmt.column(1),1n);assert.equal(await stmt.step(),'done');stmt.reset();
    }
   }finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
