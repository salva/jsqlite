import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Independently captured pinned 3.53.4 before insertion:
// work:///cards/card-t-d/post-b622-integration/oracle.json and probe.py.
// These outer window producers must retain FILTER binding while preparing a
// transient FROM source, not enter an ordinary derived-scan shape rejection.
const cases=[
 ['SELECT d.a,count(*) FILTER (WHERE d.a>1) OVER (ORDER BY d.a) AS n FROM (SELECT a FROM t1 UNION ALL SELECT 9) d ORDER BY 1 LIMIT 3',[[1n,0n],[3n,1n],[5n,2n]]],
 ['WITH q AS (SELECT a FROM t1) SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a) AS n FROM q ORDER BY 1',[[1n,null],[3n,3n],[5n,8n],[7n,15n]]],
 ['SELECT t.a,count(*) FILTER (WHERE u.a>1) OVER (ORDER BY t.a) AS n FROM t1 t JOIN t1 u ON u.a=t.a ORDER BY 1',[[1n,0n],[3n,1n],[5n,2n],[7n,3n]]],
 ['SELECT d.a,sum(d.a) FILTER (WHERE d.a>1) OVER (ORDER BY d.a) AS n FROM (SELECT a FROM t1 WHERE a>1 LIMIT 2) d ORDER BY 1 LIMIT 1 OFFSET 1',[[5n,8n]]],
 ['SELECT d.a,count(*) FILTER (WHERE d.a>1) OVER (ORDER BY d.a) AS n FROM (SELECT a FROM t1 WHERE 0 UNION ALL SELECT 9) d ORDER BY 1',[[9n,1n]]],
 ['SELECT d.a,sum(d.a) FILTER (WHERE NULL) OVER (ORDER BY d.a) AS n FROM (SELECT a FROM t1 WHERE 0 UNION ALL SELECT 9 WHERE 0) d ORDER BY 1',[]],
 ['WITH q AS (SELECT a FROM t1 LIMIT 2) SELECT a,count(*) FILTER (WHERE a>1) OVER (ORDER BY a) AS n FROM q ORDER BY 1',[[1n,0n],[3n,1n]]],
];
for(const [sql,expected] of cases)test(`window transient producer preparation: ${sql}`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/window-transient');}finally{globalThis.fetch=prior;}
 let statement;
 try{
  statement=db.prepare(sql).statement;
  assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),['a','n']);
  for(let pass=0;pass<2;pass++){
   const actual=[];while(await statement.step()==='row')actual.push(Array.from({length:statement.columnCount},(_,i)=>[statement.columnType(i),statement.column(i)]));
   assert.deepEqual(actual,expected.map(row=>row.map(value=>[value===null?'null':'integer',value])));
   assert.equal(await statement.step(),'done');if(pass===0)statement.reset();
  }
 }finally{statement?.finalize();db.close();}
});
