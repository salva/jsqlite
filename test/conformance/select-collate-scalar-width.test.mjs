import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
// Native-first: select-collate-scalar-width-native.py, pinned SourceID.
const valid=['SELECT (SELECT 1) COLLATE binary','SELECT abs((SELECT 1))','SELECT ((SELECT 1))','SELECT (SELECT 1,2)=(1,2)','SELECT 1 IN (SELECT 1)','SELECT (SELECT ?1) COLLATE binary AS v','SELECT abs((SELECT ?1) COLLATE binary) AS v'];
const invalid=['SELECT (SELECT 1,2) COLLATE binary','SELECT abs((SELECT 1,2))','SELECT ((SELECT 1,2))'];
for(const encoding of ['utf8','utf16le','utf16be'])test(`scalar width callback ownership ${encoding}`,async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/scalar-width');}finally{globalThis.fetch=old;}
 try{
  for(const sql of valid){
   const s=db.prepare(sql).statement;
   try{
    assert.equal(s.columnCount,1);
    assert.deepEqual(s.columnMetadata(0),{name:sql.includes('?1')?'v':sql.slice(7),declaredType:null,database:null,table:null,origin:null});
    for(const value of [1n,7n]){
     if(sql.includes('?1'))s.bind(1,value);
     assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'integer');
     assert.equal(s.column(0),sql.includes('?1')?value:1n);
     assert.equal(await s.step(),'done');s.reset();
    }
   }finally{s.finalize();}
  }
  for(const sql of invalid)assert.throws(()=>db.prepare(sql),e=>e.code===1&&e.message==='sub-select returns 2 columns - expected 1');
 }finally{db.close();}
});
