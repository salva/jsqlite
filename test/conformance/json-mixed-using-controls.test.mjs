import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const bytes=fs.readFileSync(new URL('../../docs/research/json-mixed-using/UTF-8.sqlite',import.meta.url));
for(const mode of ['cancel','work','private'])test(`mixed USING owned resource cleanup ${mode}`,async()=>{
 const fetch=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/mixed-controls',mode==='private'?{limits:{maxPrivateBytes:64}}:{});}finally{globalThis.fetch=fetch;}
 const s=db.prepare('SELECT j.value FROM jt LEFT JOIN json_each(?1) j USING(key) ORDER BY j.value').statement;
 try{
  s.bind(1,'['+'1,'.repeat(12000)+'2]');const controller=new AbortController();assert.equal(controller.signal.aborted,false);
  const timer=mode==='cancel'?setTimeout(()=>controller.abort('live mixed USING'),0):null;
  let first;try{await assert.rejects(s.step(mode==='cancel'?{signal:controller.signal}:mode==='work'?{maxWorkUnits:16}:{}),e=>{first=e;return e.kind===(mode==='cancel'?'cancelled':'limit');});}finally{if(timer!==null)clearTimeout(timer);}
  if(mode==='cancel')assert.equal(controller.signal.aborted,true);
  await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
  s.bind(1,'[]');if(mode!=='private'){assert.equal(await s.step(),'row');assert.equal(s.column(0),null);s.reset();}
 }finally{s.finalize();}
 const recovery=db.prepare('SELECT 1').statement;try{assert.equal(await recovery.step(),'row');}finally{recovery.finalize();db.close();}
});
