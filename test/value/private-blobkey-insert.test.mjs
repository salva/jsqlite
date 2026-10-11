import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages, PrivateBlobkeyCursor, PRIVATE_NONROOT_CONTROL_CHARGE} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget, PrivateStateLimitError} from '../../src/internal/private-state.ts';
import {KeyInfo, UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';

const control = {async checkpoint(){}, snapshotCheckpoint(){}};
const info = new KeyInfo({encoding:'utf-8', totalFieldCount:1, keyFieldCount:1, terms:[{}]});
// Independently encoded SQLite records: header-size 2, serial-type 1, int8.
// Packed record bytes, NOT a physical cell (no payload-size prefix).
const packed = n => new Uint8Array([2, 1, n]);
async function seek(cursor, n) {
  const value = new Mem(); value.setInt64(BigInt(n));
  const key = new UnpackedRecordKey([value], 0, 'seek', info);
  try { return await cursor.indexMoveto(key, control); }
  finally { key.release(); value.release(); }
}

// Proposed research-contract entrypoint: cursor.insertIndex(packed, options,
// control), where packed bytes alone are publication authority. No scalar seek
// authority, physical-cell wrapper, main-file or VM integration is used here.
// Source: btree.c sqlite3BtreeInsert9395ff index branch: loc0 reseeks;
// loc<0 increments slot on nonempty leaf; equal nKey overwrites payload before
// fillInCell. The entry limit is the private contract, not a native malloc limit.
test('packed Insert owns empty/signed seek and equal REPLACE at exact entry capacity', async () => {
  const limits = {maxEntries:2, maxKeyBytes:100, maxBytes:100000};
  const budget = new PrivateStateByteBudget(limits.maxBytes);
  const arena = await PrivateBlobkeyPages.open(budget, control, () => {}, limits);
  const cursor = new PrivateBlobkeyCursor(arena, info, limits);
  try {
    assert.equal((await seek(cursor, 2)).state, 'INVALID');
    assert.equal(typeof cursor.insertIndex, 'function',
      'missing seek-owning packed BtreeInsert; physical insertCell/replaceCell are not this owner');
    await cursor.insertIndex(packed(2), {}, control);
    assert.equal((await seek(cursor, 2)).res, 0);
    // Insert before an existing key without trusting the previous scalar result.
    await cursor.insertIndex(packed(1), {}, control);
    assert.equal((await seek(cursor, 1)).res, 0);
    assert.equal(cursor.position.index, 0);
    assert.equal((await seek(cursor, 2)).res, 0);
    assert.equal(cursor.position.index, 1);
    // Equality is REPLACE even when maxEntries is exhausted.
    await cursor.insertIndex(packed(2), {}, control);
    assert.equal((await seek(cursor, 2)).res, 0);
    await assert.rejects(cursor.insertIndex(packed(3), {}, control), PrivateStateLimitError);
    assert.equal((await seek(cursor, 1)).res, 0);
    assert.equal((await seek(cursor, 2)).res, 0);
  } finally {
    cursor.close(); arena.close();
    assert.equal(budget.usedBytes, 0);
  }
});
test('packed Insert reaches root expansion and seekable divider/leaf entries',async()=>{
 const limits={maxEntries:900,maxKeyBytes:100,maxBytes:500000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<850;n++)await cursor.insertIndex(Uint8Array.of(2,2,n>>>8,n&255),{},control);
 for(const n of [0,1,300,600,849])assert.equal((await seek(cursor,n)).res,0);
 const p=arena.acquire(2);try{assert.equal(p.page.leaf,false);assert.equal(p.page.nOverflow,0)}finally{p.release()}
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('SAVEPosition after balance owns packed key until restore, unaffected by caller mutation',async()=>{
 const limits={maxEntries:900,maxKeyBytes:100,maxBytes:500000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{let saved=-1;for(let n=0;n<850;n++){const key=Uint8Array.of(2,2,n>>>8,n&255);await cursor.insertIndex(key,{savePosition:true},control);key.fill(0);if(cursor.position.state==='REQUIRESEEK'){saved=n;break}}assert.ok(saved>=0);assert.equal(arena.referenceCount(2),0);await cursor.restoreCursorPosition(control);assert.equal(cursor.position.state,'VALID');assert.equal((await seek(cursor,saved)).res,0);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('post-balance SAVEPosition allocation failure leaves INVALID writer and published tree seekable',async()=>{
 const limits={maxEntries:900,maxKeyBytes:100,maxBytes:500000},budget=new PrivateStateByteBudget(limits.maxBytes),error=new Error('saved allocation');let armed=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,n)=>{if(armed&&event==='allocate'&&n===2)throw error},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{armed=true;let failed=-1;for(let n=0;n<850;n++){try{await cursor.insertIndex(Uint8Array.of(2,2,n>>>8,n&255),{savePosition:true},control)}catch(e){assert.equal(e,error);failed=n;break}}assert.ok(failed>=0);assert.equal(cursor.position.state,'INVALID');armed=false;assert.equal((await seek(cursor,failed)).res,0);
 }finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('packed NEW overflow builds native chain and reseeks full BLOB key',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 // header3, serial12012 (BLOB6000): independently encoded varint93/108.
 const key=new Uint8Array(6003);key.set([3,0xdd,0x6c]);key.fill(7,3);
 try{await cursor.insertIndex(key,{},control);await cursor.insertIndex(key,{},control);const before=arena.pageCount;const other=key.slice();other[6002]=8;await assert.rejects(cursor.insertIndex(other,{},control),PrivateStateLimitError);assert.equal(arena.pageCount,before);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('equal RTRIM unequal overflow replacement conserves exact entry capacity and frees chain',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]}),cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 // TEXT6000 serial12013; value a followed by spaces compares equal to a.
 const long=new Uint8Array(6003);long.set([3,0xdd,0x6d,97]);long.fill(32,4);const short=Uint8Array.of(2,15,97);
 try{await cursor.insertIndex(long,{},control);await cursor.insertIndex(short,{},control);await cursor.insertIndex(long,{},control);await cursor.insertIndex(short,{},control);
 const p=arena.acquire(2);try{assert.equal(p.page.nCell,1);assert.equal(p.page.parseCell(0).nPayload,3);assert.equal(p.page.parseCell(0).overflowOffset,null)}finally{p.release()}
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('overflow replacement seek acquire failure remains retryable before clear',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),error=new Error('clear acquire');let armed=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,n)=>{if(armed&&event==='acquire'&&n===3)throw error},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]}),cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 const long=new Uint8Array(6003);long.set([3,0xdd,0x6d,97]);long.fill(32,4);
 try{await cursor.insertIndex(long,{},control);armed=true;await assert.rejects(cursor.insertIndex(Uint8Array.of(2,15,97),{},control),e=>e===error);assert.equal(cursor.position.state,'VALID');assert.equal(arena.referenceCount(3),0);armed=false;await cursor.insertIndex(Uint8Array.of(2,15,97),{},control)}finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('post-publication balance path admission failure invalidates writer and faults arena',async()=>{
 const limits={maxEntries:900,maxKeyBytes:100,maxBytes:500000},error=new PrivateStateLimitError('path peak');let armed=false;
 class Budget extends PrivateStateByteBudget{reserve(n,...args){if(armed&&n===576)throw error;return super.reserve(n,...args)}}
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{armed=true;let failed=false;for(let n=0;n<850;n++){try{await cursor.insertIndex(Uint8Array.of(2,2,n>>>8,n&255),{},control)}catch(e){assert.equal(e,error);failed=true;break}}assert.equal(failed,true);assert.equal(cursor.position.state,'FAULT');assert.equal(arena.referenceCount(2),0)}finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('Insert after saved cursor replaces old saved-key ownership before peer save',async()=>{
 const limits={maxEntries:10,maxKeyBytes:100,maxBytes:100000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{await cursor.insertIndex(packed(1),{},control);await cursor.saveCursorPosition(control);await cursor.insertIndex(packed(2),{},control);await cursor.saveCursorPosition(control);await cursor.restoreCursorPosition(control);assert.equal((await seek(cursor,2)).res,0)}finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('post-seek overflow clear release failure faults writer with primary and no live refs',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),error=new Error('clear release');let armed=false,phase=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,n,bytes)=>{if(armed&&event==='release'&&n===3&&bytes&&bytes[0]===0&&bytes[1]===0&&bytes[2]===0&&bytes[3]===0){phase=true;throw error}},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]}),cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 const long=new Uint8Array(6003);long.set([3,0xdd,0x6d,97]);long.fill(32,4);
 const ctl=control;
 try{await cursor.insertIndex(long,{},control);armed=true;await assert.rejects(cursor.insertIndex(Uint8Array.of(2,15,97),{},ctl),e=>e===error);assert.equal(phase,true);assert.equal(cursor.position.state,'FAULT');for(let n=2;n<=4;n++)assert.equal(arena.referenceCount(n),0)}finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('packed interior RTRIM replacement preserves both child identities through overflow clear',async()=>{
 const limits={maxEntries:3,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const page=(leaf,cell,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=1;const top=4096-cell.length;b[5]=top>>>8;b[6]=top;b[leaf?8:12]=top>>>8;b[leaf?9:13]=top;b.set(cell,top);b[11]=right;return b};
 arena.installPage(2,page(false,Uint8Array.of(0,0,0,3,3,2,15,97),4));arena.installPage(3,page(true,Uint8Array.of(3,2,15,48)));arena.installPage(4,page(true,Uint8Array.of(3,2,15,122)));
 const cursor=new PrivateBlobkeyCursor(arena,ki,limits),long=new Uint8Array(6003);long.set([3,0xdd,0x6d,97]);long.fill(32,4);
 try{for(const key of [long,Uint8Array.of(2,15,97),long,Uint8Array.of(2,15,97)]){await cursor.insertIndex(key,{},control);const p=arena.acquire(2);try{assert.equal(p.page.nCell,1);assert.equal(p.page.leftChild(0),3);assert.equal(p.page.rightChild(),4);assert.equal(p.page.parseCell(0).nPayload,key.length)}finally{p.release()}}
 for(const ch of [48,97,122]){const mem=new Mem();mem.setText(Uint8Array.of(ch),'utf-8');const k=new UnpackedRecordKey([mem],0,'seek',ki);try{assert.equal((await cursor.indexMoveto(k,control)).res,0)}finally{k.release();mem.release()}}
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('ordered overflow keys balance leaf/interior dividers with multi-level packed seeks',async()=>{
 let interiorExpansionAllocations=0,changedCountPublications=0,pendingExpansion=false,publicationStep=0;
 const observedControl={snapshotCheckpoint(){},async checkpoint(){const stack=new Error().stack;if(pendingExpansion&&stack.includes('#publishChild')&&stack.includes('publishBlobkeyDividers')){if(++publicationStep===2){changedCountPublications++;pendingExpansion=false}}}};
 const limits={maxEntries:180,maxKeyBytes:10000,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,pgno,bytes)=>{
 // Raw allocated sibling release occurs after native page-type initialization,
 // before derived acquisition/rekey/publication. Deeper and overflow releases
 // do not qualify: require the nonroot caller and an empty interior header.
 if(event==='release'&&bytes&&new Error().stack.includes('#balanceNonroot')&&bytes[0]===2&&bytes[3]===0&&bytes[4]===0&&bytes[5]===16&&bytes[6]===0){interiorExpansionAllocations++;pendingExpansion=true;publicationStep=0}
 },limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 // BLOB6000 header3/serial12012; big-endian ordinal dominates ordering.
 const key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n>>>8,n&255]);b.fill(37,5);return b};
 try{// Coprime permutation forces middle/left insertions and right redistribution.
 for(let i=0;i<180;i++)await cursor.insertIndex(key((i*73)%180),{},observedControl);
 let depth=0;for(let n=0;n<180;n++){const m=new Mem();m.setBlob(key(n).subarray(3));const k=new UnpackedRecordKey([m],0,'seek',info);try{const result=await cursor.indexMoveto(k,control);assert.equal(result.res,0,`key${n}`);depth=Math.max(depth,cursor.position.parents.length)}finally{k.release();m.release()}}
 assert.ok(depth>=2,'interior upward propagation must expand beyond leaf children');
 assert.ok(interiorExpansionAllocations>0,'nonroot interior nNew>nOld must allocate an initialized sibling');
 assert.ok(changedCountPublications>0,'after parent pRight publication, expanded interior publishes old right child');
 // Equal overflow overwrite is conserving at capacity after multi-level balance.
 await cursor.insertIndex(key(90),{},control);await assert.rejects(cursor.insertIndex(key(180),{},control),PrivateStateLimitError);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('unequal local/overflow packed extents survive nonappend multi-level balance',async()=>{
 const limits={maxEntries:150,maxKeyBytes:10000,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 const key=n=>{const size=[10,500,990,1003,4595,6000,9000][n%7],serial=12+2*size,vs=[];let v=serial;do{vs.unshift(v%128);v=Math.floor(v/128)}while(v);for(let i=0;i<vs.length-1;i++)vs[i]|=128;const b=new Uint8Array(1+vs.length+size);b.set([1+vs.length,...vs,n>>>8,n&255]);b.fill(37,3+vs.length);return b};
 try{for(let i=0;i<150;i++)await cursor.insertIndex(key((i*61)%150),{},control);let depth=0;
 for(let n=0;n<150;n++){const b=key(n),m=new Mem();m.setBlob(b.subarray(b[0]));const k=new UnpackedRecordKey([m],0,'seek',info);try{assert.equal((await cursor.indexMoveto(k,control)).res,0,`key${n}`);depth=Math.max(depth,cursor.position.parents.length)}finally{k.release();m.release()}}
 assert.ok(depth>=2);await cursor.insertIndex(key(90),{},control);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('equal physical extent overflow→local replacement clears chain before conserving publication',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]}),cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 const long=new Uint8Array(6003);long.set([3,0xdd,0x6d,97]);long.fill(32,4);const local=new Uint8Array(493);local.set([3,0x87,0x61,97]);local.fill(32,4); // TEXT490 serial993
 try{await cursor.insertIndex(long,{},control);let p=arena.acquire(2);try{assert.equal(p.page.parseCell(0).nSize,495)}finally{p.release()}
 await cursor.insertIndex(local,{},control);p=arena.acquire(2);try{const c=p.page.parseCell(0);assert.equal(c.nSize,495);assert.equal(c.nPayload,493);assert.equal(c.overflowOffset,null)}finally{p.release()}
 await cursor.insertIndex(long,{},control);await cursor.insertIndex(local,{},control);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('overflow Insert reservation failure sweep refunds actual overlapping admissions on every boundary',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},payload=new Uint8Array(6003);payload.set([3,0xdd,0x6c]);payload.fill(37,3);let boundaries=0;
 for(let failAt=1;failAt<=100;failAt++){
 let armed=false,count=0,hit=false;const error=new PrivateStateLimitError(`reservation${failAt}`);
 class Budget extends PrivateStateByteBudget{reserve(n,...args){if(armed&&++count===failAt){hit=true;throw error}return super.reserve(n,...args)}}
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{armed=true;try{await cursor.insertIndex(payload,{},control);assert.equal(hit,false)}catch(e){assert.equal(e,error);assert.equal(hit,true)}finally{armed=false}}
 finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0,`failed boundary${failAt}`)}
 if(!hit){boundaries=count;break}
 }assert.ok(boundaries>10);assert.ok(boundaries<100,'sweep reached successful end');
});
test('overflow Insert cancellation checkpoint sweep preserves primary and disposal charge',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},payload=new Uint8Array(6003);payload.set([3,0xdd,0x6c]);payload.fill(37,3);let boundaries=0;
 for(let failAt=1;failAt<=100;failAt++){
 let count=0,hit=false;const error=new Error(`cancel${failAt}`),probe=()=>{if(++count===failAt){hit=true;throw error}},ctl={async checkpoint(){probe()},snapshotCheckpoint(){probe()}};
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{try{await cursor.insertIndex(payload,{},ctl);assert.equal(hit,false)}catch(e){assert.equal(e,error);assert.equal(hit,true)}}
 finally{try{cursor.close();arena.close()}catch(e){throw new Error(`cancel boundary${failAt}`,{cause:e})}assert.equal(budget.usedBytes,0,`cancel boundary${failAt}`)}
 if(!hit){boundaries=count;break}
 }assert.ok(boundaries>10);assert.ok(boundaries<100);
});
test('overflow replacement cancellation sweep releases failed page/chain after owning mutation unwind',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},long=new Uint8Array(6003);long.set([3,0xdd,0x6d,97]);long.fill(32,4);let boundaries=0;
 for(let failAt=1;failAt<=200;failAt++){
 let count=0,hit=false;const error=new Error(`replace cancel${failAt}`),probe=()=>{if(++count===failAt){hit=true;throw error}},ctl={async checkpoint(){probe()},snapshotCheckpoint(){probe()}};
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]}),cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 try{await cursor.insertIndex(long,{},control);try{await cursor.insertIndex(Uint8Array.of(2,15,97),{},ctl);assert.equal(hit,false)}catch(e){assert.equal(e,error);assert.equal(hit,true)}}
 finally{try{cursor.close();arena.close()}catch(e){throw new Error(`replace boundary${failAt}`,{cause:e})}assert.equal(budget.usedBytes,0)}
 if(!hit){boundaries=count;break}
 }assert.ok(boundaries>10);assert.ok(boundaries<200);
});
test('root expansion overflow balance cancellation sweep preserves terminal lifetime and primary',async()=>{
 const limits={maxEntries:9,maxKeyBytes:10000,maxBytes:300000},key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};let boundaries=0;
 for(let failAt=1;failAt<=400;failAt++){
 let count=0,hit=false;const error=new Error(`balance cancel${failAt}`),probe=()=>{if(++count===failAt){hit=true;throw error}},ctl={async checkpoint(){probe()},snapshotCheckpoint(){probe()}};
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<8;n++)await cursor.insertIndex(key(n),{},control);try{await cursor.insertIndex(key(8),{},ctl);assert.equal(hit,false);const p=arena.acquire(2);try{assert.equal(p.page.leaf,false)}finally{p.release()}}catch(e){assert.equal(e,error);assert.equal(hit,true)}}
 finally{try{cursor.close();arena.close()}catch(e){throw new Error(`balance boundary${failAt}`,{cause:e})}assert.equal(budget.usedBytes,0)}
 if(!hit){boundaries=count;break}
 }assert.ok(boundaries>40);assert.ok(boundaries<400);
});
test('root overflow balance reservation and page hook sweeps preserve primary and refund all owners',async(t)=>{
 const limits={maxEntries:9,maxKeyBytes:10000,maxBytes:300000},key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};
 for(const mode of ['reserve','acquire','allocate','release']){let end=0;
 for(let failAt=1;failAt<=300;failAt++){
 let armed=false,count=0,hit=false;const error=new Error(`${mode}${failAt}`),probe=()=>{if(armed&&++count===failAt){hit=true;throw error}};
 class Budget extends PrivateStateByteBudget{reserve(n,...args){if(mode==='reserve')probe();return super.reserve(n,...args)}}
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(event===mode)probe()},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<8;n++)await cursor.insertIndex(key(n),{},control);armed=true;try{await cursor.insertIndex(key(8),{},control);assert.equal(hit,false)}catch(e){assert.equal(e,error);assert.equal(hit,true)}finally{armed=false}}
 finally{try{cursor.close();arena.close()}catch(e){throw new Error(`${mode} boundary${failAt}`,{cause:e})}assert.equal(budget.usedBytes,0,`${mode}${failAt}`)}
 if(!hit){end=count;break}
 }assert.ok(end>0,mode);assert.ok(end<300,mode);t.diagnostic(`${mode}: ${end} reachable boundaries`);
 }
});
test('root overflow balance actual charged peak admits exact bytes and rejects one below',async(t)=>{
 const key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};let peak=0;
 for(const maxBytes of [300000,()=>peak,()=>peak-1]){
 const limit=typeof maxBytes==='function'?maxBytes():maxBytes,limits={maxEntries:9,maxKeyBytes:10000,maxBytes:limit};let high=0,failed=false;
 class Budget extends PrivateStateByteBudget{reserve(n,...args){super.reserve(n,...args);high=Math.max(high,this.usedBytes)}}
 const budget=new Budget(limit),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<9;n++)await cursor.insertIndex(key(n),{},control)}catch(e){assert.ok(e instanceof PrivateStateLimitError);failed=true}
 finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
 if(limit===300000){assert.equal(failed,false);peak=high;t.diagnostic(`charged root expansion peak ${peak}`)}else assert.equal(failed,limit<peak);
 }
});
test('upward overflow balance second nonroot admission failure retains primary and disposes pending owners',async(t)=>{
 const limits={maxEntries:180,maxKeyBytes:10000,maxBytes:4000000},key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};
 let armed=false,nonroots=0,hit=false,at=-1;const error=new PrivateStateLimitError('upward second nonroot');
 class Budget extends PrivateStateByteBudget{reserve(n,...args){if(armed&&n===PRIVATE_NONROOT_CONTROL_CHARGE&&++nonroots===2){hit=true;throw error}return super.reserve(n,...args)}}
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{
 for(let n=0;n<180;n++){
 nonroots=0;armed=true;
 try{await cursor.insertIndex(key(n),{},control)}catch(e){assert.equal(e,error);assert.equal(hit,true);at=n;break}finally{armed=false}
 }
 assert.equal(hit,true);assert.ok(at>8);assert.equal(cursor.position.state,'FAULT');assert.equal(nonroots,2);t.diagnostic(`upward second nonroot failure at ordered key ${at}`);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('upward second nonroot acquired-parent cleanup preserves acquisition primary over release failure',async(t)=>{
 const limits={maxEntries:180,maxKeyBytes:10000,maxBytes:4000000},key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};
 let armed=false,nonroots=0,acquires=0,hit=false,releases=0,at=-1;const primary=new Error('second nonroot sibling acquire'),secondary=new Error('parent release after acquire failure');
 class Budget extends PrivateStateByteBudget{reserve(n,...args){if(armed&&n===PRIVATE_NONROOT_CONTROL_CHARGE)nonroots++;return super.reserve(n,...args)}}
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{
 if(armed&&nonroots===2&&event==='acquire'&&++acquires===2){hit=true;throw primary}
 if(armed&&hit&&event==='release'){releases++;throw secondary}
 },limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<180;n++){
 nonroots=0;acquires=0;armed=true;
 try{await cursor.insertIndex(key(n),{},control)}catch(e){assert.equal(e,primary);assert.equal(hit,true);at=n;break}finally{armed=false}
 }
 assert.equal(hit,true);assert.equal(nonroots,2);assert.equal(acquires,2);assert.ok(releases>=1,'parent actually released after sibling acquisition failed');assert.equal(cursor.position.state,'FAULT');t.diagnostic(`paired upward acquire/release failure at key ${at}, release hooks ${releases}`);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('upward second nonroot edit admission failure cleans acquired siblings with primary priority',async(t)=>{
 const limits={maxEntries:180,maxKeyBytes:10000,maxBytes:4000000},key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};
 let armed=false,nonroots=0,phase128=0,hit=false,releases=0;const primary=new PrivateStateLimitError('upward edit admission'),secondary=new Error('upward sibling cleanup');
 class Budget extends PrivateStateByteBudget{reserve(n,...args){if(armed&&n===PRIVATE_NONROOT_CONTROL_CHARGE)nonroots++;if(armed&&nonroots===2&&n===128&&new Error().stack.includes('editBlobkeySiblings')&&++phase128===1){hit=true;throw primary}return super.reserve(n,...args)}}
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&hit&&event==='release'){releases++;throw secondary}},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<180;n++){nonroots=0;phase128=0;armed=true;try{await cursor.insertIndex(key(n),{},control)}catch(e){assert.equal(e,primary);assert.equal(hit,true);t.diagnostic(`second nonroot authenticated edit128 key${n}, cleanup releases${releases}`);break}finally{armed=false}}
 assert.equal(hit,true);assert.ok(releases>=2);assert.equal(cursor.position.state,'FAULT');
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('upward second nonroot insert-array checkpoint failure unwinds held edit lifetime',async(t)=>{
 const limits={maxEntries:180,maxKeyBytes:10000,maxBytes:4000000},key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};
 let armed=false,nonroots=0,probes=0,hit=false,releases=0;const primary=new Error('upward insert-array checkpoint'),secondary=new Error('upward edit cleanup');
 class Budget extends PrivateStateByteBudget{reserve(n,...args){if(armed&&n===PRIVATE_NONROOT_CONTROL_CHARGE)nonroots++;return super.reserve(n,...args)}}
 const ctl={...control,async checkpoint(n){if(armed&&nonroots===2&&new Error().stack.includes('#insertCellArray')&&++probes===2){hit=true;throw primary}await control.checkpoint(n)}};
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,ctl,event=>{if(armed&&hit&&event==='release'){releases++;throw secondary}},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<180;n++){nonroots=0;probes=0;armed=true;try{await cursor.insertIndex(key(n),{},ctl)}catch(e){assert.equal(e,primary);assert.equal(hit,true);t.diagnostic(`second nonroot insert-array checkpoint2 key${n}, cleanup releases${releases}`);break}finally{armed=false}}
 assert.equal(hit,true);assert.ok(releases>=2);assert.equal(cursor.position.state,'FAULT');
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('nonroot control allowance covers bounded identity and cleanup descriptors before allocation',async()=>{
 const {PRIVATE_NONROOT_CONTROL_CHARGE}=await import('../../src/internal/private-blobkey-pages.ts');
 // Six arrays64 each, at most40 slots8 each, five identities64,
 // nine cleanup descriptors64, and scalar/control/result128.
 assert.ok(PRIVATE_NONROOT_CONTROL_CHARGE>=6*64+40*8+5*64+9*64+128);
});
test('failed saved restore followed by explicit seek can save again without stale key owner',async()=>{
 const primary=new Error('restore acquire');let armed=false;
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='acquire')throw primary},{maxKeyBytes:100,maxEntries:10}),cursor=new PrivateBlobkeyCursor(arena,info,{maxKeyBytes:100,maxEntries:10,maxBytes:100000});
 try{await cursor.insertIndex(packed(1),{},control);await cursor.saveCursorPosition(control);
 armed=true;await assert.rejects(cursor.restoreCursorPosition(control),e=>e===primary);assert.equal(cursor.position.state,'INVALID');armed=false;
 assert.equal((await seek(cursor,1)).res,0);await cursor.saveCursorPosition(control);assert.equal(cursor.position.state,'REQUIRESEEK');await cursor.restoreCursorPosition(control);assert.equal(cursor.position.state,'VALID');
 }finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('failed restore retains one saved charge through no-op repeats and clear refunds exactly once',async()=>{
 const primary=new Error('restore repeated acquire');let armed=false,acquires=0;
 const limits={maxKeyBytes:100,maxEntries:10,maxBytes:100000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='acquire'){acquires++;throw primary}},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{await cursor.insertIndex(packed(1),{},control);await cursor.saveCursorPosition(control);assert.equal(cursor.position.state,'REQUIRESEEK');const saved=budget.usedBytes;
 armed=true;await assert.rejects(cursor.restoreCursorPosition(control),e=>e===primary);assert.equal(budget.usedBytes,saved);
 for(let i=0;i<3;i++){await cursor.restoreCursorPosition(control);assert.equal(budget.usedBytes,saved);assert.equal(acquires,1)}
 assert.equal(acquires,1);armed=false;cursor.clearCursor();assert.equal(budget.usedBytes,saved-(3+17+64));cursor.clearCursor();assert.equal(budget.usedBytes,saved-84);
 assert.equal((await seek(cursor,1)).res,0);await cursor.saveCursorPosition(control);await cursor.restoreCursorPosition(control);assert.equal(cursor.position.state,'VALID');
 }finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('packed Insert comparison checkpoint rejects before publication and restores retryable authority',async()=>{
 const limits={maxKeyBytes:100,maxEntries:1,maxBytes:100000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits),primary=new Error('Insert compare');let hit=false;
 try{await cursor.insertIndex(packed(1),{},control);
 const ctl={...control,async checkpoint(){if(new Error().stack.includes('#compare')){hit=true;throw primary}}};
 await assert.rejects(cursor.insertIndex(packed(1),{},ctl),e=>e===primary);assert.equal(hit,true);assert.equal(cursor.position.state,'VALID');assert.equal((await seek(cursor,1)).res,0);
 await cursor.insertIndex(packed(1),{},control);await assert.rejects(cursor.insertIndex(packed(2),{},control),/entry limit/);assert.equal((await seek(cursor,1)).res,0);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('saved restore comparison and synchronous snapshot errors retain saved owner until explicit clear',async()=>{
 for(const phase of ['comparison','snapshot']){
 const limits={maxKeyBytes:100,maxEntries:1,maxBytes:100000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits),primary=new Error(`restore ${phase}`);let hit=false;
 try{await cursor.insertIndex(packed(1),{},control);await cursor.saveCursorPosition(control);const retained=budget.usedBytes;
 const ctl={async checkpoint(){if(phase==='comparison'&&new Error().stack.includes('#compare')){hit=true;throw primary}},snapshotCheckpoint(){if(phase==='snapshot'){hit=true;throw primary}}};
 await assert.rejects(cursor.restoreCursorPosition(ctl),e=>e===primary);assert.equal(hit,true);
 //Comparison acquires a lease128; snapshot rejects before acquiring root.
 assert.equal(budget.usedBytes,retained+(phase==='comparison'?128:0));await cursor.restoreCursorPosition(control);
 cursor.clearCursor();assert.equal(budget.usedBytes,retained-84+(phase==='comparison'?128:0));assert.equal((await seek(cursor,1)).res,0);await cursor.saveCursorPosition(control);await cursor.restoreCursorPosition(control);assert.equal(cursor.position.state,'VALID');
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});
test('packed Insert rejects malformed resident comparison before overwrite or NEW accounting',async()=>{
 const limits={maxKeyBytes:100,maxEntries:1,maxBytes:100000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 // Physical cell payload-length2 / header-length2 / serial1 but no int8.
 // Page geometry is valid; the packed comparison semantic producer rejects.
 const malformed=Uint8Array.of(2,2,1,0);
 try{let lease=arena.acquire(2);try{await lease.page.insertCell(0,malformed,control)}finally{lease.release()}
 for(let i=0;i<2;i++)await assert.rejects(cursor.insertIndex(packed(1),{},control),e=>e.name==='ComparisonError'&&e.cause?.reason==='truncated-payload');
 assert.equal(cursor.position.state,'VALID');lease=arena.acquire(2);try{assert.equal(lease.page.nCell,1);assert.equal(lease.page.nOverflow,0);const c=lease.page.parseCell(0);assert.deepEqual(Uint8Array.from({length:c.nSize},(_,i)=>lease.page.bytes[c.offset+i]),malformed)}finally{lease.release()}
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('packed NEW fill link/unref failure faults writer and preserves primary over pending cleanup',async()=>{
 let armed=false;const events=[],primary=new Error('Insert prior unref'),secondary=new Error('Insert pending cleanup');
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:200000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,p,bytes)=>{if(!armed||event!=='release')return;events.push(p);if(p===3){assert.equal(bytes[3],4);throw primary}if(p===4)throw secondary},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 const packedBlob=new Uint8Array(6003);packedBlob.set([3,0xdd,0x6c]);packedBlob.fill(7,3);
 try{armed=true;await assert.rejects(cursor.insertIndex(packedBlob,{},control),e=>e===primary);assert.deepEqual(events.slice(0,2),[3,4]);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);assert.equal(cursor.position.state,'FAULT');await assert.rejects(cursor.insertIndex(packedBlob,{},control),e=>e===primary);
 }finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('reachable upward dispatcher and nonroot charged peak replay admits exact capacity and rejects one below',async(t)=>{
 let peak=0;const key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};
 for(const requested of [4000000,()=>peak,()=>peak-1]){const limit=typeof requested==='function'?requested():requested,limits={maxEntries:75,maxKeyBytes:10000,maxBytes:limit};let high=0,failed=false,upward=false,depth=0,at=-1;
 class Budget extends PrivateStateByteBudget{reserve(n,...args){super.reserve(n,...args);if(this.usedBytes>high){high=this.usedBytes;if(at===74&&new Error().stack.includes('#balanceNonroot'))upward=true}}}
 const budget=new Budget(limit),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(at=0;at<75;at++)await cursor.insertIndex(key(at),{},control);const insertionHigh=high;if(requested===4000000)for(let n=0;n<75;n++){const m=new Mem();m.setBlob(key(n).subarray(3));const k=new UnpackedRecordKey([m],0,'seek',info);try{const r=await cursor.indexMoveto(k,control);assert.equal(r.res,0);depth=Math.max(depth,cursor.position.parents.length)}finally{k.release();m.release()}}high=insertionHigh}
 catch(e){assert.ok(e instanceof PrivateStateLimitError);failed=true}
 finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
 if(requested===4000000){assert.equal(failed,false);assert.ok(upward);assert.ok(depth>=2);peak=high;t.diagnostic(`reachable upward charged peak ${peak}`)}else assert.equal(failed,limit<peak);
 }
});
test('equal NOCASE packed Insert partial overflow overwrite faults caller at exact entry capacity',async()=>{
 const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),primary=new Error('packed final overwrite'),secondary=new Error('packed cleanup');let armed=false,phase=false;const events=[];
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,p,bytes)=>{if(armed&&phase&&event==='release'&&p>=3){events.push([p,bytes[4]]);if(p===4)throw secondary}},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'nocase'}]}),cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 const old=new Uint8Array(6003);old.set([3,0xdd,0x6d]);old.fill(97,3);const next=old.slice();next.fill(65,3);
 try{await cursor.insertIndex(old,{},control);armed=true;await assert.rejects(cursor.insertIndex(next,{}, {snapshotCheckpoint(){},async checkpoint(n){if(new Error().stack.includes('#overwritePayload')){phase=true;if(n===1422)throw primary}}}),e=>e===primary);assert.deepEqual(events,[[3,65],[4,97]]);assert.equal(cursor.position.state,'FAULT');assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);await assert.rejects(cursor.insertIndex(old,{},control),e=>e===primary);
 }finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('equal interior local overwrite prewrite failure is retryable and conserves child identities at capacity',async()=>{
 const limits={maxEntries:3,maxKeyBytes:100,maxBytes:100000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'nocase'}]});
 const page=(leaf,cell,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=1;const top=4096-cell.length;b[5]=top>>>8;b[6]=top;b[leaf?8:12]=top>>>8;b[leaf?9:13]=top;b.set(cell,top);b[11]=right;return b};
 arena.installPage(2,page(false,Uint8Array.of(0,0,0,3,3,2,15,97),4));arena.installPage(3,page(true,Uint8Array.of(3,2,15,48)));arena.installPage(4,page(true,Uint8Array.of(3,2,15,122)));const cursor=new PrivateBlobkeyCursor(arena,ki,limits),primary=new Error('interior local prewrite');let hit=false;
 try{await assert.rejects(cursor.insertIndex(Uint8Array.of(2,15,65),{},{snapshotCheckpoint(){},async checkpoint(n){if(new Error().stack.includes('#overwritePayload')){assert.equal(n,3);hit=true;throw primary}}}),e=>e===primary);assert.ok(hit);assert.equal(cursor.position.state,'VALID');let p=arena.acquire(2);try{assert.equal(p.page.bytes[p.page.parseCell(0).payloadOffset+2],97);assert.equal(p.page.leftChild(0),3);assert.equal(p.page.rightChild(),4)}finally{p.release()}
 await cursor.insertIndex(Uint8Array.of(2,15,65),{},control);p=arena.acquire(2);try{assert.equal(p.page.nCell,1);assert.equal(p.page.leftChild(0),3);assert.equal(p.page.rightChild(),4);assert.equal(p.page.bytes[p.page.parseCell(0).payloadOffset+2],65)}finally{p.release()}
 for(const ch of [48,97,122]){const m=new Mem();m.setText(Uint8Array.of(ch),'utf-8');const k=new UnpackedRecordKey([m],0,'seek',ki);try{assert.equal((await cursor.indexMoveto(k,control)).res,0)}finally{k.release();m.release()}}
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('interior equal overflow Insert prewrite retry and partial failure preserve actual divider children',async()=>{
 for(const partial of [false,true]){
 const limits={maxEntries:3,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes);let armed=false,phase=false,hit=false;const observed=[],primary=new Error('interior overflow phase'),secondary=new Error('interior overflow cleanup');
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,p,bytes)=>{if(armed&&phase&&event==='release'&&p>=5){observed.push([p,bytes[4]]);if(partial&&p===6)throw secondary}},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'nocase'}]});
 const page=(leaf,cell,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=1;const top=4096-cell.length;b[5]=top>>>8;b[6]=top;b[leaf?8:12]=top>>>8;b[leaf?9:13]=top;b.set(cell,top);b[11]=right;return b};
 arena.installPage(2,page(false,Uint8Array.of(0,0,0,3,3,2,15,97),4));arena.installPage(3,page(true,Uint8Array.of(3,2,15,48)));arena.installPage(4,page(true,Uint8Array.of(3,2,15,122)));const cursor=new PrivateBlobkeyCursor(arena,ki,limits),old=new Uint8Array(6003);old.set([3,0xdd,0x6d]);old.fill(97,3);const next=old.slice();next.fill(65,3);
 try{const filled=await arena.fillCell(2,old,control);const cell=new Uint8Array(filled.bytes.length);for(let i=0;i<filled.bytes.length;i++)cell[i]=filled.bytes[i];cell[3]=3;filled.release();arena.installPage(2,page(false,cell,4));const before=arena.acquire(2);let local;try{assert.equal(before.page.leftChild(0),3);assert.equal(before.page.rightChild(),4);local=before.page.parseCell(0).nLocal}finally{before.release()}
 armed=true;await assert.rejects(cursor.insertIndex(next,{},{snapshotCheckpoint(){},async checkpoint(n){if(new Error().stack.includes('#overwritePayload')){phase=true;if(n===(partial?1422:local)){hit=true;throw primary}}}}),e=>e===primary);assert.ok(hit);armed=false;assert.equal(arena.referenceCount(5),0);assert.equal(arena.referenceCount(6),0);
 if(partial){assert.deepEqual(observed,[[5,65],[6,97]]);assert.equal(cursor.position.state,'FAULT');await assert.rejects(cursor.insertIndex(old,{},control),e=>e===primary)}
 else{assert.deepEqual(observed,[]);assert.equal(cursor.position.state,'VALID');await cursor.insertIndex(next,{},control);const p=arena.acquire(2);try{assert.equal(p.page.nCell,1);assert.equal(p.page.leftChild(0),3);assert.equal(p.page.rightChild(),4);assert.equal(p.page.parseCell(0).nPayload,6003)}finally{p.release()}
 for(const ch of [48,97,122]){const m=new Mem();m.setText(ch===97?old.subarray(3):Uint8Array.of(ch),'utf-8');const k=new UnpackedRecordKey([m],0,'seek',ki);try{assert.equal((await cursor.indexMoveto(k,control)).res,0)}finally{k.release();m.release()}}}
 }finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});
