import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo,UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:100000};
const control={async checkpoint(){}};
function key(){const m=new Mem();m.setInt64(1n);return new UnpackedRecordKey([m],0,'seek',info)}
test('suspended seek excludes arena aliases, peer seeks, construction and lifecycle',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const a=new PrivateBlobkeyCursor(arena,info,limits),b=new PrivateBlobkeyCursor(arena,info,limits),ka=key(),kb=key();
 let entered,resume;const start=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);
 const pending=a.indexMoveto(ka,{async checkpoint(){entered();await gate}});await start;
 try{
  assert.throws(()=>{const l=arena.acquire(2);l.release()},/operation/);assert.throws(()=>{const l=arena.acquireRaw(2);l.release()},/operation/);
  await assert.rejects(b.indexMoveto(kb,control),/operation/);
  assert.throws(()=>b.close(),/operation/);assert.throws(()=>arena.close(),/operation/);
 }finally{resume();await pending;ka.release();kb.release();a.close();b.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('suspended page edit excludes arena aliases and peer seek',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const lease=arena.acquire(2),c=new PrivateBlobkeyCursor(arena,info,limits),k=key();
 let entered,resume;const start=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);
 const pending=lease.page.insertCell(0,new Uint8Array([3,2,1,7]),{async checkpoint(){entered();await gate}});await start;
 try{assert.throws(()=>{const l=arena.acquireRaw(2);l.release()},/operation/);await assert.rejects(c.indexMoveto(k,control),/operation/)}
 finally{resume();await pending;k.release();lease.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('acquire hook cannot reenter the owning arena',async()=>{
 let armed=false,calls=0;let arena;
 const budget=new PrivateStateByteBudget(limits.maxBytes);
 arena=await PrivateBlobkeyPages.open(budget,control,(event)=>{
  if(armed&&event==='acquire'){armed=false;calls++;assert.throws(()=>{const l=arena.acquireRaw(2);l.release()},/operation/);assert.throws(()=>arena.close(),/operation/)}
 },limits);
 try{armed=true;const lease=arena.acquire(2);lease.release();assert.equal(calls,1)}finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('save/restore retains packed position and releases source leases',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const bytes=new Uint8Array(4096);bytes[0]=10;bytes[4]=1;bytes[5]=15;bytes[6]=252;bytes[8]=15;bytes[9]=252;bytes.set([3,2,1,1],4092);arena.installPage(2,bytes);
 const c=new PrivateBlobkeyCursor(arena,info,limits),k=key();
 try{
  await c.indexMoveto(k,control);await c.saveCursorPosition(control);
  assert.equal(c.position.state,'REQUIRESEEK');assert.equal(arena.referenceCount(2),0);
  await c.restoreCursorPosition(control);assert.equal(c.position.state,'VALID');assert.equal(c.position.index,0);
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
function leaf(n){const bytes=new Uint8Array(4096);bytes[0]=10;bytes[4]=1;bytes[5]=15;bytes[6]=252;bytes[8]=15;bytes[9]=252;bytes.set([3,2,1,n],4092);return bytes}
async function opened(){const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);arena.installPage(2,leaf(1));return {budget,arena,c:new PrivateBlobkeyCursor(arena,info,limits),k:key()}}
test('save read failure retains position and retry refunds pending saved capacity',async()=>{
 const {budget,arena,c,k}=await opened();const failure=new Error('save read');
 try{await c.indexMoveto(k,control);const before=budget.usedBytes;
  await assert.rejects(c.saveCursorPosition({async checkpoint(){throw failure}}),e=>e===failure);
  assert.equal(budget.usedBytes,before);assert.equal(c.position.state,'VALID');assert.equal(arena.referenceCount(2),1);
  await c.saveCursorPosition(control);await c.restoreCursorPosition(control);assert.equal(c.position.state,'VALID');
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('restore seek failure retains saved charge with INVALID and does not accidentally retry',async()=>{
 const {budget,arena,c,k}=await opened();const failure=new Error('restore read');
 try{await c.indexMoveto(k,control);await c.saveCursorPosition(control);const before=budget.usedBytes;
  await assert.rejects(c.restoreCursorPosition({async checkpoint(){throw failure}}),e=>e===failure);
  assert.equal(budget.usedBytes,before);assert.equal(c.position.state,'INVALID');
  await c.restoreCursorPosition({async checkpoint(){throw new Error('must not retry')}});
  const charged=budget.usedBytes;c.clearCursor();assert.equal(charged-budget.usedBytes,84);
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('restore neighbor preserves signed SKIPNEXT; empty restore is INVALID',async()=>{
 for(const n of [0,2,null]){
  const {budget,arena,c,k}=await opened();
  try{await c.indexMoveto(k,control);await c.saveCursorPosition(control);
   const bytes=n===null?new Uint8Array(4096):leaf(n);if(n===null){bytes[0]=10;bytes[5]=16}arena.installPage(2,bytes);
   await c.restoreCursorPosition(control);assert.equal(c.position.state,n===null?'INVALID':'SKIPNEXT');
  }finally{k.release();c.close();arena.close()}
  assert.equal(budget.usedBytes,0);
 }
});
test('pinned save rejects before work and remains retryable',async()=>{
 const {budget,arena,c,k}=await opened();
 try{await c.indexMoveto(k,control);c.setPinned(true);const before=budget.usedBytes;
  await assert.rejects(c.saveCursorPosition({async checkpoint(){throw new Error('must not run')}}),/pinned/);
  assert.equal(budget.usedBytes,before);assert.equal(c.position.state,'VALID');c.setPinned(false);await c.saveCursorPosition(control);
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('ClearTable saves peers, keeps root2 and counts interior dividers',async()=>{
 const {budget,arena,c,k}=await opened();
 await c.indexMoveto(k,control);
 try{assert.equal(await arena.clearTable(control),1);assert.equal(c.position.state,'REQUIRESEEK');await c.restoreCursorPosition(control);assert.equal(c.position.state,'INVALID');assert.equal(arena.pageCount,2)}finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('last owning cursor disposes arena; fixture cursor remains nonowning',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const a=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),b=new PrivateBlobkeyCursor(arena,info,limits,{owning:true});
 a.close();assert.ok(budget.usedBytes>0);b.close();b.close();assert.equal(budget.usedBytes,0);assert.throws(()=>arena.acquire(2),/closed/);
});
test('clear depth first counts interior divider and retains charged freelist pages',async()=>{
 const {budget,arena,c,k}=await opened();
 try{
  const root=new Uint8Array(4096);root[0]=2;root[4]=1;root[5]=15;root[6]=248;root[8+3]=4;root[12]=15;root[13]=248;root.set([0,0,0,3,3,2,1,1],4088);
  arena.installPage(3,leaf(0));arena.installPage(4,leaf(2));arena.installPage(2,root);
  assert.equal(await arena.clearTable(control),3);assert.equal(arena.pageCount,4);
  const reused=await arena.allocatePage(3,control);assert.ok([3,4].includes(reused.pgno));reused.release();assert.equal(arena.pageCount,4);
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('foreign lease close rejects without unlink; admitted last close refunds after collision',async()=>{
 const failure=new Error('release collision');let armed=false;
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event)=>{if(armed&&event==='release')throw failure},limits);
 const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),k=key();
 await c.indexMoveto(k,control);const foreign=arena.acquireRaw(2);
 assert.throws(()=>c.close(),/foreign/);foreign.release();armed=true;
 assert.throws(()=>c.close(),e=>e===failure);c.close();k.release();assert.equal(budget.usedBytes,0);
});
test('partial clear faults registered cursor and owning last close disposes',async()=>{
 const failure=new Error('clear post-write release');let armed=false;const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='release')throw failure},limits);
 const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true});arena.installPage(2,leaf(1));
 armed=true;await assert.rejects(arena.clearTable(control),e=>e===failure);
 assert.equal(c.position.state,'FAULT');await assert.rejects(c.restoreCursorPosition(control),e=>e===failure);c.close();assert.equal(budget.usedBytes,0);
});
test('page mutation failure faults arena and registered cursors with primary error',async()=>{
 const failure=new Error('page write failure');const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),lease=arena.acquire(2);let calls=0;
 await assert.rejects(lease.page.insertCell(0,new Uint8Array([3,2,1,1]),{async checkpoint(){if(++calls===2)throw failure}}),e=>e===failure);
 assert.equal(c.position.state,'FAULT');assert.throws(()=>arena.acquire(2),e=>e===failure);
 lease.release();await assert.rejects(c.restoreCursorPosition(control),e=>e===failure);c.close();assert.equal(budget.usedBytes,0);
});
test('suspended page edit rejects second NEW before admitting an entry',async()=>{
 const tight={...limits,maxEntries:1},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},tight),lease=arena.acquire(2);
 let enter,resume;const started=new Promise(r=>enter=r),gate=new Promise(r=>resume=r);
 const pending=lease.page.insertCell(0,new Uint8Array([3,2,1,1]),{async checkpoint(){enter();await gate}});await started;
 try{await assert.rejects(lease.page.insertCell(0,new Uint8Array([3,2,1,2]),control),/operation/)}
 finally{resume();await pending;lease.release();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('terminal trip faults saved peer despite cleanup collision and last close refunds all',async()=>{
 const primary=new Error('clear failure'),cleanup=new Error('peer release');let armed=false;
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='release')throw cleanup},limits);
 const saved=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),k=key();arena.installPage(2,leaf(1));await saved.indexMoveto(k,control);await saved.saveCursorPosition(control);
 saved.clearCursor();const root=new Uint8Array(4096);root[0]=2;root[4]=1;root[5]=15;root[6]=248;root[8]=0;root[9]=0;root[10]=0;root[11]=4;root[12]=15;root[13]=248;root.set([0,0,0,3,3,2,1,1],4088);arena.installPage(3,leaf(1));arena.installPage(4,leaf(2));
 // release the cleared cursor path before replacing fixture root
 await arena.clearTable(control);arena.installPage(2,root);await saved.indexMoveto(k,control);await saved.saveCursorPosition(control);
 await assert.rejects(arena.clearTable({async checkpoint(units){if(units===4096){armed=true;throw primary}}}),e=>e===primary);
 assert.equal(saved.position.state,'FAULT');assert.throws(()=>saved.clearCursor(),e=>e===primary);saved.close();k.release();assert.equal(budget.usedBytes,0);
});
test('linear transfer conserves one entry at exact capacity including suspended transit',async()=>{
 const tight={...limits,maxEntries:1},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},tight);
 arena.installPage(2,leaf(1));const empty=new Uint8Array(4096);empty[0]=10;empty[5]=16;arena.installPage(3,empty);
 let enter,resume,calls=0;const started=new Promise(r=>enter=r),gate=new Promise(r=>resume=r);
 try{const pending=arena.transferCell(2,0,3,0,{async checkpoint(){if(++calls===3){enter();await gate}}});await started;
  assert.throws(()=>arena.acquire(3),/operation/);resume();await pending;
  const a=arena.acquire(2),b=arena.acquire(3);assert.equal(a.page.nCell,0);assert.equal(b.page.nCell,1);
  await assert.rejects(a.page.insertCell(0,new Uint8Array([3,2,1,2]),control),/entry limit/);a.release();b.release();
 }finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('failed transfer retains primary failure and terminal disposal refunds transit scratch',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{}, {...limits,maxEntries:1});
 arena.installPage(2,leaf(1));const empty=new Uint8Array(4096);empty[0]=10;empty[5]=16;arena.installPage(3,empty);const failure=new Error('transfer insert');let calls=0;
 try{await assert.rejects(arena.transferCell(2,0,3,0,{async checkpoint(){if(++calls===3)throw failure}}),e=>e===failure);assert.throws(()=>arena.acquire(2),e=>e===failure)}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('transfer snapshot failure before source drop is retryable and refunds charged copy',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{}, {...limits,maxEntries:1});arena.installPage(2,leaf(1));const empty=new Uint8Array(4096);empty[0]=10;empty[5]=16;arena.installPage(3,empty);
 const failure=new Error('drop checkpoint');let calls=0;
 try{await assert.rejects(arena.transferCell(2,0,3,0,{async checkpoint(){if(++calls===2)throw failure}}),e=>e===failure);const p=arena.acquire(2);assert.equal(p.page.nCell,1);p.release();await arena.transferCell(2,0,3,0,control)}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('REPLACE conserves entry at exact capacity and retains packed authority',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{}, {...limits,maxEntries:1});arena.installPage(2,leaf(1));
 try{await arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),control);const lease=arena.acquire(2);assert.equal(lease.page.nCell,1);assert.equal(lease.page.bytes[4095],2);await assert.rejects(lease.page.insertCell(1,new Uint8Array([3,2,1,3]),control),/entry limit/);lease.release()}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('REPLACE rejects unsupported PREFORMAT before work and remains retryable',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{}, {...limits,maxEntries:1});arena.installPage(2,leaf(1));
 try{await assert.rejects(arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),{async checkpoint(){throw new Error('must not work')}},{preformat:true}),/PREFORMAT/);await arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),control)}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('REPLACE snapshots caller bytes before suspension and retries pre-write failure',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{}, {...limits,maxEntries:1});arena.installPage(2,leaf(1));let calls=0;const failure=new Error('replace before write');
 try{await assert.rejects(arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),{async checkpoint(){if(++calls===2)throw failure}}),e=>e===failure);
 const input=new Uint8Array([3,2,1,2]);await arena.replaceCell(2,0,input,{async checkpoint(){input[3]=3}});const lease=arena.acquire(2);assert.equal(lease.page.bytes[4095],2);lease.release()}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('staged TRANSFER moves ownership at exact capacity without teardown deleting destination',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{}, {...limits,maxEntries:682});
 const full=new Uint8Array(4096);full[0]=10;full[3]=2;full[4]=169;full[5]=5;full[6]=92;
 for(let i=0;i<681;i++){const off=1372+4*i;full[8+2*i]=off>>>8;full[9+2*i]=off&255;full.set([3,2,1,1],off)}arena.installPage(2,full);
 const empty=new Uint8Array(4096);empty[0]=10;empty[5]=16;arena.installPage(3,empty);
 const source=arena.acquire(2);await source.page.insertCell(681,new Uint8Array([3,2,1,2]),control);source.release();
 try{await arena.transferStagedCell(2,3,0,control);const a=arena.acquire(2),b=arena.acquire(3);assert.equal(a.page.nOverflow,0);assert.equal(a.page.nCell,681);assert.equal(b.page.nCell,1);a.page.releaseStagedCells();await assert.rejects(b.page.insertCell(1,new Uint8Array([3,2,1,3]),control),/entry limit/);a.release();b.release()}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('staged consumption failure faults registry and preserves primary over lease cleanup',async()=>{
 const primary=new Error('target staged insert'),cleanup=new Error('release collision');let armed=false;
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='release')throw cleanup}, {...limits,maxEntries:682});
 const full=new Uint8Array(4096);full[0]=10;full[3]=2;full[4]=169;full[5]=5;full[6]=92;
 for(let i=0;i<681;i++){const off=1372+4*i;full[8+2*i]=off>>>8;full[9+2*i]=off&255;full.set([3,2,1,1],off)}arena.installPage(2,full);const empty=new Uint8Array(4096);empty[0]=10;empty[5]=16;arena.installPage(3,empty);
 const source=arena.acquire(2);await source.page.insertCell(681,new Uint8Array([3,2,1,2]),control);source.release();const owner=new PrivateBlobkeyCursor(arena,info,{...limits,maxEntries:682},{owning:true});let calls=0;
 await assert.rejects(arena.transferStagedCell(2,3,0,{async checkpoint(){if(++calls===3){armed=true;throw primary}}}),e=>e===primary);
 assert.equal(owner.position.state,'FAULT');assert.equal(arena.referenceCount(2),0);assert.equal(arena.referenceCount(3),0);owner.close();assert.equal(budget.usedBytes,0);
});
test('overflow save owns padded packed key, ignores final next pointer and restores after fault-free read retry',async()=>{
 let fail=false;const primary=new Error('saved overflow acquire');
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(fail&&event==='acquire'&&p===3)throw primary},limits);
 const packed=new Uint8Array(2000);packed.set([3,0x9f,0x26]);packed.fill(7,3);
 const root=new Uint8Array(4096);root[0]=10;root[4]=1;root[5]=13;root[6]=172;root[8]=13;root[9]=172;root.set([0x8f,0x50],3500);root.set(packed.subarray(0,489),3502);new DataView(root.buffer).setUint32(3991,3);
 const overflow=new Uint8Array(4096);new DataView(overflow.buffer).setUint32(0,99);overflow.set(packed.subarray(489),4);arena.installPage(2,root);arena.installPage(3,overflow);
 const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),m=new Mem();m.setBlob(packed.slice(3));const k=new UnpackedRecordKey([m],0,'seek',info);
 try{await c.indexMoveto(k,control);assert.equal(c.position.overflowValid,false);assert.equal(c.position.overflowCapacity,2);const before=budget.usedBytes;fail=true;await assert.rejects(c.saveCursorPosition(control),e=>e===primary);assert.equal(c.position.state,'VALID');assert.equal(arena.referenceCount(3),0);assert.equal(c.position.overflowValid,false);assert.equal(c.position.overflowCapacity,2);fail=false;
 const saveBase=budget.usedBytes;let measured=false;await c.saveCursorPosition({async checkpoint(){if(!measured){assert.equal(budget.usedBytes-saveBase,2081,'packed length +17 padding +64 descriptor admitted before read');measured=true}}});assert.equal(c.position.state,'REQUIRESEEK');assert.equal(c.position.overflowValid,false);assert.equal(c.position.overflowCapacity,2);assert.equal(arena.referenceCount(2),0);assert.ok(budget.usedBytes>=before+2000,'saved packed key retained');
 await c.restoreCursorPosition(control);assert.equal(c.position.state,'VALID');assert.equal(c.position.index,0);
 }finally{k.release();c.close()}
 assert.equal(budget.usedBytes,0);
});
test('SKIPNEXT sign survives exact save/restore rather than reset to VALID',async()=>{
 const {budget,arena,c,k}=await opened();try{await c.indexMoveto(k,control);await c.saveCursorPosition(control);arena.installPage(2,leaf(2));await c.restoreCursorPosition(control);assert.equal(c.position.state,'SKIPNEXT');const sign=c.position.skipNext;assert.equal(sign,1);
 await c.saveCursorPosition(control);await c.restoreCursorPosition(control);assert.equal(c.position.state,'SKIPNEXT');assert.equal(c.position.skipNext,sign);
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('clear root pre-write cancellation keeps saved peers retryable and unchanged bytes',async()=>{
 const {budget,arena,c,k}=await opened();const primary=new Error('root pre-write');
 try{await c.indexMoveto(k,control);const epoch=arena.epoch;
 await assert.rejects(arena.clearTable({async checkpoint(units){if(units===4096)throw primary}}),e=>e===primary);
 assert.equal(arena.epoch,epoch);assert.equal(c.position.state,'REQUIRESEEK');
 await c.restoreCursorPosition(control);assert.equal(c.position.state,'VALID');assert.equal(c.position.index,0);
 assert.equal(await arena.clearTable(control),1);await c.restoreCursorPosition(control);assert.equal(c.position.state,'INVALID');
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('clear stops on peer-save failure without losing previously saved peers or gate',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);arena.installPage(2,leaf(1));
 const a=new PrivateBlobkeyCursor(arena,info,limits),b=new PrivateBlobkeyCursor(arena,info,limits),ka=key(),kb=key();const primary=new Error('second peer read');let calls=0;
 try{await a.indexMoveto(ka,control);await b.indexMoveto(kb,control);const epoch=arena.epoch;
 await assert.rejects(arena.clearTable({async checkpoint(){if(++calls===2)throw primary}}),e=>e===primary);
 assert.equal(calls,2);assert.equal(arena.epoch,epoch);assert.equal(a.position.state,'REQUIRESEEK');assert.equal(b.position.state,'VALID');assert.equal(arena.referenceCount(2),1);
 await a.restoreCursorPosition(control);assert.equal(a.position.state,'VALID');assert.equal(await arena.clearTable(control),1);
 }finally{ka.release();kb.release();a.close();b.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('REPLACE post-publication cleanup error faults peers and last owner refunds all',async()=>{
 const primary=new Error('replace release');let armed=false;
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='release')throw primary},limits);arena.installPage(2,leaf(1));const owner=new PrivateBlobkeyCursor(arena,info,limits,{owning:true});
 armed=true;await assert.rejects(arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),control),e=>e===primary);
 assert.equal(owner.position.state,'FAULT');assert.throws(()=>arena.acquire(2),e=>e===primary);owner.close();assert.equal(budget.usedBytes,0);
});
test('interior REPLACE preserves old left child rather than caller child at exact capacity',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{...limits,maxEntries:1});
 const root=new Uint8Array(4096);root[0]=2;root[4]=1;root[5]=15;root[6]=248;root[11]=4;root[12]=15;root[13]=248;root.set([0,0,0,3,3,2,1,1],4088);arena.installPage(2,root);
 try{await arena.replaceCell(2,0,new Uint8Array([0,0,0,99,3,2,1,2]),control);const l=arena.acquire(2);assert.equal(l.page.leftChild(0),3);assert.equal(l.page.bytes[4095],2);l.release()}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
for(const staged of [false,true])test(`${staged?'staged':'resident'} transfer post-publication release collision faults and releases both leases`,async()=>{
 const first=new Error('source cleanup'),second=new Error('target cleanup');let armed=false;const released=[];
 const cap=staged?682:1,budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&event==='release'){released.push(p);throw p===2?first:second}},{...limits,maxEntries:cap});
 if(staged){const full=new Uint8Array(4096);full[0]=10;full[3]=2;full[4]=169;full[5]=5;full[6]=92;for(let i=0;i<681;i++){const off=1372+4*i;full[8+2*i]=off>>>8;full[9+2*i]=off&255;full.set([3,2,1,1],off)}arena.installPage(2,full)}else arena.installPage(2,leaf(1));
 const empty=new Uint8Array(4096);empty[0]=10;empty[5]=16;arena.installPage(3,empty);if(staged){const l=arena.acquire(2);await l.page.insertCell(681,new Uint8Array([3,2,1,2]),control);l.release()}
 const owner=new PrivateBlobkeyCursor(arena,info,{...limits,maxEntries:cap},{owning:true});armed=true;
 await assert.rejects(staged?arena.transferStagedCell(2,3,0,control):arena.transferCell(2,0,3,0,control),e=>e===first);
 assert.deepEqual(released,[2,3]);assert.equal(arena.referenceCount(2),0);assert.equal(arena.referenceCount(3),0);assert.equal(owner.position.state,'FAULT');assert.throws(()=>arena.acquire(2),e=>e===first);owner.close();assert.equal(budget.usedBytes,0);
});
test('negative SKIPNEXT preserves sign across exact restore and failed save allocation',async()=>{
 let fail=false;const primary=new Error('saved-key allocation');const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(fail&&event==='allocate')throw primary},limits);arena.installPage(2,leaf(1));
 const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),k=key();
 try{await c.indexMoveto(k,control);await c.saveCursorPosition(control);arena.installPage(2,leaf(0));await c.restoreCursorPosition(control);assert.equal(c.position.state,'SKIPNEXT');assert.equal(c.position.skipNext,-1);
 const before=budget.usedBytes;fail=true;let reads=0;await assert.rejects(c.saveCursorPosition({async checkpoint(){reads++}}),e=>e===primary);assert.equal(reads,0);assert.equal(budget.usedBytes,before);assert.equal(c.position.state,'VALID');assert.equal(c.position.skipNext,-1);assert.equal(arena.referenceCount(2),1);
 // Native failed SKIPNEXT save has already changed state to VALID; explicitly saving
 // that state resets skipNext. Instead restore the sign through a fresh neighbor.
 fail=false;await c.saveCursorPosition(control);assert.equal(c.position.skipNext,0);await c.restoreCursorPosition(control);assert.equal(c.position.state,'VALID');
 await c.saveCursorPosition(control);arena.installPage(2,leaf(-1));await c.restoreCursorPosition(control);assert.equal(c.position.skipNext,-1);await c.saveCursorPosition(control);await c.restoreCursorPosition(control);assert.equal(c.position.state,'SKIPNEXT');assert.equal(c.position.skipNext,-1);
 }finally{k.release();c.close()}
 assert.equal(budget.usedBytes,0);
});
test('saved-key budget admission rejects before read and ClearCursor refunds exact padded ownership',async()=>{
 const {budget,arena,c,k}=await opened();let held=0;
 try{await c.indexMoveto(k,control);void c.position;const base=budget.usedBytes;held=budget.maxBytes-base;budget.reserve(held);let reads=0;
 await assert.rejects(c.saveCursorPosition({async checkpoint(){reads++}}),/limit/);assert.equal(reads,0);assert.equal(budget.usedBytes,base+held);assert.equal(arena.referenceCount(2),1);
 budget.release(held);held=0;assert.equal(c.position.state,'VALID');await c.saveCursorPosition(control);const saved=budget.usedBytes;c.clearCursor();assert.equal(saved-budget.usedBytes,84,'3 packed bytes +17 padding +64 descriptor refunded exactly');assert.equal(c.position.state,'INVALID');assert.equal(arena.referenceCount(2),0);
 }finally{if(held)budget.release(held);k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('ClearTable shares final overflow lookup semantics: left child then overflow then right child',async()=>{
 const events=[];let armed=false;const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&event==='acquire'){events.push(p);if(p===5)throw new Error('final overflow must use resident lookup')}},limits);
 const root=new Uint8Array(4096);root[0]=2;root[4]=1;root[5]=13;root[6]=168;root[11]=4;root[12]=13;root[13]=168;root.set([0,0,0,3,0x8f,0x50],3496);root.fill(7,3502,3991);new DataView(root.buffer).setUint32(3991,5);
 arena.installPage(3,leaf(0));arena.installPage(4,leaf(2));const overflow=new Uint8Array(4096);new DataView(overflow.buffer).setUint32(0,99);arena.installPage(5,overflow);arena.installPage(2,root);
 try{armed=true;assert.equal(await arena.clearTable(control),3);assert.equal(events[0],2);assert.equal(events[1],3);assert.ok(events.indexOf(4)>events.indexOf(3));assert.equal(events.includes(5),false);assert.equal(arena.pageCount,5)}finally{arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('physical REPLACE rejects forged writer seek/save-position options before allocation or peers',async()=>{
 let armed=false,calls=0;const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{if(armed)calls++},limits);arena.installPage(2,leaf(1));const c=new PrivateBlobkeyCursor(arena,info,limits),k=key();
 try{await c.indexMoveto(k,control);const before=budget.usedBytes;armed=true;
 for(const options of [{seekEvidence:{epoch:arena.epoch,sign:1}},{seekResult:1},{savePosition:true}])await assert.rejects(arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),{async checkpoint(){throw new Error('unexpected work')}},options),/unsupported.*seek|unsupported.*position/);
 assert.equal(calls,0);assert.equal(budget.usedBytes,before);assert.equal(arena.referenceCount(2),1);armed=false;await arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),control);
 }finally{armed=false;k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('saved restore comparison corruption retains key INVALID without implicit retry and close preserves cleanup ordering',async()=>{
 let armed=false,releases=0;const cleanup=new Error('restore close release');const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='release'){releases++;throw cleanup}},limits);arena.installPage(2,leaf(1));const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),k=key();
 try{await c.indexMoveto(k,control);await c.saveCursorPosition(control);const bad=leaf(1);bad[4093]=9;arena.installPage(2,bad);
 await assert.rejects(c.restoreCursorPosition(control),/record|header|corrupt/i);assert.equal(c.position.state,'INVALID');assert.equal(c.position.overflowValid,false);assert.equal(arena.referenceCount(2),1);
 let checkpoints=0;await c.restoreCursorPosition({async checkpoint(){checkpoints++}});assert.equal(checkpoints,0);assert.equal(c.position.state,'INVALID');const saved=budget.usedBytes;c.clearCursor();assert.equal(saved-budget.usedBytes,84);assert.equal(arena.referenceCount(2),1,'ClearCursor is not path release');armed=true;assert.throws(()=>c.close(),e=>e===cleanup);assert.equal(releases,1);assert.equal(budget.usedBytes,0);
 }finally{armed=false;k.release();c.close()}
});
test('REPLACE synchronous snapshot cancellation precedes peer saves and refunds ownership',async()=>{
 const {budget,arena,c,k}=await opened();const primary=new Error('snapshot cancellation');
 try{await c.indexMoveto(k,control);const before=budget.usedBytes;let calls=0;
 await assert.rejects(arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),{async checkpoint(){throw new Error('unexpected async work')},snapshotCheckpoint(units){calls++;assert.equal(units,0);assert.equal(budget.usedBytes,before+68);assert.throws(()=>arena.acquire(2),/operation/);throw primary}}),e=>e===primary);
 assert.equal(calls,1);assert.equal(budget.usedBytes,before);assert.equal(c.position.state,'VALID');assert.equal(arena.referenceCount(2),1);await arena.replaceCell(2,0,new Uint8Array([3,2,1,2]),control);
 }finally{k.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('clear ancestor cycle rejects before write, unwinds both frames despite release collisions',async()=>{
 let armed=false;const released=[];const cleanup=new Error('cycle cleanup');const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&event==='release'){released.push(p);throw cleanup}},limits);
 const interior=(child)=>{const b=new Uint8Array(4096);b[0]=2;b[4]=1;b[5]=15;b[6]=248;b[11]=4;b[12]=15;b[13]=248;b.set([0,0,0,child,3,2,1,1],4088);return b};arena.installPage(3,interior(2));arena.installPage(4,leaf(2));arena.installPage(2,interior(3));const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true});const before=budget.usedBytes,epoch=arena.epoch;
 try{armed=true;await assert.rejects(arena.clearTable(control),/cycle\/depth/);assert.deepEqual(released,[3,2]);assert.equal(arena.referenceCount(2),0);assert.equal(arena.referenceCount(3),0);assert.equal(budget.usedBytes,before);assert.equal(arena.epoch,epoch);assert.equal(c.position.state,'INVALID');armed=false;arena.installPage(3,leaf(0));assert.equal(await arena.clearTable(control),3)}finally{armed=false;c.close()}
 assert.equal(budget.usedBytes,0);
});
test('clear frame admission charges frame plus lease before acquisition and refunds prewrite budget failure',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);const c=new PrivateBlobkeyCursor(arena,info,limits,{owning:true});const base=budget.usedBytes,held=budget.maxBytes-base-255;budget.reserve(held);const epoch=arena.epoch;
 try{await assert.rejects(arena.clearTable(control),/byte limit/);assert.equal(budget.usedBytes,base+held);assert.equal(arena.referenceCount(2),0);assert.equal(arena.epoch,epoch)}finally{budget.release(held)}
 let observed=false;assert.equal(await arena.clearTable({async checkpoint(units){if(units===4096){assert.equal(budget.usedBytes-base,256,'128 frame +128 lease');observed=true}}}),0);assert.equal(observed,true);c.close();assert.equal(budget.usedBytes,0);
});
test('clear depth cap rejects twenty-first frame and fully unwinds admitted capacity',async()=>{
 const released=[];let armed=false;const large={...limits,maxBytes:200000};const budget=new PrivateStateByteBudget(large.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&event==='release')released.push(p)},large);
 const interior=(child)=>{const b=new Uint8Array(4096);b[0]=2;b[4]=1;b[5]=15;b[6]=248;new DataView(b.buffer).setUint32(8,child);b[12]=15;b[13]=248;b.set([0,0,0,child,3,2,1,1],4088);return b};
 for(let p=3;p<=22;p++)arena.installPage(p,p===22?leaf(0):interior(p+1));arena.installPage(2,interior(3));const c=new PrivateBlobkeyCursor(arena,info,large,{owning:true});const base=budget.usedBytes,epoch=arena.epoch;
 try{armed=true;await assert.rejects(arena.clearTable(control),/cycle\/depth/);assert.deepEqual(released,Array.from({length:20},(_,i)=>21-i));for(let p=2;p<=22;p++)assert.equal(arena.referenceCount(p),0);assert.equal(budget.usedBytes,base);assert.equal(arena.epoch,epoch);assert.equal(c.position.state,'INVALID')}finally{armed=false;c.close()}
 assert.equal(budget.usedBytes,0);
});
test('NEW packed-cell snapshot cancellation refunds entry before asynchronous work',async()=>{
 const small={...limits,maxEntries:1};const budget=new PrivateStateByteBudget(small.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},small);const l=arena.acquire(2);const primary=new Error('NEW snapshot');const before=budget.usedBytes;
 try{await assert.rejects(l.page.insertCell(0,new Uint8Array([3,2,1,1]),{snapshotCheckpoint(){throw primary},async checkpoint(){throw new Error('unexpected async snapshot')}}),e=>e===primary);assert.equal(budget.usedBytes,before);assert.equal(l.page.nCell,0);await l.page.insertCell(0,new Uint8Array([3,2,1,1]),control);await assert.rejects(l.page.insertCell(1,new Uint8Array([3,2,1,2]),control),/entry limit/)}finally{l.release();arena.close()}
 assert.equal(budget.usedBytes,0);
});
test('TRANSFER target snapshot cancellation after source consumption preserves primary and faults at exact capacity',async()=>{
 const tight={...limits,maxEntries:1},primary=new Error('transit snapshot'),cleanup=new Error('transit release');let armed=false;const released=[];const budget=new PrivateStateByteBudget(tight.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,(event,p)=>{if(armed&&event==='release'){released.push(p);throw cleanup}},tight);arena.installPage(2,leaf(1));const empty=new Uint8Array(4096);empty[0]=10;empty[5]=16;arena.installPage(3,empty);const owner=new PrivateBlobkeyCursor(arena,info,tight,{owning:true});let probes=0;armed=true;
 try{await assert.rejects(arena.transferCell(2,0,3,0,{async checkpoint(){},snapshotCheckpoint(units){probes++;assert.equal(units,0);assert.equal(arena.referenceCount(2),1);assert.equal(arena.referenceCount(3),1);assert.throws(()=>arena.acquire(3),/operation/);throw primary}}),e=>e===primary);assert.equal(probes,1);assert.deepEqual(released,[2,3]);assert.equal(arena.referenceCount(2),0);assert.equal(arena.referenceCount(3),0);assert.equal(owner.position.state,'FAULT');assert.throws(()=>arena.acquire(2),e=>e===primary)}finally{armed=false;owner.close()}
 assert.equal(budget.usedBytes,0);
});

