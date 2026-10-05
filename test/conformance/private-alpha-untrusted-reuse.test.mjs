import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
import {closeTestServer} from './close-test-server.mjs';

// Compose untrusted input rejection with independently captured selected-index
// rows on the SAME connection. Native reference owns rows/types/metadata, not
// browser work counters or an arbitrary-SQL termination guarantee.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/candidate-lifecycle-native.json',import.meta.url)));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,pin.sqliteSourceId);
const cell=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex');})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
const parameter=v=>v?.type==='blob'?new Uint8Array(Buffer.from(v.hex,'hex')):typeof v==='number'&&Number.isInteger(v)?BigInt(v):v;
for(const encoding of ['utf8','utf16le','utf16be'])test(`${encoding}: untrusted SQL/file failures leave native indexed query reusable`,async()=>{
 const variant=capture.variants.find(v=>v.encoding===encoding&&v.state==='before');
 assert.ok(variant);
 const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const requests=[];
 const server=http.createServer((q,r)=>{
  requests.push({url:q.url,header:q.headers['x-alpha-review']});
  const body=q.url==='/bad'?Buffer.from('not a SQLite database'):bytes;
  r.writeHead(200,{'Content-Length':body.length});r.end(body);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 let db,st;
 try{
  await assert.rejects(open(new Request(url+'/bad')),e=>e.kind==='sqlite'&&e.code===11);
  await assert.rejects(open(new Request(url+'/good'),{limits:{maxFileBytes:bytes.length-1}}),e=>e.kind==='limit');
  db=await open(new Request(url+'/good'),{fetchOptions:{headers:{'x-alpha-review':'present'}}});
  const oracle=variant.cases.choice,run=oracle.runs[0];
  async function nativeQuery(){
   st=db.prepare(capture.sql.choice).statement;
   try{
    assert.deepEqual(oracle.metadata.map((_,i)=>st.columnMetadata(i)),oracle.metadata);
    run.parameters.forEach((v,i)=>st.bind(i+1,parameter(v)));
    const rows=async()=>{const out=[];while(await st.step()==='row')out.push(oracle.metadata.map((_,i)=>cell(st.column(i))));return out;};
    assert.deepEqual(await rows(),run.rows);st.reset();assert.deepEqual(await rows(),run.resetRows);
   }finally{st.finalize();st=undefined;}
  }
  for(const sql of ["DELETE FROM t", "DROP TABLE t", "ATTACH DATABASE 'https://invalid.example/evil' AS evil", "SELECT load_extension('evil')", "SELECT (", "SELECT id FROM t INDEXED BY missing_index"]){
   assert.throws(()=>db.prepare(sql),`reject ${sql}`);
   await nativeQuery();
  }
  st=db.prepare(capture.sql.choice).statement;
  run.parameters.forEach((v,i)=>st.bind(i+1,parameter(v)));
  let saved;
  await assert.rejects(st.step({maxWorkUnits:1}),e=>{saved=e;return e.kind==='limit';});
  assert.throws(()=>st.reset(),e=>e===saved);
  // reset has reset execution while returning the saved error, vdbeapi.c order.
  const out=[];while(await st.step()==='row')out.push(oracle.metadata.map((_,i)=>cell(st.column(i))));
  assert.deepEqual(out,run.rows);st.finalize();st=undefined;
  await nativeQuery();
  assert.equal(requests.filter(r=>r.url==='/bad').length,1);
  assert.ok(requests.some(r=>r.header==='present'));
  assert.ok(requests.every(r=>r.url==='/bad'||r.url==='/good'),'SQL cannot trigger another acquisition');
 }finally{
  try{st?.finalize();}finally{try{db?.closeDeferred();}finally{await closeTestServer(server);}}
 }
});
