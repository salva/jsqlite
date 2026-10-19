import assert from 'node:assert/strict';
import test from 'node:test';
import {Mem} from '../../src/internal/mem.ts';
import {jsonExtract,jsonExtractAsync} from '../../src/internal/json.ts';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
const text=s=>{const m=new Mem();m.setText(new TextEncoder().encode(s),'utf-8');return m};
test('reached long path scan delivers control after document admission',()=>{
 const doc=text('{"a":1}');
 try{for(const quoted of [false,true]){
  const tiny=text(quoted?'$."zzzzzzzzzz"':'$.zzzzzzzzzz'),long=text(quoted?'$."'+'z'.repeat(1000000)+'"':'$.'+'z'.repeat(1000000));
  try{
   let calls=0;const small=jsonExtract(doc,[tiny],()=>calls++);assert.equal(small.initialStorageClass,'null');small.release();const before=calls;assert.equal(before,4);
   const sentinel=new Error('after document admission');calls=0;
   assert.throws(()=>jsonExtract(doc,[long],()=>{if(++calls===before+1)throw sentinel}),e=>e===sentinel);
   assert.equal(calls,before+1);
  }finally{tiny.release();long.release()}
 }}finally{doc.release()}
});
test('resumable scanner malformed/index/Unicode and sequential admission',async()=>{
 for(const path of ['$.'+'z'.repeat(100000), '$."'+'z'.repeat(100000)+'"', '$."'+'z'.repeat(100000), '$."'+'\\u0061'.repeat(20000)+'"', '$.'+'𝄞'.repeat(100000)]){
  const doc=text('{"a":1}'),p=text(path),stop=Error('held continuation');let resumed=false;
  try{await assert.rejects(jsonExtractAsync(doc,[p],'text',async()=>{await new Promise(r=>setTimeout(r,0));resumed=true;throw stop},()=>{}),e=>e===stop);assert.equal(resumed,true)}finally{doc.release();p.release()}
 }
 const doc=text('[1]'),p=text('$['+'9'.repeat(100000)+']'),stop=Error('digits');
 try{await assert.rejects(jsonExtractAsync(doc,[p],'text',async()=>{throw stop},()=>{}),e=>e===stop)}finally{doc.release();p.release()}
 const nullDoc=new Mem(),invalid=text('bad'),nullPath=new Mem();
 try{const a=await jsonExtractAsync(nullDoc,[invalid],'text',()=>{throw stop},()=>{});assert.equal(a.initialStorageClass,'null');a.release();
 const d=text('{}');try{const b=await jsonExtractAsync(d,[nullPath,invalid],'text',()=>{throw stop},()=>{});assert.equal(b.initialStorageClass,'null');b.release()}finally{d.release()}
 }finally{nullDoc.release();invalid.release();nullPath.release()}
});
test('reached binary raw and escaped label comparisons suspend',async()=>{
 const element=(tag,body)=>{const b=new Uint8Array(body.length+5);b.set([0xe0|tag,body.length>>>24,(body.length>>>16)&255,(body.length>>>8)&255,body.length&255]);b.set(body,5);return b};
 for(const escaped of [false,true]){
 const label=element(escaped?9:10,new TextEncoder().encode(escaped?'\\\n'.repeat(100000)+'a':'z'.repeat(100000)));
 const body=new Uint8Array(label.length+2);body.set(label);body.set([0x13,0x31],label.length);
 const doc=new Mem();doc.setBlob(element(12,body));const p=text(escaped?'$.a':'$.'+'z'.repeat(100000));let reached=false;const stop=Error('comparison');
 try{let progress=0;await assert.rejects(jsonExtractAsync(doc,[p],'text',async()=>{if(++progress===(escaped?10:5000)){reached=true;await new Promise(r=>setTimeout(r,0));throw stop}},()=>{}),e=>e===stop);assert.equal(reached,true)}finally{doc.release();p.release()}
 }
});
for(const encoding of ['utf8','utf16le','utf16be'])test('public reached path control and recovery '+encoding,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
 db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
 for(const expression of ['json_extract(?1,?2)','jsonb_extract(?1,?2)','?1 -> ?2','?1 ->> ?2','json_type(?1,?2)','json_array_length(?1,?2)','json_replace(?1,?2,2)','jsonb_replace(?1,?2,2)','json_remove(?1,?2)','jsonb_remove(?1,?2)'])for(const mode of (expression.includes('replace')||expression.includes('remove')||expression.includes('type')||expression.includes('length')?['cancel']:['control','work','cancel','deadline'])){
 const s=db.prepare('SELECT '+expression).statement;s.bind(1,'{"a":1}');s.bind(2,'$.'+'z'.repeat(200000));
 const original=ExecutionTaskScheduler.prototype.yield,abort=new AbortController();let held=false,delivered=false,error,result;
 ExecutionTaskScheduler.prototype.yield=function(){const pending=original.call(this);if(!new Error().stack.includes('driveJsonAsync')||held)return pending;held=true;return Promise.all([pending,new Promise(resolve=>setTimeout(()=>{delivered=true;if(mode==='cancel')abort.abort('path');resolve()},mode==='deadline'?1100:0))])};
 try{result=await s.step(mode==='work'?{maxWorkUnits:encoding==='utf8'?1600:3200}:mode==='cancel'?{signal:abort.signal}:mode==='deadline'?{timeoutMs:1000}:{}).catch(e=>{error=e})}finally{ExecutionTaskScheduler.prototype.yield=original}
 try{
 assert.equal(held,true,'real path-owner scheduler suspension after admission');assert.equal(delivered,true);
 if(mode==='control'){assert.equal(error,undefined);assert.equal(result,'row');assert.equal(s.column(0),null);assert.equal(s.columnType(0),'null');assert.equal(await s.step(),'done');s.reset()}
 else{assert.equal(error?.kind,mode==='work'?'limit':mode==='cancel'?'cancelled':'timeout');await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s.reset(),e=>e===error)}
 s.bind(1,'{"a":1}');s.bind(2,'$.a');assert.equal(await s.step(),'row');const expected=expression.includes('replace')||expression.includes('remove')?(expression.startsWith('jsonb_')?null:expression.includes('replace')?'{"a":2}':'{}'):expression.includes('json_type')?'integer':expression.includes('array_length')?0n:expression==='?1 -> ?2'?'1':1n;if(expression.startsWith('jsonb_')&&(expression.includes('replace')||expression.includes('remove')))assert.equal(s.columnType(0),'blob');else assert.equal(s.column(0),expected);assert.equal(await s.step(),'done');s.reset();
 }finally{s.finalize()}
 }
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
