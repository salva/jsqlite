import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
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
