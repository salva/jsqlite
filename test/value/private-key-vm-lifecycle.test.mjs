import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
// OpenEphemeral new cursor publication must use its KeyInfo encoding consistent
// with database encoding. Failure disposes newly acquired arena, not a peer.
test('private VM rejects KeyInfo/database encoding mismatch at open, retaining primary on reset/finalize',async()=>{
  const info=new KeyInfo({encoding:'utf-16le',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
  const statement=new VdbeStatement({encoding:'utf-8',registers:2,parameters:[],columns:[],maxWorkUnits:10000,maxResultBytes:10000,privateStateLimits:{maxEntries:4,maxKeyBytes:100,maxBytes:100000},ops:[{code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
  await assert.rejects(statement.step(),{kind:'internal'});
  assert.throws(()=>statement.reset(),{kind:'internal'});
  // reset reports and consumes the saved error; finalize after reset is clean.
  assert.doesNotThrow(()=>statement.finalize());
});

function lifecycleStatement({options={},maxBytes=100000,maxWorkUnits=100000,finalize=()=>{}}={}){
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info},
 {code:'Integer',p1:7n,p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},{code:'IdxInsert',p1:0,p2:2,keyStart:1,keyCount:1},
 {code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info},
 {code:'NotFound',p1:0,keyStart:1,keyCount:1,jump:8},{code:'Integer',p1:0n,p2:3},{code:'Goto',p2:9},
 {code:'Integer',p1:1n,p2:3},{code:'ResultRow',p1:3,p2:1},{code:'Halt'}];
 return new VdbeStatement({encoding:'utf-8',registers:4,parameters:[],columns:[{name:'empty'}],maxWorkUnits,maxResultBytes:10000,privateStateLimits:{maxEntries:4,maxKeyBytes:100,maxBytes},ops},()=>{},()=>()=>{},finalize);
}
test('compatible reuse empties actual arena and reset refunds enough for repeat execution',async()=>{
 const stmt=lifecycleStatement();
 try{for(let i=0;i<3;i++){assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n);assert.equal(await stmt.step(),'done');stmt.reset()}}finally{stmt.finalize()}
});
for(const [name,config,options,kind] of [
 ['deadline',{}, {timeoutMs:0},'timeout'],
 ['cancel',{}, {signal:AbortSignal.abort()},'cancelled'],
 ['bytes',{maxBytes:1},{},'limit'],
 ['work',{maxWorkUnits:1},{},'limit'],
])test(`private lifecycle ${name} error owns finalize cleanup collision`,async()=>{
 const collision=new Error('cleanup collision');let calls=0;
 const stmt=lifecycleStatement({...config,finalize:()=>{calls++;throw collision}});
 let primary;try{await stmt.step(options);assert.fail('expected execution failure')}catch(error){primary=error}
 assert.equal(primary.kind,kind);
 assert.throws(()=>stmt.finalize(),error=>error===primary);
 assert.equal(calls,1);
});

// Fault injection at the actual acquire/publication seam, not a parallel arena.
// Prototypes are restored in finally; these tests run sequentially in this file.
test('new arena cursor-publication failure closes acquired pages and retains primary',async()=>{
 const {PrivateBlobkeyPages}=await import('../../src/internal/private-blobkey-pages.ts');
 const originalOpen=PrivateBlobkeyPages.open,originalReserve=PrivateBlobkeyPages.prototype.reserveCursor;
 const primary=new Error('cursor publication admission failure');let budget,acquired=0;
 PrivateBlobkeyPages.open=async function(b,...args){budget=b;const arena=await originalOpen.call(this,b,...args);acquired++;return arena};
 PrivateBlobkeyPages.prototype.reserveCursor=function(){throw primary};
 const stmt=lifecycleStatement();
 try{
  await assert.rejects(stmt.step(),e=>e===primary);
  assert.equal(acquired,1);assert.equal(budget.usedBytes,0);
  assert.throws(()=>stmt.reset(),e=>e===primary);assert.equal(budget.usedBytes,0);
  stmt.finalize();
 }finally{PrivateBlobkeyPages.open=originalOpen;PrivateBlobkeyPages.prototype.reserveCursor=originalReserve}
});

test('execution timeout retains primary over actual private close collision and releases once',async()=>{
 const {PrivateKeyVmCursor}=await import('../../src/internal/private-key-vm.ts');
 const original=PrivateKeyVmCursor.prototype.close;
 const collision=new Error('private close collision');let closes=0;
 PrivateKeyVmCursor.prototype.close=function(){closes++;original.call(this);throw collision};
 const stmt=lifecycleStatement();
 try{
  assert.equal(await stmt.step(),'row');
  let primary;try{await stmt.step({timeoutMs:0})}catch(error){primary=error}
  assert.equal(primary.kind,'timeout');assert.equal(closes,1);
  assert.throws(()=>stmt.reset(),e=>e===primary);assert.equal(closes,1);
  stmt.finalize();assert.equal(closes,1);
 }finally{PrivateKeyVmCursor.prototype.close=original}
});
