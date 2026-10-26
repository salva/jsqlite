import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
// Native-first: select-review32-boundaries-native.py (pinned SourceID).
const cases=[
 ['case-children',"SELECT d.v,d.r FROM (SELECT CASE WHEN a=1 THEN a WHEN a=3 THEN NULL ELSE a+0.5 END AS v,row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.r",[[['integer','1'],['integer','1']],[['null',null],['integer','2']],[['real',5.5],['integer','3']],[['real',7.5],['integer','4']]]],
 ['mixed-window',"SELECT d.v,d.r FROM (SELECT CASE a WHEN 1 THEN NULL WHEN 3 THEN x'00ff' WHEN 5 THEN 2.5 ELSE 'z' END AS v,row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.v",[[['null',null],['integer','1']],[['real',2.5],['integer','3']],[['text','z'],['integer','4']],[['blob',[0,255]],['integer','2']]]],
 ['scalar','SELECT t.a,(SELECT u.a FROM t1 u WHERE u.a<t.a ORDER BY u.a DESC LIMIT 1) AS x,(SELECT u.a FROM t1 u WHERE u.a<t.a ORDER BY u.a DESC LIMIT 1) AS y FROM t1 t ORDER BY t.a',[1,3,5,7].map((a,i)=>[['integer',String(a)],i?['integer',String([1,3,5][i-1])]:['null',null],i?['integer',String([1,3,5][i-1])]:['null',null]])],
 ['exists','SELECT t.a,EXISTS(SELECT 1 FROM t1 u WHERE u.a<t.a) AS x,EXISTS(SELECT 1 FROM t1 u WHERE u.a<t.a) AS y FROM t1 t ORDER BY t.a',[1,3,5,7].map((a,i)=>[['integer',String(a)],['integer',i?'1':'0'],['integer',i?'1':'0']])],
 ['in','SELECT t.a,t.a IN (SELECT u.a FROM t1 u WHERE u.a<t.a) AS x,t.a IN (SELECT u.a FROM t1 u WHERE u.a<t.a) AS y FROM t1 t ORDER BY t.a',[1,3,5,7].map(a=>[['integer',String(a)],['integer','0'],['integer','0']])],
];
for(const encoding of ['utf8','utf16le','utf16be'])for(const [name,sql,want] of cases)test(`review32 ${encoding} ${name}`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-${encoding}.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/subquery');}finally{globalThis.fetch=original;}
 try{
  const stmt=db.prepare(sql).statement;
  try{
   const column=(name,physical)=>({name,declaredType:physical?'INTEGER':null,database:physical?'main':null,table:physical?'t1':null,origin:physical?'a':null});
   const metadata=(name==='mixed-window'||name==='case-children')?[column('v',false),column('r',false)]:[column('a',true),column('x',name==='scalar'),column('y',name==='scalar')];
   assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i)),metadata);
   for(let cycle=0;cycle<2;cycle++){
    const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>{const v=stmt.column(i);return [stmt.columnType(i),typeof v==='bigint'?String(v):v instanceof Uint8Array?Array.from(v):v];}));
    assert.deepEqual(rows,want);stmt.reset();
   }
  }finally{stmt.finalize();}
 }finally{db.close();}
});
