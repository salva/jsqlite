import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const here=path.dirname(new URL(import.meta.url).pathname);
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');
const sql=`WITH RECURSIVE cnt(x) AS(
  SELECT 1
  UNION ALL
  SELECT x+1 FROM cnt WHERE x<10
)
SELECT sum(x) FROM cnt`;

async function serve(body){
  const server=http.createServer((_request,response)=>{
    response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});
    response.end(body);
  });
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return server;
}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} aggregates a recursive CTE consumer`,async()=>{
  const server=await serve(fs.readFileSync(path.join(generated,`subquery-${encoding}.db`)));
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    // SQLite prepares this successfully; any failure before step is an error-phase regression.
    statement=db.prepare(sql).statement;
    assert.equal(statement.columnCount,1);
    assert.equal(statement.columnMetadata(0).name,'sum(x)');
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),'integer');
    assert.equal(statement.columnInteger(0),55n);
    assert.equal(await statement.step(),'done');
  }finally{
    try{statement?.finalize()}catch{}
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} source-owned recursive and zero-source aggregate destinations`,async()=>{
 const server=await serve(fs.readFileSync(path.join(generated,`subquery-${encoding}.db`)));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  const cases=[
   ['WITH RECURSIVE c(x) AS (VALUES(?1) UNION ALL SELECT x+1 FROM c WHERE x<?2) SELECT sum(x) FROM c',[1n,4n],10n],
   ['WITH RECURSIVE c(x) AS (VALUES(NULL) UNION ALL SELECT x FROM c LIMIT 1) SELECT sum(x) FROM c',[],null],
   ['SELECT count(*) FROM (VALUES(1),(NULL),(3))',[],3n],
   ['SELECT count(*) FROM (SELECT ?1 UNION ALL SELECT NULL UNION ALL SELECT ?2 LIMIT 1 OFFSET 1)',[4n,5n],1n],
   ['SELECT count(*) FROM (SELECT 3 UNION SELECT 3 UNION SELECT NULL ORDER BY 1)',[],2n],
   ['SELECT count(*) FROM (SELECT 1 UNION ALL SELECT 2 LIMIT 0)',[],0n],
  ];
  for(const [query,values,expected] of cases){
   const statement=db.prepare(query).statement;
   try{for(let pass=0;pass<2;pass++){
    values.forEach((value,index)=>statement.bind(index+1,value));
    assert.equal(await statement.step(),'row',query);assert.equal(statement.column(0),expected,query);
    assert.equal(statement.columnType(0),expected===null?'null':'integer',query);assert.equal(await statement.step(),'done');
    if(!pass)statement.reset();
   }}finally{statement.finalize();}
  }
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} recursive outer destination limits bind and reset independently of body`,async()=>{
 const server=await serve(fs.readFileSync(path.join(generated,`subquery-${encoding}.db`)));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  const stmt=db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<8 LIMIT ?1 OFFSET ?2) SELECT x FROM c LIMIT ?3 OFFSET ?4').statement;
  try{
   for(const [values,expected] of [[[3n,1n,2n,1n],[3n,4n]],[[3n,1n,0n,1n],[]],[[3n,1n,-1n,0n],[2n,3n,4n]]]){
    values.forEach((v,i)=>stmt.bind(i+1,v));const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}
    assert.deepEqual(rows,expected);assert.equal(stmt.columnMetadata(0).name,'x');stmt.reset();
   }
  }finally{stmt.finalize()}
  assert.throws(()=>db.prepare('WITH RECURSIVE c(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM c WHERE x<4) SELECT missing FROM c LIMIT 0'),e=>e.code===1&&e.message==='no such column: missing');
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
