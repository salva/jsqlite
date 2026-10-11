import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

// Mutation prerequisites, not full Insert/balance or VM acceptance.
// btree.c owns byte writes through its writable page paths; an inspection alias
// must not bypass the private arena's metadata/count/epoch authority.
const control={snapshotCheckpoint(){},async checkpoint(){}};
for(const kind of ['raw','index']) {
 for(const operation of ['indexed assignment','captured set','captured fill','captured copyWithin','subview assignment']) {
  test(`inspection authority: ${kind} rejects ${operation}`,async()=>{
   const budget=new PrivateStateByteBudget(100000);
   const arena=await PrivateBlobkeyPages.open(budget,control);
   const lease=kind==='raw'?arena.acquireRaw(2):arena.acquire(2);
   try {
    const bytes=kind==='raw'?lease.bytes:lease.page.bytes;
    // Modify an unused byte: no incidental format error can masquerade as
    // write rejection. Captured methods must not retain a write capability.
    let mutate;
    if(operation==='indexed assignment')mutate=()=>{bytes[100]=91};
    if(operation==='captured set'){const set=bytes.set;mutate=()=>set(new Uint8Array([91]),100)}
    if(operation==='captured fill'){const fill=bytes.fill;mutate=()=>fill(91,100,101)}
    if(operation==='captured copyWithin'){const copy=bytes.copyWithin;mutate=()=>copy(100,0,1)}
    if(operation==='subview assignment'){const sub=bytes.subarray(100,101);mutate=()=>{sub[0]=91}}
    const before=bytes[100],charge=budget.usedBytes;
    assert.throws(mutate,undefined,'external inspection must reject mutation');
    assert.equal(bytes[100],before);
    assert.equal(budget.usedBytes,charge,'denial must not leak pending authority');
   } finally {
    lease.release();arena.close();assert.equal(budget.usedBytes,0);
   }
  });
 }
}

test('all inspection producers reject mutation without changing storage or revocation',async()=>{
 const budget=new PrivateStateByteBudget(100000);let observed=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,_pgno,bytes)=>{
  if(event==='release'&&bytes){
   const before=bytes[0];assert.throws(()=>{bytes[0]=99},/readonly/);
   assert.equal(bytes[0],before);observed=true;
  }
 });
 const result=await arena.fillCell(2,new Uint8Array([2,1,7]),control);
 const bytes=result.bytes,before=bytes[0],fill=bytes.fill;
 for(const mutate of [()=>fill(99),()=>bytes.reverse(),()=>bytes.sort(),
  ()=>{delete bytes[0]},()=>Object.defineProperty(bytes,'0',{value:99}),
  ()=>Object.setPrototypeOf(bytes,{}),()=>Object.preventExtensions(bytes),
  ()=>Uint8Array.prototype.fill.call(bytes,99)])assert.throws(mutate);
 assert.equal(bytes[0],before);
 result.release();assert.throws(()=>fill(99),/released/);
 const lease=arena.acquireRaw(2),set=lease.bytes.set;
 lease.release();assert.throws(()=>set(new Uint8Array([99])),/released/);
 assert.equal(observed,true);arena.close();assert.equal(budget.usedBytes,0);
});

test('allocation inspection is readonly on append, trunk and leaf reuse',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control);
 const inspect=async()=>{const result=await arena.allocatePage(0,control);try{assert.throws(()=>{result.bytes[100]=99},/readonly/);assert.throws(()=>result.bytes.fill(99),/readonly/);return result.pgno}finally{result.release()}};
 const a=await inspect(),b=await inspect();
 await arena.freePage(a,control);await arena.freePage(b,control);
 assert.equal(await inspect(),b);assert.equal(await inspect(),a);
 arena.close();assert.equal(budget.usedBytes,0);
});

