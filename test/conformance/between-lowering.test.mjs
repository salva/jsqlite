import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {compileScalarSelect,programOpcodeNames,programRegisterFacts} from '../../src/internal/vdbe.ts';

function program(sql){const parsed=parseSql(sql);assert.equal(parsed.statement?.kind,'select');return compileScalarSelect(parsed.statement,'utf-8')}
const projection=program('SELECT abs(10) BETWEEN 5 AND 15');
const facts=programRegisterFacts(projection),abs=facts.find(op=>op.code==='Function'),comparisons=facts.filter(op=>op.code==='Binary');
assert.ok(abs?.p2!==undefined);assert.equal(facts.filter(op=>op.code==='Function').length,1);
assert.equal(comparisons.length,2);assert.deepEqual(comparisons.map(op=>op.p1),[abs.p2,abs.p2]);
assert.ok(!programOpcodeNames(projection).includes('Expression'));
assert.ok(!programOpcodeNames(projection).includes('ShortCircuit'));
console.log(JSON.stringify({schema:'jsqlite-between-lowering-ts/1',outcome:'pass',checks:['lhs-function-once','shared-lhs-register','ordered-comparisons','projection-native-order','no-Expression']}));
