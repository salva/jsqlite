import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
// Pinned 3.53.4 whereexpr.c:exprSelectUsage / wherecode.c ready-level second
// pass. Native prepare=0, DONE=101/reset=0 for false physical/constant
// children; module-dependent children step/reset/finalize=1 malformed JSON.
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
for(const encoding of ['utf8','utf16le','utf16be'])for(const predicate of ['t.rowid<0','(SELECT t.rowid)<0','(SELECT (SELECT t.rowid))<0','(SELECT 1)<0','(SELECT j.value)<0','(SELECT value)<0'])test(`linked child readiness ${encoding} ${predicate}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/encoding-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db,s;
 try{
  globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/child-readiness');globalThis.fetch=old;
  s=db.prepare(`SELECT t.rowid,j.value FROM t1 t JOIN json_each('bad') j WHERE ${predicate}`).statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),[
   {name:'rowid',declaredType:'INTEGER',database:'main',table:'t1',origin:'rowid'},
   {name:'value',declaredType:null,database:'main',table:'json_each',origin:'value'},
  ]);
  if(predicate.includes('value')){
   let saved;await assert.rejects(s.step(),e=>{saved=e;return e.kind==='sqlite'&&e.code===1&&e.message==='malformed JSON'});
   assert.throws(()=>s.reset(),e=>e===saved);
   await assert.rejects(s.step(),e=>e.kind==='sqlite'&&e.code===1&&e.message==='malformed JSON');
   assert.throws(()=>s.finalize(),e=>e.kind==='sqlite'&&e.code===1);s=undefined;
  }else{
   assert.equal(await s.step(),'done');s.reset();assert.equal(await s.step(),'done');s.finalize();s=undefined;
  }
 }finally{globalThis.fetch=old;try{s?.finalize()}catch{}if(db)await db.close()}
});
