import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor,PRIVATE_CURSOR_CHARGE,PRIVATE_ARENA_CHARGE,PRIVATE_LEASE_CHARGE,PRIVATE_SUBVIEW_CHARGE,PRIVATE_ITERATOR_CHARGE, PRIVATE_ITERATOR_RESULT_CHARGE} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo,UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const control={async checkpoint(){}};
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:100000};
const put2=(b,p,n)=>new DataView(b.buffer).setUint16(p,n);
function fixture(values,children=null){const b=new Uint8Array(4096);b[0]=children?2:10;put2(b,3,values.length);let top=4096;
 for(let i=0;i<values.length;i++){const cell=children?[0,0,0,children[i],3,2,1,values[i]]:[3,2,1,values[i]];top-=cell.length;b.set(cell,top);put2(b,(children?12:8)+2*i,top)}
 put2(b,5,top);if(children)new DataView(b.buffer).setUint32(8,children.at(-1));return b;
}
function key(n,rc=0){const m=new Mem();m.setInt64(BigInt(n));return new UnpackedRecordKey([m],rc,'seek',info)}
async function seek(c,n,rc=0,ctl=control){const k=key(n,rc);try{const result=await c.indexMoveto(k,ctl);return {...result,eqSeen:k.eqSeen}}finally{k.release()}}
async function open(hook=()=>{}){const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,hook,limits);return {arena,budget,cursor:new PrivateBlobkeyCursor(arena,info,limits)}}
test('empty signed success and leaf signed current-vs-target, not GE/LE',async()=>{
 const {arena,cursor:c}=await open();assert.deepEqual(await seek(c,1),{res:-1,state:'INVALID',page:2,index:0,epoch:0,eqSeen:false});c.close();
 arena.installPage(2,fixture([10,20,30]));const d=new PrivateBlobkeyCursor(arena,info,limits);
 for(const [n,sign] of [[5,1],[10,0],[25,1],[40,-1]])assert.equal((await seek(d,n)).res,sign);
 assert.equal(d.position.index,2);d.close();arena.close();
});
test('defaultRc +/-1 preserves eqSeen independently of signed result',async()=>{
 const {arena,cursor:c}=await open();arena.installPage(2,fixture([10]));
 for(const rc of [-1,0,1]){const r=await seek(c,10,rc);assert.equal(r.res,rc);assert.equal(r.eqSeen,true)}
 c.close();arena.close();
});
test('interior equality owns divider; descend keeps parent child slots',async()=>{
 const {arena,cursor:c}=await open();arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([5,10]));arena.installPage(4,fixture([25,30]));
 assert.equal((await seek(c,20)).page,2);assert.equal((await seek(c,10)).page,3);assert.deepEqual(c.position.parents,[{page:2,slot:0}]);
 assert.equal((await seek(c,30)).page,4);assert.deepEqual(c.position.parents,[{page:2,slot:1}]);
 const calls=[];await seek(c,40,0,{async checkpoint(n){calls.push(n)}});assert.equal(c.position.page,4);assert.deepEqual(calls,[9,4],'last-cell shortcut does not reacquire root');
 c.close();arena.close();
});
test('failed child acquisition restores parent and ix0; close releases full stack',async()=>{
 let enabled=false;const primary=new Error('child acquire');
 const {arena,cursor:c,budget}=await open((e,p)=>{if(enabled&&e==='acquire'&&p===3)throw primary});
 arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([10]));arena.installPage(4,fixture([30]));enabled=true;
 await assert.rejects(seek(c,10),e=>e===primary);assert.equal(c.position.page,2);assert.equal(c.position.index,0);assert.deepEqual(c.position.parents,[]);assert.equal(arena.referenceCount(2),1);
 c.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('root empty interior and empty child reject as corrupt, not empty success',async()=>{
 for(const rootEmpty of [true,false]){const {arena,cursor:c}=await open();arena.installPage(2,fixture(rootEmpty?[]:[20],[3,3]));arena.installPage(3,fixture([]));await assert.rejects(seek(c,10),/empty interior|empty child/);c.close();arena.close()}
});
test('async exclusive operation admission and closed/released key rejection',async()=>{
 const {arena,cursor:c}=await open();arena.installPage(2,fixture([10]));let resume,entered;const begun=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);
 const pending=seek(c,10,0,{async checkpoint(){entered();await gate}});await begun;
 await assert.rejects(seek(c,20),/operation/);assert.throws(()=>c.close(),/operation/);resume();await pending;c.close();await assert.rejects(seek(c,10),/closed/);arena.close();
});
test('overflow seek acceptance: packed key reconstructed through overflow page',async()=>{
 const {arena,cursor:c}=await open();const b=new Uint8Array(4096);b[0]=10;put2(b,3,1);put2(b,5,3500);put2(b,8,3500);
 // 2000-byte packed record: header 3, serialType4006 BLOB(1997).
 // This record is source-format constructed independently of owner routines.
 const packed=new Uint8Array(2000);packed.set([3,0x9f,0x26]);packed.fill(7,3);
 b.set([0x8f,0x50],3500);b.set(packed.subarray(0,489),3502);new DataView(b.buffer).setUint32(3991,3);
 const overflow=new Uint8Array(4096);overflow.set(packed.subarray(489),4);arena.installPage(2,b);arena.installPage(3,overflow);
 const m=new Mem();m.setBlob(new Uint8Array(1997).fill(7));const k=new UnpackedRecordKey([m],0,'seek',info);
 try{assert.equal((await c.indexMoveto(k,control)).res,0);assert.equal(k.eqSeen,true)}finally{k.release();c.close();arena.close()}
});
function overflowFixture(next=0){const b=new Uint8Array(4096);b[0]=10;put2(b,3,1);put2(b,5,3500);put2(b,8,3500);const record=new Uint8Array(2000);record.set([3,0x9f,0x26]);record.fill(7,3);b.set([0x8f,0x50],3500);b.set(record.subarray(0,489),3502);new DataView(b.buffer).setUint32(3991,next);return b}
test('premature/out-of-range overflow chains release scratch; retained cache freed on close',async()=>{
 for(const next of [0,99]){const {arena,cursor:c,budget}=await open();arena.installPage(2,overflowFixture(next));const base=budget.usedBytes;
 await assert.rejects(seek(c,1),/overflow chain|page number/);assert.ok(budget.usedBytes<=base+8+PRIVATE_LEASE_CHARGE+PRIVATE_SUBVIEW_CHARGE);c.close();assert.equal(budget.usedBytes,base-PRIVATE_CURSOR_CHARGE);arena.close();assert.equal(budget.usedBytes,0)}
});
test('overflow copy cancellation preserves primary over raw release collision',async()=>{
 let enabled=false;const primary=new Error('cancel'),cleanup=new Error('cleanup');
 const {arena,cursor:c,budget}=await open((event,p)=>{if(enabled&&event==='release'&&p===3)throw cleanup});arena.installPage(2,overflowFixture(3));arena.installPage(3,new Uint8Array(4096));const base=budget.usedBytes;enabled=true;
 await assert.rejects(seek(c,1,0,{async checkpoint(units){if(units===1511)throw primary}}),e=>e===primary);
 assert.equal(arena.referenceCount(3),0);assert.equal(budget.usedBytes,base+8+PRIVATE_LEASE_CHARGE+PRIVATE_SUBVIEW_CHARGE);c.close();assert.equal(budget.usedBytes,base-PRIVATE_CURSOR_CHARGE);arena.close();
});
test('overflow two pages uses packed BLOB identity and frees scratch at comparison failure',async()=>{
 const {arena,cursor:c,budget}=await open();const packed=new Uint8Array(6000);packed.set([3,0xdd,0x66]);packed.fill(8,3); // serial11998 => BLOB5997
 const b=new Uint8Array(4096);b[0]=10;put2(b,3,1);put2(b,5,3500);put2(b,8,3500);b.set([0xae,0x70],3500);b.set(packed.subarray(0,489),3502);new DataView(b.buffer).setUint32(3991,3);
 const p3=new Uint8Array(4096),p4=new Uint8Array(4096);new DataView(p3.buffer).setUint32(0,4);p3.set(packed.subarray(489,4581),4);p4.set(packed.subarray(4581),4);
 arena.installPage(2,b);arena.installPage(3,p3);arena.installPage(4,p4);const base=budget.usedBytes;
 const m=new Mem();m.setBlob(new Uint8Array(5997).fill(8));const k=new UnpackedRecordKey([m],0,'seek',info);
 try{assert.equal((await c.indexMoveto(k,control)).res,0);assert.equal(budget.usedBytes,base+16+PRIVATE_LEASE_CHARGE+PRIVATE_SUBVIEW_CHARGE+64);
 const primary=new Error('comparison checkpoint');await assert.rejects(c.indexMoveto(k,{async checkpoint(n){if(n===6001)throw primary}}),e=>e===primary);
 assert.equal(budget.usedBytes,base+16+PRIVATE_LEASE_CHARGE+2*PRIVATE_SUBVIEW_CHARGE+64);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);
 }finally{k.release();c.close();arena.close()}
});
test('cursor metadata admission cannot consume zero aggregate bytes before first seek',async()=>{
 // Native caller allocates a BtCursor even before a page is positioned. The
 // private object retains state, overflow-cache descriptor and parent-stack
 // descriptor. A physical-pages-only budget cannot admit these for free.
 const budget=new PrivateStateByteBudget((PRIVATE_ARENA_CHARGE+2*(4096+128))),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 assert.throws(()=>new PrivateBlobkeyCursor(arena,info,{...limits,maxBytes:budget.maxBytes}),/byte limit/);
 assert.equal(budget.usedBytes,(PRIVATE_ARENA_CHARGE+2*(4096+128)));arena.close();assert.equal(budget.usedBytes,0);
});
test('unpositioned cursor charge survives arena close until explicit idempotent cursor close',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),base=budget.usedBytes;
 const c=new PrivateBlobkeyCursor(arena,info,limits);assert.ok(budget.usedBytes>base);
 arena.close();assert.ok(budget.usedBytes>0);c.close();c.close();assert.equal(budget.usedBytes,0);
 assert.throws(()=>new PrivateBlobkeyCursor(arena,info,limits),/closed/);assert.equal(budget.usedBytes,0);
});
test('seek must own unpacked target while comparison checkpoint suspends',async()=>{
 const {arena,cursor:c}=await open();arena.installPage(2,fixture([10]));const k=key(10);let resume,enter;
 const gate=new Promise(r=>resume=r),ready=new Promise(r=>enter=r);
 const pending=c.indexMoveto(k,{async checkpoint(){enter();await gate}});await ready;k.release();resume();
 try{assert.equal((await pending).res,0)}finally{c.close();arena.close()}
});
test('large owned BLOB target copies in bounded nonyielding probe chunks before await',async()=>{
 const {arena,cursor:c,budget}=await open();const m=new Mem();m.setBlob(new Uint8Array(5997));const k=new UnpackedRecordKey([m],0,'seek',info),units=[],base=budget.usedBytes;
 await c.indexMoveto(k,{snapshotCheckpoint(n){units.push(n)},async checkpoint(){k.release()}});
 assert.deepEqual(units,[0,1,4096,1901]);assert.equal(budget.usedBytes,base+PRIVATE_LEASE_CHARGE+64);c.close();arena.close();
});
test('target snapshot probe failure releases pending allowance before any page lease',async()=>{
 const {arena,cursor:c,budget}=await open();const base=budget.usedBytes,k=key(10),primary=new Error('target probe');
 await assert.rejects(c.indexMoveto(k,{snapshotCheckpoint(n){if(n)throw primary},async checkpoint(){throw new Error('unexpected async')}}),e=>e===primary);
 assert.equal(budget.usedBytes,base);assert.equal(arena.referenceCount(2),0);k.release();c.close();arena.close();
});
test('retained parent stack slot is charged independently of target snapshot and pages',async()=>{
 const {arena,cursor:c,budget}=await open();arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([5,10]));arena.installPage(4,fixture([25,30]));
 const base=budget.usedBytes;await seek(c,10);assert.equal(c.position.parents.length,1);
 assert.ok(budget.usedBytes>base,'retained parent slot must not be free after transient target disposal');
 c.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('stack capacity stays charged across root rewind and failed child acquisition until close',async()=>{
 let fail=false;const {arena,cursor:c,budget}=await open((event,pg)=>{if(fail&&event==='acquire'&&pg===3)throw new Error('child acquire')});
 arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([5,10]));arena.installPage(4,fixture([25,30]));
 const base=budget.usedBytes;await seek(c,10);const retained=budget.usedBytes;assert.ok(retained>base);
 await seek(c,20);assert.equal(c.position.parents.length,0);assert.equal(budget.usedBytes,retained-PRIVATE_LEASE_CHARGE-2*PRIVATE_SUBVIEW_CHARGE-PRIVATE_ITERATOR_CHARGE-2*PRIVATE_ITERATOR_RESULT_CHARGE+128);
 fail=true;await assert.rejects(seek(c,10),/child acquire/);assert.equal(c.position.page,2);assert.equal(c.position.parents.length,0);assert.equal(budget.usedBytes,retained-PRIVATE_LEASE_CHARGE+256);
 c.close();c.close();assert.equal(budget.usedBytes,base-PRIVATE_CURSOR_CHARGE);arena.close();assert.equal(budget.usedBytes,0);
});
test('stack growth admission fails before child publication and releases only transient target',async()=>{
 const physical=PRIVATE_ARENA_CHARGE+4*(4096+128),budget=new PrivateStateByteBudget(physical+PRIVATE_CURSOR_CHARGE+PRIVATE_LEASE_CHARGE+264),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([5,10]));arena.installPage(4,fixture([25,30]));const c=new PrivateBlobkeyCursor(arena,info,{...limits,maxBytes:budget.maxBytes});
 await assert.rejects(seek(c,10),/byte limit/);assert.equal(c.position.page,2);assert.equal(c.position.parents.length,0);assert.equal(arena.referenceCount(3),0);
 assert.equal(budget.usedBytes,physical+PRIVATE_CURSOR_CHARGE+PRIVATE_LEASE_CHARGE+128);c.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('cursor resource admission cannot be relaxed by mutating caller limits after publication',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);arena.installPage(2,fixture([10]));
 const configured={maxEntries:100,maxKeyBytes:2,maxBytes:100000},cursor=new PrivateBlobkeyCursor(arena,info,configured);configured.maxKeyBytes=10000;
 await assert.rejects(seek(cursor,10),/byte limit/);
 cursor.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('cursor copied key limit cannot be tightened externally and invalid limit owns no allowance',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);arena.installPage(2,fixture([10]));
 const configured={maxEntries:100,maxKeyBytes:10000,maxBytes:100000},cursor=new PrivateBlobkeyCursor(arena,info,configured);configured.maxKeyBytes=0;
 assert.equal((await seek(cursor,10)).res,0);cursor.close();const base=budget.usedBytes;
 for(const maxKeyBytes of [-1,NaN,Infinity,1.5]){assert.throws(()=>new PrivateBlobkeyCursor(arena,info,{...limits,maxKeyBytes}),/invalid.*key byte limit/);assert.equal(budget.usedBytes,base)}
 arena.close();assert.equal(budget.usedBytes,0);
});
test('retained position snapshots cannot manufacture unadmitted parent metadata',async()=>{
 const {arena,cursor:c,budget}=await open();arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([5,10]));arena.installPage(4,fixture([25,30]));await seek(c,10);
 const base=budget.usedBytes,first=c.position,second=c.position;assert.deepEqual(first.parents,[{page:2,slot:0}]);assert.deepEqual(second.parents,first.parents);assert.notEqual(first.parents,second.parents);
 assert.ok(budget.usedBytes>base,'distinct retained position results and parent arrays require metadata admission');
 c.close();arena.close();assert.equal(budget.usedBytes,0);
});

