import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem,memToPublicInitial} from '../../src/internal/mem.ts';
const control={async checkpoint(){}};
const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:100000};
test('private Column rejects malformed serial payload before publishing and releases snapshot',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const vm=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
 try{
  // A structurally valid Btree leaf whose record declares eight INTEGER bytes
  // but supplies only two. Install directly: insertion compares valid records.
  const page=new Uint8Array(4096),view=new DataView(page.buffer);
  page[0]=10;view.setUint16(3,1);view.setUint16(5,4090);view.setUint16(8,4090);
  page.set([4,2,6,1,2,0],4090);arena.installPage(2,page);
  assert.equal(await vm.first(control),true);const before=budget.usedBytes;
  await assert.rejects(vm.withColumn(0,control,()=>assert.fail('malformed value cannot publish')),/payload/);
  assert.equal(budget.usedBytes,before);
  await assert.rejects(vm.withColumn(0,control,()=>assert.fail('retry cannot publish')),/payload/);
  assert.equal(budget.usedBytes,before);
 }finally{vm.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`${encoding}: private Column owns callback borrow, typed values, NULL row and retry`,async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const info=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const vm=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
 const output=new Mem();
 try{
  const baseline=budget.usedBytes;
  // NullRow must not touch an unpositioned Btree or checkpoint.
  await vm.withColumn(0,{checkpoint(){throw Error('unreached')}},v=>assert.equal(v.initialStorageClass,'null'));
  assert.equal(budget.usedBytes,baseline);
  const text=encoding==='utf-8'?[0x41]:encoding==='utf-16le'?[0x41,0]:[0,0x41];
  const real=new Uint8Array(8);new DataView(real.buffer).setFloat64(0,1.5);
  const records=[
   {bytes:[2,0],value:null}, {bytes:[2,1,42],value:42n},
   {bytes:[2,7,...real],value:1.5},
   {bytes:[2,13+2*text.length,...text],value:'A'},
   {bytes:[2,16,0,255],value:new Uint8Array([0,255])},
  ];
  for(const {bytes,value} of records){
   await vm.reuse(control);await vm.insert(Uint8Array.from(bytes),control);assert.equal(await vm.first(control),true);
   const before=budget.usedBytes;let retained;
   await vm.withColumn(0,control,async v=>{retained=v;output.copyFrom(v);await Promise.resolve();assert.deepEqual(memToPublicInitial(v),value)});
   assert.deepEqual(memToPublicInitial(output),value);assert.equal(budget.usedBytes,before,'snapshot released after callback');
   assert.equal(retained.initialStorageClass,'null','temporary register is released');
   for(let repeat=0;repeat<100;repeat++)await vm.withColumn(0,control,v=>assert.deepEqual(memToPublicInitial(v),value));
   assert.equal(budget.usedBytes,before,'repeated Column must not accumulate lease capabilities');
   await vm.withColumn(1,control,v=>assert.equal(v.initialStorageClass,'null'));
   const primary=new Error('consumer failure');await assert.rejects(vm.withColumn(0,control,()=>{throw primary}),e=>e===primary);
   assert.equal(budget.usedBytes,before);await vm.withColumn(0,control,v=>assert.deepEqual(memToPublicInitial(v),value));
   const cancelled=new Error('column interrupted');await assert.rejects(vm.withColumn(0,{checkpoint(){throw cancelled}},()=>assert.fail('consumer must not run')),e=>e===cancelled);
   assert.equal(budget.usedBytes,before);await vm.withColumn(0,control,v=>assert.deepEqual(memToPublicInitial(v),value));
   assert.equal(await vm.next(control),false);await vm.withColumn(0,control,v=>assert.equal(v.initialStorageClass,'null'));
   assert.deepEqual(memToPublicInitial(output),value,'published register survives cursor movement');
  }
 }finally{output.release();vm.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
