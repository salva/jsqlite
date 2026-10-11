import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo,UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
import {packRecord} from '../../src/internal/record-pack.ts';
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
const limits={maxEntries:4,maxKeyBytes:100,maxBytes:100000};
const ok={snapshotCheckpoint(){},async checkpoint(){}};
for(const operation of ['seek','insert','reuse'])test(`actual private owner ${operation} interruption retains state and refunds on close`,async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,ok,()=>{},limits);
 const cursor=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),owner=new PrivateKeyVmCursor(arena,cursor,info);
 const value=new Mem();value.setInt64(7n);const packed=packRecord([value],'utf-8');
 await owner.insert(packed,ok);
 const baseline=budget.usedBytes;
 const key=new UnpackedRecordKey([value],0,'seek',info);
 const error=new Error('operation control interruption');let calls=0;
 const stop={snapshotCheckpoint(){calls++;throw error},async checkpoint(){calls++;throw error}};
 owner.nullRow=false;owner.seekResult=1;owner.deferredMoveto=true;
 try{
  await assert.rejects(operation==='seek'?owner.seek(key,stop):operation==='insert'?owner.insert(packed,stop):owner.reuse(stop),e=>e===error);
  assert.ok(calls>0);assert.equal(owner.nullRow,false);assert.equal(owner.seekResult,1);assert.equal(owner.deferredMoveto,true);
  assert.equal(budget.usedBytes,baseline);
 }finally{key.release();owner.close()}
 assert.equal(budget.usedBytes,0);
});

for(const operation of ['seek','insert'])test(`actual ${operation} comparison-stage control and exact peak boundary`,async()=>{
 class MeasuredBudget extends PrivateStateByteBudget{peak=0;reserve(n,message){super.reserve(n,message);this.peak=Math.max(this.peak,this.usedBytes)}}
 const measure=new MeasuredBudget(100000);
 async function execute(budget,interrupt){
  const localLimits={...limits,maxBytes:budget.maxBytes};
  const arena=await PrivateBlobkeyPages.open(budget,ok,()=>{},localLimits);
  const owner=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,localLimits,{owning:true}),info);
  const value=new Mem();value.setInt64(7n);const packed=packRecord([value],'utf-8');
  try{await owner.insert(packed,ok)}catch(error){owner.close();throw error}
  const baseline=budget.usedBytes;value.setInt64(8n);
  const key=new UnpackedRecordKey([value],0,'seek',info);
  let checkpoints=0;const error=new Error('comparison-stage interruption');
  const control={snapshotCheckpoint(){},async checkpoint(){if(++checkpoints===(operation==='seek'?2:3)&&interrupt)throw error}};
  try{
   const operationCall=()=>operation==='seek'?owner.seek(key,control):owner.insert(packRecord([value],'utf-8'),control);
   if(interrupt){await assert.rejects(operationCall(),e=>e===error);assert.equal(checkpoints,operation==='seek'?2:3);assert.equal(budget.usedBytes,baseline)}else await operationCall();
  }finally{key.release();owner.close()}
  assert.equal(budget.usedBytes,0);
 }
 await execute(measure,false);
 assert.ok(measure.peak>0);
 await execute(new PrivateStateByteBudget(measure.peak),false);
 const below=new PrivateStateByteBudget(measure.peak-1);
 await assert.rejects(execute(below,false));assert.equal(below.usedBytes,0);
 await execute(new PrivateStateByteBudget(100000),true);
});
