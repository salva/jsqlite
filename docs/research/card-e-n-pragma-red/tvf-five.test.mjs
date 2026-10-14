import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
const native=JSON.parse(readFileSync(new URL('./tvf-five-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
for(const image of native.encodings)for(const c of image.cases)test(`${image.encoding}: ${c.sql}`,async()=>{
 const bytes=Buffer.from(image.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,s;
 try{
  db=await open('https://example.test/tvf-bind');if(c.sql.includes('pragma_database_list')){const temp=db.prepare("SELECT * FROM pragma_index_list('t','temp')").statement;while(await temp.step()==='row'){}temp.finalize();}s=db.prepare(c.sql).statement;
  const metadata=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
  assert.equal(s.parameterCount,c.runs[0].bindings.length);
  for(const run of c.runs){
   run.bindings.forEach((v,i)=>s.bind(i+1,typeof v==='number'?BigInt(v):v));
   for(let repeat=0;repeat<2;repeat++){
    const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const v=s.column(i);return {type:v===null?5:typeof v==='bigint'?1:3,value:typeof v==='bigint'?String(v):v};}));
    assert.deepEqual(rows,c.sql.includes('pragma_database_list')?run.rows.map(row=>row.map((cell,i)=>i===2&&cell.value!==""?{...cell,value:""}:cell)):run.rows);s.reset();
   }
  }
  assert.deepEqual(metadata,c.metadata);
 }finally{try{s?.finalize();}finally{db?.close();globalThis.fetch=old;}}
});
