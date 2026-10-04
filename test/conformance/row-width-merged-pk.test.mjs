import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-merged-pk-native.json',import.meta.url)));
assert.equal(cap.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const v of cap.variants)test(`merged WR primary retains first UNIQUE direction ${v.encoding}`,async()=>{
 const bytes=fs.readFileSync(v.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));const schema=loadSchemaGraph(db),p=schema.tables.get('p'),ix=schema.indexes.get('sqlite_autoindex_p_1');
  assert.equal(ix.origin,'primary-key');assert.equal(ix.rootPage,p.rootPage);assert.equal(ix.terms[0].descending,true);assert.equal(p.primaryKeyTerms[0].descending,true);assert.equal(ix.szIdxRow,sqliteLogEst(282n*4n));assert.ok(Object.isFrozen(ix));

  const st=db.prepare(v.sql).statement;try{for(let run=0;run<2;run++){if(run)st.reset();assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1),st.column(2)],[v.expected[0][0],Uint8Array.from(Buffer.from(v.expected[0][1],'hex')),v.expected[0][2]]);assert.equal(await st.step(),'done');}}finally{st.finalize()}

 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
