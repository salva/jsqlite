import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';

// Independent pinned oracle receipt captured before this correction. Keep its
// source identity, image hashes, typed cells and complete metadata unchanged.
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/tvf-group-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
function cell(value){
 if(value===null)return {type:'null'};
 if(typeof value==='bigint')return {type:'integer',value:String(value)};
 if(typeof value==='number'){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return {type:'real',ieee754be:bytes.toString('hex')};}
 if(typeof value==='string')return {type:'text',utf8Hex:Buffer.from(value).toString('hex')};
 return {type:'blob',hex:Buffer.from(value).toString('hex')};
}
for(const image of native.encodings)test(`${image.encoding}: module producer preserves aggregate destination and reset`,async()=>{
 const bytes=Buffer.from(image.base64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{
  db=await open('https://fixture.invalid/metadata-destination');
  // Includes the exact name/count GROUP reproducer, SUM/HAVING, hidden arg,
  // empty source, correlated join, physical identity and ordinary ORDER.
  for(const expected of image.cases){
   assert.equal(expected.prepare,0);
   const statement=db.prepare(expected.sql).statement;
   try{
    assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i)),expected.metadata);
    for(const run of expected.runs){
     const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>cell(statement.column(i))));
     assert.equal(run.end,101);assert.deepEqual(rows,run.rows,expected.sql);statement.reset();
    }
   }finally{statement.finalize();}
  }
 }finally{db?.close();globalThis.fetch=previous;}
});
