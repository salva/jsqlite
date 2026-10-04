import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-wr-duplicate-native.json',import.meta.url)));
assert.equal(cap.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const v of cap.variants)test(`WR duplicate column/collation width authority ${v.encoding}`,async()=>{
 const bytes=fs.readFileSync(v.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));const schema=loadSchemaGraph(db),t=schema.tables.get('w'),pk=t.indexes.find(i=>i.origin==='primary-key'),wc=schema.indexes.get('wc');
  assert.deepEqual(pk.terms.map(x=>[x.column.name,x.collation,x.descending]),[['a','NOCASE',true],['b',null,false]]);
  assert.deepEqual(pk.physical.fields.map(f=>f.column.name),['a','b','c']);assert.equal(pk.szIdxRow,sqliteLogEst(278n*4n));assert.deepEqual(pk.rowLogEst,[sqliteLogEst(2n),0,0]);
  assert.deepEqual(wc.physical.primaryKeyFields,[1,2]);assert.deepEqual(wc.physical.fields.map(f=>f.column.name),['c','a','b']);assert.equal(wc.szIdxRow,pk.szIdxRow);
  // wherecode maps the deduplicated physical key ordinals; this query
  // also checks covering secondary record layout, not table lookup credit.
  const st=db.prepare("SELECT a,b FROM w INDEXED BY wc WHERE c=x'ff'").statement;try{for(let run=0;run<2;run++){if(run)st.reset();assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1)],['é',1n]);assert.equal(await st.step(),'done');}}finally{st.finalize()}
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
