import assert from "node:assert/strict";
import {builtinFunctionRegistry,builtinFunction,builtinFunctionAccepts,builtinFunctionIsPure} from "../../src/internal/functions.ts";
import {parseSql} from "../../src/internal/parse.ts";
import {compileScalarSelect,programOpcodeNames} from "../../src/internal/vdbe.ts";

assert.equal(builtinFunctionRegistry.length,50);
assert.ok(Object.isFrozen(builtinFunctionRegistry));
assert.deepEqual(builtinFunction("substring")?.exactArities,[2,3]);
assert.equal(builtinFunction("substring")?.dispatchable,true);
assert.equal(builtinFunction("upper")?.dispatchable,true);
assert.equal(builtinFunction("lower")?.dispatchable,true);
assert.equal(builtinFunction("ifnull")?.dispatchable,true);
assert.equal(builtinFunction("printf")?.dispatchable,false);
assert.equal(builtinFunction("format")?.dispatchable,false);
assert.equal(builtinFunction("round")?.dispatchable,false);
assert.equal(builtinFunction("glob")?.dispatchable,true);
assert.equal(builtinFunction("like")?.dispatchable,true);
assert.equal(builtinFunction("nullif")?.flags.includes("need-collation"),true);
assert.equal(builtinFunctionAccepts(builtinFunction("printf"),0),true);
assert.equal(builtinFunctionAccepts(builtinFunction("printf"),1000),true);
assert.equal(builtinFunctionAccepts(builtinFunction("printf"),1001),false);
assert.equal(builtinFunctionAccepts(builtinFunction("min"),1),false);
assert.equal(builtinFunctionAccepts(builtinFunction("min"),2),true);
assert.equal(builtinFunctionIsPure(builtinFunction("abs")),true);
assert.equal(builtinFunctionIsPure(builtinFunction("random")),false);

function compile(sql){const statement=parseSql(sql).statement;assert.equal(statement?.kind,"select");return compileScalarSelect(statement,"utf-8")}
function error(sql){try{compile(sql);assert.fail("expected error")}catch(e){return e}}
let e=error("SELECT abs()");assert.equal(e.kind,"sqlite");assert.equal(e.code,1);assert.equal(e.message,"wrong number of arguments to function abs()");
e=error("SELECT no_such_scalar(1)");assert.equal(e.kind,"sqlite");assert.equal(e.message,"no such function: no_such_scalar");
const caseProgram=compile("SELECT upper('x'), lower('Y')");assert.ok(programOpcodeNames(caseProgram).includes("Function"));
const program=compile("SELECT abs(-1)");assert.ok(programOpcodeNames(program).includes("Function"));
assert.ok(!programOpcodeNames(program).includes("PureFunc"));
console.log(JSON.stringify({outcome:"pass",registryRows:50,checks:["arity","name","registered-undispatchable","flags","ordinary-function-opcode"]}));
