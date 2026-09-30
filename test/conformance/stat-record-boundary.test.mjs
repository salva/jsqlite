import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// analyze.c:analysisLoader accepts a NULL idx as a table row estimate, and
// decodeIntArray tolerates invalid digits. STAT4 needs its sample path in
// where.c:whereRangeScanEst before a stat1-only plan is safe.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stat-record-boundary.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
assert.deepEqual(capture.variants.map(v=>[v.encoding,v.kind]),
 ['utf8','utf16le','utf16be'].flatMap(encoding=>['table-only','malformed-number','stat4-sample'].map(kind=>[encoding,kind])));
async function run(db,sql){const st=db.prepare(sql).statement;try{const rows=[];while(await st.step()==='row')rows.push(st.column(0));return rows}finally{st.finalize()}}
for(const variant of capture.variants){
 test(`${variant.encoding}/${variant.kind}: native typed access and public stat boundary`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
  assert.ok(variant.cases.forced.eqp.some(line=>line.includes('INDEX t_a')));
  assert.deepEqual(variant.cases.forced.rows,variant.cases.unforced.rows);
  assert.ok(variant.cases.forced.rows.length && variant.cases.forced.rows.every(row=>row[0].type==='integer'));
  if(variant.kind==='table-only')assert.deepEqual(variant.nullIndexRows,{type:'integer',value:'1'});
  if(variant.kind==='stat4-sample')assert.deepEqual(variant.samples,{type:'integer',value:'1'});
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   for(const sql of Object.values(capture.sql)){
    if(variant.kind==='table-only'){
     const expected=variant.cases.forced.rows.map(row=>BigInt(row[0].value));
     assert.deepEqual(await run(db,sql),expected);
    }else{
     const pattern=variant.kind==='stat4-sample'?/sqlite_stat4/:/sqlite_stat1/;
     assert.throws(()=>db.prepare(sql),e=>e.name==='SchemaUnsupportedError'&&e.classification==='temporary'&&pattern.test(String(e)));
    }
   }
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
 });
}
