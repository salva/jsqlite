import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateStateByteBudget,SorterCursor} from '../../src/internal/private-state.ts';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem,BorrowLifetime} from '../../src/internal/mem.ts';
import {VdbeStatement} from '../../src/internal/vdbe.ts';

test('numeric stringify admits before byte production and refunds producer failure',()=>{
 for(const force of [false,true])for(const cap of [3,4,5]){
  const budget=new PrivateStateByteBudget(cap),mem=new Mem(()=>budget);
  mem.setInt64(1234n);const before=budget.snapshot();let produced=0;
  const original=Uint8Array.from;
  Uint8Array.from=function(...args){assert.equal(budget.snapshot().memBytes,4);const result=Reflect.apply(original,this,args);produced+=result.byteLength;return result};
  try{if(cap<4)assert.throws(()=>mem.stringify('utf-8',force));else mem.stringify('utf-8',force)}finally{Uint8Array.from=original}
  assert.equal(produced,cap<4?0:4);
  if(cap<4){assert.deepEqual(budget.snapshot(),before);assert.equal(mem.initialStorageClass,'integer')}
  else {assert.equal(mem.textValue(),'1234');assert.equal(budget.snapshot().memBytes,4)}
  mem.release();assert.equal(budget.snapshot().ownedBytes,0);
 }
 const budget=new PrivateStateByteBudget(4),mem=new Mem(()=>budget);mem.setInt64(1234n);
 const original=Uint8Array.from,error=new Error('producer failure');
 Uint8Array.from=function(){assert.equal(budget.snapshot().memBytes,4);throw error};
 try{assert.throws(()=>mem.stringify('utf-8'),e=>e===error)}finally{Uint8Array.from=original}
 assert.equal(budget.snapshot().ownedBytes,0);assert.equal(mem.initialStorageClass,'integer');
 mem.stringify('utf-8');assert.equal(mem.textValue(),'1234');mem.release();assert.equal(budget.snapshot().ownedBytes,0);
});

test('endian translation admits borrowed backing before copy and swaps owned backing in place',()=>{
 const original=globalThis.Uint8Array;
 for(const ownership of ['owned','borrowed','static']){
  for(const cap of [3,4,5]){
   const budget=new PrivateStateByteBudget(cap),mem=new Mem(()=>budget);
   const source=new original([65,0,66,0]);
   if(ownership==='owned'&&cap<4){assert.throws(()=>mem.setText(source,'utf-16le'));continue}
   mem.setText(source,'utf-16le',{ownership,...(ownership==='borrowed'?{lifetime:new BorrowLifetime()}: {})});
   const before=budget.snapshot();let allocated=0;
   globalThis.Uint8Array=new Proxy(original,{construct(target,args){const result=Reflect.construct(target,args);allocated+=result.byteLength;return result}});
   try{
    if(cap<4)assert.throws(()=>mem.changeEncoding('utf-16be'));
    else mem.changeEncoding('utf-16be');
   }finally{globalThis.Uint8Array=original}
   assert.equal(allocated,cap<4||ownership==='owned'?0:4);
   if(cap<4){assert.deepEqual(budget.snapshot(),before);assert.equal(mem.textValue(),'AB')}
   else {assert.equal(mem.textValue(),'AB');assert.equal(budget.snapshot().ownedBytes,4);assert.equal(budget.snapshot().highwaterBytes,4);mem.changeEncoding('utf-16le');assert.equal(mem.textValue(),'AB')}
   assert.deepEqual([...source],[65,0,66,0]);
   mem.release();assert.equal(budget.snapshot().ownedBytes,0);
  }
 }
 const budget=new PrivateStateByteBudget(5),mem=new Mem(()=>budget);
 mem.setText(new original([65,0,7]),'utf-16le');mem.changeEncoding('utf-16be');
 assert.deepEqual([...mem.textBytes()],[0,65,7]);mem.release();
});

