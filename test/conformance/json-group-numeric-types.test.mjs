import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Pinned source-ID checked native capture BEFORE edits:
// card-t-c/json-group-semantic-repair/native-controls.log; json.c xColumn,
// vdbe.c sqlite3_value_numeric_type and func.c sumStep/sumFinalize.
test('JSON type labels and aggregate numeric classification preserve storage classes',async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/empty.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/empty');}finally{globalThis.fetch=original;}
 const T=x=>['text',x],I=x=>['integer',BigInt(x)],R=x=>['real',x],N=['null',null];
 try{
  const s=db.prepare('SELECT type,count(*),sum(atom) FROM json_each(?1) GROUP BY type').statement;
  try{
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name),['type','count(*)','sum(atom)']);
   for(const [input,want] of [
    ['[1,2,"x",4]',[[T('integer'),I(3),I(7)],[T('text'),I(1),R(0)]]],
    ['["2","2.0","2e0","x",null]',[[T('null'),I(1),N],[T('text'),I(4),R(6)]]],
    ['[null]',[[T('null'),I(1),N]]],['[]',[]],
    ['[true,false,1.5]',[[T('false'),I(1),I(0)],[T('real'),I(1),R(1.5)],[T('true'),I(1),I(1)]]],
   ])for(let cycle=0;cycle<2;cycle++){
    s.bind(1,input);const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));
    assert.deepEqual(rows,want);s.reset();
   }
  }finally{s.finalize();}
  for(const [sql,want] of [
   ["SELECT sum(x),total(x),avg(x) FROM (SELECT 'x' AS x UNION ALL SELECT 2)",[[R(2),R(2),R(1)]]],
   ["SELECT json_type('\"x\"'),type,atom FROM json_each('[\"x\"]')",[[T('text'),T('text'),T('x')]]],
  ]){const q=db.prepare(sql).statement;try{const rows=[];while(await q.step()==='row')rows.push(Array.from({length:q.columnCount},(_,i)=>[q.columnType(i),q.column(i)]));assert.deepEqual(rows,want);}finally{q.finalize();}}
 }finally{db.close();}
});
