import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('./tvf-order-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
function cell(v){if(v===null)return {type:'null'};if(typeof v==='bigint')return {type:'integer',value:String(v)};if(typeof v==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type:'real',ieee754be:b.toString('hex')};}if(typeof v==='string')return {type:'text',utf8Hex:Buffer.from(v).toString('hex')};return {type:'blob',hex:Buffer.from(v).toString('hex')}}

for(const image of native.encodings)for(const c of image.cases)test(image.encoding+' '+c.sql,async()=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 assert.equal(c.prepare,0);const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,s;
 try {db=await open('https://fixture.invalid/metadata-order');s=db.prepare(c.sql).statement;
 assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata);
 for(const expected of c.runs){assert.equal(expected.end,101);const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s.column(i))));assert.deepEqual(rows,expected.rows);s.reset();}
 }finally{try{s?.finalize();}finally{db?.close();globalThis.fetch=old;}}
});
