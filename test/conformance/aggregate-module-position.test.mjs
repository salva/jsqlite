import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
const column=(name,origin=null)=>({name,declaredType:origin?'INTEGER':null,database:origin?'main':null,table:origin?'t1':null,origin});
// Pinned 3.53.4 packet J0-J3, independently drained/reset on exact G17.
for(const encoding of ['utf8','utf16le','utf16be'])test(`CF06 positioned module aggregate ${encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/cf06');}finally{globalThis.fetch=old;}
 try{
  for(const from of ["t1 t JOIN json_each('[1,2]') j","json_each('[1,2]') j JOIN t1 t","t1 t JOIN json_each('[1,2]') j JOIN json_each('[3]') k"]){
   for(const grouped of [false,true]){
    const sql=grouped?`SELECT t.a, count(*), row_number() OVER (ORDER BY t.a) FROM ${from} GROUP BY t.a`:`SELECT count(*) FROM ${from}`;
    const statement=db.prepare(sql).statement;
    try{
     assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i)),grouped?[column('a','a'),column('count(*)'),column('row_number() OVER (ORDER BY t.a)')]:[column('count(*)')]);
     for(let pass=0;pass<2;pass++){
      const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>{assert.equal(statement.columnType(i),'integer');return String(statement.column(i));}));
      assert.deepEqual(rows,grouped?['1','3','5','7'].map((a,i)=>[a,'2',String(i+1)]):[['8']]);
      statement.reset();
     }
    }finally{statement.finalize();}
   }
  }
  const rebound=db.prepare('SELECT count(*),sum(j.rowid),sum(j.value) FROM json_each(?1) j JOIN t1 t').statement;
  try{
   for(const [json,expected] of [['[1,2]',['8','4','12']],['[3]',['4','0','12']],['[]',['0',null,null]]]){
    rebound.bind(1,json);assert.equal(await rebound.step(),'row');
    assert.deepEqual(Array.from({length:3},(_,i)=>rebound.column(i)===null?null:String(rebound.column(i))),expected);
    assert.equal(await rebound.step(),'done');rebound.reset();
   }
  }finally{rebound.finalize();}
  // Missing names must win during preparation; malformed documents are not
  // parsed until the selected module level is entered.
  assert.throws(()=>db.prepare("SELECT count(*) FROM json_each('bad') j JOIN absent_cf06 t"),e=>e.message==='no such table: absent_cf06');
  assert.throws(()=>db.prepare("SELECT missing_cf06,count(*) FROM json_each('bad') j JOIN t1 t"),e=>e.message==='no such column: missing_cf06');
  const malformed=db.prepare("SELECT count(*) FROM json_each('bad') j JOIN t1 t").statement;
  try{let first;await assert.rejects(malformed.step(),e=>{first=e;return e.message==='malformed JSON';});assert.throws(()=>malformed.reset(),e=>e===first);}finally{malformed.finalize();}
 }finally{db.close();}
});
