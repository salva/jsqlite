import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const cases=JSON.parse(fs.readFileSync(new URL('./cases/select-mixed-json-binding.json',import.meta.url)));
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
test('mixed JSON production consumes linked carriers rather than local spellings',()=>{
 const code=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=code.indexOf('const mergedPlan=shared?.linkedPlan??resolveTransientArm(select,schema);');
 const end=code.indexOf('if(select.from.items.length===2&&select.from.items.every',start);
 assert.ok(start>0&&end>start);const branch=code.slice(start,end);
 assert.ok(branch.includes('resolvedExpressionCarrier(mergedPlan,reduction)'));
 assert.ok(branch.includes('const bindArgument='));
 assert.ok(!branch.includes('tree.name.split'));
 assert.ok(!branch.includes('const resolveOrder='));
});
for(const encoding of ['utf8','utf16le','utf16be'])test(`mixed JSON linked binding ${encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{
  globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/mixed-binding');globalThis.fetch=old;
  for(const {sql,rows} of cases){
   const s=db.prepare(sql).statement;
   try{
    assert.deepEqual([0,1].map(i=>s.columnMetadata(i)),[{name:'a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'},{name:'value',declaredType:null,database:'main',table:'json_each',origin:'value'}]);
    for(let cycle=0;cycle<2;cycle++){
     const actual=[];while(await s.step()==='row')actual.push([0,1].map(i=>[s.columnType(i),s.column(i)]));
     assert.deepEqual(actual,rows.map(row=>row.map(v=>v===null?['null',null]:['integer',BigInt(v)])),sql);
     if(!cycle)s.reset();
    }
   }finally{s.finalize();}
  }
 }finally{globalThis.fetch=old;if(db)await db.close();}
});
