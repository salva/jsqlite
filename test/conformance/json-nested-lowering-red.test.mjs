import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {open} from '../../src/index.ts';
const oracle=JSON.parse(fs.readFileSync(new URL('../../docs/research/json-result-metadata/native.json',import.meta.url)));
for(const variant of oracle.variants.filter(v=>['nested-aggregate','subquery'].includes(v.shape)))test(`native JSON result metadata ${variant.encoding}/${variant.module}/${variant.shape}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${variant.encoding}-corrected.sqlite`,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),variant.fixtureSha256);
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/native-direct-window');}finally{globalThis.fetch=prior;}
 const cell=(st,i)=>{
  const type=st.columnType(i),value=st.column(i);
  if(type==='null')return {type};
  if(type==='integer')return {type,value:String(value)};
  if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(value);return {type,ieee754be:b.toString('hex')};}
  if(type==='blob')return {type,hex:Buffer.from(value).toString('hex')};
  return {type,value};
 };
 try{const st=db.prepare(variant.sql).statement;try{
  assert.deepEqual(variant.columns.map((_,i)=>st.columnMetadata(i)),variant.columns);
  for(let pass=0;pass<variant.runs.length;pass++){
   const rows=[];while(await st.step()==='row')rows.push(variant.columns.map((_,i)=>cell(st,i)));
   assert.deepEqual(rows,variant.runs[pass]);if(pass<variant.runs.length-1)st.reset();
  }
 }finally{st.finalize();}}finally{db.close();}
});
