import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../../test/conformance/close-test-server.mjs';
import {BtreeDatabase} from '../../../src/internal/btree.ts';

// Actual saved-SQL recompile of the useful competing-index fixture, not a
// stand-alone probe. Inject only at the existing schema reservation boundary.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: skiprange reprepare reservation frontiers and control failures retry`,async()=>{
 const cap=JSON.parse(fs.readFileSync(new URL('./skiprange-useful/skiprange-native.json',import.meta.url)));
 const fixture=cap.variants.find(v=>v.encoding===encoding).fixture;
 const bytes=fs.readFileSync(new URL('./skiprange-useful/'+fixture,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db,st,armed=false,calls=0,failAt=Infinity,live=0,primary;
 const original=BtreeDatabase.prototype.reserveSchemaTemporary;
 BtreeDatabase.prototype.reserveSchemaTemporary=function(size){
  if(!armed)return original.call(this,size);
  if(++calls===failAt){try{original.call(this,Number.MAX_SAFE_INTEGER)}catch(e){primary=e;throw e}assert.fail('allowance must reject')}
  const release=original.call(this,size);live+=size;
  return ()=>{live-=size;release()};
 };
 const drain=async()=>{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);return rows};
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/f`));
  st=db.prepare('SELECT id,p FROM t WHERE b>? AND c=1').statement;
  assert.equal(st.parameterCount,1);st.bind(1,100n);armed=true;
  const expected=await drain();armed=false;const frontiers=calls;
  assert.ok(frontiers>0);assert.equal(live,0);assert.equal(privateAccounting(st).indexNext,100);st.reset();
  for(let at=1;at<=frontiers;at++){
   st.bind(1,100n);calls=0;failAt=at;armed=true;let saved;
   await assert.rejects(st.step(),e=>{saved=e;return e.kind==='limit'&&e.cause===primary});
   armed=false;assert.equal(live,0);assert.equal(calls,at);
   assert.throws(()=>st.reset(),e=>e===saved);
   const sibling=db.prepare('SELECT 7').statement;
   try{assert.equal(await sibling.step(),'row');assert.equal(sibling.column(0),7n)}finally{sibling.finalize()}
   failAt=Infinity;armed=true;assert.deepEqual(await drain(),expected);armed=false;assert.equal(live,0);st.reset();
  }
  for(const mode of ['work','cancel','deadline']){
   st.bind(1,100n);const controller=new AbortController(),reason=new Error('range abort');controller.abort(reason);
   const options=mode==='work'?{maxWorkUnits:1}:mode==='cancel'?{signal:controller.signal}:{timeoutMs:0};
   let saved;await assert.rejects(st.step(options),e=>{saved=e;return e.kind===(mode==='work'?'limit':mode==='cancel'?'cancelled':'timeout')});
   if(mode==='cancel')assert.equal(saved.cause,reason);
   assert.equal(live,0);assert.throws(()=>st.reset(),e=>e===saved);
   assert.deepEqual(await drain(),expected);st.reset();
  }
  console.log(`${encoding} actual skiprange reprepare reservation frontiers=${frontiers}`);
 }finally{
  armed=false;BtreeDatabase.prototype.reserveSchemaTemporary=original;
  try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}
 }
});
