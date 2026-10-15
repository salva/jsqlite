import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('./tvf-hidden-group-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
function cell(v){if(v===null)return {type:'null'};if(typeof v==='bigint')return {type:'integer',value:String(v)};if(typeof v==='number'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type:'real',ieee754be:b.toString('hex')};}if(typeof v==='string')return {type:'text',utf8Hex:Buffer.from(v).toString('hex')};return {type:'blob',hex:Buffer.from(v).toString('hex')}}


const results=[];
for(const image of native.encodings)for(const c of image.cases){
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,s;
 const actual={sql:c.sql,encoding:image.encoding,runs:[]};
 try{db=await open('https://fixture.invalid/hidden-group');s=db.prepare(c.sql).statement;actual.metadata=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
 for(const expected of c.runs){const rows=[];let error=null;try{while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s.column(i))));}catch(e){error={message:e.message,code:e.code,kind:e.kind};}let reset=null;try{s.reset();}catch(e){reset={message:e.message,code:e.code,kind:e.kind};}actual.runs.push({rows,error,reset});}
 }catch(e){actual.prepareError={message:e.message,code:e.code,kind:e.kind};}finally{try{s?.finalize();}catch(e){actual.finalizeError={message:e.message,code:e.code,kind:e.kind};}db?.close();globalThis.fetch=old;}
 for(let i=0;i<c.runs.length;i++){const expected=c.runs[i],actualRun=actual.runs[i];if(expected.end!==101){assert.equal(actualRun.error?.code,expected.end);assert.equal(actualRun.error?.message,expected.error);assert.equal(actualRun.reset?.code,expected.reset);}}
 actual.match=!actual.prepareError&&JSON.stringify(actual.metadata)===JSON.stringify(c.metadata)&&actual.runs.every((r,i)=>JSON.stringify(r.rows)===JSON.stringify(c.runs[i].rows)&&Boolean(r.error)===(c.runs[i].end!==101));results.push(actual);
 console.log(JSON.stringify({encoding:image.encoding,sql:c.sql,match:actual.match,native:c.runs,actual:actual.runs}));
}

assert.equal(results.length,39);assert.equal(results.filter(r=>!r.match).length,0);console.log('PASS 39 native-backed cases, 78 replay runs');
