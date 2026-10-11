import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateIndexPage, PrivateBlobkeyPages, PrivateBlobkeyFormatError, PRIVATE_PAGE_CHARGE, PRIVATE_CELL_RESULT_CHARGE, PRIVATE_ARENA_CHARGE, PRIVATE_LEASE_CHARGE, PRIVATE_SUBVIEW_CHARGE, PRIVATE_ITERATOR_CHARGE, PRIVATE_ITERATOR_RESULT_CHARGE, PRIVATE_STAGED_INSPECTION_CHARGE} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
// Explicit value-copy fixtures avoid retaining per-element iterator capabilities.
const copyBytes=b=>{const copy=new Uint8Array(b.length);for(let i=0;i<b.length;i++)copy[i]=b[i];return copy};
const control={snapshotCheckpoint(){},async checkpoint(){}};
const u16=(b,p,n)=>new DataView(b.buffer,b.byteOffset,b.byteLength).setUint16(p,n);
const page=()=>{const b=new Uint8Array(4096);b[0]=10;u16(b,5,4096);return b};
const open=(budget=new PrivateStateByteBudget(100000),hook=()=>{})=>PrivateBlobkeyPages.open(budget,control,hook);
// Fixtures are written directly from pinned btree.c / SQLite page format,
// not through the TS owner's serializer. No native internal harness credit.
test('OpenEphemeral BLOBKEY creates page1 metadata and separate root2',async()=>{
 const budget=new PrivateStateByteBudget((PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+PRIVATE_LEASE_CHARGE+PRIVATE_SUBVIEW_CHARGE+PRIVATE_ITERATOR_CHARGE+9*PRIVATE_ITERATOR_RESULT_CHARGE),arena=await open(budget);
 assert.equal(arena.root,2);assert.equal(arena.pageCount,2);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));
 const root=arena.acquire(2);assert.equal(root.page.leaf,true);assert.equal(root.page.nCell,0);assert.equal(root.page.computeFreeSpace(),4088);
 assert.deepEqual([...root.page.bytes.subarray(0,8)],[10,0,0,0,0,16,0,0]);
 root.release();arena.close();assert.equal(budget.usedBytes,0);arena.close();
});
test('resident cell slots preserve logical order independently of physical order',async()=>{
 const arena=await open(),b=page();u16(b,3,2);u16(b,5,4000);u16(b,8,4080);u16(b,10,4000);
 b.set([3,2,1,9],4080);b.set([3,2,1,4],4000);
 arena.installPage(2,b);b[4083]=99;
 const lease=arena.acquire(2),p=lease.page;
 assert.equal(p.findCell(0),4080);assert.equal(p.findCell(1),4000);
 assert.deepEqual(p.parseCell(0),{offset:4080,payloadOffset:4081,nPayload:3,nLocal:3,nSize:4,overflowOffset:null});
 assert.equal(p.bytes[4083],9,'input page copied, not aliased');
 lease.release();arena.close();
});
test('interior divider owns left child and record; header owns right child',async()=>{
 const arena=await open(),b=page();b[0]=2;u16(b,3,1);u16(b,5,4080);u16(b,12,4080);
 new DataView(b.buffer).setUint32(8,4);new DataView(b.buffer).setUint32(4080,3);b.set([3,2,1,7],4084);
 arena.installPage(2,b);const lease=arena.acquire(2),p=lease.page;
 assert.equal(p.leaf,false);assert.equal(p.cellOffset,12);assert.equal(p.rightChild(),4);assert.equal(p.leftChild(0),3);
 assert.deepEqual(p.parseCell(0),{offset:4080,payloadOffset:4085,nPayload:3,nLocal:3,nSize:8,overflowOffset:null});
 lease.release();arena.close();
});
test('overflow local distribution uses minLocal/surplus, not largest-fitting prefix',async()=>{
 const arena=await open(),b=page();u16(b,3,1);u16(b,5,3500);u16(b,8,3500);
 b.set([0x8f,0x50],3500); // payload 2000, maxLocal1002, minLocal489 => nLocal489
 arena.installPage(2,b);const lease=arena.acquire(2);
 assert.deepEqual(lease.page.parseCell(0),{offset:3500,payloadOffset:3502,nPayload:2000,nLocal:489,nSize:495,overflowOffset:3991});
 lease.release();arena.close();
});
test('computeFreeSpace counts gap/fragments/ordered blocks and rejects malformed chains',async()=>{
 const arena=await open(),b=page();u16(b,3,1);u16(b,8,4000);u16(b,5,4000);b[7]=2;u16(b,1,4020);u16(b,4020,4050);u16(b,4022,8);u16(b,4052,12);
 arena.installPage(2,b);let lease=arena.acquire(2);assert.equal(lease.page.computeFreeSpace(),4012);lease.release();
 for(const mutate of [x=>u16(x,1,3999),x=>u16(x,4022,3),x=>u16(x,4020,4024),x=>u16(x,4052,100)]){
  const bad=b.slice();mutate(bad);arena.installPage(2,bad);lease=arena.acquire(2);
  assert.throws(()=>lease.page.computeFreeSpace(),PrivateBlobkeyFormatError);lease.release();
 }
 arena.close();
});
test('init failure releases its acquired reference and preserves primary error over cleanup hook',async()=>{
 const primary=new Error('init'),cleanup=new Error('release');let enabled=false;
 const arena=await open(undefined,event=>{if(enabled&&event==='init')throw primary;if(enabled&&event==='release')throw cleanup});
 enabled=true;assert.throws(()=>arena.acquire(2),e=>e===primary);assert.equal(arena.referenceCount(2),0);
 arena.close();
});
test('aliases do not double-charge and close/mutation reject live leases',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),a=arena.acquire(2),b=arena.acquire(2);
 assert.equal(arena.referenceCount(2),2);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+2*PRIVATE_LEASE_CHARGE);
 assert.throws(()=>arena.installPage(2,page()),/leased/);assert.throws(()=>arena.close(),/leases/);
 a.release();a.release();assert.equal(arena.referenceCount(2),1);b.release();assert.throws(()=>b.page,/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('initialization allocation/checkpoint failure unwinds retained physical capacity',async()=>{
 for(const cap of [0,PRIVATE_PAGE_CHARGE,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)-1]){
  const budget=new PrivateStateByteBudget(cap);await assert.rejects(open(budget));assert.equal(budget.usedBytes,0);
 }
 const primary=new Error('cancel');
 for(let fail=1;fail<=4;fail++){
  const budget=new PrivateStateByteBudget(100000);let calls=0;
  await assert.rejects(PrivateBlobkeyPages.open(budget,{async checkpoint(){if(++calls===fail)throw primary}}),e=>e===primary);
  assert.equal(budget.usedBytes,0);
 }
});
test('freeSpace coalesces adjacent blocks plus <=3 fragments and extends content boundary',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control);const b=new Uint8Array(4096);b[0]=10;u16(b,5,3000);u16(b,1,3100);b[7]=3;
 u16(b,3100,3123);u16(b,3102,10);u16(b,3123,0);u16(b,3125,10);arena.installPage(2,b);
 const lease=arena.acquire(2),page=lease.page,base=page.computeFreeSpace();page.freeSpace(3112,10);
 assert.equal(page.bytes[7],0);assert.equal(new DataView(copyBytes(page.bytes).buffer).getUint16(3102),33);assert.equal(page.computeFreeSpace(),base+10);
 page.freeSpace(3000,100);assert.equal(new DataView(copyBytes(page.bytes).buffer).getUint16(5),3133);assert.equal(new DataView(copyBytes(page.bytes).buffer).getUint16(1),0);
 lease.release();arena.close();
});
test('allocateSpace must use fitting freeblock without unconditional compaction',async()=>{
 const arena=await open(),b=page();u16(b,5,3000);u16(b,1,3500);u16(b,3502,20);arena.installPage(2,b);const lease=arena.acquire(2);
 try{assert.equal(await lease.page.allocateSpace(10,control),3510);assert.equal(new DataView(copyBytes(lease.page.bytes).buffer).getUint16(3502),10);assert.equal(new DataView(copyBytes(lease.page.bytes).buffer).getUint16(5),3000)}finally{lease.release();arena.close()}
});
test('freeblock excess0..3 removal and fragment57/58 threshold match pageFindSlot',async()=>{
 for(const [fragments,expected] of [[57,3500],[58,2990]]){
 const arena=await open(),b=page();u16(b,5,3000);u16(b,1,3500);u16(b,3502,13);b[7]=fragments;arena.installPage(2,b);const lease=arena.acquire(2);
 try{assert.equal(await lease.page.allocateSpace(10,control),expected);assert.equal(lease.page.bytes[7],fragments===57?60:58)}finally{lease.release();arena.close()}}
});
function defragFixture(two=false){const b=page();u16(b,3,two?3:2);u16(b,5,two?4004:4012);u16(b,1,4020);u16(b,4022,20);
 b.set([3,2,1,10],two?4004:4012);u16(b,8,two?4004:4012);
 if(two){u16(b,4020,4060);u16(b,4062,20);b.set([3,2,1,20],4040);u16(b,10,4040);b.set([3,2,1,30],4080);u16(b,12,4080)}else{b.set([3,2,1,20],4080);u16(b,10,4080)}return b}
