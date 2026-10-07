import test from 'node:test';import assert from 'node:assert/strict';import {parseSql} from '../../src/internal/parse.ts';import * as p from '../../src/internal/stat4-probe.ts';import {KeyInfo} from '../../src/internal/comparison.ts';import {memToPublicInitial} from '../../src/internal/mem.ts';
const expr=s=>parseSql(`SELECT ${s}`).statement.result[0].reduction;
const info=new KeyInfo({encoding:'utf-16le',totalFieldCount:3,keyFieldCount:2,terms:[{}, {}, {}]});
test('source extraction literal/unary/cast/collate/NULL and honest NOTFOUND',()=>{
 for(const [sql,expected] of [["'a' COLLATE NOCASE",'a'],['-9223372036854775808',-(1n<<63n)],['-(-5)',5n],["CAST('12.9' AS INTEGER)",12n],['NULL',null],["X'0102'",Uint8Array.of(1,2)]]){
  const m=p.stat4ValueFromExpr(expr(sql),'blob','utf-16le');assert.ok(m,sql);try{assert.deepEqual(memToPublicInitial(m),expected)}finally{m.release()}
 }
 for(const sql of ['1+2','abs(2)','a','NOT 0'])assert.equal(p.stat4ValueFromExpr(expr(sql),'blob','utf-8'),null,sql);
 let sensitive=false;assert.equal(p.stat4ValueFromExpr(expr('?'),'blob','utf-8',()=>{sensitive=true}),null);assert.equal(sensitive,true);
});
test('builder-local prefixes restore on throwing scopes, all allocated slots release',()=>{
 const probe=p.createStat4Probe(info);try{
  assert.equal(probe.setExpression(0,expr('1'),'integer'),true);probe.nField=1;probe.nRecValid=1;
  const primary=new Error('nested failure');assert.throws(()=>probe.withPrefix(2,()=>{probe.setLiteral(2,'owned beyond active prefix');throw primary}),e=>e===primary);
  assert.equal(probe.nField,1);assert.equal(probe.nRecValid,1);
  assert.equal(probe.setExpression(1,expr('a'),'blob'),false);assert.equal(probe.nField,1);
 }finally{probe.release()}
 for(const m of probe.values)assert.equal(m.initialStorageClass,'null');assert.throws(()=>probe.setLiteral(0,1n),/released/);
});
test('source numerify negatives and hex integer width retain typed distinctions',()=>{
 for(const [sql,expected] of [["-('abc')",0n],["-('12tail')",-12n],['-(-9223372036854775808)',9223372036854775808],['0xffffffffffffffff',-1n],['-0xffffffffffffffff',1n]]){
  const m=p.stat4ValueFromExpr(expr(sql),'blob','utf-8');assert.ok(m);try{assert.deepEqual(memToPublicInitial(m),expected,sql)}finally{m.release()}
 }
 const m=p.stat4ValueFromExpr(expr("X'3132'"),'integer','utf-8');try{assert.deepEqual(memToPublicInitial(m),Uint8Array.of(49,50),'blob production skips affinity like source')}finally{m.release()}
});
test('failure preserves previous slot and nested scopes restore valid/prefix without claiming binding parity',()=>{
 let fail=false;const primary=new Error('extraction');const probe=p.createStat4Probe(info,()=>{if(fail)throw primary});
 try{probe.setLiteral(0,7n);probe.nField=1;probe.nRecValid=1;fail=true;
 assert.throws(()=>probe.setExpression(0,expr("CAST('x' AS TEXT)"),'text'),e=>e===primary);assert.equal(memToPublicInitial(probe.values[0]),7n);
 fail=false;assert.equal(probe.setExpression(1,expr('?'),'text'),false);assert.equal(probe.parameterSensitive,true);
 probe.withPrefix(2,()=>{probe.nRecValid=2;probe.withPrefix(3,()=>{probe.nRecValid=3});assert.equal(probe.nRecValid,2)});
 assert.equal(probe.nField,1);assert.equal(probe.nRecValid,1);
 }finally{probe.release()}
});
test('pinned valueFromExpr token text affinity preserves out-of-range spelling, typed numeric affinity',()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const [sql,affinity,expected] of [
 ['1.0','blob',1],['1.0','numeric',1n],['1.0','real',1n],['1.5','real',1.5],
 ['9223372036854775808','text','9223372036854775808'],['1e0','text','1e0'],['0xffffffffffffffff','text','-1'],
 ['-9223372036854775809','text','-9223372036854775809']]){
 const m=p.stat4ValueFromExpr(expr(sql),affinity,encoding);try{assert.deepEqual(memToPublicInitial(m),expected,`${sql}/${affinity}/${encoding}`)}finally{m.release()}
 }
});
test('large literal extraction charges checked token work before Mem allocation',()=>{
 const primary=new Error('literal budget');let checks=0;
 assert.throws(()=>p.stat4ValueFromExpr(expr("'"+'a'.repeat(10000)+"'"),'text','utf-8',()=>{},units=>{if(units>=4096){checks++;throw primary}}),e=>e===primary);assert.equal(checks,1);
});