test('unequal interior RTRIM replacement clear-phase first old overflow unref failure faults caller',async()=>{
 const limits={maxEntries:3,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes);let armed=false,hit=false;const primary=new Error('interior clear unref');
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&event==='release'&&p===5&&new Error().stack.includes('#clearCellOverflow')){hit=true;throw primary}},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const page=(leaf,cell,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=1;const top=4096-cell.length;b[5]=top>>>8;b[6]=top;b[leaf?8:12]=top>>>8;b[leaf?9:13]=top;b.set(cell,top);b[11]=right;return b};
 arena.installPage(2,page(false,Uint8Array.of(0,0,0,3,3,2,15,97),4));arena.installPage(3,page(true,Uint8Array.of(3,2,15,48)));arena.installPage(4,page(true,Uint8Array.of(3,2,15,122)));const old=new Uint8Array(6003);old.set([3,0xdd,0x6d,97]);old.fill(32,4);const filled=await arena.fillCell(2,old,control),cell=new Uint8Array(filled.bytes.length);for(let i=0;i<cell.length;i++)cell[i]=filled.bytes[i];cell[3]=3;filled.release();arena.installPage(2,page(false,cell,4));const cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 try{armed=true;await assert.rejects(cursor.insertIndex(Uint8Array.of(2,15,97),{},control),e=>e===primary);assert.ok(hit);assert.equal(cursor.position.state,'FAULT');assert.equal(arena.referenceCount(5),0);assert.equal(arena.referenceCount(6),0);await assert.rejects(cursor.insertIndex(old,{},control),e=>e===primary)}finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('unequal interior RTRIM replacement new overflow allocation failure releases pending before touching old chain',async()=>{
 const limits={maxEntries:3,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes);let armed=false,hit=false,cleared=false;const released=[];const primary=new Error('interior clear unref');
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&new Error().stack.includes('#clearCellOverflow'))cleared=true;if(armed&&event==='release')released.push(p);if(armed&&event==='allocate'&&p===8){hit=true;throw primary}},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const page=(leaf,cell,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=1;const top=4096-cell.length;b[5]=top>>>8;b[6]=top;b[leaf?8:12]=top>>>8;b[leaf?9:13]=top;b.set(cell,top);b[11]=right;return b};
 arena.installPage(2,page(false,Uint8Array.of(0,0,0,3,3,2,15,97),4));arena.installPage(3,page(true,Uint8Array.of(3,2,15,48)));arena.installPage(4,page(true,Uint8Array.of(3,2,15,122)));const old=new Uint8Array(6003);old.set([3,0xdd,0x6d,97]);old.fill(32,4);const filled=await arena.fillCell(2,old,control),cell=new Uint8Array(filled.bytes.length);for(let i=0;i<cell.length;i++)cell[i]=filled.bytes[i];cell[3]=3;filled.release();arena.installPage(2,page(false,cell,4));const cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 const next=new Uint8Array(9004);next.set([4,0x81,0x8c,0x5d,97]);next.fill(32,5);
 try{armed=true;await assert.rejects(cursor.insertIndex(next,{},control),e=>e===primary);assert.ok(hit);assert.equal(cleared,false);assert.ok(released.includes(7));assert.equal(arena.referenceCount(7),0);assert.equal(cursor.position.state,'FAULT');assert.equal(arena.referenceCount(5),0);assert.equal(arena.referenceCount(6),0);await assert.rejects(cursor.insertIndex(old,{},control),e=>e===primary)}finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('unequal interior RTRIM replacement postconstruction physical copy admission fails before old clear',async()=>{
 const limits={maxEntries:3,maxKeyBytes:10000,maxBytes:300000};let armed=false,hit=false,cleared=false;const released=[];const primary=new PrivateStateLimitError('interior copy admission');class Budget extends PrivateStateByteBudget{reserve(n,...args){const stack=new Error().stack;if(armed&&stack.includes('#insertLocal')&&!stack.includes('#fillCell')&&n===830){hit=true;throw primary}super.reserve(n,...args)}}const budget=new Budget(limits.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&new Error().stack.includes('#clearCellOverflow'))cleared=true;if(armed&&event==='release')released.push(p);},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const page=(leaf,cell,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=1;const top=4096-cell.length;b[5]=top>>>8;b[6]=top;b[leaf?8:12]=top>>>8;b[leaf?9:13]=top;b.set(cell,top);b[11]=right;return b};
 arena.installPage(2,page(false,Uint8Array.of(0,0,0,3,3,2,15,97),4));arena.installPage(3,page(true,Uint8Array.of(3,2,15,48)));arena.installPage(4,page(true,Uint8Array.of(3,2,15,122)));const old=new Uint8Array(6003);old.set([3,0xdd,0x6d,97]);old.fill(32,4);const filled=await arena.fillCell(2,old,control),cell=new Uint8Array(filled.bytes.length);for(let i=0;i<cell.length;i++)cell[i]=filled.bytes[i];cell[3]=3;filled.release();arena.installPage(2,page(false,cell,4));const cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 const next=new Uint8Array(9004);next.set([4,0x81,0x8c,0x5d,97]);next.fill(32,5);
 try{armed=true;await assert.rejects(cursor.insertIndex(next,{},control),e=>e===primary);assert.ok(hit);assert.equal(cleared,false);assert.ok(released.includes(7));assert.equal(arena.referenceCount(7),0);assert.equal(arena.referenceCount(8),0);assert.equal(cursor.position.state,'FAULT');assert.equal(arena.referenceCount(5),0);assert.equal(arena.referenceCount(6),0);await assert.rejects(cursor.insertIndex(old,{},control),e=>e===primary)}finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('unequal interior RTRIM replacement result and physical copy overlap exact830 admission vs829',async()=>{
 for(const room of [829,830]){const limits={maxEntries:3,maxKeyBytes:10000,maxBytes:300000};let failure;let armed=false,hit=false,cleared=false,filler=0,admitted=false;const released=[];const primary=new PrivateStateLimitError('interior copy admission');class Budget extends PrivateStateByteBudget{reserve(n,...args){const stack=new Error().stack;if(armed&&stack.includes('#insertLocal')&&!stack.includes('#fillCell')&&n===830){hit=true;filler=this.maxBytes-this.usedBytes-room;super.reserve(filler);super.reserve(n,...args);admitted=true;assert.equal(this.usedBytes,this.maxBytes);return}super.reserve(n,...args)}}const budget=new Budget(limits.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&new Error().stack.includes('#clearCellOverflow'))cleared=true;if(armed&&event==='release')released.push(p);},limits),ki=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const page=(leaf,cell,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=1;const top=4096-cell.length;b[5]=top>>>8;b[6]=top;b[leaf?8:12]=top>>>8;b[leaf?9:13]=top;b.set(cell,top);b[11]=right;return b};
 arena.installPage(2,page(false,Uint8Array.of(0,0,0,3,3,2,15,97),4));arena.installPage(3,page(true,Uint8Array.of(3,2,15,48)));arena.installPage(4,page(true,Uint8Array.of(3,2,15,122)));const old=new Uint8Array(6003);old.set([3,0xdd,0x6d,97]);old.fill(32,4);const filled=await arena.fillCell(2,old,control),cell=new Uint8Array(filled.bytes.length);for(let i=0;i<cell.length;i++)cell[i]=filled.bytes[i];cell[3]=3;filled.release();arena.installPage(2,page(false,cell,4));const cursor=new PrivateBlobkeyCursor(arena,ki,limits);
 const next=new Uint8Array(9004);next.set([4,0x81,0x8c,0x5d,97]);next.fill(32,5);
 try{armed=true;await assert.rejects(cursor.insertIndex(next,{},{snapshotCheckpoint(){},async checkpoint(){if(hit&&admitted)throw primary}}),e=>{failure=e;return room===830?e===primary:e instanceof PrivateStateLimitError});assert.ok(hit);assert.equal(cleared,false);assert.equal(admitted,room===830);assert.ok(released.includes(7));assert.equal(arena.referenceCount(7),0);assert.equal(arena.referenceCount(8),0);assert.equal(cursor.position.state,'FAULT');assert.equal(arena.referenceCount(5),0);assert.equal(arena.referenceCount(6),0);await assert.rejects(cursor.insertIndex(old,{},control),e=>e===failure)}finally{armed=false;budget.release(filler);cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
}
});
test('packed overflow comparison ignores unused final pointer but rejects premature chain before Insert writes',async()=>{
 for(const premature of [false,true]){const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),initial=new PrivateBlobkeyCursor(arena,info,limits);let cursor=initial;const key=new Uint8Array(6003);key.set([3,0xdd,0x6c]);key.fill(37,3);
 try{await cursor.insertIndex(key,{},control);cursor.close();const raw=arena.acquireRaw(premature?3:4);try{const bytes=new Uint8Array(4096);for(let i=0;i<4096;i++)bytes[i]=raw.bytes[i];bytes.fill(premature?0:255,0,4);raw.release();arena.installPage(premature?3:4,bytes)}finally{raw.release()}cursor=new PrivateBlobkeyCursor(arena,info,limits);if(premature){await assert.rejects(cursor.insertIndex(key,{},control),/overflow chain ends prematurely/);assert.equal(cursor.position.state,'VALID');assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0)}else{await cursor.insertIndex(key,{},control);const m=new Mem();m.setBlob(key.subarray(3));const k=new UnpackedRecordKey([m],0,'seek',info);try{assert.equal((await cursor.indexMoveto(k,control)).res,0)}finally{k.release();m.release()}}
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}}
});

