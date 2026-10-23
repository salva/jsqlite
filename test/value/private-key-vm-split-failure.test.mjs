import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const control={async checkpoint(){},snapshotCheckpoint(){}};
const packed=n=>Uint8Array.of(2,2,n>>>8,n&255);
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
async function owner(){
 const limits={maxEntries:1000,maxKeyBytes:100,maxBytes:1000000},budget=new PrivateStateByteBudget(limits.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 return {arena,budget,vm:new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info)};
}
function close(o){o.vm.close();o.arena.close();assert.equal(o.budget.usedBytes,0)}
test('each checkpoint of first packed root expansion preserves primary error and independent arena',async t=>{
 // Discover the actual first balance boundary; do not guess a page threshold.
 const witness=await owner();let split=-1;const initialPages=witness.arena.pageCount;
 try{for(let i=0;i<900;i++){
  await witness.vm.insert(packed(i),control);
  if(witness.arena.pageCount>initialPages){split=i;break}
 }}finally{close(witness)}
 assert.ok(split>0);
 let count=0;
 async function attempt(failAt){
  const victim=await owner(),survivor=await owner(),primary=new Error('split checkpoint');
  try{
   await survivor.vm.insert(packed(77),control);
   for(let i=0;i<split;i++)await victim.vm.insert(packed(i),control);
   let calls=0;
   const interrupted={snapshotCheckpoint(){},async checkpoint(){if(++calls===failAt)throw primary}};
   if(failAt){
    victim.vm.cacheStale=false;
    await assert.rejects(victim.vm.insert(packed(split),interrupted),e=>e===primary);
    assert.equal(victim.vm.cacheStale,true);
   }else{await victim.vm.insert(packed(split),interrupted);count=calls;assert.ok(victim.arena.pageCount>initialPages)}
   // Mutating interruption may fault the whole victim arena. It must not
   // propagate that fault to another independently owned execution tree.
   assert.equal(await survivor.vm.first(control),true);
   const out=new Mem();try{await survivor.vm.column(0,out,control);assert.equal(out.integerValue(),77n)}finally{out.release()}
   assert.equal(await survivor.vm.next(control),false);
  }finally{close(victim);close(survivor)}
 }
 await attempt(0);assert.ok(count>1);t.diagnostic(`first expansion record=${split}; checkpoints=${count}`);
 for(let i=1;i<=count;i++)await attempt(i);
});
