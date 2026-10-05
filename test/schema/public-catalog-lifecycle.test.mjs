import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {open} from '../../src/index.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
for (const encoding of ['utf-8','utf-16le','utf-16be']) test(`physical catalog lifecycle ${encoding}`, async () => {
 const fetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(await readFile(new URL(`../fixtures/public-catalog/${encoding}.db`,import.meta.url)));
 let db,s;
 try {
  db=await open('https://catalog.test/lifecycle');
  const graph=loadSchemaGraph(db);
  assert.equal(graph.findTable('SQLITE_SCHEMA'),graph.findTable('sqlite_master'));
  assert.equal(graph.findTable('sqlite_schema').rootPage,1);
  assert.deepEqual(graph.objects.map(x=>x.name),['t','sqlite_autoindex_t_1','ix','v']);
  s=db.prepare('SELECT rowid,name,rootpage,sql FROM main.sqlite_schema WHERE type=? ORDER BY rowid').statement;
  async function rows(){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:4},(_,i)=>s.column(i)));return rows;}
  s.bind(1,'index');const indexes=await rows();assert.equal(indexes.length,2);assert.equal(indexes[0][3],null);
  s.reset();assert.deepEqual(await rows(),indexes);
  s.reset();s.bind(1,'view');const views=await rows();assert.equal(views.length,1);assert.equal(views[0][1],'v');assert.equal(views[0][2],0n);
  s.finalize();s=null;
  assert.equal(loadSchemaGraph(db),graph);
  for(const sql of ['DELETE FROM sqlite_schema','UPDATE sqlite_master SET sql=NULL','PRAGMA writable_schema=ON']) {
   assert.throws(()=>db.prepare(sql),e=>(e.kind==='unsupported'&&e.unsupportedClassification==='permanent')||(e.kind==='sqlite'&&e.code===1&&e.message.includes('syntax error')));
  }
  s=db.prepare('SELECT count(*) FROM sqlite_master').statement;
  assert.equal(await s.step(),'row');assert.equal(s.column(0),4n);
 }finally{s?.finalize();db?.close();globalThis.fetch=fetch;}
});
