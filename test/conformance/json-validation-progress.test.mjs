import assert from 'node:assert/strict';
import test from 'node:test';
import {Mem} from '../../src/internal/mem.ts';
import {jsonValid,jsonErrorPosition,jsonValidAsync,jsonErrorPositionAsync} from '../../src/internal/json.ts';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
function text5(n,ending=[97],pair=[92,10]){const size=n*pair.length+ending.length,b=new Uint8Array(size+5);b.set([0xe9,size>>>24,(size>>>16)&255,(size>>>8)&255,size&255]);for(let i=0;i<n;i++)b.set(pair,5+i*pair.length);b.set(ending,5+n*pair.length);return b}
function array(n){const b=new Uint8Array(n+5);b.set([0xeb,n>>>24,(n>>>16)&255,(n>>>8)&255,n&255]);return b}
test('strict validator reached checkpoints, offsets and short circuit',async()=>{
 const b=array(1000000),m=new Mem();m.setBlob(b);let charges=0;
 assert.equal(jsonValid(m,8,n=>charges+=n),true);assert.ok(charges>=1000000);
 const stop=Error('checkpoint');assert.throws(()=>jsonValid(m,8,()=>{throw stop}),e=>e===stop);
 let progress=0;assert.equal(await jsonValidAsync(m,8,async()=>{progress++;await Promise.resolve()}),true);assert.ok(progress>=1000000);
 b[b.length-1]=15;m.setBlob(b);assert.equal(jsonValid(m,4,()=>{throw stop}),true);assert.equal(jsonValid(m,8),false);assert.equal(jsonErrorPosition(m).integerValue(),1000005n);
 assert.equal((await jsonErrorPositionAsync(m,async()=>{})).integerValue(),1000005n);
 m.setText(new TextEncoder().encode(' '.repeat(10000)+'[0,]'),'utf-8');let textCharges=0;assert.equal(jsonErrorPosition(m,n=>textCharges+=n).integerValue(),0n);assert.ok(textCharges>30);
 m.setNull();assert.equal(jsonValid(m,8),null);assert.equal(jsonErrorPosition(m).initialStorageClass,'null');
 // jsonbValidityCheck INT/INT5/FLOAT/TEXTJ scalar loops (not container-only credit).
 for(const [type,payload] of [[3,'1'.repeat(4096)],[4,'0x'+'a'.repeat(4096)],[5,'1.'+'0'.repeat(4096)],[8,'\\\\'.repeat(4096)]]){
  const raw=new TextEncoder().encode(payload),b=new Uint8Array(raw.length+3);b.set([0xd0|type,raw.length>>8,raw.length&255]);b.set(raw,3);m.setBlob(b);let n=0;
  assert.equal(jsonValid(m,8,k=>n+=k),true);assert.ok(n>=16);assert.throws(()=>jsonErrorPosition(m,()=>{throw stop}),e=>e===stop);
 }
 m.release();
});
test('TEXT5 bypass suspends within consecutive continuations and retains first offset',async()=>{
 const m=new Mem(),stop=Error('bypass checkpoint');
 for(const pair of [[92,10],[92,13],[92,13,10],[92,226,128,168],[92,226,128,169]]){
  m.setBlob(text5(500000,[97],pair));let units=0;
  assert.equal(jsonValid(m,8,n=>units+=n),true);assert.ok(units>3000);
  let errorUnits=0;assert.equal(jsonErrorPosition(m,n=>errorUnits+=n).integerValue(),0n);assert.ok(errorUnits>3000);
  for(const inspect of [c=>jsonValid(m,8,c),c=>jsonErrorPosition(m,c)]){
   let n=0;assert.throws(()=>inspect(()=>{if(++n===3)throw stop}),e=>e===stop);
  }
  let progress=0;assert.equal(await jsonValidAsync(m,8,async()=>{progress++;await Promise.resolve()}),true);assert.ok(progress>3000);
  let n=0;await assert.rejects(jsonErrorPositionAsync(m,async()=>{if(++n===3)throw stop}),e=>e===stop);
 }
 // Source jsonBytesToBypass/jsonUnescapeOneChar terminal and following-escape branches.
 for(const [end,valid] of [[[],true],[[92],false],[[92,120],false],[[92,120,52,49],true],[[92,48,49],false],[[92,117,100,56,48,48,92,117,100,99,48,48],true],[[226,128,128,128,128],true],[[92,226,128],false]]){
  m.setBlob(text5(1000,end));assert.equal(jsonValid(m,4),true);assert.equal(jsonValid(m,8),valid);assert.equal(jsonErrorPosition(m).integerValue(),valid?0n:6n);
 }
 m.release();
});
test('public validation/error parser checkpoints after admission and saved errors',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
 db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-utf8`));
 for(const [sql,input] of [['json_valid(?1,8)',array(10000)],['json_error_position(?1)',array(10000)],['json_valid(?1,8)',text5(2000000)],['json_error_position(?1)',text5(2000000)],['json_error_position(?1)',' '.repeat(200000)+'[0,]']]){
 for(const mode of ['control','work','cancel','deadline']){
 const s=db.prepare('SELECT '+sql).statement;s.bind(1,input);
 const original=ExecutionTaskScheduler.prototype.yield,abort=new AbortController();let reached=false,held=false,delivered=false;
 ExecutionTaskScheduler.prototype.yield=function(){
  const pending=original.call(this);
  // Stack provenance distinguishes the real owner checkpoint from input admission.
  if(!new Error().stack.includes('driveJsonAsync')||held)return pending;
  reached=true;held=true;
  return Promise.all([pending,new Promise(resolve=>setTimeout(()=>{delivered=true;if(mode==='cancel')abort.abort('validator progress');resolve()},mode==='deadline'?1100:0))]);
 };
 let result,error;
 try{result=await s.step(mode==='work'?{maxWorkUnits:typeof input==='string'?1200:input.length>100000?23000:950}:mode==='cancel'?{signal:abort.signal}:mode==='deadline'?{timeoutMs:1000}:{}).catch(e=>{error=e})}
 finally{ExecutionTaskScheduler.prototype.yield=original}
 try{
 assert.equal(reached,true,'must reach owner after admission');assert.equal(delivered,true);
 if(mode==='control'){assert.equal(error,undefined);assert.equal(result,'row');assert.equal(s.columnType(0),'integer');assert.equal(s.column(0),sql.startsWith('json_valid')?1n:0n);assert.equal(await s.step(),'done');s.reset()}
 else{assert.equal(error?.kind,mode==='work'?'limit':mode==='cancel'?'cancelled':'timeout');await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s.reset(),e=>e===error)}
 s.bind(1,'{}');assert.equal(await s.step(),'row');assert.equal(s.column(0),0n);assert.equal(await s.step(),'done');s.reset();
 }finally{s.finalize()}
 }
 }
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
