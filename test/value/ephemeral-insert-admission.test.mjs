import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem,BorrowLifetime} from '../../src/internal/mem.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {EphemeralIndexCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';

for(const rejection of ['key','entry','total'])test(`zero-tail rejection ${rejection} never materializes`,async()=>{
 const source=new Mem();source.setBlob(Uint8Array.of(1),{zeroTail:32});
 const limits={maxBytes:rejection==='total'?0:33,maxKeyBytes:rejection==='key'?0:33,maxEntries:rejection==='entry'?0:1};
 const budget=new PrivateStateByteBudget(limits.maxBytes),cursor=new EphemeralIndexCursor(new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),limits,budget);
 const blob=Mem.prototype.blobValue,copy=Mem.prototype.copyFrom;let materialized=0,copies=0;
 Mem.prototype.blobValue=function(){const bytes=blob.call(this);materialized++;return bytes};
 Mem.prototype.copyFrom=function(value){copies++;return copy.call(this,value)};
 try{await assert.rejects(cursor.insert([source],{checkpoint(){}}),e=>e.name==='PrivateStateLimitError');assert.equal(materialized,0);assert.equal(copies,0);assert.equal(cursor.size,0);assert.equal(budget.usedBytes,0)}
 finally{Mem.prototype.blobValue=blob;Mem.prototype.copyFrom=copy;cursor.close();source.release()}
});

// Local admission/cleanup companions to vdbe.c Insert -> BtreeInsert.
// diagnostic().byteLength is already the validated nonmaterializing n+nZero
// observer; sizing must not use the explicit expansion owner blobValue().
for(const ownership of ['owned','borrowed'])for(const cap of [32,33,34])test(`zero-tail copied lifetime ${ownership} cap${cap}`,async()=>{
 const lifetime=new BorrowLifetime(),source=new Mem(),prefix=Uint8Array.of(7);
 source.setBlob(prefix,{zeroTail:32,ownership,...(ownership==='borrowed'?{lifetime}:{})});
 const budget=new PrivateStateByteBudget(cap),cursor=new EphemeralIndexCursor(new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),{maxBytes:cap,maxEntries:1,maxKeyBytes:33},budget);
 const blob=Mem.prototype.blobValue;let productions=0;
 Mem.prototype.blobValue=function(){productions++;assert.equal(budget.usedBytes,33);return blob.call(this)};
 try{
  if(cap<33){await assert.rejects(cursor.insert([source],{checkpoint(){}}));assert.equal(productions,0)}
  else{await cursor.insert([source],{checkpoint(){}});assert.equal(productions,1);assert.equal(budget.usedBytes,33);lifetime.invalidate();source.release();prefix[0]=99;assert.equal(cursor.first(),true);assert.deepEqual(cursor.data()[0].blobValue(),Uint8Array.from({length:33},(_,i)=>i===0?7:0))}
 }finally{Mem.prototype.blobValue=blob;cursor.close();source.release()}
 assert.equal(budget.usedBytes,0);const a=budget.snapshot();assert.equal(a.chargedBytes,a.refundedBytes);
});

test('huge zero-tail demand, invalid lengths and expired borrow never allocate',async()=>{
 const source=new Mem();for(const zeroTail of [-1,Infinity,NaN,1.5,Number.MAX_SAFE_INTEGER])assert.throws(()=>source.setBlob(Uint8Array.of(1),{zeroTail}),e=>e.reason==='invalid-state');
 const budget=new PrivateStateByteBudget(33),cursor=new EphemeralIndexCursor(new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),{maxBytes:33,maxEntries:1,maxKeyBytes:Number.MAX_SAFE_INTEGER},budget);
 const blob=Mem.prototype.blobValue;Mem.prototype.blobValue=function(){assert.fail('unexpected huge/expired expansion')};
 try{
  for(const zeroTail of [2**40,Number.MAX_SAFE_INTEGER-1]){source.setBlob(Uint8Array.of(1),{zeroTail});assert.equal(source.diagnostic().byteLength,zeroTail+1);await assert.rejects(cursor.insert([source],{checkpoint(){}}),e=>e.name==='PrivateStateLimitError');assert.equal(budget.usedBytes,0)}
  const lifetime=new BorrowLifetime();source.setBlob(Uint8Array.of(1),{zeroTail:32,ownership:'borrowed',lifetime});lifetime.invalidate();
  await assert.rejects(cursor.insert([source],{checkpoint(){}}),e=>e.reason==='expired-borrow');assert.equal(budget.usedBytes,0);
 }finally{Mem.prototype.blobValue=blob;cursor.close();source.release()}
});

