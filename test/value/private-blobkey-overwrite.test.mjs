import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const control={async checkpoint(){},snapshotCheckpoint(){}};
const put4=(b,o,n)=>{b[o]=n>>>24;b[o+1]=n>>>16;b[o+2]=n>>>8;b[o+3]=n};
const get4=(b,o)=>b[o]*16777216+b[o+1]*65536+b[o+2]*256+b[o+3];
async function fixture(length,hook=()=>{}){
 const budget=new PrivateStateByteBudget(200000),arena=await PrivateBlobkeyPages.open(budget,control,hook,{maxEntries:1,maxKeyBytes:10000});
 const input=new Uint8Array(length).fill(7),filled=await arena.fillCell(2,input,control);
 const leaf=new Uint8Array(4096);leaf[0]=10;leaf[4]=1;const offset=4096-filled.bytes.length;leaf[5]=offset>>>8;leaf[6]=offset;leaf[8]=offset>>>8;leaf[9]=offset;
 for(let i=0;i<filled.bytes.length;i++)leaf[offset+i]=filled.bytes[i];filled.release();arena.installPage(2,leaf);
 return {budget,arena,input,offset};
}
for(const length of [20,6000])test(`native same-length payload overwrite ${length}: chain and slot conserved`,async()=>{
 const {arena,budget,input,offset}=await fixture(length);
 try{
  let lease=arena.acquire(2),cell=lease.page.parseCell(0),before=[];
  for(let i=0;i<cell.nSize;i++)before.push(lease.page.bytes[offset+i]);lease.release();
  const pages=arena.pageCount,next=input.slice();next.fill(9);
  await arena.overwriteCell(2,0,next,control);
  lease=arena.acquire(2);cell=lease.page.parseCell(0);
  assert.equal(lease.page.nCell,1);assert.equal(lease.page.findCell(0),offset);
  for(let i=0;i<cell.nLocal;i++)assert.equal(lease.page.bytes[cell.payloadOffset+i],9);
  let pgno=cell.overflowOffset===null?0:get4(lease.page.bytes,cell.overflowOffset);lease.release();
  let remaining=length-cell.nLocal;
  while(remaining){const raw=arena.acquireRaw(pgno),n=Math.min(4092,remaining);for(let i=0;i<n;i++)assert.equal(raw.bytes[4+i],9);remaining-=n;if(remaining)pgno=get4(raw.bytes,0);raw.release()}
  assert.equal(arena.pageCount,pages);
  await assert.rejects(arena.overwriteCell(2,0,new Uint8Array(length+1),control),/same.*length/);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('final overflow next is ignored; local writes precede acquire failure and FAULT',async()=>{
 let armed=false;const failure=new Error('overflow acquire');
 const {arena,budget,offset}=await fixture(6000,(event,pgno)=>{if(armed&&event==='acquire'&&pgno!==2)throw failure});
 try{
  const l=arena.acquire(2),cell=l.page.parseCell(0),pg=get4(l.page.bytes,cell.overflowOffset);l.release();
  // Construction seam independently corrupts only the final unused pointer.
  let raw=arena.acquireRaw(pg),next=get4(raw.bytes,0);raw.release();raw=arena.acquireRaw(next);const bytes=new Uint8Array(4096);for(let i=0;i<4096;i++)bytes[i]=raw.bytes[i];raw.release();put4(bytes,0,0xffffffff);arena.installPage(next,bytes);
  await arena.overwriteCell(2,0,new Uint8Array(6000).fill(8),control);
  armed=true;await assert.rejects(arena.overwriteCell(2,0,new Uint8Array(6000).fill(9),control),e=>e===failure);
  assert.throws(()=>arena.acquire(2),e=>e===failure);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
test('interior overwrite preserves left and right child pointers',async()=>{
 const {arena,budget}=await fixture(20);
 try{
  const b=new Uint8Array(4096);b[0]=2;b[4]=1;b[5]=15;b[6]=231;b[12]=15;b[13]=231;
  put4(b,8,123);put4(b,4071,456);b[4075]=20;b.fill(7,4076);
  arena.installPage(2,b);
  await arena.overwriteCell(2,0,new Uint8Array(20).fill(9),control);
  const lease=arena.acquire(2);assert.equal(lease.page.leftChild(0),456);assert.equal(lease.page.rightChild(),123);lease.release();
  await arena.overwriteCell(2,0,new Uint8Array(20).fill(9),control);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('snapshot cancellation is retryable and refunds charged peak',async()=>{
 const {arena,budget,input}=await fixture(20);const failure=new Error('snapshot');
 try{
  const before=budget.usedBytes;
  await assert.rejects(arena.overwriteCell(2,0,input,{async checkpoint(){},snapshotCheckpoint(){throw failure}}),e=>e===failure);
  assert.equal(budget.usedBytes,before);
  await arena.overwriteCell(2,0,input,control);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('overflow acquire primary error wins over root release observer error',async()=>{
 let armed=false;const primary=new Error('acquire'),cleanup=new Error('cleanup');
 const {arena,budget}=await fixture(6000,(event,pg)=>{if(armed&&event==='acquire'&&pg!==2)throw primary;if(armed&&event==='release'&&pg===2)throw cleanup});
 try{
  armed=true;await assert.rejects(arena.overwriteCell(2,0,new Uint8Array(6000).fill(9),control),e=>e===primary);
  assert.equal(arena.referenceCount(2),0);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
test('typed equal writer owns reseek and peer saves without releasing arena admission',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');
 const {KeyInfo,UnpackedRecordKey}=await import('../../src/internal/comparison.ts');
 const {Mem}=await import('../../src/internal/mem.ts');
 const limits={maxEntries:1,maxKeyBytes:100,maxBytes:100000};
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'nocase'}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 // header2, text serial15, UTF8 'a': collating equal to 'A', same length.
 const b=new Uint8Array(4096);b[0]=10;b[4]=1;b[5]=15;b[6]=252;b[8]=15;b[9]=252;b.set([3,2,15,97],4092);arena.installPage(2,b);
 const writer=new PrivateBlobkeyCursor(arena,info,limits),peer=new PrivateBlobkeyCursor(arena,info,limits);
 const m=new Mem();m.setText(Uint8Array.of(97),'utf-8');const k=new UnpackedRecordKey([m],0,'seek',info);
 try{
  await peer.indexMoveto(k,control);
  await writer.replaceIndexEqual(new Uint8Array([2,15,65]),control);
  assert.equal(peer.position.state,'REQUIRESEEK');
  assert.equal(writer.position.state,'VALID');assert.equal(writer.position.index,0);
  await peer.restoreCursorPosition(control);
  await assert.rejects(writer.replaceIndexEqual(new Uint8Array([2,15,98]),control),/equal/);
 }finally{k.release();m.release();writer.close();peer.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('typed equal writer keeps gate across seek suspension and refunds failed snapshot',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');
 const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:1,maxKeyBytes:100,maxBytes:100000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const b=new Uint8Array(4096);b[0]=10;b[4]=1;b[5]=15;b[6]=252;b[8]=15;b[9]=252;b.set([3,2,1,7],4092);arena.installPage(2,b);
 const c=new PrivateBlobkeyCursor(arena,info,limits),failure=new Error('snapshot');
 try{
  const before=budget.usedBytes;
  await assert.rejects(c.replaceIndexEqual(new Uint8Array([2,1,7]),{async checkpoint(){},snapshotCheckpoint(){throw failure}}),e=>e===failure);
  assert.equal(budget.usedBytes,before);
  let entered,resume;const start=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);
  const pending=c.replaceIndexEqual(new Uint8Array([2,1,7]),{async checkpoint(){entered();await gate},snapshotCheckpoint(){}});
  await start;try{assert.throws(()=>arena.acquire(2),/operation/);await assert.rejects(c.replaceIndexEqual(new Uint8Array([2,1,7]),control),/operation/)}finally{resume();await pending}
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('writer internal seek results are scratch, not caller-published retained results',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');
 const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:1,maxKeyBytes:100,maxBytes:100000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const b=new Uint8Array(4096);b[0]=10;b[4]=1;b[5]=15;b[6]=252;b[8]=15;b[9]=252;b.set([3,2,1,7],4092);arena.installPage(2,b);
 const writer=new PrivateBlobkeyCursor(arena,info,limits);
 try{
  await writer.replaceIndexEqual(new Uint8Array([2,1,7]),control);
  const baseline=budget.usedBytes;
  for(let i=0;i<10;i++)await writer.replaceIndexEqual(new Uint8Array([2,1,7]),control);
  assert.equal(budget.usedBytes,baseline,'native internal pRes is temporary; equal writes must not retain 64 bytes each');
 }finally{writer.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('typed local NEW owns signed positioning and conserves equal at exact capacity',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');
 const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:2,maxKeyBytes:100,maxBytes:100000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),c=new PrivateBlobkeyCursor(arena,info,limits);
 try{
  await c.insertIndexLocal(Uint8Array.of(2,1,2),control);
  await c.insertIndexLocal(Uint8Array.of(2,1,1),control);
  await c.insertIndexLocal(Uint8Array.of(2,1,2),control);
  await assert.rejects(c.insertIndexLocal(Uint8Array.of(2,1,3),control),/entry limit/);
  const l=arena.acquire(2);assert.equal(l.page.nCell,2);assert.equal(l.page.bytes[l.page.parseCell(0).payloadOffset+2],1);assert.equal(l.page.bytes[l.page.parseCell(1).payloadOffset+2],2);l.release();
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('local writer rejects required balance before NEW ownership or publication',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:700,maxKeyBytes:100,maxBytes:200000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),b=new Uint8Array(4096);
 b[0]=10;b[3]=681>>>8;b[4]=681&255;const top=4096-681*4;b[5]=top>>>8;b[6]=top;
 for(let i=0;i<681;i++){const o=top+4*i;b[8+i*2]=o>>>8;b[9+i*2]=o;b.set([3,2,1,1],o)}arena.installPage(2,b);const c=new PrivateBlobkeyCursor(arena,info,limits);
 try{
  await assert.rejects(c.insertIndexLocal(Uint8Array.of(2,1,2),control),/requires balance/);
  const l=arena.acquire(2);assert.equal(l.page.nCell,681);for(let i=0;i<4096;i++)assert.equal(l.page.bytes[i],b[i]);l.release();
  await c.insertIndexLocal(Uint8Array.of(2,1,1),control);
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('typed differing-length local equality replaces at exact entry capacity',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:1,maxKeyBytes:100,maxBytes:100000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),c=new PrivateBlobkeyCursor(arena,info,limits);
 try{
  await c.insertIndexLocal(Uint8Array.of(2,15,97),control);
  await c.insertIndexLocal(Uint8Array.of(2,19,97,32,32),control);
  let l=arena.acquire(2);assert.equal(l.page.nCell,1);assert.equal(l.page.parseCell(0).nPayload,5);l.release();
  await c.insertIndexLocal(Uint8Array.of(2,15,97),control);
  l=arena.acquire(2);assert.equal(l.page.nCell,1);assert.equal(l.page.parseCell(0).nPayload,3);l.release();
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('local replacement same physical cell size uses direct native branch',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:1,maxKeyBytes:100,maxBytes:100000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),c=new PrivateBlobkeyCursor(arena,info,limits);
 try{
  await c.insertIndexLocal(Uint8Array.of(2,13),control);
  let l=arena.acquire(2),offset=l.page.parseCell(0).offset;l.release();
  await c.insertIndexLocal(Uint8Array.of(2,15,32),control);
  l=arena.acquire(2);assert.equal(l.page.parseCell(0).offset,offset);assert.equal(l.page.nCell,1);assert.equal(l.page.parseCell(0).nPayload,3);l.release();
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('replacement failure after drop is terminal even before insert publication',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:1,maxKeyBytes:100,maxBytes:100000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits),c=new PrivateBlobkeyCursor(arena,info,limits),failure=new Error('insert snapshot');
 try{
  await c.insertIndexLocal(Uint8Array.of(2,15,97),control);
  await assert.rejects(c.insertIndexLocal(Uint8Array.of(2,19,97,32,32),{snapshotCheckpoint(n){if(n===6)throw failure},async checkpoint(){}}),e=>e===failure);
  assert.throws(()=>arena.acquire(2),e=>e===failure);
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('typed differing-length interior divider replacement preserves both child owners',async()=>{
 const {PrivateBlobkeyCursor}=await import('../../src/internal/private-blobkey-pages.ts');const {KeyInfo}=await import('../../src/internal/comparison.ts');
 const limits={maxEntries:1,maxKeyBytes:100,maxBytes:100000},info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'rtrim'}]});
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const b=new Uint8Array(4096);b[0]=2;b[4]=1;b[5]=15;b[6]=248;b[12]=15;b[13]=248;put4(b,8,4);put4(b,4088,3);b.set([3,2,15,97],4092);arena.installPage(2,b);
 const c=new PrivateBlobkeyCursor(arena,info,limits);
 try{
  await c.insertIndexLocal(Uint8Array.of(2,19,97,32,32),control);
  const l=arena.acquire(2);assert.equal(l.page.nCell,1);assert.equal(l.page.leftChild(0),3);assert.equal(l.page.rightChild(),4);assert.equal(l.page.parseCell(0).nPayload,5);l.release();
  await c.insertIndexLocal(Uint8Array.of(2,15,97),control);
 }finally{c.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('overwrite partial first overflow publication survives later checkpoint failure with primary cleanup',async()=>{
 let armed=false;const released=[],primary=new Error('last overflow checkpoint'),secondary=new Error('last overflow cleanup');
 const {arena,budget,input}=await fixture(6000,(event,p,bytes)=>{if(armed&&event==='release'&&p>=3){released.push([p,bytes[4]]);if(p===4)throw secondary}});
 try{armed=true;let probes=0;await assert.rejects(arena.overwriteCell(2,0,new Uint8Array(6000).fill(9),{snapshotCheckpoint(){},async checkpoint(n){if(n===1419){probes++;throw primary}}}),e=>e===primary);assert.equal(probes,1);assert.deepEqual(released,[[3,9],[4,7]]);assert.equal(arena.referenceCount(3),0);assert.equal(arena.referenceCount(4),0);await assert.rejects(arena.overwriteCell(2,0,input,control),e=>e===primary);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
