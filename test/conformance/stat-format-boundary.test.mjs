import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
import {openFixture} from './public-api-adapter.mjs';

// analyze.c:decodeIntArray now publishes sz=/noskipscan on the immutable
// index. Width is consumed by WHERE; noskipscan is retained, not skip-scan credit.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stat-format-boundary.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
assert.deepEqual(capture.variants.map(v=>[v.encoding,v.token]),
 ['utf8','utf16le','utf16be'].flatMap(encoding=>['sz=4096','noskipscan'].map(token=>[encoding,token])));
for(const variant of capture.variants){
 test(`${variant.encoding} ${variant.token} stat1 immutable flags and native typed access`,async()=>{
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
   const index=loadSchemaGraph(db).indexes.get('t_a');
   assert.ok(Object.isFrozen(index));assert.equal(index.hasStat1,true);
   if(variant.token==='sz=4096')assert.equal(index.szIdxRow,sqliteLogEst(4096n));
   else assert.equal(index.noSkipScan,true);
   for(const [name,sql] of Object.entries(capture.sql)){
    const statement=db.prepare(sql).statement;try{const rows=[];while(await statement.step()==='row')rows.push([statement.column(0)]);
     assert.deepEqual(rows,variant.cases[name].rows.map(row=>[BigInt(row[0].value)]));
    }finally{statement.finalize()}
   }
  } finally {
   try{db?.closeDeferred()}catch{}
   await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
 });
}
