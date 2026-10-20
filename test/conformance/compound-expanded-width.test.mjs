import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {open} from '../../src/index.ts';
const fixtures=JSON.parse(readFileSync(new URL('../../docs/research/join-retained-compound-native.json',import.meta.url)));
const native=JSON.parse(readFileSync(new URL('../../docs/research/compound-expanded-width-native.json',import.meta.url)));
for(const [index,variant] of native.encodings.entries())test(`${variant.encoding}: expanded retained JOIN compound widths, metadata, errors and reset`,async()=>{
 assert.equal(native.sourceId,fixtures.sourceId);assert.equal(variant.fixtureSha256,fixtures.encodings[index].sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(fixtures.encodings[index].base64,'base64'));let db;
 try{
  db=await open('https://fixture.invalid/expanded-compound-width');
  for(const item of variant.cases){
   if(item.prepare!==0){for(let i=0;i<2;i++)assert.throws(()=>db.prepare(item.sql),e=>e.kind==='sqlite'&&e.message===item.error,item.sql);continue;}
   const s=db.prepare(item.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),item.metadata,item.sql);
    for(const run of item.runs){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
     const type=s.columnType(i),value=s.column(i);
     if(type==='integer')return {type,value:String(value)};
     if(type==='text')return {type,utf8Hex:Buffer.from(value).toString('hex')};
     throw new Error('unexpected fixture storage class '+type);
    }));assert.equal(run.end,101);assert.deepEqual(rows,run.rows,item.sql);s.reset();}
   }finally{s.finalize();}
  }
  const recovery=db.prepare('SELECT 1').statement;try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);assert.equal(await recovery.step(),'done');}finally{recovery.finalize();}
 }finally{db?.closeDeferred();globalThis.fetch=previous;}
});