// Whole page capability, not only its ordinary bytes getter. Independent
// review f status12: reflection must not bypass btreeOverwriteContent/PagerWrite
// ownership or make derived flags contradict the physical page.
for(const operation of ['descriptor bytes','define leaf','delete bytes','prototype','prevent extensions','released descriptor','released enumeration','released prototype','captured descriptor bytes']) {
 test(`outer page authority rejects ${operation}`,async()=>{
  const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control),lease=arena.acquire(2),page=lease.page;
  const baseline=budget.usedBytes,epoch=arena.epoch;
  try{
   if(operation==='descriptor bytes'){
    const bytes=Object.getOwnPropertyDescriptor(page,'bytes').value;
    assert.throws(()=>{bytes[100]=91},/readonly/);
   }else if(operation==='captured descriptor bytes'){
    const bytes=Object.getOwnPropertyDescriptors(page).bytes.value;
    lease.release();assert.throws(()=>{bytes[100]=91},/released/);
   }else if(operation.startsWith('released')){
    lease.release();
    const reflect=operation==='released descriptor'?()=>Object.getOwnPropertyDescriptor(page,'bytes'):operation==='released enumeration'?()=>Reflect.ownKeys(page):()=>Object.getPrototypeOf(page);
    assert.throws(reflect,/released/);
   }else{
    const mutate=operation==='define leaf'?()=>Object.defineProperty(page,'leaf',{value:false}):operation==='delete bytes'?()=>Reflect.deleteProperty(page,'bytes'):operation==='prototype'?()=>Object.setPrototypeOf(page,{}):()=>Object.preventExtensions(page);
    assert.throws(mutate,/readonly/);
    assert.equal(page.leaf,true);assert.equal(page.bytes[0],10);assert.equal(budget.usedBytes,baseline);
   }
   assert.equal(arena.epoch,epoch);
  }finally{lease.release();arena.close();assert.equal(budget.usedBytes,0)}
 });
}
test('whole page reflection cannot export target or prototype and every reflective read revokes',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control),lease=arena.acquire(2),page=lease.page;
 try{
  assert.equal(page.valueOf,undefined);assert.equal(page.__proto__,undefined);assert.equal(page.constructor,undefined);assert.equal(Object.getPrototypeOf(page),null);
  assert.notEqual(Object.prototype.valueOf.call(page),Object.getOwnPropertyDescriptor(page,'bytes').value);
  const captured=page.computeFreeSpace,descriptor=Object.getOwnPropertyDescriptors(page).bytes;
  assert.equal(descriptor.value,page.bytes);assert.equal(descriptor.writable,false);assert.equal(page.leaf,true);
  lease.release();
  for(const inspect of [()=>Object.getOwnPropertyDescriptors(page),()=>Reflect.has(page,'bytes'),()=>Object.isExtensible(page),()=>page.valueOf,()=>captured(),()=>Object.defineProperty(page,'leaf',{value:false}),()=>Reflect.deleteProperty(page,'bytes'),()=>Object.setPrototypeOf(page,{}),()=>Object.preventExtensions(page)])assert.throws(inspect,/released/);
  assert.throws(()=>descriptor.value.fill(91),/released/);
 }finally{lease.release();const raw=arena.acquireRaw(2);assert.equal(raw.bytes[100],0);assert.equal(raw.bytes[0],10);raw.release();arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena identity rekey owns gate and temporary map keys without changing page counts',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control),numbers=[];
 try{
   for(let i=0;i<3;i++){const raw=await arena.allocatePage(0,control);numbers.push(raw.pgno);raw.release()}
   const before=budget.usedBytes;
   const result=await arena.rekeySiblings([numbers[2],numbers[0],numbers[1]],control);
   assert.equal(result,undefined);assert.equal(budget.usedBytes,before);
   for(const n of numbers){const raw=arena.acquireRaw(n);raw.release()}
   assert.throws(()=>arena.acquireRaw(262145));
   const lease=arena.acquireRaw(3);
   try{await assert.rejects(arena.rekeySiblings([5,3],control),/lease/)}finally{lease.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena rekey cancellation between swaps faults after identity publication and cleanup refunds',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control),error=new Error('between swaps');
 try{
   for(let i=0;i<3;i++){const p=await arena.allocatePage(0,control);p.release()}
   const before=budget.usedBytes;let checks=0;
   await assert.rejects(arena.rekeySiblings([5,3,4],{async checkpoint(){if(++checks===2)throw error}}),e=>e===error);
   assert.equal(budget.usedBytes,before);assert.throws(()=>arena.acquireRaw(3),e=>e===error);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena deeper moves exact-capacity entry ownership into allocated child',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:100,maxEntries:682});
 try{
   let p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
   const child=await arena.deepenRoot(control);assert.equal(child,3);
   p=arena.acquire(2);try{assert.equal(p.page.nCell,0);assert.equal(p.page.rightChild(),3)}finally{p.release()}
   p=arena.acquire(3);try{assert.equal(p.page.nCell,681);assert.equal(p.page.nOverflow,1);await assert.rejects(p.page.insertCell(683,Uint8Array.of(3,2,1,2),control),/entry limit/)}finally{p.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('deeper allocation failure wins cleanup release error and closes FAULT without retained leases',async()=>{
 const budget=new PrivateStateByteBudget(100000),error=new Error('deeper allocate'),cleanup=new Error('root release');let armed=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,n)=>{if(armed&&event==='allocate'&&n===3)throw error;if(armed&&event==='release'&&n===2)throw cleanup});
 try{
   const p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
   armed=true;await assert.rejects(arena.deepenRoot(control),e=>e===error);assert.equal(arena.referenceCount(2),0);assert.throws(()=>arena.acquire(2),e=>e===error);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena shallower conserves entries, frees copied child and restores leaf root',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:100,maxEntries:682});
 try{
   let p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
   const child=await arena.deepenRoot(control);p=arena.acquire(child);try{await assert.rejects(arena.shallowRoot(control),/foreign leases/);p.page.releaseStagedCells()}finally{p.release()}
   await arena.shallowRoot(control);
   p=arena.acquire(2);try{assert.equal(p.page.leaf,true);assert.equal(p.page.nCell,681);await p.page.insertCell(681,Uint8Array.of(3,2,1,2),control);await assert.rejects(p.page.insertCell(682,Uint8Array.of(3,2,1,2),control),/entry limit/)}finally{p.release()}
   const reused=await arena.allocatePage(3,control);try{assert.equal(reused.pgno,child)}finally{reused.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('shallower cancellation preserves primary and invalidates arena after balance admission',async()=>{
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control),error=new Error('shallower checkpoint');
 try{
   let p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
   const child=await arena.deepenRoot(control);p=arena.acquire(child);try{p.page.releaseStagedCells()}finally{p.release()}
   await assert.rejects(arena.shallowRoot({async checkpoint(){throw error}}),e=>e===error);assert.equal(arena.referenceCount(2),0);assert.equal(arena.referenceCount(child),0);assert.throws(()=>arena.acquire(2),e=>e===error);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena nonroot balances expanded root child at exact entry capacity',async()=>{
 const budget=new PrivateStateByteBudget(300000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:100,maxEntries:682});
 try{
 let p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
 await arena.deepenRoot(control);await arena.balanceNonroot(2,0,false,control);
 p=arena.acquire(2);let children;try{assert.equal(p.page.nCell,1);children=[p.page.bytes[p.page.findCell(0)+3],p.page.rightChild()]}finally{p.release()}
 let count=1;for(const n of children){p=arena.acquire(n);try{count+=p.page.nCell;assert.equal(p.page.nOverflow,0);await assert.rejects(p.page.insertCell(p.page.nCell,Uint8Array.of(3,2,1,2),control),/entry limit/)}finally{p.release()}}assert.equal(count,682);
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('nonroot allocate failure globally faults and releases all old/parent leases preserving primary',async()=>{
 const budget=new PrivateStateByteBudget(300000),error=new Error('nonroot allocate'),cleanup=new Error('balance release');let armed=false;
 const arena=await PrivateBlobkeyPages.open(budget,control,(event,n)=>{if(armed&&event==='allocate'&&n===4)throw error;if(armed&&event==='release')throw cleanup});
 try{let p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}await arena.deepenRoot(control);armed=true;
 await assert.rejects(arena.balanceNonroot(2,0,false,control),e=>e===error);assert.equal(arena.referenceCount(2),0);assert.equal(arena.referenceCount(3),0);assert.throws(()=>arena.acquire(2),e=>e===error);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
});
test('arena balance dispatcher expands staged root and follows new child upward under one gate',async()=>{
 const budget=new PrivateStateByteBudget(300000),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},{maxKeyBytes:100,maxEntries:682});
 try{let p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
 await arena.balancePath([2],[],false,control);p=arena.acquire(2);try{assert.equal(p.page.leaf,false);assert.equal(p.page.nCell,1);assert.equal(p.page.nOverflow,0)}finally{p.release()}
 }finally{arena.close();assert.equal(budget.usedBytes,0)}
});
test('shallower later defrag copy and free failures preserve primary through both lease cleanup errors',async(t)=>{
 for(const phase of ['defrag','copy','free']){
 const primary=new Error(`shallow ${phase}`),secondary=new Error('shallow cleanup');let armed=false,hit=false,releases=0,probes=0;
 const budget=new PrivateStateByteBudget(100000),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&hit&&event==='release'){releases++;throw secondary}});
 try{
 let p=arena.acquire(2);try{for(let i=0;i<682;i++)await p.page.insertCell(i,Uint8Array.of(3,2,1,1),control)}finally{p.release()}
 const child=await arena.deepenRoot(control);p=arena.acquire(child);try{p.page.releaseStagedCells()}finally{p.release()}
 const ctl={async checkpoint(){const stack=new Error().stack;const owner=phase==='defrag'?'#defrag':phase==='copy'?'copyNodeContent':'#freePage';if(stack.includes(owner)&&++probes===(phase==='defrag'?3:1)){hit=true;throw primary}}};
 armed=true;await assert.rejects(arena.shallowRoot(ctl),e=>e===primary);assert.equal(hit,true);assert.equal(releases,phase==='free'?3:2);assert.equal(arena.referenceCount(2),0);assert.equal(arena.referenceCount(child),0);assert.throws(()=>arena.acquire(2),e=>e===primary);t.diagnostic(`${phase} probes${probes}, paired releases${releases}`);
 }finally{armed=false;arena.close();assert.equal(budget.usedBytes,0)}
 }
});
