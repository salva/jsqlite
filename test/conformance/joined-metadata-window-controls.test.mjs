import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {open} from '../../src/index.ts';
import {suspendExecutionTask} from './suspend-execution-task.mjs';
const oracle=JSON.parse(readFileSync(new URL('../../docs/research/joined-metadata-window/native.json',import.meta.url)));
for(const image of oracle.encodings)test(`joined metadata Window controls ${image.encoding}`,async()=>{
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(Buffer.from(image.base64,'base64'));db=await open('https://fixture.invalid/joined-controls');}finally{globalThis.fetch=prior;}
 const sql=image.cases[0].sql;
 let deferred=false;
 try{
  for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){
   const st=db.prepare(sql).statement;
   try{await assert.rejects(st.step(options),e=>e.kind===kind);assert.throws(()=>st.reset(),e=>e.kind===kind);assert.equal(await st.step(),'row');}finally{st.finalize();}
  }
  // Real metadata Filter/Next input; many physical rows force a host-task yield.
  const longSql="SELECT a.x,p.cid,row_number() OVER (ORDER BY a.x,p.cid) FROM t a CROSS JOIN t b CROSS JOIN t c CROSS JOIN t d CROSS JOIN t e CROSS JOIN t f JOIN pragma_table_info(a.nm) p";
  for(const kind of ['cancelled','timeout']){
   const st=db.prepare(longSql).statement,hold=suspendExecutionTask(),controller=new AbortController();let pending;
   try{
    pending=st.step(kind==='cancelled'?{signal:controller.signal}:{timeoutMs:100});await hold.suspended;
    if(kind==='cancelled')controller.abort();else await new Promise(resolve=>setTimeout(resolve,150));
    hold.release();await assert.rejects(pending,e=>e.kind===kind);assert.throws(()=>st.reset(),e=>e.kind===kind);assert.equal(await st.step(),'row');
   }finally{hold.restore();if(pending)await pending.catch(()=>{});st.finalize();}
  }
  const st=db.prepare(sql).statement;
  assert.equal(await st.step(),'row');db.closeDeferred();deferred=true;
  st.reset();assert.equal(await st.step(),'row');st.finalize();assert.throws(()=>db.prepare('SELECT 1'));
 }finally{if(!deferred)db.closeDeferred();}
});
