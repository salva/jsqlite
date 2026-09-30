import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// This separate pinned build enables SQLITE_ENABLE_STAT4: ANALYZE supplies real
// sample records; analyze.c:loadStat4 and where.c:whereRangeScanEst may use them.
// JS rejects the sample table before producing a stat1-only plan. Equal EQP or
// row output here does not establish sample-estimate/optimizer parity.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stat4-enabled-boundary.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
assert.deepEqual(capture.variants.map(v=>v.encoding),['utf8','utf16le','utf16be']);
for(const variant of capture.variants){
 test(`${variant.encoding}: native STAT4-enabled ANALYZE samples vs public rejection`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
  assert.equal(variant.kind,'stat4-analyze');
  assert.ok(Number(variant.samples.value)>0,'native ANALYZE generated nonempty samples');
  assert.ok(variant.cases.forced.eqp.some(line=>line.includes('INDEX t_a')));
  assert.deepEqual(variant.cases.forced.rows,variant.cases.unforced.rows,'native typed selected vs forced');
  assert.ok(variant.cases.forced.rows.length>0&&variant.cases.forced.rows.every(r=>r[0].type==='integer'));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   for(const sql of Object.values(capture.sql))for(let attempt=0;attempt<2;attempt++)
    assert.throws(()=>db.prepare(sql),e=>e.name==='SchemaUnsupportedError'&&e.classification==='temporary'&&/sqlite_stat4/.test(String(e)));
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
 });
}
