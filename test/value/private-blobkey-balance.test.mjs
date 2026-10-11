import assert from 'node:assert/strict';
import test from 'node:test';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

const control={async checkpoint(){}};
// Manually traced btree.c:8560–8652 BLOBKEY (!leafData) counters.
// Cells stay in native concatenation order; boundary cells are parent dividers.
test('native index partition repairs an empty right sibling, not a half split',async()=>{
 const {partitionBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(1000);
 const plan=await partitionBlobkeyCells(5,i=>4,[5],[30],24,false,budget,control);
 try{assert.deepEqual(plan.counts,[2,5]);assert.deepEqual(plan.bytes,[12,12]);assert.ok(budget.usedBytes>0)}finally{plan.release()}
 assert.equal(budget.usedBytes,0);
});
test('native index partition retains unequal divider and two old siblings',async()=>{
 const {partitionBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(1000),sizes=[4,8,4,4,4];
 const plan=await partitionBlobkeyCells(5,i=>sizes[i],[2,5],[16,12],18,false,budget,control);
 try{assert.deepEqual(plan.counts,[2,5]);assert.deepEqual(plan.bytes,[16,12])}finally{plan.release()}
 assert.equal(budget.usedBytes,0);
});
test('native index partition bulk preserves left bias but cannot leave right empty',async()=>{
 const {partitionBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(1000);
 const plan=await partitionBlobkeyCells(5,i=>4,[5],[30],24,true,budget,control);
 try{assert.deepEqual(plan.counts,[3,5]);assert.deepEqual(plan.bytes,[18,6])}finally{plan.release()}
 assert.equal(budget.usedBytes,0);
});
test('partition cancellation refunds pending arrays before publication',async()=>{
 const {partitionBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(1000),error=new Error('partition cancel');
 await assert.rejects(partitionBlobkeyCells(5,i=>4,[5],[30],24,false,budget,{async checkpoint(){throw error}}),e=>e===error);
 assert.equal(budget.usedBytes,0);
});
test('three sibling packing retains two dividers and repairs final empty page',async()=>{
 const {partitionBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(1000);
 const plan=await partitionBlobkeyCells(8,i=>4,[2,5,8],[12,12,12],18,false,budget,control);
 try{assert.deepEqual(plan.counts,[3,6,8]);assert.deepEqual(plan.bytes,[18,12,6]);assert.equal(plan.counts.at(-1),8)}finally{plan.release();plan.release()}
 assert.equal(budget.usedBytes,0);
});
test('native identity rekey selection swaps numbers without sorting sibling objects',async()=>{
 const {rekeyBlobkeySiblings}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(10000),pages=[{pgno:9,key:1},{pgno:3,key:2},{pgno:7,key:3}],trace=[];
 const prior=await rekeyBlobkeySiblings(pages,async(page,number)=>{trace.push([page.key,number]);page.pgno=number},budget,control);
 assert.deepEqual(prior.oldNumbers,[9,3,7]);assert.deepEqual(pages.map(p=>p.key),[1,2,3]);assert.deepEqual(pages.map(p=>p.pgno),[3,7,9]);
 assert.deepEqual(trace,[[1,262145],[2,9],[1,3],[2,262145],[3,9],[2,7]]);assert.equal(budget.usedBytes,128);prior.release();assert.equal(budget.usedBytes,0);
});
test('rekey callback failure preserves primary and refunds pending identity descriptors',async()=>{
 const {rekeyBlobkeySiblings}=await import('../../src/internal/private-blobkey-balance.ts');
 for(const fail of [1,2,3]){
   const budget=new PrivateStateByteBudget(10000),pages=[{pgno:9},{pgno:3}],error=new Error('rekey '+fail);let calls=0;
   await assert.rejects(rekeyBlobkeySiblings(pages,async(p,n)=>{if(++calls===fail)throw error;p.pgno=n},budget,control),e=>e===error);
   assert.equal(budget.usedBytes,0);assert.equal(calls,fail);
   assert.deepEqual(pages.map(p=>p.pgno),fail===1?[9,3]:fail===2?[262145,3]:[262145,9]);
 }
});
test('native nonroot sibling window selects bulk right edge and surrounding dividers without key sorting',async()=>{
 const {selectBlobkeySiblingWindow}=await import('../../src/internal/private-blobkey-balance.ts');
 for(const [n,index,bulk,first,count] of [[0,0,false,0,1],[1,1,false,0,2],[5,0,false,0,3],[5,3,false,2,3],[5,5,false,3,3],[5,5,true,4,2],[5,3,true,2,2]]){
   const trace=[],budget=new PrivateStateByteBudget(10000);
   const r=await selectBlobkeySiblingWindow(n,index,bulk,slot=>{trace.push(slot);return 10+slot},budget,control);
   try{assert.equal(r.first,first);assert.deepEqual(r.pages,Array.from({length:count},(_,i)=>10+first+i));assert.deepEqual(trace,Array.from({length:count},(_,i)=>first+count-1-i))}finally{r.release()}
   assert.equal(budget.usedBytes,0);
 }
});
test('sibling selection cancellation and duplicate pointer errors refund owned result state',async()=>{
 const {selectBlobkeySiblingWindow}=await import('../../src/internal/private-blobkey-balance.ts');const budget=new PrivateStateByteBudget(10000),error=new Error('select cancel');let n=0;
 await assert.rejects(selectBlobkeySiblingWindow(5,3,false,slot=>slot+10,budget,{async checkpoint(){if(++n===2)throw error}}),e=>e===error);assert.equal(budget.usedBytes,0);
 await assert.rejects(selectBlobkeySiblingWindow(5,3,false,()=>10,budget,control),/duplicate/);assert.equal(budget.usedBytes,0);
});
