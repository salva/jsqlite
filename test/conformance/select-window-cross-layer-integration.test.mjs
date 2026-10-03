import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Native-first current integration capture, source ID asserted independently:
// work:///cards/card-t-d/post-b658-integration/narrow-oracle.json.
// window.c windowReturnOneRow must not lose an incompatible layer's output
// or substitute cumulative first_value for a bounded frame.
// CAST argument native rows/names: card-t-c cast-window-repair/oracle-metadata.json.
// Independent compound aggregate producer rows/names: card-t-c compound-window-repair/oracle-expanded.json.
// Pinned scalar-subquery producer baseline: card-t-c window-subquery-{red,repair}/oracle*.json.
const cases=[
 // Recursive GROUP/window moved-column identity: post-c1000 native-first repro;
 // additional six pinned controls captured after repair (not native-first).
 ["WITH RECURSIVE q(a) AS(VALUES(1) UNION ALL SELECT a+2 FROM q WHERE a<7) SELECT a%3,max(a),(SELECT (SELECT q.a)),first_value(a) OVER(ORDER BY a%3) FROM q GROUP BY a%3 ORDER BY 1",[[0n,3n,3n,3n],[1n,7n,7n,3n],[2n,5n,5n,3n]],["a%3", "max(a)", "(SELECT (SELECT q.a))", "first_value(a) OVER(ORDER BY a%3)"]],
 ["WITH RECURSIVE q(a) AS(VALUES(1) UNION ALL SELECT a+2 FROM q WHERE a<7) SELECT a%3,max(a),(SELECT q.a),first_value(a) OVER(ORDER BY a%3) FROM q GROUP BY a%3 ORDER BY 1",[[0n,3n,3n,3n],[1n,7n,7n,3n],[2n,5n,5n,3n]],["a%3", "max(a)", "(SELECT q.a)", "first_value(a) OVER(ORDER BY a%3)"]],
 ["WITH RECURSIVE q(a) AS(VALUES(1) UNION ALL SELECT a+2 FROM q WHERE a<7) SELECT a%3,max(a) FILTER(WHERE a<7),(SELECT (SELECT q.a)),first_value(a) OVER(ORDER BY a%3) FROM q GROUP BY a%3 ORDER BY 1",[[0n,3n,3n,3n],[1n,1n,1n,3n],[2n,5n,5n,3n]],["a%3", "max(a) FILTER(WHERE a<7)", "(SELECT (SELECT q.a))", "first_value(a) OVER(ORDER BY a%3)"]],
 ["WITH RECURSIVE q(a) AS(VALUES(1) UNION ALL SELECT a+2 FROM q WHERE a<7) SELECT a%3,max(a),(SELECT (SELECT q.a WHERE q.a>3 LIMIT 0.5)),first_value(a) OVER(ORDER BY a%3) FROM q GROUP BY a%3 ORDER BY 1",[[0n,3n,null,3n],[1n,7n,7n,3n],[2n,5n,5n,3n]],["a%3", "max(a)", "(SELECT (SELECT q.a WHERE q.a>3 LIMIT 0.5))", "first_value(a) OVER(ORDER BY a%3)"]],
 ["WITH RECURSIVE q(a) AS(VALUES(1) UNION ALL SELECT a+2 FROM q WHERE a<7) SELECT a%3,max(a),first_value((SELECT (SELECT q.a))) OVER(ORDER BY a%3) FROM q GROUP BY a%3 ORDER BY 1",[[0n,3n,3n],[1n,7n,3n],[2n,5n,3n]],["a%3", "max(a)", "first_value((SELECT (SELECT q.a))) OVER(ORDER BY a%3)"]],
 ["WITH RECURSIVE q(a) AS(VALUES(1) UNION ALL SELECT a+2 FROM q WHERE a<7) SELECT a%3,max(a),(SELECT (SELECT q.a)),first_value(a) OVER(ORDER BY a%3),sum(count(*)) OVER(ORDER BY a%3 ROWS 1 PRECEDING) FROM q GROUP BY a%3 ORDER BY 1",[[0n,3n,3n,3n,1n],[1n,7n,7n,3n,3n],[2n,5n,5n,3n,3n]],["a%3", "max(a)", "(SELECT (SELECT q.a))", "first_value(a) OVER(ORDER BY a%3)", "sum(count(*)) OVER(ORDER BY a%3 ROWS 1 PRECEDING)"]],
 ["WITH RECURSIVE q(a) AS(VALUES(1) UNION ALL SELECT a+2 FROM q WHERE a<7) SELECT a%3,max(a),(SELECT (SELECT q.a)),first_value(a) OVER(ORDER BY a%3) FROM q WHERE 0 GROUP BY a%3 ORDER BY 1",[],["a%3", "max(a)", "(SELECT (SELECT q.a))", "first_value(a) OVER(ORDER BY a%3)"]],
 // Native-first grouped rewrite payload/output capture: card-t-c/group-filter-window-red/oracle.json.
 ["SELECT t.a%3,max(t.a) FILTER(WHERE t.a<7),t.a,first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t GROUP BY t.a%3",[[0n,3n,3n,3n],[1n,1n,1n,3n],[2n,5n,5n,3n]],["t.a%3", "max(t.a) FILTER(WHERE t.a<7)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a%3,max(t.a),t.a,first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t GROUP BY t.a%3",[[0n,3n,3n,3n],[1n,7n,7n,3n],[2n,5n,5n,3n]],["t.a%3", "max(t.a)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a%3,max(t.a) FILTER(WHERE t.a<7),t.a,first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t GROUP BY t.a%3",[[0n,3n,3n,3n],[1n,1n,1n,3n],[2n,5n,5n,3n]],["t.a%3", "max(t.a) FILTER(WHERE t.a<7)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a%3,max(NULL),t.a,first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t GROUP BY t.a%3",[[0n,null,3n,3n],[1n,null,7n,3n],[2n,null,5n,3n]],["t.a%3", "max(NULL)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a%3,max(t.a%2),t.a,first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t GROUP BY t.a%3",[[0n,1n,3n,3n],[1n,1n,1n,3n],[2n,1n,5n,3n]],["t.a%3", "max(t.a%2)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a%3,min(t.a) FILTER(WHERE 0),t.a,first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t GROUP BY t.a%3",[[0n,null,3n,3n],[1n,null,1n,3n],[2n,null,5n,3n]],["t.a%3", "min(t.a) FILTER(WHERE 0)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a%3,max(t.a) FILTER(WHERE t.a<7),min(t.a),t.a,first_value(t.a) OVER (ORDER BY t.a%3),row_number() OVER (ORDER BY t.a%3 DESC) FROM t1 t GROUP BY t.a%3 ORDER BY 1 DESC LIMIT 2 OFFSET 1",[[1n,1n,1n,1n,3n,2n],[0n,3n,3n,3n,3n,3n]],["t.a%3", "max(t.a) FILTER(WHERE t.a<7)", "min(t.a)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)", "row_number() OVER (ORDER BY t.a%3 DESC)"]],
 ["SELECT t.a%3,max(t.a) FILTER(WHERE t.a<7),t.a,first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t WHERE 0 GROUP BY t.a%3",[],["t.a%3", "max(t.a) FILTER(WHERE t.a<7)", "a", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a%3,max(t.a) FILTER(WHERE t.a<7),t.a,(SELECT t.a),first_value(t.a) OVER (ORDER BY t.a%3) FROM t1 t GROUP BY t.a%3",[[0n,3n,3n,3n,3n],[1n,1n,1n,1n,3n],[2n,5n,5n,5n,3n]],["t.a%3", "max(t.a) FILTER(WHERE t.a<7)", "a", "(SELECT t.a)", "first_value(t.a) OVER (ORDER BY t.a%3)"]],
 ["SELECT t.a,first_value((SELECT max(u.a) FROM t1 u WHERE u.a<t.a)) OVER (ORDER BY t.a) FROM t1 t ORDER BY 1",[[1n,null],[3n,null],[5n,null],[7n,null]],["a", "first_value((SELECT max(u.a) FROM t1 u WHERE u.a<t.a)) OVER (ORDER BY t.a)"]],
 ["SELECT t.a,first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY t.a) FROM t1 t ORDER BY 1",[[1n,7n],[3n,7n],[5n,7n],[7n,7n]],["a", "first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY t.a)"]],
 ["SELECT t.a,first_value((SELECT NULL)) OVER (ORDER BY t.a) FROM t1 t ORDER BY 1",[[1n,null],[3n,null],[5n,null],[7n,null]],["a", "first_value((SELECT NULL)) OVER (ORDER BY t.a)"]],
 ["SELECT t.a,first_value((SELECT u.a FROM t1 u WHERE 0)) OVER (ORDER BY t.a) FROM t1 t ORDER BY 1",[[1n,null],[3n,null],[5n,null],[7n,null]],["a", "first_value((SELECT u.a FROM t1 u WHERE 0)) OVER (ORDER BY t.a)"]],
 ["WITH q AS (SELECT a FROM t1 LIMIT 3) SELECT a,first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY a) FROM q ORDER BY 1 LIMIT 2",[[1n,7n],[3n,7n]],["a", "first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY a)"]],
 ["SELECT count(*) AS a,first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY count(*)) FROM t1 GROUP BY a%3 ORDER BY 1",[[1n,7n],[1n,7n],[2n,7n]],["a", "first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY count(*))"]],
 ["SELECT t.a,first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY t.a),sum(t.a) OVER (ORDER BY t.a ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1 t ORDER BY 1 LIMIT 2",[[1n,7n,1n],[3n,7n,3n]],["a", "first_value((SELECT max(u.a) FROM t1 u)) OVER (ORDER BY t.a)", "sum(t.a) OVER (ORDER BY t.a ROWS BETWEEN CURRENT ROW AND CURRENT ROW)"]],
 ["SELECT t.a,first_value((SELECT u.a FROM t1 u WHERE u.a=t.a LIMIT 1)) OVER (ORDER BY t.a ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1 t ORDER BY 1",[[1n,1n],[3n,3n],[5n,5n],[7n,7n]],["a", "first_value((SELECT u.a FROM t1 u WHERE u.a=t.a LIMIT 1)) OVER (ORDER BY t.a ROWS BETWEEN CURRENT ROW AND CURRENT ROW)"]],
 ["SELECT t.a,first_value((SELECT u.a FROM t1 u WHERE u.a=t.a LIMIT 0)) OVER (ORDER BY t.a) FROM t1 t ORDER BY 1",[[1n,null],[3n,null],[5n,null],[7n,null]],["a", "first_value((SELECT u.a FROM t1 u WHERE u.a=t.a LIMIT 0)) OVER (ORDER BY t.a)"]],
 ["SELECT t.a,first_value(CAST((SELECT max(u.a) FROM t1 u) AS REAL)) OVER (ORDER BY t.a) FROM t1 t ORDER BY 1",[[1n,7.0],[3n,7.0],[5n,7.0],[7n,7.0]],["a", "first_value(CAST((SELECT max(u.a) FROM t1 u) AS REAL)) OVER (ORDER BY t.a)"]],
 ["SELECT t.a,first_value((SELECT max(u.a) FROM t1 u WHERE 0)) OVER (ORDER BY t.a) FROM t1 t ORDER BY 1",[[1n,null],[3n,null],[5n,null],[7n,null]],["a", "first_value((SELECT max(u.a) FROM t1 u WHERE 0)) OVER (ORDER BY t.a)"]],
 ["SELECT t.a,first_value((SELECT u.a FROM t1 u WHERE u.a=t.a LIMIT -1)) OVER (ORDER BY t.a ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1 t ORDER BY 1",[[1n,1n],[3n,3n],[5n,5n],[7n,7n]],["a", "first_value((SELECT u.a FROM t1 u WHERE u.a=t.a LIMIT -1)) OVER (ORDER BY t.a ROWS BETWEEN CURRENT ROW AND CURRENT ROW)"]],
 ["SELECT d.a,first_value(d.a) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1) d ORDER BY 1",[[16n,16n]],["a", "first_value(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,first_value(d.a) OVER (ORDER BY d.a) FROM (SELECT a FROM t1 GROUP BY a UNION ALL SELECT a FROM t1 GROUP BY a HAVING a>3) d ORDER BY 1",[[1n,1n],[3n,1n],[5n,1n],[5n,1n],[7n,1n],[7n,1n]],["a", "first_value(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,nth_value(d.a,2) OVER (ORDER BY d.a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM (SELECT sum(a) AS a FROM t1 UNION ALL SELECT count(*) FROM t1) d ORDER BY 1",[[4n,null],[16n,16n]],["a", "nth_value(d.a,2) OVER (ORDER BY d.a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)"]],
 ["SELECT d.a,first_value(d.a) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1 WHERE 0 UNION ALL SELECT count(*) FROM t1 WHERE 0) d ORDER BY 1",[[null,null],[0n,null]],["a", "first_value(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,first_value(d.a) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1 UNION ALL SELECT count(*) FROM t1 LIMIT 1) d ORDER BY 1",[[16n,16n]],["a", "first_value(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,first_value(d.a) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1 UNION ALL SELECT count(*) FROM t1 ORDER BY 1 LIMIT 1) d ORDER BY 1",[[4n,4n]],["a", "first_value(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,sum(d.a) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1 GROUP BY a%2 UNION ALL SELECT count(*) FROM t1 GROUP BY a%2 HAVING count(*)>0) d ORDER BY 1",[[4n,4n],[16n,20n]],["a", "sum(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,first_value(CAST(d.a AS REAL)) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1 UNION ALL SELECT count(*) FROM t1) d ORDER BY 1 LIMIT 1 OFFSET 1",[[16n,4.0]],["a", "first_value(CAST(d.a AS REAL)) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,first_value(d.a) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1 WHERE a>3 UNION ALL SELECT count(*) FROM t1 WHERE a<5) d ORDER BY 1",[[2n,2n],[12n,2n]],["a", "first_value(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,sum(d.a) OVER (ORDER BY d.a) FROM (SELECT sum(a) AS a FROM t1 GROUP BY a%4 UNION ALL SELECT count(*) FROM t1 GROUP BY a%4 HAVING count(*)>1) d ORDER BY 1",[[2n,4n],[2n,4n],[6n,10n],[10n,20n]],["a", "sum(d.a) OVER (ORDER BY d.a)"]],
 ["SELECT d.a,nth_value(d.a,2) OVER (ORDER BY d.a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM (SELECT sum(a) AS a FROM t1 UNION ALL SELECT count(*) FROM t1 LIMIT 0) d ORDER BY 1",[],["a", "nth_value(d.a,2) OVER (ORDER BY d.a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)"]],
 ["SELECT a,first_value(CAST(a AS REAL)) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1 ORDER BY a",[[1n,1.0],[3n,1.0],[5n,3.0],[7n,5.0]],["a", "first_value(CAST(a AS REAL)) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)"]],
 ["SELECT a,first_value(CAST(NULL AS REAL)) OVER (ORDER BY a) FROM t1 ORDER BY a LIMIT 2",[[1n,null],[3n,null]],["a", "first_value(CAST(NULL AS REAL)) OVER (ORDER BY a)"]],
 ["SELECT a,first_value(CAST(a AS TEXT)) OVER (ORDER BY a) FROM t1 ORDER BY a LIMIT 2",[[1n,"1"],[3n,"1"]],["a", "first_value(CAST(a AS TEXT)) OVER (ORDER BY a)"]],
 ["SELECT a,first_value(CAST(a AS REAL)+1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1 ORDER BY a LIMIT 2",[[1n,2.0],[3n,2.0]],["a", "first_value(CAST(a AS REAL)+1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)"]],
 ["SELECT a,lag(CAST(a AS REAL),1,0) OVER (ORDER BY a) FROM t1 ORDER BY a LIMIT 3",[[1n,0n],[3n,1.0],[5n,3.0]],["a", "lag(CAST(a AS REAL),1,0) OVER (ORDER BY a)"]],
 ["SELECT a,sum(CAST(a AS REAL)) FILTER (WHERE a>1) OVER (ORDER BY a) FROM t1 ORDER BY a LIMIT 2",[[1n,null],[3n,3.0]],["a", "sum(CAST(a AS REAL)) FILTER (WHERE a>1) OVER (ORDER BY a)"]],
 ["SELECT d.a,first_value(CAST(d.a AS REAL)) OVER (ORDER BY d.a) FROM (SELECT a FROM t1 LIMIT 3) d ORDER BY 1 LIMIT 2",[[1n,1.0],[3n,1.0]],["a", "first_value(CAST(d.a AS REAL)) OVER (ORDER BY d.a)"]],
 ["WITH q AS (SELECT a FROM t1 LIMIT 3) SELECT a,first_value(CAST(a AS REAL)) OVER (ORDER BY a) FROM q ORDER BY 1 LIMIT 2",[[1n,1.0],[3n,1.0]],["a", "first_value(CAST(a AS REAL)) OVER (ORDER BY a)"]],
 ['SELECT count(*) AS a,sum(count(*)) FILTER (WHERE count(*)<0) OVER (ORDER BY count(*)) AS s FROM t1 GROUP BY a%2 ORDER BY 1 LIMIT 1',[[4n,null]]],
 ['SELECT count(*) AS a,sum(count(*)) FILTER (WHERE NULL) OVER (ORDER BY count(*)) AS s FROM t1 GROUP BY a%2 ORDER BY 1 LIMIT 1',[[4n,null]]],
 ['SELECT count(*) AS a,sum(CAST(count(*) AS REAL)) FILTER (WHERE count(*)>0) OVER (ORDER BY count(*)) AS s FROM t1 GROUP BY a%2 ORDER BY 1 LIMIT 1',[[4n,4]]],
 ['SELECT count(*) AS a,sum(count(*)) FILTER (WHERE count(*)>0) OVER (ORDER BY count(*)) AS s FROM t1 GROUP BY a%2 ORDER BY 1 LIMIT 1',[[4n,4n]]],
 ['SELECT a,sum(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING EXCLUDE CURRENT ROW) AS s,lag(a,1,0) OVER (ORDER BY a) AS l FROM t1 ORDER BY a',[[1n,3n,0n],[3n,6n,1n],[5n,10n,3n],[7n,5n,5n]]],
 ['SELECT a,lag(a,1,0) OVER (ORDER BY a) AS l,first_value(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS f FROM t1 ORDER BY a',[[1n,0n,1n],[3n,1n,1n],[5n,3n,3n],[7n,5n,5n]]],
 ['SELECT a,nth_value(a,2) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS f FROM t1 ORDER BY a',[[1n,null],[3n,3n],[5n,5n],[7n,7n]]],
 ['SELECT a,first_value(a) OVER (ORDER BY a ROWS BETWEEN CURRENT ROW AND CURRENT ROW) AS f FROM t1 ORDER BY a',[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]],
 ['SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING EXCLUDE CURRENT ROW) AS s FROM t1 ORDER BY a',[[1n,3n],[3n,5n],[5n,10n],[7n,5n]]],
 ['SELECT a,sum(a) OVER (ORDER BY a ROWS BETWEEN 0 PRECEDING AND 0 FOLLOWING EXCLUDE CURRENT ROW) AS s FROM t1 ORDER BY a',[[1n,null],[3n,null],[5n,null],[7n,null]]],
 ['SELECT a,first_value(a) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS f FROM t1 WHERE 0 ORDER BY a',[]],
 ['WITH RECURSIVE q(a) AS (VALUES(1) UNION ALL SELECT a+1 FROM q WHERE a<4 LIMIT 3) SELECT a,sum(a) FILTER (WHERE a>1) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES) AS s FROM q ORDER BY 1 LIMIT 2 OFFSET 1',[[2n,2n],[3n,5n]]],
 // Multi-column recursive payload identity; pin-captured native-extra before durable expansion.
 ['WITH RECURSIVE q(a,b) AS (VALUES(1,10) UNION ALL SELECT a+1,b+10 FROM q WHERE a<4 LIMIT 3) SELECT a,sum(b) FILTER (WHERE b>10) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) AS s FROM q ORDER BY 1 DESC LIMIT 2',[[3n,50n],[2n,20n]]],
 ['WITH RECURSIVE q(a,b) AS (VALUES(1,10) UNION ALL SELECT a+1,b+10 FROM q WHERE a<4 LIMIT 3) SELECT a,sum(b) FILTER (WHERE b>10) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE GROUP) AS s FROM q ORDER BY 1 DESC LIMIT 2',[[3n,20n],[2n,null]]],
 ['WITH RECURSIVE q(a,b) AS (VALUES(1,10) UNION ALL SELECT a+1,b+10 FROM q WHERE a<4 LIMIT 3) SELECT a,sum(b) FILTER (WHERE b>10) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE TIES) AS s FROM q ORDER BY 1 DESC LIMIT 2',[[3n,50n],[2n,20n]]],
 ['WITH RECURSIVE q(a,b) AS (VALUES(1,10) UNION ALL SELECT a+1,b+10 FROM q WHERE a<4 LIMIT 3) SELECT a,sum(b) FILTER (WHERE b>10) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS) AS s FROM q ORDER BY 1 DESC LIMIT 2',[[3n,50n],[2n,20n]]],
 // window.c789–820 replaces nested finalized aggregates with prior ephemeral columns.
 ["SELECT count(*) AS a,first_value(CAST(count(*) AS TEXT)) OVER (ORDER BY count(*)),sum(count(*)) FILTER (WHERE count(*)>0) OVER (ORDER BY count(*) ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1 GROUP BY a%3 HAVING count(*)>0 ORDER BY 1",[[1n,"1",1n],[1n,"1",1n],[2n,"1",2n]],["a", "first_value(CAST(count(*) AS TEXT)) OVER (ORDER BY count(*))", "sum(count(*)) FILTER (WHERE count(*)>0) OVER (ORDER BY count(*) ROWS BETWEEN CURRENT ROW AND CURRENT ROW)"]],
];
for(const [sql,expected,names] of cases)test(`window cross-layer allocator integration: ${sql}`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/window-transient');}finally{globalThis.fetch=prior;}
 let statement;
 try{
  for(const invalid of ['SELECT sum(count(*)) FROM t1','SELECT sum(a) FILTER (WHERE count(*)>0) FROM t1'])assert.throws(()=>db.prepare(invalid),error=>error.kind==='sqlite'&&error.code===1&&error.message==='misuse of aggregate function count()');
  statement=db.prepare(sql).statement;
  assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),names??(sql.includes(' AS l,')?['a','l','f']:sql.includes(' AS l FROM')?['a','s','l']:sql.includes(' AS f FROM')?['a','f']:['a','s']));
  for(let pass=0;pass<2;pass++){
   const actual=[];while(await statement.step()==='row')actual.push(Array.from({length:statement.columnCount},(_,i)=>[statement.columnType(i),statement.column(i)]));
   assert.deepEqual(actual,expected.map(row=>row.map(value=>[value===null?'null':typeof value==='number'?'real':typeof value==='string'?'text':'integer',value])));
   assert.equal(await statement.step(),'done');if(pass===0)statement.reset();
  }
 }finally{statement?.finalize();db.close();}
});

for(const compound of [false,true])test(`scanned ROWS binding and error reset preserve frame checks (compound=${compound})`,async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/window-scan-errors');}finally{globalThis.fetch=prior;}
 const statement=db.prepare(compound?'SELECT a,first_value(a) OVER (ORDER BY a ROWS BETWEEN ?1 PRECEDING AND CURRENT ROW) AS f FROM (SELECT sum(a) AS a FROM t1 UNION ALL SELECT count(*) FROM t1) d ORDER BY a':'SELECT a,first_value(a) OVER (ORDER BY a ROWS BETWEEN ?1 PRECEDING AND CURRENT ROW) AS f FROM t1 ORDER BY a').statement;
 const read=async()=>{const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);return rows;};
 try{
  await assert.rejects(read,{code:1,message:'frame starting offset must be a non-negative integer'});
  assert.throws(()=>statement.reset(),{code:1,message:'frame starting offset must be a non-negative integer'});statement.bind(1,1n);assert.deepEqual(await read(),(compound?[[4n,4n],[16n,4n]]:[[1n,1n],[3n,1n],[5n,3n],[7n,5n]]));
  statement.reset();statement.bind(1,0n);assert.deepEqual(await read(),(compound?[[4n,4n],[16n,16n]]:[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]));
 }finally{statement.finalize();db.close();}
});

test('endpoint nth validates current argument before seek, preserving saved errors',async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/endpoint');globalThis.fetch=prior;
  const s=db.prepare('SELECT nth_value(a,?) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1').statement;
  for(const n of [null,0n,-1n,1.5,'bad']){
   s.bind(1,n);await assert.rejects(s.step(),e=>e.code===1&&e.message==='second argument to nth_value must be a positive integer');
   assert.throws(()=>s.reset(),e=>e.code===1);
  }
  s.bind(1,'2');const rows=[];while(await s.step()==='row')rows.push(s.column(0));assert.deepEqual(rows,[null,3n,5n,7n]);s.finalize();
 }finally{globalThis.fetch=prior;db?.close();}
});

test('window scalar subselect LIMIT binds/reset and lexical prepare errors remain owned',async()=>{
 const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/subquery-utf8.db`,import.meta.url));
 const prior=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/window-subselect');}finally{globalThis.fetch=prior;}
 let statement;
 try{
  assert.throws(()=>db.prepare('SELECT first_value((SELECT missing FROM t1)) OVER () FROM t1'),error=>error.kind==='sqlite'&&error.code===1&&error.message==='no such column: missing');
  assert.throws(()=>db.prepare('SELECT first_value((SELECT a,a FROM t1)) OVER () FROM t1'),error=>error.kind==='sqlite'&&error.code===1&&error.message==='sub-select returns 2 columns - expected 1');
  statement=db.prepare('SELECT t.a,first_value((SELECT u.a FROM t1 u WHERE u.a=t.a LIMIT ?1)) OVER (ORDER BY t.a ROWS BETWEEN CURRENT ROW AND CURRENT ROW) FROM t1 t ORDER BY 1 LIMIT 2').statement;
  const read=async()=>{const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);return rows;};
  statement.bind(1,0n);assert.deepEqual(await read(),[[1n,null],[3n,null]]);
  statement.reset();statement.bind(1,1n);assert.deepEqual(await read(),[[1n,1n],[3n,3n]]);
  statement.reset();statement.bind(1,'bad');assert.deepEqual(await read(),[[1n,1n],[3n,3n]]);
  statement.reset();statement.bind(1,0.5);assert.deepEqual(await read(),[[1n,1n],[3n,3n]]);
  statement.reset();statement.bind(1,'0');assert.deepEqual(await read(),[[1n,null],[3n,null]]);
  statement.reset();statement.bind(1,null);await assert.rejects(read,error=>error.kind==='sqlite'&&error.code===20);
  assert.throws(()=>statement.reset(),error=>error.kind==='sqlite'&&error.code===20);
  statement.bind(1,-1n);assert.deepEqual(await read(),[[1n,1n],[3n,3n]]);
 }finally{statement?.finalize();db.close();}
});
