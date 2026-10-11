import assert from 'node:assert/strict';
import test from 'node:test';
import {PrivateIndexPage} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const control={async checkpoint(){}};
function raw(pgno,leaf,cells,right=0){const b=new Uint8Array(4096);b[0]=leaf?10:2;b[3]=cells.length>>>8;b[4]=cells.length;b[8]=right>>>24;b[9]=right>>>16;b[10]=right>>>8;b[11]=right;let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);const slot=(leaf?8:12)+i*2;b[slot]=top>>>8;b[slot+1]=top});b[5]=top>>>8;b[6]=top;return new PrivateIndexPage(pgno,b)}
test('raw leaf sibling CellArray includes stripped/padded divider in native order',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const left=raw(3,true,[[3,2,1,1]]),right=raw(4,true,[[3,2,1,3]]),budget=new PrivateStateByteBudget(10000);
 const a=await gatherBlobkeyCells([left,right],[Uint8Array.of(0,0,0,3,2,2,9)],budget,control);
 try{assert.deepEqual(a.oldCounts,[1,3]);assert.deepEqual(a.oldBytes,[6,6]);assert.deepEqual(Array.from(a.cells[1]),[2,2,9,0]);assert.equal(a.cells[0].buffer,left.bytes.buffer)}finally{a.release()}
 assert.equal(budget.usedBytes,0);
});
test('raw interior CellArray transfers left sibling right-child into copied divider and retains overflow pointer',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const left=raw(3,false,[[0,0,0,7,3,2,1,1]],88),right=raw(4,false,[[0,0,0,9,3,2,1,3]],99),budget=new PrivateStateByteBudget(10000);
 // Index maxLocal1002; payload1003 -> minLocal489, plus varint2/child4/ovfl4.
 const divider=new Uint8Array(499);divider.set([0,0,0,3,135,107]);divider.set([0,0,0,55],495);
 const a=await gatherBlobkeyCells([left,right],[divider],budget,control);
 try{assert.deepEqual(Array.from(a.cells[1].subarray(0,4)),[0,0,0,88]);assert.deepEqual(Array.from(a.cells[1].subarray(495)),[0,0,0,55]);assert.equal(divider[3],3);assert.deepEqual(a.oldCounts,[1,3])}finally{a.release()}
 assert.equal(budget.usedBytes,0);
});
test('gathered raw sibling counters feed native partition while scratch lifetimes overlap',async()=>{
 const {gatherBlobkeyCells,partitionBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const aPage=raw(3,true,[[3,2,1,1],[3,2,1,2]]),bPage=raw(4,true,[[3,2,1,4],[3,2,1,5]]),budget=new PrivateStateByteBudget(10000);
 const a=await gatherBlobkeyCells([aPage,bPage],[Uint8Array.of(0,0,0,3,3,2,1,3)],budget,control),before=budget.usedBytes;
 const plan=await partitionBlobkeyCells(a.cells.length,i=>a.cells[i].length,a.oldCounts,a.oldBytes,18,false,budget,control);
 try{assert.deepEqual(plan.counts,[2,5]);assert.deepEqual(plan.bytes,[12,12]);assert.ok(budget.usedBytes>before)}finally{plan.release();assert.equal(budget.usedBytes,before);a.release()}
 assert.equal(budget.usedBytes,0);
});
test('CellArray comparison-free checkpoint failure refunds borrowed descriptors and divider scratch',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const p=raw(3,true,[[3,2,1,1]]),budget=new PrivateStateByteBudget(10000),error=new Error('gather');let n=0;
 await assert.rejects(gatherBlobkeyCells([p,p],[Uint8Array.of(0,0,0,3,3,2,1,3)],budget,{async checkpoint(){if(++n===2)throw error}}),e=>e===error);
 assert.equal(budget.usedBytes,0);assert.equal(p.nCell,1);
});
test('CellArray splices adjacent staged cells before resident suffix without consuming entry authority',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(100000);
 //681 four-byte cells consume4086 of4088 bytes, forcing staging.
 const p=raw(3,true,Array.from({length:681},()=>[3,2,1,1]));
 await p.insertCell(2,Uint8Array.of(3,2,1,7),control);
 await p.insertCell(3,Uint8Array.of(3,2,1,8),control);
 const a=await gatherBlobkeyCells([p],[],budget,control);
 try{assert.equal(a.cells.length,683);assert.deepEqual(a.oldCounts,[683]);assert.deepEqual(a.oldBytes,[4098]);assert.equal(a.cells[2][3],7);assert.equal(a.cells[3][3],8);assert.equal(a.cells[4][3],1);assert.equal(p.nOverflow,2)}finally{a.release();p.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('native rebuild fallback protects resident alias bytes and packs cells descending',async()=>{
 const p=raw(3,false,[[0,0,0,7,3,2,1,1],[0,0,0,8,3,2,1,2]],99);
 const cells=[p.bytes.subarray(p.findCell(1),p.findCell(1)+8),p.bytes.subarray(p.findCell(0),p.findCell(0)+8)];
 await p.rebuildCells(cells,0,2,control);
 assert.equal(p.findCell(0),4088);assert.equal(p.findCell(1),4080);assert.equal(p.leftChild(0),8);assert.equal(p.leftChild(1),7);assert.equal(p.rightChild(),99);assert.equal(p.computeFreeSpace(),4064);
});
test('rebuild scratch refunds prewrite cancellation and partial publication faults page',async()=>{
 const budget=new PrivateStateByteBudget(10000),p=new PrivateIndexPage(3,raw(3,true,[[3,2,1,1],[3,2,1,2]]).bytes,budget);
 const cells=[Uint8Array.of(3,2,1,3),Uint8Array.of(3,2,1,4)],error=new Error('rebuild');
 await assert.rejects(p.rebuildCells(cells,0,2,{async checkpoint(){throw error}}),e=>e===error);p.assertUsable();assert.equal(budget.usedBytes,0);
 let n=0;await assert.rejects(p.rebuildCells(cells,0,2,{async checkpoint(){if(++n===5)throw error}}),e=>e===error);
 assert.throws(()=>p.assertUsable(),e=>e===error);assert.equal(budget.usedBytes,0);
});
test('native pageFreeArray coalesces resident ranges but ignores borrowed foreign cells and leaves slots',async()=>{
 const p=raw(3,true,[[3,2,1,1],[3,2,1,2],[3,2,1,3]]),foreign=raw(4,true,[[3,2,1,9]]);
 const cells=[p.bytes.subarray(p.findCell(0),p.findCell(0)+4),foreign.bytes.subarray(4092),p.bytes.subarray(p.findCell(1),p.findCell(1)+4)];
 const slots=Array.from(p.bytes.subarray(8,14)),before=p.computeFreeSpace();
 assert.equal(await p.freeCellArray(cells,0,3,control),2);
 assert.deepEqual(Array.from(p.bytes.subarray(8,14)),slots);assert.equal(p.nCell,3);assert.equal(p.computeFreeSpace(),before+8);
 assert.equal((p.bytes[1]<<8)|p.bytes[2],4088);assert.equal((p.bytes[4090]<<8)|p.bytes[4091],8);
});
test('pageFreeArray ten-range flush cancellation faults and refunds fixed scratch',async()=>{
 const budget=new PrivateStateByteBudget(10000),b=raw(3,true,Array.from({length:23},()=>[3,2,1,1])).bytes,p=new PrivateIndexPage(3,b,budget);
 const cells=Array.from({length:12},(_,i)=>p.bytes.subarray(p.findCell(i*2),p.findCell(i*2)+4));
 const before=p.computeFreeSpace(),error=new Error('after ten-range flush');let n=0;
 await assert.rejects(p.freeCellArray(cells,0,12,{async checkpoint(){if(++n===12)throw error}}),e=>e===error);
 assert.equal(p.computeFreeSpace(),before+40);assert.throws(()=>p.assertUsable(),e=>e===error);assert.equal(budget.usedBytes,0);
});
test('pageInsertArray uses freeblocks before content and reports no-fit without defragmentation',async()=>{
 const p=raw(3,true,[[3,2,1,1],[3,2,1,2],[3,2,1,3]]);
 const resident=p.bytes.subarray(p.findCell(0),p.findCell(0)+4);
 await p.freeCellArray([resident],0,1,control);
 const state={top:4084};
 assert.equal(await p.insertCellArray([Uint8Array.of(3,2,1,9)],0,1,14,state,8,control),true);
 assert.equal(state.top,4084);assert.equal(p.findCell(0),4092);assert.equal(p.bytes[4095],9);
 assert.equal(await p.insertCellArray([Uint8Array.of(3,2,1,8)],0,1,4084,state,10,control),false);
 assert.equal(state.top,4084);
});
test('pageInsertArray native excess fragments and ppData publication on partial no-fit',async()=>{
 const b=raw(3,true,[[3,2,1,1]]).bytes;
 // Free block4000 size7: excess3 removed, contributes fragments3.
 b[1]=4000>>>8;b[2]=4000;b[4002]=0;b[4003]=7;
 const p=new PrivateIndexPage(3,b),state={top:4092};
 assert.equal(await p.insertCellArray([Uint8Array.of(3,2,1,2)],0,1,12,state,10,control),true);
 assert.equal((b[10]<<8)|b[11],4000);assert.equal(b[7],3);assert.equal(b[1],0);assert.equal(b[2],0);
 const pair=[Uint8Array.of(3,2,1,3),Uint8Array.of(3,2,1,4)];
 assert.equal(await p.insertCellArray(pair,0,2,4088,state,8,control),false);
 assert.equal(state.top,4092);assert.equal(p.findCell(0),4088);assert.equal(b[4091],3);
});
test('incremental edit removes resident prefix/tail then inserts foreign prefix and suffix',async()=>{
 const p=raw(3,true,[[3,2,1,2],[3,2,1,3],[3,2,1,4]]);
 const resident=Array.from({length:3},(_,i)=>p.bytes.subarray(p.findCell(i),p.findCell(i)+4));
 const cells=[Uint8Array.of(3,2,1,1),...resident,Uint8Array.of(3,2,1,5)];
 await p.editCells(cells,1,0,4,control);
 assert.equal(p.nCell,4);assert.deepEqual(Array.from({length:4},(_,i)=>p.bytes[p.findCell(i)+3]),[1,2,3,4]);
 const current=Array.from({length:4},(_,i)=>p.bytes.subarray(p.findCell(i),p.findCell(i)+4));
 await p.editCells([...current,Uint8Array.of(3,2,1,5)],0,1,4,control);
 assert.deepEqual(Array.from({length:4},(_,i)=>p.bytes[p.findCell(i)+3]),[2,3,4,5]);
});
test('incremental edit fallback retains one admission and charges temporary page at peak',async()=>{
 const budget=new PrivateStateByteBudget(10000);let begins=0,ends=0,peak=0;
 const b=raw(3,true,[[3,2,1,1],[3,2,1,2]]).bytes;b[5]=0;b[6]=12; // synthetic exhausted gap forces native fallback
 const p=new PrivateIndexPage(3,b,{reserve(n){budget.reserve(n);peak=Math.max(peak,budget.usedBytes)},release(n){budget.release(n)},begin(){begins++},end(){ends++}});
 const cells=[b.subarray(4092),b.subarray(4088,4092),Uint8Array.of(3,2,1,3)];
 await p.editCells(cells,0,0,3,control);
 assert.equal(begins,1);assert.equal(ends,1);assert.equal(peak,4224);assert.equal(budget.usedBytes,0);
 assert.deepEqual(Array.from({length:3},(_,i)=>b[p.findCell(i)+3]),[1,2,3]);assert.equal(p.computeFreeSpace(),4070);
});
test('staged edit retains adjacent staged entries in page without NEW admission or count refund',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(100000);let entries=681,admissions=0;
 const p=new PrivateIndexPage(3,raw(3,true,Array.from({length:681},()=>[3,2,1,1])).bytes,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),admitEntry(){admissions++;entries++;return()=>entries--},removeEntries:n=>entries-=n});
 await p.insertCell(2,Uint8Array.of(3,2,1,7),control);await p.insertCell(3,Uint8Array.of(3,2,1,8),control);
 const a=await gatherBlobkeyCells([p],[],budget,control);
 try{await p.editCells(a.cells,0,0,680,control);assert.equal(p.nOverflow,0);assert.equal(p.nCell,680);assert.equal(p.bytes[p.findCell(2)+3],7);assert.equal(p.bytes[p.findCell(3)+3],8);assert.equal(entries,683);assert.equal(admissions,2)}finally{a.release();p.releaseStagedCells()}
 assert.equal(entries,683);assert.equal(budget.usedBytes,0);
});
test('staged fallback conserves retained authority; prepublication rejection keeps displaced staging',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(100000);let removed=0;
 const b=raw(3,true,Array.from({length:681},()=>[3,2,1,1])).bytes;
 const p=new PrivateIndexPage(3,b,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),removeEntries:n=>removed+=n});
 await p.insertCell(2,Uint8Array.of(3,2,1,7),control);
 const a=await gatherBlobkeyCells([p],[],budget,control);
 try{
   await assert.rejects(p.editCells(a.cells,0,3,679,control),/displaced staging/);p.assertUsable();assert.equal(p.nOverflow,1);
   b[5]=0;b[6]=8; // synthetic gap forces fallback after tail removal
   await p.editCells(a.cells,0,0,680,control);
   assert.equal(p.nOverflow,0);assert.equal(removed,0);assert.equal(b[p.findCell(2)+3],7);
 }finally{a.release();p.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('staged edit cancellation before first physical free is retryable and preserves charged ownership',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(100000),p=new PrivateIndexPage(3,raw(3,true,Array.from({length:681},()=>[3,2,1,1])).bytes,budget);
 await p.insertCell(2,Uint8Array.of(3,2,1,7),control);
 const a=await gatherBlobkeyCells([p],[],budget,control),before=budget.usedBytes,bytes=p.bytes.slice(),error=new Error('before edit free');
 try{
   await assert.rejects(p.editCells(a.cells,0,0,680,{async checkpoint(){throw error}}),e=>e===error);
   p.assertUsable();assert.deepEqual(p.bytes,bytes);assert.equal(p.nOverflow,1);assert.equal(budget.usedBytes,before);
   await p.editCells(a.cells,0,0,680,control);assert.equal(p.nOverflow,0);
 }finally{a.release();p.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('incremental edit cancellation after prefix slot shift remains terminal with primary identity',async()=>{
 const budget=new PrivateStateByteBudget(10000),p=new PrivateIndexPage(3,raw(3,true,[[3,2,1,2],[3,2,1,3]]).bytes,budget);
 const resident=[p.bytes.subarray(4092),p.bytes.subarray(4088,4092)],cells=[Uint8Array.of(3,2,1,1),...resident],error=new Error('after slot shift');
 await assert.rejects(p.editCells(cells,1,0,3,{async checkpoint(){throw error}}),e=>e===error);
 assert.throws(()=>p.assertUsable(),e=>e===error);assert.equal(budget.usedBytes,0);
 // Header count remains old, but slot-shift publication occurred before insertion checkpoint.
 assert.equal(p.nCell,2);assert.equal((p.bytes[10]<<8)|p.bytes[11],4092);
});
test('native two-pass sibling edits protect borrowed sources when boundaries move either way',async()=>{
 const {editBlobkeySiblings,gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 for(const boundary of [2,4]){
   const left=raw(3,true,[[3,2,1,1],[3,2,1,2],[3,2,1,3]]),right=raw(4,true,[[3,2,1,5],[3,2,1,6],[3,2,1,7]]),budget=new PrivateStateByteBudget(10000);
   const a=await gatherBlobkeyCells([left,right],[Uint8Array.of(0,0,0,3,3,2,1,4)],budget,control),order=[];
   for(const [i,p] of [left,right].entries()){const edit=p.editCells.bind(p);p.editCells=async(...args)=>{order.push(i);return edit(...args)}}
   try{await editBlobkeySiblings([left,right],a.cells,a.oldCounts,[boundary,7],budget,control);
     assert.deepEqual(order,boundary===2?[1,0]:[0,1]);
     assert.deepEqual(Array.from({length:left.nCell},(_,i)=>left.bytes[left.findCell(i)+3]),Array.from({length:boundary},(_,i)=>i+1));
     assert.deepEqual(Array.from({length:right.nCell},(_,i)=>right.bytes[right.findCell(i)+3]),Array.from({length:6-boundary},(_,i)=>boundary+2+i));
   }finally{a.release()}
   assert.equal(budget.usedBytes,0);
 }
});
test('three sibling two-pass schedule and cancellation refund preserve unvisited pages',async()=>{
 const {editBlobkeySiblings,gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const pages=[raw(3,true,[[3,2,1,1],[3,2,1,2],[3,2,1,3]]),raw(4,true,[[3,2,1,5],[3,2,1,6],[3,2,1,7]]),raw(5,true,[[3,2,1,9],[3,2,1,10],[3,2,1,11]])],budget=new PrivateStateByteBudget(10000);
 const a=await gatherBlobkeyCells(pages,[Uint8Array.of(0,0,0,3,3,2,1,4),Uint8Array.of(0,0,0,4,3,2,1,8)],budget,control),order=[],error=new Error('before first sibling');
 try{
   const before=budget.usedBytes;
   await assert.rejects(editBlobkeySiblings(pages,a.cells,a.oldCounts,[4,6,11],budget,{async checkpoint(){throw error}}),e=>e===error);
   assert.equal(budget.usedBytes,before);for(const p of pages){p.assertUsable();assert.equal(p.nCell,3)}
   for(const [i,p] of pages.entries()){const edit=p.editCells.bind(p);p.editCells=async(...args)=>{order.push(i);return edit(...args)}}
   await editBlobkeySiblings(pages,a.cells,a.oldCounts,[4,6,11],budget,control);
   assert.deepEqual(order,[2,0,1]);
   assert.deepEqual(pages.map(p=>Array.from({length:p.nCell},(_,i)=>p.bytes[p.findCell(i)+3])),[[1,2,3,4],[6],[8,9,10,11]]);
 }finally{a.release()}
 assert.equal(budget.usedBytes,0);
});
test('cross-page staged bytes stay charged through dependency edits and consume only after all succeed',async()=>{
 const {editBlobkeySiblings,gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(100000),left=new PrivateIndexPage(3,raw(3,true,Array.from({length:681},()=>[3,2,1,1])).bytes,budget),right=raw(4,true,[[3,2,1,9]]);
 await left.insertCell(681,Uint8Array.of(3,2,1,7),control);
 const a=await gatherBlobkeyCells([left,right],[Uint8Array.of(0,0,0,3,3,2,1,8)],budget,control);let observed=false;
 const edit=right.editCells.bind(right);right.editCells=async(...args)=>{assert.equal(left.nOverflow,1);observed=true;return edit(...args)};
 try{
   await editBlobkeySiblings([left,right],a.cells,a.oldCounts,[680,684],budget,control);
   assert.equal(observed,true);assert.equal(left.nOverflow,0);assert.deepEqual(Array.from({length:right.nCell},(_,i)=>right.bytes[right.findCell(i)+3]),[7,8,9]);
 }finally{a.release();left.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('failed cross-page edit retains staged scratch until disposal, not successful transfer',async()=>{
 const {editBlobkeySiblings,gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(100000),left=new PrivateIndexPage(3,raw(3,true,Array.from({length:681},()=>[3,2,1,1])).bytes,budget),right=raw(4,true,[[3,2,1,9]]),error=new Error('after recipient publication');
 await left.insertCell(681,Uint8Array.of(3,2,1,7),control);
 const a=await gatherBlobkeyCells([left,right],[Uint8Array.of(0,0,0,3,3,2,1,8)],budget,control),before=budget.usedBytes;
 const edit=right.editCells.bind(right);right.editCells=async(...args)=>{await edit(...args);throw error};
 try{await assert.rejects(editBlobkeySiblings([left,right],a.cells,a.oldCounts,[680,684],budget,control),e=>e===error);assert.equal(left.nOverflow,1);assert.equal(budget.usedBytes,before);assert.equal(right.nCell,3)}
 finally{a.release();left.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('native copyNodeContent copies content suffix and header/slots but preserves destination gap',async()=>{
 const budget=new PrivateStateByteBudget(10000),source=raw(3,false,[[0,0,0,7,3,2,1,9]],11),dest=new PrivateIndexPage(2,raw(2,true,[]).bytes,budget);
 dest.bytes[200]=77;source.bytes[200]=88;
 await dest.copyNodeContent(source,control);
 assert.equal(dest.leaf,false);assert.equal(dest.childPtrSize,4);assert.equal(dest.cellOffset,12);assert.equal(dest.nCell,1);assert.equal(dest.rightChild(),11);
 assert.deepEqual(dest.bytes.subarray(dest.findCell(0)),source.bytes.subarray(source.findCell(0)));assert.equal(dest.bytes[200],77);assert.equal(dest.pgno,2);assert.equal(budget.usedBytes,0);
});
test('node copy cancellation before bytes is retryable and does not copy staged descriptors',async()=>{
 const budget=new PrivateStateByteBudget(100000),source=new PrivateIndexPage(3,raw(3,true,Array.from({length:681},()=>[3,2,1,1])).bytes,budget),dest=new PrivateIndexPage(2,raw(2,true,[]).bytes,budget),error=new Error('copy cancel');
 await source.insertCell(2,Uint8Array.of(3,2,1,7),control);const before=budget.usedBytes,bytes=dest.bytes.slice();
 try{
   await assert.rejects(dest.copyNodeContent(source,{async checkpoint(){throw error}}),e=>e===error);dest.assertUsable();assert.deepEqual(dest.bytes,bytes);assert.equal(budget.usedBytes,before);
   await dest.copyNodeContent(source,control);assert.equal(dest.nCell,681);assert.equal(dest.nOverflow,0);assert.equal(source.nOverflow,1);assert.equal(budget.usedBytes,before);
 }finally{source.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('native deeper copies root to child and moves staged lifetime before empty interior root publication',async()=>{
 const budget=new PrivateStateByteBudget(100000),root=new PrivateIndexPage(2,raw(2,true,Array.from({length:681},()=>[3,2,1,1])).bytes,budget),child=new PrivateIndexPage(3,raw(3,true,[]).bytes,budget);
 await root.insertCell(2,Uint8Array.of(3,2,1,7),control);const before=budget.usedBytes;
 try{
   await root.deepenInto(child,control);assert.equal(root.leaf,false);assert.equal(root.nCell,0);assert.equal(root.nOverflow,0);assert.equal(root.rightChild(),3);
   assert.equal(child.leaf,true);assert.equal(child.nCell,681);assert.equal(child.nOverflow,1);assert.equal(budget.usedBytes,before);
   const a=await (await import('../../src/internal/private-blobkey-balance.ts')).gatherBlobkeyCells([child],[],budget,control);
   try{assert.equal(a.cells[2][3],7)}finally{a.release()}
 }finally{root.releaseStagedCells();child.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('deeper pre-copy cancellation keeps root staging and child bytes retryable',async()=>{
 const budget=new PrivateStateByteBudget(100000),root=new PrivateIndexPage(2,raw(2,true,Array.from({length:681},()=>[3,2,1,1])).bytes,budget),child=new PrivateIndexPage(3,raw(3,true,[]).bytes,budget),error=new Error('deeper copy cancel');
 await root.insertCell(2,Uint8Array.of(3,2,1,7),control);const before=budget.usedBytes,bytes=child.bytes.slice();
 try{
   await assert.rejects(root.deepenInto(child,{async checkpoint(){throw error}}),e=>e===error);root.assertUsable();child.assertUsable();assert.equal(root.nOverflow,1);assert.equal(root.leaf,true);assert.deepEqual(child.bytes,bytes);assert.equal(budget.usedBytes,before);
   await root.deepenInto(child,control);assert.equal(child.nOverflow,1);
 }finally{root.releaseStagedCells();child.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('balance divider removal retains full copied cell and logical ownership until reconciliation',async()=>{
 const {balanceDivider}=await import('../../src/internal/private-blobkey-staging.ts');
 const budget=new PrivateStateByteBudget(10000);let removed=0;
 const cell=Uint8Array.of(0,0,0,7,3,2,1,9),parent=new PrivateIndexPage(2,raw(2,false,[cell],11).bytes,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),removeEntries:n=>removed+=n});
 const owner=balanceDivider.get(parent);assert.ok(owner);
 const result=await owner.take(0,control);
 try{assert.deepEqual(result.bytes,cell);assert.equal(parent.nCell,0);assert.equal(parent.rightChild(),11);assert.equal(removed,0);assert.equal(budget.usedBytes,72)}finally{result.release()}
 assert.equal(budget.usedBytes,0);
});
test('divider transit cancellation refunds copied scratch without logical refund',async()=>{
 const {balanceDivider}=await import('../../src/internal/private-blobkey-staging.ts'),budget=new PrivateStateByteBudget(10000),error=new Error('divider drop cancel');let removed=0;
 const parent=new PrivateIndexPage(2,raw(2,false,[[0,0,0,7,3,2,1,9]],11).bytes,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),removeEntries:n=>removed+=n});const bytes=parent.bytes.slice();
 await assert.rejects(balanceDivider.get(parent).take(0,{async checkpoint(){throw error}}),e=>e===error);assert.deepEqual(parent.bytes,bytes);assert.equal(removed,0);assert.equal(budget.usedBytes,0);
});
test('pending parent divider transfer conserves logical count and retains charged owned bytes',async()=>{
 const {balanceDivider}=await import('../../src/internal/private-blobkey-staging.ts');const budget=new PrivateStateByteBudget(100000);let removed=0;
 const cell=Uint8Array.of(0,0,0,7,3,2,1,9),parent=new PrivateIndexPage(2,raw(2,false,Array.from({length:408},()=>cell),11).bytes,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),removeEntries:n=>removed+=n});
 await parent.insertCell(200,cell,control);assert.equal(parent.nOverflow,1);const before=budget.usedBytes;
 const result=await balanceDivider.get(parent).take(200,control);
 try{assert.deepEqual(result.bytes,cell);assert.equal(parent.nCell,408);assert.equal(parent.nOverflow,0);assert.equal(removed,0);assert.equal(budget.usedBytes,before)}finally{result.release()}
 assert.equal(budget.usedBytes,0);
});
test('pending divider mismatch and pre-transfer cancellation retain staging for retry',async()=>{
 const {balanceDivider}=await import('../../src/internal/private-blobkey-staging.ts'),budget=new PrivateStateByteBudget(100000),cell=Uint8Array.of(0,0,0,7,3,2,1,9),error=new Error('pending cancel');
 const parent=new PrivateIndexPage(2,raw(2,false,Array.from({length:408},()=>cell),11).bytes,budget);await parent.insertCell(200,cell,control);const before=budget.usedBytes;
 await assert.rejects(balanceDivider.get(parent).take(199,control),/match logical/);
 await assert.rejects(balanceDivider.get(parent).take(200,{async checkpoint(){throw error}}),e=>e===error);parent.assertUsable();assert.equal(parent.nOverflow,1);assert.equal(budget.usedBytes,before);
 const owned=await balanceDivider.get(parent).take(200,control);owned.release();owned.release();assert.equal(budget.usedBytes,0);
});
test('nonroot acquire/drop follows descending native child chain and retains divider scratch',async()=>{
 const {acquireBlobkeySiblings}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(10000);
 const parent=raw(2,false,[[0,0,0,3,3,2,1,7],[0,0,0,4,3,2,1,8]],5),pages=[3,4,5].map(n=>raw(n,true,[[3,2,1,n]])),trace=[];
 const result=await acquireBlobkeySiblings(parent,1,false,async n=>{trace.push(n);return {page:pages[n-3],release(){trace.push(-n)}}},budget,control);
 try{assert.deepEqual(trace,[5,4,3]);assert.equal(parent.nCell,0);assert.deepEqual(result.pages.map(p=>p.pgno),[3,4,5]);assert.deepEqual(result.dividers.map(c=>c[7]),[7,8]);assert.equal(result.rightOffset,8)}finally{result.release()}
 assert.deepEqual(trace,[5,4,3,-3,-4,-5]);assert.equal(budget.usedBytes,0);
});
test('nonroot later acquire failure preserves primary and releases earlier siblings after divider drop',async()=>{
 const {acquireBlobkeySiblings}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(10000),error=new Error('left acquire'),cleanup=new Error('release');let released=0;
 const parent=raw(2,false,[[0,0,0,3,3,2,1,7],[0,0,0,4,3,2,1,8]],5);
 await assert.rejects(acquireBlobkeySiblings(parent,1,false,async n=>{if(n===3)throw error;return {page:raw(n,true,[[3,2,1,n]]),release(){released++;throw cleanup}}},budget,control),e=>e===error);
 assert.equal(parent.nCell,0);assert.equal(released,2);assert.equal(budget.usedBytes,0);
});
test('pending left-edge parent drops resident divider before pending descriptor in native order',async()=>{
 const {acquireBlobkeySiblings}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(100000);
 const cell=Uint8Array.of(0,0,0,3,3,2,1,8),parent=new PrivateIndexPage(2,raw(2,false,Array.from({length:408},()=>cell),900).bytes,budget);
 // Distinct next resident pointer fixes the descending child chain.
 parent.bytes[parent.findCell(1)+3]=4;
 await parent.insertCell(0,Uint8Array.of(0,0,2,188,3,2,1,7),control);
 const trace=[];const result=await acquireBlobkeySiblings(parent,0,false,async n=>{trace.push(n);return {page:raw(n,true,[[3,2,1,1]]),release(){}}},budget,control);
 try{assert.deepEqual(trace,[4,3,700]);assert.equal(parent.nOverflow,0);assert.equal(parent.nCell,407);assert.deepEqual(result.dividers.map(c=>c[7]),[7,8]);assert.notEqual(result.rightOffset,8)}finally{result.release();parent.releaseStagedCells()}
 assert.equal(budget.usedBytes,0);
});
test('pending interior parent transfers stage first then resident with reset index adjustment',async()=>{
 const {acquireBlobkeySiblings}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(100000),cell=Uint8Array.of(0,0,0,3,3,2,1,8);
 const parent=new PrivateIndexPage(2,raw(2,false,Array.from({length:408},()=>cell),900).bytes,budget);parent.bytes[parent.findCell(1)+3]=4;
 await parent.insertCell(1,Uint8Array.of(0,0,2,188,3,2,1,7),control);const trace=[];
 const result=await acquireBlobkeySiblings(parent,1,false,async n=>{trace.push(n);return {page:raw(n,true,[[3,2,1,1]]),release(){}}},budget,control);
 try{assert.deepEqual(trace,[4,700,3]);assert.equal(parent.nOverflow,0);assert.equal(parent.nCell,407);assert.deepEqual(result.dividers.map(c=>c[7]),[8,7])}finally{result.release()}
 assert.equal(budget.usedBytes,0);
});
test('promoted leaf minimum cell reparses actual interior extent instead of retaining leaf padding',async()=>{
 const {promoteBlobkeyDivider}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(10000),parent=raw(2,false,[],3);
 const result=await promoteBlobkeyDivider(parent,Uint8Array.of(2,2,9,0),true,7,budget,control);
 try{assert.deepEqual(result.bytes,Uint8Array.of(0,0,0,7,2,2,9));assert.equal(result.rightChild,null)}finally{result.release()}
 assert.equal(budget.usedBytes,0);
});
test('interior promotion retains displaced child and overflow pointer, refunds cancel scratch',async()=>{
 const {promoteBlobkeyDivider}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(10000),parent=raw(2,false,[],3),cell=new Uint8Array(4+2+489+4);
 cell.set([0,0,0,88,0x87,0x6b]);cell.set([0,0,0,55],cell.length-4);
 const result=await promoteBlobkeyDivider(parent,cell,false,9,budget,control);
 try{assert.equal(result.rightChild,88);assert.deepEqual(result.bytes.slice(0,4),Uint8Array.of(0,0,0,9));assert.deepEqual(result.bytes.slice(4),cell.slice(4));assert.equal(budget.usedBytes,64+cell.length)}finally{result.release()}
 const error=new Error('promote cancel');await assert.rejects(promoteBlobkeyDivider(parent,cell,false,9,budget,{async checkpoint(){throw error}}),e=>e===error);assert.equal(budget.usedBytes,0);
});
test('balance parent pointer publication uses retained physical offset without altering divider payload',async()=>{
 const {balanceChildPointer}=await import('../../src/internal/private-blobkey-staging.ts');const parent=raw(2,false,[[0,0,0,3,3,2,1,7]],5),offset=parent.findCell(0),before=parent.bytes.slice(offset+4);
 await balanceChildPointer.get(parent).publish(offset,9,control);assert.equal(parent.bytes[offset+3],9);assert.deepEqual(parent.bytes.slice(offset+4),before);
 await balanceChildPointer.get(parent).publish(8,11,control);assert.equal(parent.rightChild(),11);
});
test('child publication rejects stale offset and cancellation before four-byte write remains retryable',async()=>{
 const {balanceChildPointer}=await import('../../src/internal/private-blobkey-staging.ts'),parent=raw(2,false,[[0,0,0,3,3,2,1,7]],5),before=parent.bytes.slice(),error=new Error('pointer cancel'),owner=balanceChildPointer.get(parent);
 await assert.rejects(owner.publish(parent.findCell(0)+1,9,control),/resident child/);
 await assert.rejects(owner.publish(8,9,{async checkpoint(){throw error}}),e=>e===error);parent.assertUsable();assert.deepEqual(parent.bytes,before);
 await owner.publish(8,9,control);assert.equal(parent.rightChild(),9);
});
test('parent divider transfer insert bypasses NEW admission without changing ordinary insert policy',async()=>{
 const {balanceDividerInsert}=await import('../../src/internal/private-blobkey-staging.ts');let admissions=0;const budget=new PrivateStateByteBudget(10000),parent=new PrivateIndexPage(2,raw(2,false,[],5).bytes,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),admitEntry(){admissions++;throw new Error('NEW full')}}),cell=Uint8Array.of(0,0,0,3,3,2,1,7);
 await balanceDividerInsert.get(parent).insert(0,cell,9,control);assert.equal(admissions,0);assert.equal(parent.nCell,1);assert.equal(parent.bytes[parent.findCell(0)+3],9);assert.equal(budget.usedBytes,0);
 await assert.rejects(parent.insertCell(1,cell,control),/NEW full/);assert.equal(admissions,1);
});
test('conserving divider insert stages owned child prefix at full parent and refunds on prewrite failure',async()=>{
 const {balanceDividerInsert}=await import('../../src/internal/private-blobkey-staging.ts'),budget=new PrivateStateByteBudget(100000),cell=Uint8Array.of(0,0,0,3,3,2,1,7);let admissions=0;
 const parent=new PrivateIndexPage(2,raw(2,false,Array.from({length:408},()=>cell),5).bytes,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),admitEntry(){admissions++;throw new Error('NEW full')}}),owner=balanceDividerInsert.get(parent),error=new Error('insert checkpoint');
 await assert.rejects(owner.insert(0,cell,9,{async checkpoint(){throw error}}),e=>e===error);assert.equal(parent.nOverflow,0);assert.equal(budget.usedBytes,0);parent.assertUsable();
 await owner.insert(0,cell,9,control);assert.equal(parent.nOverflow,1);assert.equal(admissions,0);assert.equal(budget.usedBytes,8+64);const held=parent.overflowCell(0);assert.equal(held.bytes[3],9);assert.equal(cell[3],3);parent.releaseStagedCells();assert.equal(budget.usedBytes,0);
});
test('nonroot parent publication integrates conserving divider insert and interior child transfer',async()=>{
 const {publishBlobkeyDividers}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(10000),parent=raw(2,false,[],3),left=raw(3,false,[],88),right=raw(4,false,[],99),cell=Uint8Array.of(0,0,0,77,3,2,1,9);
 await publishBlobkeyDividers(parent,0,8,[left,right],[1,2],[cell,cell],99,3,budget,control);
 assert.equal(parent.rightChild(),4);assert.equal(parent.nCell,1);assert.equal(left.rightChild(),77);assert.equal(right.rightChild(),99);assert.equal(parent.bytes[parent.findCell(0)+3],3);assert.equal(budget.usedBytes,0);
});

test('parent publication failure retains primary after prior pointer publication and refunds divider scratch',async()=>{
 const {publishBlobkeyDividers}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(10000),parent=raw(2,false,[],3),left=raw(3,true,[]),right=raw(4,true,[]),error=new Error('parent insert');let calls=0;
 await assert.rejects(publishBlobkeyDividers(parent,0,8,[left,right],[1,2],[Uint8Array.of(3,2,1,7),Uint8Array.of(3,2,1,9)],0,2,budget,{async checkpoint(){if(++calls===3)throw error}}),e=>e===error);
 assert.equal(parent.rightChild(),4);assert.equal(parent.nCell,0);assert.equal(budget.usedBytes,0);
});
test('arena two leaf siblings merge and native nonroot shallows empty root',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(200000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:100,maxEntries:3});
 try{
 arena.installPage(2,raw(2,false,[[0,0,0,3,3,2,1,2]],4).bytes);arena.installPage(3,raw(3,true,[[3,2,1,1]]).bytes);arena.installPage(4,raw(4,true,[[3,2,1,3]]).bytes);
 await arena.balanceNonroot(2,0,false,control);const p=arena.acquire(2);try{assert.equal(p.page.leaf,true);assert.equal(p.page.nCell,3);assert.deepEqual(Array.from({length:3},(_,i)=>p.page.bytes[p.page.findCell(i)+3]),[1,2,3]);await assert.rejects(p.page.insertCell(3,Uint8Array.of(3,2,1,4),control),/entry limit/);assert.equal(p.page.nCell,3);assert.equal(p.page.nOverflow,0)}finally{p.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena three interior siblings merge/shallow preserving divider children and final right child',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(200000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:100,maxEntries:5});
 try{
 const c=(child,key)=>Uint8Array.of(0,0,0,child,3,2,1,key);
 arena.installPage(2,raw(2,false,[c(3,2),c(4,4)],5).bytes);arena.installPage(3,raw(3,false,[c(10,1)],11).bytes);arena.installPage(4,raw(4,false,[c(12,3)],13).bytes);arena.installPage(5,raw(5,false,[c(14,5)],15).bytes);
 await arena.balanceNonroot(2,1,false,control);const p=arena.acquire(2);try{assert.equal(p.page.leaf,false);assert.equal(p.page.nCell,5);assert.equal(p.page.rightChild(),15);assert.deepEqual(Array.from({length:5},(_,i)=>p.page.bytes[p.page.findCell(i)+3]),[10,11,12,13,14]);await assert.rejects(p.page.insertCell(5,c(16,6),control),/entry limit/)}finally{p.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena shuffled sibling identities rekey by pgno while conserving unequal payload order',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(300000),arena=await PrivateBlobkeyPages.open(budget,control);
 const leaf=(key,size)=>{const header=size>=128?2:1,b=new Uint8Array(size+header);if(header===2){b[0]=0x80|(size>>>7);b[1]=size&127}else b[0]=size;b[header]=key;return b},keys=[1,2,3,4,5,6,7,8,9];
 try{
 // Parent's logical sibling order deliberately differs from physical pgno.
 const div=(pg,key)=>{const b=new Uint8Array(9);b[3]=pg;b[4]=4;b[5]=key;return b};
 arena.installPage(2,raw(2,false,[div(5,4),div(3,8)],4).bytes);
 arena.installPage(3,raw(3,true,[leaf(5,900),leaf(6,900),leaf(7,900)]).bytes);
 arena.installPage(4,raw(4,true,[leaf(9,900)]).bytes);
 arena.installPage(5,raw(5,true,[leaf(1,900),leaf(2,900),leaf(3,900)]).bytes);
 await arena.balanceNonroot(2,1,false,control);
 const root=arena.acquire(2);let children,dividers;try{children=Array.from({length:root.page.nCell},(_,i)=>root.page.bytes[root.page.findCell(i)+3]);children.push(root.page.rightChild());dividers=Array.from({length:root.page.nCell},(_,i)=>root.page.bytes[root.page.findCell(i)+ (root.page.parseCell(i).nPayload>=128?6:5)])}finally{root.release()}
 assert.deepEqual(children,[3,5]);const actual=[];for(let i=0;i<children.length;i++){const p=arena.acquire(children[i]);try{for(let j=0;j<p.page.nCell;j++)actual.push(p.page.bytes[p.page.findCell(j)+ (p.page.parseCell(j).nPayload>=128?2:1)])}finally{p.release()}if(i<dividers.length)actual.push(dividers[i])}assert.deepEqual(actual,keys);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('gather native old byte counters include allocated fragmentation remainder',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts'),budget=new PrivateStateByteBudget(10000),page=raw(3,true,[[3,2,1,7]]);
 // Four-byte content gap with three reported fragments leaves one allocated
 // byte: native usableSpace-nFree includes it, not just cell+slot sizes.
 page.bytes[5]=15;page.bytes[6]=248;page.bytes[7]=3;
 const result=await gatherBlobkeyCells([page],[],budget,control);try{assert.deepEqual(result.oldBytes,[7])}finally{result.release()}
});
test('arena expanding staged child consumes lower freelist identity and preserves lease/scratch ownership',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(300000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:100,maxEntries:682});
 try{
 arena.installPage(2,raw(2,false,[],4).bytes);arena.installPage(3,raw(3,true,[]).bytes);arena.installPage(4,raw(4,true,Array.from({length:681},()=>[3,2,1,1])).bytes);await arena.freePage(3,control);
 let p=arena.acquire(4);try{await p.page.insertCell(681,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
 await arena.balanceNonroot(2,0,false,control);p=arena.acquire(2);let children;try{assert.equal(p.page.nCell,1);children=[p.page.bytes[p.page.findCell(0)+3],p.page.rightChild()];assert.deepEqual(children,[3,4])}finally{p.release()}
 let count=1;for(const n of children){p=arena.acquire(n);try{count+=p.page.nCell;assert.equal(p.page.nOverflow,0);await assert.rejects(p.page.insertCell(p.page.nCell,Uint8Array.of(3,2,1,1),control),/entry limit/)}finally{p.release()}}assert.equal(count,682);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('bulk nonroot allocation uses native nearby1 rather than old sibling identity',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(300000),arena=await PrivateBlobkeyPages.open(budget,control);
 try{arena.installPage(2,raw(2,false,[],7).bytes);for(let n=3;n<=6;n++)arena.installPage(n,raw(n,true,[]).bytes);arena.installPage(7,raw(7,true,Array.from({length:681},()=>[3,2,1,1])).bytes);for(const n of [5,3,6])await arena.freePage(n,control);
 let p=arena.acquire(7);try{await p.page.insertCell(681,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
 await arena.balanceNonroot(2,0,true,control);p=arena.acquire(2);try{assert.deepEqual([p.page.bytes[p.page.findCell(0)+3],p.page.rightChild()],[3,7])}finally{p.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});

test('validated balance path merges underfull child and rejects stale path before publication',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(200000),arena=await PrivateBlobkeyPages.open(budget,control);
 try{arena.installPage(2,raw(2,false,[[0,0,0,3,3,2,1,2]],4).bytes);arena.installPage(3,raw(3,true,[[3,2,1,1]]).bytes);arena.installPage(4,raw(4,true,[[3,2,1,3]]).bytes);
 await assert.rejects(arena.balancePath([2,4],[0],false,control),/stale balance path/);
 await arena.balancePath([2,3],[0],false,control);const p=arena.acquire(2);try{assert.equal(p.page.leaf,true);assert.equal(p.page.nCell,3)}finally{p.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('dispatcher propagates a staged parent through root expansion into interior balance',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(8000000),arena=await PrivateBlobkeyPages.open(budget,control);
 const divider=n=>Uint8Array.of(n>>>24,n>>>16,n>>>8,n,3,2,1,1);
 try{
 arena.installPage(2,raw(2,false,Array.from({length:408},(_,i)=>divider(i+3)),411).bytes);
 for(let n=3;n<=411;n++)arena.installPage(n,raw(n,true,n>=409?Array.from({length:681},()=>[3,2,1,1]):[]).bytes);
 let p=arena.acquire(411);try{await p.page.insertCell(681,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
 await arena.balancePath([2,411],[408],false,control);
 p=arena.acquire(2);let children;try{assert.equal(p.page.leaf,false);assert.equal(p.page.nOverflow,0);assert.ok(p.page.nCell>0);children=[p.page.bytes[p.page.findCell(0)+2]*256+p.page.bytes[p.page.findCell(0)+3],p.page.rightChild()]}finally{p.release()}
 for(const n of children){p=arena.acquire(n);try{assert.equal(p.page.leaf,false);assert.equal(p.page.nOverflow,0)}finally{p.release()}}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('dispatcher balances empty nonroot child and shallows empty tree without fabricated cells',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts'),budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control);
 try{arena.installPage(2,raw(2,false,[],3).bytes);arena.installPage(3,raw(3,true,[]).bytes);await arena.balancePath([2,3],[0],false,control);const p=arena.acquire(2);try{assert.equal(p.page.leaf,true);assert.equal(p.page.nCell,0)}finally{p.release()}}finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('pending divider transfer admits overlapping old/new descriptors before consuming staging',async()=>{
 const {balanceDivider}=await import('../../src/internal/private-blobkey-staging.ts');
 for(const extra of [63,64]){
 const budget=new PrivateStateByteBudget(72+extra),cell=Uint8Array.of(0,0,0,7,3,2,1,9);let peak=0,removed=0;
 const parent=new PrivateIndexPage(2,raw(2,false,Array.from({length:408},()=>cell),11).bytes,{reserve(n){budget.reserve(n);peak=Math.max(peak,budget.usedBytes)},release:n=>budget.release(n),removeEntries:n=>removed+=n});
 await parent.insertCell(200,cell,control);assert.equal(budget.usedBytes,72);
 if(extra===63){await assert.rejects(balanceDivider.get(parent).take(200,control),/byte limit/);assert.equal(parent.nOverflow,1);assert.equal(budget.usedBytes,72);parent.releaseStagedCells();assert.equal(removed,1)}
 else{const result=await balanceDivider.get(parent).take(200,control);assert.equal(peak,136);assert.equal(budget.usedBytes,72);assert.equal(parent.nOverflow,0);assert.equal(removed,0);result.release();result.release()}
 assert.equal(budget.usedBytes,0);
 }
});
test('pending divider cancellation refunds new descriptor but retains old owner until disposal',async()=>{
 const {balanceDivider}=await import('../../src/internal/private-blobkey-staging.ts'),budget=new PrivateStateByteBudget(136),cell=Uint8Array.of(0,0,0,7,3,2,1,9),error=new Error('pending overlap cancel');let removed=0;
 const parent=new PrivateIndexPage(2,raw(2,false,Array.from({length:408},()=>cell),11).bytes,{reserve:n=>budget.reserve(n),release:n=>budget.release(n),removeEntries:n=>removed+=n});
 await parent.insertCell(200,cell,control);
 await assert.rejects(balanceDivider.get(parent).take(200,{async checkpoint(){assert.equal(budget.usedBytes,136);throw error}}),e=>e===error);
 assert.equal(budget.usedBytes,72);assert.equal(parent.nOverflow,1);assert.equal(removed,0);
 parent.releaseStagedCells();parent.releaseStagedCells();assert.equal(budget.usedBytes,0);assert.equal(removed,1);
});
test('maximum resident leaf CellArray admits all2045 descriptors before traversal and refunds',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 //4096 header8 +681*(slot2+minimum cell4)=4094. Three old
 //siblings plus two dividers yield2045 descriptors; dividers copy allowance8 each.
 const pages=[3,4,5].map(pg=>raw(pg,true,Array.from({length:681},()=>[3,2,1,7]))),dividers=[Uint8Array.of(0,0,0,3,3,2,1,7),Uint8Array.of(0,0,0,4,3,2,1,7)],charge=256+2045*64+16;
 for(const delta of [-1,0]){
 const budget=new PrivateStateByteBudget(charge+delta);let checkpoints=0;
 const ctl={async checkpoint(){checkpoints++}};
 if(delta<0){await assert.rejects(gatherBlobkeyCells(pages,dividers,budget,ctl),/byte limit/);assert.equal(checkpoints,0);assert.equal(budget.usedBytes,0)}
 else{const a=await gatherBlobkeyCells(pages,dividers,budget,ctl);assert.equal(a.cells.length,2045);assert.deepEqual(a.oldCounts,[681,1363,2045]);assert.equal(budget.usedBytes,charge);assert.equal(checkpoints,2045);a.release();a.release();assert.equal(budget.usedBytes,0)}
 }
});
test('pending-inclusive full resident gather cancellation retains all page-owned stages and refunds transient peak',async()=>{
 const {gatherBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 const budget=new PrivateStateByteBudget(200000),pages=[3,4,5].map(pg=>new PrivateIndexPage(pg,raw(pg,true,Array.from({length:681},()=>[3,2,1,7])).bytes,budget));
 const dividers=[Uint8Array.of(0,0,0,3,3,2,1,7),Uint8Array.of(0,0,0,4,3,2,1,7)];
 try{
 for(const p of pages){await p.insertCell(2,Uint8Array.of(3,2,1,8),control);await p.insertCell(3,Uint8Array.of(3,2,1,9),control)}
 const retained=6*(4+64),gatherCharge=256+2051*64+16;assert.equal(budget.usedBytes,retained);
 for(const boundary of [1,3,684,1369,2051]){
 let checkpoints=0;const primary=new Error(`gather boundary${boundary}`);
 await assert.rejects(gatherBlobkeyCells(pages,dividers,budget,{async checkpoint(){if(++checkpoints===boundary)throw primary}}),e=>e===primary);
 assert.equal(budget.usedBytes,retained);for(const p of pages){p.assertUsable();assert.equal(p.nOverflow,2)}
 }
 const a=await gatherBlobkeyCells(pages,dividers,budget,control);
 try{assert.equal(a.cells.length,2051);assert.deepEqual(a.oldCounts,[683,1367,2051]);assert.equal(budget.usedBytes,retained+gatherCharge);for(const index of [2,686,1370]){assert.equal(a.cells[index][3],8);assert.equal(a.cells[index+1][3],9)}}finally{a.release()}
 assert.equal(budget.usedBytes,retained);
 }finally{for(const p of pages)p.releaseStagedCells();assert.equal(budget.usedBytes,0)}
});
test('pageInsertArray native fragment57 admits excess3 while58 bypasses block and uses content',async()=>{
 for(const fragments of [57,58]){const b=raw(3,true,[[3,2,1,1]]).bytes;b[1]=4000>>>8;b[2]=4000;b[4002]=0;b[4003]=7;b[7]=fragments;const p=new PrivateIndexPage(3,b),state={top:4092};
 assert.equal(await p.insertCellArray([Uint8Array.of(3,2,1,2)],0,1,12,state,10,control),true);const used=(b[10]<<8)|b[11];assert.equal(used,fragments===57?4000:4088);assert.equal(state.top,fragments===57?4092:4088);assert.equal(b[7],fragments===57?60:58);assert.equal((b[1]<<8)|b[2],fragments===57?0:4000);assert.equal(b[used+3],2)}
});
test('gather partition and rebuild scratch overlap admits exact bound and rejects one below before publication',async()=>{
 const {gatherBlobkeyCells,partitionBlobkeyCells}=await import('../../src/internal/private-blobkey-balance.ts');
 // gather256 + two descriptors128; partition256; rebuild4096+64.
 const peak=384+256+4160;
 for(const room of [peak-1,peak]){const budget=new PrivateStateByteBudget(room),b=raw(3,true,[[3,2,1,1],[3,2,1,2]]).bytes,p=new PrivateIndexPage(3,b,budget),before=b.slice();const gathered=await gatherBlobkeyCells([p],[],budget,control);const part=await partitionBlobkeyCells(2,i=>gathered.cells[i].length,gathered.oldCounts,gathered.oldBytes,4088,false,budget,control);
 try{assert.equal(budget.usedBytes,640);if(room===peak-1){await assert.rejects(p.rebuildCells(gathered.cells,0,2,control),/byte limit/);assert.deepEqual(b,before);p.assertUsable()}else{let saw=false;await p.rebuildCells(gathered.cells,0,2,{async checkpoint(){assert.equal(budget.usedBytes,peak);saw=true}});assert.ok(saw);assert.equal(p.nCell,2);assert.equal(p.bytes[p.findCell(0)+3],1);assert.equal(p.bytes[p.findCell(1)+3],2)}assert.equal(budget.usedBytes,640)}finally{part.release();gathered.release();assert.equal(budget.usedBytes,0)}}
});
test('sibling edit fallback holds transit and edit scratch through rebuild cancellation and cleanup',async()=>{
 const {editBlobkeySiblings}=await import('../../src/internal/private-blobkey-balance.ts');
 for(const cancelAt of [0,5,-1]){const budget=new PrivateStateByteBudget(4352),b=raw(3,true,[[3,2,1,1],[3,2,1,2]]).bytes;b[5]=0;b[6]=12;const p=new PrivateIndexPage(3,b,budget),before=b.slice(),error=new Error('rebuild checkpoint');let atPeak=0,peak=0;
 const cells=[b.subarray(4092),b.subarray(4088,4092),Uint8Array.of(3,2,1,3)];
 const op=editBlobkeySiblings([p],cells,[2],[3],budget,{async checkpoint(){peak=Math.max(peak,budget.usedBytes);if(budget.usedBytes===4352){if(atPeak++===cancelAt)throw error}}});
 if(cancelAt<0){await op;assert.equal(p.nCell,3);assert.deepEqual(Array.from({length:3},(_,i)=>b[p.findCell(i)+3]),[1,2,3]);p.assertUsable()}else{await assert.rejects(op,e=>e===error);if(cancelAt===0){assert.deepEqual(b,before);p.assertUsable()}else{assert.throws(()=>p.assertUsable(),e=>e===error)}}assert.equal(peak,4352);assert.equal(budget.usedBytes,0)}
});
test('divider promotion overlaps staged parent snapshot at exact bound and one-below releases promotion',async()=>{
 const {publishBlobkeyDividers}=await import('../../src/internal/private-blobkey-balance.ts');
 const c=Uint8Array.of(0,0,0,3,3,2,1,7);
 // Promotion64+8 remains live while insert stages an independent64+8 copy.
 for(const room of [143,144]){const budget=new PrivateStateByteBudget(room),b=raw(2,false,Array.from({length:408},()=>c),3).bytes,parent=new PrivateIndexPage(2,b,budget),left=raw(3,true,[]),right=raw(4,true,[]);let peak=0;
 const op=publishBlobkeyDividers(parent,0,8,[left,right],[1,2],[Uint8Array.of(3,2,1,7),Uint8Array.of(3,2,1,9)],0,2,budget,{async checkpoint(){peak=Math.max(peak,budget.usedBytes)}});
 if(room===143){await assert.rejects(op,/byte limit/);assert.equal(parent.nOverflow,0);assert.equal(budget.usedBytes,0);assert.equal(peak,72)}else{await op;assert.equal(peak,144);assert.equal(parent.nOverflow,1);assert.equal(budget.usedBytes,72)}
 assert.equal(parent.rightChild(),4);assert.equal(parent.nCell,408);parent.assertUsable();parent.releaseStagedCells();assert.equal(budget.usedBytes,0)}
});
