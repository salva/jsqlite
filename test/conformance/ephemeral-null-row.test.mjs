import test from 'node:test';
import assert from 'node:assert/strict';
import {EphemeralIndexCursor} from '../../src/internal/private-state.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]});
function statement(ops){return new VdbeStatement({ops,registers:8,encoding:'utf-8',columns:[{name:'x'}],parameters:[],maxRows:100,maxWorkUnits:10000,maxResultBytes:10000,privateStateLimits:{maxEntries:100,maxKeyBytes:10000,maxBytes:1000000}},()=>{},()=>()=>{},()=>{});}
// Exact independent d147 VM branches, also original OpenEphemeral. Column's
// p1 is the field and p3 the cursor in this VM; both zero/one cases matter.
for(const duplicate of [false,true])for(const read of ['Column','Rowid','IfNullRow'])test(`initial ${duplicate?'OpenDup':'OpenEphemeral'} ${read} is NULL across reset/reopen`,async()=>{
 const cursor=duplicate?1:0;
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo},...(duplicate?[{code:'OpenDup',p1:1,p2:0}]:[])];
 if(read==='Column')ops.push({code:'Column',p1:duplicate?1:0,p2:1,p3:cursor});
 if(read==='Rowid')ops.push({code:'Rowid',p1:cursor,p2:1});
 if(read==='IfNullRow'){ops.push({code:'Integer',p1:99n,p2:1});ops.push({code:'IfNullRow',p1:cursor,p2:ops.length+1,p3:1});}
 ops.push({code:'ResultRow',p1:1,p2:1},{code:'Halt'});
 const s=statement(ops);try{for(let run=0;run<2;run++){assert.equal(await s.step(),'row');assert.equal(s.column(0),null);assert.equal(await s.step(),'done');s.reset();}}finally{s.finalize();}
});
test('independent d147 exact VM reproducer tails all return NULL and finalize cleanly',async()=>{
 for(const tail of [[{code:'Column',p1:1,p2:0,p3:1}],[{code:'Rowid',p1:1,p2:1}],[{code:'Integer',p1:99n,p2:1},{code:'IfNullRow',p1:1,p2:4,p3:1}]]){
 const s=statement([{code:'OpenEphemeral',p1:0,keyInfo},{code:'OpenDup',p1:1,p2:0},...tail,{code:'ResultRow',p1:1,p2:1},{code:'Halt'}]);try{assert.equal(await s.step(),'row');assert.equal(s.column(0),null);assert.equal(await s.step(),'done');}finally{s.finalize();}}
});
test('VM OpenDup remains initially NULL while original is positioned; rewind and exhausted Next own their flags',async()=>{
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo,insertionOrder:true},{code:'Integer',p1:7n,p2:1},{code:'IdxInsert',p1:0,keyStart:1,keyCount:1},{code:'Rewind',p1:0,p2:99},{code:'OpenDup',p1:1,p2:0},
 {code:'Column',p1:0,p2:2,p3:1},{code:'ResultRow',p1:2,p2:1},
 {code:'Column',p1:0,p2:2,p3:0},{code:'ResultRow',p1:2,p2:1},
 {code:'Rewind',p1:1,p2:99},{code:'Column',p1:0,p2:2,p3:1},{code:'ResultRow',p1:2,p2:1},
 {code:'Next',p1:1,p2:99},{code:'Column',p1:0,p2:2,p3:1},{code:'ResultRow',p1:2,p2:1},
 {code:'Column',p1:0,p2:2,p3:0},{code:'ResultRow',p1:2,p2:1},{code:'Halt'}];
 const s=statement(ops);try{for(let run=0;run<2;run++){for(const value of [null,7n,7n,null,7n]){assert.equal(await s.step(),'row');assert.equal(s.column(0),value);}assert.equal(await s.step(),'done');s.reset();}}finally{s.finalize();}
});
test('VM empty Rewind preserves NULL and Close/reopen reinitializes handle',async()=>{
 const s=statement([{code:'OpenEphemeral',p1:0,keyInfo},{code:'Rewind',p1:0,p2:2},{code:'Column',p1:0,p2:1,p3:0},{code:'ResultRow',p1:1,p2:1},{code:'Close',p1:0},{code:'OpenEphemeral',p1:0,keyInfo},{code:'Rowid',p1:0,p2:1},{code:'ResultRow',p1:1,p2:1},{code:'Halt'}]);
 try{for(let run=0;run<2;run++){for(let i=0;i<2;i++){assert.equal(await s.step(),'row');assert.equal(s.column(0),null);}assert.equal(await s.step(),'done');s.reset();}}finally{s.finalize();}
});
test('private transition flags match Rewind/Next/SeekRowid and clear/sort locality',async()=>{
 const c=new EphemeralIndexCursor(keyInfo,{maxEntries:10,maxKeyBytes:1024,maxBytes:10000}),value=new Mem(),control={checkpoint:async()=>{}};value.setInt64(7n);let dup;
 try{assert.equal(c.nullRow,true);assert.equal(c.first(),false);assert.equal(c.nullRow,true);await c.insert([value],control);assert.equal(c.first(),true);dup=c.duplicate();assert.equal(dup.nullRow,true);assert.equal(await dup.seekRowid(99n,control),false);assert.equal(dup.nullRow,false);assert.equal(c.data()[0].integerValue(),7n);dup.setNullRow();await c.sort(control);assert.equal(dup.nullRow,true);assert.equal(c.nullRow,false);c.clear();assert.equal(dup.nullRow,true);assert.equal(c.nullRow,false);assert.equal(c.first(),false);assert.equal(c.nullRow,true);assert.equal(c.next(),false);assert.equal(c.nullRow,true);}finally{value.release();dup?.close();c.close();}
});
test('vdbe NullRow is handle-local and positioning restores retained rows',async()=>{
 const c=new EphemeralIndexCursor(new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]}),{maxEntries:10,maxKeyBytes:1024,maxBytes:10000});
 const value=new Mem();value.setInt64(7n);let dup;
 try{await c.insert([value],{checkpoint:async()=>{}});dup=c.duplicate();assert.equal(c.first(),true);assert.equal(dup.first(),true);c.setNullRow();assert.equal(c.nullRow,true);assert.equal(dup.nullRow,false);assert.equal(dup.data()[0].integerValue(),7n);assert.equal(c.size,1);assert.equal(c.first(),true);assert.equal(c.nullRow,false);assert.equal(c.data()[0].integerValue(),7n);c.setNullRow();assert.equal(await c.seekRowid(1n,{checkpoint:async()=>{}}),true);assert.equal(c.nullRow,false);c.setNullRow();c.rewindBeforeFirst();assert.equal(c.nullRow,true);assert.equal(c.next(),true);c.setNullRow();c.clear();assert.equal(c.nullRow,true);assert.equal(c.first(),false);assert.equal(c.nullRow,true);}finally{value.release();dup?.close();c.close();}
});
