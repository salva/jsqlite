// A physically malformed record header in the stat1 leaf, not a malformed SQL
// stat string. Pinned native ignores unusable statistics; the public loader
// must never use an invented estimate after seeing malformed record bytes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stat-record-corruption.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
for(const v of capture.variants)test(`${v.kind} physically invalid stat1 record header`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../${v.fixture}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 assert.equal(bytes[v.offset],0x7f);
 assert.ok(v.native.forced.rows.length>0);
 assert.ok(v.native.forced.eqp.some(line=>line.includes('INDEX t_a')));
 assert.deepEqual(v.native.forced.rows,v.native.unforced.rows);
 assert.ok(v.native.forced.rows.every(row=>row[0].type==='integer'));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
 let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const sql of Object.values(capture.sql))for(let i=0;i<2;i++)assert.throws(()=>db.prepare(sql),e=>e.name==='SchemaFormatError'&&/sqlite_stat1/.test(String(e)));
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
});
