import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../../src/internal/parse.ts';
import {compileScalarSelect,programRegisterFacts,programOpcodeNames} from '../../../src/internal/vdbe.ts';
function program(sql){const parsed=parseSql(sql);assert.equal(parsed.statement?.kind,'select');return compileScalarSelect(parsed.statement,'utf-8')}
test('vector literal fields use shared registers once and lazy lexicographic continuation',()=>{
 const p=program('SELECT (abs(1),abs(2)) < (abs(3),abs(4))');
 const facts=programRegisterFacts(p),functions=facts.filter(x=>x.code==='Function');
 assert.equal(functions.length,4);
 const comparisons=facts.filter(x=>x.code==='Binary');
 assert.equal(comparisons.length,3);
 assert.equal(comparisons[0].p1,comparisons[1].p1);
 assert.equal(comparisons[0].p2,comparisons[1].p2);
 assert.equal(new Set(functions.map(x=>x.p2)).size,4);
 assert.ok(programOpcodeNames(p).includes('ElseEq'));
 assert.ok(!programOpcodeNames(p).includes('Expression'));
});

test('vector literal membership produces packed records before probing and clearing',()=>{
 const facts=programRegisterFacts(program('SELECT (1,2) IN ((1,2),(3,NULL))'));
 const inserts=facts.filter(op=>op.code==='IdxInsert');assert.equal(inserts.length,2);
 for(const insert of inserts){const record=facts[insert.index-1];assert.equal(record.code,'MakeRecord');assert.equal(record.p2,2);assert.equal(insert.p2,record.p3);}
 assert.ok(facts.findIndex(op=>op.code==='InSet')>inserts.at(-1).index);
 assert.equal(facts.at(-3).code==='ClearEphemeral'||facts.some(op=>op.code==='ClearEphemeral'),true);
});


test('scalar VALUES and limited SELECT IN destinations use packed record producers',()=>{
 for(const sql of ['SELECT 1 IN (VALUES(1),(2))','SELECT 1 IN (SELECT 1 LIMIT 1)','SELECT 1 IN (SELECT 1 UNION ALL SELECT 2 LIMIT 1)']){
  const parsed=parseSql(sql);
  const facts=programRegisterFacts(compileScalarSelect(parsed.statement,'utf-8',undefined,undefined,undefined,undefined,{encoding:'utf-8'}));
  assert.ok(facts.some(op=>op.code==='InSet'),sql);
  for(const insert of facts.filter(op=>op.code==='IdxInsert')){
   assert.ok(insert.p2!==undefined,sql);
   assert.equal(facts[insert.index-1].code,'MakeRecord',sql);
   assert.equal(facts[insert.index-1].p3,insert.p2,sql);
  }
 }
});

test('packed Set destination releases its dead record after awaited insert only',async()=>{
 const {emitSelectDestination}=await import('../../../src/internal/select-program.ts');
 const ops=[];emitSelectDestination(ops,{kind:'set',cursor:4,width:2,packedRegister:8},2,2);
 assert.deepEqual(ops,[{code:'MakeRecord',p1:2,p2:2,p3:8},{code:'IdxInsert',p1:4,p2:8,keyStart:2,keyCount:2,consumeRecord:true}]);
 const invalid=[];assert.throws(()=>emitSelectDestination(invalid,{kind:'set',cursor:4,width:2,packedRegister:3},2,2),/packed record register/);assert.equal(invalid.length,0);
});


test('membership storage projection requires packed producers for scalar and vector routes',async()=>{
 const {programMembershipStorage}=await import('../../../src/internal/vdbe.ts');
 for(const sql of ['SELECT (1,2) IN ((1,2))','SELECT 1 IN (VALUES(1),(2))','SELECT 1 IN (SELECT 1 LIMIT 1)']){
  const p=compileScalarSelect(parseSql(sql).statement,'utf-8',undefined,undefined,undefined,undefined,{encoding:'utf-8'});
  const storage=programMembershipStorage(p);assert.ok(storage.length);assert.ok(storage.every(owner=>owner.packed),sql);
 }
});
