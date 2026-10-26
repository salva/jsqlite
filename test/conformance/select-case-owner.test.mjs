import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
// Pinned native public capture proc-642c3c056773 (SQLite 3.53.4).
// Outer ELSE absent/present must not be inferred from a nested child's ELSE.
const cases=[
 ['SELECT CASE WHEN 1 THEN CASE WHEN 0 THEN 11 ELSE 22 END END',22n],
 ['SELECT CASE WHEN 0 THEN CASE WHEN 0 THEN 11 ELSE 22 END END',null],
 ['SELECT CASE WHEN 0 THEN CASE WHEN 0 THEN 11 ELSE 22 END ELSE 33 END',33n],
 ['SELECT CASE 1 WHEN 1 THEN CASE 0 WHEN 1 THEN 11 ELSE 22 END END',22n],
 ['SELECT CASE 0 WHEN 1 THEN CASE 0 WHEN 1 THEN 11 ELSE 22 END END',null],
 ['SELECT CASE 0 WHEN 1 THEN CASE 0 WHEN 1 THEN 11 ELSE 22 END ELSE 33 END',33n],
];
test('nested CASE owns optional outer ELSE in searched and simple forms',async()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/column-default-cast-utf-8.db',import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 const failures=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const [sql,expected] of cases){let st;
   try{st=db.prepare(sql).statement;for(let pass=0;pass<2;pass++){
    assert.equal(await st.step(),'row');assert.equal(st.column(0),expected);
    assert.equal(st.columnType(0),expected===null?'null':'integer');
    assert.equal(await st.step(),'done');st.reset();
   }}catch(error){failures.push(`${sql}: ${error.stack}`)}finally{st?.finalize()}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