test('defragmentPage one/two-block memmove adjusts physical cell slots without scratch',async()=>{
 for(const two of [false,true]){const arena=await open(),b=defragFixture(two);arena.installPage(2,b);const lease=arena.acquire(2),p=lease.page;const before=p.computeFreeSpace();
 try{await p.defragmentPage(4,control);assert.equal(p.computeFreeSpace(),before);assert.equal(new DataView(copyBytes(p.bytes).buffer).getUint16(1),0);assert.equal(p.findCell(0),(two?4004:4012)+(two?40:20));if(two)assert.equal(p.findCell(1),4060);assert.equal(p.bytes[p.findCell(0)+3],10)}finally{lease.release();arena.close()}}
});
test('defrag full reconstruction uses logical slot order and zeroes fragments',async()=>{
 const arena=await open(),b=page();u16(b,3,2);u16(b,5,4000);u16(b,8,4080);u16(b,10,4000);b.set([3,2,1,20],4080);b.set([3,2,1,10],4000);
 // Content region: 8 occupied, 88 free bytes represented as fragments.
 b[7]=88; // force full branch; free-space fixture must describe remaining content.
 // Correct native fragment counter cannot exceed60: use top4040 instead.
 u16(b,5,4040);u16(b,10,4040);b.set([3,2,1,10],4040);b[7]=48;
 arena.installPage(2,b);const lease=arena.acquire(2),p=lease.page;
 try{await p.defragmentPage(0,control);assert.equal(p.findCell(0),4092);assert.equal(p.findCell(1),4088);assert.equal(p.bytes[7],0);assert.equal(p.bytes[4095],20);assert.equal(p.bytes[4091],10)}finally{lease.release();arena.close()}
});
test('full defrag scratch peak is charged, cancellation unwinds and faults further mutation',async()=>{
 const budget=new PrivateStateByteBudget(20000),arena=await open(budget),b=page();u16(b,3,1);u16(b,5,4080);u16(b,8,4080);b.set([3,2,1,10],4080);b[7]=12;arena.installPage(2,b);
 const lease=arena.acquire(2),base=budget.usedBytes,primary=new Error('cancel scratch');
 try{await assert.rejects(lease.page.defragmentPage(0,{async checkpoint(n){if(n===4096){assert.equal(budget.usedBytes,base+5632);throw primary}}}),e=>e===primary);
 assert.equal(budget.usedBytes,base);await assert.rejects(lease.page.allocateSpace(4,control),e=>e===primary)}finally{lease.release();arena.close()}
});
test('page mutation excludes another operation across suspension',async()=>{
 const arena=await open(),lease=arena.acquire(2);let resume,entered;const start=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);
 const pending=lease.page.allocateSpace(4,{async checkpoint(){entered();await gate}});await start;
 await assert.rejects(lease.page.allocateSpace(4,control),/operation/);resume();await pending;lease.release();arena.close();
});
test('mutation requires sole lease; suspended write cannot release lease or admit alias',async()=>{
 const arena=await open(),a=arena.acquire(2),alias=arena.acquire(2);
 await assert.rejects(a.page.allocateSpace(4,control),/exclusive/);alias.release();
 let entered,resume;const start=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);
 const pending=a.page.allocateSpace(4,{async checkpoint(){entered();await gate}});await start;
 assert.throws(()=>a.release(),/operation/);assert.throws(()=>arena.acquire(2),/operation/);resume();await pending;a.release();arena.close();
});
test('allocateSpace defrag is conditional when gap lacks cell-plus-slot space',async()=>{
 const arena=await open(),b=page();u16(b,3,1);u16(b,5,10);u16(b,8,10);b.set([3,2,1,7],10);u16(b,1,14);u16(b,16,4082);arena.installPage(2,b);const lease=arena.acquire(2);
 try{assert.equal(await lease.page.allocateSpace(4080,control),12);assert.equal(lease.page.findCell(0),4092);assert.equal(lease.page.bytes[4095],7);assert.equal(new DataView(copyBytes(lease.page.bytes).buffer).getUint16(1),0)}finally{lease.release();arena.close()}
});
test('defrag malformed accounting faults page and unwinds charged scratch',async()=>{
 const arena=await open(),b=page();u16(b,3,1);u16(b,5,4080);u16(b,8,4080);b.set([3,2,1,10],4080);b[7]=11;arena.installPage(2,b);const lease=arena.acquire(2);
 try{await assert.rejects(lease.page.defragmentPage(0,control),/free-space mismatch/);assert.throws(()=>arena.acquire(2),/free-space mismatch/)}finally{lease.release();arena.close()}
});
const editRaw=(arena,pgno,edit)=>{const lease=arena.acquireRaw(pgno);const bytes=copyBytes(lease.bytes);lease.release();edit(bytes);arena.installPage(pgno,bytes)};
const u32=(b,p,n)=>(b[p]=(n>>>24)&255,b[p+1]=(n>>>16)&255,b[p+2]=(n>>>8)&255,b[p+3]=n&255);
test('physical allocate/free uses trunk and nearest leaf with retained capacity charged',async()=>{
 const budget=new PrivateStateByteBudget(50000),arena=await open(budget);
 for(let pgno=3;pgno<=6;pgno++){const lease=await arena.allocatePage(0,control);assert.equal(lease.pgno,pgno);assert.equal(arena.referenceCount(pgno),1);lease.release()}
 const retained=budget.usedBytes;await arena.freePage(3,control);await arena.freePage(4,control);await arena.freePage(6,control);
 assert.equal(budget.usedBytes,retained);let lease=await arena.allocatePage(5,control);assert.equal(lease.pgno,4,'equal distance keeps first leaf');lease.release();
 lease=await arena.allocatePage(0,control);assert.equal(lease.pgno,6,'removed slot replaced by final leaf');lease.release();
 lease=await arena.allocatePage(0,control);assert.equal(lease.pgno,3,'zero-leaf trunk extracted');lease.release();
 lease=await arena.allocatePage(0,control);assert.equal(lease.pgno,7);lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('allocator acquisition failure faults arena and cleanup collision preserves primary',async()=>{
 let armed=false;const primary=new Error('reuse acquire'),arena=await open(undefined,(event,pgno)=>{if(armed&&event==='acquire'&&pgno===4)throw primary;if(armed&&event==='release')throw new Error('cleanup collision')});
 for(let i=0;i<2;i++){const l=await arena.allocatePage(0,control);l.release()}
 await arena.freePage(3,control);await arena.freePage(4,control);armed=true;
 await assert.rejects(arena.allocatePage(0,control),e=>e===primary);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);
 await assert.rejects(arena.allocatePage(0,control),e=>e===primary);arena.close();
});
test('malformed freelist leaf is rejected after native count decrement, no rollback claimed',async()=>{
 const arena=await open();for(let i=0;i<2;i++){const l=await arena.allocatePage(0,control);l.release()}
 await arena.freePage(3,control);await arena.freePage(4,control);editRaw(arena,3,b=>u32(b,8,99));
 await assert.rejects(arena.allocatePage(0,control),/freelist leaf/);assert.equal(arena.referenceCount(3),0);arena.close();
});
test('physical allocation budget failure leaves header mutation terminal and cleans capacity',async()=>{
 const budget=new PrivateStateByteBudget((PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)),arena=await open(budget);
 await assert.rejects(arena.allocatePage(0,control),/byte/);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));assert.equal(arena.referenceCount(3),0);arena.close();assert.equal(budget.usedBytes,0);
});
test('physical allocator exclusive admission survives cancellation with noncancellable teardown',async()=>{
 const budget=new PrivateStateByteBudget(50000),arena=await open(budget);let entered,resume;const start=new Promise(r=>entered=r),gate=new Promise(r=>resume=r),primary=new Error('cancel');
 const pending=arena.allocatePage(0,{async checkpoint(){entered();await gate;throw primary}});await start;
 assert.throws(()=>arena.close(),/operation/);assert.throws(()=>arena.acquire(2),/operation/);assert.throws(()=>arena.acquireRaw(2),/operation/);
 await assert.rejects(arena.freePage(2,control),/operation/);resume();await assert.rejects(pending,e=>e===primary);arena.close();assert.equal(budget.usedBytes,0);
});
test('freePage native legacy trunk capacity1016 creates new head instead of filling six trailing slots',async()=>{
 const arena=await open();for(let i=0;i<2;i++){const l=await arena.allocatePage(0,control);l.release()}await arena.freePage(3,control);
 editRaw(arena,3,b=>u32(b,4,1016));await arena.freePage(4,control);
 const head=arena.acquireRaw(4);assert.equal(new DataView(copyBytes(head.bytes).buffer).getUint32(0),3);assert.equal(new DataView(copyBytes(head.bytes).buffer).getUint32(4),0);head.release();arena.close();
});
test('append acquisition failure retains charged physical page until last foundational close',async()=>{
 const budget=new PrivateStateByteBudget(50000),primary=new Error('append acquire'),arena=await open(budget,(event,pgno)=>{if(event==='acquire'&&pgno===3)throw primary});
 await assert.rejects(arena.allocatePage(0,control),e=>e===primary);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+3*PRIVATE_PAGE_CHARGE));assert.equal(arena.referenceCount(3),0);arena.close();assert.equal(budget.usedBytes,0);
});
test('freePage pending page/trunk leases are released despite cleanup collisions',async()=>{
 let armed=false;const primary=new Error('trunk acquire'),arena=await open(undefined,(event,pgno)=>{if(armed&&event==='acquire'&&pgno===3)throw primary;if(armed&&event==='release')throw new Error('release collision')});
 for(let i=0;i<2;i++){const l=await arena.allocatePage(0,control);l.release()}await arena.freePage(3,control);armed=true;
 await assert.rejects(arena.freePage(4,control),e=>e===primary);assert.equal(arena.referenceCount(4),0);arena.close();
});
test('fillInCell must construct charged packed2000 cell with native489 local and owned overflow',async()=>{
 const budget=new PrivateStateByteBudget(50000),arena=await open(budget),key=new Uint8Array(2000);key.set([3,0x9f,0x26]);key.fill(0x71,3);
 try{
 const cell=await arena.fillCell(2,key,control);assert.equal(cell.bytes.length,495);assert.deepEqual([...cell.bytes.subarray(0,2)],[0x8f,0x50]);assert.deepEqual(copyBytes(cell.bytes.subarray(2,491)),key.subarray(0,489));
 const overflow=new DataView(copyBytes(cell.bytes).buffer).getUint32(491);assert.equal(overflow,3);const lease=arena.acquireRaw(3);
 try{assert.equal(new DataView(copyBytes(lease.bytes).buffer).getUint32(0),0);assert.deepEqual(copyBytes(lease.bytes.subarray(4,1515)),key.subarray(489))}finally{lease.release()}
 cell.release();
 }finally{arena.close()}
});
test('fillCell two overflow pages publishes prior link before unref and zeroes new next afterwards',async()=>{
 let armed=false,newBytes;const arena=await open(undefined,(event,pgno,observed)=>{
 if(armed&&event==='release'&&pgno===4){assert.equal(new DataView(copyBytes(observed).buffer).getUint32(0),3)}
 });
 for(let i=0;i<2;i++){const l=await arena.allocatePage(0,control);l.release()}
 await arena.freePage(3,control);await arena.freePage(4,control);
 editRaw(arena,3,b=>u32(b,0,0x12345678));
 armed=true;
 const key=new Uint8Array(6000).fill(0x51);const cell=await arena.fillCell(2,key,control);armed=false;const first=new DataView(copyBytes(cell.bytes).buffer).getUint32(cell.bytes.length-4);
 assert.equal(first,4);const a=arena.acquireRaw(4);assert.equal(new DataView(copyBytes(a.bytes).buffer).getUint32(0),3);assert.deepEqual(copyBytes(a.bytes.subarray(4)),key.subarray(489,4581));a.release();
 const b=arena.acquireRaw(3);assert.equal(new DataView(copyBytes(b.bytes).buffer).getUint32(0),0);assert.deepEqual(copyBytes(b.bytes.subarray(4,1423)),key.subarray(4581));b.release();cell.release();armed=false;arena.close();
});
test('fillCell allocation/cancel error releases pending overflow and scratch despite release collision',async()=>{
 let armed=false;const primary=new Error('next allocation'),budget=new PrivateStateByteBudget(50000),arena=await open(budget,(event,pgno)=>{if(armed&&event==='allocate'&&pgno===4)throw primary;if(armed&&event==='release'&&pgno===3)throw new Error('release collision')});armed=true;
 await assert.rejects(arena.fillCell(2,new Uint8Array(6000),control),e=>e===primary);assert.equal(arena.referenceCount(3),0);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+3*PRIVATE_PAGE_CHARGE));arena.close();assert.equal(budget.usedBytes,0);
});
test('fillCell owns input before suspension, local minimum padding and interior child header',async()=>{
 const budget=new PrivateStateByteBudget(50000),arena=await open(budget);let resume,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>resume=r),key=new Uint8Array([7]);
 const pending=arena.fillCell(2,key,{async checkpoint(){entered();await gate}});await ready;key[0]=99;assert.throws(()=>arena.acquire(2),/operation/);resume();const cell=await pending;assert.deepEqual([...cell.bytes],[1,7,0,0]);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+4+PRIVATE_CELL_RESULT_CHARGE+PRIVATE_ITERATOR_CHARGE+5*PRIVATE_ITERATOR_RESULT_CHARGE);cell.release();cell.release();
 const b=page();b[0]=2;u32(b,8,2);arena.installPage(2,b);const interior=await arena.fillCell(2,new Uint8Array([8]),control);assert.deepEqual([...interior.bytes],[0,0,0,0,1,8]);interior.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('fillCell comparison-independent cancellation preserves primary and releases cell/input charges',async()=>{
 const budget=new PrivateStateByteBudget(50000),primary=new Error('copy cancelled'),arena=await open(budget);
 await assert.rejects(arena.fillCell(2,new Uint8Array(2000),{async checkpoint(){throw primary}}),e=>e===primary);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));arena.close();assert.equal(budget.usedBytes,0);
});
test('overflow-clear must return fill chain pages to native freelist without releasing retained capacity',async()=>{
 const budget=new PrivateStateByteBudget(50000),arena=await open(budget),cell=await arena.fillCell(2,new Uint8Array(6000),control);
 try{const retained=budget.usedBytes;await arena.clearCellOverflow(2,cell.bytes,control);assert.equal(budget.usedBytes,retained);cell.release();const lease=await arena.allocatePage(0,control);assert.equal(lease.pgno,4);lease.release()}finally{cell.release();arena.close()}
});
test('clear overflow expected-count ignores final next, premature link faults after first free',async()=>{
 for(const premature of [false,true]){
 const arena=await open(),cell=await arena.fillCell(2,new Uint8Array(6000),control);editRaw(arena,premature?3:4,b=>u32(b,0,premature?0:99));
 if(premature)await assert.rejects(arena.clearCellOverflow(2,cell.bytes,control),/overflow page/);else await arena.clearCellOverflow(2,cell.bytes,control);
 assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);cell.release();arena.close();
 }
});
test('clear overflow truncated raw cell fails before page acquisition and cleanup primary wins',async()=>{
 let armed=false;const primary=new Error('free checkpoint'),budget=new PrivateStateByteBudget(50000),arena=await open(budget,(event)=>{if(armed&&event==='release')throw new Error('release collision')});
 const cell=await arena.fillCell(2,new Uint8Array(2000),control);armed=true;
 await assert.rejects(arena.clearCellOverflow(2,cell.bytes,{async checkpoint(){throw primary}}),e=>e===primary);assert.equal(arena.referenceCount(3),0);cell.release();arena.close();assert.equal(budget.usedBytes,0);
 const other=await open();await assert.rejects(other.clearCellOverflow(2,new Uint8Array([0x8f,0x50]),control),/cell/);other.close();
});
test('clear uses getOverflow for nonfinal page and lookup/ref rather than reacquire supplied free page',async()=>{
 let armed=false,acquired=[];const arena=await open(undefined,(event,pgno)=>{if(armed&&event==='acquire')acquired.push(pgno)}),cell=await arena.fillCell(2,new Uint8Array(6000),control);armed=true;
 await arena.clearCellOverflow(2,cell.bytes,control);assert.deepEqual(acquired,[3,3],'first overflow fetch then trunk fetch; final lookup and supplied retain do not fetch');cell.release();arena.close();
});
test('dropCell owning caller removes slot and resets last-cell header after freeSpace',async()=>{
 const arena=await open(),b=page();u16(b,3,1);u16(b,5,4092);u16(b,8,4092);b.set([3,2,1,8],4092);arena.installPage(2,b);const l=arena.acquire(2);
 try{l.page.computeFreeSpace();await l.page.dropCell(0,4,control);assert.equal(l.page.nCell,0);assert.deepEqual([...l.page.bytes.subarray(1,8)],[0,0,0,0,16,0,0]);assert.equal(l.page.computeFreeSpace(),4088)}finally{l.release();arena.close()}
});
test('dropCell nonlast moves logical slots, preserves physical surviving cells, adds cell plus slot free',async()=>{
 const arena=await open(),b=page();u16(b,3,3);u16(b,5,4084);for(let i=0;i<3;i++){u16(b,8+2*i,4092-4*i);b.set([3,2,1,8+i],4092-4*i)}arena.installPage(2,b);const l=arena.acquire(2);
 try{assert.equal(l.page.computeFreeSpace(),4070);await l.page.dropCell(1,4,control);assert.equal(l.page.nCell,2);assert.equal(l.page.findCell(0),4092);assert.equal(l.page.findCell(1),4084);assert.equal(l.page.bytes[4087],10);assert.equal(l.page.computeFreeSpace(),4076);assert.equal(new DataView(b.buffer).getUint16(3),3);assert.equal(new DataView(copyBytes(l.page.bytes).buffer).getUint16(3),2)}finally{l.release();arena.close()}
});
test('dropCell validates bound/freeSpace before decrement and faults page on failure',async()=>{
 const arena=await open(),b=page();u16(b,3,1);u16(b,5,4092);u16(b,8,4092);b.set([3,2,1,8],4092);arena.installPage(2,b);const l=arena.acquire(2);
 try{await assert.rejects(l.page.dropCell(0,8,control),/cell/);assert.equal(l.page.nCell,1);assert.equal(new DataView(copyBytes(l.page.bytes).buffer).getUint16(3),1);assert.throws(()=>l.page.assertUsable(),/cell/)}finally{l.release();arena.close()}
});
test('dropCell suspended admission and cancellation preserve prepublication header',async()=>{
 const arena=await open(),b=page();u16(b,3,1);u16(b,5,4092);u16(b,8,4092);b.set([3,2,1,8],4092);arena.installPage(2,b);const l=arena.acquire(2);let entered,resume;const ready=new Promise(r=>entered=r),gate=new Promise(r=>resume=r),primary=new Error('drop cancelled');
 try{const p=l.page.dropCell(0,4,{async checkpoint(){entered();await gate;throw primary}});await ready;assert.throws(()=>l.release(),/operation/);assert.throws(()=>arena.acquire(2),/operation/);resume();await assert.rejects(p,e=>e===primary);assert.equal(l.page.nCell,1);assert.equal(new DataView(copyBytes(l.page.bytes).buffer).getUint16(5),4092)}finally{l.release();arena.close()}
});
test('dropCell interior last reset preserves right-child and reports header-adjusted free bytes',async()=>{
 const arena=await open(),b=page();b[0]=2;u32(b,8,77);u16(b,3,1);u16(b,5,4088);u16(b,12,4088);b.set([0,0,0,6,3,2,1,8],4088);arena.installPage(2,b);const l=arena.acquire(2);
 try{await l.page.dropCell(0,8,control);assert.equal(l.page.nCell,0);assert.equal(l.page.rightChild(),77);assert.equal(l.page.computeFreeSpace(),4084)}finally{l.release();arena.close()}
});
test('dropCell freeSpace overlap rejects before slot or nCell publication',async()=>{
 const arena=await open(),b=page();u16(b,3,2);u16(b,5,4084);u16(b,8,4092);u16(b,10,4084);b.set([3,2,1,8],4092);b.set([3,2,1,9],4084);u16(b,1,4088);u16(b,4088,0);u16(b,4090,4);arena.installPage(2,b);const l=arena.acquire(2);
 try{await assert.rejects(l.page.dropCell(1,8,control),/overlaps/);assert.equal(l.page.nCell,2);assert.equal(l.page.findCell(1),4084);assert.equal(new DataView(copyBytes(l.page.bytes).buffer).getUint16(3),2)}finally{l.release();arena.close()}
});
test('insertCell owning publication inserts logical slot, debits cell plus slot and updates header',async()=>{
 const arena=await open(),l=arena.acquire(2);
 try{
  await l.page.insertCell(0,new Uint8Array([3,2,1,9]),control);
  await l.page.insertCell(0,new Uint8Array([3,2,1,4]),control);
  assert.equal(l.page.nCell,2);
  assert.equal(new DataView(copyBytes(l.page.bytes).buffer).getUint16(3),2);
  assert.equal(l.page.computeFreeSpace(),4076);
  assert.equal(l.page.findCell(0),4088);assert.equal(l.page.findCell(1),4092);
  assert.equal(l.page.bytes[l.page.findCell(0)+3],4);
  assert.equal(l.page.bytes[l.page.findCell(1)+3],9);
 }finally{l.release();arena.close()}
});
test('insertCell interior child override and ordered staged divider copies retain charge until teardown',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),b=page();b[0]=2;u16(b,5,18);arena.installPage(2,b);const l=arena.acquire(2),cell=new Uint8Array([0,0,0,99,3,2,1,7]);
 try{await l.page.insertCell(0,cell,control,6);assert.equal(l.page.nOverflow,1);assert.equal(l.page.nCell,0);cell[7]=55;assert.deepEqual([...l.page.overflowCell(0).bytes],[0,0,0,6,3,2,1,7]);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+PRIVATE_LEASE_CHARGE+64+8+8+PRIVATE_STAGED_INSPECTION_CHARGE);await l.page.insertCell(1,cell,control,8);assert.equal(l.page.nOverflow,2);assert.equal(l.page.overflowCell(1).index,1);assert.equal(l.page.computeFreeSpace(),6)}finally{l.release();arena.close()}assert.equal(budget.usedBytes,0);
});
test('insertCell fits interior record with child replacement and leaves input intact',async()=>{
 const arena=await open(),b=page();b[0]=2;arena.installPage(2,b);const l=arena.acquire(2),cell=new Uint8Array([0,0,0,99,3,2,1,7]);try{await l.page.insertCell(0,cell,control,6);assert.equal(l.page.leftChild(0),6);assert.equal(cell[3],99);assert.equal(l.page.computeFreeSpace(),4074)}finally{l.release();arena.close()}
});
test('insertCell cancellation unwinds pending copied cell and preserves slot publication',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),l=arena.acquire(2),primary=new Error('insert cancelled');try{await assert.rejects(l.page.insertCell(0,new Uint8Array([3,2,1,7]),{async checkpoint(){throw primary}}),e=>e===primary);assert.equal(l.page.nCell,0);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+PRIVATE_LEASE_CHARGE)}finally{l.release();arena.close()}
});
test('insertCell rejects nonadjacent staged divider without publishing another entry',async()=>{
 const arena=await open(),b=page();b[0]=2;u16(b,5,18);arena.installPage(2,b);const l=arena.acquire(2),cell=new Uint8Array([0,0,0,99,3,2,1,7]);try{await l.page.insertCell(0,cell,control,6);await assert.rejects(l.page.insertCell(0,cell,control,7),/ordered overflow/);assert.equal(l.page.nOverflow,1);assert.equal(l.page.nCell,0)}finally{l.release();arena.close()}
});
test('insertCell copied-cell peak budget failure occurs before header or slot publication',async()=>{
 const budget=new PrivateStateByteBudget((PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE+PRIVATE_LEASE_CHARGE)),arena=await open(budget),l=arena.acquire(2);try{await assert.rejects(l.page.insertCell(0,new Uint8Array([3,2,1,7]),control));assert.equal(l.page.nCell,0);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE+PRIVATE_LEASE_CHARGE))}finally{l.release();arena.close()}
});
test('released last lease invalidates retained page capability before read or mutation',async()=>{
 const arena=await open(),l=arena.acquire(2),p=l.page;l.release();try{assert.throws(()=>p.findCell(0),/released|generation|lease/);assert.throws(()=>p.insertCell(0,new Uint8Array([3,2,1,7]),control),/released|generation|lease/)}finally{arena.close()}
});
test('per-lease page capability cannot resurrect on reacquire and captured methods recheck lifetime',async()=>{
 const arena=await open(),l=arena.acquire(2),p=l.page,read=p.computeFreeSpace;l.release();const next=arena.acquire(2);try{assert.notEqual(next.page,p);assert.throws(()=>p.nCell,/lease released/);assert.throws(()=>p.bytes,/lease released/);assert.throws(()=>read(),/lease released/);assert.equal(next.page.computeFreeSpace(),4088)}finally{next.release();arena.close()}
});
test('releasing one alias revokes only its page capability',async()=>{
 const arena=await open(),a=arena.acquire(2),b=arena.acquire(2),old=a.page;a.release();try{assert.throws(()=>old.computeFreeSpace(),/lease released/);assert.equal(b.page.computeFreeSpace(),4088)}finally{b.release();arena.close()}
});
test('retained byte view is revoked with lease rather than escaping page capability',async()=>{
 const arena=await open(),l=arena.acquire(2),bytes=l.page.bytes;l.release();try{assert.throws(()=>bytes[0],/lease released/)}finally{arena.close()}
});
test('byte capability closes subarray, method, buffer and iterator escapes',async()=>{
 const arena=await open(),l=arena.acquire(2),bytes=l.page.bytes,sub=bytes.subarray(0,8),iter=bytes.values(),get=bytes.at;assert.throws(()=>bytes.buffer,/buffer|export/);assert.equal(iter.next().value,10);l.release();try{assert.throws(()=>sub[0],/lease released/);assert.throws(()=>get(0),/lease released/);assert.throws(()=>iter.next(),/lease released/)}finally{arena.close()}
});
test('raw allocation and fill result byte capabilities revoke on release',async()=>{
 const arena=await open(),raw=await arena.allocatePage(0,control),bytes=raw.bytes,sub=bytes.subarray(0,4);raw.release();assert.throws(()=>sub[0],/released/);const filled=await arena.fillCell(2,new Uint8Array([2,1,7]),control),cell=filled.bytes;filled.release();try{assert.throws(()=>cell[0],/released/)}finally{arena.close()}
});
test('arena close disposes retained auxiliary fill results and revokes views without double release',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget);
 const first=await arena.fillCell(2,new Uint8Array([2,1,7]),control);
 const second=await arena.fillCell(2,new Uint8Array([2,1,9]),control);
 const bytes=first.bytes,sub=second.bytes.subarray(0,4);
 assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+8+2*PRIVATE_CELL_RESULT_CHARGE+PRIVATE_SUBVIEW_CHARGE);
 arena.close();
 // Private terminal disposal owns both retained physical pages and auxiliary
 // cell buffers. Explicit later release/close must remain idempotent.
 assert.equal(budget.usedBytes,0);
 assert.throws(()=>bytes[0],/released|closed/);
 assert.throws(()=>sub[0],/released|closed/);
 first.release();second.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('rejected leased close preserves retained result until successful disposal',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),cell=await arena.fillCell(2,new Uint8Array([2,1,7]),control),lease=arena.acquire(2);
 assert.throws(()=>arena.close(),/outstanding leases/);assert.equal(cell.bytes[3],7);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+PRIVATE_LEASE_CHARGE+4+PRIVATE_CELL_RESULT_CHARGE);
 lease.release();cell.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('terminal fault disposal revokes previously published auxiliary result and clears all charges',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),cell=await arena.fillCell(2,new Uint8Array([2,1,7]),control),primary=new Error('stop fill');
 await assert.rejects(arena.fillCell(2,new Uint8Array(2000),{async checkpoint(){throw primary}}),e=>e===primary);
 assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+4+PRIVATE_CELL_RESULT_CHARGE);arena.close();assert.equal(budget.usedBytes,0);assert.throws(()=>cell.bytes[0],/released/);cell.release();
});
test('cancelled fill checkpoints before taking a whole-input snapshot',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget);let copied=0;
 class ObservedInput extends Uint8Array {slice(start,end){copied+=this.subarray(start,end).length;return super.slice(start,end)}}
 const key=new ObservedInput(12000),primary=new Error('cancel before snapshot');
 await assert.rejects(arena.fillCell(2,key,{async checkpoint(){throw primary}}),e=>e===primary);
 // Source pSrc is borrowed synchronously; async ownership adaptation must admit
 // cancellation before copying, and not hide O(nKey) work before first yield.
 assert.equal(copied,0);assert.equal(arena.pageCount,2);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));arena.close();assert.equal(budget.usedBytes,0);
});
test('synchronous snapshot probe admits bounded copy before first async suspension',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),key=new Uint8Array(12000).fill(7),probes=[];
 const cell=await arena.fillCell(2,key,{snapshotCheckpoint(n){probes.push(n)},async checkpoint(){key.fill(99)}});
 assert.deepEqual(probes,[0,4096,4096,3808]);assert.equal(cell.bytes[2],7);
 const overflow=arena.acquireRaw(3);assert.equal(overflow.bytes[4],7);overflow.release();cell.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('synchronous snapshot probe cancellation releases pending charge before publication',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),primary=new Error('snapshot cancel');let asyncCalls=0;
 await assert.rejects(arena.fillCell(2,new Uint8Array(12000),{snapshotCheckpoint(){throw primary},async checkpoint(){asyncCalls++}}),e=>e===primary);
 assert.equal(asyncCalls,0);assert.equal(arena.pageCount,2);assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));arena.close();
});
test('fill result metadata cannot be admitted on a physical-buffer-only budget',async()=>{
 // Four-byte native minimum cell and one-byte copied input exhaust this budget.
 // A retained result also owns a registry node/release token/capability metadata;
 // deterministic allowance must be positive and included at peak, not heap-estimated.
 const budget=new PrivateStateByteBudget((PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+5),arena=await open(budget);
 await assert.rejects(arena.fillCell(2,new Uint8Array([7]),control),/byte limit/);
 assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));arena.close();assert.equal(budget.usedBytes,0);
});
test('result allowance is admitted at exact peak and released once after publication or failure',async()=>{
 const peak=(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE)+5+PRIVATE_CELL_RESULT_CHARGE;
 const budget=new PrivateStateByteBudget(peak),arena=await open(budget);let observed;
 const result=await arena.fillCell(2,new Uint8Array([7]),{async checkpoint(){observed=budget.usedBytes}});
 assert.equal(observed,peak);assert.equal(budget.usedBytes,peak-1);result.release();result.release();assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));arena.close();assert.equal(budget.usedBytes,0);
 const failedBudget=new PrivateStateByteBudget(peak),failed=await open(failedBudget),primary=new Error('pending result cancellation');
 await assert.rejects(failed.fillCell(2,new Uint8Array([7]),{async checkpoint(){assert.equal(failedBudget.usedBytes,peak);throw primary}}),e=>e===primary);
 assert.equal(failedBudget.usedBytes,(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE));failed.close();assert.equal(failedBudget.usedBytes,0);
});
test('pending arena owner metadata is charged before its first asynchronous checkpoint',async()=>{
 const budget=new PrivateStateByteBudget(100000);let observed;
 const primary=new Error('arena admission cancelled');
 await assert.rejects(PrivateBlobkeyPages.open(budget,{async checkpoint(){observed=budget.usedBytes;throw primary}}),e=>e===primary);
 assert.ok(observed>0,'arena object/maps/registry descriptors cannot be retained for free while suspended');
 assert.equal(budget.usedBytes,0);
});
test('arena base admission and rejected leased close preserve exact allowance lifetime',async()=>{
 const tooSmall=new PrivateStateByteBudget(PRIVATE_ARENA_CHARGE-1);let calls=0;
 await assert.rejects(PrivateBlobkeyPages.open(tooSmall,{async checkpoint(){calls++}}),/byte limit/);assert.equal(calls,0);assert.equal(tooSmall.usedBytes,0);
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),lease=arena.acquire(2),base=budget.usedBytes;
 assert.equal(base,PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE+PRIVATE_LEASE_CHARGE);assert.throws(()=>arena.close(),/leases/);assert.equal(budget.usedBytes,base);
 lease.release();arena.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('independent page lease capabilities have separate retained metadata admission',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),base=budget.usedBytes;
 const first=arena.acquire(2),one=budget.usedBytes;assert.ok(one>base,'lease revocation/view/release metadata cannot alias physical page allowance');
 const second=arena.acquire(2);assert.ok(budget.usedBytes>one,'distinct alias lease owns distinct revocation capability');
 first.release();assert.equal(budget.usedBytes,one);second.release();assert.equal(budget.usedBytes,base);arena.close();assert.equal(budget.usedBytes,0);
});
test('raw lease alias metadata refunds before throwing release observer; init failure preserves primary',async()=>{
 const budget=new PrivateStateByteBudget(100000),primary=new Error('init primary'),cleanup=new Error('release cleanup');let failInit=false,failRelease=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event)=>{if(failInit&&event==='init')throw primary;if(failRelease&&event==='release')throw cleanup});const base=budget.usedBytes;
 const a=arena.acquireRaw(2),b=arena.acquireRaw(2);assert.equal(budget.usedBytes,base+2*PRIVATE_LEASE_CHARGE);
 failRelease=true;assert.throws(()=>a.release(),e=>e===cleanup);a.release();assert.equal(budget.usedBytes,base+PRIVATE_LEASE_CHARGE);assert.throws(()=>a.bytes[0],/released/);
 assert.throws(()=>b.release(),e=>e===cleanup);assert.equal(budget.usedBytes,base);failInit=true;assert.throws(()=>arena.acquire(2),e=>e===primary);assert.equal(arena.referenceCount(2),0);assert.equal(budget.usedBytes,base);arena.close();assert.equal(budget.usedBytes,0);
});
test('lease budget admission fails without taking a reference or publishing capability',async()=>{
 const budget=new PrivateStateByteBudget(PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE),arena=await open(budget),base=budget.usedBytes;
 assert.throws(()=>arena.acquire(2),/byte limit/);assert.throws(()=>arena.acquireRaw(2),/byte limit/);assert.equal(arena.referenceCount(2),0);assert.equal(budget.usedBytes,base);arena.close();assert.equal(budget.usedBytes,0);
});
test('retained borrowed byte subviews cannot multiply uncharged capability metadata',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),lease=arena.acquireRaw(2),base=budget.usedBytes;
 const views=[lease.bytes.subarray(0,8),lease.bytes.subarray(0,8)];assert.equal(views[0][0],10);
 assert.ok(budget.usedBytes>base,'distinct borrowed subview proxies and revocation closures require admitted metadata');
 lease.release();assert.throws(()=>views[0][0],/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('subview budget rejection precedes publication and nested index views refund on revocation',async()=>{
 const cap=PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE+PRIVATE_LEASE_CHARGE+2*PRIVATE_SUBVIEW_CHARGE,budget=new PrivateStateByteBudget(cap),arena=await open(budget),lease=arena.acquire(2);
 const a=lease.page.bytes.subarray(0,8),b=a.subarray(0,1);assert.equal(b[0],10);assert.equal(budget.usedBytes,cap);
 assert.throws(()=>b.subarray(0,1),/byte limit/);assert.equal(budget.usedBytes,cap);lease.release();lease.release();assert.equal(budget.usedBytes,PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE);assert.throws(()=>b[0],/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('release observer subviews are charged during hook and refunded despite primary cleanup collision',async()=>{
 const budget=new PrivateStateByteBudget(100000);let escaped,seen;const cleanup=new Error('observer failure');
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,p,bytes)=>{if(event==='release'&&bytes){escaped=bytes.subarray(0,1);seen=budget.usedBytes;throw cleanup}});
 const base=budget.usedBytes,lease=arena.acquireRaw(2);assert.throws(()=>lease.release(),e=>e===cleanup);assert.equal(seen,base+PRIVATE_SUBVIEW_CHARGE);assert.equal(budget.usedBytes,base);assert.throws(()=>escaped[0],/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('retained borrowed byte iterators require separate admitted capability metadata',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),lease=arena.acquireRaw(2),base=budget.usedBytes;
 const iterators=[lease.bytes.values(),lease.bytes.values()];assert.deepEqual(iterators[0].next(),{done:false,value:10});
 assert.ok(budget.usedBytes>base,'distinct iterator state and revocation methods cannot multiply within fixed acquisition allowance');
 lease.release();assert.throws(()=>iterators[1].next(),/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('all borrowed iterator factories admit before publication and revoke together',async()=>{
 const base=PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE,budget=new PrivateStateByteBudget(base+PRIVATE_LEASE_CHARGE+4*PRIVATE_ITERATOR_CHARGE+3*PRIVATE_ITERATOR_RESULT_CHARGE),arena=await open(budget),lease=arena.acquireRaw(2);
 const values=lease.bytes.values(),keys=lease.bytes.keys(),entries=lease.bytes.entries(),implicit=lease.bytes[Symbol.iterator]();assert.equal(budget.usedBytes,base+PRIVATE_LEASE_CHARGE+4*PRIVATE_ITERATOR_CHARGE);
 assert.deepEqual(keys.next(),{done:false,value:0});assert.deepEqual(entries.next(),{done:false,value:[0,10]});assert.equal(implicit[Symbol.iterator](),implicit);
 assert.throws(()=>lease.bytes.values(),/byte limit/);assert.equal(arena.referenceCount(2),1);lease.release();lease.release();assert.equal(budget.usedBytes,base);for(const iterator of [values,keys,entries,implicit])assert.throws(()=>iterator.next(),/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('retained borrowed byte method wrappers cannot multiply uncharged capabilities',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),lease=arena.acquireRaw(2),base=budget.usedBytes;
 const methods=[lease.bytes.at,lease.bytes.at];assert.equal(methods[0](0),10);
 if(methods[0]!==methods[1])assert.ok(budget.usedBytes>base,'distinct retained revocation wrappers require separate metadata admission');
 lease.release();assert.throws(()=>methods[1](0),/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('byte method tables are bounded per view and all captured wrapper classes revoke',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),lease=arena.acquireRaw(2),bytes=lease.bytes;
 const keys=['at','set','fill','copyWithin','indexOf','lastIndexOf','includes','join','toString','values','keys','entries',Symbol.iterator,'subarray','valueOf'];
 const base=budget.usedBytes,methods=keys.map(k=>bytes[k]);for(let n=0;n<100;n++)for(let i=0;i<keys.length;i++)assert.equal(bytes[keys[i]],methods[i]);assert.equal(budget.usedBytes,base);
 const sub=bytes.subarray(0,1);assert.notEqual(sub.at,bytes.at);assert.equal(sub.at,sub.at);assert.equal(sub.at(0),10);
 lease.release();for(const method of methods)assert.throws(()=>method(),/released/);assert.throws(()=>sub.at,/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('write-side key admission rejects configured oversized payload before ownership work',async()=>{
 const budget=new PrivateStateByteBudget(100000);let work=0;
 // Explicit proposed arena admission seam; read-side cursor limits alone cannot
 // protect fillInCell producers. Configuration must be enforced, not ignored.
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxEntries:1,maxKeyBytes:2,maxBytes:100000});const base=budget.usedBytes;
 await assert.rejects(arena.fillCell(2,new Uint8Array([1,2,3]),{snapshotCheckpoint(){work++},async checkpoint(){work++}}),/key.*byte limit/);
 assert.equal(work,0);assert.equal(budget.usedBytes,base);arena.close();assert.equal(budget.usedBytes,0);
});
test('write key limit is inclusive, copied configuration, and retryable without arena fault',async()=>{
 const budget=new PrivateStateByteBudget(100000),limits={maxKeyBytes:2},arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);limits.maxKeyBytes=100;
 const base=budget.usedBytes;await assert.rejects(arena.fillCell(2,new Uint8Array(3),control),/key.*byte limit/);assert.equal(budget.usedBytes,base);
 const cell=await arena.fillCell(2,new Uint8Array([1,2]),control);cell.release();assert.equal(budget.usedBytes,base);arena.close();assert.equal(budget.usedBytes,0);
});
test('invalid write key configuration rejects before arena reservation or checkpoint',async()=>{
 for(const maxKeyBytes of [-1,NaN,Infinity,1.5]){const budget=new PrivateStateByteBudget(100000);let work=0;await assert.rejects(PrivateBlobkeyPages.open(budget,{async checkpoint(){work++}},()=>{},{maxKeyBytes}),/invalid.*key byte limit/);assert.equal(work,0);assert.equal(budget.usedBytes,0)}
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:0});const cell=await arena.fillCell(2,new Uint8Array(),control);cell.release();await assert.rejects(arena.fillCell(2,new Uint8Array(1),control),/key.*byte limit/);arena.close();assert.equal(budget.usedBytes,0);
});
test('captured derived-page methods cannot multiply uncharged lease capabilities',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),lease=arena.acquire(2),base=budget.usedBytes;
 const methods=[lease.page.parseCell,lease.page.parseCell];assert.throws(()=>methods[0](0),/cell|index|range/);
 if(methods[0]!==methods[1])assert.ok(budget.usedBytes>base,'distinct retained page method wrappers require metadata admission');
 lease.release();assert.throws(()=>methods[1](0),/released/);arena.close();assert.equal(budget.usedBytes,0);
});
test('derived-page cached methods preserve sync and async revocation per acquisition',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),a=arena.acquire(2),b=arena.acquire(2),base=budget.usedBytes;
 const sync=a.page.parseCell,asyncMethod=a.page.allocateSpace;
 for(let i=0;i<100;i++){assert.equal(a.page.parseCell,sync);assert.equal(a.page.allocateSpace,asyncMethod)}
 assert.notEqual(b.page.parseCell,sync);assert.equal(budget.usedBytes,base);a.release();assert.throws(()=>sync(0),/released/);await assert.rejects(asyncMethod(4,control),/released/);assert.throws(()=>b.page.parseCell(0),/cell|index|range/);b.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('resident publication enforces arena key admission even for caller-built cells',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:2}),lease=arena.acquire(2),base=budget.usedBytes;
 await assert.rejects(lease.page.insertCell(0,new Uint8Array([3,2,1,10]),control),/byte limit/);
 assert.equal(lease.page.nCell,0);assert.equal(budget.usedBytes,base);lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('insert admission is inclusive retryable and precedes staging/checkpoints',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3}),lease=arena.acquire(2);
 let work=0;const ctl={async checkpoint(){work++}};
 await assert.rejects(lease.page.insertCell(0,new Uint8Array([4,2,1,10,0]),ctl),/byte limit/);assert.equal(work,0);assert.equal(lease.page.nOverflow,0);
 await lease.page.insertCell(0,new Uint8Array([3,2,1,10]),ctl);assert.equal(lease.page.nCell,1);assert.equal(lease.page.parseCell(0).nPayload,3);
 lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('arena entry admission bounds caller publication before a second resident cell',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:1}),lease=arena.acquire(2);
 await lease.page.insertCell(0,new Uint8Array([3,2,1,10]),control);const base=budget.usedBytes;
 await assert.rejects(lease.page.insertCell(1,new Uint8Array([3,2,1,20]),control),/entry limit/);
 assert.equal(lease.page.nCell,1);assert.equal(budget.usedBytes,base);lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('entry admission is arena-wide and drop returns capacity without changing byte budget policy',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:1});arena.installPage(3,page());
 const a=arena.acquire(2),b=arena.acquire(3),cell=new Uint8Array([3,2,1,10]);await a.page.insertCell(0,cell,control);
 await assert.rejects(b.page.insertCell(0,cell,control),/entry limit/);assert.equal(b.page.nCell,0);
 await a.page.dropCell(0,4,control);await b.page.insertCell(0,cell,control);a.release();b.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('construction entries count before derived init and replacement rejection leaves old page intact',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:1});
 const fixture=page();u16(fixture,3,1);u16(fixture,5,4092);u16(fixture,8,4092);fixture.set([3,2,1,10],4092);arena.installPage(2,fixture);
 assert.throws(()=>arena.installPage(3,fixture),/entry limit/);assert.equal(arena.pageCount,2);
 arena.installPage(2,page());const lease=arena.acquire(2);await lease.page.insertCell(0,new Uint8Array([3,2,1,20]),control);lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('failed unpublished entry reservation is returned to other pages in faulted owner',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:1});arena.installPage(3,page());
 const a=arena.acquire(2),b=arena.acquire(3),cell=new Uint8Array([3,2,1,10]),primary=new Error('entry checkpoint');
 await assert.rejects(a.page.insertCell(0,cell,{async checkpoint(){throw primary}}),e=>e===primary);
 await b.page.insertCell(0,cell,control);a.release();b.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('staged entries retain admission until foundational staging disposal',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:682});const full=page();u16(full,3,681);u16(full,5,1372);
 for(let i=0;i<681;i++){u16(full,8+2*i,1372+4*i);full.set([3,2,1,10],1372+4*i)}arena.installPage(2,full);
 const lease=arena.acquire(2),cell=new Uint8Array([3,2,1,20]);await lease.page.insertCell(681,cell,control);assert.equal(lease.page.nOverflow,1);
 await assert.rejects(lease.page.insertCell(682,cell,control),/entry limit/);lease.page.releaseStagedCells();await lease.page.insertCell(681,cell,control);assert.equal(lease.page.nOverflow,1);
 lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('borrowed iterator next results cannot accumulate unadmitted retained metadata',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget),raw=arena.acquireRaw(2),iterator=raw.bytes.entries(),base=budget.usedBytes;
 const first=iterator.next(),second=iterator.next();assert.deepEqual(first.value,[0,10]);assert.deepEqual(second.value,[1,0]);
 if(first!==second)assert.ok(budget.usedBytes>base,'distinct retained iterator results and entry tuples require metadata admission');
 raw.release();arena.close();assert.equal(budget.usedBytes,0);
});