test('position copy admission is retryable and close refunds once without revoking copies',async()=>{
 const {arena,cursor:c,budget}=await open();arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([5,10]));arena.installPage(4,fixture([25,30]));await seek(c,10);
 const base=budget.usedBytes,pressure=100000-base-96;budget.reserve(pressure);
 const copy=c.position;assert.equal(budget.usedBytes,100000);assert.throws(()=>c.position,/byte limit/);assert.equal(budget.usedBytes,100000);
 budget.release(pressure);c.close();c.close();assert.deepEqual(copy.parents,[{page:2,slot:0}]);assert.throws(()=>c.position,/closed/);arena.close();assert.equal(budget.usedBytes,0);
});
test('empty IndexMoveto result exports admit retained result metadata independently of current lease',async()=>{
 const {arena,cursor:c,budget}=await open();const first=await seek(c,10),base=budget.usedBytes,second=await seek(c,10);
 assert.deepEqual(first,second);assert.equal(second.res,-1);assert.equal(second.state,'INVALID');assert.notEqual(first,second);
 assert.ok(budget.usedBytes>base,'each successful IndexMoveto publishes independent result metadata requiring admission');
 c.close();arena.close();assert.equal(budget.usedBytes,0);
});

test('IndexMoveto result admission failure preserves cleanup and retry with independent copies',async()=>{
 const {arena,cursor:c,budget}=await open();const copy=await seek(c,1),base=budget.usedBytes;
 // Target snapshot transient:128 key +128 Mem +8 integer bytes. Leave exactly
 // that capacity, so result reserve fails while snapshot still owns its charge.
 const pressure=100000-base-264;budget.reserve(pressure);
 await assert.rejects(seek(c,1),/byte limit/);assert.equal(budget.usedBytes,base+pressure);assert.equal(arena.referenceCount(2),1);
 budget.release(pressure);assert.equal((await seek(c,1)).res,-1);assert.equal(budget.usedBytes,base+64);
 c.close();c.close();assert.equal(copy.res,-1);assert.equal(copy.state,'INVALID');arena.close();assert.equal(budget.usedBytes,0);
});
test('cursor validates all owned resource scalars before cursor admission',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),base=budget.usedBytes;
 for(const field of ['maxEntries','maxBytes'])for(const value of [-1,NaN,Infinity,0.5,Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>new PrivateBlobkeyCursor(arena,info,{...limits,[field]:value}),/limit/);assert.equal(budget.usedBytes,base);
 }
 arena.close();assert.equal(budget.usedBytes,0);
 // Valid boundary domains require matching publication authority, not ignored scalars.
 for(const maxEntries of [0,Number.MAX_SAFE_INTEGER]){
  const b=new PrivateStateByteBudget(100000),a=await PrivateBlobkeyPages.open(b,control,()=>{},{...limits,maxEntries}),before=b.usedBytes;
  const c=new PrivateBlobkeyCursor(a,info,{...limits,maxEntries});assert.equal(b.usedBytes,before+PRIVATE_CURSOR_CHARGE);c.close();assert.equal(b.usedBytes,before);a.close();assert.equal(b.usedBytes,0);
 }
});
test('cursor byte limit cannot silently disagree with aggregate admission authority',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),base=budget.usedBytes;
 // A zero byte configuration is valid, but cannot admit a retained128-byte
 // cursor under a silently unrelated aggregate limit.
 for(const maxBytes of [0,99999,100001,Number.MAX_SAFE_INTEGER]){
  assert.throws(()=>new PrivateBlobkeyCursor(arena,info,{...limits,maxBytes}),/byte limit.*mismatch/);assert.equal(budget.usedBytes,base);
 }
 const c=new PrivateBlobkeyCursor(arena,info,{...limits,maxBytes:budget.maxBytes});assert.equal(budget.usedBytes,base+PRIVATE_CURSOR_CHARGE);c.close();assert.equal(budget.usedBytes,base);
 arena.close();assert.equal(budget.usedBytes,0);
});
test('cursor entry authority cannot silently disagree with arena publication limit',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:10000,maxEntries:1}),base=budget.usedBytes;
 // Admission belongs to page publication, not seek-time counting. A cursor
 // claiming zero or larger capacity cannot silently name a different owner.
 for(const maxEntries of [0,2,Number.MAX_SAFE_INTEGER]){
  assert.throws(()=>new PrivateBlobkeyCursor(arena,info,{...limits,maxEntries}),/entry limit.*mismatch/);assert.equal(budget.usedBytes,base);
 }
 const c=new PrivateBlobkeyCursor(arena,info,{...limits,maxEntries:1});c.close();assert.equal(budget.usedBytes,base);arena.close();assert.equal(budget.usedBytes,0);
});
test('last-page shortcut comparison corruption falls back to root search',async()=>{
 const {arena,budget,cursor}=await open();
 arena.installPage(2,fixture([10],[3,4]));arena.installPage(3,fixture([5]));
 const leaf=fixture([15,20,30]);const first=new DataView(leaf.buffer).getUint16(8);leaf[first+1]=4; // packed header exceeds three-byte payload, structurally valid Btree cell
 arena.installPage(4,leaf);
 assert.equal((await seek(cursor,30)).res,0);
 // Native indexCellCompare records corruption in errCode, disqualifies bypass,
 // clears it, rewinds and seeks25 via divider10 then cells20/30 (never bad15).
 const r=await seek(cursor,25);assert.equal(r.page,4);assert.equal(r.index,2);assert.equal(r.res,1);assert.equal(r.eqSeen,false);
 cursor.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('shortcut fallback does not suppress ordinary corruption or checkpoint errors',async()=>{
 const {arena,budget,cursor}=await open();const leaf=fixture([10,20,30]);const first=new DataView(leaf.buffer).getUint16(8);leaf[first+1]=4;arena.installPage(2,leaf);
 await seek(cursor,30);
 const primary=new Error('probe checkpoint cancelled');let calls=0;
 // Target ownership is first checkpoint; last-cell shortcut is second.
 await assert.rejects(seek(cursor,25,0,{async checkpoint(){if(++calls===2)throw primary}}),e=>e===primary);assert.equal(calls,2);
 // A target below the malformed first cell must encounter it again in normal
 // binary search after failed probe; suppression is shortcut-only.
 await assert.rejects(seek(cursor,5),/record header/);
 cursor.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('last-page shortcut cell bounds return unknown before full root search',async()=>{
 const {arena,budget,cursor}=await open();arena.installPage(2,fixture([10],[3,4]));arena.installPage(3,fixture([5]));
 const leaf=fixture([15,20,30]);const first=new DataView(leaf.buffer).getUint16(8);leaf[first]=4; // local payload extends one byte beyond page end
 arena.installPage(4,leaf);assert.equal((await seek(cursor,30)).res,0);
 // indexCellCompare's one-byte branch guards pCell+nCell>=aDataEnd with99.
 // Normal root/binary search25 need not parse that corrupt first cell.
 const r=await seek(cursor,25);assert.equal(r.page,4);assert.equal(r.index,2);assert.equal(r.res,1);
 cursor.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('raw two-byte bounds and longer prefixes disqualify last-page probes',async()=>{
 for(const prefix of [[0x81,0],[0x81,0x80]]){
  const {arena,budget,cursor}=await open();arena.installPage(2,fixture([10],[3,4]));arena.installPage(3,fixture([5]));const leaf=fixture([15,20,30]);const first=new DataView(leaf.buffer).getUint16(8);leaf.set(prefix,first);arena.installPage(4,leaf);
  await seek(cursor,30);const r=await seek(cursor,25);assert.equal(r.page,4);assert.equal(r.index,2);assert.equal(r.res,1);
  cursor.close();arena.close();assert.equal(budget.usedBytes,0);
 }
});
test('valid last-page bypass retains child stack and current producer leases across seeks',async()=>{
 const {arena,budget,cursor}=await open();arena.installPage(2,fixture([10],[3,4]));arena.installPage(3,fixture([5]));arena.installPage(4,fixture([15,20,30]));
 await seek(cursor,30);const calls=[];const r=await seek(cursor,25,0,{async checkpoint(n){calls.push(n)}});
 assert.equal(r.res,1);assert.equal(r.page,4);assert.equal(r.index,2);assert.deepEqual(calls,[9,4,4,4,4]);
 assert.deepEqual(cursor.position.parents,[{page:2,slot:1}]);
 assert.equal(arena.referenceCount(2),1);assert.equal(arena.referenceCount(4),1);
 assert.throws(()=>arena.installPage(4,fixture([16])),/lease|reference/);
 const k=key(30);k.eqSeen=true;k.errCode=11;
 assert.equal((await cursor.indexMoveto(k,control)).res,0);assert.equal(k.eqSeen,true);assert.equal(k.errCode,0);k.release();
 cursor.close();arena.installPage(4,fixture([16]));const next=new PrivateBlobkeyCursor(arena,info,limits);const after=await seek(next,16);assert.equal(after.res,0);assert.ok(after.epoch>r.epoch);next.close();arena.close();assert.equal(budget.usedBytes,0);
});
function rawLeaf(record){const b=new Uint8Array(4096);b[0]=10;put2(b,3,1);const top=4096-Math.max(4,1+record.length);b[top]=record.length;b.set(record,top+1);put2(b,5,top);put2(b,8,top);return b}
test('packed/unpacked seek matrix preserves numeric, NULL, BLOB, encoding and KeyInfo identity',async()=>{
 const cases=[
  {record:[2,6,0x7f,0xff,0xff,0xff,0xff,0xff,0xff,0xff],set:m=>m.setInt64(9223372036854775807n)},
  {record:[2,7,0x3f,0xf8,0,0,0,0,0,0],set:m=>m.setDouble(1.5)},
  {record:[2,0],set:m=>m.setNull(),term:{nullsLarge:true}},
  {record:[2,14,0xff],set:m=>m.setBlob(Uint8Array.of(0xff)),term:{desc:true}},
  ...['utf-8','utf-16le','utf-16be'].map(encoding=>({encoding,record:encoding==='utf-8'?[2,15,65]:encoding==='utf-16le'?[2,17,65,0]:[2,17,0,65],set:m=>m.setText(Uint8Array.of(97),'utf-8'),term:{collation:'nocase',desc:true}})),
 ];
 for(const c of cases){
  const ki=new KeyInfo({encoding:c.encoding??'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[c.term??{}]});const budget=new PrivateStateByteBudget(100000);const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);arena.installPage(2,rawLeaf(c.record));const cursor=new PrivateBlobkeyCursor(arena,ki,limits);
  for(const rc of [-1,0,1]){const m=new Mem();c.set(m);const k=new UnpackedRecordKey([m],rc,'seek',ki);const r=await cursor.indexMoveto(k,control);assert.equal(r.res,rc);assert.equal(k.eqSeen,true);k.release()}
  cursor.close();arena.close();assert.equal(budget.usedBytes,0);
 }
});
test('borrowed serial7 decoding preserves IEEE bits without buffer export',async()=>{
 const {RawRecordReader}=await import('../../src/internal/record.ts');
 const {arena,budget,cursor}=await open();cursor.close();
 for(const [bytes,classification] of [[[0x80,0,0,0,0,0,0,0],'finite'],[[0x7f,0xf0,0,0,0,0,0,0],'infinity'],[[0x7f,0xf8,0,0,0,0,0,1],'nan']]){
  arena.installPage(2,rawLeaf([2,7,...bytes]));const lease=arena.acquire(2);const cell=lease.page.parseCell(0);const payload=lease.page.bytes.subarray(cell.payloadOffset,cell.payloadOffset+cell.nPayload);assert.throws(()=>payload.buffer,/buffer export/);
  const value=new RawRecordReader(payload,'utf-8').next();assert.equal(value.classification,classification);assert.equal(value.bits,bytes.reduce((n,b)=>(n<<8n)|BigInt(b),0n));if(bytes[0]===0x80)assert.equal(Object.is(value.value,-0),true);lease.release();assert.throws(()=>payload[0],/released/);
 }
 arena.close();assert.equal(budget.usedBytes,0);
});
test('probe work/cancel/deadline failures unwind target ownership before page admission',async()=>{
 for(const label of ['work','cancel','deadline']){
  const {arena,budget,cursor}=await open();const base=budget.usedBytes;const m=new Mem();m.setBlob(new Uint8Array(5997));const k=new UnpackedRecordKey([m],0,'seek',info);const primary=new Error(label);let units=0,asyncCalls=0;
  await assert.rejects(cursor.indexMoveto(k,{snapshotCheckpoint(n){units+=n;if(units>=4096)throw primary},async checkpoint(){asyncCalls++}}),e=>e===primary);
  assert.equal(asyncCalls,0);assert.equal(arena.referenceCount(2),0);assert.equal(budget.usedBytes,base);assert.equal(k.values[0].diagnostic().byteLength,5997);
  k.release();assert.equal((await seek(cursor,1)).state,'INVALID');cursor.close();arena.close();assert.equal(budget.usedBytes,0);
 }
});
test('typed seek ordering crosses DESC NULL-large collation and INTEGER/REAL boundaries',async()=>{
 const cases=[
  {record:[2,0],set:m=>m.setInt64(0n),term:{},sign:-1},
  {record:[2,0],set:m=>m.setInt64(0n),term:{nullsLarge:true},sign:1},
  {record:[2,1,2],set:m=>m.setDouble(1.5),term:{},sign:1},
  {record:[2,1,2],set:m=>m.setDouble(1.5),term:{desc:true},sign:-1},
  {record:[2,14,255],set:m=>m.setText(Uint8Array.of(122),'utf-8'),term:{},sign:1},
  {record:[2,19,97,32,32],set:m=>m.setText(Uint8Array.of(97),'utf-8'),term:{collation:'rtrim'},sign:0},
 ];
 for(const c of cases){const ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[c.term]});const budget=new PrivateStateByteBudget(100000);const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);arena.installPage(2,rawLeaf(c.record));const cursor=new PrivateBlobkeyCursor(arena,ki,limits);const m=new Mem();c.set(m);const k=new UnpackedRecordKey([m],0,'seek',ki);const r=await cursor.indexMoveto(k,control);assert.equal(r.res,c.sign);assert.equal(k.eqSeen,c.sign===0);k.release();cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('overflow cache retries failed read then repeated seeks never reuse stale comparison or borrowed target',async()=>{
 let fail=false;const primary=new Error('overflow acquire');const {arena,budget,cursor}=await open((event,p)=>{if(fail&&event==='acquire'&&p===3)throw primary});arena.installPage(2,overflowFixture(3));const overflow=new Uint8Array(4096);overflow.fill(7,4,1515);arena.installPage(3,overflow);
 const run=async(byte,rc=0)=>{const m=new Mem();m.setBlob(new Uint8Array(1997).fill(byte));const k=new UnpackedRecordKey([m],rc,'seek',info);try{const r=await cursor.indexMoveto(k,control);return {...r,eqSeen:k.eqSeen}}finally{k.release()}};
 fail=true;await assert.rejects(run(7),e=>e===primary);assert.equal(arena.referenceCount(3),0);fail=false;
 for(const [byte,rc,sign,eq] of [[7,0,0,true],[6,0,1,false],[8,0,-1,false],[7,-1,-1,true],[7,1,1,true],[7,0,0,true]]){const r=await run(byte,rc);assert.equal(r.res,sign);assert.equal(r.eqSeen,eq);assert.equal(arena.referenceCount(3),0)}
 cursor.close();arena.close();assert.equal(budget.usedBytes,0);
});
test('seven-byte interior divider may end exactly at usableSize without child acquisition',async()=>{
 for(const offset of [4086,4087,4088,4089]){
  const acquired=[];const {arena,budget,cursor}=await open((event,p)=>{if(event==='acquire')acquired.push(p)});
  const page=new Uint8Array(4096);page[0]=2;put2(page,3,1);put2(page,5,offset);put2(page,12,offset);new DataView(page.buffer).setUint32(8,4);page.set([0,0,0,3,2,2,8],offset);arena.installPage(2,page);
  try{const r=await seek(cursor,0);assert.equal(r.res,0);assert.equal(r.state,'VALID');assert.equal(r.page,2);assert.equal(r.index,0);assert.deepEqual(acquired,[2])}finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});
test('interior divider actual payload overrun remains corruption',async()=>{
 const {arena,budget,cursor}=await open();const page=new Uint8Array(4096);page[0]=2;put2(page,3,1);put2(page,5,4089);put2(page,12,4089);new DataView(page.buffer).setUint32(8,4);page.set([0,0,0,3,3,2,8],4089);arena.installPage(2,page);
 try{await assert.rejects(seek(cursor,0),/cell.*(outside|beyond)/)}finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('IndexMoveto overflow comparison clears ValidOvfl after payload read before success or comparator failure',async()=>{
 const {arena,budget,cursor}=await open();arena.installPage(2,overflowFixture(3));const overflow=new Uint8Array(4096);overflow.fill(7,4,1515);arena.installPage(3,overflow);
 const m=new Mem();m.setBlob(new Uint8Array(1997).fill(7));const key=new UnpackedRecordKey([m],0,'seek',info);
 try{assert.equal((await cursor.indexMoveto(key,control)).res,0);assert.equal(cursor.position.overflowValid,false);
 const primary=new Error('post payload compare');await assert.rejects(cursor.indexMoveto(key,{async checkpoint(n){if(n===2001)throw primary}}),e=>e===primary);assert.equal(cursor.position.overflowValid,false);assert.equal(arena.referenceCount(3),0);
 }finally{key.release();cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('seek resets stale errCode before target snapshot failure and preserves caller eqSeen on retry',async()=>{
 const {arena,budget,cursor}=await open();arena.installPage(2,fixture([10,20,30]));await seek(cursor,20);const k=key(30);k.errCode=11;k.eqSeen=true;const primary=new Error('target snapshot reset');
 try{await assert.rejects(cursor.indexMoveto(k,{snapshotCheckpoint(){throw primary},async checkpoint(){}}),e=>e===primary);assert.equal(k.errCode,0);assert.equal(k.eqSeen,true);assert.equal(cursor.position.state,'VALID');assert.equal(cursor.position.index,1);assert.equal((await cursor.indexMoveto(k,control)).res,0);assert.equal(k.errCode,0);assert.equal(k.eqSeen,true)}finally{k.release();cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('First/Next visits index interior records and resets empty/EOF positions',async()=>{
 const {arena,cursor:c,budget}=await open();
 arena.installPage(2,fixture([20,40],[3,4,5]));
 arena.installPage(3,fixture([10,15]));arena.installPage(4,fixture([25,30]));arena.installPage(5,fixture([45,50]));
 const read=()=>c.withPayload(control,bytes=>Array.from(bytes));
 for(let run=0;run<2;run++){
  const values=[];if(await c.first(control))do{values.push((await read())[2])}while(await c.next(control));
  assert.deepEqual(values,[10,15,20,25,30,40,45,50]);
  assert.equal(await c.next(control),false);
  await assert.rejects(read(),/unpositioned/);
 }
 c.close();arena.close();assert.equal(budget.usedBytes,0);
});

test('scan controls release path after failure and permit a fresh First',async()=>{
 const {arena,cursor:c}=await open();arena.installPage(2,fixture([20],[3,4]));arena.installPage(3,fixture([10]));arena.installPage(4,fixture([30]));
 let units=0;const fail={async checkpoint(){if(++units===2)throw new Error('scan interrupted')}};
 await assert.rejects(c.first(fail),/scan interrupted/);
 assert.equal(await c.first(control),true);assert.equal(await c.next(control),true);
 assert.equal((await c.withPayload(control,b=>Array.from(b)))[2],20);
 await assert.rejects(c.withPayload(control,()=>{throw new Error('consumer failed')}),/consumer failed/);
 assert.equal(await c.next(control),true);assert.equal(await c.next(control),false);
 c.close();arena.close();
});

test('scan payload overflow owns snapshot through callback and preserves cancellation over release',async()=>{
 let enabled=false;const primary=new Error('payload cancelled'),cleanup=new Error('raw release');
 const {arena,cursor:c,budget}=await open((event,p)=>{if(enabled&&event==='release'&&p===3)throw cleanup});
 arena.installPage(2,overflowFixture(3));const ov=new Uint8Array(4096);ov.fill(7,4,1515);arena.installPage(3,ov);
 assert.equal(await c.first(control),true);const base=budget.usedBytes;
 let held;
 await c.withPayload(control,bytes=>{assert.equal(bytes.length,2000);assert.equal(bytes[1999],7);held=budget.usedBytes;});
 assert.ok(held>base);const after=budget.usedBytes;assert.equal(after,base+64); // retained raw access metadata
 enabled=true;
 await assert.rejects(c.withPayload({async checkpoint(units){if(units===1511)throw primary}},()=>{}),e=>e===primary);
 assert.equal(arena.referenceCount(3),0);assert.equal(budget.usedBytes,after+64); // second raw descriptor retained until arena close
 enabled=false;assert.equal(await c.next(control),false);c.close();arena.close();assert.equal(budget.usedBytes,0);
});

test('Next restores saved key and consumes signed SKIPNEXT in scan direction',async()=>{
 for(const replacement of [[10,20,30],[10,25,30],[10,15],[]]){
  const {arena,cursor:c,budget}=await open();
  try{arena.installPage(2,fixture([10,20,30]));await seek(c,20);await c.saveCursorPosition(control);
   arena.installPage(2,fixture(replacement));
   const has=await c.next(control);
   const expected=replacement.includes(20)?30:replacement.includes(25)?25:null;
   assert.equal(has,expected!==null);
   if(has)assert.equal(await c.withPayload(control,b=>b[2]),expected);
   assert.equal(await c.next(control),expected===25);
  }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});

test('First abandons saved position',async()=>{
 const {arena,cursor:c,budget}=await open();
 try{arena.installPage(2,fixture([10,20,30]));await seek(c,20);await c.saveCursorPosition(control);
  assert.equal(await c.first(control),true);assert.equal(await c.withPayload(control,b=>b[2]),10);
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('FAULT First/Next preserve terminal primary without control work',async()=>{
 const primary=new Error('clear faults scan');let armed=false;
 const {arena,cursor:c,budget}=await open(event=>{if(armed&&event==='release')throw primary});
 try{arena.installPage(2,fixture([10,20,30]));
  armed=true;await assert.rejects(arena.clearTable(control),e=>e===primary);
  assert.equal(c.position.state,'FAULT');
  const forbidden={async checkpoint(){throw new Error('fault must precede work')}};
  await assert.rejects(c.first(forbidden),e=>e===primary);await assert.rejects(c.next(forbidden),e=>e===primary);
 }finally{armed=false;c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
