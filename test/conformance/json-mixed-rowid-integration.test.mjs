import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-e-review27-rowid-native.json',import.meta.url)));
const root=new URL('../fixtures/',import.meta.url).pathname;
for(const entry of capture.cases)test(`review27 rowid pinned ${entry.encoding} ${entry.id}`,async()=>{
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
    if(entry.error){let first;await assert.rejects(s.step(),e=>{first=e;return e.kind==='sqlite'&&e.code===entry.error.code&&e.message===entry.error.message});assert.throws(()=>s.reset(),e=>e===first);break;}
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const type=s.columnType(i),value=s.column(i);return{type,value:type==='integer'?String(value):type==='blob'?Buffer.from(value).toString('hex'):value}}));
    assert.deepEqual(rows,entry.rows,entry.id);if(!pass)s.reset();
   }
  }finally{s?.finalize();}
 }
 }finally{globalThis.fetch=old;db?.close();}
});
