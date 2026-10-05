import test from 'node:test';
import assert from 'node:assert/strict';
import {EphemeralIndexCursor} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';

// vdbe.c Found -> btree.c IndexMoveto uses KeyInfo comparisons and narrows
// ordered intervals. Browser sorted arrays retain this search, not page layout.
test('sorted membership narrows intervals with shared mutation invalidation and control',async()=>{
 const cursor=new EphemeralIndexCursor(new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary',desc:true,nullsLarge:true}]}),{maxEntries:2000,maxKeyBytes:1024,maxBytes:100000});
 const control={checkpoint:async()=>{}},cell=new Mem();let duplicate;
 try{
  for(let i=0;i<1024;i++){cell.setInt64(BigInt(i));await cursor.insert([cell],control);}
  cell.setNull();await cursor.insert([cell],control);
  await cursor.sort(control);duplicate=cursor.duplicate();cursor.first();const position=cursor.rowid();
  let work=0;const counted={checkpoint:async(units=0)=>{work+=units}};
  cell.setInt64(1023n);assert.equal(await duplicate.found([cell],counted),true);assert.ok(work<=11);
  work=0;cell.setInt64(2048n);assert.equal(await duplicate.found([cell],counted),false);assert.ok(work<=11);
  cell.setNull();assert.equal(await duplicate.found([cell],control),true);
  const failure=new Error('cancelled');cell.setInt64(900n);
  await assert.rejects(duplicate.found([cell],{checkpoint:async n=>{if(n)throw failure}}),error=>error===failure);
  assert.equal(cursor.rowid(),position,'membership does not publish scan position');
  cell.setInt64(2048n);await duplicate.insert([cell],control);
  assert.equal(await cursor.found([cell],control),true,'append invalidates shared ordered state');
  await duplicate.sort(control);work=0;assert.equal(await cursor.found([cell],counted),true);assert.ok(work<=11);
 }finally{cell.release();duplicate?.close();cursor.close();}
});
