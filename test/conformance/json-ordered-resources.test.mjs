import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {open} from '../../src/index.ts';
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
// Exercise both producer-to-sorter insertion and suspended sorted-drain cleanup.
// Native value/metadata expectations are independently captured in the companion
// ordered integration suite; these controls assert this implementation's limits.
for(const encoding of ['utf8','utf16le','utf16be'])for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree']){
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/encoding-${encoding}.db`,import.meta.url));
 async function connect(options={}){const old=globalThis.fetch;try{globalThis.fetch=async()=>new Response(bytes);return await open('https://fixture.invalid/ordered-resources',options)}finally{globalThis.fetch=old}}
 const sql=`SELECT DISTINCT t.rowid,j.atom FROM t1 t LEFT JOIN ${module}(?1) j ON 1 ORDER BY j.key DESC,t.rowid LIMIT 5 OFFSET 1`;
 for(const mode of ['work','private','abort','deadline'])test(`ordered resource ${encoding} ${module} producer ${mode}`,async()=>{
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return original.apply(this,args)};
  const db=await connect(mode==='private'?{limits:{maxPrivateBytes:512}}:{});let s;
  try{
   s=db.prepare(sql).statement;s.bind(1,JSON.stringify(Array.from({length:256},(_,i)=>i)));
   const controller=new AbortController();controller.abort('ordered producer');
   const options=mode==='work'?{maxWorkUnits:64}:mode==='abort'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:{};
   let first;await assert.rejects(s.step(options),e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit')});
   if(mode==='private')assert.ok(budgets.size>0,'private cursor allocation observed');
   for(const b of budgets)assert.equal(b.usedBytes,0,'error refunds private state');
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
   if(mode!=='private'){s.bind(1,'[]');assert.equal(await s.step(),'done');s.reset();}
   // Reset must release failed execution. A tiny independent statement checks
   // admission and private ownership even when this connection has a low cap.
   s.finalize();s=undefined;const probe=db.prepare('SELECT 1').statement;try{assert.equal(await probe.step(),'row');assert.equal(probe.column(0),1n)}finally{probe.finalize()}
  }finally{s?.finalize();db.close();PrivateStateByteBudget.prototype.replace=original;}
 });
 test(`ordered resource ${encoding} ${module} suspended drain reset/rebind/abort/deadline`,async()=>{
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.reserve;
  PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return original.apply(this,args)};
  const db=await connect();let s;
  try{
   s=db.prepare(sql).statement;
   for(const mode of ['reset','abort','deadline','work']){
    s.bind(1,'[3,2,1,0]');assert.equal(await s.step(),'row');
    if(mode!=='reset'){
     const controller=new AbortController();controller.abort('ordered drain');
     let first;const options=mode==='abort'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:{maxWorkUnits:1};
     await assert.rejects(s.step(options),e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit')});
     assert.throws(()=>s.reset(),e=>e===first);
    }else s.reset();
    for(const b of budgets)assert.equal(b.usedBytes,0,'reset refunds retained sorter');
    s.bind(1,'[]');assert.equal(await s.step(),'done');s.reset();
   }
   // Finalize while sorter output is suspended, then admit another statement.
   s.bind(1,'[3,2,1,0]');assert.equal(await s.step(),'row');s.finalize();s=undefined;
   assert.ok(budgets.size>0,'observed private reservations');for(const b of budgets)assert.equal(b.usedBytes,0,'finalize refunds retained sorter');
   const probe=db.prepare('SELECT 1').statement;try{assert.equal(await probe.step(),'row')}finally{probe.finalize()}
  }finally{s?.finalize();db.close();PrivateStateByteBudget.prototype.reserve=original;}
 });
}
