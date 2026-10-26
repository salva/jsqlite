import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
import {SelectProgramBuilder} from '../../src/internal/select-program.ts';

// Construction evidence, not public compound admission or a second VM. Observe
// real producer label emission and inspect edges after enclosing publication.
function windowInEnclosingContext(sql,start){
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const storage=ImmutableStorage.open(fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url)));
 try{
  const builder=new SelectProgramBuilder();builder.reserveCursorsThrough(30);
  const prefix=Array.from({length:start},()=>({code:'Noop'}));
  prefix.forEach(op=>builder.emit(op));
  const events=[];
  for(const method of ['jump','mark']){
   const original=builder[method].bind(builder);
   builder[method]=(...args)=>{events.push({method,pc:builder.ops.length,label:args[0],code:args[1]?.code});return original(...args);};
  }
  const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph({[storageOwner]:storage}),btreeFromStorage(storage),100,undefined,undefined,undefined,
   {builder,parameters:{maximum:0,names:[],named:new Map()},destination:{kind:'output'}});
  assert.strictEqual(program.ops,builder.ops);
  const end=builder.ops.length;builder.emit({code:'Halt'});
  const ops=builder.finish();
  prefix.forEach((op,pc)=>assert.strictEqual(ops[pc],op,'already-emitted prefix untouched'));
  return {ops,events,end};
 }finally{storage.close();}
}

test('retained window caller settles setup entry and drain at nonzero parent PC',()=>{
 const witnesses=[];
 for(const start of [0,7]){
  const {ops,events}=windowInEnclosingContext('SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY d.r DESC',start);
  const initial=events[0];
  assert.equal(initial.method,'jump');assert.equal(initial.pc,start);assert.equal(initial.code,'Goto');
  const setup=events.find(e=>e.method==='mark'&&e.label===initial.label);assert.ok(setup);
  const entry=events[1];assert.equal(entry.method,'mark');assert.equal(entry.pc,start+1);
  const enter=events.find(e=>e.method==='jump'&&e.label===entry.label);assert.ok(enter&&enter.pc>setup.pc);
  const drain=events.find(e=>e.method==='mark'&&e.pc===enter.pc+1);assert.ok(drain);
  const exit=events.find(e=>e.method==='jump'&&e.label===drain.label);assert.ok(exit&&exit.pc>entry.pc&&exit.pc<setup.pc);
  assert.deepEqual(ops[start],{code:'Goto',p2:setup.pc});
  assert.equal(ops[setup.pc].code,'SorterOpen','setup opens materialization before child');
  assert.deepEqual(ops[enter.pc],{code:'Goto',p2:entry.pc});
  assert.deepEqual(ops[exit.pc],{code:'Goto',p2:drain.pc});
  assert.equal(ops[drain.pc].code,'SorterSort','completion enters drain, not setup');
  assert.ok(ops.slice(exit.pc+1,setup.pc).some(op=>op.code==='Return'),'late child subroutine bypassed');
  assert.ok(!ops.slice(start,drain.pc).some(op=>op.code==='Halt'));
  witnesses.push([setup.pc,entry.pc,enter.pc,exit.pc,drain.pc].map(pc=>pc-start));
 }
 assert.deepEqual(witnesses[1],witnesses[0],'boundary addresses track nonzero start');
});

test('default window caller bypasses late subroutines at nonzero parent PC',()=>{
 const witnesses=[];
 for(const start of [0,7]){
  const {ops,end}=windowInEnclosingContext('SELECT sum(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t1',start);
  const exits=ops.flatMap((op,pc)=>op.code==='Goto'&&op.p2===end?[pc]:[]);
  assert.equal(exits.length,1,'one default completion bypass');
  const exit=exits[0];assert.ok(exit>start&&exit<end-1);
  assert.equal(ops[end-1].code,'Return');assert.equal(ops[end].code,'Halt');
  assert.ok(!ops.slice(start,end).some(op=>op.code==='Halt'));
  witnesses.push([exit-start,end-start]);
 }
 assert.deepEqual(witnesses[1],witnesses[0]);
});

// Independently captured by select-window-payload-binding-native.py, pinned
// 3.53.4; resolve.c lookupName -> expr.c TK_REGISTER producer-row location.
for(const encoding of ['utf8','utf16le','utf16be'])test(`linked window payload predicate ${encoding}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-${encoding}`));
  for(const [predicate,expected] of [['d.r BETWEEN 2 AND 3',[3n,2n]],['d.r IN (2,4)',[4n,2n]],['CASE WHEN d.r=1 THEN NULL ELSE d.r END > 2',[4n,3n]]]){
   const stmt=db.prepare(`SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE ${predicate} ORDER BY d.r DESC`).statement;
   try{
    assert.deepEqual(stmt.columnMetadata(0),{name:'r',declaredType:null,database:null,table:null,origin:null});
    for(let cycle=0;cycle<2;cycle++){
     const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}
     assert.deepEqual(rows,expected);if(!cycle)stmt.reset();
    }
   }finally{stmt.finalize();}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()));}
});

test('retained window setup and exits use enclosing labels without moving emitted operations',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('// select.c tag-select-0488 materializes');
 assert.ok(start>=0);
 const region=source.slice(start,source.indexOf('const payloadBinding:',start));
 assert.doesNotMatch(region,/ops\.push\(first|ops\[base\]=|op\.code==='Halt'/);
 assert.match(region,/builder\.mark\(entryLabel\)/);
 assert.match(region,/exitLabel:drainLabel/);
 assert.match(region,/builder\.mark\(setupLabel\)/);
 assert.match(region,/builder\.jump\(entryLabel/);
 assert.match(region,/builder\.mark\(drainLabel\)/);
});

test('retained window projection and ORDER consume resolved identities',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('// select.c tag-select-0488 materializes');
 const end=source.indexOf('const parentPlan=',start);
 assert.ok(start>=0&&end>start);
 assert.doesNotMatch(source.slice(start,end),/tree\.name\.split|names\.findIndex/);
 const region=source.slice(end,source.indexOf('const payloadBinding:',end));
 assert.doesNotMatch(region,/tree\.name\.split|names\.findIndex/);
 assert.match(region,/parentPlan\.result\.map/);
 assert.match(region,/parentPlan\.orderResultColumns/);
 assert.match(region,/resolvedExpressionCarrier\(parentPlan/);
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`resolved window projection ORDER ${encoding}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-${encoding}`));
  for(const [projection,order,name] of [['d.r AS renamed','renamed','renamed'],['d.r','1','r'],['d.*','d.r','r']]){
   const stmt=db.prepare(`SELECT ${projection} FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d ORDER BY ${order} DESC`).statement;
   try{
    assert.deepEqual(stmt.columnMetadata(0),{name,declaredType:null,database:null,table:null,origin:null});
    for(let cycle=0;cycle<2;cycle++){
     const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}
     assert.deepEqual(rows,[4n,3n,2n,1n]);if(!cycle)stmt.reset();
    }
   }finally{stmt.finalize();}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()));}
});

test('window payload predicate consumes linked carrier, not a local spelling walker',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('const payloadBinding:ResolvedExpressionBinding=');
 assert.ok(start>=0);
 const region=source.slice(start,source.indexOf('let skip=-1;',start));
 assert.match(region,/resolvedExpressionCarrier\(parentPlan/);
 assert.doesNotMatch(region,/tree\.name\.split|findIndex/);
});
