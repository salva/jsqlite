import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';

// vdbe.c OpenEphemeral: reuse clears the Btree without assigning pKeyInfo.
// Only allocateCursor's larger-width branch installs the new comparator.
test('packed OpenEphemeral retains KeyInfo on reuse and replaces it on growth',async()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const width of [1,2,3]){
  const original=new KeyInfo({encoding,totalFieldCount:2,keyFieldCount:1,terms:[{collation:'nocase'},{}]});
  const changed=new KeyInfo({encoding,totalFieldCount:width,keyFieldCount:1,terms:[{collation:'binary',desc:true},{},{}]});
  const ops=[{code:'OpenEphemeral',p1:0,keyInfo:original,p4KeyInfo:original},
   {code:'String',p1:'stale',p2:1},{code:'Integer',p1:77n,p2:2},{code:'MakeRecord',p1:1,p2:2,p3:4},{code:'IdxInsert',p1:0,p2:4,consumeRecord:true},
   {code:'OpenEphemeral',p1:0,keyInfo:changed,p4KeyInfo:changed}];
  for(const [text,id] of [['a',1n],['B',2n],['z',3n]]){
   ops.push({code:'String',p1:text,p2:1},{code:'Integer',p1:id,p2:2},{code:'Integer',p1:9n,p2:3},
    {code:'MakeRecord',p1:1,p2:Math.max(2,width),p3:4},{code:'IdxInsert',p1:0,p2:4,consumeRecord:true});
  }
  const start=ops.length;
  ops.push({code:'Rewind',p1:0,p2:start+4},{code:'Column',p1:0,p2:5,p3:0},{code:'ResultRow',p1:5,p2:1},{code:'Next',p1:0,p2:start+1},{code:'Halt'});
  const vm=new VdbeStatement({encoding,registers:6,parameters:[],columns:[{name:'key'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},ops},()=>{},()=>()=>{},()=>{});
  try{for(let run=0;run<2;run++){
   // Reuse retains NOCASE ASC; growth installs BINARY DESC.
   for(const text of width<=2?['a','B','z']:['z','a','B']){assert.equal(await vm.step(),'row');assert.equal(vm.column(0),text);}
   assert.equal(await vm.step(),'done');if(!run)vm.reset();
  }}finally{vm.finalize();}
 }
});
