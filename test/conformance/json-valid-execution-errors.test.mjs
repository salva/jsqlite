import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {Mem} from '../../src/internal/mem.ts';
import {jsonValid,parseJsonMem} from '../../src/internal/json.ts';
import {open} from '../../src/index.ts';

// jsonValidFunc: syntax nErr is false; execution/OOM is not syntax failure.
test('json_valid preserves non-syntax callback failures by identity',()=>{
 for(const blob of [false,true])for(const flags of [1,2,3,15]){
  const value=new Mem(),bytes=new TextEncoder().encode('[1]');
  if(blob)value.setBlob(bytes);else value.setText(bytes,'utf-8');
  try{
   for(const failure of [Object.assign(new Error('work'),{kind:'limit'}),Object.assign(new Error('abort'),{kind:'cancelled'}),Object.assign(new Error('deadline'),{kind:'timeout'}),new Error('internal'),new TypeError('malformed JSON'),{unclassified:true},null]){
    let calls=0;const charge=()=>{calls++;throw failure};
    assert.throws(()=>jsonValid(value,flags,charge),e=>e===failure);assert.equal(calls,1);
    assert.throws(()=>parseJsonMem(value,true,charge),e=>e===failure);
   }
  }finally{value.release()}
 }
});

test('json_valid syntax false and dispatch/flags ordering survive narrowing',()=>{
 const value=new Mem();
 try{
  for(const input of ['[','[1,','{"a":}', 'undefined'])for(const flags of [1,2,3,15]){
   value.setText(new TextEncoder().encode(input),'utf-8');assert.equal(jsonValid(value,flags),false);
  }
  value.setText(new TextEncoder().encode('{a:1}'),'utf-8');assert.equal(jsonValid(value,1),false);assert.equal(jsonValid(value,2),true);
  value.setNull();assert.throws(()=>jsonValid(value,0),/FLAGS/);assert.equal(jsonValid(value,1),null);
  value.setText(new TextEncoder().encode('[1]'),'utf-8');assert.equal(jsonValid(value,4,()=>{throw new Error('unreached')}),false);
 }finally{value.release()}
});

const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
for(const encoding of ['utf8','utf16le','utf16be'])test(`public json_valid resource error latch/reset/recovery ${encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/encoding-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/json-valid-errors')}finally{globalThis.fetch=old}
 const s=db.prepare('SELECT json_valid(?1,1)').statement;
 try{
  for(const mode of ['work','abort','deadline']){
   s.bind(1,'['+'1,'.repeat(2048)+'1]');const controller=new AbortController();controller.abort();
   const options=mode==='work'?{maxWorkUnits:64}:mode==='abort'?{signal:controller.signal}:{timeoutMs:0};
   let first;await assert.rejects(s.step(options),e=>{first=e;return e.kind===(mode==='work'?'limit':mode==='abort'?'cancelled':'timeout')});
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
   s.bind(1,'[1]');assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'integer');assert.equal(s.column(0),1n);assert.equal(await s.step(),'done');s.reset();
   s.bind(1,'[');assert.equal(await s.step(),'row');assert.equal(s.column(0),0n);assert.equal(await s.step(),'done');s.reset();
  }
 }finally{s.finalize();db.close()}
});
