import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {Mem} from '../../src/internal/mem.ts';
import {packRecord,recordSize} from '../../src/internal/record-pack.ts';
import {decodeRecord} from '../../src/internal/record.ts';
// vdbe.c MakeRecord: IntReal that needs eight bytes switches to serial7.
test('MakeRecord IntReal serial boundary preserves source mutation',()=>{
  for(const [n,type] of [[140737488355327n,5],[140737488355328n,7],[-140737488355328n,5],[-140737488355329n,7]]){
    const value=new Mem();value.setIntReal(n);
    try{const bytes=packRecord([value],'utf-8');assert.equal(bytes[1],type);assert.equal(bytes.length,recordSize([value]));assert.equal(value.diagnostic().numeric,type===7?'real':'int-real')}finally{value.release()}
  }
});
test('MakeRecord integer widths, header fixed point and encoding/zero blob payload',()=>{
  for(const n of [0n,1n,-128n,128n,-32769n,8388608n,2147483648n,140737488355328n,-9223372036854775808n]){
    const value=new Mem();value.setInt64(n);try{assert.equal(decodeRecord(packRecord([value],'utf-8'),'utf-8').values[0].value,n)}finally{value.release()}
  }
  const values=Array.from({length:127},()=>new Mem());
  try{const packed=packRecord(values,'utf-8');assert.deepEqual(Array.from(packed.slice(0,2)),[129,1]);assert.equal(recordSize(values),129)}finally{for(const value of values)value.release()}
  for(const encoding of ['utf-8','utf-16le','utf-16be']){
    const text=new Mem(),blob=new Mem();text.setText(encoding==='utf-8'?new Uint8Array([65]):encoding==='utf-16le'?new Uint8Array([65,0]):new Uint8Array([0,65]),encoding);blob.setBlob(new Uint8Array([255]),{zeroTail:3});
    try{const bytes=packRecord([text,blob],encoding);assert.equal(bytes.length,recordSize([text,blob]));const decoded=decodeRecord(bytes,encoding);assert.equal(decoded.values[0].storageClass,'text');assert.deepEqual(Array.from(decoded.values[1].bytes),[255,0,0,0])}finally{text.release();blob.release()}
  }
});

