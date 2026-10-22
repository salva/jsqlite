import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

const directory=process.env.SELECT_IN_R1_MATRIX_DIR;
assert.ok(directory,'SELECT_IN_R1_MATRIX_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceid,pin.sqliteSourceId);
assert.equal(capture.version,pin.version);
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString('utf8'):new Uint8Array(Buffer.from(c.hex,'hex'));
// expr.c sqlite3CodeRhsOfIN: EP_VarSelect rebuilds at each invocation.
// Interruption is at the real RHS cursor, not a synthetic pre-step failure.
for(const variant of capture.variants)test(`${variant.encoding}: correlated RHS movement interruption and retry`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 const receipt=variant.cases.find(c=>c.name==='correlated');
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const original=PrivateKeyVmCursor.prototype.next,now=Date.now;
 const reserve=PrivateStateByteBudget.prototype.reserve,budgets=new Set();let peak=0;
 PrivateStateByteBudget.prototype.reserve=function(...args){
  budgets.add(this);const result=reserve.apply(this,args);peak=Math.max(peak,this.usedBytes);return result;
 };
 const refunded=()=>{assert.ok(peak>0,'actual admitted private bytes');for(const b of budgets)assert.equal(b.usedBytes,0,'terminal execution refunds owned private bytes')};
 let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const mode of ['cancel','deadline']){
   const st=db.prepare(receipt.sql).statement,controller=new AbortController();
   const reason=new Error('correlated RHS movement');
   let entered=0,expired=false;
   try{
    PrivateKeyVmCursor.prototype.next=async function(control){
     if(privateAccounting(st).indexSeeks>0){
      entered++;
      await new Promise(resolve=>setTimeout(()=>{if(mode==='cancel')controller.abort(reason);else expired=true;resolve()},0));
     }
     return original.call(this,control);
    };
    if(mode==='deadline')Date.now=()=>expired?now()+100000:now();
    let failure;
    try{while(await st.step(mode==='cancel'?{signal:controller.signal}:{timeoutMs:5000})==='row'){}}catch(e){failure=e}
    assert.ok(entered>0,'fault after selected seek, inside awaited RHS movement');
    assert.equal(failure?.kind,mode==='cancel'?'cancelled':'timeout');
    if(mode==='cancel')assert.equal(failure.cause,reason);
    await assert.rejects(st.step(),e=>e===failure);
    refunded();
    assert.throws(()=>st.reset(),e=>e===failure);
    PrivateKeyVmCursor.prototype.next=original;Date.now=now;
    const rows=[],types=[];
    while(await st.step()==='row'){
     rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)));
    }
    refunded();
    assert.deepEqual(rows,receipt.rows.map(row=>row.map(decode)));
    assert.deepEqual(types,receipt.rows.map(row=>row.map(c=>c.type)));
    assert.ok(privateAccounting(st).indexSeeks>0&&privateAccounting(st).inProbes>0);
   }finally{PrivateKeyVmCursor.prototype.next=original;Date.now=now;st.finalize()}
  }
  // vdbe.c OP_OpenEphemeral reuses/clears a live ephemeral owner. Fault at
  // that distinct per-invocation rebuild boundary after prior selected work.
  const reuse=PrivateKeyVmCursor.prototype.reuse;
  for(const mode of ['cancel','deadline']){
   const st=db.prepare(receipt.sql).statement,controller=new AbortController();
   const reason=new Error('correlated RHS rebuild');let entered=0,expired=false;
   try{
    PrivateKeyVmCursor.prototype.reuse=async function(control){
     if(privateAccounting(st).indexSeeks>0){
      entered++;
      await new Promise(resolve=>setTimeout(()=>{if(mode==='cancel')controller.abort(reason);else expired=true;resolve()},0));
     }
     return reuse.call(this,control);
    };
    if(mode==='deadline')Date.now=()=>expired?now()+100000:now();
    let failure;
    try{while(await st.step(mode==='cancel'?{signal:controller.signal}:{timeoutMs:5000})==='row'){}}catch(e){failure=e}
    assert.ok(entered>0,'reentered live RHS after prior selected seek');
    assert.equal(failure?.kind,mode==='cancel'?'cancelled':'timeout');
    if(mode==='cancel')assert.equal(failure.cause,reason);
    await assert.rejects(st.step(),e=>e===failure);
    refunded();
    assert.throws(()=>st.reset(),e=>e===failure);
    PrivateKeyVmCursor.prototype.reuse=reuse;Date.now=now;
    const rows=[],types=[];
    while(await st.step()==='row'){
     rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)));
    }
    refunded();
    assert.deepEqual(rows,receipt.rows.map(row=>row.map(decode)));
    assert.deepEqual(types,receipt.rows.map(row=>row.map(c=>c.type)));
    assert.ok(privateAccounting(st).indexSeeks>0);
   }finally{PrivateKeyVmCursor.prototype.reuse=reuse;Date.now=now;st.finalize()}
  }
 }finally{PrivateKeyVmCursor.prototype.next=original;Date.now=now;PrivateStateByteBudget.prototype.reserve=reserve;db?.closeDeferred();await new Promise(r=>server.close(r))}
});
