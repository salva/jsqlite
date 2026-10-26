import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const cases=JSON.parse(fs.readFileSync(new URL('./cases/select-derived-physical-binding.json',import.meta.url),'utf8'));
// Native FIRST: select-derived-physical-binding-native.py checks pin, read-only
// images, exact NULL/INTEGER rows, five metadata fields and two executions.
for(const encoding of ['utf8','utf16le','utf16be'])test(`derived physical binding ${encoding}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-${encoding}`));
  for(const {sql,rows} of cases){
   const statement=db.prepare(sql).statement;
   try{
    assert.deepEqual([0,1].map(i=>statement.columnMetadata(i)),[
     {name:'x',declaredType:null,database:null,table:null,origin:null},
     {name:'a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'},
    ]);
    for(let cycle=0;cycle<2;cycle++){
     const actual=[];while(await statement.step()==='row')actual.push([0,1].map(i=>[statement.columnType(i),statement.column(i)]));
     assert.deepEqual(actual,rows.map(row=>row.map(v=>v===null?['null',null]:['integer',BigInt(v)])),sql);
     if(!cycle)statement.reset();
    }
   }finally{statement.finalize();}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()));}
});

test('derived physical consumer maps linked identities rather than spelling',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf("const rowBinding:ResolvedExpressionBinding={policy:'scalar',location:reference=>");
 assert.ok(start>=0);
 const end=source.indexOf('// select.c computeLimitRegisters',start);
 const region=source.slice(start,end);
 assert.match(region,/resolvedExpressionCarrier\(parentPlan,reduction\)/);
 assert.doesNotMatch(region,/tree\.name\.split|findIndex/);
});
