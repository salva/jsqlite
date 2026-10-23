import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {PrivateBloomFilter,filterHash} from '../../src/internal/private-bloom.ts';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget,PrivateStateLimitError} from '../../src/internal/private-state.ts';
const control={async checkpoint(){},snapshotCheckpoint(){}};
for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const kind of ['integer','intreal','real'])
test(`cached numeric string hash and packed bound after capacity rejection: ${encoding}/${kind}`,async()=>{
 const limits={maxEntries:10,maxKeyBytes:10000,maxBytes:200000};
 const budget=new PrivateStateByteBudget(limits.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const info=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const cursor=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
 const filter=await PrivateBloomFilter.open(budget,10000,control);
 const build=new Mem(),probe=new Mem(),collision=new Mem();let pressure=0;
 try{
  if(kind==='integer')build.setInt64(1n);
  else if(kind==='intreal')build.setIntReal(1n);
  else build.setDouble(1.5);
  // Native filterHash gives numeric flags priority over cached MEM_Str.
  build.stringify(encoding);probe.copyFrom(build);
  assert.equal(filterHash([build]),1n);
  filter.add([build]);assert.equal(filter.absent([probe]),false);
  collision.setDouble(kind==='real'?1.75:1.5);collision.stringify(encoding);
  assert.equal(filter.absent([collision]),false,'positive bit is not membership');
  const packed=kind==='real'?new Uint8Array(10):new Uint8Array([2,9]);
  if(kind==='real'){packed.set([2,7]);new DataView(packed.buffer).setFloat64(2,1.5,false)}
  await cursor.insert(packed,control);
  assert.equal(await cursor.seekBound([probe],'SeekGE',control),true);
  assert.equal(await cursor.boundJump([probe],'IdxGT',control),false);
  // Consume all remaining aggregate capacity, without changing production
  // limits or injecting an error. boundJump must fail its snapshot admission.
  pressure=limits.maxBytes-budget.usedBytes;budget.reserve(pressure);
  await assert.rejects(cursor.boundJump([probe],'IdxGT',control),PrivateStateLimitError);
  assert.equal(filter.absent([probe]),false,'failed packed scratch cannot erase another owner');
  assert.equal(filterHash([probe]),1n,'error cannot alter cached numeric register flags');
  budget.release(pressure);pressure=0;
  // Primitive explicit reposition after failure, not VM continuation permission.
  assert.equal(await cursor.seekBound([probe],'SeekGE',control),true);
  assert.equal(await cursor.boundJump([probe],'IdxGT',control),false);
  assert.equal(await cursor.seekBound([collision],'SeekGE',control),false,'authoritative packed seek rejects hash collision');
 }finally{
  budget.release(pressure);build.release();probe.release();collision.release();
  filter.close();cursor.close();arena.close();assert.equal(budget.usedBytes,0);
 }
});
