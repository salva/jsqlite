import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor,PrivateIndexPage} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo,UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const control={async checkpoint(){},snapshotCheckpoint(){}};
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
const limits={maxEntries:10,maxKeyBytes:100,maxBytes:100000};
async function fixture(consume){
 const budget=new PrivateStateByteBudget(limits.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const writer=new PrivateBlobkeyCursor(arena,info,limits),peer=new PrivateBlobkeyCursor(arena,info,limits);
 const facade=new PrivateKeyVmCursor(arena,peer,info);
 try{await consume({writer,peer,facade,arena,budget})}
 finally{peer.close();writer.close();arena.close();assert.equal(budget.usedBytes,0)}
}
async function seek(facade,n){
 const value=new Mem();value.setInt64(BigInt(n));const key=new UnpackedRecordKey([value],0,'seek',info);
 try{return await facade.seek(key,control)}finally{key.release();value.release()}
}
// Source-derived CursorRestore/HandleMovedCursor assertions, not native captures.
for(const fail of [false,true])test(`Delete resets VM seekResult on ${fail?'error':'success'}`,async()=>fixture(async({writer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);
 await seek(facade,1);
 facade.seekResult=-1;facade.cacheStale=false;
 const primary=new Error('Delete prewrite');
 if(fail)await assert.rejects(facade.deleteCurrent({savePosition:false},{async checkpoint(){throw primary}}),e=>e===primary);
 else await facade.deleteCurrent({savePosition:false},control);
 assert.equal(facade.cacheStale,true);
 assert.equal(facade.seekResult,0);
}));
test('moved peer Column restores existing packed row',async()=>fixture(async({writer,peer,facade})=>{
 assert.equal(await facade.last(control),false);
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);assert.equal(await seek(facade,1),true);
 const out=new Mem();try{
  await facade.column(0,out,control);assert.equal(out.integerValue(),1n);
  await writer.insertIndex(Uint8Array.of(2,1,2),{},control);assert.equal(peer.position.state,'REQUIRESEEK');
  facade.cacheStale=false;await facade.column(0,out,control);assert.equal(out.integerValue(),1n);assert.equal(facade.cacheStale,true);
 }finally{out.release()}
}));
test('moved peer Column publishes NULL after clear',async()=>fixture(async({writer,facade,arena})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);assert.equal(await seek(facade,1),true);await arena.clearTable(control);
 const out=new Mem();try{await facade.column(0,out,control);assert.equal(out.diagnostic().manifest,'null');assert.equal(facade.nullRow,true)}finally{out.release()}
}));
test('moved peer Column keeps restore and payload under one admission',async()=>fixture(async({writer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);await seek(facade,1);
 await writer.insertIndex(Uint8Array.of(2,1,2),{},control);
 await facade.withColumn(0,control,async value=>{
  assert.equal(value.integerValue(),1n);
  await assert.rejects(writer.insertIndex(Uint8Array.of(2,1,3),{},control),/operation in progress/);
  assert.equal(value.integerValue(),1n);
 });
 assert.equal(await seek(facade,1),true);
}));
test('failed moved peer restore invalidates cache and retains primary error',async()=>fixture(async({writer,peer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);await seek(facade,1);
 await writer.insertIndex(Uint8Array.of(2,1,2),{},control);
 facade.cacheStale=false;
 const primary=new Error('restore interrupted');
 await assert.rejects(facade.withColumn(0,{checkpoint(){throw primary}},()=>assert.fail('must not publish')),e=>e===primary);
 assert.equal(facade.cacheStale,true);assert.equal(facade.nullRow,true);assert.equal(peer.position.state,'INVALID');
 // Native failed restore does not silently retry retained saved bytes.
 await facade.withColumn(0,control,value=>assert.equal(value.diagnostic().manifest,'null'));
 assert.equal(await seek(facade,1),true);
}));
for(const direction of ['next','previous'])test(`held ${direction} restores without public reentry`,async()=>fixture(async({writer,peer,facade})=>{
 for(const n of [1,2,3])await writer.insertIndex(Uint8Array.of(2,1,n),{},control);
 assert.equal(await seek(facade,2),true);
 await peer.saveCursorPosition(control);
 // Structural source fixture: native Next/Previous call the held restore
 // helper, never the separately admitted public restore entrypoint.
 peer.restoreCursorPosition=()=>{throw new Error('public restore reentry')};
 assert.equal(await peer[direction](control),true);
 await peer.withPayload(control,bytes=>assert.equal(bytes[2],direction==='next'?3:1));
}));
for(const direction of ['next','previous'])test(`held ${direction} restore failure retains INVALID saved owner`,async()=>fixture(async({writer,peer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);await seek(facade,1);await peer.saveCursorPosition(control);
 const before=peer.position;const failure=new Error('movement restore interrupted');
 await assert.rejects(peer[direction]({checkpoint(){throw failure}}),e=>e===failure);
 assert.equal(peer.position.state,'INVALID');
 assert.equal(await peer[direction](control),false);
 assert.equal(before.state,'REQUIRESEEK');
 assert.equal(await seek(facade,1),true);
}));
for(const direction of ['next','previous'])test(`missing saved row Column hides neighbor before ${direction}`,async()=>fixture(async({writer,peer,facade,arena})=>{
 for(const n of [1,2,3])await writer.insertIndex(Uint8Array.of(2,1,n),{},control);
 assert.equal(await seek(facade,2),true);await peer.saveCursorPosition(control);writer.close();
 // Source-derived removed-row fixture, not a Delete implementation/native receipt.
 const page=new Uint8Array(4096),view=new DataView(page.buffer);
 page[0]=10;view.setUint16(3,2);view.setUint16(5,4088);
 view.setUint16(8,4092);view.setUint16(10,4088);
 page.set([3,2,1,1],4092);page.set([3,2,1,3],4088);arena.installPage(2,page);
 await facade.withColumn(0,control,value=>assert.equal(value.diagnostic().manifest,'null'));
 assert.equal(facade.nullRow,true);assert.equal(peer.position.state,'SKIPNEXT');
 assert.equal(await facade[direction](control),true);
 await facade.withColumn(0,control,value=>assert.equal(value.integerValue(),direction==='next'?3n:1n));
 assert.equal(await facade[direction](control),false,'skip consumed exactly once');
}));
test('OpenDup shares packed arena but owns independent position and cache',async()=>fixture(async({arena,writer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);
 await facade.first(control);
 const duplicate=facade.duplicate();
 try{
 assert.equal(duplicate.arena,arena);assert.notEqual(duplicate.cursor,facade.cursor);
 assert.equal(duplicate.nullRow,true);assert.equal(duplicate.cacheStale,true);
 const out=new Mem();try{await duplicate.column(0,out,control);assert.equal(out.initialStorageClass,'null')}finally{out.release()}
 assert.equal(await duplicate.first(control),true);
 await facade.next(control);assert.equal(facade.nullRow,true);assert.equal(duplicate.nullRow,false);
 duplicate.cacheStale=false;await writer.insertIndex(Uint8Array.of(2,1,2),{},control);
 assert.equal(duplicate.cursor.position.state,'REQUIRESEEK');
 const value=new Mem();try{await duplicate.column(0,value,control);assert.equal(value.integerValue(),1n)}finally{value.release()}
 assert.equal(duplicate.cacheStale,true);
 }finally{duplicate.close()}
}));
test('OpenDup admits cursor128 at H-1/H/H+1 and failed admission preserves original',async()=>fixture(async({budget,writer,facade})=>{
 for(const room of [127,128,129]){
 const retained=budget.usedBytes,filler=limits.maxBytes-retained-room;budget.reserveScratch(filler);
 try{
 if(room===127)assert.throws(()=>facade.duplicate(),/byte limit/);
 else{const duplicate=facade.duplicate();assert.equal(budget.usedBytes,retained+filler+128);duplicate.close()}
 assert.equal(budget.usedBytes,retained+filler);
 }finally{budget.releaseScratch(filler)}
 }
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);assert.equal(await facade.first(control),true);
}));
test('OpenDup last handle disposes owning arena and close is independently idempotent',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);
 const cursor=new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),original=new PrivateKeyVmCursor(arena,cursor,info);
 const duplicate=original.duplicate();
 try{
 await original.insert(Uint8Array.of(2,1,1),control);original.close();original.close();
 assert.ok(budget.usedBytes>0);assert.equal(await duplicate.first(control),true);
 assert.throws(()=>original.duplicate(),/closed/);
 }finally{original.close();duplicate.close()}
 assert.equal(budget.usedBytes,0);duplicate.close();
});
test('OpenDup rejects during callback admission and preserves borrowed payload',async()=>fixture(async({writer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);await facade.first(control);
 await facade.withColumn(0,control,value=>{assert.throws(()=>facade.duplicate(),/operation in progress/);assert.equal(value.integerValue(),1n)});
}));
test('OpenDup preserves shared terminal FAULT identity and last close refunds arena',async()=>{
 const primary=new Error('partial clear release failure');let armed=false;
 const budget=new PrivateStateByteBudget(limits.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(armed&&event==='release')throw primary},limits);
 const original=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits,{owning:true}),info),duplicate=original.duplicate();
 try{
 await original.insert(Uint8Array.of(2,1,1),control);
 await original.cursor.saveCursorPosition(control);
 armed=true;await assert.rejects(arena.clearTable(control),e=>e===primary);armed=false;
 assert.equal(original.cursor.position.state,'FAULT');assert.equal(duplicate.cursor.position.state,'FAULT');
 await assert.rejects(duplicate.first(control),e=>e===primary);
 assert.throws(()=>duplicate.duplicate(),e=>e===primary);
 original.close();assert.ok(budget.usedBytes>0);
 }finally{original.close();duplicate.close()}
 assert.equal(budget.usedBytes,0);
});
for(const rejectAt of [1,2,3])test(`Delete overflow checkpoint ${rejectAt} distinguishes prewrite from partial mutation`,async()=>{
 const lim={maxEntries:10,maxKeyBytes:10000,maxBytes:200000},budget=new PrivateStateByteBudget(lim.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},lim),cursor=new PrivateBlobkeyCursor(arena,info,lim,{owning:true});
 try{
 // Independently packed BLOB serial type 10012: two-byte varint, 5000 bytes.
 const packed=new Uint8Array(5003);packed.set([3,0xce,0x1c]);packed.fill(7,3);
 await cursor.insertIndex(packed,{},control);await cursor.first(control);
 const error=new Error('overflow checkpoint');let checkpoints=0;
 await assert.rejects(cursor.deleteCurrent({savePosition:false},{async checkpoint(){if(++checkpoints===rejectAt)throw error}}),e=>e===error);
 if(rejectAt<=2){
 assert.equal(await cursor.first(control),true);
 await cursor.withPayload(control,b=>assert.equal(b.length,5003));
 await cursor.deleteCurrent({savePosition:false},control);
 assert.equal(await cursor.first(control),false);
 }else{
 assert.equal(cursor.position.state,'FAULT');
 await assert.rejects(cursor.first(control),e=>e===error);
 }
 }finally{cursor.close()}
 assert.equal(budget.usedBytes,0);
});
test('Delete preservation1 prewrite failure retries without stranded saved key',async()=>fixture(async({writer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,1),{},control);
 await seek(new PrivateKeyVmCursor(facade.arena,writer,info),1);
 const error=new Error('after key save');let checkpoints=0;
 await assert.rejects(writer.deleteCurrent({savePosition:true},{async checkpoint(){if(++checkpoints===2)throw error}}),e=>e===error);
 await writer.deleteCurrent({savePosition:true},control);
 assert.equal(await writer.first(control),false);
}));
test('Delete dense leaf preservation2 signs consumed exactly once',async()=>{
 for(const [at,direction,expected] of [[0,'next',1],[250,'previous',249],[499,'previous',498]]){
 const lim={maxEntries:500,maxKeyBytes:100,maxBytes:1000000},budget=new PrivateStateByteBudget(lim.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},lim),cursor=new PrivateBlobkeyCursor(arena,info,lim,{owning:true});
 try{
 for(let n=0;n<500;n++)await cursor.insertIndex(Uint8Array.of(2,2,n>>>8,n&255),{},control);
 await seek(new PrivateKeyVmCursor(arena,cursor,info),at);
 await cursor.deleteCurrent({savePosition:true},control);
 assert.equal(cursor.position.state,'SKIPNEXT');
 assert.equal(await cursor[direction](control),true);
 await cursor.withPayload(control,b=>assert.equal((b[2]<<8)|b[3],expected));
 assert.equal(await cursor[direction](control),true);
 await cursor.withPayload(control,b=>assert.equal((b[2]<<8)|b[3],expected+(direction==='next'?1:-1)));
 }finally{cursor.close()}
 assert.equal(budget.usedBytes,0);
 }
});
test('Last AtLast bypasses descent only while position stays valid',async()=>fixture(async({writer})=>{
 for(const n of [1,2,3])await writer.insertIndex(Uint8Array.of(2,1,n),{},control);
 assert.equal(await writer.last(control),true);
 const denied={async checkpoint(){throw new Error('descent checkpoint')}};
 assert.equal(await writer.last(denied),true);
 await writer.previous(control);
 await assert.rejects(writer.last(denied),/descent checkpoint/);
 assert.equal(await writer.last(control),true);
 await writer.deleteCurrent({savePosition:true},control);
 await assert.rejects(writer.last(denied),/descent checkpoint/);
}));
test('Delete prewrite control rejection leaves arena usable and original row intact',async()=>fixture(async({writer,facade})=>{
 for(const n of [1,2,3])await writer.insertIndex(Uint8Array.of(2,1,n),{},control);
 await seek(new PrivateKeyVmCursor(facade.arena,writer,info),2);
 const error=new Error('drop checkpoint');
 await assert.rejects(writer.deleteCurrent({savePosition:false},{async checkpoint(){throw error}}),e=>e===error);
 assert.equal(await writer.first(control),true);
 await writer.withPayload(control,b=>assert.equal(b[2],1));
}));
test('Delete padded minimum predecessor transfers into interior',async()=>{
 const lim={maxEntries:800,maxKeyBytes:100,maxBytes:3000000},budget=new PrivateStateByteBudget(lim.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},lim),cursor=new PrivateBlobkeyCursor(arena,info,lim,{owning:true});
 const pack=n=>n<128?Uint8Array.of(2,1,n):Uint8Array.of(2,2,n>>>8,n&255);
 try{
 for(let n=0;n<800;n++)await cursor.insertIndex(pack(n),{},control);
 for(let n=0;n<800;n++){
   const root=arena.acquire(arena.root);let target;
   try{const c=root.page.parseCell(0),b=root.page.bytes;target=c.nPayload===3?b[c.payloadOffset+2]:(b[c.payloadOffset+2]<<8)|b[c.payloadOffset+3]}finally{root.release()}
   await seek(new PrivateKeyVmCursor(arena,cursor,info),target);
   await cursor.deleteCurrent({savePosition:true},control);
 }
 assert.equal(await cursor.first(control),false);
 }finally{cursor.close()}
 assert.equal(budget.usedBytes,0);
});
test('Delete repeated tiny integer records collapses interior tree and refunds',async()=>{
 const lim={maxEntries:800,maxKeyBytes:100,maxBytes:3000000},budget=new PrivateStateByteBudget(lim.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},lim),cursor=new PrivateBlobkeyCursor(arena,info,lim,{owning:true});
 const pack=n=>n<128?Uint8Array.of(2,1,n):Uint8Array.of(2,2,n>>>8,n&255);
 try{
 for(let n=0;n<800;n++)await cursor.insertIndex(pack(n),{},control);
 for(let n=0;n<800;n++){
   await cursor.last(control);
   await cursor.deleteCurrent({savePosition:true},control);
 }
 assert.equal(await cursor.first(control),false);
 }finally{cursor.close()}
 assert.equal(budget.usedBytes,0);
});
test('Delete preservation1 saves deleted key and peer Column hides restore neighbor',async()=>fixture(async({writer,facade})=>{
 for(const n of [1,2,3])await writer.insertIndex(Uint8Array.of(2,1,n),{},control);
 await seek(facade,2);
 const w=new PrivateKeyVmCursor(facade.arena,writer,info);await seek(w,2);
 await writer.deleteCurrent({savePosition:true},control);
 assert.equal(writer.position.state,'REQUIRESEEK');
 const out=new Mem();try{await facade.column(0,out,control);assert.equal(out.initialStorageClass,'null')}finally{out.release()}
 assert.equal(await writer.next(control),true);
 await writer.withPayload(control,bytes=>assert.equal(bytes[2],3));
 assert.equal(await writer.previous(control),true);
 await writer.withPayload(control,bytes=>assert.equal(bytes[2],1));
}));
test('Delete interior predecessor and balance preserve sorted survivors at full capacity',async()=>{
 const lim={maxEntries:600,maxKeyBytes:100,maxBytes:2000000},budget=new PrivateStateByteBudget(lim.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},lim),cursor=new PrivateBlobkeyCursor(arena,info,lim,{owning:true});
 const packed=n=>Uint8Array.of(2,2,n>>>8,n&255);
 try{
 for(let n=0;n<600;n++)await cursor.insertIndex(packed(n),{},control);
 let interior;await cursor.first(control);do{if(cursor.position.parents.length===0){interior=await cursor.withPayload(control,b=>(b[2]<<8)|b[3]);break}}while(await cursor.next(control));
 assert.notEqual(interior,undefined);
 await cursor.deleteCurrent({savePosition:true},control);assert.equal(cursor.position.state,'REQUIRESEEK');
 const survivors=[];if(await cursor.first(control))do{survivors.push(await cursor.withPayload(control,b=>(b[2]<<8)|b[3]))}while(await cursor.next(control));
 assert.deepEqual(survivors,Array.from({length:600},(_,i)=>i).filter(i=>i!==interior));
 await cursor.insertIndex(packed(700),{},control);
 }finally{cursor.close()}
 assert.equal(budget.usedBytes,0);
});
for(const room of [null,3544,3545,3546])test(`Delete multilevel overflow interior transfers predecessor and preserves all payloads room=${room??'unbounded'}`,async()=>{
 const lim={maxEntries:180,maxKeyBytes:2000,maxBytes:5000000},budget=new PrivateStateByteBudget(lim.maxBytes);
 const wideInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},lim),cursor=new PrivateBlobkeyCursor(arena,wideInfo,lim,{owning:true});
 const packed=n=>{const b=new Uint8Array(1506);b.set([4,2,0x97,0x44,n>>>8,n&255]);b.fill(n,6);return b};
 try{
 for(let n=0;n<180;n++)await cursor.insertIndex(packed(n),{},control);
 const root=arena.acquire(arena.root);let target;
 try{assert.equal(root.page.leaf,false);const c=root.page.parseCell(0);target=(root.page.bytes[c.payloadOffset+4]<<8)|root.page.bytes[c.payloadOffset+5]}finally{root.release()}
 await cursor.first(control);assert.ok(cursor.position.parents.length>=2,'fixture must reach a multilevel predecessor');
 const vm=new PrivateKeyVmCursor(arena,cursor,wideInfo),v=new Mem();v.setInt64(BigInt(target));
 try{assert.equal(await vm.seekBound([v],'SeekGE',control),true)}finally{v.release()}
 assert.equal(cursor.position.parents.length,0,'fixture must delete root divider');
 const observations=[],compute=PrivateIndexPage.prototype.computeFreeSpace;
 const charges=[],reserve=budget.reserve.bind(budget),release=budget.release.bind(budget),base=budget.usedBytes;
 budget.reserve=(n,...args)=>{reserve(n,...args);charges.push(['+',n,budget.usedBytes-base])};
 budget.release=n=>{release(n);charges.push(['-',n,budget.usedBytes-base])};
 PrivateIndexPage.prototype.computeFreeSpace=function(){const free=compute.call(this);observations.push({pgno:this.pgno,leaf:this.leaf,pending:this.nOverflow,free});return free};
 const filler=room===null?0:lim.maxBytes-base-room;budget.reserveScratch(filler);
 let failure;
 try{await cursor.deleteCurrent({savePosition:true},control)}catch(e){failure=e}finally{PrivateIndexPage.prototype.computeFreeSpace=compute;budget.reserve=reserve;budget.release=release;budget.releaseScratch(filler)}
 if(room===3544){assert.match(String(failure),/byte limit/);await assert.rejects(cursor.first(control),e=>e===failure);cursor.close();assert.equal(budget.usedBytes,0);return}
 assert.equal(failure,undefined);
 const leafStop=observations.findLastIndex(o=>o.leaf);
 assert.ok(leafStop>=0);assert.ok(observations[leafStop].free*3<=8192,'predecessor leaf is nonunderfull after drop');
 assert.equal(observations.at(-1).pgno,arena.root,'second pass observes original root after leaf stop');
 assert.equal(Math.max(...charges.filter(c=>c[0]==='+').map(c=>c[2]-filler)),3545,'exact Delete simultaneous peak above positioned baseline');
 assert.equal(cursor.position.state,'REQUIRESEEK');
 const actual=[];if(await cursor.first(control))do{await cursor.withPayload(control,b=>{const n=(b[4]<<8)|b[5];assert.deepEqual(b,packed(n));actual.push(n)})}while(await cursor.next(control));
 assert.deepEqual(actual,Array.from({length:180},(_,n)=>n).filter(n=>n!==target));
 }finally{cursor.close()}
 assert.equal(budget.usedBytes,0);
});
test('Delete INVALID rejects before mutation and leaves writer independently usable',async()=>fixture(async({writer,peer})=>{
 assert.equal(peer.position.state,'INVALID');
 await assert.rejects(peer.deleteCurrent({savePosition:true},control),/unpositioned cursor/);
 await writer.insertIndex(Uint8Array.of(2,1,7),{},control);
 assert.equal(await writer.first(control),true);
 await writer.withPayload(control,b=>assert.deepEqual(b,Uint8Array.of(2,1,7)));
}));
for(const fail of [false,true])test(`Delete held restore excludes reentry and preserves error ownership fail=${fail}`,async()=>fixture(async({writer,peer,facade,arena})=>{
 await writer.insertIndex(Uint8Array.of(2,1,2),{},control);await seek(facade,2);
 await writer.insertIndex(Uint8Array.of(2,1,3),{},control);
 const primary=new Error('Delete restore interrupted');let checkpoints=0;
 const held={async checkpoint(){
  checkpoints++;
  assert.throws(()=>peer.close(),/operation in progress/);
  await assert.rejects(writer.first(control),/operation in progress/);
  if(fail)throw primary;
 }};
 if(fail){
  await assert.rejects(peer.deleteCurrent({savePosition:false},held),e=>e===primary);
  assert.equal(peer.position.state,'INVALID');
  // Failed restore does not retry the saved key on another Delete.
  await assert.rejects(peer.deleteCurrent({savePosition:false},control),/unpositioned cursor/);
  assert.equal(await writer.first(control),true);
  assert.equal(await writer.withPayload(control,b=>b[2]),2);
 }else await peer.deleteCurrent({savePosition:false},held);
 assert.ok(checkpoints>0);
}));
test('Delete REQUIRESEEK restores surviving saved key before deleting it',async()=>fixture(async({writer,peer,facade})=>{
 await writer.insertIndex(Uint8Array.of(2,1,2),{},control);await seek(facade,2);
 await writer.insertIndex(Uint8Array.of(2,1,3),{},control);
 assert.equal(peer.position.state,'REQUIRESEEK');
 await peer.deleteCurrent({savePosition:false},control);
 const actual=[];if(await writer.first(control))do{actual.push(await writer.withPayload(control,b=>b[2]))}while(await writer.next(control));
 assert.deepEqual(actual,[3]);
}));
for(const survivors of [[],[1,3]])test(`Delete restored missing key never deletes nearby candidate survivors=${survivors.length}`,async()=>fixture(async({writer,peer,facade})=>{
 for(const n of [...survivors,2])await writer.insertIndex(Uint8Array.of(2,1,n),{},control);
 await seek(facade,2);
 const writerVm=new PrivateKeyVmCursor(facade.arena,writer,info);await seek(writerVm,2);
 await writer.deleteCurrent({savePosition:false},control);
 assert.equal(peer.position.state,'REQUIRESEEK');
 await peer.deleteCurrent({savePosition:true},control);
 assert.equal(peer.position.state,survivors.length?'SKIPNEXT':'INVALID');
 if(survivors.length)await assert.rejects(peer.deleteCurrent({savePosition:false},control),/unpositioned cursor/);
 const actual=[];if(await writer.first(control))do{actual.push(await writer.withPayload(control,b=>b[2]))}while(await writer.next(control));
 assert.deepEqual(actual,survivors);
}));
// Source-derived h9 staged-parent counterexample; not a native capture.
for(const room of [null,7491,7492,7493,'interrupt'])test(`Delete staged larger predecessor retains logical child ancestry room=${room??'unbounded'}`,async()=>{
 const cap={maxEntries:681,maxKeyBytes:2000,maxBytes:10000000};
 const primary=new Error('cancel after consumed staged divider'),secondary=new Error('secondary lease release');
 let interrupted=false,releases=0,postFaultAcquires=0;
 const budget=new PrivateStateByteBudget(cap.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,event=>{if(interrupted&&event==='acquire')postFaultAcquires++;if(interrupted&&event==='release'){releases++;throw secondary}},cap);
 const ki=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const cursor=new PrivateBlobkeyCursor(arena,ki,cap),faultPeer=cursor.duplicate();
 const small=n=>Uint8Array.of(3,2,12,n>>>8,n&255);
 const wide=Uint8Array.from([4,2,0x8e,0x1c,0,1,...new Array(900).fill(0)]);
 const cell=(record,child)=>{
  const prefix=record.length<128?[record.length]:[(record.length>>>7)|128,record.length&127];
  return Uint8Array.from([...(child===undefined?[]:[child>>>24,child>>>16&255,child>>>8&255,child&255]),...prefix,...record]);
 };
 const raw=(leaf,cells,right=0)=>{
  const b=new Uint8Array(4096);b[0]=leaf?10:2;b[3]=cells.length>>>8;b[4]=cells.length&255;
  if(!leaf){b[8]=right>>>24;b[9]=right>>>16&255;b[10]=right>>>8&255;b[11]=right&255}
  let top=4096;for(let i=0;i<cells.length;i++){top-=cells[i].length;b.set(cells[i],top);const slot=(leaf?8:12)+i*2;b[slot]=top>>>8;b[slot+1]=top&255}
  b[5]=top>>>8;b[6]=top&255;return b;
 };
 try{
  arena.installPage(2,raw(false,Array.from({length:340},(_,i)=>cell(small(2*i+2),i+3)),343));
  for(let i=0;i<341;i++)arena.installPage(i+3,raw(true,[cell(i===0?wide:small(2*i+1))]));
  assert.equal(await cursor.first(control),true);assert.equal(await cursor.next(control),true);
  await cursor.withPayload(control,b=>assert.deepEqual(b,small(2)));
  const base=budget.usedBytes,charges=[];
  const reserve=budget.reserve.bind(budget),release=budget.release.bind(budget);
  const filler=typeof room!=='number'?0:cap.maxBytes-base-room;
  budget.reserveScratch(filler);
  budget.reserve=(n,...args)=>{reserve(n,...args);charges.push(['+',n,budget.usedBytes-base-filler])};
  budget.release=n=>{release(n);charges.push(['-',n,budget.usedBytes-base-filler])};
  // gather is admitted only after acquireBlobkeySiblings has taken the
  // staged parent divider. Reject its first real work checkpoint.
  let gatherAdmitted=false;
  const tracedReserve=budget.reserve;
  budget.reserve=(n,...args)=>{tracedReserve(n,...args);if(n===1434)gatherAdmitted=true};
  const cancel={async checkpoint(){
   if(room==='interrupt'&&gatherAdmitted){assert.equal(interrupted,false,'no checkpoint during unwind');interrupted=true;throw primary}
  }};
  let failure;
  try{await cursor.deleteCurrent({savePosition:false},cancel)}catch(e){failure=e}
  finally{budget.reserve=reserve;budget.release=release;budget.releaseScratch(filler)}
  if(room==='interrupt'){
   assert.equal(interrupted,true);assert.equal(failure,primary);assert.ok(releases>=3,'all sibling and parent leases retired despite secondary errors');
   await assert.rejects(cursor.first(control),e=>e===primary);await assert.rejects(faultPeer.first(control),e=>e===primary);
   const released=releases;await assert.rejects(cursor.next(control),e=>e===primary);assert.equal(releases,released,'FAULT never replays descendants');assert.equal(postFaultAcquires,0);
   interrupted=false;cursor.close();for(let n=2;n<=343;n++)assert.equal(arena.referenceCount(n),0);return;
  }
  if(room===7491){assert.match(String(failure),/byte limit/);await assert.rejects(cursor.first(control),e=>e===failure);return}
  assert.equal(failure,undefined);
  assert.equal(Math.max(...charges.map(c=>c[2])),7492,'simultaneous staged/consumed Delete peak');
  let count=0;
  if(await cursor.first(control))do{
   const n=count===0?1:count+2;
   await cursor.withPayload(control,b=>assert.deepEqual(b,n===1?wide:small(n)));count++;
  }while(await cursor.next(control));
  assert.equal(count,680);
  // Traverse physical children too: no pending staged divider or hidden entry
  // may survive a successful balance, even though cursor order is correct.
  cursor.close();
  const seen=new Set(),pending=[2];let physical=0;
  while(pending.length){
   const number=pending.pop();assert.equal(seen.has(number),false);seen.add(number);
   const lease=arena.acquire(number);
   try{
    const p=lease.page;assert.equal(p.nOverflow,0);physical+=p.nCell;
    if(!p.leaf){
     for(let i=0;i<p.nCell;i++){const off=p.findCell(i);pending.push(p.bytes[off]*16777216+p.bytes[off+1]*65536+p.bytes[off+2]*256+p.bytes[off+3])}
     pending.push(p.rightChild());
    }
   }finally{lease.release()}
  }
  assert.equal(physical,680);
  for(let n=2;n<=343;n++)assert.equal(arena.referenceCount(n),0);
 }finally{faultPeer.close();cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
for(const predicted of [2730,2731])test(`Delete strict preservation predictedfree=${predicted}`,async()=>{
 const cap={maxEntries:3,maxKeyBytes:2000,maxBytes:100000};
 const budget=new PrivateStateByteBudget(cap.maxBytes),arena=await PrivateBlobkeyPages.open(budget,control,()=>{},cap);
 const cursor=new PrivateBlobkeyCursor(arena,info,cap);
 // Two local-only BLOB cells avoid overflow while occupying exactly the
 // desired post-delete cell+slot extent.
 const makeRecord=length=>{const serial=12+2*length,b=new Uint8Array(length+3);b.set([3,(serial>>>7)|128,serial&127]);return b};
 const record=makeRecord(600),last=makeRecord(4088-predicted-14-600);
 const pack=r=>{const b=new Uint8Array(r.length+2);b.set([(r.length>>>7)|128,r.length&127]);b.set(r,2);return b};
 const first=Uint8Array.of(3,2,1,1),bytes=new Uint8Array(4096);bytes[0]=10;bytes[4]=3;
 let top=4096;for(const [i,cell] of [first,pack(record),pack(last)].entries()){top-=cell.length;bytes.set(cell,top);bytes[8+i*2]=top>>>8;bytes[9+i*2]=top&255}
 bytes[5]=top>>>8;bytes[6]=top&255;
 try{
  arena.installPage(2,bytes);assert.equal(await cursor.first(control),true);
  const lease=arena.acquire(2);try{assert.equal(lease.page.computeFreeSpace()+lease.page.parseCell(0).nSize+2,predicted)}finally{lease.release()}
  await cursor.deleteCurrent({savePosition:true},control);
  assert.equal(cursor.position.state,predicted===2730?'SKIPNEXT':'REQUIRESEEK');
  assert.equal(await cursor.next(control),true);await cursor.withPayload(control,b=>assert.deepEqual(b,record));
  assert.equal(await cursor.next(control),true);await cursor.withPayload(control,b=>assert.deepEqual(b,last));
  assert.equal(await cursor.next(control),false);
 }finally{cursor.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('Delete UTF16BE NOCASE ties retains typed physical survivors and moved facade NULL',async()=>{
 const cap={maxEntries:6,maxKeyBytes:100,maxBytes:100000},budget=new PrivateStateByteBudget(cap.maxBytes);
 const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},cap);
 const ki=new KeyInfo({encoding:'utf-16be',totalFieldCount:2,keyFieldCount:2,terms:[{collation:'nocase'},{}]});
 const writer=new PrivateBlobkeyCursor(arena,ki,cap),peer=new PrivateBlobkeyCursor(arena,ki,cap),vm=new PrivateKeyVmCursor(arena,writer,ki),other=new PrivateKeyVmCursor(arena,peer,ki);
 const real=new Uint8Array(12);real.set([3,7,1]);new DataView(real.buffer).setFloat64(3,1,false);real[11]=2;
 const rows=[Uint8Array.of(3,0,1,0),Uint8Array.of(3,9,1,1),real,Uint8Array.of(3,17,1,0,65,3),Uint8Array.of(3,17,1,0,97,4),Uint8Array.of(3,14,1,255,5)];
 const value=new Mem();value.setText(Uint8Array.of(97),'utf-8');
 try{
  for(const row of rows)await writer.insertIndex(row,{},control);
  assert.equal(await vm.seekBound([value],'SeekGE',control),true);assert.equal(await other.seekBound([value],'SeekGE',control),true);
  await writer.withPayload(control,b=>assert.deepEqual(b,rows[3]));
  await vm.deleteCurrent({savePosition:true},control);
  const out=new Mem();try{await other.column(0,out,control);assert.equal(out.initialStorageClass,'null');assert.equal(other.nullRow,true)}finally{out.release()}
  assert.equal(await peer.next(control),true);await peer.withPayload(control,b=>assert.deepEqual(b,rows[4]));
  const actual=[];if(await writer.first(control))do{await writer.withPayload(control,b=>actual.push(Uint8Array.from(b)))}while(await writer.next(control));
  assert.deepEqual(actual,rows.filter((_,i)=>i!==3));
 }finally{value.release();peer.close();writer.close();arena.close();assert.equal(budget.usedBytes,0)}
});
test('accepted packed Delete and duplicate capability reproducer',async()=>fixture(async({writer,facade})=>{
 assert.equal(typeof writer.deleteCurrent,'function');assert.equal(typeof facade.deleteCurrent,'function');assert.equal(typeof facade.duplicate,'function');
}));
