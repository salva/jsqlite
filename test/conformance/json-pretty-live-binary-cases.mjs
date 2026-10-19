import assert from 'node:assert/strict';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
// json.c:jsonTranslateBlobToText TEXTJ copies raw escaped bytes. Observe the
// reached payload, not a decoded string publication which this branch lacks.
function document(escape,count,label){
 const payload=new TextEncoder().encode(escape.repeat(count));
 const string=new Uint8Array(payload.length+3);string.set([0xd8,payload.length>>8,payload.length&255]);string.set(payload,3);
 if(!label)return string;
 const object=new Uint8Array(string.length+4),size=string.length+1;
 object.set([0xdc,size>>8,size&255]);object.set(string,3);return object;
}
export function registerLiveBinary(enc){test(`live raw JSONB interruption and negative controls ${enc}`,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  for(const [escape,count] of [[String.raw`\u0041`,3000],[String.raw`\\`,9000]])for(const label of [false,true]){
   const input=document(escape,count,label);
   for(const mode of ['control','work','cancel','deadline']){
    const s=db.prepare('SELECT json_pretty(?1)').statement;s.bind(1,input);
    const subarray=Uint8Array.prototype.subarray,yieldTask=ExecutionTaskScheduler.prototype.yield;
    const abort=new AbortController();let reached=false,suspended=false,resumed=false,delivered=false;
    Uint8Array.prototype.subarray=function(start,end){const result=subarray.call(this,start,end);if(result.length===escape.length*count&&result[0]===92)reached=true;return result};
    ExecutionTaskScheduler.prototype.yield=function(){
     const pending=yieldTask.call(this);
     if(!reached||suspended)return pending;
     suspended=true;
     // Real elapsed time and actual pending scheduler work. No clock mutation,
     // pre-abort, busy loop, or yield-count assertion. The no-deadline control
     // traverses the identical delayed path and must publish the complete row.
     return Promise.all([pending,new Promise(resolve=>setTimeout(()=>{
      assert.equal(resumed,false);delivered=true;if(mode==='cancel')abort.abort('after raw payload progress');resolve();
     },mode==='deadline'||mode==='control'?1100:0))]).then(()=>{resumed=true});
    };
    let result,error;
    try{result=await s.step(mode==='work'?{maxWorkUnits:230}:mode==='cancel'?{signal:abort.signal}:mode==='deadline'?{timeoutMs:1000}:{}).catch(e=>{error=e})}
    finally{Uint8Array.prototype.subarray=subarray;ExecutionTaskScheduler.prototype.yield=yieldTask}
    try{
     assert.equal(reached,true,'must get past admission and preflight');
     if(mode==='control'){
      assert.equal(error,undefined);assert.equal(result,'row');assert.equal(s.columnType(0),'text');
      const quoted='"'+escape.repeat(count)+'"';assert.equal(s.column(0),label?'{\n    '+quoted+': null\n}':quoted);
      assert.equal(await s.step(),'done');s.reset();
     }else{
      assert.equal(error?.kind,mode==='work'?'limit':mode==='cancel'?'cancelled':'timeout');
      await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s.reset(),e=>e===error);
     }
     if(mode!=='work'){assert.equal(suspended,true);assert.equal(delivered,true);assert.equal(resumed,true)}
     s.bind(1,'{}');assert.equal(await s.step(),'row');assert.equal(s.column(0),'{}');assert.equal(await s.step(),'done');s.reset();
    }finally{s.finalize()}
   }
  }
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});}
