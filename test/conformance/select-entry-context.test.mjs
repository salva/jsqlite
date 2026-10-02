import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open,JSQLiteError} from '../../src/index.ts';

// Native 3.53.4 source-ID checked before migration: entry-r1/native.py.
test('compound entry preserves per-arm classification, types and atomic errors',async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/empty.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/empty');}finally{globalThis.fetch=original;}
 try{
  for(const [sql,expected] of [
   ['SELECT 1 AS x UNION ALL SELECT count(*)',[['integer',1n],['integer',1n]]],
   ['SELECT count(*) AS x UNION ALL SELECT 1.5',[['integer',1n],['real',1.5]]],
   ['SELECT 1 AS x UNION ALL SELECT NULL',[['integer',1n],['null',null]]],
  ]){
   const s=db.prepare(sql).statement;
   try{assert.equal(s.columnMetadata(0).name,'x');for(let pass=0;pass<2;pass++){
    const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);
    assert.deepEqual(rows,expected);assert.equal(await s.step(),'done');if(pass===0)s.reset();
   }}finally{s.finalize();}
  }
  for(const [sql,message] of [
   ['SELECT 1 UNION ALL SELECT missing LIMIT 0','no such column: missing'],
   ['SELECT 1 UNION ALL SELECT sum(count(*))','misuse of aggregate function count()'],
  ])assert.throws(()=>db.prepare(sql),e=>e instanceof JSQLiteError&&e.kind==='sqlite'&&e.code===1&&e.message===message);
 }finally{db.close();}
});

test('public compound compilation owns enclosing builder and destination',()=>{
 const entry=fs.readFileSync(new URL('../../src/internal/select-compiler.ts',import.meta.url),'utf8');
 // This is a construction contract, not a public row-equivalence assertion.
 // An entry-owned context must pass its builder/destination to real arm consumers.
 assert.match(entry,/new SelectProgramBuilder/);
 assert.match(entry,/compileCteUnionAll\(select,[\s\S]*?\{ builder, parameters, destination \}\)/);
 assert.match(entry,/ops: builder\.finish\(\), registers: builder\.registers/);
 assert.ok(entry.indexOf('compileCteUnionAll(select')<entry.indexOf('const aggregate ='));
 const branch=entry.slice(entry.indexOf('const builder ='),entry.indexOf('// select.c:sqlite3Select dispatches the compound before any arm'));
 assert.doesNotMatch(branch,/catch\s*\(/);
 const vdbe=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const arms=vdbe.slice(vdbe.indexOf('export function compileCteUnionAll('),vdbe.indexOf('function compileSimpleTableCompound('));
 assert.match(arms,/owner\?\.builder\?\?new SelectProgramBuilder/);
 assert.match(arms,/owner\?\.destination\?\?\{kind:'output'\}/);
 assert.match(arms,/if\(owner\)return \{columns:columns!\}/);
});