test('zero-tail partial-copy and checkpoint rollback preserve live duplicate position and sequence',async()=>{
 const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),budget=new PrivateStateByteBudget(100);
 const cursor=new EphemeralIndexCursor(keyInfo,{maxBytes:100,maxEntries:3,maxKeyBytes:66},budget),survivor=new Mem(),a=new Mem(),b=new Mem();
 survivor.setBlob(Uint8Array.of(9));a.setBlob(Uint8Array.of(1),{zeroTail:32});b.setBlob(Uint8Array.of(2),{zeroTail:32});
 await cursor.insert([survivor],{checkpoint(){}},true);const duplicate=cursor.duplicate();assert.equal(duplicate.first(),true);
 const copy=Mem.prototype.copyFrom,release=Mem.prototype.release;let created=[],released=new Set(),failCopy=false;
 Mem.prototype.copyFrom=function(value){created.push(this);copy.call(this,value);if(failCopy&&created.length===2)throw new Error('second copy produced then failed')};
 Mem.prototype.release=function(){released.add(this);return release.call(this)};
 const intact=()=>{assert.equal(cursor.size,1);assert.equal(cursor.newRowid(),2n);assert.equal(duplicate.data()[0].blobValue()[0],9);assert.equal(budget.usedBytes,1);assert.ok(created.every(v=>released.has(v)))};
 try{
  failCopy=true;await assert.rejects(cursor.insert([a,b],{checkpoint(){}}),/second copy/);intact();failCopy=false;
  for(const at of [1,2,3]){created=[];released.clear();let calls=0;const primary=new Error('checkpoint');await assert.rejects(cursor.insert([a],{checkpoint(){if(++calls===at)throw primary}},true),e=>e===primary);intact()}
  await cursor.insert([a],{checkpoint(){}},true);assert.equal(cursor.newRowid(),3n);assert.equal(budget.usedBytes,34);assert.equal(duplicate.data()[0].blobValue()[0],9);
 }finally{Mem.prototype.copyFrom=copy;Mem.prototype.release=release;duplicate.close();cursor.close();survivor.release();a.release();b.release()}
 assert.equal(budget.usedBytes,0);const snapshot=budget.snapshot();assert.equal(snapshot.chargedBytes,snapshot.refundedBytes);
});

// Local admission/cleanup companions to vdbe.c Insert -> BtreeInsert. The
// logical carrier owns detached Mem copies; those are covered by logicalBytes,
// not charged a second time as ordinary VM register backing.
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`ephemeral insertion admits before MemCopy and rolls back ${encoding}`,async()=>{
 const source=new Mem();source.setText(new Uint8Array(encoding==='utf-8'?[97]:encoding==='utf-16le'?[97,0]:[0,97]),encoding);
 const bytes=encoding==='utf-8'?1:2;
 const budget=new PrivateStateByteBudget(bytes),cursor=new EphemeralIndexCursor(new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{}]}),{maxEntries:1,maxKeyBytes:bytes,maxBytes:bytes},budget);
 const original=Mem.prototype.copyFrom;let copies=0,fail=false;
 Mem.prototype.copyFrom=function(value){copies++;assert.equal(budget.usedBytes,bytes);original.call(this,value);if(fail)throw new Error('copy production failed')};
 try{
  // Logical reservation failure must never produce copied backing.
  budget.reserve(bytes);
  const before=budget.snapshot();await assert.rejects(cursor.insert([source],{checkpoint(){}}));
  assert.equal(copies,0);assert.equal(cursor.size,0);assert.deepEqual(budget.snapshot(),{...before,highwaterEntries:1,highwaterKeyBytes:bytes});
  budget.release(bytes);
  fail=true;await assert.rejects(cursor.insert([source],{checkpoint(){}}),/copy production failed/);
  assert.equal(cursor.size,0);assert.equal(budget.usedBytes,0);
  fail=false;
  for(const at of [1,2,3]){
   let calls=0;const primary=new Error('checkpoint rollback');
   await assert.rejects(cursor.insert([source],{checkpoint(){if(++calls===at)throw primary}}),e=>e===primary);
   assert.equal(cursor.size,0);assert.equal(budget.usedBytes,0);
  }
  await cursor.insert([source],{checkpoint(){}});assert.equal(cursor.size,1);assert.equal(budget.usedBytes,bytes);
  source.setNull();assert.equal(cursor.first(),true);assert.equal(cursor.data()[0].textValue(),'a');
  cursor.close();cursor.close();assert.equal(budget.usedBytes,0);
  const a=budget.snapshot();assert.equal(a.chargedBytes,a.refundedBytes);
 }finally{Mem.prototype.copyFrom=original;cursor.close();source.release()}
});
