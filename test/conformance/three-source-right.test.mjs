import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/three-source-native.json',import.meta.url)));
for(const enc of ['utf8','utf16le','utf16be'])for(const empty of [false,true])test(`three-source RIGHT selected ${enc} empty=${empty}`,async()=>{
 const bytes=empty?Buffer.from(native.cases.find(c=>c.encoding===enc&&c.name==='physical-empty').fixtureBase64,'base64'):fs.readFileSync(new URL(`./fixtures/advanced-index-${enc}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const c of native.cases.filter(c=>c.encoding===enc&&(c.name==='physical-empty')===empty)){
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.fixtureSha256);
   const s=db.prepare(c.sql).statement;
   try{assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,database:m.database,table:m.table,origin:m.origin}}),c.columns);for(let run=0;run<2;run++){
    const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.columnType(i)==='null'?{type:'null'}:{type:s.columnType(i),value:String(s.column(i))}));
    assert.deepEqual(rows,c.rows,c.sql);const work=privateAccounting(s);if(c.name.endsWith('-scan')||c.name==='wrong-alias'||c.name==='partial-unproven'||empty)assert.equal(work.indexSeeks,0);else assert.ok(work.indexSeeks>0,c.sql);s.reset();
   }}finally{s.finalize();}
  }
 }finally{db?.closeDeferred();await closeTestServer(server);}
});
