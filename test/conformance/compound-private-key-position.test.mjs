import test from 'node:test';
import assert from 'node:assert/strict';
import {EphemeralIndexCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary',desc:false,nullsLarge:false}]});
const limits={maxEntries:2048,maxKeyBytes:1024,maxBytes:100000};
const cell=n=>{const m=new Mem();m.setInt64(BigInt(n));return m};
test('ordered ephemeral replacement and membership narrow keys during compound population',async()=>{
 const c=new EphemeralIndexCursor(info,limits);let work=0;const control={checkpoint:async(n=0)=>{work+=n}};
 try{
  for(let i=1023;i>=0;i--){const m=cell(i);try{await c.replace([m],control)}finally{m.release()}}
  const before=work,m=cell(512);
  try{await c.replace([m],control);assert.equal(await c.found([m],control),true)}finally{m.release()}
  assert.ok(work-before<100,'replacement and membership must not scan 1024 records');
  assert.equal(c.size,1024);
  assert.equal(c.first(),true);assert.equal(c.data()[0].integerValue(),0n);
  for(let i=1;i<1024;i++){assert.equal(c.next(),true);assert.equal(c.data()[0].integerValue(),BigInt(i))}
 }finally{c.close()}
});
test('ordered insertion rolls back failed publication and releases shared private bytes',async()=>{
 const budget=new PrivateStateByteBudget(limits.maxBytes),c=new EphemeralIndexCursor(info,limits,budget);
 const ok={checkpoint:async()=>{}};const one=cell(1),zero=cell(0);
 try{
  await c.replace([one],ok);let calls=0;const error=new Error('publication cancelled');
  await assert.rejects(c.replace([zero],{checkpoint:async()=>{if(++calls===5)throw error}}),e=>e===error);
  assert.equal(c.size,1);assert.equal(await c.found([zero],ok),false);assert.equal(c.first(),true);assert.equal(c.data()[0].integerValue(),1n);
 }finally{one.release();zero.release();c.close()}
});
