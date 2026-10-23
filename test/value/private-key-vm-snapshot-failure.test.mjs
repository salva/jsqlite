import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget,PrivateStateLimitError} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {BorrowLifetime,memFromRawRecord} from '../../src/internal/mem.ts';
import {RawRecordReader} from '../../src/internal/record.ts';
const control={async checkpoint(){},snapshotCheckpoint(){}};
for(const kind of ['blob','text'])test(`${kind}: each large packed input and borrowed seek snapshot rejection refunds on disposal`,async t=>{
 const packed=new Uint8Array(6003);packed.set([3,0xdd,kind==='blob'?0x6c:0x6d]);packed.fill(65,3);
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 let rejectedPageGrowth=false;
 async function run(mode,failAt,asynchronous=false){
  const limits={maxEntries:10,maxKeyBytes:20000,maxBytes:1000000},budget=new PrivateStateByteBudget(limits.maxBytes);
  const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
  const vm=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
  const life=new BorrowLifetime(),value=memFromRawRecord(new RawRecordReader(packed,'utf-8').next(),life);
  let calls=0;const primary=new Error('synchronous snapshot rejected');
  const interrupted={async checkpoint(){if(asynchronous&&++calls===failAt)throw primary},snapshotCheckpoint(){if(!asynchronous&&++calls===failAt)throw primary}};
  try{
   if(mode==='seek')await vm.insert(packed,control);
   const operation=()=>mode==='insert'?vm.insert(packed,interrupted):vm.seekBound([value],'SeekGE',interrupted);
   const pagesBefore=arena.pageCount;
   if(failAt){await assert.rejects(operation(),e=>e===primary);if(asynchronous&&mode==='insert'&&arena.pageCount>pagesBefore)rejectedPageGrowth=true}else await operation();
   // Insert also checkpoints later private snapshots after publication; those
   // failures may fault the arena. Never retry a mutating failed operation.
   assert.equal(value.diagnostic().ownership,'borrowed');
   if(!failAt||mode==='seek'){
    await vm.insert(packed,control);
    assert.equal(await vm.seekBound([value],'SeekGE',control),true);
    assert.equal(await vm.next(control),false);
   }
  }finally{value.release();life.invalidate();vm.close();arena.close()}
  assert.equal(budget.usedBytes,0);return calls;
 }
 for(const asynchronous of [false,true])for(const mode of ['insert','seek']){
  const count=await run(mode,0,asynchronous);assert.ok(count>2);t.diagnostic(`${mode} ${asynchronous?'async':'snapshot'} checkpoints=${count}`);
  for(let i=1;i<=count;i++)await run(mode,i,asynchronous);
 }
 assert.equal(rejectedPageGrowth,true,'at least one rejected insert allocated overflow pages before failure');
});

test('real byte rejection after partial overflow allocation preserves limit error and refunds',async t=>{
 class ObservedBudget extends PrivateStateByteBudget{
  primary=null; failedAt=0;
  reserve(bytes,message){try{super.reserve(bytes,message)}catch(error){this.primary??=error;this.failedAt=this.usedBytes;throw error}}
 }
 const packed=new Uint8Array(6003);packed.set([3,0xdd,0x6c]);packed.fill(65,3);
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 let partial=0,successful=0,rejected=0;
 // Actual aggregate capacity, not a hook throwing a limit-shaped error.
 for(let maxBytes=40000;maxBytes<=100000;maxBytes+=512){
  const budget=new ObservedBudget(maxBytes),limits={maxEntries:10,maxKeyBytes:20000,maxBytes};
  const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
  const vm=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);
  const initial=arena.pageCount;
  try{
   try{await vm.insert(packed,control);successful++}
   catch(error){
    assert.ok(error instanceof PrivateStateLimitError);assert.equal(error,budget.primary);
    assert.ok(budget.failedAt<=maxBytes);assert.ok(budget.usedBytes<=maxBytes);rejected++;
    if(arena.pageCount>initial)partial++;
   }
  }finally{vm.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
 assert.ok(partial>0,'capacity failure must occur after overflow page publication');
 assert.ok(successful>0);assert.ok(rejected>0);
 t.diagnostic(`capacity sweep: ${rejected} rejected, ${partial} after page growth, ${successful} successful`);
});
