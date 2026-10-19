import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {ExecutionTaskScheduler} from '../../src/internal/task-scheduler.ts';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
async function withDb(options,run){
 const bridge=await startFixtureServer(root);let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`),options);await run(db)}
 finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
}
// json.c:jsonTranslateBlobToText JSONB_TEXT5; review.md card-r v18 R1.
test('pretty TEXT5 escaped apostrophe is not classified as strict JSON',()=>withDb({},async db=>{
 const s=db.prepare('SELECT json_pretty(?1)').statement;
 try{s.bind(1,String.raw`"a\'b"`);assert.equal(await s.step(),'row');assert.equal(s.column(0),`"a'b"`)}finally{s.finalize()}
}));
test('pretty TEXT5 scalar x/v/0 branches preserve translated escape spelling',()=>withDb({},async db=>{
 const s=db.prepare('SELECT json_pretty(?1)').statement;
 try{s.bind(1,String.raw`'\x41\v\0'`);assert.equal(await s.step(),'row');assert.equal(s.column(0),String.raw`"\u0041\u000b\u0000"`)}finally{s.finalize()}
}));
// Review R2: nonzero budget and one large scalar, not the pre-step zero-work case.
test('pretty retained large scalar exceeds nonzero statement private budget',()=>withDb({limits:{maxPrivateBytes:4096}},async db=>{
 const s=db.prepare('SELECT json_pretty(?1)').statement;
 try{
  s.bind(1,'"'+'a'.repeat(65536)+'"');
  await assert.rejects(s.step(),e=>e.kind==='limit');
 }finally{try{s.finalize()}catch{}}
}));
test('pretty large scalar crosses nonzero incremental work limit',()=>withDb({},async db=>{
 const s=db.prepare('SELECT json_pretty(?1)').statement;
 try{
  s.bind(1,'"'+'a'.repeat(65536)+'"');
  await assert.rejects(s.step({maxWorkUnits:256}),e=>e.kind==='limit');
 }finally{try{s.finalize()}catch{}}
}));
import fs from 'node:fs';
const correctionCases=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-f/correction-cases.json',import.meta.url),'utf8'));
for(const encoding of ['utf8','utf16le','utf16be'])test(`TEXT5 source-pinned scalar/label/JSONB companions ${encoding}`,async()=>{
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
  for(const item of correctionCases){const s=db.prepare(item.sql).statement;
   assert.equal(s.columnMetadata(0).name,item.sql.slice(7));
   if(item.error){await assert.rejects(s.step(),e=>e.kind==='sqlite'&&e.message===item.error,item.sql);assert.throws(()=>s.reset(),e=>e.kind==='sqlite');s.finalize()}
   else{assert.equal(await s.step(),'row',item.sql);assert.equal(s.column(0),item.value,item.sql);assert.equal(s.columnType(0),'text');s.finalize();
    const subtype=db.prepare(`SELECT subtype(${item.sql.slice(7)})`).statement;assert.equal(await subtype.step(),'row');assert.equal(subtype.column(0),0n);subtype.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
test('pretty nonzero retention/large output controls save errors, release budget and reuse',async()=>{
 for(const limits of [{maxPrivateBytes:4096},{maxResultBytes:4096}])await withDb({limits},async db=>{
  for(const sql of ['SELECT json_pretty(?1)','SELECT json_pretty(\'[1]\',?1)']){
   const s=db.prepare(sql).statement;
   s.bind(1,sql.includes('[1]')?'x'.repeat(65536):'"'+'a'.repeat(65536)+'"');
   const first=await s.step().then(()=>null,e=>e);assert.equal(first?.kind,'limit');
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
   s.bind(1,sql.includes('[1]')?' ':'{}');assert.equal(await s.step(),'row');s.finalize();
  }
  // A second execution must not inherit a leaked arena after success or error.
  for(let i=0;i<12;i++){const s=db.prepare("SELECT json_pretty('{}')").statement;assert.equal(await s.step(),'row');s.finalize()}
 });
});
test('pretty yields during expanded indentation, cancels and preserves/reset-cleans first error',()=>withDb({},async db=>{
 const s=db.prepare(`SELECT json_pretty('[1,2,3]',?1)`).statement;s.bind(1,'x'.repeat(8192));
 // Input preflight charges only 32 units: cancellation requires pretty append yield.
 const abort=new AbortController();let timerRan=false;setTimeout(()=>{timerRan=true;abort.abort('pretty append')},0);
 const first=await s.step({signal:abort.signal}).then(()=>null,e=>e);assert.equal(timerRan,true);assert.equal(first?.kind,'cancelled');
 await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
 s.bind(1,' ');assert.equal(await s.step(),'row');s.finalize();
}));
test('pretty incremental output charges work and injected deadline at append checkpoints',()=>withDb({},async db=>{
 for(const options of [{maxWorkUnits:160},{timeoutMs:2}]){
  const s=db.prepare(`SELECT json_pretty('[1,2,3]',?1)`).statement;s.bind(1,'x'.repeat(8192));
  const now=Date.now;let ticks=0;if(options.timeoutMs)Date.now=()=>ticks++<160?1000:1002;
  let first;try{first=await s.step(options).then(()=>null,e=>e)}finally{Date.now=now}
  assert.equal(first?.kind,options.timeoutMs?'timeout':'limit');assert.throws(()=>s.finalize(),e=>e===first);
  const reuse=db.prepare("SELECT json_pretty('{}')").statement;assert.equal(await reuse.step(),'row');reuse.finalize();
 }
}));
test('pretty scanner/render generators yield within bound scalar after input preflight',()=>withDb({},async db=>{
 // Source is <20KiB (both preflights total <160 units); scanning plus strict
 // classification crosses the first yield. Parser, not only append, suspends.
 const s=db.prepare('SELECT json_pretty(?1)').statement;s.bind(1,'"'+'a'.repeat(20000)+'"');
 const abort=new AbortController();let ran=false;setTimeout(()=>{ran=true;abort.abort()},0);
 const first=await s.step({signal:abort.signal}).then(()=>null,e=>e);assert.equal(ran,true);assert.equal(first?.kind,'cancelled');
 assert.throws(()=>s.reset(),e=>e===first);s.bind(1,'{}');assert.equal(await s.step(),'row');s.finalize();
}));

// R2a: single-pass scan progress, excluding preflight and post-publication work.
// Observe decoded pushes as consumed input positions, and delegate the real
// clock/scheduler. No second strict-reparse publication exists any longer.
for(const [label,escape] of [['six-width-u',String.raw`\u0041`],['two-width-backslash',String.raw`\\`]])
 test(`escape-dense ${label} classification crosses checkpoints before publication`,()=>withDb({},async db=>{
  const document='"'+escape.repeat(3000)+'"',decoded=escape.length===6?'A':'\\';
  const s=db.prepare('SELECT json_pretty(?1)').statement;s.bind(1,document);
  const originalJoin=Array.prototype.join,originalPush=Array.prototype.push,originalNow=Date.now;
  const yieldTask=ExecutionTaskScheduler.prototype.yield;
  let scanner,positions=0,ticks=0,lastTick=0,lastPosition=0,maxGap=0,checks=0,publications=0;
  Date.now=()=>{ticks++;return originalNow()};
  ExecutionTaskScheduler.prototype.yield=function(){return yieldTask.call(this)};
  Array.prototype.push=function(...items){
   if(!scanner&&this.length===0&&items.length===1&&items[0]===decoded)scanner=this;
   if(this===scanner){
    assert.deepEqual(items,[decoded]);positions++;
    if(positions===1){lastTick=ticks;lastPosition=positions}
    else if(ticks!==lastTick){maxGap=Math.max(maxGap,positions-lastPosition);lastPosition=positions;lastTick=ticks;checks++}
   }
   return originalPush.apply(this,items);
  };
  Array.prototype.join=function(separator){
   if(this===scanner){publications++;maxGap=Math.max(maxGap,positions-lastPosition);assert.equal(positions,3000);}
   return originalJoin.call(this,separator);
  };
  try{
   assert.equal(await s.step({timeoutMs:100000}),'row');
   assert.equal(s.columnType(0),'text');assert.equal(s.column(0),escape.length===6?document:JSON.stringify(decoded.repeat(3000)));
  }finally{Array.prototype.join=originalJoin;Array.prototype.push=originalPush;Date.now=originalNow;ExecutionTaskScheduler.prototype.yield=yieldTask;s.finalize()}
  assert.equal(publications,1,'single decoded publication');
  const stride=Math.ceil(256/escape.length);
  assert.ok(checks>=Math.floor((3000-1)/stride),`scanner checkpoint density: ${checks}`);
  assert.ok(maxGap<=stride,`consumed-input checkpoint gap ${maxGap*escape.length} exceeds ${stride*escape.length}`);
 }));

function escapedDocument(escape,count,shape){
 const raw=escape.repeat(count),text='"'+raw+'"';
 if(shape==='scalar')return text;
 if(shape==='label')return '{'+text+':null}';
 const payload=new TextEncoder().encode(raw);
 const string=new Uint8Array(payload.length+3);string.set([0xd8,payload.length>>8,payload.length&255]);string.set(payload,3);
 if(shape==='jsonb-scalar')return string;
 const object=new Uint8Array(string.length+4);const size=string.length+1;
 object.set([0xdc,size>>8,size&255]);object.set(string,3);return object;
}
for(const [name,escape,count,decoded] of [['u0041',String.raw`\u0041`,3000,'A'],['backslash',String.raw`\\`,9000,'\\']])
 for(const shape of ['scalar','label','jsonb-scalar','jsonb-label'])
  test(`escape-dense ${name} ${shape} controls interrupt classification, save error and reuse`,()=>withDb({},async db=>{
   // Real-clock binary deadlines and same-workload negative controls live in
   // json-pretty-live-binary.test.mjs; do not force time in that byte path.
   for(const mode of (shape.startsWith('jsonb-')?['work','cancel']:['work','cancel','deadline'])){
    const s=db.prepare('SELECT json_pretty(?1)').statement;s.bind(1,escapedDocument(escape,count,shape));
    const join=Array.prototype.join,subarray=Uint8Array.prototype.subarray,now=Date.now,yieldTask=ExecutionTaskScheduler.prototype.yield;
    const binary=shape.startsWith('jsonb-');let renderedPayload=false;
    let publications=0,expired=false,cancelArmed=false,suspended=false,resumed=false;
    const abort=new AbortController();
    // Classification may have only one host-task suspension. MessageChannel
    // and timers have no cross-task-source ordering guarantee (card-h-e).
    // Delegate the real scheduler unchanged, and deliver cancellation while
    // its Promise is pending, not at the synchronous decoded publication.
    // Thus missing suspension, late suspension, or missing post-resume checks
    // still fail; real-host timer delivery is covered by the large-input tests.
    if(mode==='cancel')ExecutionTaskScheduler.prototype.yield=function(){
     const pending=yieldTask.call(this);
     if(cancelArmed){
      cancelArmed=false;suspended=true;
      queueMicrotask(()=>{assert.equal(resumed,false,'abort delivered before scheduler resumes');abort.abort('during strict classification suspension')});
      return pending.then(()=>{resumed=true});
     }
     return pending;
    };
    // Binary TEXTJ publication copies raw bytes (jsonTranslateBlobToText),
    // never decoding or Array.join-ing the escaped spelling. Observe entry
    // into the real reached-payload renderer after preflight instead.
    if(binary)Uint8Array.prototype.subarray=function(start,end){
     const result=subarray.call(this,start,end);
     if(result.length===escape.length*count&&result[0]===92){
      renderedPayload=true;
      if(mode==='deadline')expired=true;if(mode==='cancel')cancelArmed=true;
     }
     return result;
    };
    Array.prototype.join=function(separator){
     if(this.length===count&&this.every(c=>c===decoded)){
      publications++;
      if(publications===1){if(mode==='deadline')expired=true;if(mode==='cancel')cancelArmed=true}
     }
     return join.call(this,separator);
    };
    if(mode==='deadline')Date.now=()=>expired?1002:1000;
    let first;try{
     first=await s.step(mode==='work'?{maxWorkUnits:230}:mode==='cancel'?{signal:abort.signal}:{timeoutMs:2}).then(()=>null,e=>e);
    }finally{Array.prototype.join=join;Uint8Array.prototype.subarray=subarray;Date.now=now;ExecutionTaskScheduler.prototype.yield=yieldTask}
    assert.equal(first?.kind,mode==='work'?'limit':mode==='cancel'?'cancelled':'timeout',`${name}/${shape}/${mode}`);
    if(binary){assert.equal(renderedPayload,true,'interruption after admission at reached raw payload');assert.equal(publications,0,'binary TEXTJ must not decode for publication')}
    else assert.equal(publications,1,'failure within scanner/classifier, before second decoded publication');
    if(mode==='cancel'){assert.equal(suspended,true,'cooperative suspension inside classification');assert.equal(resumed,true,'real scheduler task completed')}
    await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
    s.bind(1,'{}');assert.equal(await s.step(),'row');assert.equal(s.column(0),'{}');s.finalize();
    const reuse=db.prepare("SELECT json_pretty('{}')").statement;assert.equal(await reuse.step(),'row');reuse.finalize();
   }
  }));