test('iterator result admission fails before advancement and refunds done and tuple capacities on release',async()=>{
 const base=PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE+PRIVATE_LEASE_CHARGE+PRIVATE_SUBVIEW_CHARGE+PRIVATE_ITERATOR_CHARGE;
 const budget=new PrivateStateByteBudget(base+2*PRIVATE_ITERATOR_RESULT_CHARGE),arena=await open(budget),lease=arena.acquireRaw(2),it=lease.bytes.subarray(0,1).entries();
 const first=it.next();assert.deepEqual(first,{done:false,value:[0,10]});assert.equal(budget.usedBytes,base+2*PRIVATE_ITERATOR_RESULT_CHARGE);
 assert.throws(()=>it.next(),/byte limit/);assert.equal(budget.usedBytes,base+2*PRIVATE_ITERATOR_RESULT_CHARGE);lease.release();assert.deepEqual(first.value,[0,10]);assert.throws(()=>it.next(),/released/);arena.close();assert.equal(budget.usedBytes,0);
 const b=new PrivateStateByteBudget(100000),a=await open(b),l=a.acquireRaw(2),empty=l.bytes.subarray(0,0).values(),before=b.usedBytes;
 assert.deepEqual(empty.next(),{done:true,value:undefined});assert.deepEqual(empty.next(),{done:true,value:undefined});assert.equal(b.usedBytes,before+2*PRIVATE_ITERATOR_RESULT_CHARGE);l.release();a.close();assert.equal(b.usedBytes,0);
});
test('staged inspection cannot publish repeated owned cell copies without byte admission',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:682}),full=page();u16(full,3,681);u16(full,5,1372);
 for(let i=0;i<681;i++){u16(full,8+2*i,1372+4*i);full.set([3,2,1,10],1372+4*i)}arena.installPage(2,full);
 const lease=arena.acquire(2);await lease.page.insertCell(681,new Uint8Array([3,2,1,20]),control);const base=budget.usedBytes;
 const first=lease.page.overflowCell(0),second=lease.page.overflowCell(0);assert.deepEqual(first.bytes,new Uint8Array([3,2,1,20]));assert.notEqual(first.bytes,second.bytes);
 assert.ok(budget.usedBytes>base,'distinct staged inspection buffers and result metadata require admission');
 lease.release();arena.close();assert.equal(budget.usedBytes,0);
});

