import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-invalid-native.json',import.meta.url)));
assert.equal(cap.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const v of cap.variants)test(`stat1 raw invalid callback name does not alias é ${v.encoding}`,async()=>{
 const bytes=fs.readFileSync(v.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));const t=loadSchemaGraph(db).tables.get('é'),ix=t.indexes[0];
  assert.equal(ix.origin,'primary-key');assert.equal(ix.hasStat1,true);assert.deepEqual(ix.rowLogEst,[sqliteLogEst(1000n),sqliteLogEst(2n)]);assert.equal(ix.szIdxRow,sqliteLogEst(8n));assert.equal(ix.unordered,true);assert.equal(t.nRowLogEst,sqliteLogEst(1000n));assert.equal(t.szTabRow,sqliteLogEst(257n*4n));
  const st=db.prepare(v.sql).statement;try{for(let run=0;run<2;run++){if(run)st.reset();assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1)],['é',Uint8Array.of(255)]);assert.equal(await st.step(),'done');assert.ok(privateAccounting(st).indexSeeks>0);}}finally{st.finalize()}
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
