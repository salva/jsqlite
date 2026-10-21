import test from 'node:test';
import assert from 'node:assert/strict';
import {dispatchPrivateInCursor} from '../../src/internal/private-in-dispatch.ts';
import {beginInLoop,finishInLoops} from '../../src/internal/where-in-loop.ts';
import {PrivateBlobkeyPages,PrivateBlobkeyCursor} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem,memToPublicInitial} from '../../src/internal/mem.ts';
const control={async checkpoint(){}};
const limits={maxEntries:100,maxKeyBytes:10000,maxBytes:100000};
for(const leftJoin of [false,true])for(const reverse of [false,true])test(`page-owned emitted ${leftJoin?'LEFT ':''}LOOP dispatch ${reverse?'DESC':'ASC'} nested restart`,async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),cursors=new Map(),registers=Array.from({length:4},()=>new Mem());
 const arenas=[];
 try{
  for(const [id,values] of [[8,[null,1,1,3]],[9,[null,2,4,4]]]){
   const arena=await PrivateBlobkeyPages.open(budget,control,()=>{},limits);arenas.push(arena);
   const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
   const cursor=new PrivateKeyVmCursor(arena,new PrivateBlobkeyCursor(arena,info,limits),info);cursors.set(id,cursor);
   for(const v of values)await cursor.insert(Uint8Array.from(v===null?[2,0]:[2,1,v]),control);
  }
  const ops=[],outer=beginInLoop(ops,8,1,reverse),inner=beginInLoop(ops,9,2,!reverse),body=ops.length;
  ops.push({code:'Observe'});finishInLoops(ops,[outer,inner],ops.length+(leftJoin?4:2),leftJoin);
  const seen=[];
  for(let pc=0,steps=0;pc<ops.length;){
   assert.ok(++steps<100,'finite native-shaped continuation');const op=ops[pc++];
   if(op.code==='Observe'){seen.push([memToPublicInitial(registers[1]),memToPublicInitial(registers[2])]);continue}
   if(op.code==='IsNull'){if(registers[op.p1].initialStorageClass==='null')pc=op.p2;continue}
   const result=await dispatchPrivateInCursor(op,cursors,registers,control);assert.equal(result.handled,true);
   if(result.jump!==null)pc=result.jump;
  }
  assert.deepEqual(seen,reverse?[[3n,2n],[3n,4n],[1n,2n],[1n,4n]]:[[1n,4n],[1n,2n],[3n,4n],[3n,2n]]);
  assert.equal(ops[body].code,'Observe');
  // Persistent cursor numbers must be returned to their existing dispatcher.
  assert.deepEqual(await dispatchPrivateInCursor({code:'IndexNext',p1:90,p2:12},cursors,registers,control),{handled:false,jump:null});
  const primary=new Error('dispatch cancelled');
  await assert.rejects(dispatchPrivateInCursor({code:'IndexRewind',p1:8,p2:12},cursors,registers,{checkpoint(){throw primary}}),e=>e===primary);
  assert.equal((await dispatchPrivateInCursor({code:'IndexRewind',p1:8,p2:12},cursors,registers,control)).jump,null);
  registers[3].setInt64(99n);
  await assert.rejects(dispatchPrivateInCursor({code:'Column',p1:0,p2:3,p3:8},cursors,registers,{checkpoint(){throw primary}}),e=>e===primary);
  assert.equal(memToPublicInitial(registers[3]),99n,'failed decoding cannot publish a register');
  await cursors.get(9).reuse(control);
  assert.equal((await dispatchPrivateInCursor({code:'IndexLast',p1:9,p2:77},cursors,registers,control)).jump,77,'empty endpoint jumps out');
  assert.equal((await dispatchPrivateInCursor({code:'IndexPrev',p1:9,p2:88},cursors,registers,control)).jump,null,'EOF continuation falls through');
  await dispatchPrivateInCursor({code:'Column',p1:0,p2:3,p3:9},cursors,registers,control);
  assert.equal(memToPublicInitial(registers[3]),null,'NULL row overwrites stale register');
 }finally{for(const r of registers)r.release();for(const c of cursors.values())c.close();for(const a of arenas)a.close()}
 assert.equal(budget.usedBytes,0);
});
