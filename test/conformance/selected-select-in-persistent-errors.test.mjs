import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {BtreeDatabase,IndexCursor} from '../../src/internal/btree.ts';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
const directory=process.env.SELECT_IN_REUSE_MATRIX_DIR,brokenDirectory=process.env.SELECT_IN_PERSISTENT_CORRUPTION_DIR;
assert.ok(directory&&brokenDirectory,'matrix and physical corruption directories required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json'))),broken=JSON.parse(fs.readFileSync(path.join(brokenDirectory,'native.json')));
assert.equal(capture.sourceid,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
assert.equal(broken.sourceid,capture.sourceid);
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():new Uint8Array(Buffer.from(c.hex,'hex'));
const drain=async st=>{const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));return rows};
const failure=async st=>{try{await drain(st);assert.fail('expected execution error')}catch(e){assert.ok(e.kind,'public structured error');return e}};
for(const v of capture.variants)test(`${v.encoding}: physical RHS movement control and selected/offpath corruption`,async()=>{
 const b=broken.variants.find(b=>b.encoding===v.encoding),c=v.cases.find(c=>c.name==='mixed-desc');
 let bytes=fs.readFileSync(path.join(directory,v.fixture));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=()=>new Request(`http://127.0.0.1:${server.address().port}/db`);
 const originalOpen=BtreeDatabase.prototype.indexCursor,previous=IndexCursor.prototype.previous,open=PrivateBlobkeyPages.open,now=Date.now;
 const rhs=new WeakSet();let db,st,opens=0;
 BtreeDatabase.prototype.indexCursor=function(root){const cursor=originalOpen.call(this,root);if(root===b.rhsRoot)rhs.add(cursor);return cursor};
 PrivateBlobkeyPages.open=async function(...args){opens++;return open.apply(this,args)};
 try{
  db=await openFixture(request(),{limits:{maxPrivateBytes:0}});
  for(const mode of ['cancel','deadline']){
   st=db.prepare(c.sql).statement;const controller=new AbortController(),reason=new Error('physical RHS movement');let entered=0,expired=false;
   // Physical Btree movement is synchronous. Delegate it unchanged before
   // triggering control. The VM may publish its internal jump but must
   // check control before consuming another opcode or returning another row.
   IndexCursor.prototype.previous=function(){const result=previous.call(this);if(rhs.has(this)&&privateAccounting(st).indexSeeks>0){entered++;if(mode==='cancel')controller.abort(reason);else expired=true}return result};
   if(mode==='deadline')Date.now=()=>expired?now()+100000:now();
   let error;try{while(await st.step(mode==='cancel'?{signal:controller.signal}:{timeoutMs:5000})==='row'){}}catch(e){error=e}
   assert.ok(entered>0,'actual identified physical RHS movement after selected seek');
   assert.equal(error?.kind,mode==='cancel'?'cancelled':'timeout');if(mode==='cancel')assert.equal(error.cause,reason);
   await assert.rejects(st.step(),e=>e===error);assert.throws(()=>st.reset(),e=>e===error);
   IndexCursor.prototype.previous=previous;Date.now=now;
   assert.deepEqual(await drain(st),c.rows.map(r=>r.map(decode)),'reset restarts physical endpoints');
   st.finalize();st=undefined;assert.equal(opens,0,'direct reuse works at zero private-byte quota');
  }
  db.closeDeferred();db=undefined;
  bytes=fs.readFileSync(path.join(brokenDirectory,b.fixture));assert.equal(createHash('sha256').update(bytes).digest('hex'),b.sha256);assert.deepEqual(b.codes,[11,11,11,11]);
  db=await openFixture(request(),{limits:{maxPrivateBytes:0}});
  st=db.prepare(b.offSql).statement;assert.deepEqual(await drain(st),b.offRows.map(r=>r.map(decode)));st.finalize();
  st=db.prepare(b.selectedSql).statement;const error=await failure(st);assert.equal(error.kind,'sqlite');assert.equal(error.code,11);
  assert.equal(await failure(st),error);assert.throws(()=>st.reset(),e=>e===error);
  const retry=await failure(st);assert.equal(retry.code,11);assert.throws(()=>st.finalize(),e=>e===retry);st=undefined;
  // A fresh off-path statement remains usable after the failed owner finishes.
  st=db.prepare(b.offSql).statement;assert.deepEqual(await drain(st),b.offRows.map(r=>r.map(decode)));st.finalize();st=undefined;
  assert.equal(opens,0,'no ephemeral arena accepted on direct physical error path');
 }finally{
  BtreeDatabase.prototype.indexCursor=originalOpen;IndexCursor.prototype.previous=previous;PrivateBlobkeyPages.open=open;Date.now=now;
  try{st?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise(r=>server.close(r));
 }
});
