import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {open} from '../../../src/index.ts';
const native=JSON.parse(await readFile(new URL('./native.json',import.meta.url),'utf8'));
let gaps=0;
for(const image of native.encodings){
 const bytes=await readFile(image.image),oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response(bytes);
 const db=await open('https://example.test/pragma-red.db');
 try{
  // Prove that the immutable image and normal public schema pipeline work.
  const control=await db.prepare('SELECT a FROM t');
  assert.equal(await control.statement.step(),'done');control.statement.finalize();
  for(const expected of image.cases){
   try{
    const prepared=await db.prepare(expected.sql);
    console.log(JSON.stringify({encoding:image.encoding,sql:expected.sql,prepared:true,tail:prepared.tail}));
    prepared.statement?.finalize();
   }catch(e){
    console.log(JSON.stringify({encoding:image.encoding,sql:expected.sql,kind:e.kind,classification:e.unsupportedClassification,code:e.code,message:e.message,nativePrepareCode:expected.prepareCode,nativeRows:expected.rows?.length}));
    if(expected.prepareCode===0)gaps++;
   }
  }
 }finally{db.close();globalThis.fetch=oldFetch;}
}
console.log(`Reproduced ${gaps} rejected native-success metadata prepares.`);
assert.equal(gaps,0,'read-only metadata PRAGMA public acceptance gap');