test('packed overflow comparison bounded cycle read and outside-arena pointer follow native read branches',async()=>{
 for(const link of [3,0xffffffff]){const limits={maxEntries:1,maxKeyBytes:10000,maxBytes:300000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),initial=new PrivateBlobkeyCursor(arena,info,limits);let cursor=initial;const key=new Uint8Array(6003);key.set([3,0xdd,0x6c]);key.fill(37,3);
 try{await cursor.insertIndex(key,{},control);cursor.close();const raw=arena.acquireRaw(3);try{const bytes=new Uint8Array(4096);for(let i=0;i<4096;i++)bytes[i]=raw.bytes[i];new DataView(bytes.buffer).setUint32(0,link);raw.release();arena.installPage(3,bytes)}finally{raw.release()}cursor=new PrivateBlobkeyCursor(arena,info,limits);if(link===0xffffffff){await assert.rejects(cursor.insertIndex(key,{},control),/overflow page number outside arena/);assert.equal(cursor.position.state,'VALID');assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0)}else{const m=new Mem();m.setBlob(key.subarray(3));const k=new UnpackedRecordKey([m],0,'seek',info);try{assert.equal((await cursor.indexMoveto(k,control)).res,0)}finally{k.release();m.release()}}
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}}
});
test('reachable nonroot divider snapshot byte rejection preserves primary over all release hooks',async(t)=>{
 const limits={maxEntries:180,maxKeyBytes:10000,maxBytes:4000000},key=n=>{const b=new Uint8Array(6003);b.set([3,0xdd,0x6c,n]);b.fill(37,4);return b};
 let armed=false,hit=false,releases=0,live=0,at=-1;// Signed charge deltas: owners may reserve aggregate capacity and refund pieces.
 const ledger=new Map();let inventory;const primary=new PrivateStateLimitError('divider snapshot byte rejection'),secondary=new Error('divider rejection release');
 class Budget extends PrivateStateByteBudget{reserve(n,...args){const stack=new Error().stack;if(armed&&stack.includes('#insertCell')&&stack.includes('publishBlobkeyDividers')){hit=true;live=this.usedBytes;inventory=new Map(ledger);throw primary}const result=super.reserve(n,...args);ledger.set(n,(ledger.get(n)??0)+1);return result}release(n){super.release(n);const count=(ledger.get(n)??0)-1;if(count)ledger.set(n,count);else ledger.delete(n)}}
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&hit&&event==='release'){releases++;throw secondary}},limits),cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{for(let n=0;n<180;n++){armed=true;try{await cursor.insertIndex(key(n),{},control)}catch(e){assert.equal(e,primary);assert.ok(hit);at=n;break}finally{armed=false}}
 assert.ok(hit);assert.ok(at>=1);assert.ok(live>PRIVATE_NONROOT_CONTROL_CHARGE);assert.ok(releases>=3);assert.equal(cursor.position.state,'FAULT');
 for(let pg=1;pg<=arena.pageCount;pg++)assert.equal(arena.referenceCount(pg),0,'paired release errors retire every page lease');
 const retained=budget.usedBytes;cursor.close();assert.ok(budget.usedBytes<retained,'cursor cache/result/capacity retirement precedes arena disposal');cursor.close();
 await assert.rejects(arena.fillCell(2,key(0),control),e=>e===primary);assert.equal([...inventory].reduce((sum,[n,count])=>sum+n*count,0),live);assert.equal(inventory.get(PRIVATE_NONROOT_CONTROL_CHARGE),1);assert.equal(inventory.get(563),1);
 // The Insert packed/decoder owner stays live; seek target and payload read
 // scratch are gone. Cache capacity survives invalidation until close.
 assert.equal(inventory.get(128+128+6003*3),1);assert.equal(inventory.get(16),1);assert.equal(inventory.get(128+128+6000)??0,0);assert.equal(inventory.get(6003+18)??0,0);
 // Fill admission reserves aggregate local/payload ownership, refunds pieces.
 assert.equal((inventory.get(6626)??0)*6626+(inventory.get(6003)??0)*6003+(inventory.get(623)??0)*623,0);
 t.diagnostic(`divider snapshot rejection key${at}, live${live}, cleanup releases${releases}, signed charge deltas ${JSON.stringify([...inventory])}`);
 }finally{armed=false;cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('reachable interior contraction shallows overflow dividers with actual leaf children at capacity',async(t)=>{
 let balancePeak=0;
 for(const failPhase of [null,'exact','below','#freePage','#copyNodeContent','#defrag']){
 let armed=false,hit=false,releases=0,defragChecks=0;const primary=new Error('shallow free checkpoint'),secondary=new Error('shallow cleanup');
 const limits={maxEntries:11,maxKeyBytes:10000,maxBytes:400000};let tracing=false,peak=0,peakStack='';
 class Budget extends PrivateStateByteBudget{reserve(n,...args){try{super.reserve(n,...args)}catch(e){if(tracing&&failPhase==='below'){hit=true;limitError=e}throw e}if(tracing&&this.usedBytes-filler>peak){peak=this.usedBytes-filler;peakStack=new Error().stack}}}
 let filler=0,limitError;
 const budget=new Budget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event)=>{if(armed&&hit&&event==='release'){releases++;throw secondary}},limits);
 const key=n=>{if(n%2===0)return Uint8Array.of(2,14,n);const b=new Uint8Array(6003);b.set([3,0xdd,0x6c]);b.fill(n,3);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096);b[0]=leaf?10:2;b[4]=cells.length;new DataView(b.buffer).setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);new DataView(b.buffer).setUint16((leaf?8:12)+2*i,top)});new DataView(b.buffer).setUint16(5,top);return b};
 // Root / three interior siblings / six real leaf children. Each separator
 // owns an overflow chain, not an invented child identity or duplicated row.
 arena.installPage(2,page(false,[],0));for(let n=3;n<=11;n++)arena.installPage(n,page(n>=6,[],0));
 let cursor;
 try{
 const cell=async(pg,n,child)=>{const f=await arena.fillCell(pg,key(n),control);try{const b=new Uint8Array(f.bytes.length);for(let i=0;i<b.length;i++)b[i]=f.bytes[i];if(child)new DataView(b.buffer).setUint32(0,child);return b}finally{f.release()}};
 for(let n=0;n<=10;n+=2)arena.installPage(6+n/2,page(true,[await cell(6+n/2,n,0)]));
 arena.installPage(3,page(false,[await cell(3,1,6)],7));arena.installPage(4,page(false,[await cell(4,5,8)],9));arena.installPage(5,page(false,[await cell(5,9,10)],11));
 arena.installPage(2,page(false,[await cell(2,3,3),await cell(2,7,4)],5));
 cursor=new PrivateBlobkeyCursor(arena,info,limits);
 const all=async()=>{for(let n=0;n<=10;n++){const m=new Mem();m.setBlob(key(n).subarray(n%2?3:2));const k=new UnpackedRecordKey([m],0,'seek',info);try{assert.equal((await cursor.indexMoveto(k,control)).res,0,`key${n}`)}finally{k.release();m.release()}}};
 await all();
 if(failPhase==='exact'||failPhase==='below'){filler=limits.maxBytes-balancePeak+(failPhase==='below'?1:0);budget.reserve(filler)}
 if(failPhase&&failPhase!=='exact'){armed=true;tracing=true;await assert.rejects(arena.balanceNonroot(2,1,false,{snapshotCheckpoint(){},async checkpoint(){if(failPhase!=='below'&&new Error().stack.includes(failPhase)){if(failPhase==='#defrag'&&++defragChecks<3)return;hit=true;throw primary}}}),e=>failPhase==='below'?e===limitError&&e instanceof PrivateStateLimitError:e===primary);assert.ok(hit);assert.ok(releases>=3);assert.equal(cursor.position.state,'FAULT');for(let pg=1;pg<=arena.pageCount;pg++)assert.equal(arena.referenceCount(pg),0);await assert.rejects(cursor.insertIndex(key(0),{},control),e=>e===(failPhase==='below'?limitError:primary));armed=false;continue}
 tracing=true;await arena.balanceNonroot(2,1,false,control);tracing=false;if(filler){budget.release(filler);filler=0}if(failPhase===null){balancePeak=peak;assert.match(peakStack,/#defrag/);assert.match(peakStack,/#balanceNonroot/);t.diagnostic(`reachable contraction charged peak${peak} at shallow defrag`)}else assert.equal(peak,balancePeak);await all();
 const root=arena.acquire(2);try{assert.equal(root.page.nCell,5);assert.equal(root.page.leaf,false);assert.equal(root.page.rightChild(),11);assert.deepEqual(Array.from({length:5},(_,i)=>root.page.leftChild(i)),[6,7,8,9,10]);for(let i=0;i<5;i++)assert.equal(root.page.parseCell(i).nPayload,6003)}finally{root.release()}
 await assert.rejects(cursor.insertIndex(Uint8Array.of(2,14,12),{},control),/entry limit/);await all();
 }finally{armed=false;tracing=false;if(filler)budget.release(filler);cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});

test('independently encoded reachable interior expansion transfers old right child at capacity',async()=>{
 let expansionPeak=0;
 for(const [overflow,failPublication] of [[false,false],[true,false],[true,true],[true,'deadline'],[true,'acquire'],[true,'parent-acquire'],[true,'peak-exact'],[true,'peak-below']]){
 let armed=false,hit=false,releases=0;let primary=new Error('encoded expansion publication'),secondary=new Error('encoded expansion cleanup');
 const limits={maxEntries:11,maxKeyBytes:6000,maxBytes:300000},budget=new class extends PrivateStateByteBudget{peak=0;observe=false;rejected=null;ledger=[];owners=[];release(n){super.release(n);if(this.observe)this.ledger.push(n===0?0:-n)}reserve(n,message){try{super.reserve(n,message)}catch(error){this.rejected={n,live:this.usedBytes,stack:new Error().stack,error,ledger:this.ledger.slice(),owners:this.owners.slice()};throw error}if(this.observe){this.ledger.push(n);if(n===128)this.owners.push(new Error().stack);this.peak=Math.max(this.peak,this.usedBytes)}}}(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,pgno)=>{if(armed&&(failPublication==='acquire'||failPublication==='parent-acquire')&&event==='acquire'&&pgno===(failPublication==='parent-acquire'?2:3)){hit=true;throw primary}if(armed&&hit&&event==='release'){releases++;throw secondary}},limits);
 // Local payload900/BLOB897. Overflow payload4992/BLOB4989 has
 // native minLocal489 + (4992-489)%4092 =900 local, one4092 tail page.
 const key=n=>{const b=new Uint8Array(overflow?4992:900);b.set(overflow?[3,0xce,6]:[3,0x8e,0x0e]);b.fill(n,3);return b};
 const cell=(n,child=0)=>{const b=new Uint8Array((child?906:902)+(overflow?4:0));if(child)new DataView(b.buffer).setUint32(0,child);b.set(overflow?[0xa7,0]:[0x87,4],child?4:0);b.set(key(n).subarray(0,900),child?6:2);if(overflow)new DataView(b.buffer).setUint32(b.length-4,10+n);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096),v=new DataView(b.buffer);b[0]=leaf?10:2;v.setUint16(3,cells.length);if(!leaf)v.setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);v.setUint16((leaf?8:12)+2*i,top)});v.setUint16(5,top);return b};
 let cursor,filler=0;
 try{
 arena.installPage(2,page(false,[],3));arena.installPage(3,page(false,[cell(1,4),cell(3,5),cell(5,6),cell(7,7)],9));
 for(let n=0;n<=10;n+=2)arena.installPage(4+n/2,page(true,[cell(n)]));
 if(overflow)for(let n=0;n<=10;n++){const bytes=new Uint8Array(4096);bytes.set(key(n).subarray(900),4);arena.installPage(10+n,bytes)}
 const old=arena.acquire(3);try{assert.equal(old.page.rightChild(),9);await old.page.insertCell(4,cell(9,8),control);assert.equal(old.page.nOverflow,1)}finally{old.release()}
 if(failPublication==='peak-exact'||failPublication==='peak-below'){
   assert.ok(expansionPeak>0);filler=limits.maxBytes-expansionPeak+(failPublication==='peak-below'?1:0);budget.reserve(filler);
 }
 const baseline=budget.usedBytes-filler;budget.observe=true;budget.peak=budget.usedBytes;
 if(failPublication==='peak-below'){
   let limitError;await assert.rejects(arena.balanceNonroot(2,0,false,control),e=>{limitError=e;return e instanceof PrivateStateLimitError});
   for(let pg=1;pg<=arena.pageCount;pg++)assert.equal(arena.referenceCount(pg),0);
   await assert.rejects(arena.balanceNonroot(2,0,false,control),e=>e===limitError);
   assert.equal(budget.rejected.error,limitError);assert.equal(budget.rejected.n,910);assert.equal(budget.rejected.live-filler,94044);
   assert.match(budget.rejected.stack,/#insertCell/);assert.match(budget.rejected.stack,/publishBlobkeyDividers/);
   assert.equal(baseline+budget.rejected.ledger.reduce((a,n)=>a+n,0),94044);assert.equal(baseline,85582);assert.deepEqual(budget.rejected.ledger,[1792,128,256,128,576,256,4224,128,-128,0,128,128,-128,974]);
   assert.equal(budget.rejected.owners.length,5);for(const [i,owner] of ['#acquire','#acquire','#retainRaw','#acquire','rekeyBlobkeySiblings'].entries())assert.ok(budget.rejected.owners[i].includes(owner));
   budget.release(filler);filler=0;continue;
 }
 if(failPublication==='parent-acquire'){
   cursor=new PrivateBlobkeyCursor(arena,info,limits);const before=budget.usedBytes;
   armed=true;await assert.rejects(arena.balanceNonroot(2,0,false,control),e=>e===primary);
   assert.ok(hit);assert.equal(releases,0);assert.equal(budget.usedBytes,before);
   assert.notEqual(cursor.position.state,'FAULT');
   for(let pg=1;pg<=arena.pageCount;pg++)assert.equal(arena.referenceCount(pg),0);
   armed=false;cursor.close();cursor=undefined;
   const pending=arena.acquire(3);try{assert.equal(pending.page.nOverflow,1);assert.equal(pending.page.rightChild(),9)}finally{pending.release()}
   // No admission occurred: retry must run the ordinary successful expansion.
 }
 if(failPublication&&failPublication!=='parent-acquire'&&failPublication!=='peak-exact'){
   cursor=new PrivateBlobkeyCursor(arena,info,limits);armed=true;
   let checkpointsAfterFailure=0;
   const failureControl={snapshotCheckpoint(){},async checkpoint(){
     if(hit){checkpointsAfterFailure++;throw new Error('cleanup must not checkpoint')}
     if(!new Error().stack.includes('#publishChild'))return;
     hit=true;
     if(failPublication==='deadline'){
       // Private callback seam, not VM OperationOptions integration. Match the
       // elapsed predicate while yielding with the mutation token held.
       const started=Date.now();await new Promise(resolve=>setTimeout(resolve,2));
       assert.ok(Date.now()-started>=1,'test deadline expired');
       primary=new Error('private expansion elapsed deadline');primary.name='TimeoutError';
     }
     throw primary;
   }};
   await assert.rejects(arena.balanceNonroot(2,0,false,failureControl),e=>e===primary);
   assert.ok(hit);assert.ok(releases>=(failPublication==='acquire'?1:3));assert.equal(checkpointsAfterFailure,0,'cleanup is noncancellable');
   assert.equal(cursor.position.state,'FAULT');
   for(let pg=1;pg<=arena.pageCount;pg++)assert.equal(arena.referenceCount(pg),0);
   await assert.rejects(arena.balanceNonroot(2,0,false,control),e=>e===primary);
   armed=false;continue;
 }
 await arena.balanceNonroot(2,0,false,control);
 if(overflow&&!failPublication){expansionPeak=budget.peak;assert.equal(expansionPeak,94954)}
 if(failPublication==='peak-exact'){assert.equal(budget.peak,limits.maxBytes);budget.release(filler);filler=0}
 budget.observe=false;
 const root=arena.acquire(2);let right;try{assert.equal(root.page.nCell,1);right=root.page.rightChild();assert.notEqual(right,3)}finally{root.release()}
 const last=arena.acquire(right);try{assert.equal(last.page.leaf,false);assert.equal(last.page.rightChild(),9);assert.equal(last.page.nOverflow,0)}finally{last.release()}
 if(overflow){const pointers=[];const p=arena.acquire(2);let left;try{left=p.page.leftChild(0);const c=p.page.parseCell(0);pointers.push(Array.from({length:4},(_,j)=>p.page.bytes[c.offset+c.nSize-4+j]).reduce((v,n)=>v*256+n,0))}finally{p.release()}
 for(const pg of [left,right]){const q=arena.acquire(pg);try{for(let i=0;i<q.page.nCell;i++){const c=q.page.parseCell(i);pointers.push(Array.from({length:4},(_,j)=>q.page.bytes[c.offset+c.nSize-4+j]).reduce((v,n)=>v*256+n,0))}}finally{q.release()}}
 assert.deepEqual(pointers.sort((a,b)=>a-b),[11,13,15,17,19],'each divider overflow chain retained once');}
 cursor=new PrivateBlobkeyCursor(arena,info,limits);
 for(let n=0;n<=10;n++){const m=new Mem();m.setBlob(key(n).subarray(3));const k=new UnpackedRecordKey([m],0,'seek',info);try{assert.equal((await cursor.indexMoveto(k,control)).res,0,`key${n}`)}finally{k.release();m.release()}}
 await assert.rejects(cursor.insertIndex(key(12),{},control),/entry limit/);
 }finally{armed=false;if(filler)budget.release(filler);cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});