test('staged inspection exact admission rejects before copy and teardown refunds once',async()=>{
 const base=PRIVATE_ARENA_CHARGE+2*PRIVATE_PAGE_CHARGE+PRIVATE_LEASE_CHARGE;
 const budget=new PrivateStateByteBudget(base+4096+64+4+4+PRIVATE_STAGED_INSPECTION_CHARGE),arena=await open(budget),full=page();u16(full,3,681);u16(full,5,1372);
 for(let i=0;i<681;i++){u16(full,8+2*i,1372+4*i);full.set([3,2,1,10],1372+4*i)}arena.installPage(2,full);
 const lease=arena.acquire(2);await lease.page.insertCell(681,new Uint8Array([3,2,1,20]),control);
 budget.reserve(4096);const copy=lease.page.overflowCell(0);assert.equal(budget.usedBytes,base+4096+64+8+PRIVATE_STAGED_INSPECTION_CHARGE);
 assert.throws(()=>lease.page.overflowCell(0),/byte limit/);assert.equal(lease.page.nOverflow,1);assert.deepEqual(copy.bytes,new Uint8Array([3,2,1,20]));
 budget.release(4096);lease.page.releaseStagedCells();assert.equal(budget.usedBytes,base);lease.page.releaseStagedCells();assert.equal(budget.usedBytes,base);assert.deepEqual(copy.bytes,new Uint8Array([3,2,1,20]));lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('invalid and zero maxEntries reject before admission or entry publication',async()=>{
 for(const maxEntries of [-1,NaN,Infinity,0.5]){
  const budget=new PrivateStateByteBudget(100000);let calls=0;
  await assert.rejects(PrivateBlobkeyPages.open(budget,{async checkpoint(){calls++}},()=>{},{maxKeyBytes:3,maxEntries}),/entry limit/);assert.equal(calls,0);assert.equal(budget.usedBytes,0);
 }
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:0}),lease=arena.acquire(2),base=budget.usedBytes;let calls=0;
 await assert.rejects(lease.page.insertCell(0,new Uint8Array([3,2,1,10]),{async checkpoint(){calls++}}),/entry limit/);assert.equal(calls,0);assert.equal(lease.page.nCell,0);assert.equal(budget.usedBytes,base);lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('freePage removes resident entry admission and freelist reuse retains no phantom count',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:3,maxEntries:1}),cell=new Uint8Array([3,2,1,10]);arena.installPage(3,page());
 let lease=arena.acquire(3);await lease.page.insertCell(0,cell,control);lease.release();await arena.freePage(3,control);
 lease=arena.acquire(2);await lease.page.insertCell(0,cell,control);await lease.page.dropCell(0,4,control);lease.release();
 const reused=await arena.allocatePage(3,control);assert.equal(reused.pgno,3);reused.release();arena.installPage(3,page());lease=arena.acquire(3);await lease.page.insertCell(0,cell,control);assert.equal(lease.page.nCell,1);lease.release();arena.close();assert.equal(budget.usedBytes,0);
});
test('pending cell owns a descriptor allowance until staging disposal',async()=>{
 const {PrivateIndexPage}=await import('../../src/internal/private-blobkey-pages.ts');const budget=new PrivateStateByteBudget(20000),p=new PrivateIndexPage(3,page(),{reserve:n=>budget.reserve(n),release:n=>budget.release(n)});
 const cell=new Uint8Array(1004);cell.set([0x87,0x6a]); // payload1002, wholly local extent1004
 for(let i=0;i<4;i++)await p.insertCell(i,cell,control);
 assert.equal(budget.usedBytes,0);await p.insertCell(4,cell,control);
 assert.equal(p.nOverflow,1);assert.equal(budget.usedBytes,cell.length+64);
 p.releaseStagedCells();assert.equal(budget.usedBytes,0);
});
test('fillCell previous unref failure after link publication cleans newly allocated pending page preserving primary',async()=>{
 let armed=false;const events=[],primary=new Error('prior overflow unref'),secondary=new Error('pending overflow cleanup'),budget=new PrivateStateByteBudget(100000);
 const arena=await open(budget,(event,p,bytes)=>{if(!armed||event!=='release')return;events.push(p);if(p===3){assert.equal(bytes[3],4,'new pgno link published before old unref');throw primary}if(p===4)throw secondary});
 try{armed=true;await assert.rejects(arena.fillCell(2,new Uint8Array(6000).fill(7),control),e=>e===primary);assert.deepEqual(events,[3,4]);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);assert.equal(budget.usedBytes,PRIVATE_ARENA_CHARGE+4*PRIVATE_PAGE_CHARGE);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
test('allocator successful leaf acquisition then trunk cleanup failure releases pending result and preserves primary',async()=>{
 let armed=false;const events=[],primary=new Error('allocator trunk cleanup'),secondary=new Error('allocator result cleanup'),budget=new PrivateStateByteBudget(100000);
 const arena=await open(budget,(event,p)=>{if(armed&&event==='release'){events.push(p);if(p===3)throw primary;if(p===4)throw secondary}});
 try{for(let i=0;i<2;i++){const lease=await arena.allocatePage(0,control);lease.release()}await arena.freePage(3,control);await arena.freePage(4,control);const base=budget.usedBytes;armed=true;
 await assert.rejects(arena.allocatePage(0,control),e=>e===primary);assert.deepEqual(events,[3,4]);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);assert.equal(budget.usedBytes,base);await assert.rejects(arena.allocatePage(0,control),e=>e===primary);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
test('allocator nearest scan cancellation cleans trunk and preserves primary over release failure',async()=>{
 let armed=false;const primary=new Error('nearest scan interrupted'),secondary=new Error('trunk cleanup'),budget=new PrivateStateByteBudget(100000),arena=await open(budget,(event,p)=>{if(armed&&event==='release'&&p===3)throw secondary});
 try{for(let i=0;i<4;i++){const lease=await arena.allocatePage(0,control);lease.release()}for(const p of [3,4,5,6])await arena.freePage(p,control);const base=budget.usedBytes;armed=true;let scans=0;
 await assert.rejects(arena.allocatePage(5,{async checkpoint(n){if(n===1&&++scans===2)throw primary}}),e=>e===primary);assert.equal(scans,2);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);assert.equal(arena.referenceCount(5),0);assert.equal(arena.referenceCount(6),0);assert.equal(budget.usedBytes,base);await assert.rejects(arena.allocatePage(0,control),e=>e===primary);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
test('freelist leaf allocator charges simultaneous trunk and result lease at exact capacity',async()=>{
 for(const room of [2*PRIVATE_LEASE_CHARGE-1,2*PRIVATE_LEASE_CHARGE]){
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget);let filler=0,peak=0,watch=false;const reserve=budget.reserve.bind(budget);
 budget.reserve=n=>{reserve(n);if(watch)peak=Math.max(peak,budget.usedBytes)};
 try{for(let i=0;i<2;i++){const lease=await arena.allocatePage(0,control);lease.release()}await arena.freePage(3,control);await arena.freePage(4,control);const base=budget.usedBytes;filler=budget.maxBytes-base-room;budget.reserve(filler);watch=true;
 if(room===2*PRIVATE_LEASE_CHARGE){const lease=await arena.allocatePage(0,control);assert.equal(lease.pgno,4);assert.equal(peak,budget.maxBytes);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),1);assert.equal(budget.usedBytes,base+filler+PRIVATE_LEASE_CHARGE);lease.release()}
 else{await assert.rejects(arena.allocatePage(0,control),/byte limit/);assert.equal(peak,base+filler+PRIVATE_LEASE_CHARGE);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0)}
 assert.equal(budget.usedBytes,base+filler);
 }finally{watch=false;budget.release(filler);arena.close();assert.equal(budget.usedBytes,0)}
 }
});
test('raw lease producer owns page identity for allocator transfer without wrapper descriptor',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await open(budget);
 try{const allocated=await arena.allocatePage(0,control);assert.equal(allocated.pgno,3);allocated.release();const raw=arena.acquireRaw(3);try{assert.equal(raw.pgno,3);assert.equal(arena.referenceCount(raw.pgno),1)}finally{raw.release()}raw.release();assert.equal(arena.referenceCount(3),0)}finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('fillCell preallocated two-overflow peak conserves input result and simultaneous leases',async()=>{
 const charge=6000+495+PRIVATE_CELL_RESULT_CHARGE+2*PRIVATE_LEASE_CHARGE;
 for(const room of [charge-1,charge]){const budget=new PrivateStateByteBudget(100000),arena=await open(budget);let filler=0,watch=false,peak=0;const reserve=budget.reserve.bind(budget);budget.reserve=n=>{reserve(n);if(watch)peak=Math.max(peak,budget.usedBytes)};
 try{for(let i=0;i<2;i++){const l=await arena.allocatePage(0,control);l.release()}await arena.freePage(3,control);await arena.freePage(4,control);const base=budget.usedBytes;filler=budget.maxBytes-base-room;budget.reserve(filler);watch=true;
 if(room===charge){const cell=await arena.fillCell(2,new Uint8Array(6000),control);assert.equal(peak,budget.maxBytes);assert.equal(budget.usedBytes,base+filler+495+PRIVATE_CELL_RESULT_CHARGE);cell.release()}
 else await assert.rejects(arena.fillCell(2,new Uint8Array(6000),control),/byte limit/);
 assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);assert.equal(budget.usedBytes,base+filler);
 }finally{watch=false;budget.release(filler);arena.close();assert.equal(budget.usedBytes,0)}}
});

test('full defrag admits buffer plus transient derived descriptor policy before allocation',async()=>{
 // Policy inventory: page/state256 + eight capability records/closures128 each
 // + default scratch128 + transient parse result128. Not native sizeof parity.
 const scratchPeak=4096+1536;
 for(const available of [scratchPeak,scratchPeak-1]){
 const budget=new PrivateStateByteBudget(available),b=page();u16(b,3,1);u16(b,5,4092);u16(b,8,4092);b.set([3,2,1,7],4092);
 const p=new PrivateIndexPage(2,b,{reserve:n=>budget.reserve(n),release:n=>budget.release(n)});
 let checkpoints=0;
 const ctl={async checkpoint(n){checkpoints++;if(checkpoints===1)assert.equal(budget.usedBytes,scratchPeak)}};
 if(available===scratchPeak){await p.defragmentPage(-1,ctl);assert.equal(p.findCell(0),4092);assert.equal(b[4095],7)}
 else{const original=b.slice();await assert.rejects(p.defragmentPage(-1,ctl),/byte/);assert.equal(checkpoints,0);assert.deepEqual(b,original)}
 assert.equal(budget.usedBytes,0);
 }
});

test('full defrag transient metadata refunds cancellation before construction and after first copy',async()=>{
 for(const stop of [1,3]){
 const budget=new PrivateStateByteBudget(5632),b=page();u16(b,3,2);u16(b,5,4088);u16(b,8,4088);u16(b,10,4092);b.set([3,2,1,7,3,2,1,8],4088);
 const original=b.slice(),primary=new Error('defrag cancellation'),p=new PrivateIndexPage(2,b,{reserve:n=>budget.reserve(n),release:n=>budget.release(n)});let calls=0;
 await assert.rejects(p.defragmentPage(-1,{async checkpoint(){assert.equal(budget.usedBytes,5632);if(++calls===stop)throw primary}}),e=>e===primary);
 assert.equal(calls,stop);assert.equal(budget.usedBytes,0);
 if(stop===1)assert.deepEqual(b,original);else assert.equal(new DataView(b.buffer).getUint16(8),4092);
 await assert.rejects(p.defragmentPage(-1,control),e=>e===primary);
 assert.equal(budget.usedBytes,0);
 }
});
