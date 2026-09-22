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
