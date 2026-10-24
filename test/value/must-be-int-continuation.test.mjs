import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';

// vdbe.c OP_MustBeInt (jump0), also emitted by wherecode.c filterPullDown
// for IPK probes: failed NUMERIC conversion is a no-match, not MISMATCH.
function statement(input,p2,encoding){
 return new VdbeStatement({encoding,registers:2,parameters:[],columns:[{name:'v'}],
  maxWorkUnits:10000,maxResultBytes:10000,
  privateStateLimits:{maxEntries:100,maxKeyBytes:1000,maxBytes:100000},ops:[
   {...input,p2:0},{code:'MustBeInt',p1:0,...(p2===undefined?{}:{p2})},
   {code:'ResultRow',p1:0,p2:1},{code:'Halt'},
   {code:'Integer',p1:-1n,p2:1},{code:'ResultRow',p1:1,p2:1},{code:'Halt'}
  ]},()=>{},()=>()=>{},()=>{});
}
for(const encoding of ['utf-8','utf-16le','utf-16be']){
 test(`MustBeInt jump0 conversion and no-match continuation ${encoding}`,async()=>{
  const inputs=[
   [{code:'Integer',p1:42n},42n], [{code:'Real',p1:42},42n],
   [{code:'String',p1:' 42.0 '},42n], [{code:'String',p1:'9.223372036854775808e18'},-1n],
   [{code:'Real',p1:1.5},-1n], [{code:'String',p1:'not an integer'},-1n],
   [{code:'Null'},-1n], [{code:'Blob',p1:new Uint8Array([52,50])},-1n]
  ];
  for(const [input,expected] of inputs){
   const vm=statement(input,4,encoding);
   try{for(let run=0;run<2;run++){
    assert.equal(await vm.step(),'row');assert.equal(vm.column(0),expected);
    assert.equal(await vm.step(),'done');if(!run)vm.reset();
   }}finally{vm.finalize();}
  }
  // Explicit and omitted zero retain LIMIT's error and saved-first-error path.
  for(const target of [undefined,0]){
   const vm=statement({code:'String',p1:'bad'},target,encoding);
   try{let first;await assert.rejects(vm.step(),error=>{first=error;return error.code===20;});
    assert.throws(()=>vm.reset(),error=>error===first);
   }finally{vm.finalize();}
  }
 });
}
