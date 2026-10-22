import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
const directory=process.env.SELECT_IN_NATIVE_DIR;
assert.ok(directory,'SELECT_IN_NATIVE_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
// wherecode.c codeINTerm / vdbe.c next_tail: movement completes before jump
// publication. Interpose at the real VM cursor, after a selected LHS seek.
for(const variant of capture.variants)test(`${variant.encoding}: SELECT-IN suspended movement and zero-byte cleanup`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=()=>new Request(`http://127.0.0.1:${server.address().port}/fixture`);
 const sql='SELECT id FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs)';
 const expected=variant.cases.useful.rows.map(row=>BigInt(row[0].value)).sort((a,b)=>a<b?-1:a>b?1:0);
 const drain=async s=>{const out=[];while(await s.step()==='row')out.push(s.column(0));return out.sort((a,b)=>a<b?-1:a>b?1:0)};
 let db,limited;
 const original=PrivateKeyVmCursor.prototype.next,now=Date.now;
 try{
  db=await openFixture(request());
  for(const mode of ['cancel','deadline']){
   const st=db.prepare(sql).statement,controller=new AbortController();
   let entered=0,expired=false;
   const reason=new Error('abort during selected RHS movement');
   try{
    PrivateKeyVmCursor.prototype.next=async function(control){
     // Initial NULL RHS is skipped before the first LHS seek; do not
     // misclassify that legitimate native transition as mid-selected work.
     if(privateAccounting(st).indexSeeks===0)return original.call(this,control);
     entered++;
     await new Promise(resolve=>setTimeout(()=>{if(mode==='cancel')controller.abort(reason);else expired=true;resolve()},0));
     return original.call(this,control);
    };
    if(mode==='deadline')Date.now=()=>expired?now()+100000:now();
    let failure;
    try{while(await st.step(mode==='cancel'?{signal:controller.signal}:{timeoutMs:5000})==='row'){}}catch(e){failure=e}
    assert.ok(entered>0,'interruption inside awaited RHS movement, not pre-step');
    assert.equal(failure?.kind,mode==='cancel'?'cancelled':'timeout');
    if(mode==='cancel')assert.equal(failure.cause,reason);
    await assert.rejects(st.step(),e=>e===failure);
    assert.throws(()=>st.reset(),e=>e===failure);
    PrivateKeyVmCursor.prototype.next=original;Date.now=now;
    assert.deepEqual(await drain(st),expected,'reset rebuilds full native rows');
    assert.ok(privateAccounting(st).inProbes>0);
   }finally{PrivateKeyVmCursor.prototype.next=original;Date.now=now;st.finalize()}
  }
  limited=await openFixture(request(),{limits:{maxPrivateBytes:0}});
  const st=limited.prepare(sql).statement;
  let failure;try{await st.step()}catch(e){failure=e}
  assert.equal(failure?.kind,'limit');assert.match(failure.message,/byte limit/);
  assert.equal(privateAccounting(st).indexSeeks,0,'admission fails before LHS seeks');
  await assert.rejects(st.step(),e=>e===failure);
  assert.throws(()=>st.reset(),e=>e===failure);
  await assert.rejects(st.step(),e=>e.kind==='limit');
  assert.throws(()=>st.finalize(),e=>e.kind==='limit');
  const control=limited.prepare('SELECT id FROM t INDEXED BY t_ab WHERE a=1').statement;
  try{assert.ok((await drain(control)).length>0);assert.ok(privateAccounting(control).indexSeeks>0)}finally{control.finalize()}
 }finally{PrivateKeyVmCursor.prototype.next=original;Date.now=now;db?.closeDeferred();limited?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
