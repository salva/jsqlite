import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const oracle=JSON.parse(fs.readFileSync(new URL('../../docs/research/json-table-root/native.json',import.meta.url)));
for(const enc of ['UTF-8','UTF-16le','UTF-16be'])test(`jsonEachFilter document/root order ${enc}`,async()=>{
 const variants=oracle.variants.filter(v=>v.encoding===enc),bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${enc}-corrected.sqlite`,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),variants[0].fixtureSha256);
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/table-root');}finally{globalThis.fetch=prior;}
 const cell=(st,i)=>{const type=st.columnType(i),value=st.column(i);if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(value);return {type,ieee754be:b.toString('hex')};}if(type==='blob')return {type,hex:Buffer.from(value).toString('hex')};return {type,value};};
 try{
  for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree']){
   const st=db.prepare(`SELECT root,typeof(root),?2 FROM ${module}(?1,?2)`).statement;
   try{for(const root of [new Uint8Array(enc==='UTF-8'?[36]:enc==='UTF-16le'?[36,0]:[0,36]), '$\0ignored']){
    st.bind(1,'[1]');st.bind(2,root);assert.equal(await st.step(),'row');assert.equal(st.column(0),'$');assert.equal(st.column(1),'text');assert.deepEqual(st.column(2),root);st.reset();
   }}finally{st.finalize();}
  }
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
  PrivateStateByteBudget.prototype.replace=function(...args){budgets.add(this);return original.apply(this,args)};
  try{for(const mode of ['work','abort','deadline']){
   const st=db.prepare('SELECT value FROM json_each(?1,?2)').statement;
   try{st.bind(1,'['+'1,'.repeat(4096)+'1]');st.bind(2,123);
    const controller=new AbortController();controller.abort();let first;
    await assert.rejects(st.step(mode==='work'?{maxWorkUnits:20}:mode==='abort'?{signal:controller.signal}:{timeoutMs:0}),e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit')});
    assert.throws(()=>st.reset(),e=>e===first);for(const b of budgets)assert.equal(b.usedBytes,0);
    st.bind(1,null);assert.equal(await st.step(),'done');st.reset();
   }finally{st.finalize();}
  }}finally{PrivateStateByteBudget.prototype.replace=original;}
  for(const v of variants){const st=db.prepare(v.sql).statement;try{
   assert.deepEqual(v.columns.map((_,i)=>st.columnMetadata(i)),v.columns,v.sql);
   for(let run=0;run<2;run++){
    const rows=[];let error;
    try{while(await st.step()==='row')rows.push(v.columns.map((_,i)=>cell(st,i)));}catch(e){error=e;}
    assert.deepEqual(rows,v.rows,v.sql);
    if(v.error){assert.equal(error?.message,v.error,v.sql);assert.equal(error?.code,v.code,v.sql);await assert.rejects(st.step(),e=>e===error);assert.throws(()=>st.reset(),e=>e===error);}
    else{assert.equal(error,undefined,v.sql);assert.equal(await st.step(),'done');st.reset();}
   }
  }finally{st.finalize();}}
 }finally{db.close();}
});