test('reachable ordered minimum leaf divider reparses interior padding at capacity',async()=>{
 for(const bulk of [false,true]){
 const limits={maxEntries:801,maxKeyBytes:20,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,undefined,limits);
 const record=n=>n===0?Uint8Array.of(2,8):Uint8Array.of(2,2,(n>>8)&255,n&255);
 const cell=(n,child=0)=>{const r=record(n),b=new Uint8Array(Math.max(4,r.length+1)+(child?4:0));if(child)new DataView(b.buffer).setUint32(0,child);b[child?4:0]=r.length;b.set(r,child?5:1);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096),v=new DataView(b.buffer);b[0]=leaf?10:2;v.setUint16(3,cells.length);if(!leaf)v.setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);v.setUint16((leaf?8:12)+i*2,top)});v.setUint16(5,top);return b};
 let cursor;
 try{
 // Independently encoded sorted topology: separator0 and400 keys each side.
 const divider=Uint8Array.of(0,0,0,3,2,2,8);arena.installPage(2,page(false,[divider],4));
 arena.installPage(3,page(true,Array.from({length:400},(_,i)=>cell(i-400))));arena.installPage(4,page(true,Array.from({length:400},(_,i)=>cell(i+1))));
 await arena.balanceNonroot(2,1,bulk,control);
 const root=arena.acquire(2);try{assert.equal(root.page.nCell,1);const at=root.page.findCell(0);if(!bulk){assert.equal(root.page.parseCell(0).nSize,7);assert.deepEqual(Array.from(root.page.bytes.subarray(at+4,at+7)),[2,2,8])}else{assert.equal(root.page.parseCell(0).nSize,9);assert.deepEqual(Array.from(root.page.bytes.subarray(at+4,at+9)),[4,2,2,0,184]);const left=arena.acquire(3),right=arena.acquire(4);try{assert.equal(left.page.nCell,584);assert.equal(right.page.nCell,216)}finally{left.release();right.release()}}}finally{root.release()}
 cursor=new PrivateBlobkeyCursor(arena,info,limits);const idle=budget.usedBytes;for(let n=-400;n<=400;n++)assert.equal((await seek(cursor,n)).res,0,`key ${n}`);
 assert.ok(budget.usedBytes>idle);const retained=budget.usedBytes;cursor.clearCursor();assert.equal(budget.usedBytes,retained);
 await assert.rejects(cursor.insertIndex(record(401),{},control),PrivateStateLimitError);
 }finally{cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});

