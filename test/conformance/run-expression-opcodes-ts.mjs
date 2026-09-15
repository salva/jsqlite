import assert from "node:assert/strict";
import { parseSql } from "../../src/internal/parse.ts";
import { compileScalarSelect, programOpcodeNames } from "../../src/internal/vdbe.ts";

function opcodes(sql) {
  const parsed=parseSql(sql);
  assert.equal(parsed.statement?.kind,"select");
  return programOpcodeNames(compileScalarSelect(parsed.statement,"utf-8"));
}
for (const sql of ["SELECT abs(-2)","SELECT min('a' COLLATE nocase,'B')"]) {
  const names=opcodes(sql);
  assert.ok(names.includes("Function"),`${sql}: ${names}`);
  assert.ok(!names.includes("Expression"),`${sql}: ${names}`);
}
assert.ok(opcodes("SELECT min('a' COLLATE nocase,'B')").includes("CollSeq"));
for (const sql of ["SELECT 0 AND abs(-9223372036854775808)","SELECT 1 OR abs(-9223372036854775808)"]) assert.ok(opcodes(sql).includes("ShortCircuit"));
assert.ok(opcodes("SELECT coalesce(1,abs(-9223372036854775808))").includes("NotNull"));
assert.ok(opcodes("SELECT CASE WHEN 1 THEN 2 ELSE abs(-9223372036854775808) END").includes("Goto"));
console.log(JSON.stringify({schema:"jsqlite-expression-opcodes-ts/1",outcome:"pass",checks:["Function","CollSeq","ShortCircuit","NotNull","Goto","no-Expression"]}));
const limitNames=opcodes("SELECT 1 LIMIT '2' OFFSET 1");
for(const name of ["MustBeInt","OffsetLimit","IfNot","ResultRow","DecrJumpZero"]) assert.ok(limitNames.includes(name),`LIMIT opcode ${name}: ${limitNames}`);
assert.ok(!limitNames.includes("ComputeLimit"),`synthetic LIMIT opcode survived: ${limitNames}`);
assert.ok(limitNames.indexOf("MustBeInt")<limitNames.indexOf("ResultRow"));
