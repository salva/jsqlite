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
