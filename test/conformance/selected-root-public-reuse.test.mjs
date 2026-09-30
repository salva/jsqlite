import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture, privateAccounting} from './public-api-adapter.mjs';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/in-range-stat-native.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));

for(const variant of capture.variants){
 test(`selected-root failure leaves public connection usable ${variant.encoding}/${variant.state}`,async()=>{
  assert.equal(capture.sourceId,manifest.sqliteSourceId);
  const original=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  assert.equal(createHash('sha256').update(original).digest('hex'),variant.sha256);
  assert.equal(original.readUInt16BE(16),4096);
  const broken=Buffer.from(original);
  broken[4*4096]=0; // t_ab physical root page 5, also used by pinned-native cleanup test.
  const server=http.createServer((_req,response)=>{response.writeHead(200,{'Content-Length':broken.length});response.end(broken)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/broken`));
   const scan=async()=>{
    const st=db.prepare(capture.sql['in-composite-scan']).statement;
    try{
     capture.parameters['in-composite-scan'].forEach((value,i)=>st.bind(i+1,value));
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     assert.deepEqual(rows,variant.cases['in-composite-scan'].rows.map(row=>row.map(decode)));
     assert.equal(privateAccounting(st).indexSeeks,0,'off-path scan does not open corrupt root');
     assert.ok(privateAccounting(st).tableNext>0,'off-path is an actual scan');
    }finally{st.finalize()}
   };
   await scan();
   const selected=db.prepare(capture.sql['in-composite']).statement;
   try{
    capture.parameters['in-composite'].forEach((value,i)=>selected.bind(i+1,value));
    await assert.rejects(selected.step(),e=>e.kind==='sqlite'&&e.code===11,'pinned native first sqlite3_step fails before emitting a row');
   }finally{assert.throws(()=>selected.finalize(),e=>e.kind==='sqlite'&&e.code===11)}
   await scan(); // same connection after finalize must not retain the selected cursor's error.
  }finally{
   try{db?.closeDeferred()}catch{}
   await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
 });
}
