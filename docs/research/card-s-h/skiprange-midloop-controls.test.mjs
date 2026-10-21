import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../../test/conformance/close-test-server.mjs';
import {BtreeDatabase} from '../../../src/internal/btree.ts';

// Test-only seam selection: the native scalar-column copy is reached through
// the real public saved-SQL reprepare. Do not replace probe.check or the VM's
// signal/deadline/error conversion. Stack inspection confines injection to this
// owner rather than relying on an incidental global reservation ordinal.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: public sample-loop interruption cleans up and retries`,async()=>{
 const cap=JSON.parse(fs.readFileSync(new URL('./skiprange-useful/skiprange-native.json',import.meta.url)));
 const v=cap.variants.find(v=>v.encoding===encoding);
 const bytes=fs.readFileSync(new URL('./skiprange-useful/'+v.fixture,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const reserve=BtreeDatabase.prototype.reserveSchemaTemporary,now=Date.now;
 let armed=false,samples=0,live=0,offset=0,fired=0,mode,controller,primary,db,st;
 const reason=new Error('cancel inside third scalar sample');
 BtreeDatabase.prototype.reserveSchemaTemporary=function(size){
  if(!armed)return reserve.call(this,size);
  const scalar=new Error().stack.includes('at stat4Column ');
  if(scalar&&++samples===3){
   assert.ok(live>0,'bound/probe scratch is live at third sample');fired++;
   if(mode==='cancel')controller.abort(reason);
   if(mode==='deadline')offset=2000; // virtual elapsed clock, not a scheduler-yield claim
   if(mode==='limit'){
    try{reserve.call(this,Number.MAX_SAFE_INTEGER)}catch(e){primary=e;throw e}
    assert.fail('schema allowance must reject oversized reservation');
   }
  }
  const release=reserve.call(this,size);live+=size;let active=true;
  return ()=>{assert.ok(active,'reservation released exactly once');active=false;live-=size;release()};
 };
 Date.now=()=>now()+offset;
 const drain=async()=>{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);return rows};
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/f`));
  st=db.prepare('SELECT id,p FROM t WHERE b>? AND c=1').statement;
  st.bind(1,100n);const expected=await drain();
  const canonical=rows=>rows.map(row=>JSON.stringify(row)).sort();
  const native=v.stat4.find(c=>c.id==='unordered-b>100').rows;
  assert.deepEqual(canonical(expected.map(([id,p])=>[{type:'integer',value:String(id)},{type:'text',utf8Hex:Buffer.from(p).toString('hex')}])),canonical(native));
  assert.equal(privateAccounting(st).indexNext,100,'useful selected sample plan');st.reset();
  for(mode of ['cancel','deadline','limit']){
   st.bind(1,100n);controller=new AbortController();samples=0;fired=0;primary=undefined;armed=true;
   let saved;
   try{
    await assert.rejects(st.step({signal:controller.signal,timeoutMs:1000}),e=>{
     saved=e;return e.kind===(mode==='cancel'?'cancelled':mode==='deadline'?'timeout':'limit');
    });
   }finally{armed=false;offset=0}
   assert.equal(fired,1,'injection actually reached third scalar sample');assert.equal(samples,3);
   assert.equal(live,0,'public failure released all tracked probe/bound/sample scratch');
   if(mode==='cancel')assert.equal(saved.cause,reason);
   if(mode==='limit')assert.equal(saved.cause,primary);
   assert.throws(()=>st.reset(),e=>e===saved,'reset reports the original public error');
   const sibling=db.prepare('SELECT 7').statement;
   try{assert.equal(await sibling.step(),'row');assert.equal(sibling.column(0),7n)}finally{sibling.finalize()}
   assert.deepEqual(await drain(),expected,'preserved binding and saved SQL retry');
   assert.equal(privateAccounting(st).indexNext,100);st.reset();
  }
 }finally{
  armed=false;offset=0;Date.now=now;BtreeDatabase.prototype.reserveSchemaTemporary=reserve;
  try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}
  assert.equal(Date.now,now);assert.equal(BtreeDatabase.prototype.reserveSchemaTemporary,reserve);
 }
});
