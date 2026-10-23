import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
function statement(ops,columns=['value']){return new VdbeStatement({encoding:'utf-8',registers:8,parameters:[],columns:columns.map(name=>({name})),maxWorkUnits:2000000,maxResultBytes:10000,privateStateLimits:{maxEntries:200,maxKeyBytes:10000,maxBytes:4000000},ops},()=>{},()=>()=>{},()=>{});}
function packedSurvivor(){
 const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:3,keyFieldCount:2,terms:[{collation:'nocase'},{},{}]});
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo,p4KeyInfo:keyInfo}];
 for(let i=79;i>=0;i--)ops.push({code:'String',p1:i%2?'B':'b',p2:1},
  {code:'Integer',p1:BigInt(i),p2:2},{code:'Blob',p1:new Uint8Array(180),p2:3},
  {code:'MakeRecord',p1:1,p2:3,p3:4},{code:'IdxInsert',p1:0,p2:4,keyStart:1,keyCount:2});
 ops.push({code:'String',p1:'b',p2:1});
 const common={p1:0,keys:[1],affinities:['blob'],keyInfo};
 const seek=ops.length;ops.push({code:'IndexSeekPrefix',...common,p2:0});
 const loop=ops.length;ops.push({code:'IndexPrefixEnd',...common,p2:0},
  {code:'Column',p1:1,p2:5,p3:0},{code:'ResultRow',p1:5,p2:1},{code:'IndexNext',p1:0,p2:loop});
 const end=ops.length;ops.push({code:'Halt'});ops[seek].p2=end;ops[loop].p2=end;
 return statement(ops);
}
// A row boundary establishes the replacement has not begun. Timer abort and
// elapsed deadline are observed on the scheduler-yielding allocation path;
// the deadline check's exact pre/post-yield position is not asserted.
// No patched globals or production fault injector are used.
for(const mode of ['abort','deadline'])test(`suspended filter replacement ${mode}, reset and packed survivor`,async()=>{
 const survivor=packedSurvivor();
 const victim=statement([{code:'FilterInit',p1:1,bytes:10000},
  {code:'Integer',p1:1n,p2:2},{code:'FilterAdd',p1:1,p3:2,p4:1},
  {code:'ResultRow',p1:2,p2:1},{code:'FilterInit',p1:1,bytes:1000000},{code:'Halt'}]);
 let finalized=false;
 try{
  assert.equal(await survivor.step(),'row');assert.equal(survivor.column(0),0n);
  for(let run=0;run<2;run++){
   assert.equal(await victim.step(),'row');
   const controller=new AbortController(),reason=new Error('timer cancellation');
   const timer=mode==='abort'?setTimeout(()=>controller.abort(reason),0):null;
   let primary;
   try{await assert.rejects(victim.step(mode==='abort'?{signal:controller.signal}:{timeoutMs:1}),e=>{
    primary=e;assert.equal(e.kind,mode==='abort'?'cancelled':'timeout');
    if(mode==='abort')assert.equal(e.cause,reason);return true;
   });}finally{if(timer!==null)clearTimeout(timer);}
   await assert.rejects(victim.step(),e=>e===primary);
   assert.throws(()=>victim.reset(),e=>e===primary);
  }
  victim.finalize();finalized=true;
  const suffixes=[0n];while(await survivor.step()==='row')suffixes.push(survivor.column(0));
  assert.deepEqual(suffixes,Array.from({length:80},(_,i)=>BigInt(i)));
  survivor.reset();assert.equal(await survivor.step(),'row');assert.equal(survivor.column(0),0n);
 }finally{if(!finalized)victim.finalize();survivor.finalize();}
});
