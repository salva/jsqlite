import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateStateByteBudget,SorterCursor} from '../../src/internal/private-state.ts';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
import {Mem} from '../../src/internal/mem.ts';

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
