import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateStateByteBudget,SorterCursor} from '../../src/internal/private-state.ts';
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
