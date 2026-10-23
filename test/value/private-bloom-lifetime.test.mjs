import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
function statement(ops,maxBytes=10128){return new VdbeStatement({encoding:'utf-8',registers:1004,parameters:[],columns:[{name:'absent'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes},ops},()=>{},()=>()=>{},()=>{});}
const result=[{code:'Integer',p1:0n,p2:3},{code:'Goto',p2:8},{code:'Integer',p1:1n,p2:3},{code:'ResultRow',p1:3,p2:1},{code:'Halt'}];
test('FilterInit prereleases replaced storage before admission and clears old bits',async()=>{
 const s=statement([{code:'FilterInit',p1:1,bytes:10000},{code:'Integer',p1:1n,p2:2},
 {code:'FilterAdd',p1:1,p3:2,p4:1},{code:'FilterInit',p1:1,bytes:10000},
 {code:'Filter',p1:1,p2:7,p3:2,p4:1},...result]);
 try{for(let run=0;run<2;run++){assert.equal(await s.step(),'row');assert.equal(s.column(0),1n);assert.equal(await s.step(),'done');if(!run)s.reset();}}finally{s.finalize();}
});

test('replacement capacity failure preserves primary error, reset recovery and paused independent filter',async()=>{
 const survivor=statement([{code:'FilterInit',p1:1,bytes:10000},{code:'Integer',p1:1n,p2:2},
  {code:'FilterAdd',p1:1,p3:2,p4:1},{code:'ResultRow',p1:2,p2:1},
  {code:'Filter',p1:1,p2:7,p3:2,p4:1},...result]);
 const failed=statement([{code:'FilterInit',p1:1,bytes:10000},
  {code:'ResultRow',p1:2,p2:1},{code:'FilterInit',p1:1,bytes:10001},{code:'Halt'}]);
 try{
  assert.equal(await survivor.step(),'row');
  for(let run=0;run<2;run++){
   assert.equal(await failed.step(),'row');let primary;
   await assert.rejects(failed.step(),e=>{primary=e;return e.kind==='limit'});
   await assert.rejects(failed.step(),e=>e===primary);
   assert.throws(()=>failed.reset(),e=>e===primary);
  }
  assert.equal(await survivor.step(),'row');assert.equal(survivor.column(0),0n);
  assert.equal(await survivor.step(),'done');
 }finally{failed.finalize();survivor.finalize();}
});

for(const failAt of [10020,20006])test(`replacement work failure ${failAt} cleans up and preserves saved error`,async()=>{
 const s=statement([{code:'FilterInit',p1:1,bytes:10000},{code:'Integer',p1:1n,p2:2},
  {code:'FilterAdd',p1:1,p3:2,p4:1},{code:'ResultRow',p1:2,p2:1},
  {code:'FilterInit',p1:1,bytes:10000},{code:'Halt'}]);
 try{for(let run=0;run<2;run++){
  assert.equal(await s.step(),'row');let primary;
  await assert.rejects(s.step({maxWorkUnits:failAt}),e=>{primary=e;return e.kind==='limit'});
  await assert.rejects(s.step(),e=>e===primary);
  assert.throws(()=>s.reset(),e=>e===primary);
 }}finally{s.finalize();}
});

for(const opcode of ['FilterAdd','Filter'])test(`${opcode} checkpoint failure retains first error and reset rebuilds`,async()=>{
 const s=statement([{code:'FilterInit',p1:1,bytes:10000},{code:'Integer',p1:1n,p2:2},
  {code:'ResultRow',p1:2,p2:1},{code:opcode,p1:1,p2:4,p3:2,p4:1000},{code:'Halt'}]);
 try{for(let run=0;run<2;run++){
  assert.equal(await s.step(),'row');let primary;
  // Allocation charged10000 plus dispatch work; fail inside hash checkpoint,
  // before it can borrow the key register range.
  await assert.rejects(s.step({maxWorkUnits:10020}),e=>{primary=e;return e.kind==='limit'});
  await assert.rejects(s.step(),e=>e===primary);
  assert.throws(()=>s.reset(),e=>e===primary);
 }}finally{s.finalize();}
});
