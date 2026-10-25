import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {EphemeralIndexCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';

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
