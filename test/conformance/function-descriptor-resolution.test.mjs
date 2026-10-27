import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {builtinFunctionRegistry} from '../../src/internal/functions.ts';
test('resolver does not duplicate ordinary descriptor names',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/resolve.ts',import.meta.url),'utf8');
 const known=source.match(/known=\[([^\]]+)\]\.includes\(name\)/);
 assert.ok(known);
 const names=[...known[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual(builtinFunctionRegistry.filter(d=>names.includes(d.name)).map(d=>d.name),[]);
});
for(const enc of ['utf8','utf16le','utf16be'])test(`descriptor diagnostics and overload lifecycle ${enc}`,async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/subquery-${enc}.db`,import.meta.url));
 const old=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/policy');}finally{globalThis.fetch=old;}
 try{
  for(const [sql,message] of [
   ['SELECT CoNcAt()','wrong number of arguments to function CoNcAt()'],
   ['SELECT CoNcAt_Ws(1)','wrong number of arguments to function CoNcAt_Ws()'],
   ['SELECT NoSuchPolicyFn(1)','no such function: NoSuchPolicyFn'],
   ['SELECT NoSuchPolicyFn(missing)','no such column: missing'],
   ['SELECT abs(missing,2)','no such column: missing'],
   ['SELECT min(1,2) OVER ()','min() may not be used as a window function'],
   ['SELECT max(1,2) OVER ()','max() may not be used as a window function'],
   ['SELECT abs(1) FILTER (WHERE 1)','FILTER may not be used with non-aggregate abs()'],
   ['SELECT abs(1) OVER ()','abs() may not be used as a window function']
  ])assert.throws(()=>db.prepare(sql),e=>e.code===1&&e.message===message,sql);
  for(const expr of ['min(?1)','max(?1)','min(?1,9)','max(?1,0)','abs(?1)']){
   const s=db.prepare(`SELECT ${expr} AS v`).statement;
   try{
    assert.deepEqual(s.columnMetadata(0),{name:'v',declaredType:null,database:null,table:null,origin:null});
    for(const v of [1n,7n]){s.bind(1,v);assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'integer');assert.equal(s.column(0),v);assert.equal(await s.step(),'done');await s.reset();}
   }finally{s.finalize();}
  }
 }finally{db.close();}
});
