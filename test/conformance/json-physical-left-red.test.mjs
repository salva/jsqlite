import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Pinned 3.53.4 ENABLE_COLUMN_METADATA/ENABLE_MATH_FUNCTIONS comparison:
// an empty JSON inner cursor still contributes one NULL-extended LEFT row
// per physical row. Aggregate consumers must count that inner atom as zero.
for (const aggregate of [false,true]) {
 test(`physical LEFT JSON empty cursor ${aggregate?'aggregate':'projection'} preserves outer rows`,async()=>{
  const root=new URL('../fixtures/',import.meta.url);
  const g=JSON.parse(fs.readFileSync(new URL('CURRENT.json',root))).generationId;
  const bytes=fs.readFileSync(new URL(`generations/${g}/generated/select4-t1.db`,root));
  const original=globalThis.fetch;let db,s;
  try {globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/db');}finally{globalThis.fetch=original;}
  try {
   s=db.prepare(aggregate?"SELECT t1.n,count(j.atom) FROM t1 LEFT JOIN json_each('[]') j ON 1 GROUP BY t1.n":"SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each('[]') j ON 1").statement;
   const rows=[];while(await s.step()==='row')rows.push([s.columnInteger(0),s.columnType(1),s.column(1)]);
   assert.deepEqual(rows,Array.from({length:31},(_,i)=>[BigInt(i+1),aggregate?'integer':'null',aggregate?0n:null]));
  } finally {try{s?.finalize();}finally{db.close();}}
 });
}

test('LEFT JSON ON match precedes WHERE and NULL extension clears hidden fields',async()=>{
 const root=new URL('../fixtures/',import.meta.url),g=JSON.parse(fs.readFileSync(new URL('CURRENT.json',root))).generationId;
 const bytes=fs.readFileSync(new URL(`generations/${g}/generated/select4-t1.db`,root));
 const original=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/db');}finally{globalThis.fetch=original;}
 try {
  const cases=[
   ["SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each('[1]') j ON j.atom=t1.n WHERE t1.n<3",[[1n,1n],[2n,null]]],
   ["SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each('[1]') j ON 1 WHERE j.atom IS NULL",[]],
   ["SELECT t1.n,j.atom FROM t1 LEFT JOIN json_each(NULL) j ON 1 WHERE t1.n<3",[[1n,null],[2n,null]]],
   ["SELECT t1.n,j.atom FROM t1 LEFT JOIN json_tree(jsonb('[1]'),'$.missing') j ON 1 WHERE t1.n<3",[[1n,null],[2n,null]]],
   ["SELECT t1.n,j.json,j.root,j.fullkey FROM t1 LEFT JOIN json_each('[]') j ON 1 WHERE t1.n=1",[[1n,null,null,null]]],
  ];
  for(const [sql,want] of cases){const s=db.prepare(sql).statement;try{for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,want,sql);if(!pass)s.reset();}}finally{s.finalize();}}
 }finally{db.close();}
});

test('mixed JSON rows feed shared aggregate filters, projections and grouping',async()=>{
 const root=new URL('../fixtures/',import.meta.url),g=JSON.parse(fs.readFileSync(new URL('CURRENT.json',root))).generationId;
 const bytes=fs.readFileSync(new URL(`generations/${g}/generated/select4-t1.db`,root));
 const original=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/db');}finally{globalThis.fetch=original;}
 try{
  const cases=[
   ["SELECT count(*),count(j.atom),sum(j.atom) FROM t1 LEFT JOIN json_each('[]') j ON 1",[[31n,0n,null]]],
   ["SELECT t1.n,count(j.atom) FROM t1 LEFT JOIN json_each('[1]') j ON t1.n=j.atom WHERE t1.n<3 GROUP BY t1.n",[[1n,1n],[2n,0n]]],
   ["SELECT sum(j.atom)+1,count(*) FILTER (WHERE j.atom>1) FROM t1 CROSS JOIN json_each('[1,2]') j WHERE t1.n<3",[[7n,2n]]],
   ["SELECT t1.n,count(j.atom) FROM t1 INNER JOIN json_tree(jsonb('[1,2]')) j ON j.atom=t1.n GROUP BY t1.n HAVING count(j.atom)>0",[[1n,1n],[2n,1n]]],
  ];
  for(const [sql,want] of cases){const s=db.prepare(sql).statement;try{for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));assert.deepEqual(rows,want,sql);if(!pass)s.reset();}}finally{s.finalize();}}
 }finally{db.close();}
});

test('mixed JSON membership binds scalar and vector operands to current row',async()=>{
 const root=new URL('../fixtures/',import.meta.url),g=JSON.parse(fs.readFileSync(new URL('CURRENT.json',root))).generationId;
 const bytes=fs.readFileSync(new URL(`generations/${g}/generated/select4-t1.db`,root));
 const original=globalThis.fetch;let db;try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/db');}finally{globalThis.fetch=original;}
 try{for(const [filter,want] of [["j.atom IN (1,2)",[[1n,1n],[1n,2n],[2n,1n],[2n,2n]]],["(t1.n,j.atom) IN ((1,2),(2,1))",[[1n,2n],[2n,1n]]]]){
  const s=db.prepare(`SELECT t1.n,j.atom FROM t1 CROSS JOIN json_each('[1,2]') j WHERE t1.n<3 AND ${filter}`).statement;
  try{for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row')rows.push([s.column(0),s.column(1)]);assert.deepEqual(rows,want);if(!pass)s.reset();}}finally{s.finalize();}
 }}finally{db.close();}
});
