import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import test from 'node:test';
import {open} from '../../src/index.ts';
const root=new URL('../../docs/research/json-mixed-using/',import.meta.url);
const native=JSON.parse(fs.readFileSync(new URL('expanded.json',root)));
const cell=(s,i)=>{const type=s.columnType(i),v=s.column(i);return type==='null'?{type}:type==='text'?{type,utf8Hex:Buffer.from(v).toString('hex')}:type==='blob'?{type,hex:Buffer.from(v).toString('hex')}:{type,value:String(v)};};
for(const e of native.encodings)test(`mixed USING/NATURAL pinned typed metadata reset ${e.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(e.file,root));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);
 const fetch=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/mixed');}finally{globalThis.fetch=fetch;}
 try{for(const c of e.cases){if(c.prepare!==0){assert.throws(()=>db.prepare(c.sql),error=>error.kind==='sqlite'&&error.message===c.error,c.sql);continue;}const s=db.prepare(c.sql).statement;try{assert.deepEqual(c.metadata.map((_,i)=>s.columnMetadata(i)),c.metadata);for(const run of c.runs){const rows=[];while(await s.step()==='row')rows.push(c.metadata.map((_,i)=>cell(s,i)));assert.deepEqual(rows,run.rows);s.reset();}}finally{s.finalize();}}}finally{db.close();}
});
