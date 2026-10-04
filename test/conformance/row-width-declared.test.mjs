import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
const capture=JSON.parse(fs.readFileSync(new URL('./cases/row-width-declared-native.json',import.meta.url)));
assert.equal(capture.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const v of capture.variants)test(`quoted declared width and complete origin metadata ${v.encoding}`,async()=>{
 const bytes=fs.readFileSync(v.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  const t=loadSchemaGraph(db).tables.get('q');
  assert.deepEqual(t.columns.map(c=>c.declaredType),v.metadata.map(m=>m.declaredType));
  // build.c1584 Dequote precedes AffinityType; util.c1303 admits unsigned
  // hex, stops at the first nondigit and leaves initialized zero on overflow.
  assert.deepEqual(t.columns.map(c=>c.szEst),[1,65,255,1,5,1,251,5,1]);
  assert.equal(t.szTabRow,sqliteLogEst(585n*4n));
  assert.equal(t.indexes[0].szIdxRow,sqliteLogEst(66n*4n));
  assert.ok(Object.isFrozen(t)&&Object.isFrozen(t.indexes[0]));
  const st=db.prepare('SELECT * FROM q').statement;
  try{
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),v.metadata);
   const expected=[1n,'é',Uint8Array.of(255,0),'A','B','C',Uint8Array.of(0),Uint8Array.of(1),'D'];
   for(let run=0;run<2;run++){if(run)st.reset();assert.equal(await st.step(),'row');assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.column(i)),expected);assert.equal(await st.step(),'done');}
  }finally{st.finalize()}
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
