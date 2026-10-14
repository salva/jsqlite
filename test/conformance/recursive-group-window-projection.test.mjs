import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/recursive-group-window/native.json',import.meta.url)));
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
async function connection(encoding,options){
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-${encoding}.db`,import.meta.url));
 const prior=globalThis.fetch;try{globalThis.fetch=async()=>new Response(bytes);return await open('https://fixture.invalid/recursive-group-window',options);}finally{globalThis.fetch=prior;}
}
for(const encoding of ['utf8','utf16le','utf16be'])test(`generated recursive GROUP projection native parity ${encoding}`,async()=>{
 const db=await connection(encoding);try{
 for(const item of native.cases){const st=db.prepare(item.sql).statement;try{
  assert.equal(item.prepare,0);
  assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>{const m=st.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,database:m.database,table:m.table,origin:m.origin};}),item.columns);
  for(let pass=0;pass<3;pass++){
   const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>({type:st.columnType(i),value:st.column(i)})));
   assert.deepEqual(rows,item.rows.map(row=>row.map(v=>({...v,value:v.type==='integer'?BigInt(v.value):v.value}))));
   assert.equal(item.step,101);assert.equal(await st.step(),'done');if(pass<2)st.reset();
  }
 }finally{st.finalize();}}
 }finally{db.close();}
});
for(const encoding of ['utf8','utf16le','utf16be'])test(`recursive grouped Window private and operation controls ${encoding}`,async()=>{
 const sql=native.cases[0].sql;
 const limited=await connection(encoding,{limits:{maxPrivateEntries:1}});let st=limited.prepare(sql).statement,first;
 try{await assert.rejects(async()=>{while(await st.step()==='row'){}},e=>{first=e;return e.kind==='limit';});assert.throws(()=>st.reset(),e=>e===first);}finally{st.finalize();limited.closeDeferred();}
 const db=await connection(encoding);try{
 for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){
  st=db.prepare(sql).statement;try{await assert.rejects(st.step(options),e=>e.kind===kind);assert.throws(()=>st.reset(),e=>e.kind===kind);assert.equal(await st.step(),'row');}finally{st.finalize();}
 }
 }finally{db.close();}
});
// A timer queued before step must run while a large grouped producer drains,
// not after it publishes its first row. This uses the public scheduler path.
for(const encoding of ['utf8','utf16le','utf16be'])test(`recursive grouped Window timer yield and mid-step cancellation ${encoding}`,async()=>{
 const db=await connection(encoding);const sql=native.cases[0].sql.replace('a<7','a<20001');
 try{
  let st=db.prepare(sql).statement,heartbeat=false;
  let timer=setTimeout(()=>{heartbeat=true;},0);
  try{assert.equal(await st.step(),'row');assert.equal(heartbeat,true,'host timer ran before first grouped/window output');}finally{clearTimeout(timer);st.finalize();}
  st=db.prepare(sql).statement;const controller=new AbortController();let fired=false;
  timer=setTimeout(()=>{fired=true;controller.abort('during generated producer drain');},0);
  try{await assert.rejects(st.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.equal(fired,true);assert.throws(()=>st.reset(),e=>e.kind==='cancelled');assert.equal(await st.step(),'row');}finally{clearTimeout(timer);st.finalize();}
  st=db.prepare(sql).statement;
  try{await assert.rejects(st.step({timeoutMs:5}),e=>e.kind==='timeout');assert.throws(()=>st.reset(),e=>e.kind==='timeout');}finally{st.finalize();}
 }finally{db.close();}
});
