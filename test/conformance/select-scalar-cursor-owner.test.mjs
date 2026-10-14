import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// build.c sqlite3SrcListAssignCursors / expr.c sqlite3ExprAnalyzeAggregates:
// producer physical inputs and AggInfo DISTINCT/order state have distinct IDs.
test('scalar derived aggregate-expression allocates inputs before DISTINCT and passes their mapping',()=>{
 const text=fs.readFileSync('src/internal/vdbe.ts','utf8');
 const start=text.indexOf('const producerCursors=new Map(expanded.sources');
 assert.ok(start>=0);
 const end=text.indexOf('compileInnerTableSelect(materialized.select,expanded',start);
 assert.ok(end>start);
 assert.ok(text.slice(start,end).includes('const distinctCursor=aggregate.distinct?selectProgramBuilder.cursor()'));
 assert.ok(text.slice(end,end+400).includes('cursorFor:source=>producerCursors.get(source)!'));
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`scalar DISTINCT retained input cursor ownership ${encoding}`,async()=>{
 const generation=JSON.parse(fs.readFileSync('test/fixtures/CURRENT.json','utf8')).generationId;
 const bytes=fs.readFileSync(`test/fixtures/generations/${generation}/generated/subquery-${encoding}.db`);
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,stmt;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [limit,expected] of [[4,3n],[0,0n],[1,1n]]){
   stmt=db.prepare(`SELECT (SELECT count(DISTINCT d.x) FROM (SELECT x FROM t2 ORDER BY x DESC LIMIT ${limit}) d) AS v`).statement;
   assert.equal(stmt.columnMetadata(0).name,'v');
   for(let iteration=0;iteration<2;iteration++){
    assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),expected);
    assert.equal(await stmt.step(),'done');stmt.reset();
   }
   stmt.finalize();stmt=undefined;
  }
 }finally{try{stmt?.finalize()}finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}}
});
