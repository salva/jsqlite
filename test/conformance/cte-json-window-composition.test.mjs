import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Pinned 3.53.4 root beta capture: original SQL, typed rows and all five
// metadata fields. Fixture identities are verified before public execution.
const sql='WITH c AS (SELECT t.x,j.value FROM t JOIN json_each(t.js) j) SELECT x,value,row_number() OVER (PARTITION BY x ORDER BY value) AS rn FROM c ORDER BY x,value';
const columns=[
 {name:'x',declaredType:'INTEGER',database:'main',table:'t',origin:'x'},
 {name:'value',declaredType:null,database:'main',table:'json_each',origin:'value'},
 {name:'rn',declaredType:null,database:null,table:null,origin:null},
];
const expected=[[1n,10n,1n],[1n,11n,2n],[2n,20n,1n]];
async function connection(encoding,options){
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${encoding}-corrected.sqlite`,import.meta.url));
 const prior=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(bytes);return await open('https://fixture.invalid/cte-json-window',options);}finally{globalThis.fetch=prior;}
}
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`retained CTE module Window typed metadata/reset ${encoding}`,async()=>{
 const db=await connection(encoding);let st;
 try{
  st=db.prepare(sql).statement;
  assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),columns);
  for(let pass=0;pass<3;pass++){
   const rows=[];
   while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{assert.equal(st.columnType(i),'integer');return st.column(i);}));
   assert.deepEqual(rows,expected);assert.equal(await st.step(),'done');if(pass<2)st.reset();
  }
 }finally{st?.finalize();db.close();}
});
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`retained CTE module Window operation controls ${encoding}`,async()=>{
 const limited=await connection(encoding,{limits:{maxPrivateEntries:1}});let st=limited.prepare(sql).statement;
 try{let saved;await assert.rejects(async()=>{while(await st.step()==='row'){}},e=>{saved=e;return e.kind==='limit';});assert.throws(()=>st.reset(),e=>e===saved);}finally{st.finalize();limited.closeDeferred();}
 const db=await connection(encoding);
 try{
  for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){
   st=db.prepare(sql).statement;
   try{await assert.rejects(st.step(options),e=>e.kind===kind);assert.throws(()=>st.reset(),e=>e.kind===kind);assert.equal(await st.step(),'row');}finally{st.finalize();}
  }
 }finally{db.close();}
});