test('arena lease, raw capabilities and init failure share scratch ownership',async()=>{
 for(const cap of [8703,8704,8705,100000]){
  const budget=new PrivateStateByteBudget(cap),survivor=new PrivateStateByteBudget(100);
  survivor.reserve(19);const independent=survivor.snapshot();
  const arena=await PrivateBlobkeyPages.open(budget,{checkpoint(){}});
  try{
   const baseline=budget.snapshot();assert.equal(baseline.ownedBytes,8576);
   if(cap<8704){assert.throws(()=>arena.acquire(2));assert.deepEqual(budget.snapshot(),baseline);}
   else {
    const lease=arena.acquire(2),live=budget.snapshot();
    try{assert.equal(live.ownedBytes,8704);assert.equal(live.scratchBytes-baseline.scratchBytes,128);assert.equal(live.memBytes,0);assert.equal(live.recordBytes,0);assert.equal(live.packedPages,2);}
    finally{lease.release()}
    assert.equal(budget.snapshot().scratchBytes,baseline.scratchBytes);
    assert.equal(live.scratchBytes,baseline.scratchBytes+128);
    if(cap===100000){
     const raw=arena.acquireRaw(2);
     try{const before=budget.snapshot();const view=raw.bytes.subarray(0,4);assert.equal(view.length,4);assert.ok(budget.snapshot().scratchBytes>before.scratchBytes);assert.equal(budget.snapshot().ownedBytes-before.ownedBytes,budget.snapshot().scratchBytes-before.scratchBytes)}finally{raw.release()}
     assert.equal(budget.snapshot().scratchBytes,baseline.scratchBytes);
    }
   }
   assert.deepEqual(survivor.snapshot(),independent);
  }finally{arena.close();survivor.release(19)}
  const done=budget.snapshot();assert.equal(done.ownedBytes,0);assert.equal(done.scratchBytes,0);assert.equal(done.chargedBytes,done.refundedBytes);
 }
 const budget=new PrivateStateByteBudget(100000),primary=new Error('init');
 const arena=await PrivateBlobkeyPages.open(budget,{checkpoint(){}},event=>{if(event==='init')throw primary});
 try{const before=budget.snapshot();assert.throws(()=>arena.acquire(2),error=>error===primary);assert.equal(budget.snapshot().ownedBytes,before.ownedBytes);assert.equal(budget.snapshot().scratchBytes,before.scratchBytes)}finally{arena.close()}
 assert.equal(budget.snapshot().scratchBytes,0);
});

test('ordinary VM String/Copy bytes share admission and refund on every exit',async()=>{
 const program=(n,maxBytes)=>({encoding:'utf-8',registers:3,parameters:[],columns:[{name:'x'}],maxWorkUnits:1000000,maxResultBytes:100000,privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes},ops:[
  {code:'String',p1:'x'.repeat(n),p2:1},{code:'Copy',p1:1,p2:2},
  {code:'ResultRow',p1:2,p2:1},{code:'Halt'}]});
 const statement=(n,limit)=>new VdbeStatement(program(n,limit),()=>{},()=>()=>{},()=>{});
 for(const n of [0,4096])for(const cap of [64,2*n-1,2*n,2*n+1].filter((x,i,a)=>x>=0&&a.indexOf(x)===i)){
  const s=statement(n,cap);
  try{
   if(cap<2*n){await assert.rejects(s.step(),error=>error.kind==='limit');assert.equal(s.privateAccounting().ownedBytes,0);await assert.rejects(s.step(),error=>error.kind==='limit');}
   else {assert.equal(await s.step(),'row');const live=s.privateAccounting();assert.ok(live.executedOps.includes('Copy'));assert.equal(live.memBytes,2*n);assert.equal(live.ownedBytes,2*n);assert.equal(live.memHighwaterBytes,2*n);assert.equal(await s.step(),'done');assert.equal(s.privateAccounting().memBytes,0);assert.equal(live.memBytes,2*n);}
  }finally{if(cap<2*n)assert.throws(()=>s.finalize());else s.finalize()}
 }
 const survivor=statement(4096,8192),other=statement(4096,64);
 try{assert.equal(await survivor.step(),'row');const live=survivor.privateAccounting();await assert.rejects(other.step());assert.deepEqual(survivor.privateAccounting(),live);assert.equal(await survivor.step(),'done');assert.equal(survivor.privateAccounting().ownedBytes,0)}finally{assert.throws(()=>other.finalize());survivor.finalize()}
 const reset=statement(4096,8192);try{assert.equal(await reset.step(),'row');reset.reset();assert.equal(reset.privateAccounting().ownedBytes,0);assert.equal(await reset.step(),'row')}finally{reset.finalize()}assert.equal(reset.privateAccounting().ownedBytes,0);
});