test('captured staged teardown rejects suspended arena seek without count or epoch change',async()=>{
 const tight={...limits,maxEntries:682,maxKeyBytes:100},budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},tight);
 const full=new Uint8Array(4096);full[0]=10;full[3]=2;full[4]=169;full[5]=5;full[6]=92;for(let i=0;i<681;i++){const off=1372+4*i;full[8+2*i]=off>>>8;full[9+2*i]=off&255;full.set([3,2,1,1],off)}arena.installPage(2,full);
 const lease=arena.acquire(2);await lease.page.insertCell(681,new Uint8Array([3,2,1,2]),control);const teardown=lease.page.releaseStagedCells,c=new PrivateBlobkeyCursor(arena,info,tight),k=key();let entered,resume;const start=new Promise(r=>entered=r),gate=new Promise(r=>resume=r);let first=true;
 const pending=c.indexMoveto(k,{async checkpoint(){if(first){first=false;entered();await gate}}});await start;const before=lease.page.nOverflow,epoch=arena.epoch;let denied=false,after,epochAfter;
 try{try{teardown()}catch(e){assert.match(e.message,/operation/);denied=true}after=lease.page.nOverflow;epochAfter=arena.epoch}
 finally{resume();await pending;k.release();lease.release();c.close();arena.close()}
 assert.equal(budget.usedBytes,0);assert.equal(before,1);assert.equal(denied,true,'external staged teardown must reject while seek owns arena');assert.equal(after,1);assert.equal(epochAfter,epoch);
});
test('live and captured staging teardown respect hooks, exclusive refs and epoch; disposal needs no admission',async()=>{
 const tight={...limits,maxEntries:682,maxKeyBytes:100},budget=new PrivateStateByteBudget(limits.maxBytes);let captured,armed=false,hits=0;
 const arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&(event==='acquire'||event==='release')){hits++;assert.throws(()=>captured(),/operation|exclusive/)}},tight);
 const full=new Uint8Array(4096);full[0]=10;full[3]=2;full[4]=169;full[5]=5;full[6]=92;for(let i=0;i<681;i++){const off=1372+4*i;full[8+2*i]=off>>>8;full[9+2*i]=off&255;full.set([3,2,1,1],off)}arena.installPage(2,full);
 const lease=arena.acquire(2);await lease.page.insertCell(681,new Uint8Array([3,2,1,2]),control);captured=lease.page.releaseStagedCells;const before=budget.usedBytes,epoch=arena.epoch;
 armed=true;const peer=arena.acquire(2);assert.throws(()=>lease.page.releaseStagedCells(),/exclusive/);assert.throws(captured,/exclusive/);assert.equal(lease.page.nOverflow,1);assert.equal(arena.epoch,epoch);peer.release();armed=false;
 captured();assert.equal(lease.page.nOverflow,0);assert.equal(arena.epoch,epoch+1);assert.equal(budget.usedBytes,before-4-64);await lease.page.insertCell(681,new Uint8Array([3,2,1,2]),control);assert.equal(lease.page.nOverflow,1);lease.release();assert.throws(captured,/released/);assert.equal(hits,2);
 // Disposal's private bridge must work at exhausted capacity and without a lease.
 const hold=budget.maxBytes-budget.usedBytes;budget.reserve(hold);arena.close();budget.release(hold);assert.equal(budget.usedBytes,0);
});
for(const producer of ['raw','allocation result'])test(`${producer} release observer cannot reenter staging ownership`,async()=>{
 const tight={...limits,maxEntries:682,maxKeyBytes:100},budget=new PrivateStateByteBudget(limits.maxBytes);let armed=false,captured,denied=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='release'){try{captured()}catch(e){assert.match(e.message,/operation/);denied=true}}},tight);
 const full=new Uint8Array(4096);full[0]=10;full[3]=2;full[4]=169;full[5]=5;full[6]=92;for(let i=0;i<681;i++){const off=1372+4*i;full[8+2*i]=off>>>8;full[9+2*i]=off&255;full.set([3,2,1,1],off)}arena.installPage(2,full);
 const allocated=producer==='allocation result'?await arena.allocatePage(0,control):null;
 const lease=arena.acquire(2);await lease.page.insertCell(681,new Uint8Array([3,2,1,2]),control);captured=lease.page.releaseStagedCells;
 const result=allocated??arena.acquireRaw(2);const epoch=arena.epoch;let after,epochAfter;
 try{armed=true;result.release();armed=false;after=lease.page.nOverflow;epochAfter=arena.epoch}finally{armed=false;result.release();lease.release();arena.close()}
 assert.equal(budget.usedBytes,0);assert.equal(denied,true,'every observer producer must hold cleanup exclusion');assert.equal(after,1);assert.equal(epochAfter,epoch);
});
for(const producer of ['raw','allocation result'])test(`${producer} observer error preserves refund/revocation and releases cleanup gate`,async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),primary=new Error('unref observer');let armed=false,observed;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,_p,bytes)=>{if(armed&&event==='release'){observed=bytes;assert.throws(()=>arena.acquire(2),/operation/);throw primary}},limits);
 const result=producer==='raw'?arena.acquireRaw(2):await arena.allocatePage(0,control),before=budget.usedBytes;armed=true;
 assert.throws(()=>result.release(),e=>e===primary);armed=false;assert.equal(arena.referenceCount(producer==='raw'?2:result.pgno),0);assert.equal(budget.usedBytes,before-128);assert.throws(()=>result.bytes[0],/released/);assert.throws(()=>observed[0],/released/);result.release();
 const next=arena.acquire(2);next.release();arena.close();assert.equal(budget.usedBytes,0);
});