test('packed Insert root expansion promotes ordered minimum leaf divider at capacity',async()=>{
 const limits={maxEntries:585,maxKeyBytes:20,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,undefined,limits);
 const record=n=>n===0?Uint8Array.of(2,8):Uint8Array.of(2,2,(n>>8)&255,n&255);
 const cell=(n,child=0)=>{const r=record(n),b=new Uint8Array(Math.max(4,r.length+1)+(child?4:0));if(child)new DataView(b.buffer).setUint32(0,child);b[child?4:0]=r.length;b.set(r,child?5:1);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096),v=new DataView(b.buffer);b[0]=leaf?10:2;v.setUint16(3,cells.length);if(!leaf)v.setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);v.setUint16((leaf?8:12)+i*2,top)});v.setUint16(5,top);return b};
 let cursor;
 try{
 //584 ordered leaf keys fit4087 bytes including zero's padded4 extent.
 arena.installPage(2,page(true,Array.from({length:584},(_,i)=>cell(i-292))));
 cursor=new PrivateBlobkeyCursor(arena,info,limits);const input=record(292);await cursor.insertIndex(input,{savePosition:true},control);input.fill(0);
 assert.equal(cursor.position.state,'REQUIRESEEK');assert.equal(cursor.position.skipNext,0);for(let pg=1;pg<=arena.pageCount;pg++)assert.equal(arena.referenceCount(pg),0);
 await cursor.restoreCursorPosition(control);assert.equal(cursor.position.state,'VALID');assert.equal(cursor.position.skipNext,0);assert.equal((await seek(cursor,292)).res,0);
 const root=arena.acquire(2);try{assert.equal(root.page.nCell,1);const at=root.page.findCell(0);assert.equal(root.page.parseCell(0).nSize,7);assert.deepEqual(Array.from(root.page.bytes.subarray(at+4,at+7)),[2,2,8])}finally{root.release()}
 const idle=budget.usedBytes;for(let n=-292;n<=292;n++)assert.equal((await seek(cursor,n)).res,0,`key ${n}`);
 assert.ok(budget.usedBytes>idle);const retained=budget.usedBytes;cursor.clearCursor();assert.equal(budget.usedBytes,retained);
 await assert.rejects(cursor.insertIndex(record(293),{},control),PrivateStateLimitError);
 }finally{cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('minimum divider promotion admission failure preserves Insert primary and retires leases',async()=>{
 for(const phase of ['admission','checkpoint']){
 let hit=false,releases=0,held=0,refunded=false,cleanupCheckpoints=0;const primary=new PrivateStateLimitError('minimum promotion admission'),secondary=new Error('release secondary');
 const limits={maxEntries:585,maxKeyBytes:20,maxBytes:4000000},budget=new class extends PrivateStateByteBudget{reserve(n,...args){if(new Error().stack.includes('promoteBlobkeyDivider')){assert.equal(n,72);if(phase==='admission'){hit=true;throw primary}const result=super.reserve(n,...args);held=n;return result}return super.reserve(n,...args)}release(n){super.release(n);if(held&&new Error().stack.includes('promoteBlobkeyDivider')){assert.equal(n,72);held=0;refunded=true}}}(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(hit&&event==='release'){if(phase==='checkpoint'){assert.equal(held,0);assert.ok(refunded)}releases++;throw secondary}},limits);
 const record=n=>n===0?Uint8Array.of(2,8):Uint8Array.of(2,2,(n>>8)&255,n&255);
 const cell=(n,child=0)=>{const r=record(n),b=new Uint8Array(Math.max(4,r.length+1)+(child?4:0));if(child)new DataView(b.buffer).setUint32(0,child);b[child?4:0]=r.length;b.set(r,child?5:1);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096),v=new DataView(b.buffer);b[0]=leaf?10:2;v.setUint16(3,cells.length);if(!leaf)v.setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);v.setUint16((leaf?8:12)+i*2,top)});v.setUint16(5,top);return b};
 const failureControl={snapshotCheckpoint(){},async checkpoint(n){if(hit){cleanupCheckpoints++;throw secondary}if(phase==='checkpoint'&&new Error().stack.includes('promoteBlobkeyDivider')){assert.equal(n,4);assert.equal(held,72);hit=true;throw primary}}};
 let cursor;
 try{
 //584 ordered leaf keys fit4087 bytes including zero's padded4 extent.
 arena.installPage(2,page(true,Array.from({length:584},(_,i)=>cell(i-292))));
 cursor=new PrivateBlobkeyCursor(arena,info,limits);
 await assert.rejects(cursor.insertIndex(record(292),{},failureControl),e=>e===primary);assert.ok(hit);assert.ok(releases>=3);assert.equal(cleanupCheckpoints,0);assert.equal(cursor.position.state,'FAULT');
 for(let pg=1;pg<=arena.pageCount;pg++)assert.equal(arena.referenceCount(pg),0);
 await assert.rejects(cursor.insertIndex(record(292),{},failureControl),e=>e===primary);
 }finally{cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
 }
});

