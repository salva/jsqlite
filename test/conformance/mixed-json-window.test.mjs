import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// select.c rewrites Window before choosing the ordinary physical/module shortcut.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])
for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree'])
for(const binary of [false,true])
test(`mixed Window ${encoding} ${module} ${binary?'JSONB':'TEXT'}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/cte-module-owner/${encoding}-corrected.sqlite`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/mixed-window');}finally{globalThis.fetch=prior;}
 try{
  const input=binary?"jsonb('[1,2]')":"'[1,2]'";
  const predicate=module.endsWith('tree')?" WHERE j.type='integer'":'';
  const sql=`SELECT s.name,j.value,sum(j.value) OVER () AS total FROM sqlite_schema s JOIN ${module}(${input}) j${predicate} ORDER BY s.name,j.key`;
  const names=db.prepare('SELECT name FROM sqlite_schema ORDER BY name').statement;
  const schema=[];try{while(await names.step()==='row')schema.push(names.column(0));}finally{names.finalize();}
  assert.ok(schema.length>0,'nonempty physical fixture');
  const st=db.prepare(sql).statement;
  try{
   assert.deepEqual([0,1,2].map(i=>st.columnMetadata(i)),[
    {name:'name',declaredType:'TEXT',database:'main',table:'sqlite_master',origin:'name'},
    {name:'value',declaredType:null,database:'main',table:module,origin:'value'},
    {name:'total',declaredType:null,database:null,table:null,origin:null},
   ]);
   for(let pass=0;pass<2;pass++){
    const rows=[];while(await st.step()==='row'){
     assert.deepEqual([0,1,2].map(i=>st.columnType(i)),['text','integer','integer']);
     rows.push([st.column(0),st.column(1),st.column(2)]);
    }
    assert.deepEqual(rows,schema.flatMap(name=>[[name,1n,BigInt(schema.length)*3n],[name,2n,BigInt(schema.length)*3n]]));
    st.reset();
   }
  }finally{st.finalize();}
 }finally{db.close();}
});
