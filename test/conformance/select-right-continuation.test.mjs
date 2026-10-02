import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';
test('RIGHT unmatched continuation owns downstream selected-index exits',async()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/advanced-index-utf8.db',import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
 for(const [offset,want,limit] of [[0,2n,1],[6,4n,1],[7,5n,1],[8,null,1],[0,null,0]]){
 const stmt=db.prepare(`SELECT (SELECT z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a=y.a AND z.b>=2 LIMIT ${limit} OFFSET ${offset}),1`).statement;
 try{for(let pass=0;pass<2;pass++){const got=[];while(await stmt.step()==='row')got.push([stmt.columnType(0),stmt.column(0),stmt.columnType(1),stmt.column(1)]);
 assert.deepEqual(got,[[want===null?'null':'integer',want,'integer',1n]]);stmt.reset()}}finally{stmt.finalize()}
 }

 for(const [sql,want] of [
 ['SELECT x.id,y.id FROM m x RIGHT JOIN m y ON x.id=y.id AND x.id<3 WHERE y.id IN (1,4,5) ORDER BY y.id',[[1n,1n],[null,4n],[null,5n]]],
 ['SELECT y.id,z.id FROM m x RIGHT JOIN m y ON x.id=-1 LEFT JOIN m z ON z.id=y.id AND z.id<3 WHERE y.id IN (1,4,5) ORDER BY y.id',[[1n,1n],[4n,null],[5n,null]]],
 ['SELECT y.id,z.id FROM m x RIGHT JOIN m y ON x.id=-1 JOIN m z INDEXED BY m_abc ON z.a IN (1,2) AND z.b>=2 WHERE y.id=4 ORDER BY z.id LIMIT 2 OFFSET 1',[[4n,3n],[4n,4n]]],
 ]){
 const stmt=db.prepare(sql).statement;
 try{for(let pass=0;pass<2;pass++){
 const got=[];while(await stmt.step()==='row')got.push([0,1].map(i=>[stmt.columnType(i),stmt.column(i)]));
 assert.deepEqual(got,want.map(row=>row.map(v=>[v===null?'null':'integer',v])));
 assert.equal(await stmt.step(),'done');stmt.reset();
 }}finally{stmt.finalize()}
 }

 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});

test('RIGHT interior is one parent subroutine, not a relocated body',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileInnerTableSelect(');
 const body=source.slice(start,source.indexOf('function sqlName(',start));
 assert.match(body,/code:'BeginSubrtn'/);
 assert.match(body,/code:'Gosub'/);
 assert.match(body,/code:'Return'/);
 assert.doesNotMatch(body,/ops\.slice\(continuationStart,continuationEnd\)|copyStart|delta=copyStart/);
});