test('ordered bulk expansion consumes low shuffled freelist identity at capacity',async()=>{
 const limits={maxEntries:585,maxKeyBytes:20,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,undefined,limits);
 const record=n=>n===0?Uint8Array.of(2,8):Uint8Array.of(2,2,(n>>8)&255,n&255);
 const cell=(n,child=0)=>{const r=record(n),b=new Uint8Array(Math.max(4,r.length+1)+(child?4:0));if(child)new DataView(b.buffer).setUint32(0,child);b[child?4:0]=r.length;b.set(r,child?5:1);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096),v=new DataView(b.buffer);b[0]=leaf?10:2;v.setUint16(3,cells.length);if(!leaf)v.setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);v.setUint16((leaf?8:12)+i*2,top)});v.setUint16(5,top);return b};
 let cursor;
 try{
 // Native bulk nearby1 chooses3 from freelist order5,3,6, then rekeys
 // reused logical-left7 to3 and fresh logical-right3 to7 (not key sorting).
 arena.installPage(2,page(false,[],7));for(let pg=3;pg<=6;pg++)arena.installPage(pg,page(true,[]));
 arena.installPage(7,page(true,Array.from({length:584},(_,i)=>cell(i-292))));for(const pg of [5,3,6])await arena.freePage(pg,control);
 const source=arena.acquire(7);try{await source.page.insertCell(584,cell(292),control);assert.equal(source.page.nOverflow,1)}finally{source.release()}
 await arena.balanceNonroot(2,0,true,control);
 const root=arena.acquire(2);try{assert.equal(root.page.nCell,1);const at=root.page.findCell(0);assert.deepEqual(Array.from(root.page.bytes.subarray(at,at+9)),[0,0,0,3,4,2,2,1,35]);assert.equal(root.page.rightChild(),7)}finally{root.release()}
 for(const [pg,count] of [[3,583],[7,1]]){const p=arena.acquire(pg);try{assert.equal(p.page.nCell,count);assert.equal(p.page.nOverflow,0)}finally{p.release()}}
 cursor=new PrivateBlobkeyCursor(arena,info,limits);
 const idle=budget.usedBytes;for(let n=-292;n<=292;n++)assert.equal((await seek(cursor,n)).res,0,`key ${n}`);
 assert.ok(budget.usedBytes>idle);const retained=budget.usedBytes;cursor.clearCursor();assert.equal(budget.usedBytes,retained);
 await assert.rejects(cursor.insertIndex(record(293),{},control),PrivateStateLimitError);
 }finally{cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('bulk right-edge window preserves prior child and divider in ordered reachable tree',async()=>{
 const bulk=true;
 const limits={maxEntries:803,maxKeyBytes:20,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,undefined,limits);
 const record=n=>n===0?Uint8Array.of(2,8):Uint8Array.of(2,2,(n>>8)&255,n&255);
 const cell=(n,child=0)=>{const r=record(n),b=new Uint8Array(Math.max(4,r.length+1)+(child?4:0));if(child)new DataView(b.buffer).setUint32(0,child);b[child?4:0]=r.length;b.set(r,child?5:1);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096),v=new DataView(b.buffer);b[0]=leaf?10:2;v.setUint16(3,cells.length);if(!leaf)v.setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);v.setUint16((leaf?8:12)+i*2,top)});v.setUint16(5,top);return b};
 let cursor;
 try{
 // Independently encoded sorted topology: separator0 and400 keys each side.
 arena.installPage(2,page(false,[cell(-401,5),Uint8Array.of(0,0,0,3,2,2,8)],4));
 arena.installPage(3,page(true,Array.from({length:400},(_,i)=>cell(i-400))));arena.installPage(4,page(true,Array.from({length:400},(_,i)=>cell(i+1))));arena.installPage(5,page(true,[cell(-402)]));
 const prior=arena.acquire(5);let before;try{before=Array.from(prior.page.bytes)}finally{prior.release()}
 await arena.balanceNonroot(2,2,bulk,control);
 const root=arena.acquire(2);try{assert.equal(root.page.nCell,2);assert.deepEqual(Array.from(root.page.bytes.subarray(root.page.findCell(0),root.page.findCell(0)+9)),Array.from(cell(-401,5)));const at=root.page.findCell(1);assert.deepEqual(Array.from(root.page.bytes.subarray(at,at+9)),[0,0,0,3,4,2,2,0,184]);assert.equal(root.page.rightChild(),4)}finally{root.release()}
 const after=arena.acquire(5);try{assert.deepEqual(Array.from(after.page.bytes),before)}finally{after.release()}
 cursor=new PrivateBlobkeyCursor(arena,info,limits);const idle=budget.usedBytes;for(let n=-402;n<=400;n++)assert.equal((await seek(cursor,n)).res,0,`key ${n}`);
 assert.ok(budget.usedBytes>idle);const retained=budget.usedBytes;cursor.clearCursor();assert.equal(budget.usedBytes,retained);
 await assert.rejects(cursor.insertIndex(record(401),{},control),PrivateStateLimitError);
 }finally{cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('bulk right-edge second sibling acquire failure excludes prior child and preserves primary',async()=>{
 const bulk=true,primary=new Error("selected acquire"),secondary=new Error("release secondary");let armed=false,hit=false,releases=0;const trace=[];
 const limits={maxEntries:803,maxKeyBytes:20,maxBytes:4000000},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,pg)=>{if(!armed)return;if(event==='acquire'){trace.push(pg);if(pg===3){hit=true;throw primary}}if(hit&&event==='release'){releases++;throw secondary}},limits);
 const record=n=>n===0?Uint8Array.of(2,8):Uint8Array.of(2,2,(n>>8)&255,n&255);
 const cell=(n,child=0)=>{const r=record(n),b=new Uint8Array(Math.max(4,r.length+1)+(child?4:0));if(child)new DataView(b.buffer).setUint32(0,child);b[child?4:0]=r.length;b.set(r,child?5:1);return b};
 const page=(leaf,cells,right=0)=>{const b=new Uint8Array(4096),v=new DataView(b.buffer);b[0]=leaf?10:2;v.setUint16(3,cells.length);if(!leaf)v.setUint32(8,right);let top=4096;cells.forEach((c,i)=>{top-=c.length;b.set(c,top);v.setUint16((leaf?8:12)+i*2,top)});v.setUint16(5,top);return b};
 let cursor;
 try{
 // Independently encoded sorted topology: separator0 and400 keys each side.
 arena.installPage(2,page(false,[cell(-401,5),Uint8Array.of(0,0,0,3,2,2,8)],4));
 arena.installPage(3,page(true,Array.from({length:400},(_,i)=>cell(i-400))));arena.installPage(4,page(true,Array.from({length:400},(_,i)=>cell(i+1))));arena.installPage(5,page(true,[cell(-402)]));
 cursor=new PrivateBlobkeyCursor(arena,info,limits);armed=true;
 await assert.rejects(arena.balanceNonroot(2,2,bulk,control),e=>e===primary);
 assert.deepEqual(trace,[2,4,3]);assert.equal(releases,2);assert.equal(cursor.position.state,'FAULT');
 for(let pg=1;pg<=5;pg++)assert.equal(arena.referenceCount(pg),0);
 await assert.rejects(cursor.insertIndex(record(401),{},control),e=>e===primary);
 }finally{cursor?.close();arena.close();assert.equal(budget.usedBytes,0)}
});

test('Insert rejects nonenumerable unadmitted caller flags before work or peer save',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,undefined,{maxEntries:10,maxKeyBytes:20}),cursor=new PrivateBlobkeyCursor(arena,info,{maxEntries:10,maxKeyBytes:20,maxBytes:100000});
 try{
 const before=budget.usedBytes;
 for(const flag of ['preformat','transferRow','seekResult','seekEvidence']){
 const options=Object.defineProperty({},flag,{value:true});
 await assert.rejects(cursor.insertIndex(Uint8Array.of(2,8),options,{async checkpoint(){throw new Error('unexpected work')}}),/options unadmitted/);
 assert.equal(budget.usedBytes,before);
 }
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
