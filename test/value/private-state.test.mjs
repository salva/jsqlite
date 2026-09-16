import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
import {EphemeralIndexCursor,PrivateStateByteBudget,PrivateStateLimitError,SorterCursor} from '../../src/internal/private-state.ts';
const m=n=>{const x=new Mem();n===null?x.setNull():x.setInt64(BigInt(n));return x};
const text=value=>{const x=new Mem();x.setText(new TextEncoder().encode(value),'utf-8');return x};
const noopControl={async checkpoint(){}};
test('typed sorter is stable, bounded, and resumable at comparison checkpoints',async()=>{const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),s=new SorterCursor(info,{maxEntries:3,maxKeyBytes:8,maxBytes:48});await s.insert([m(2)],[m(20)],noopControl);await s.insert([m(1)],[m(10)],noopControl);await s.insert([m(1)],[m(11)],noopControl);let checks=0;await s.sort({async checkpoint(){checks++;await Promise.resolve()}});const out=[];for(let ok=s.first();ok;ok=s.next())out.push(s.data()[0].integerValue());assert.deepEqual(out,[10n,11n,20n]);assert.ok(checks>0);await assert.rejects(s.insert([m(4)],[m(4)],noopControl),PrivateStateLimitError);s.close();s.close()});
test('ephemeral index uses Mem equality including NULL and enforces entry limit',async()=>{const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),e=new EphemeralIndexCursor(info,{maxEntries:1,maxKeyBytes:8,maxBytes:8}),control={async checkpoint(){}};await e.insert([m(null)],control);assert.equal(await e.found([m(null)],control),true);await assert.rejects(e.insert([m(1)],control),PrivateStateLimitError);e.close();e.close()});

test('private cursors enforce key and aggregate logical-byte limits atomically',async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const keyBounded=new SorterCursor(info,{maxEntries:1,maxKeyBytes:2,maxBytes:100});
 await assert.rejects(keyBounded.insert([text('abc')],[],noopControl),/sorter key exceeds byte limit/);
 // Rejection consumes neither the sole entry nor its byte budget.
 await keyBounded.insert([text('ab')],[],noopControl);
 await keyBounded.sort({async checkpoint(){}});
 assert.equal(keyBounded.first(),true);
 keyBounded.close();

 const totalBounded=new SorterCursor(info,{maxEntries:1,maxKeyBytes:4,maxBytes:3});
 await assert.rejects(totalBounded.insert([text('ab')],[text('cd')],noopControl),/sorter exceeds total byte limit/);
 await totalBounded.insert([text('ab')],[text('c')],noopControl);
 await totalBounded.sort({async checkpoint(){}});
 assert.equal(totalBounded.first(),true);
 assert.equal(totalBounded.data()[0].textValue(),'c');
 totalBounded.close();

 const ephemeral=new EphemeralIndexCursor(info,{maxEntries:1,maxKeyBytes:4,maxBytes:2});
 await assert.rejects(ephemeral.insert([text('abc')],noopControl),/ephemeral index exceeds total byte limit/);
 await ephemeral.insert([text('ab')],noopControl);
 assert.equal(await ephemeral.found([text('ab')],{async checkpoint(){}}),true);
 ephemeral.close();
});

test('private work accounting charges records, bytes, compared terms, and merge moves exactly',async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const sorter=new SorterCursor(info,{maxEntries:2,maxKeyBytes:32,maxBytes:48});
 const insertCharges=[],insertControl={async checkpoint(units=0){insertCharges.push(units)}};
 await sorter.insert([m(1),m(2)],[m(9)],insertControl);
 await sorter.insert([m(1),m(1)],[m(8)],insertControl);
 assert.deepEqual(insertCharges,[25,0,0,25,0,0]);
 const sortCharges=[];await sorter.sort({async checkpoint(units=0){sortCharges.push(units)}});
 assert.deepEqual(sortCharges,[1,1,1,1],'two KeyInfo terms and two merge moves');sorter.close();
 const ephemeral=new EphemeralIndexCursor(info,{maxEntries:2,maxKeyBytes:32,maxBytes:32});
 const charges=[],control={async checkpoint(units=0){charges.push(units)}};
 await ephemeral.insert([m(1),m(2)],control);assert.deepEqual(charges,[17,0,0]);charges.length=0;
 assert.equal(await ephemeral.found([m(1),m(3)],control),false);assert.deepEqual(charges,[1,1]);ephemeral.close();
});

