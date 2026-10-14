import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {open}=await import(pathToFileURL(process.argv[2]||new URL('../../../src/index.ts',import.meta.url).pathname));
const native=JSON.parse(readFileSync(new URL('./tvf-r1-native.json',import.meta.url)));
let mismatch=0,match=0,reject=0; const samples=[];
for(const image of native.encodings){
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://example.test/r1');
 for(const c of image.cases){let s;
 try{s=db.prepare(c.sql).statement;
 for(const run of c.runs){run.bindings.forEach((v,i)=>s.bind(i+1,v));for(let replay=0;replay<2;replay++){
 const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const v=s.column(i);return {type:v===null?5:typeof v==='bigint'?1:3,value:typeof v==='bigint'?String(v):v};}));
 try{assert.deepEqual(rows,run.rows);match++;}catch{mismatch++;if(samples.length<5)samples.push({encoding:image.encoding,sql:c.sql,binding:run.bindings,expected:run.rows,actual:rows});}s.reset();}}
 }catch(error){reject++;if(samples.length<5)samples.push({sql:c.sql,error: String(error),kind:error.kind});}finally{s?.finalize();}}
 }finally{db?.close();globalThis.fetch=old;}}
console.log(JSON.stringify({match,mismatch,reject,samples},null,2));if(mismatch)process.exitCode=1;
