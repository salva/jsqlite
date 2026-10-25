import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';

// pragma.c pragmaVtabFilter prepares the same INDEX_INFO command. Exercise both
// public consumers of that production against the retained pinned module rows.
const native=JSON.parse(readFileSync(new URL('../../docs/research/card-e-n-pragma-red/tvf-five-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
for(const image of native.encodings)test(`INDEX_INFO direct/module shared production ${image.encoding}`,async()=>{
 const bytes=Buffer.from(image.base64,'base64');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),image.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);
 const db=await openFixture(new Request('https://fixture.invalid/index-info'));
 try{
  for(const c of image.cases){
   const match=/^SELECT \* FROM pragma_(index_info|index_xinfo)\(\?1,\?2\)$/.exec(c.sql);
   if(!match)continue;
   for(const run of c.runs){
    const [arg,schema]=run.bindings;
    const quote=value=>`'${value.replaceAll("'","''")}'`;
    const direct=`PRAGMA ${schema===null?'':quote(schema)+'.'}${match[1]}=${quote(arg)}`;
    for(const sql of [direct,c.sql]){
     const s=db.prepare(sql).statement;
     try{
      if(sql===c.sql)run.bindings.forEach((v,i)=>s.bind(i+1,v));
      assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),sql===c.sql?c.metadata:c.metadata.map(m=>({...m,declaredType:null,database:null,table:null,origin:null})));
      for(let repeat=0;repeat<2;repeat++){
       const rows=[];
       while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
        const v=s.column(i);return {type:{integer:1,real:2,text:3,blob:4,null:5}[s.columnType(i)],value:typeof v==='bigint'?String(v):v};
       }));
       assert.deepEqual(rows,run.rows,sql);s.reset();
      }
     }finally{s.finalize();}
    }
   }
  }
 }finally{db.close();globalThis.fetch=old;}
});
