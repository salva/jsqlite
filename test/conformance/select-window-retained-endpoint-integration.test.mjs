import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Independent pin-asserted native capture before any product edits:
// work:///cards/card-t-d/accumulated-b685-red/oracle.json (cases 2,3,5).
// Finite retained children must end their source coroutine, not replay rows
// until maxWorkUnits. Outer LIMIT cannot consume the child's LIMIT register.
const cases=[
 ['SELECT d.a,first_value(d.a) OVER (ORDER BY d.a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM (SELECT a FROM t1 WHERE a>1 LIMIT 2) d ORDER BY 1 LIMIT 1 OFFSET 1',[[5n,3n]]],
 ['WITH q AS (SELECT a FROM t1 LIMIT 3) SELECT a,nth_value(a,2) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM q ORDER BY 1 LIMIT 2 OFFSET 1',[[3n,3n],[5n,5n]]],
 ['SELECT d.a,nth_value(d.a,2) OVER (ORDER BY d.a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM (SELECT a FROM t1 WHERE a<5 UNION ALL SELECT a FROM t1 WHERE a>5 LIMIT 3) d ORDER BY 1',[[1n,null],[3n,3n],[7n,7n]]],
];
for(const [sql,expected] of cases)test(`retained window endpoints terminate: ${sql}`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const prior=globalThis.fetch;let db,statement;
 try{
  globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/retained-endpoints');globalThis.fetch=prior;
  statement=db.prepare(sql).statement;assert.equal(statement.columnMetadata(0).name,'a');
  for(let pass=0;pass<2;pass++){
   const rows=[];while(await statement.step({maxWorkUnits:10000})==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>[statement.columnType(i),statement.column(i)]));
   assert.deepEqual(rows,expected.map(row=>row.map(v=>[v===null?'null':'integer',v])));
   if(pass===0)statement.reset();
  }
 }finally{globalThis.fetch=prior;try{statement?.finalize();}catch{}db?.close();}
});
