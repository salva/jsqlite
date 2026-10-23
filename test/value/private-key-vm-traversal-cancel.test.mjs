import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';

function traversal(reverse,rows){
 const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:1,terms:[{},{}]});
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo,p4KeyInfo:keyInfo}];
 for(let i=0;i<400;i++)ops.push({code:'Integer',p1:BigInt(i),p2:1},{code:'Blob',p1:new Uint8Array(6000),p2:2},
  {code:'MakeRecord',p1:1,p2:2,p3:3},{code:'IdxInsert',p1:0,p2:3,consumeRecord:true});
 const start=ops.length;
 ops.push({code:reverse?'Last':'Rewind',p1:0,p2:start+9},
  {code:'Column',p1:0,p2:4,p3:0},{code:'ResultRow',p1:4,p2:1},
  {code:reverse?'Prev':'Next',p1:0,p2:start+5},{code:'Halt'},
  {code:'Column',p1:1,p2:5,p3:0},{code:'Column',p1:0,p2:4,p3:0},
  ...(rows?[{code:'ResultRow',p1:4,p2:1}]:[{code:'Integer',p1:0n,p2:6}]),
  {code:'Goto',p2:start+3},{code:'Halt'});
 return new VdbeStatement({encoding:'utf-8',registers:7,parameters:[],columns:[{name:'id'}],maxWorkUnits:100000000,maxResultBytes:100000,privateStateLimits:{maxEntries:1000,maxKeyBytes:10000,maxBytes:10000000},ops},()=>{},()=>()=>{},()=>{});
}
// Cancellation is scheduled only after the tree is built and first row returned.
// No SQL consumer or native async timing is claimed.
for(const reverse of [false,true])for(const mode of ['abort','deadline'])test(`packed traversal ${reverse?'reverse':'forward'} ${mode} first error reset and survivor`,async()=>{
 const victim=traversal(reverse,false),survivor=traversal(reverse,true);
 try{
  assert.equal(await survivor.step(),'row');assert.equal(survivor.column(0),reverse?399n:0n);
  for(let run=0;run<2;run++){
   assert.equal(await victim.step(),'row');assert.equal(victim.column(0),reverse?399n:0n);
   const controller=new AbortController(),reason=new Error('traversal abort');
   const timer=mode==='abort'?setTimeout(()=>controller.abort(reason),0):null;
   let primary;
   try{await assert.rejects(victim.step(mode==='abort'?{signal:controller.signal}:{timeoutMs:1}),e=>{
    primary=e;assert.equal(e.kind,mode==='abort'?'cancelled':'timeout');if(mode==='abort')assert.equal(e.cause,reason);return true;
   });}finally{if(timer!==null)clearTimeout(timer);}
   await assert.rejects(victim.step(),e=>e===primary);assert.throws(()=>victim.reset(),e=>e===primary);
  }
  const actual=[reverse?399n:0n];while(await survivor.step()==='row')actual.push(survivor.column(0));
  assert.deepEqual(actual,Array.from({length:400},(_,i)=>BigInt(reverse?399-i:i)));
  survivor.reset();assert.equal(await survivor.step(),'row');assert.equal(survivor.column(0),reverse?399n:0n);
 }finally{victim.finalize();survivor.finalize();}
});
