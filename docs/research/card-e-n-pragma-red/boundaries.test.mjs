import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {open} from '../../../src/index.ts';

const receipt=JSON.parse(readFileSync(new URL('./boundaries-native.json',import.meta.url)));
assert.equal(receipt.sourceId,JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
const expectedRows=c=>c.rows.map(row=>row.map(v=>({type:v.type,value:v.type==='integer'?BigInt(v.value):v.type==='text'?Buffer.from(v.utf8Hex,'hex').toString('utf8'):null})));
async function rows(s){const result=[];while(await s.step()==='row')result.push(Array.from({length:s.columnCount},(_,i)=>({type:s.columnType(i),value:s.column(i)})));return result;}
const limit=e=>e.kind==='limit';
for(const image of receipt.images){
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 async function connection(limits={}){globalThis.fetch=async()=>new Response(bytes);return open('https://example.test/pragma-boundaries',{limits});}
 test(`${image.encoding}: duplicate constraint metadata follows native merge/order`,async()=>{
  const old=globalThis.fetch,db=await connection();
  try{for(const c of receipt.cases.filter(c=>c.encoding===image.encoding)){
   const p=db.prepare(c.sql+'; SELECT 7'),s=p.statement;assert.equal(p.tail,' SELECT 7');assert.equal(s.parameterCount,0);
   try{assert.deepEqual(await rows(s),expectedRows(c),c.sql);s.reset();assert.deepEqual(await rows(s),expectedRows(c),c.sql);}finally{s.finalize();}
  }}finally{db.close();globalThis.fetch=old;}
 });
 for(const [label,limits,rowCount,options] of [
  ['row',{maxRows:1},1,undefined],['scalar-byte',{maxResultBytes:1},0,undefined],
  ['operation-work',{},0,{maxWorkUnits:1}],
 ])test(`${image.encoding}: PRAGMA ${label} limit resets saved error and releases BUSY`,async()=>{
  const old=globalThis.fetch,db=await connection(limits);let s;
  try{
   s=db.prepare('PRAGMA table_info(duplicate)').statement;let count=0;
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
   for(const [sql,message] of [['PRAGMA table_info(?)','near "?": syntax error'],['PRAGMA other.journal_mode=WAL','unknown database other']])assert.throws(()=>db.prepare(sql),e=>e.kind==='sqlite'&&e.code===1&&e.message===message);
   const s=db.prepare('PRAGMA index_list(duplicate)').statement;try{assert.deepEqual(await rows(s),expectedRows(receipt.cases.find(c=>c.encoding===image.encoding&&c.sql==='PRAGMA index_list(duplicate)')));}finally{s.finalize();}
  }finally{db.close();globalThis.fetch=old;}
 });
}
