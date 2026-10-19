import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {suspendExecutionTask} from './suspend-execution-task.mjs';
async function connect(encoding,options){
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${encoding}-corrected.sqlite`,import.meta.url));
 const prior=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(bytes);return await open('https://fixture.invalid/direct-controls',options);}finally{globalThis.fetch=prior;}
}
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`mixed Window controls ${encoding}`,async()=>{
 const sql="SELECT j.value,row_number() OVER (ORDER BY s.name,j.key) AS rn FROM sqlite_schema s JOIN json_each('[10,20]') j ORDER BY s.name,j.key";
 const db=await connect(encoding);
 try{
  for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){
   const st=db.prepare(sql).statement;
   try{await assert.rejects(st.step(options),e=>e.kind===kind);assert.throws(()=>st.reset(),e=>e.kind===kind);assert.equal(await st.step(),'row');}finally{st.finalize();}
  }
  const st=db.prepare("SELECT j.value,row_number() OVER (ORDER BY s.name,j.key) FROM sqlite_schema s JOIN json_each('bad') j").statement;
  let malformed;try{await assert.rejects(st.step(),e=>{malformed=e;return e.kind==='sqlite'&&e.message==='malformed JSON';});}finally{assert.throws(()=>st.finalize(),e=>e===malformed);}
  for(const kind of ['cancelled','timeout']){
   const payload=JSON.stringify(Array.from({length:300},(_,i)=>i%31));
   const controlSql=`SELECT j.value,row_number() OVER (ORDER BY s.name,j.key) FROM sqlite_schema s JOIN json_each('${payload}') j ORDER BY s.name,j.key`;
   const st=db.prepare(controlSql).statement,hold=suspendExecutionTask(),controller=new AbortController();
   let pending;
   try{
    pending=st.step(kind==='cancelled'?{signal:controller.signal}:{timeoutMs:100});
    await hold.suspended;
    if(kind==='cancelled')controller.abort();else await new Promise(resolve=>setTimeout(resolve,150));
    hold.release();await assert.rejects(pending,e=>e.kind===kind);
    assert.throws(()=>st.reset(),e=>e.kind===kind);assert.equal(await st.step(),'row');
   }finally{hold.restore();if(pending)await pending.catch(()=>{});st.finalize();}
  }
  const recovery=db.prepare('SELECT 7').statement;
  try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),7n);}finally{recovery.finalize();}
 }finally{db.close();}
 const limited=await connect(encoding,{limits:{maxPrivateEntries:1}}),st=limited.prepare(sql).statement;
 try{let saved;await assert.rejects(st.step(),e=>{saved=e;return e.kind==='limit';});assert.throws(()=>st.reset(),e=>e===saved);}finally{st.finalize();limited.closeDeferred();}
});
