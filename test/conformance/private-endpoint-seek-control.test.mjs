import test from 'node:test';
import assert from 'node:assert/strict';
import {EphemeralIndexCursor} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';

// window.c1948–1950 emits endpoint SeekRowid; vdbe.c5495–5536
// propagates lookup errors before publishing cursor state. Linear browser
// lookup must account/check each visited record, not just the VM opcode.
test('endpoint private seek charges visited entries and leaves position on control failure',async()=>{
 const cursor=new EphemeralIndexCursor(new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary',desc:false,nullsLarge:false}]}),{maxEntries:1000,maxKeyBytes:1024,maxBytes:100000},undefined,true);
 const insertControl={checkpoint:async()=>{}};
 try{
  for(let i=0;i<300;i++){const cell=new Mem();cell.setInt64(BigInt(i));try{await cursor.insert([cell],insertControl)}finally{cell.release()}}
  assert.equal(cursor.first(),true);
  const duplicate=cursor.duplicate();
  try{
   let visited=0;
   const control={checkpoint:async(units=0)=>{visited+=units;}};
   assert.equal(await duplicate.seekRowid(300n,control),true);
   assert.equal(visited,300,'linear endpoint seek must charge every visited entry');
   assert.equal(duplicate.rowid(),300n);
   assert.equal(cursor.rowid(),1n,'OpenDup positioning remains independent');
   const failure=new Error('seek aborted');let checked=0;
   await assert.rejects(duplicate.seekRowid(299n,{checkpoint:async(units=0)=>{checked+=units;if(checked>=128)throw failure}}),error=>error===failure);
   assert.equal(duplicate.rowid(),300n,'failed seek must not publish partial position');
   let suspended,release;const waiting=new Promise(r=>{suspended=r});
   const pending=duplicate.seekRowid(200n,{checkpoint:async(units=0)=>{if(units===1&&!release){suspended();await new Promise(r=>{release=r});}}});
   await waiting;assert.equal(duplicate.rowid(),300n);assert.equal(cursor.rowid(),1n);release();assert.equal(await pending,true);assert.equal(duplicate.rowid(),200n);
   let missingVisits=0;assert.equal(await duplicate.seekRowid(999n,{checkpoint:async(u=0)=>{missingVisits+=u}}),false);assert.equal(missingVisits,300);assert.throws(()=>duplicate.data(),/not positioned/);
   assert.equal(await duplicate.seekRowid(1n,control),true);assert.equal(duplicate.data()[0].initialStorageClass,'integer');
   await cursor.replace([duplicate.data()[0]],insertControl);assert.equal(await duplicate.seekRowid(1n,control),true,'shared replacement preserves sequence identity');
  }finally{duplicate.close()}
 }finally{cursor.close()}
});
