import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {open} from '../../../src/index.ts';

const receipt=JSON.parse(readFileSync(new URL('./tvf-native.json',import.meta.url)));
async function rows(s){const result=[];while(await s.step()==='row')result.push(Array.from({length:s.columnCount},(_,i)=>({type:s.columnType(i),value:s.column(i)})));return result;}
const limit=e=>e.kind==='limit';
for(const image of receipt.encodings){
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 async function connection(limits={}){globalThis.fetch=async()=>new Response(bytes);return open('https://example.test/view-boundaries',{limits});}
 for(const [label,limits,rowCount,options] of [
  ['row',{maxRows:1},1,undefined],['scalar-byte',{maxResultBytes:1},0,undefined],
  ['operation-work',{},0,{maxWorkUnits:1}],
 ])test(`${image.encoding}: metadata TVF ${label} limit resets saved error and releases BUSY`,async()=>{
  const old=globalThis.fetch,db=await connection(limits);let s;
  try{
   s=db.prepare("SELECT * FROM pragma_table_xinfo('v')").statement;let count=0;
   await assert.rejects(async()=>{while(await s.step(options)==='row')count++;},limit);assert.equal(count,rowCount);
   // Reset reports prior error but restores READY before throwing.
   assert.throws(()=>s.reset(),limit);
   count=0;await assert.rejects(async()=>{while(await s.step(options)==='row')count++;},limit);assert.equal(count,rowCount);
   assert.throws(()=>s.finalize(),limit);s=null;
   const recovery=db.prepare('SELECT 7').statement;
   try{assert.deepEqual(await rows(recovery),[[{type:'integer',value:7n}]]);}finally{recovery.finalize();}
  }finally{if(s){try{s.finalize();}catch(e){if(!limit(e))throw e;}}db.close();globalThis.fetch=old;}
 });
 test(`${image.encoding}: argument/schema errors leave no statement or BUSY ownership`,async()=>{
  const old=globalThis.fetch,db=await connection();
  try{
   for(const c of image.cases.filter(c=>c.prepareCode!==0))assert.throws(()=>db.prepare(c.sql),e=>e.kind==='sqlite'&&e.code===1&&e.message===c.error);
   const s=db.prepare('PRAGMA table_info(v)').statement;try{assert.equal((await rows(s)).length,6);}finally{s.finalize();}
  }finally{db.close();globalThis.fetch=old;}
 });
}
