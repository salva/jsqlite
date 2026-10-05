import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';
function cell(s,i){const type=s.columnType(i),v=s.column(i);
 if(type==='null')return {type};if(type==='integer')return {type,value:String(v)};
 if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')}}
 if(type==='text')return {type,utf8Hex:Buffer.from(v).toString('hex')};
 return {type,hex:Buffer.from(v).toString('hex')};
}
function metadata(s){return Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declType:m.declaredType,database:m.database,table:m.table,origin:m.origin}})}
async function rows(s){const out=[];while(await s.step()==='row')out.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));return out}
export function upstreamAssertions(encoding){
 const upstream=JSON.parse(fs.readFileSync(new URL('./cases/repeated-upstream-join8.json',import.meta.url),'utf8'));
 const utf16=JSON.parse(fs.readFileSync(new URL('./cases/repeated-upstream-join8-utf16.json',import.meta.url),'utf8'));
 const upstreamCases=[...upstream.cases.map(c=>({...c,encoding:'utf8',fixture:{path:'repeated-upstream-join8.db',sha256:upstream.fixtureSha256}})),...utf16.cases.map(c=>({...c,fixture:utf16.fixtures[c.encoding]}))];
 test(`upstream adapted assertions ${encoding}`, {concurrency:4}, async t=>{
 // Independent connections allow real VDBE task yields to overlap. Keep the
 // prototype/timer-instrumented controls outside this group and sequential.
 await Promise.all(upstreamCases.filter(c=>c.encoding===encoding).map(c=>t.test(`upstream adapted assertion ${c.encoding}/${c.id}`,async()=>{
  const bytes=fs.readFileSync(new URL(`./fixtures/${c.fixture.path}`,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.fixture.sha256);
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
  try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}}
  finally{db?.closeDeferred();await closeTestServer(server)}
 })));
 });
}