// Independent category/ordering witness: do not derive expected peak from the
// production predictor or only observe zero after Halt. Hook budget boundaries,
// not a second evaluator, to observe the actual VM path before allocation.
test('MakeRecord keeps source/replacement overlap and all three owners through packing',async()=>{
 const {VdbeStatement}=await import('../../src/internal/vdbe.ts');
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const events=[];
  const original=new Map();
  for(const method of ['reserveMem','releaseMem','reserveScratch','releaseScratch','reserveRecord','releaseRecord']){
   original.set(method,PrivateStateByteBudget.prototype[method]);
   PrivateStateByteBudget.prototype[method]=function(bytes){
    const before=this.snapshot();const result=original.get(method).call(this,bytes);
    events.push({method,bytes,before,after:this.snapshot()});return result;
   };
  }
  const st=new VdbeStatement({encoding,registers:2,parameters:[],columns:[],maxWorkUnits:10000,maxResultBytes:1000,privateStateLimits:{maxEntries:0,maxKeyBytes:1000,maxBytes:1000},ops:[{code:'String',p1:'abc',p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
  try{assert.equal(await st.step(),'done')}finally{st.finalize();for(const [method,fn] of original)PrivateStateByteBudget.prototype[method]=fn}
  const packed=events.find(e=>e.method==='reserveRecord');
  assert.equal(packed.before.memBytes,encoding==='utf-8'?3:6);
  assert.equal(packed.before.scratchBytes,encoding==='utf-8'?0:76);
  assert.equal(packed.after.ownedBytes,encoding==='utf-8'?72:154);
  if(encoding!=='utf-8'){
   const replacement=events.find(e=>e.method==='reserveMem'&&e.bytes===6);
   assert.equal(replacement.before.memBytes,3);assert.equal(replacement.after.memBytes,9);
   const oldRelease=events.find(e=>e.method==='releaseMem'&&e.bytes===3);
   assert.equal(oldRelease.before.memBytes,9);assert.equal(oldRelease.after.memBytes,6);
   const scratchRelease=events.find(e=>e.method==='releaseScratch'&&e.bytes===76);
   assert.equal(scratchRelease.before.recordBytes,72);assert.equal(scratchRelease.before.memBytes,6);
  }
  assert.equal(events.at(-1).after.ownedBytes,0);
 }
});

test('MakeRecord boundary failure reset retains error identity and independent survivor',async()=>{
 const {VdbeStatement}=await import('../../src/internal/vdbe.ts');
 const program=(encoding,maxBytes)=>({encoding,registers:2,parameters:[],columns:[{name:'x'}],maxWorkUnits:10000,maxResultBytes:1000,privateStateLimits:{maxEntries:0,maxKeyBytes:1000,maxBytes},ops:[{code:'String',p1:'abc',p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},{code:'ResultRow',p1:1,p2:1},{code:'Halt'}]});
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const survivor=new VdbeStatement(program(encoding,154),()=>{},()=>()=>{},()=>{});
  const failed=new VdbeStatement(program(encoding,encoding==='utf-8'?71:153),()=>{},()=>()=>{},()=>{});
  try{
   assert.equal(await survivor.step(),'row');const live=survivor.privateAccounting();
   let error;await assert.rejects(failed.step(),e=>{error=e;return e.kind==='limit'});
   assert.equal(failed.privateAccounting().ownedBytes,0);
   assert.throws(()=>failed.reset(),e=>e===error);
   assert.deepEqual(survivor.privateAccounting(),live);
   await assert.rejects(failed.step(),e=>e.kind==='limit');
   assert.equal(failed.privateAccounting().ownedBytes,0);
   survivor.reset();assert.equal(survivor.privateAccounting().ownedBytes,0);
   assert.equal(await survivor.step(),'row');assert.equal(await survivor.step(),'done');
   assert.equal(survivor.privateAccounting().ownedBytes,0);
  }finally{assert.throws(()=>failed.finalize());survivor.finalize()}
 }
});

test('MakeRecord conversion allowance is admitted through packing and refunded on failure',async()=>{
 const {VdbeStatement}=await import('../../src/internal/vdbe.ts');
 for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const maxBytes of [147,148,153,154,155]){
  const st=new VdbeStatement({encoding,registers:2,parameters:[],columns:[],maxWorkUnits:10000,maxResultBytes:1000,privateStateLimits:{maxEntries:4,maxKeyBytes:1000,maxBytes},ops:[{code:'String',p1:'abc',p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
  // Original 147/148 pair remains exercised. It predates ordinary register
  // ownership: UTF16 needs scratch76 + owned Mem6 + record72 = 154, not148.
  // UTF8 has no conversion allowance and needs Mem3 + record69 =72.
  const peak=encoding==='utf-8'?72:154;
  if(maxBytes<peak){let first;try{await st.step();assert.fail('overlap allowance must reject')}catch(error){first=error;assert.equal(error.kind,'limit')};assert.equal(st.privateAccounting().ownedBytes,0);assert.throws(()=>st.finalize(),error=>error===first)}
  else{assert.equal(await st.step(),'done');const done=st.privateAccounting();assert.equal(done.highwaterBytes,peak);assert.equal(done.memHighwaterBytes,encoding==='utf-8'?3:9);assert.equal(done.scratchHighwaterBytes,encoding==='utf-8'?0:76);assert.equal(done.recordHighwaterBytes,encoding==='utf-8'?69:72);assert.equal(done.memBytes,0);assert.equal(done.scratchBytes,0);assert.equal(done.recordBytes,0);assert.equal(done.chargedBytes,done.refundedBytes);st.finalize()}
 }
});
