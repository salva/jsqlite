import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// window.c transfers original SrcList into its input coroutine. JSON xColumn
// values and independent xRowid must remain register-backed across each Yield.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])
for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree'])
test(`direct module Window ${encoding} ${module}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${encoding}-corrected.sqlite`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/direct-window');}finally{globalThis.fetch=prior;}
 try{
  const filter=module.endsWith('tree')?" WHERE type='integer'":'';
  const sql=`SELECT value,row_number() OVER (ORDER BY key) AS rn FROM ${module}('[10,20]')${filter} ORDER BY key`;
  const st=db.prepare(sql).statement;
  try{
   assert.deepEqual(Array.from({length:2},(_,i)=>st.columnMetadata(i)),[
    {name:'value',declaredType:null,database:'main',table:module,origin:'value'},
    {name:'rn',declaredType:null,database:null,table:null,origin:null},
   ]);
   for(let pass=0;pass<3;pass++){
    const rows=[];while(await st.step()==='row'){
     assert.equal(st.columnType(0),'integer');assert.equal(st.columnType(1),'integer');
     rows.push([st.column(0),st.column(1)]);
    }
    assert.deepEqual(rows,[[10n,1n],[20n,2n]]);if(pass<2)st.reset();
   }
  }finally{st.finalize();}
  const hidden=db.prepare(`SELECT json,root,rowid,row_number() OVER (ORDER BY key) AS rn FROM ${module}('[10,20]')${filter} ORDER BY key`).statement;
  try{let count=0;while(await hidden.step()==='row'){assert.equal(hidden.column(0),'[10,20]');assert.equal(hidden.column(1),'$');assert.equal(hidden.columnType(2),'integer');count++;}assert.equal(count,2);}finally{hidden.finalize();}
 }finally{db.close();}
});
