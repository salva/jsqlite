import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// analyze.c:decodeIntArray consumes sz=/noskipscan after numeric estimates;
// analysisLoader applies them to the matched index. Until where.c's width and
// skip-scan branches are represented, the public loader must not cost them as
// plain numeric stat1, including for a forced index.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stat-format-boundary.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
assert.deepEqual(capture.variants.map(v=>[v.encoding,v.token]),
 ['utf8','utf16le','utf16be'].flatMap(encoding=>['sz=4096','noskipscan'].map(token=>[encoding,token])));
for(const variant of capture.variants){
 test(`${variant.encoding} ${variant.token} stat1 forced access does not fabricate numeric-only costs`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
  assert.ok(variant.cases.forced.eqp.some(line=>line.includes('INDEX t_a')),'native forced access uses t_a');
  assert.deepEqual(variant.cases.forced.rows,variant.cases.unforced.rows,'native forced/unforced typed rows');
  assert.ok(variant.cases.forced.rows.length>0 && variant.cases.forced.rows.every(row=>row[0].type==='integer'),'native typed rows are preserved');
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try {
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   for(const sql of Object.values(capture.sql))
    assert.throws(()=>db.prepare(sql),error=>error.name==='SchemaUnsupportedError' && error.classification==='temporary' && /sqlite_stat1/.test(String(error)));
  } finally {
   try{db?.closeDeferred()}catch{}
   await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
 });
}
