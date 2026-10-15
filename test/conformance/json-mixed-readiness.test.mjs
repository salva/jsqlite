import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-d-readiness-native.json',import.meta.url)));
for(const entry of capture.cases)test(`readiness mixed JSON pinned ${entry.encoding} ${entry.id}`,async()=>{
 const encoding=entry.encoding;
 const fixture=entry.physical==='nonipk'?`encoding-${encoding}`:`row-width-ipk-${{utf8:'utf-8',utf16le:'utf-16le',utf16be:'utf-16be'}[encoding]}`;
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const fixturePath=entry.physical==='nonipk'?new URL(`../fixtures/generations/${generation}/generated/${fixture}.db`,import.meta.url):new URL(`./fixtures/${fixture}.db`,import.meta.url);
 const bytes=fs.readFileSync(fixturePath);let db;const old=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/rowid');globalThis.fetch=old;
 {
  let s;try{
   s=db.prepare(entry.sql).statement;
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),entry.columns,entry.id+' metadata');
   for(let pass=0;pass<2;pass++){
    const rows=[];
    if(entry.error){let first;await assert.rejects(s.step(),e=>{first=e;return e.kind==='sqlite'&&e.code===entry.error.code&&e.message===entry.error.message});assert.throws(()=>s.reset(),e=>e===first);assert.equal(entry.resetCode,entry.error.code);assert.equal(entry.repeatEndCode,entry.error.code);assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),entry.columns);continue;}
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const type=s.columnType(i),value=s.column(i);return{type,value:type==='integer'?String(value):type==='blob'?Buffer.from(value).toString('hex'):value}}));
    assert.deepEqual(rows,entry.rows,entry.id);assert.equal(entry.repeatEndCode,101);if(!pass){s.reset();assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),entry.columns);}
   }
  }finally{s?.finalize();}
 }
 }finally{globalThis.fetch=old;db?.close();}
});
