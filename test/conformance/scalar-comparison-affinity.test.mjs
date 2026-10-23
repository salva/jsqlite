import assert from 'node:assert/strict';
import test from 'node:test';
import {parseSql} from '../../src/internal/parse.ts';
import {compileScalarSelect,VdbeStatement} from '../../src/internal/vdbe.ts';

// expr.c:codeCompare -> binaryCompareP5 -> sqlite3CompareAffinity.
// Both affiliations, not operand order, determine scalar comparison affinity.
const cases=[
 ["CAST('01' AS TEXT) = CAST(1 AS INTEGER)",1n],
 ["CAST(1 AS INTEGER) = CAST('01' AS TEXT)",1n],
 ["CAST('01' AS TEXT) IS CAST(1 AS INTEGER)",1n],
 ["CAST('01' AS TEXT) != CAST(1 AS INTEGER)",0n],
 ["CAST('01' AS TEXT) < CAST(1 AS INTEGER)",0n],
 ["CAST('01' AS TEXT) = CAST('1' AS TEXT)",0n],
 ["CAST('01' AS TEXT) = 1",0n],
 ["CAST('01' AS NUMERIC) = '1'",1n],
 ["CAST(NULL AS TEXT) = CAST(1 AS INTEGER)",null],
 ["CAST(NULL AS TEXT) IS CAST(NULL AS INTEGER)",1n],
 ["CAST('01' AS TEXT) = CAST(1.0 AS REAL)",1n],
 ["CAST(x'31' AS BLOB) = CAST(1 AS INTEGER)",0n],
];
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`scalar comparison combines operand affinities ${encoding}`,async()=>{
 for(const [expression,expected] of cases){
  const program=compileScalarSelect(parseSql(`SELECT ${expression}`).statement,encoding);
  const s=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
  try{for(let run=0;run<2;run++){
   assert.equal(await s.step(),'row',expression);
   assert.equal(s.columnType(0),expected===null?'null':'integer',expression);
   assert.equal(s.column(0),expected,expression);
   assert.equal(await s.step(),'done');s.reset();
  }}finally{s.finalize();}
 }
});
