import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {startFixtureServer} from './fixture-server.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-d-ordered-native.json',import.meta.url)));
const root=new URL('../fixtures/',import.meta.url).pathname;
for(const entry of capture.cases)test(`ordered mixed JSON pinned ${entry.encoding} ${entry.id}`,async()=>{
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

// select.c:columnType and sqlite3GenerateColumnNames map XN_ROWID through
// iPKey; DESC inline PK (d) is not an alias, table-constraint PK (t) is.
// Expected metadata independently checked with the pinned library APIs.
for(const encoding of ['utf8','utf16le','utf16be'])test(`mixed JSON rowid metadata identity ${encoding}`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 for(const table of ['t1','d','t']){
  const path=table==='t1'?new URL(`../fixtures/generations/${generation}/generated/encoding-${encoding}.db`,import.meta.url):new URL(`./fixtures/row-width-ipk-${{utf8:'utf-8',utf16le:'utf-16le',utf16be:'utf-16be'}[encoding]}.db`,import.meta.url);
  const bytes=fs.readFileSync(path),old=globalThis.fetch;let db,s;
  try{
   globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/rowid');globalThis.fetch=old;
   s=db.prepare(`SELECT p.rowid,p._rowid_,p.oid,p.rowid AS named,p.rowid COLLATE BINARY,j.rowid,j.rowid COLLATE BINARY FROM ${table} p JOIN json_each('[1]') j`).statement;
   const origin=table==='t'?'id':'rowid';
   const physical={name:origin,declaredType:'INTEGER',database:'main',table,origin};
   const computed=name=>({name,declaredType:null,database:null,table:null,origin:null});
   const expected=[physical,physical,physical,{...physical,name:'named'},computed('p.rowid COLLATE BINARY'),{name:'rowid',declaredType:'INTEGER',database:'main',table:'json_each',origin:'rowid'},computed('j.rowid COLLATE BINARY')];
   for(let pass=0;pass<2;pass++){
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),expected);
    while(await s.step()==='row'){assert.equal(s.columnType(0),'integer');assert.equal(s.column(0),s.column(1));assert.equal(s.column(0),s.column(2));assert.equal(s.column(0),s.column(3));assert.equal(s.column(0),s.column(4));assert.equal(s.column(5),0n);assert.equal(s.column(6),0n);}
    if(!pass)s.reset();
   }
  }finally{globalThis.fetch=old;try{s?.finalize();}finally{db?.close();}}
 }
});
