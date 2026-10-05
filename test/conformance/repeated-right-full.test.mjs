import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';
const corpus=JSON.parse(fs.readFileSync(new URL('./cases/repeated-right-full.json',import.meta.url),'utf8'));
async function withDb(enc,fn,options){
 const fixture=corpus.fixtures[enc];const bytes=fs.readFileSync(new URL(`./fixtures/${fixture.path}`,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);await fn(db)}
 finally{db?.closeDeferred();await closeTestServer(server)}
}
function cell(s,i){const type=s.columnType(i),v=s.column(i);
 if(type==='null')return {type};if(type==='integer')return {type,value:String(v)};
 if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')}}
 if(type==='text')return {type,utf8Hex:Buffer.from(v).toString('hex')};
 return {type,hex:Buffer.from(v).toString('hex')};
}
function metadata(s){return Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declType:m.declaredType,database:m.database,table:m.table,origin:m.origin}})}
async function rows(s){const out=[];while(await s.step()==='row')out.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));return out}
// Repeated barriers now execute below; retain the composite-key admission boundary.
for(const enc of Object.keys(corpus.fixtures))test(`atomic WITHOUT ROWID barrier boundary ${enc}`,()=>withDb(enc,async db=>{
 const c=corpus.cases.find(c=>c.encoding===enc&&c.tags.includes('wr-boundary'));
 assert.throws(()=>db.prepare(c.sql),e=>e.kind==='unsupported'&&/WITHOUT ROWID RIGHT\/FULL match keys/.test(e.message));
 const s=db.prepare('SELECT 1').statement;try{assert.equal(await s.step(),'row');assert.equal(s.column(0),1n);assert.equal(await s.step(),'done')}finally{s.finalize()}
}));
// Source-based admission assertions execute normally; no rejected success gets credit.
{
 for(const c of corpus.cases.filter(c=>!c.tags.includes('wr-boundary')))test(`native acceptance ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 if(c.native.prepare.kind==='error'){
  assert.throws(()=>db.prepare(c.sql),e=>e.kind==='sqlite'&&e.code===c.native.prepare.resultCode&&e.extendedCode===c.native.prepare.extendedCode&&e.message===c.native.prepare.message);return;
 }
 const s=db.prepare(c.sql).statement;
 try{
 assert.deepEqual(metadata(s),c.native.columns);
 for(let pass=0;pass<2;pass++){
 if(c.bindings)for(const [i,v] of c.bindings.entries())s.bind(i+1,BigInt(v.value));
 assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(await s.step(),'done');s.reset();
 }
 if(c.rebind){for(const [i,v] of c.rebind.entries())s.bind(i+1,BigInt(v.value));assert.deepEqual(await rows(s),c.native.afterResetRebind.rows)}
 }finally{s.finalize()}
 }));
 for(const enc of Object.keys(corpus.fixtures)){
 const c=corpus.cases.find(c=>c.encoding===enc&&c.id==='full-full');
 test(`multi-barrier first-error controls ${enc}`,()=>withDb(enc,async db=>{
 for(const [options,kind] of [[{maxWorkUnits:0},'limit'],[{timeoutMs:0},'timeout'],[{signal:AbortSignal.abort()},'cancelled']]){
 const s=db.prepare(c.sql).statement;let first;
 await assert.rejects(s.step(options),e=>{first=e;return e.kind===kind});
 await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.finalize(),e=>e===first);
 }
 const s=db.prepare(c.sql).statement;
 assert.equal(await s.step(),'row');const firstRow=Array.from({length:s.columnCount},(_,i)=>cell(s,i));
 await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>cell(s,i)),firstRow);
 s.reset();assert.deepEqual(await rows(s),c.native.first.rows);s.finalize();
 }));
 test(`multi-barrier aggregate shared private budget ${enc}`,()=>withDb(enc,async db=>{
 const agg=corpus.cases.find(c=>c.encoding===enc&&c.id==='aggregate');const s=db.prepare(agg.sql).statement;let first;
 await assert.rejects(s.step(),e=>{first=e;return e.kind==='limit'});assert.throws(()=>s.finalize(),e=>e===first);
 },{limits:{maxPrivateEntries:0}}));
 }
}
// Native upstream assertions, explicitly adapted (not exact SQL/setup ports).
{
 // Implementation contracts: TS budgets, not native work/page counts.
 for(const enc of Object.keys(corpus.fixtures)){
  const c=corpus.cases.find(c=>c.encoding===enc&&c.id==='full-full');
  for(const limits of [{maxPrivateEntries:0},{maxPrivateKeyBytes:0},{maxPrivateBytes:0}])test(`multi-barrier cleanup ${enc}/${JSON.stringify(limits)}`,()=>withDb(enc,async db=>{
   const s=db.prepare(c.sql).statement;let first;await assert.rejects(s.step(),e=>{first=e;return e.kind==='limit'});
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.finalize(),e=>e===first);
   const clean=db.prepare('SELECT 1').statement;try{assert.equal(await clean.step(),'row');assert.equal(clean.column(0),1n)}finally{clean.finalize()}
  },{limits}));
  test(`multi-barrier cancelled after suspension ${enc}`,()=>withDb(enc,async db=>{
   const s=db.prepare(c.sql).statement;assert.equal(await s.step(),'row');const control=new AbortController();control.abort();let first;
   await assert.rejects(s.step({signal:control.signal}),e=>{first=e;return e.kind==='cancelled'});await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.finalize(),e=>e===first);
   const clean=db.prepare('SELECT 1').statement;try{assert.equal(await clean.step(),'row')}finally{clean.finalize()}
  }));
 }
}

// Authored shared-budget contract, not a native page/allocation counter.
// Instrument the existing owning budget only; public execution/rows stay intact.
for(const enc of Object.keys(corpus.fixtures))test(`multi-barrier nonzero simultaneous aggregate/match byte boundary ${enc}`,async()=>{
 const {PrivateStateByteBudget}=await import('../../src/internal/private-state.ts');
 const reserve=PrivateStateByteBudget.prototype.reserve;
 const events=[];
 PrivateStateByteBudget.prototype.reserve=function(bytes,message){
  const before=this.usedBytes;reserve.call(this,bytes,message);
  events.push({before,bytes,after:this.usedBytes,message});
 };
 let peak;
 try{
 await withDb(enc,async db=>{
  const c=corpus.cases.find(c=>c.encoding===enc&&c.id==='aggregate');
  const s=db.prepare(c.sql).statement;
  try{assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}
 });
 peak=Math.max(...events.map(e=>e.after));
 assert.ok(peak>0);
 const firstSorter=events.findIndex(e=>/sorter/.test(e.message));
 assert.ok(firstSorter>0&&events[firstSorter].before>0,JSON.stringify(events));
 assert.ok(events.slice(0,firstSorter).some(e=>/ephemeral index/.test(e.message)),JSON.stringify(events));
 assert.ok(events.some(e=>/ephemeral index/.test(e.message)),JSON.stringify(events));
 }finally{PrivateStateByteBudget.prototype.reserve=reserve}
 for(const maxPrivateBytes of [peak-1,peak])await withDb(enc,async db=>{
  const c=corpus.cases.find(c=>c.encoding===enc&&c.id==='aggregate');
  const s=db.prepare(c.sql).statement;
  if(maxPrivateBytes===peak){try{assert.deepEqual(await rows(s),c.native.first.rows);s.reset();assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}}
  else{let first;await assert.rejects(s.step(),e=>{first=e;return e.kind==='limit'});await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.finalize(),e=>e===first)}
  const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
 },{limits:{maxPrivateBytes}});
 console.log(`shared aggregate/match ${enc} logical byte high-water=${peak}; boundary ${peak-1} rejects, ${peak} succeeds`);
});

for(const enc of Object.keys(corpus.fixtures))test(`multi-barrier actual yielded work deadline cancellation ${enc}`,()=>withDb(enc,async db=>{
 // The small supplemental fixture is sufficient for work/deadline probes:
 // repeatedly step the existing unordered repeated query after partial output.
 const c=corpus.cases.find(c=>c.encoding===enc&&c.id==='right-right');
 for(const mode of ['work','deadline','cancel']){
  const s=db.prepare(c.sql).statement;
  const timer=globalThis.setTimeout;let yields=0;
  globalThis.setTimeout=function(callback,delay,...args){if(delay===0){yields++;if(mode==='deadline')delay=150;}return timer(callback,delay,...args)};
  const controller=new AbortController();let pending;
  try{
   if(mode==='cancel')pending=timer(()=>controller.abort(),0);
   // Native ordered query accumulates through its sorter before output.
   const options=mode==='work'?{maxWorkUnits:512}:mode==='deadline'?{timeoutMs:100}:{signal:controller.signal};
   const kind=mode==='work'?'limit':mode==='deadline'?'timeout':'cancelled';let first;
   await assert.rejects(s.step(options),e=>{first=e;return e.kind===kind});
   assert.ok(yields>0,`${mode} must reach an actual VDBE task yield`);
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.finalize(),e=>e===first);
  }finally{globalThis.setTimeout=timer;if(pending)clearTimeout(pending);try{s.finalize()}catch{}}
  const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row')}finally{reuse.finalize()}
 }
}));

// Pinned native captured before this additional mixed merged-name consumer.
const mergedCases=JSON.parse(fs.readFileSync(new URL('./cases/repeated-merged-using.json',import.meta.url),'utf8'));
for(const c of mergedCases)test(`mixed merged USING ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}
}));

// Native-FIRST discriminators for owning Return/stop and selected-index drains.
const continuationCorpus=JSON.parse(fs.readFileSync(new URL('./cases/repeated-continuation.json',import.meta.url),'utf8'));
assert.deepEqual(continuationCorpus.source,corpus.source);
for(const c of continuationCorpus.cases)test(`repeated continuation ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 // The existing physical-derived outer ORDER boundary is deliberately not
 // expanded by this repair. Native success is evidence, not TS success credit.
 if(c.id==='derived-filter-expression'){
  assert.throws(()=>db.prepare(c.sql),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary');
  const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row')}finally{reuse.finalize()}
  return;
 }
 const s=db.prepare(c.sql).statement;
 try{
  assert.deepEqual(metadata(s),c.native.columns);
  assert.deepEqual(await rows(s),c.native.first.rows);
  s.reset();s.clearBindings();assert.deepEqual(await rows(s),c.native.afterResetRebind.rows);
 }finally{s.finalize()}
 const reuse=db.prepare('SELECT 1').statement;
 try{assert.deepEqual(await rows(reuse),[[{type:'integer',value:'1'}]])}finally{reuse.finalize()}
}));