test('Mem copy, borrow, move and numeric replacement preserve backing ownership',()=>{
 const budget=new PrivateStateByteBudget(100),a=new Mem(()=>budget),b=new Mem(()=>budget),borrow=new Mem(()=>budget);
 try{
  a.setText(new Uint8Array([49,50]),'utf-8');assert.equal(budget.snapshot().memBytes,2);
  borrow.shallowCopyFrom(a);assert.equal(budget.snapshot().memBytes,2);
  borrow.makeWriteable();assert.equal(budget.snapshot().memBytes,4);
  b.moveFrom(a);assert.equal(budget.snapshot().memBytes,4);
  b.applyAffinity('numeric','utf-8');assert.equal(budget.snapshot().memBytes,2);
  borrow.setInt64(1n);assert.equal(budget.snapshot().memBytes,0);
  a.setBlob(new Uint8Array([7]),{zeroTail:3});b.copyFrom(a);assert.equal(budget.snapshot().memBytes,5);
  assert.deepEqual([...b.blobValue()],[7,0,0,0]);
 }finally{a.release();b.release();borrow.release()}
 assert.equal(budget.snapshot().ownedBytes,0);
});

test('MakeRecord replacement and halt preserve distinct record ownership',async()=>{
 const program={encoding:'utf-8',registers:3,parameters:[],columns:[{name:'n'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes:10000},ops:[
  {code:'Integer',p1:7n,p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},
  {code:'ResultRow',p1:1,p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},
  {code:'ResultRow',p1:1,p2:1},{code:'Halt'}]};
 const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 try{
  assert.equal(await statement.step(),'row');const first=statement.privateAccounting();
  assert.ok(first.recordBytes>64);assert.equal(first.recordHighwaterBytes,first.recordBytes);
  assert.equal(await statement.step(),'row');const second=statement.privateAccounting();
  assert.equal(second.recordBytes,first.recordBytes);assert.equal(second.recordHighwaterBytes,2*first.recordBytes);
  assert.equal(await statement.step(),'done');const done=statement.privateAccounting();
  assert.equal(done.recordBytes,0);assert.equal(done.scratchBytes,0);assert.equal(done.ownedBytes,0);
 }finally{statement.finalize()}
});

test('non-payload scratch observes admission, payload overlap and failure refund',async()=>{
 const budget=new PrivateStateByteBudget(100000),control={checkpoint(){}};
 const arena=await PrivateBlobkeyPages.open(budget,control);
 try{
  const before=budget.snapshot();arena.reserveScratch(576);const live=budget.snapshot();
  assert.equal(live.ownedBytes-before.ownedBytes,576);assert.equal(live.scratchBytes-before.scratchBytes,576);
  assert.equal(live.payloadScratchBytes,0);
  arena.reservePayloadScratch(67);
  assert.equal(budget.snapshot().scratchBytes-before.scratchBytes,643);assert.equal(budget.snapshot().payloadScratchBytes,67);
  assert.equal(budget.snapshot().ownedBytes-before.ownedBytes,643);
  arena.releasePayloadScratch(67);arena.releaseScratch(576);
  assert.equal(budget.snapshot().scratchBytes,before.scratchBytes);assert.equal(budget.snapshot().scratchHighwaterBytes,before.scratchBytes+643);
  assert.equal(live.scratchBytes,before.scratchBytes+576,'snapshot is detached');
  const snapshot=budget.snapshot();assert.throws(()=>arena.reserveScratch(100001));
  assert.deepEqual(budget.snapshot(),snapshot);
 }finally{arena.close()}
 assert.equal(budget.snapshot().ownedBytes,0);
});

test('policy demand is the maximum per cursor, not aggregate entries',async()=>{
 const budget=new PrivateStateByteBudget(10000);
 const info={keyFieldCount:1,totalFieldCount:1,terms:[{collation:'BINARY',desc:false,nullsLarge:false}]};
 const limits={maxBytes:10000,maxEntries:5,maxKeyBytes:100};
 const a=new SorterCursor(info,limits,budget),b=new SorterCursor(info,limits,budget);
 const value=new Mem();value.setInt64(1n);const control={checkpoint(){}};
 try{
  await a.insert([value],[],control);await a.insert([value],[],control);
  await b.insert([value],[],control);
  assert.equal(budget.snapshot().highwaterEntries,2);assert.equal(budget.snapshot().highwaterKeyBytes,8);
  a.close();assert.equal(budget.snapshot().highwaterEntries,2);assert.equal(budget.snapshot().ownedBytes,8);
 }finally{a.close();b.close();value.release();}
 assert.equal(budget.snapshot().ownedBytes,0);
});

test('physical page observations include partial opens and independent live arenas',async()=>{
 const budget=new PrivateStateByteBudget(100000),control={checkpoint(){}};
 const survivor=await PrivateBlobkeyPages.open(budget,control);
 try{
  assert.equal(budget.snapshot().packedPages,2);
  const fault=new Error('second page');
  await assert.rejects(PrivateBlobkeyPages.open(budget,control,(event,pgno)=>{if(event==='allocate'&&pgno===2)throw fault}),error=>error===fault);
  assert.equal(budget.snapshot().packedPages,2);assert.equal(budget.snapshot().packedPagesHighwater,3);
  const other=await PrivateBlobkeyPages.open(budget,control);
  assert.equal(budget.snapshot().packedPages,4);other.close();assert.equal(budget.snapshot().packedPages,2);
  survivor.installPage(3,new Uint8Array(4096));assert.equal(budget.snapshot().packedPages,3);
  survivor.installPage(3,new Uint8Array(4096));assert.equal(budget.snapshot().packedPages,3);
 }finally{survivor.close();}
 assert.equal(budget.snapshot().packedPages,0);assert.equal(budget.snapshot().packedPagesHighwater,4);
 assert.equal(budget.snapshot().ownedBytes,0);
});

test('actual payload scratch remains charged across await and refunds callback failure',async()=>{
 const budget=new PrivateStateByteBudget(100000),survivor=new PrivateStateByteBudget(100000),control={checkpoint(){}};
 survivor.reserve(19);const independent=survivor.snapshot();
 const limits={maxBytes:100000,maxEntries:100,maxKeyBytes:1000};
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const info=new KeyInfo({encoding:'utf-8',keyFieldCount:1,totalFieldCount:1,terms:[{}]});
 const cursor=new PrivateBlobkeyCursor(arena,info,limits);
 try{
  await cursor.insertIndex(new Uint8Array([2,1,7]),{},control);
  assert.equal(await cursor.first(control),true);
  const before=budget.snapshot(),primary=new Error('payload consumer');let entered,release;
  const ready=new Promise(resolve=>{entered=resolve}),gate=new Promise(resolve=>{release=resolve});
  const pending=cursor.withPayload(control,async bytes=>{assert.deepEqual([...bytes],[2,1,7]);entered();await gate;throw primary});
  await ready;const live=budget.snapshot();
  assert.equal(live.payloadScratchBytes,67);assert.ok(live.payloadScratchHighwaterBytes>=67);
  assert.ok(live.scratchBytes>=67);assert.ok(live.scratchHighwaterBytes>=live.scratchBytes);
  assert.ok(live.ownedBytes>=before.ownedBytes+67);assert.deepEqual(survivor.snapshot(),independent);
  release();await assert.rejects(pending,error=>error===primary);
  assert.equal(budget.snapshot().payloadScratchBytes,0);
  assert.equal(live.payloadScratchBytes,67,'retained snapshot is detached');
 }finally{cursor.close();arena.close();survivor.release(19)}
 assert.equal(budget.snapshot().ownedBytes,0);assert.equal(budget.snapshot().payloadScratchBytes,0);
});
