import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('./tvf-group-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
function cell(v){if(v===null)return {type:'null'};if(typeof v==='bigint')return {type:'integer',value:String(v)};if(typeof v==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type:'real',ieee754be:b.toString('hex')};}if(typeof v==='string')return {type:'text',utf8Hex:Buffer.from(v).toString('hex')};return {type:'blob',hex:Buffer.from(v).toString('hex')}}

for(const image of native.encodings)for(const c of image.cases)test(image.encoding+' '+c.sql,async()=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 if(c.prepare!==0){const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;try{db=await open('https://fixture.invalid/star-order');assert.throws(()=>db.prepare(c.sql));}finally{db?.close();globalThis.fetch=old;}return;}const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,s;
 try {db=await open('https://fixture.invalid/metadata-order');s=db.prepare(c.sql).statement;
 assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata);
 for(const expected of c.runs){assert.equal(expected.end,101);const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s.column(i))));assert.deepEqual(rows,expected.rows);s.reset();}
 }finally{try{s?.finalize();}finally{db?.close();globalThis.fetch=old;}}
});

for(const image of native.encodings)test(image.encoding+' physical identity payload and metadata identity boundary',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(image.base64,'base64'));let db,s;
 try{db=await open('https://fixture.invalid/group-identity');
 assert.throws(()=>db.prepare("SELECT p.rowid,count(*) FROM pragma_table_info('t') p GROUP BY p.rowid"),e=>e.kind==='unsupported');
 s=db.prepare("SELECT t.rowid,p.name,count(*) FROM t JOIN pragma_table_info(t.nm) p ON p.cid=0 GROUP BY t.rowid,p.name ORDER BY t.rowid").statement;
 const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));
 assert.deepEqual(rows,[[1n,'x',1n],[2n,'x',1n],[3n,'x',1n]]);
 }finally{s?.finalize();db?.close();globalThis.fetch=old;}
});
