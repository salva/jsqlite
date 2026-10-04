import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-wr-collation-native.json',import.meta.url)));
assert.equal(cap.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const v of cap.variants)test(`WR distinct collation noncovering width authority ${v.encoding}`,async()=>{
 const bytes=fs.readFileSync(v.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));const schema=loadSchemaGraph(db),t=schema.tables.get('w'),pk=t.indexes.find(i=>i.origin==='primary-key'),wc=schema.indexes.get('wc');
  assert.deepEqual(pk.terms.map(x=>[x.column.name,x.collation,x.descending]),[['a','NOCASE',true],['b',null,false],['a','BINARY',false]]);
  assert.deepEqual(pk.physical.fields.map(f=>f.column.name),['a','b','a','c','d']);assert.equal(pk.szIdxRow,sqliteLogEst(309n*4n));assert.deepEqual(pk.rowLogEst,[sqliteLogEst(2n),0,0,0]);
  assert.deepEqual(wc.physical.primaryKeyFields,[1,2,3]);assert.deepEqual(wc.physical.fields.map(f=>f.column.name),['c','a','b','a']);assert.equal(wc.szIdxRow,sqliteLogEst(304n*4n));
  for(const sql of ["SELECT a,b,d FROM w INDEXED BY wc WHERE c=x'ff'", "SELECT a,b,d FROM w INDEXED BY wc WHERE c=x'ff' AND d='payload'", "SELECT a,b,d FROM w NOT INDEXED WHERE d='payload'"]){const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){if(run)st.reset();assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1),st.column(2)],v.expected[0].map((x,i)=>i===1?BigInt(x):x));assert.equal(await st.step(),'done');if(sql.includes('INDEXED BY'))assert.ok(privateAccounting(st).tableSeeks>0);}}finally{st.finalize()}}
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
