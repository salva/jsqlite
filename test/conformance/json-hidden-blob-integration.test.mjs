import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {Mem} from '../../src/internal/mem.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-e-hidden-blob-native.json',import.meta.url)));
assert.equal(capture.version,3530400);
assert.equal(capture.sourceId,'2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc');
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
// Count actual production owning copies of the exact input payload. Calling
// original is essential: this is neither a copy bypass nor a total-heap census.
for(const entry of capture.cases)test(`hidden demand native payload ${entry.encoding}/${entry.storage}/${entry.module}/${entry.projection}`,async t=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/encoding-${entry.encoding}.db`,import.meta.url));
 const oldFetch=globalThis.fetch,original=Mem.prototype.copyFrom;
 let db,s,active=false,copies=0,copiedBytes=0;
 Mem.prototype.copyFrom=function(source){
  if(active&&source.initialStorageClass===entry.storage){
   const payload=entry.storage==='blob'?source.blobValue():source.textBytes();
   const matches=entry.storage==='blob'?Buffer.from(payload).toString('hex')===capture.blob:source.textValue()===capture.document;
   if(matches){copies++;copiedBytes+=payload.byteLength;}
  }
  return original.call(this,source);
 };
 try{
  globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/hidden-demand');globalThis.fetch=oldFetch;
  s=db.prepare(entry.sql).statement;
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),entry.columns);
  const retained=[];
  for(let pass=0;pass<2;pass++){
   copies=0;copiedBytes=0;const rows=[];active=true;
   try{while(await s.step()==='row'){
    rows.push(Array.from({length:s.columnCount},(_,i)=>{const type=s.columnType(i),value=s.column(i);if(type==='blob')retained.push([value,Buffer.from(value).toString('hex')]);return {type,value:type==='integer'?String(value):type==='blob'?Buffer.from(value).toString('hex'):value};}));
   }}finally{active=false;}
   assert.deepEqual(rows,entry.rows);
   const payloadBytes=entry.storage==='blob'?capture.blob.length/2:Buffer.byteLength(capture.document,'utf8');
   // Recursive visible value/star legitimately publishes the document container.
   const bound=entry.module.endsWith('tree')&&['value','*'].includes(entry.projection)?3:1;
   if(entry.projection==='json')assert.ok(copies>=rows.length,'demanded document must retain real owning copies');
   else assert.ok(copies<=bound,`${copies} document copies, expected <=${bound}`);
   assert.ok(copiedBytes>=copies*payloadBytes&&copiedBytes<=copies*payloadBytes*(entry.storage==='text'?2:1),'actual payload bytes (TEXT Mem may retain UTF-8 or database encoding)');
   t.diagnostic(`pass=${pass} rows=${rows.length} copies=${copies} payloadBytes=${payloadBytes} copiedBytes=${copiedBytes}`);
   s.reset();
   for(const [value,hex] of retained)assert.equal(Buffer.from(value).toString('hex'),hex,'public BLOB survives reset');
  }
  s.finalize();s=undefined;
  for(const [value,hex] of retained)assert.equal(Buffer.from(value).toString('hex'),hex,'public BLOB survives finalize');
 }finally{active=false;Mem.prototype.copyFrom=original;globalThis.fetch=oldFetch;try{s?.finalize()}catch{}db?.close();}
});
