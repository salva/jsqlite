import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const root=new URL('../../docs/research/json-mixed-using/',import.meta.url);
const cases=JSON.parse(fs.readFileSync(new URL('binding-native.json',root)));
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`mixed resolved binding and child results ${encoding}`,async()=>{
 const fetch=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(encoding+'.sqlite',root)));db=await open('https://fixture.invalid/binding');}finally{globalThis.fetch=fetch;}
 try{for(const c of cases.filter(c=>c.encoding===encoding)){
  if(c.prepare!==0){assert.throws(()=>db.prepare(c.sql),e=>e.message===c.error,c.sql);continue;}
  const s=db.prepare(c.sql).statement;
  try{assert.deepEqual(c.metadata.map((_,i)=>s.columnMetadata(i)),c.metadata,c.sql);
   for(let run=0;run<2;run++){const rows=[];while(await s.step()==='row')rows.push(c.metadata.map((_,i)=>{const type=s.columnType(i),v=s.column(i);return type==='null'?{type}:type==='text'?{type,utf8Hex:Buffer.from(v).toString('hex')}:type==='blob'?{type,hex:Buffer.from(v).toString('hex')}:{type,value:String(v)};}));assert.deepEqual(rows,c.rows,c.sql);s.reset();}
  }finally{s.finalize();}
 }}finally{db.close();}
});
