import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const directory=process.env.CORRELATED_IN_CORRUPTION_DIR;
assert.ok(directory,'CORRELATED_IN_CORRUPTION_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceid,pin.sqliteSourceId);assert.equal(capture.version,pin.version);
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():new Uint8Array(Buffer.from(c.hex,'hex'));
for(const variant of capture.variants)test(`${variant.encoding}: correlated selected root corruption, reset and off-path control`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 const reserve=PrivateStateByteBudget.prototype.reserve,budgets=new Set();let peak=0;
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);const result=reserve.apply(this,args);peak=Math.max(peak,this.usedBytes);return result};
 const refunded=()=>{assert.ok(peak>0);for(const b of budgets)assert.equal(b.usedBytes,0,'halt refunds actual admitted owned bytes')};
 const control=async c=>{
  st=db.prepare(c.control).statement;
  const rows=[],types=[];
  while(await st.step()==='row'){
   rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
   types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)));
  }
  assert.deepEqual(rows,c.rows.map(r=>r.map(decode)),c.name);
  assert.deepEqual(types,c.rows.map(r=>r.map(v=>v.type)),c.name);
  assert.equal(privateAccounting(st).indexSeeks,0,'malformed root is off path');
  refunded();await st.finalize();st=undefined;
 };
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const c of variant.cases){
   await control(c);
   st=db.prepare(c.sql).statement;
   for(const run of c.runs){
    let failure;
    try{while(await st.step()==='row'){}}catch(e){failure=e}
    assert.equal(failure?.kind,'sqlite',c.name);assert.equal(failure.code,run.step,c.name);
    await assert.rejects(st.step(),e=>e===failure,'saved failure is sticky until reset');
    refunded();assert.throws(()=>st.reset(),e=>e===failure);
   }
   await assert.rejects(async()=>{while(await st.step()==='row'){}},e=>e.kind==='sqlite'&&e.code===c.finalize);
   refunded();assert.throws(()=>st.finalize(),e=>e.kind==='sqlite'&&e.code===c.finalize);st=undefined;
   await control(c);
  }
 }finally{PrivateStateByteBudget.prototype.reserve=reserve;try{st?.finalize()}catch{}db?.closeDeferred();await new Promise(r=>server.close(r))}
});
