import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const control={async checkpoint(){}};
// Enumerate actual checkpoints, not guessed fail positions. Each probe uses a
// fresh owner; the same failed owner is then explicitly reseeked and disposed.
for(const op of ['SeekGE','SeekGT','SeekLE','SeekLT'])test(`${op} every packed prefix checkpoint failure permits explicit reseek and complete disposal`,async()=>{
 let checkpoints=0;
 async function run(failAt){
  const limits={maxEntries:200,maxKeyBytes:10000,maxBytes:1000000},budget=new PrivateStateByteBudget(limits.maxBytes);
  const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
  const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
  const vm=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
  const key=new Mem(),out=new Mem();key.setInt64(2n);
  try{
   // Packed integer prefix2, distinct suffixes, enough records for page edges.
   for(let i=2;i<122;i++)await vm.insert(Uint8Array.from([3,1,1,2,i]),control);
   // Warm prefix positioning before enumerating failures. Retained page/path
   // metadata is charged storage, not necessarily released at seek return.
   await vm.seekBound([key],'SeekGE',control);
   let calls=0;const primary=new Error('packed seek interrupted');
   const interrupted={checkpoint(){if(++calls===failAt)throw primary}};
   if(failAt){await assert.rejects(vm.seekBound([key],op,interrupted),e=>e===primary);
    // Error may leave a different charged page path. Do not mistake retained
    // leases for target scratch; exact comparison is after explicit reseek.
    assert.equal(vm.cacheStale,true);assert.equal(vm.deferredMoveto,false);
   }else{await vm.seekBound([key],op,interrupted);checkpoints=calls;}
   // A failed VM execution normally halts. Primitive recovery is only an
   // explicit fresh seek, never a claim that partially failed state is usable.
   assert.equal(await vm.seekBound([key],'SeekGE',control),true);
   // Materialized page metadata and retained path capacity may grow on a
   // different search. Final close below verifies cumulative refund instead.
   for(let i=2;i<122;i++){
    assert.equal(await vm.boundJump([key],'IdxGT',control),false);
    await vm.column(1,out,control);assert.equal(out.integerValue(),BigInt(i));
    assert.equal(await vm.next(control),i<121);
   }
  }finally{key.release();out.release();vm.close();arena.close()}
  assert.equal(budget.usedBytes,0);
 }
 await run(0);assert.ok(checkpoints>1);
 for(let i=1;i<=checkpoints;i++)await run(i);
});
