import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
import {builtinFunction,builtinFunctionAccepts} from '../../src/internal/functions.ts';

// Registration audit: read the pinned C rather than restating a second table.
test('finite descriptor catalog matches pinned FuncDef registrations',()=>{
 const read=p=>fs.readFileSync(new URL(`../../${p}`,import.meta.url),'utf8');
 const base='reference/sqlite/sqlite-src-3530400/src/';
 const registrations=new Map();
 for(const file of ['func.c','date.c','json.c']){
  for(const m of read(base+file).matchAll(/\b(?:FUNCTION2?|VFUNCTION|DFUNCTION|PURE_DATE|INLINE_FUNC|LIKEFUNC|MFUNCTION|JFUNCTION)\(\s*([\w]+)\s*,\s*(-?\d+)/g)){
   const list=registrations.get(m[1])??[];list.push(Number(m[2]));registrations.set(m[1],list);
  }
 }
 const names=[...read('src/internal/functions.ts').matchAll(/(?:definition|M)\("([^"]+)"/g)].map(m=>m[1]);
 assert.ok(names.length>100);
 for(const name of names){
  if(name==='json_arrow'||name==='json_arrow_sql')continue; // internal -> / ->> aliases, fixed2
  const arities=registrations.get(name);assert.ok(arities,name);
  for(let argc=0;argc<=4;argc++){
   const expected=arities.some(n=>n===argc||n===-1||n===-3&&argc>=1||n===-4&&argc>=2);
   assert.equal(builtinFunctionAccepts(builtinFunction(name),argc),expected,`${name}/${argc}`);
  }
 }
});
const cases=[['strftime()','null',null],["strftime('%Y','2000-01-02')",'text','2000']];
for(const prefix of ['json','jsonb'])for(const mode of ['set','insert','replace','array_insert','remove','extract']){
 const f=`${prefix}_${mode}`;
 cases.push([`${f}()`,'null',null]);
 cases.push([`${f}('{}')`,mode==='extract'?'null':prefix==='jsonb'?'blob':'text',mode==='extract'?null:prefix==='jsonb'?'0c':'{}']);
 if(mode==='extract')cases.push([`${f}('malformed')`,'null',null]);
 if(!['extract','remove'].includes(mode)){
  for(const doc of ["'{}'",'NULL',"'malformed'"])
   cases.push([`${f}(${doc},'$.a')`,'error',`json_${mode}() needs an odd number of arguments`]);
  cases.push([`${f}('[0]','$[0]',1)`,prefix==='jsonb'?'blob':'text',prefix==='jsonb'?(mode==='insert'?'2b1330':mode==='array_insert'?'4b13311330':'2b1331'):(mode==='insert'?'[0]':mode==='array_insert'?'[1,0]':'[1]')]);
 }
}
for(const enc of ['utf8','utf16le','utf16be'])test(`registration versus function-body boundaries ${enc}`,async()=>{
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/subquery-${enc}.db`,import.meta.url));
 const old=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/registration');}finally{globalThis.fetch=old;}
 try{
  for(const [expr,type,value] of cases){
   const s=db.prepare(`SELECT ${expr} AS v`).statement;
   try{
    assert.deepEqual(s.columnMetadata(0),{name:'v',declaredType:null,database:null,table:null,origin:null},expr);
    if(type==='error'){
     await assert.rejects(s.step(),e=>e.code===1&&e.message===value,expr);
     // reset/finalize surface the stored execution error; do not lose it.
     try{await s.reset();}catch(e){assert.equal(e.code,1);assert.equal(e.message,value);}
    }else for(let cycle=0;cycle<2;cycle++){
     assert.equal(await s.step(),'row',expr);assert.equal(s.columnType(0),type,expr);
     assert.deepEqual(type==='blob'?Buffer.from(s.column(0)).toString('hex'):s.column(0),value,expr);
     assert.equal(await s.step(),'done',expr);await s.reset();
    }
   }finally{try{s.finalize();}catch(e){assert.equal(type,'error');assert.equal(e.message,value);}}
   // Reuse the database after every execution error, with same-handle rebind.
   const control=db.prepare('SELECT min(?1,9) AS v').statement;
   try{for(const v of [1n,7n]){control.bind(1,v);assert.equal(await control.step(),'row');assert.equal(control.columnType(0),'integer');assert.equal(control.column(0),v);assert.equal(await control.step(),'done');await control.reset();}}finally{control.finalize();}
  }
  for(const f of ['min','max'])assert.throws(()=>db.prepare(`SELECT ${f}()`),e=>e.code===1&&e.message===`wrong number of arguments to function ${f}()`);
 }finally{db.close();}
});