test('private insertion checkpoints bracket growth and roll it back on cancellation',async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 for(const Cursor of [SorterCursor,EphemeralIndexCursor]){
  const cursor=new Cursor(info,{maxEntries:1,maxKeyBytes:8,maxBytes:8});let calls=0;const cancelled=new Error('cancelled after growth');
  await assert.rejects(cursor instanceof SorterCursor?cursor.insert([m(1)],[],{async checkpoint(){if(++calls===3)throw cancelled}}):cursor.insert([m(1)],{async checkpoint(){if(++calls===3)throw cancelled}}),error=>error===cancelled);
  await (cursor instanceof SorterCursor?cursor.insert([m(2)],[],noopControl):cursor.insert([m(2)],noopControl));
  if(cursor instanceof EphemeralIndexCursor)assert.equal(await cursor.found([m(2)],noopControl),true);cursor.close();
 }
});

test('real private comparisons stop exactly at work, cancel, and deadline boundaries',async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const makeSorter=async()=>{const s=new SorterCursor(info,{maxEntries:2,maxKeyBytes:32,maxBytes:32});await s.insert([m(1),m(2)],[],noopControl);await s.insert([m(1),m(1)],[],noopControl);return s};
 for(const [label,error] of [['work',new Error('work limit')],['cancel',new Error('abort')],['deadline',new Error('timeout')]]){
  const sorter=await makeSorter();let units=0;await assert.rejects(sorter.sort({async checkpoint(n=0){units+=n;if(units>1)throw error}}),caught=>caught===error,label);assert.equal(units,2);sorter.close();
 }
});

test('bounded sorter top-N replaces and discards atomically with cancellation rollback',async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const sorter=new SorterCursor(info,{maxEntries:1,maxKeyBytes:8,maxBytes:16});
 await sorter.insertBounded([m(5)],[m(50)],1n,noopControl);
 await sorter.insertBounded([m(6)],[m(60)],1n,noopControl); // discard
 let calls=0;const cancelled=new Error('replacement cancelled');
 await assert.rejects(sorter.insertBounded([m(1)],[m(10)],1n,{async checkpoint(){if(++calls===3)throw cancelled}}),error=>error===cancelled);
 await sorter.sort(noopControl);assert.equal(sorter.first(),true);assert.equal(sorter.data()[0].integerValue(),50n,'rollback retains previous candidate');sorter.close();
 const offset=new SorterCursor(info,{maxEntries:2,maxKeyBytes:8,maxBytes:32});
 for(const n of [5,2,4,1])await offset.insertBounded([m(n)],[m(n)],2n,noopControl);
 await offset.sort(noopControl);const kept=[];for(let ok=offset.first();ok;ok=offset.next())kept.push(offset.data()[0].integerValue());assert.deepEqual(kept,[1n,2n]);offset.close();
});

test('one execution byte budget is atomic across simultaneous cursor kinds',async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),limits={maxEntries:4,maxKeyBytes:16,maxBytes:12},budget=new PrivateStateByteBudget(12);
 const set=new EphemeralIndexCursor(info,limits,budget),sorter=new SorterCursor(info,limits,budget);
 await set.insert([m(1)],noopControl); // 8; each cursor remains individually below 12
 await assert.rejects(sorter.insert([m(2)],[],noopControl),error=>error instanceof PrivateStateLimitError);
 assert.equal(budget.usedBytes,8,'failed aggregate reservation is atomic');
 set.clear();assert.equal(budget.usedBytes,0);await sorter.insert([m(2)],[],noopControl);
 let checks=0;const cancelled=new Error('post-growth');
 set.clear();sorter.close();assert.equal(budget.usedBytes,0);
 await assert.rejects(set.insert([m(3)],{async checkpoint(){if(++checks===3)throw cancelled}}),error=>error===cancelled);
 assert.equal(budget.usedBytes,0,'post-growth rollback releases aggregate reservation');
 await set.insert([m(4)],noopControl);set.close();assert.equal(budget.usedBytes,0);
});
