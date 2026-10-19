import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {open} from '../../src/index.ts';
const oracle=JSON.parse(fs.readFileSync(new URL('../../docs/research/json-parameters/native.json',import.meta.url)));
for(const v of oracle.variants)test(`final parameter carrier ${v.encoding}/${v.shape}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${v.encoding}-corrected.sqlite`,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),v.fixtureSha256);
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/parameters');}finally{globalThis.fetch=prior;}
 const cell=(st,i)=>{const type=st.columnType(i),value=st.column(i);if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(value);return {type,ieee754be:b.toString('hex')};}if(type==='blob')return {type,hex:Buffer.from(value).toString('hex')};return {type,value};};
 try{const st=db.prepare(v.sql).statement;try{
  assert.equal(st.parameterCount,v.count);assert.deepEqual(v.names.map((_,i)=>st.parameterName(i+1)),v.names);
  assert.deepEqual(v.columns.map((_,i)=>st.columnMetadata(i)),v.columns);
  assert.throws(()=>st.bind(v.count+1,'invalid'),e=>e.code===25);
  for(const run of v.runs){st.clearBindings();if(run.bindings)run.bindings.forEach((value,i)=>st.bind(i+1,value));const rows=[];while(await st.step()==='row')rows.push(v.columns.map((_,i)=>cell(st,i)));assert.deepEqual(rows,run.rows);assert.equal(await st.step(),'done');st.reset();}
 }finally{st.finalize();}}finally{db.close();}
});
