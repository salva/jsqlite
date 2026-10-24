import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

// Local safety companions, not native interrupt timing parity. Observe existing
// budget boundaries, never throw from the probe: VM checkControl owns the error.
function statement(encoding,skip=false){
 return new VdbeStatement({encoding,registers:2,parameters:[],columns:[{name:'x'}],maxWorkUnits:10000,maxResultBytes:1000,
  privateStateLimits:{maxEntries:0,maxKeyBytes:1000,maxBytes:skip?0:1000},ops:[
   {code:'Integer',p1:7n,p2:1},...(skip?[{code:'Goto',p2:3}]:[]),
   {code:'MakeRecord',p1:1,p2:1,p3:2,p4Affinity:['text']},
   {code:'ResultRow',p1:1,p2:1},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
}
function clean(s){
 const a=s.privateAccounting();
 for(const key of ['ownedBytes','scratchBytes','memBytes','recordBytes'])assert.equal(a[key],0,key);
 assert.equal(a.chargedBytes,a.refundedBytes);
}
for(const encoding of ['utf-8','utf-16le','utf-16be'])
for(const mode of ['cancel','deadline'])
for(const phase of ['conversion','record'])
test(`MakeRecord admitted ${phase} ${mode} ${encoding}`,async()=>{
 const survivor=statement(encoding),victim=statement(encoding),skipped=statement(encoding,true);
 const controller=new AbortController(),reason=new Error('admitted MakeRecord cancellation');
 const options=mode==='cancel'?{signal:controller.signal}:{timeoutMs:100};
 const method=phase==='conversion'?'reserveScratch':'reserveRecord';
 const original=PrivateStateByteBudget.prototype[method],now=Date.now;
 let armed=false,hits=0,atFault;
 try{
  assert.equal(await survivor.step(),'row');assert.equal(survivor.column(0),'7');
  const live=survivor.privateAccounting();
  // Controlled monotonic logical clock, no wall-clock sleep or CPU dependency.
  Date.now=()=>armed?1100:1000;
  PrivateStateByteBudget.prototype[method]=function(bytes){
   const result=original.call(this,bytes);
   if(bytes>0){hits++;atFault=this.snapshot();armed=true;if(mode==='cancel')controller.abort(reason)}
   return result;
  };
  // Retained-but-skipped MakeRecord must not admit or trigger this probe.
  assert.equal(await skipped.step(options),'row');assert.equal(skipped.column(0),7n);
  assert.equal(await skipped.step(options),'done');clean(skipped);assert.equal(hits,0);
  let primary;
  await assert.rejects(victim.step(options),e=>{
   primary=e;assert.equal(e.kind,mode==='cancel'?'cancelled':'timeout');
   if(mode==='cancel')assert.equal(e.cause,reason);
   return true;
  });
  assert.equal(hits,1);assert.ok(atFault.scratchBytes>0);
  if(phase==='conversion'){
   assert.equal(atFault.memBytes,0);assert.equal(atFault.recordBytes,0);
   // Affinity ran after admission, then packed-work checkpoint noticed control.
   assert.ok(victim.privateAccounting().memHighwaterBytes>0);
   assert.equal(victim.privateAccounting().recordHighwaterBytes,0);
  }else{assert.ok(atFault.memBytes>0);assert.ok(atFault.recordBytes>0)}
  clean(victim);assert.deepEqual(survivor.privateAccounting(),live);
  await assert.rejects(victim.step(),e=>e===primary);
  assert.throws(()=>victim.reset(),e=>e===primary);clean(victim);
  PrivateStateByteBudget.prototype[method]=original;Date.now=now;
  assert.equal(await victim.step(),'row');assert.equal(victim.column(0),'7');
  victim.reset();clean(victim);
  assert.equal(await victim.step(),'row');assert.equal(await victim.step(),'done');clean(victim);
  assert.deepEqual(survivor.privateAccounting(),live);
  assert.equal(await survivor.step(),'done');clean(survivor);
 }finally{
  PrivateStateByteBudget.prototype[method]=original;Date.now=now;
  // Do not replace a primary assertion failure with a saved statement error.
  for(const s of [victim,skipped,survivor])try{s.finalize()}catch{}
 }
});
