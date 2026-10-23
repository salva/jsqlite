import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo,UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const control={async checkpoint(){}};
// vdbe.c SeekGE/GT/LE/LT default_rc and step correction, Idx bound polarity.
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`${encoding}: packed duplicate-prefix edges and exact membership remain separate`,async()=>{
 const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},budget=new PrivateStateByteBudget(limits.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const info=new KeyInfo({encoding,totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const vm=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
 const key=new Mem();key.setInt64(2n);const out=new Mem();
 try{
  for(const op of ['SeekGE','SeekGT','SeekLE','SeekLT'])assert.equal(await vm.seekBound([key],op,control),false);
  // Records (1,1), (2,1), (2,2), (3,1). Serial 9 is INTEGER 1.
  for(const bytes of [[3,9,9],[3,1,9,2],[3,1,1,2,2],[3,1,9,3]])await vm.insert(Uint8Array.from(bytes),control);
  for(const [op,a,b] of [['SeekGE',2n,1n],['SeekGT',3n,1n],['SeekLE',2n,2n],['SeekLT',1n,1n]]){
   assert.equal(await vm.seekBound([key],op,control),true);
   await vm.column(0,out,control);assert.equal(out.integerValue(),a);
   await vm.column(1,out,control);assert.equal(out.integerValue(),b);
  }
  await vm.seekBound([key],'SeekGE',control);
  for(let i=0;i<2;i++){
   assert.equal(await vm.boundJump([key],'IdxGT',control),false);
   assert.equal(await vm.boundJump([key],'IdxGE',control),true);
   assert.equal(await vm.boundJump([key],'IdxLT',control),false);
   assert.equal(await vm.boundJump([key],'IdxLE',control),true);
   assert.equal(await vm.next(control),true);
  }
  assert.equal(await vm.boundJump([key],'IdxGT',control),true);
  const exact=new UnpackedRecordKey([key],0,'seek',info,false);
  assert.equal(await vm.seek(exact,control),true);exact.release();
  key.setInt64(4n);assert.equal(await vm.seekBound([key],'SeekGE',control),false);
  key.setInt64(0n);assert.equal(await vm.seekBound([key],'SeekLT',control),false);
 }finally{key.release();out.release();vm.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
