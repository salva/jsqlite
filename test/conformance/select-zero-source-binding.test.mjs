import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const cases=JSON.parse(fs.readFileSync(new URL('./cases/select-zero-source-binding.json',import.meta.url)));
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
for(const encoding of ['utf8','utf16le','utf16be'])test(`zero-source linked binding ${encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-${encoding}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/zero-source');globalThis.fetch=old;
 for(const {sql,rows} of cases){const s=db.prepare(sql).statement;try{
 assert.deepEqual(s.columnMetadata(0),{name:'n',declaredType:null,database:null,table:null,origin:null});
 for(let cycle=0;cycle<2;cycle++){const actual=[];while(await s.step()==='row')actual.push([[s.columnType(0),s.column(0)]]);assert.deepEqual(actual,rows.map(r=>r.map(v=>v===null?['null',null]:['integer',BigInt(v)])),sql);if(!cycle)s.reset();}
 }finally{s.finalize();}}
 }finally{globalThis.fetch=old;if(db)await db.close();}
});
test('bounded producer has no route-local spelling resolver',()=>{
 const code=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const branch=code.slice(code.indexOf('function compileZeroSourceDerivedCount'),code.indexOf('export function compileAggregateSelect'));
 assert.ok(!branch.includes('tree.name.split'));assert.ok(!branch.includes('names.findIndex'));assert.ok(branch.includes('resolvedExpressionCarrier'));
});
