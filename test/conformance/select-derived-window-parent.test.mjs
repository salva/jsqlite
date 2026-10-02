import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

// Pinned pair: select-derived-window-parent-native.py; select.c tag-select-0488.
test('materialized window-derived producer precedes outer WHERE/ORDER/LIMIT',async()=>{
 const root=path.resolve('test/fixtures'),current=JSON.parse(fs.readFileSync(path.join(root,'CURRENT.json'),'utf8'));
 const bytes=fs.readFileSync(path.join(root,'generations',current.generationId,'generated/subquery-utf8.db'));
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});res.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  {const stmt=db.prepare('SELECT * FROM (SELECT a FROM (SELECT a FROM t1 LIMIT 2) LIMIT 1)').statement;try{assert.deepEqual(stmt.columnMetadata(0),{name:'a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});for(let cycle=0;cycle<2;cycle++){assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),1n);assert.equal(await stmt.step(),'done');if(!cycle)stmt.reset();}}finally{stmt.finalize();}}
  for(const [outer,want] of [['LIMIT 1 OFFSET 1',[3n]],['LIMIT 0',[]]]){const stmt=db.prepare(`SELECT * FROM (SELECT a FROM (SELECT a FROM t1 LIMIT 2) ${outer})`).statement;try{const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,want);}finally{stmt.finalize();}}
  // CTE clauses belong to their Select, not the enclosing compound chain.
  {const stmt=db.prepare('WITH c AS (SELECT a AS x FROM t1 LIMIT 2) SELECT x FROM c UNION ALL SELECT 9').statement;try{assert.deepEqual(stmt.columnMetadata(0),{name:'x',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,3n,9n]);if(cycle===0)stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('WITH c AS (SELECT a AS x FROM t1 LIMIT 2) SELECT missing FROM c UNION ALL SELECT 9'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('WITH c AS (SELECT a AS x FROM t1 LIMIT 0) SELECT x FROM c UNION ALL SELECT 9').statement;try{assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),9n);assert.equal(await stmt.step(),'done');}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT a FROM t1 LIMIT 2 UNION ALL SELECT 9'),error=>error.kind==='sqlite');
  for(const [sql,value] of [
    ['SELECT CASE WHEN (x=1) THEN (x) ELSE 0 END FROM t2 a FULL JOIN t2 b USING(x) WHERE x=1 LIMIT 1',1n],
    ['SELECT CASE (x) WHEN 1 THEN (x) ELSE 0 END FROM t2 a FULL JOIN t2 b USING(x) WHERE x=1 LIMIT 1',1n],
    ['SELECT b.x FROM t2 a FULL JOIN t2 b ON 0 WHERE a.x IS NULL AND b.x=9 LIMIT 1',9n]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),value);assert.equal(stmt.columnType(0),'integer');assert.equal(await stmt.step(),'done');stmt.reset();}}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT sum(a) FILTER (WHERE (a IN (1))) OVER () FROM (SELECT a FROM t1 LIMIT 2)').statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,1n]);if(cycle===0)stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
    ['SELECT sum(a) OVER () FROM (SELECT a FROM t1 LIMIT 0)',[]],
    ['SELECT sum(a) OVER () FROM (SELECT a FROM t1 LIMIT 1 OFFSET 1)',[3n]],
    ['SELECT sum(d.a) FILTER (WHERE d.a=1) OVER () FROM (SELECT a FROM t1 LIMIT 2) d LIMIT 1',[1n]]
  ]){const stmt=db.prepare(sql).statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT sum(missing) OVER () FROM (SELECT a FROM t1 LIMIT 2)'),error=>error.kind==='sqlite'&&/no such column: missing/.test(error.message));
  {const stmt=db.prepare('SELECT sum(a) FILTER (WHERE a=1) OVER (ORDER BY a GROUPS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE CURRENT ROW) FROM t1').statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[null,1n,1n,1n]);}finally{stmt.finalize();}}
  {const stmt=db.prepare("SELECT sum(a) FILTER (WHERE abs(a)=1) OVER (ORDER BY a ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) FROM t1").statement;try{const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,1n,1n,1n]);}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT sum(a) FILTER (WHERE CASE WHEN a=1 THEN NULL ELSE 0 END) OVER (GROUPS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING) FROM t1').statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){rows.push(stmt.column(0));assert.equal(stmt.columnType(0),'null');}assert.deepEqual(rows,[null,null,null,null]);if(cycle===0)stmt.reset();}}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT sum(a) FILTER (WHERE CASE WHEN a=1 THEN NULL ELSE 0 END) OVER (ORDER BY a RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE TIES) FROM t1').statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[null,null,null,null]);}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT sum(a) FILTER (WHERE a IN (1)) OVER (ORDER BY a ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1').statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[1n,1n,null,null]);}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT sum(a) FILTER (WHERE (a BETWEEN 1 AND 1)) OVER () FROM t1 LIMIT 1').statement;try{assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n);assert.equal(stmt.columnType(0),'integer');}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT row_number() OVER (ORDER BY a) FROM t1 WHERE (a=1)').statement;try{assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n);assert.equal(await stmt.step(),'done');}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT x FROM t2 a FULL JOIN t2 b USING(x) WHERE x=1 LIMIT 1').statement;try{assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n);assert.equal(stmt.columnType(0),'integer');}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT (SELECT sum((a)) FROM t1 WHERE (a=x)) AS v FROM t2 a FULL JOIN t2 b USING(x) LIMIT 1').statement;try{assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n);}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT coalesce(1,abs(-9223372036854775808)) AS x').statement;try{for(let i=0;i<2;i++){assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n);assert.equal(stmt.columnType(0),'integer');assert.equal(await stmt.step(),'done');stmt.reset();}}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT (SELECT a FROM t1 LIMIT 1) AS chosen').statement;try{assert.deepEqual(stmt.columnMetadata(0),{name:'chosen',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),1n);}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT d.x AS chosen FROM (SELECT a AS x FROM t1 LIMIT 1) d UNION ALL SELECT 2 ORDER BY 1').statement;try{assert.deepEqual(stmt.columnMetadata(0),{name:'chosen',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n);}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT d.x FROM (SELECT 9 AS x UNION ALL SELECT a FROM t1 LIMIT 2) d LIMIT 2').statement;try{assert.deepEqual(stmt.columnMetadata(0),{name:'x',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[9n,1n]);}finally{stmt.finalize();}}
  // Child coroutine payload stays three columns even for narrow/repeated parent EList.
  for(const [projection,names,expected] of [['d.z',['z'],[[30n],[31n]]],['d.z,d.x,d.z',['z','x','z'],[[30n,1n,30n],[31n,2n,31n]]]]){
   const stmt=db.prepare(`SELECT ${projection} FROM (SELECT 1 AS x,20 AS y,30 AS z UNION ALL SELECT 2,21,31 LIMIT 2) d LIMIT 2`).statement;
   try{for(let index=0;index<names.length;index++)assert.equal(stmt.columnMetadata(index).name,names[index]);for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){const row=[];for(let index=0;index<names.length;index++){assert.equal(stmt.columnType(index),'integer');row.push(stmt.column(index));}rows.push(row);}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}
  }
  const grouped=db.prepare('SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a').statement;
  try{assert.equal(grouped.columnMetadata(0).name,'s');assert.equal(grouped.columnMetadata(1).name,'r');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await grouped.step()==='row'){assert.equal(grouped.columnType(0),'integer');assert.equal(grouped.columnType(1),'integer');rows.push([grouped.column(0),grouped.column(1)]);}assert.deepEqual(rows,[[1n,1n],[3n,2n],[5n,3n],[7n,4n]]);grouped.reset();}}finally{grouped.finalize();}

  // Admitted recursive producer -> rewritten window source coroutine.
  const recursiveWindow=db.prepare('WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<4) SELECT row_number() OVER (ORDER BY x) AS r FROM q').statement;
  try{assert.equal(recursiveWindow.columnMetadata(0).name,'r');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await recursiveWindow.step()==='row'){assert.equal(recursiveWindow.columnType(0),'integer');rows.push(recursiveWindow.column(0));}assert.deepEqual(rows,[1n,2n,3n,4n]);recursiveWindow.reset();}}finally{recursiveWindow.finalize();}
  for(const [sql,expected] of [['WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<4 LIMIT 0) SELECT row_number() OVER (ORDER BY x) AS r FROM q',[]],['WITH RECURSIVE q(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM q WHERE x<4 LIMIT 2 OFFSET 1) SELECT row_number() OVER (ORDER BY x) AS r FROM q ORDER BY r DESC',[2n,1n]]]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  const generic=db.prepare('SELECT d.s FROM (SELECT sum(a) AS s FROM t1 UNION ALL SELECT 8 ORDER BY 1) d').statement;
  try{assert.equal(generic.columnMetadata(0).name,'s');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await generic.step()==='row'){assert.equal(generic.columnType(0),'integer');rows.push(generic.column(0));}assert.deepEqual(rows,[8n,16n]);generic.reset();}}finally{generic.finalize();}
  for(const [sql,expected] of [
    ['SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5) d',[3n,9n,1n,1n,3n]],
    ['SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5 LIMIT 3 OFFSET 1) d',[9n,1n,1n]],
    ['SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5) d LIMIT 2 OFFSET 1',[9n,1n]],
    ['SELECT d.x FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT x FROM t2 WHERE 0) d',[]],
    ['SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT x FROM t2 WHERE x<5 LIMIT 0) d',[]]
  ]){
    const residual=db.prepare(sql).statement;
    try{assert.equal(residual.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await residual.step()==='row'){assert.equal(residual.columnType(0),'integer');rows.push(residual.column(0));}assert.deepEqual(rows,expected);residual.reset();}}finally{residual.finalize();}
  }
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT missing FROM t2 WHERE 0 LIMIT 0) d'),/no such column: missing/);
  const cteCompound=db.prepare('WITH q(x) AS (VALUES(2),(1)) SELECT d.x FROM (SELECT x FROM q UNION ALL SELECT 8) d LIMIT 4').statement;
  try{assert.equal(cteCompound.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await cteCompound.step()==='row'){assert.equal(cteCompound.columnType(0),'integer');rows.push(cteCompound.column(0));}assert.deepEqual(rows,[2n,1n,8n]);cteCompound.reset();}}finally{cteCompound.finalize();}
  for(const [sql,expected] of [
    ['SELECT d.s FROM (SELECT sum(a) AS s FROM t1 WHERE a>1 UNION ALL SELECT 8) d LIMIT 4',[15n,8n]],
    ['SELECT d.s FROM (SELECT sum(a) AS s FROM t1 WHERE 0 UNION ALL SELECT 8) d LIMIT 4',[null,8n]],
    ['SELECT d.s FROM (SELECT sum(a) AS s FROM t1 WHERE a>1 UNION ALL SELECT 8) d LIMIT 0',[]]
  ]){
    const aggregateCompound=db.prepare(sql).statement;
    try{assert.equal(aggregateCompound.columnMetadata(0).name,'s');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await aggregateCompound.step()==='row'){const value=aggregateCompound.column(0);assert.equal(aggregateCompound.columnType(0),value===null?'null':'integer');rows.push(value);}assert.deepEqual(rows,expected);aggregateCompound.reset();}}finally{aggregateCompound.finalize();}
  }
  for(const sql of ['WITH q(x) AS (VALUES(2),(1)) SELECT d.x FROM (SELECT x FROM q UNION ALL SELECT x FROM q) d','WITH q(x) AS (VALUES(2),(1)) SELECT d.x FROM (SELECT x FROM q UNION ALL SELECT x FROM q) d LIMIT 4']){
    const statement=db.prepare(sql).statement;
    try{assert.equal(statement.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await statement.step()==='row'){assert.equal(statement.columnType(0),'integer');rows.push(statement.column(0));}assert.deepEqual(rows,[2n,1n,2n,1n]);statement.reset();}}finally{statement.finalize();}
  }
  for(const sql of ['SELECT d.r FROM (SELECT row_number() OVER () AS r UNION ALL SELECT 8) d LIMIT 4','SELECT row_number() OVER () AS r UNION ALL SELECT 8']){
    const statement=db.prepare(sql).statement;
    try{assert.equal(statement.columnMetadata(0).name,'r');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await statement.step()==='row'){assert.equal(statement.columnType(0),'integer');rows.push(statement.column(0));}assert.deepEqual(rows,[1n,8n]);statement.reset();}}finally{statement.finalize();}
  }
  for(const [sql,expected] of [
    ['SELECT d.r FROM (SELECT row_number() OVER () AS r UNION ALL SELECT row_number() OVER ()) d LIMIT 4',[1n,1n]],
    ['SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1 UNION ALL SELECT 8) d LIMIT 2 OFFSET 1',[2n,3n]],
    ['SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1 WHERE 0 UNION ALL SELECT 8) d LIMIT 4',[8n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  const nestedArm=db.prepare('SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1) n UNION ALL SELECT 8) d LIMIT 4').statement;
  try{assert.equal(nestedArm.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await nestedArm.step()==='row'){assert.equal(nestedArm.columnType(0),'integer');rows.push(nestedArm.column(0));}assert.deepEqual(rows,[3n,5n,7n,8n]);nestedArm.reset();}}finally{nestedArm.finalize();}
  for(const sql of ['SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1) UNION ALL SELECT 8) d LIMIT 4','SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1)']){
    const statement=db.prepare(sql).statement;
    try{assert.equal(statement.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await statement.step()==='row'){assert.equal(statement.columnType(0),'integer');rows.push(statement.column(0));}assert.deepEqual(rows,sql.includes('UNION ALL')?[3n,5n,7n,8n]:[3n,5n,7n]);statement.reset();}}finally{statement.finalize();}
  }
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1) UNION ALL SELECT missing_column) d LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const sql of ['SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 4','SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8']){
    const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[5n,7n,8n]);stmt.reset();}}finally{stmt.finalize();}
  }
  for(const [sql,expected] of [
    ['SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 WHERE 0 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 4',[8n]],
    ['SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 LIMIT 0) n UNION ALL SELECT 8) d LIMIT 4',[8n]],
    ['SELECT d.x FROM (SELECT x FROM (SELECT a AS x FROM t1 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 0',[]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const sql of ['SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2) n UNION ALL SELECT 8) d LIMIT 4','SELECT x FROM (SELECT DISTINCT x FROM t2) n UNION ALL SELECT 8']){
    const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,3n,9n,8n]);stmt.reset();}}finally{stmt.finalize();}
  }
  for(const [sql,expected] of [
    ['SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 1 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 4',[3n,8n]],
    ['SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 WHERE 0) n UNION ALL SELECT 8) d LIMIT 4',[8n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
    ['SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1',[9n,8n]],
    ['SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1) d LIMIT 1',[9n]],
    ['SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 0',[]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT DISTINCT x FROM t2 LIMIT 2 OFFSET 1) n UNION ALL SELECT missing_column LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const [sql,expected] of [
    ['SELECT d.x FROM (SELECT x FROM (SELECT DISTINCT x FROM t2 ORDER BY x LIMIT 2 OFFSET 1) n UNION ALL SELECT 8) d LIMIT 4',[3n,9n,8n]],
    ['SELECT x FROM (SELECT DISTINCT x FROM t2 ORDER BY x LIMIT 2 OFFSET 1) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1',[9n,8n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT DISTINCT x FROM t2 ORDER BY x DESC LIMIT 2) n UNION ALL SELECT 8'),error=>error.kind==='unsupported'&&error.unsupportedClassification==='temporary');
  for(const [sql,expected] of [
    ['SELECT d.x FROM (SELECT x FROM (SELECT 3 AS x LIMIT 1) n UNION ALL SELECT 8) d LIMIT 4',[3n,8n]],
    ['SELECT x FROM (SELECT 3 AS x LIMIT 1) n UNION ALL SELECT 8 LIMIT 1 OFFSET 1',[8n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const sql of ['SELECT x FROM (SELECT 3 AS x LIMIT 0) n UNION ALL SELECT 8','SELECT x FROM (SELECT 3 AS x LIMIT 1 OFFSET 1) n UNION ALL SELECT 8','SELECT x FROM (SELECT 3 AS x WHERE 0 LIMIT 1) n UNION ALL SELECT 8']){const stmt=db.prepare(sql).statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[8n]);}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT missing_column AS x LIMIT 0) n UNION ALL SELECT 8 LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const [sql,expected] of [
    ['SELECT d.column1 FROM (SELECT column1 FROM (VALUES(2),(1)) n UNION ALL SELECT 8) d LIMIT 4',[2n,1n,8n]],
    ['SELECT column1 FROM (VALUES(2),(1)) n UNION ALL SELECT 8 LIMIT 2 OFFSET 1',[1n,8n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'column1');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT missing_column FROM (VALUES(2),(1)) n UNION ALL SELECT 8 LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  assert.throws(()=>db.prepare('SELECT column1 FROM (VALUES(2),(1,3)) n UNION ALL SELECT 8 LIMIT 0'),error=>error.kind==='sqlite'&&/same number of terms/.test(error.message));
  {const stmt=db.prepare('SELECT n."x:1" FROM (SELECT 2 AS "x:", 1 AS "x:") n UNION ALL SELECT 8').statement;try{assert.equal(stmt.columnMetadata(0).name,'x:1');const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[1n,8n]);stmt.reset();}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[1n]);stmt.reset();}finally{stmt.finalize();}}


  for(const [sql,expected] of [
   ['SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1 OFFSET 1) AS x',3n],
   ['SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0) AS x',null],
   ['SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 WHERE 0 UNION ALL SELECT 8 WHERE 0) d) AS x',null],
   ['SELECT EXISTS(SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d) AS x',1n]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),expected);assert.equal(await stmt.step(),'done');stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 0) AS x'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,8n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 1 OFFSET 1',[8n]],
   ['SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0) AS x UNION ALL SELECT 8',[null,8n]],
   ['SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 0',[]]
  ]){const stmt=db.prepare(sql).statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 1 UNION ALL SELECT 8').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,8n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8 LIMIT 1 OFFSET 0',[8n]],
   ['SELECT 3 AS x WHERE EXISTS(SELECT d.a FROM (SELECT t1.a FROM t1 WHERE 0 UNION ALL SELECT 8 WHERE 0) d) UNION ALL SELECT 8',[8n]],
   ['SELECT 3 AS x WHERE EXISTS(SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d) UNION ALL SELECT 8 LIMIT 1 OFFSET 1',[8n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8 LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,8n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8',[8n]],
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 1',[1n,1n]],
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0) AS x UNION ALL SELECT 8 LIMIT 1 OFFSET 1',[8n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8 LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),1n);assert.equal(await stmt.step(),'done');stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0) AS x',[null]],
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x LIMIT 0',[]],
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x LIMIT 1 OFFSET 1',[]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1) AS x LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 1').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){assert.equal(await stmt.step(),'row');assert.equal(stmt.columnType(0),'integer');assert.equal(stmt.column(0),1n);assert.equal(await stmt.step(),'done');stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0',[]],
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE NULL',[]],
   ['SELECT 3 AS x WHERE EXISTS(SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d)',[3n]],
   ['SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 1 LIMIT 0',[]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1) AS x WHERE 0 LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  assert.throws(()=>db.prepare('SELECT 3 AS x WHERE missing_column'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x LIMIT 1) n UNION ALL SELECT 8').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,8n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x LIMIT 0) n UNION ALL SELECT 8',[8n]],
   ['SELECT x FROM (SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x LIMIT 1 OFFSET 1) n UNION ALL SELECT 8',[8n]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 LIMIT 1) n UNION ALL SELECT 8',[8n]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x LIMIT 1) n UNION ALL SELECT 8 LIMIT 1 OFFSET 1',[8n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1) AS x LIMIT 0) n UNION ALL SELECT 8'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 2) n').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,8n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 1 OFFSET 1) n',[8n]],
   ['SELECT x FROM (SELECT DISTINCT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8 LIMIT 1) n',[8n]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0) AS x UNION ALL SELECT 8 LIMIT 2) n',[null,8n]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 0) n',[]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1) AS x UNION ALL SELECT 8 LIMIT 0) n'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3) UNION ALL SELECT 8 LIMIT 3) n').statement;try{assert.equal(stmt.columnMetadata(0).name,'column1');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,3n,8n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3) UNION ALL SELECT 8 LIMIT 2 OFFSET 1) n',[3n,8n]],
   ['SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0)),(3) UNION ALL SELECT 8 LIMIT 3) n',[null,3n,8n]],
   ['SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3) UNION ALL SELECT 8 LIMIT 0) n',[]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 1)),(3) UNION ALL SELECT 8 LIMIT 0) n'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3)').statement;try{assert.equal(stmt.columnMetadata(0).name,'column1');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,3n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0)),(3)',[null,3n]],
   ['VALUES(3),((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1))',[3n,1n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('VALUES(3),((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 0))'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  assert.throws(()=>db.prepare('VALUES(3),(missing_column)'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3)) n').statement;try{assert.equal(stmt.columnMetadata(0).name,'column1');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,3n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3)) n LIMIT 1 OFFSET 1',[3n]],
   ['SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0)),(3)) n',[null,3n]],
   ['SELECT column1 FROM (VALUES((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1)),(3)) n LIMIT 0',[]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT column1 FROM (VALUES(3),((SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 0))) n LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 ORDER BY 1 DESC) n').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[8n,1n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION ALL SELECT 8 ORDER BY 1 DESC LIMIT 1 OFFSET 1) n',[1n]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 UNION ALL SELECT 8 ORDER BY 1 DESC LIMIT 1) n',[8n]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0) AS x UNION ALL SELECT 8 ORDER BY 1 DESC) n',[8n,null]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 0) AS x UNION ALL SELECT 8 ORDER BY 1 DESC LIMIT 0) n'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x UNION SELECT 8) n').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,8n]);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x INTERSECT SELECT 1) n',[1n]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x EXCEPT SELECT 1) n',[]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 0) AS x UNION SELECT NULL) n',[null]],
   ['SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) AS x WHERE 0 UNION SELECT 8) n',[8n]],
   ['SELECT x FROM (SELECT 1 AS x UNION SELECT 8 UNION ALL SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT 8) d LIMIT 1) LIMIT 2 OFFSET 1) n',[8n,1n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT missing_column) d LIMIT 0) AS x UNION SELECT 8 LIMIT 0) n'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const [sql,expected] of [
   ["SELECT * FROM (VALUES(2,NULL),(1,NULL),(2,NULL) UNION VALUES(1,NULL),(3,NULL)) n",[[1n,null],[2n,null],[3n,null]]],
   ["SELECT * FROM (VALUES(2,NULL),(1,NULL),(2,NULL) INTERSECT VALUES(2,NULL),(3,NULL)) n",[[2n,null]]],
   ["SELECT * FROM (VALUES(2,NULL),(1,NULL),(2,NULL) EXCEPT VALUES(2,NULL),(3,NULL)) n",[[1n,null]]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push([stmt.column(0),stmt.column(1)]);assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT 1 AS x WHERE 0 UNION SELECT 8) n',[8n]],
   ['SELECT x FROM (SELECT 1 AS x UNION SELECT 8 WHERE 0) n',[1n]],
   ['SELECT x FROM (SELECT 1 AS x WHERE 0 INTERSECT SELECT 8) n',[]],
   ['SELECT x FROM (SELECT 1 AS x EXCEPT SELECT 8 WHERE 0) n',[1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 LIMIT 1 OFFSET 1) n',[2n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 EXCEPT SELECT 2) n',[1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 INTERSECT SELECT 2) n',[2n]],
   ['SELECT x FROM (SELECT 2 AS x EXCEPT SELECT 2 UNION SELECT 1) n',[1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION SELECT 2 LIMIT 1 OFFSET 1) n',[2n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 2 UNION SELECT 1) n',[1n,2n]],
   ['SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 INTERSECT SELECT 2) n',[2n]],
   ['SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 EXCEPT SELECT 2) n',[1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 2 UNION SELECT 1 LIMIT 1 OFFSET 1) n',[2n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 2) n',[1n,2n,2n]],
   ['SELECT x FROM (SELECT 2 AS x EXCEPT SELECT 2 UNION ALL SELECT 1) n',[1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 2 LIMIT 2 OFFSET 1) n',[2n,2n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 2 LIMIT 1 OFFSET 2) n',[2n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 8 LIMIT 0) n',[]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 8 LIMIT 1) n',[1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 8 WHERE 0) n',[1n,2n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 8 UNION ALL SELECT 3) n',[1n,2n,8n,3n]]
  ]){const stmt=db.prepare(sql).statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT missing_column LIMIT 0) n'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 ORDER BY 1 DESC) n',[2n,1n]],
   ['SELECT x FROM (SELECT NULL AS x UNION SELECT 1 ORDER BY 1 DESC NULLS FIRST) n',[null,1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 3 ORDER BY 1 DESC LIMIT 2 OFFSET 1) n',[2n,1n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 UNION ALL SELECT 2 ORDER BY 1 DESC) n',[2n,2n,1n]],
   ['SELECT x FROM (SELECT NULL AS x UNION ALL SELECT 1 ORDER BY 1 DESC NULLS FIRST) n',[null,1n]],
   ['SELECT x FROM (SELECT 2 AS x UNION ALL SELECT 1 UNION ALL SELECT 2 ORDER BY 1 DESC LIMIT 2 OFFSET 1) n',[2n,1n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT * FROM (SELECT 2 AS x,1 AS y UNION ALL SELECT 1,2 UNION ALL SELECT 3,1 ORDER BY 2,1 DESC) n',[[3n,1n],[2n,1n],[1n,2n]]],
   ['SELECT * FROM (SELECT 2 AS x,1 AS y UNION ALL SELECT 1,2 UNION ALL SELECT 3,1 ORDER BY y,x DESC LIMIT 1 OFFSET 1) n',[[2n,1n]]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push([stmt.column(0),stmt.column(1)]);assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT (SELECT a FROM t1 LIMIT 1) AS x UNION SELECT 8',[1n,8n]],
   ['SELECT (SELECT 8) AS x EXCEPT SELECT 1',[8n]],
   ['SELECT (SELECT 8) AS x INTERSECT SELECT 8',[8n]],
   ['SELECT 1 AS x UNION SELECT 2 UNION ALL SELECT (SELECT 8)',[1n,2n,8n]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT 2 AS x UNION SELECT 1 EXCEPT SELECT 2',[1n]],
   ['SELECT 2 AS x UNION ALL SELECT 2 INTERSECT SELECT 2',[2n]],
   ['SELECT 2 AS x UNION SELECT 1 UNION ALL SELECT 8 LIMIT 2 OFFSET 1',[2n,8n]],
   ['SELECT 2 AS x UNION SELECT 1 ORDER BY 1 DESC LIMIT 1 OFFSET 1',[1n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT 2 AS x UNION ALL SELECT 2 UNION ALL SELECT 1 ORDER BY x DESC',[2n,2n,1n]],
   ['SELECT NULL AS x UNION ALL SELECT 1 ORDER BY 1 DESC NULLS FIRST',[null,1n]],
   ['SELECT (SELECT a FROM t1 LIMIT 1) AS x UNION ALL SELECT 8 ORDER BY 1 DESC LIMIT 1 OFFSET 1',[1n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  {const stmt=db.prepare('SELECT 2 AS x,1 AS y UNION ALL SELECT 1,2 UNION ALL SELECT 3,1 ORDER BY 2,1 DESC').statement;try{const rows=[];while(await stmt.step()==='row')rows.push([stmt.column(0),stmt.column(1)]);assert.deepEqual(rows,[[3n,1n],[2n,1n],[1n,2n]]);}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT (SELECT a FROM t1 LIMIT 1) AS x UNION ALL SELECT 8',[1n,8n]],
   ['SELECT 8 AS x UNION ALL SELECT (SELECT a FROM t1 LIMIT 1) LIMIT 1 OFFSET 1',[1n]],
   ['VALUES((SELECT a FROM t1 LIMIT 1)),(3) UNION ALL SELECT 8',[1n,3n,8n]],
   ['SELECT 8 AS x UNION ALL SELECT (SELECT a FROM t1 LIMIT 0)',[8n,null]]
  ]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT 8 AS x UNION ALL SELECT (SELECT missing_column FROM t1) LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const [sql,expected] of [
   ['VALUES((SELECT a FROM t1 LIMIT 1)),(3) UNION ALL SELECT a FROM t1',[1n,3n,1n,3n,5n,7n]],
   ['SELECT a AS x FROM t1 UNION ALL VALUES((SELECT a FROM t1 LIMIT 1)),(8)',[1n,3n,5n,7n,1n,8n]],
   ['VALUES((SELECT a FROM t1 LIMIT 1)),(3) UNION ALL SELECT a FROM t1 LIMIT 2 OFFSET 1',[3n,1n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,sql.startsWith('VALUES')?'column1':'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT a FROM t1 UNION ALL VALUES(1),((SELECT missing_column FROM t1)) UNION ALL SELECT 8 LIMIT 0'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const [sql,expected] of [
   ['SELECT a AS x FROM t1 UNION ALL SELECT (SELECT a FROM t1 LIMIT 1) ORDER BY 1',[1n,1n,3n,5n,7n]],
   ['SELECT a AS x FROM t1 UNION ALL VALUES((SELECT a FROM t1 LIMIT 1)),(8) UNION ALL SELECT 9 ORDER BY 1',[1n,1n,3n,5n,7n,8n,9n]],
   ['SELECT a AS x FROM t1 UNION ALL SELECT 8 WHERE (SELECT a FROM t1 LIMIT 1)=0 ORDER BY 1',[1n,3n,5n,7n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['WITH q(x) AS (VALUES((SELECT a FROM t1 WHERE a=1)),(3)) SELECT x FROM q UNION ALL SELECT x FROM q',[1n,3n,1n,3n]],
   ['WITH q(x) AS (SELECT (SELECT a FROM t1 WHERE 0)) SELECT x FROM q UNION ALL SELECT x FROM q',[null,null]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT a AS x FROM t1 WHERE a>3 UNION ALL SELECT 2 ORDER BY 1',[2n,5n,7n]],
   ['SELECT a AS x FROM t1 WHERE 0 UNION ALL SELECT 2 ORDER BY 1',[2n]],
   ['SELECT a AS x FROM t1 WHERE a=1 UNION ALL SELECT 1 ORDER BY 1',[1n,1n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT sum(a) AS x FROM t1 UNION ALL SELECT 2 ORDER BY 1',[2n,16n]],
   ['SELECT sum(a) AS x FROM t1 WHERE 0 UNION ALL SELECT 2 ORDER BY 1',[null,2n]],
   ['SELECT sum(a) AS x FROM t1 HAVING sum(a)>99 UNION ALL SELECT 2 ORDER BY 1',[2n]],
   ['SELECT sum(a) AS x FROM t1 GROUP BY a UNION ALL SELECT 2 ORDER BY 1',[1n,2n,3n,5n,7n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){const value=stmt.column(0);assert.equal(stmt.columnType(0),value===null?'null':'integer');rows.push(value);}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT DISTINCT a%2 AS x FROM t1 UNION ALL SELECT 1 ORDER BY 1',[1n,1n]],
   ['SELECT DISTINCT a AS x FROM t1 WHERE 0 UNION ALL SELECT 1 ORDER BY 1',[1n]],
   ['SELECT DISTINCT NULL AS x FROM t1 UNION ALL SELECT NULL ORDER BY 1',[null,null]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){const value=stmt.column(0);assert.equal(stmt.columnType(0),value===null?'null':'integer');rows.push(value);}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT a AS x FROM t1 UNION ALL SELECT DISTINCT (SELECT a FROM t1 WHERE a=1) ORDER BY 1',[1n,1n,3n,5n,7n]],
   ['SELECT a AS x FROM t1 UNION ALL SELECT DISTINCT NULL WHERE 0 ORDER BY 1',[1n,3n,5n,7n]],
   ['SELECT a AS x FROM t1 UNION ALL SELECT DISTINCT NULL ORDER BY 1',[null,1n,3n,5n,7n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){const value=stmt.column(0);assert.equal(stmt.columnType(0),value===null?'null':'integer');rows.push(value);}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['WITH q(x) AS (SELECT a FROM t1 WHERE a>3) SELECT x FROM q UNION ALL SELECT 2 ORDER BY 1',[2n,5n,7n]],
   ['WITH q(x) AS (SELECT a FROM t1 WHERE a>3) SELECT x FROM q WHERE x<7 UNION ALL SELECT 2 ORDER BY 1',[2n,5n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT row_number() OVER (ORDER BY a) AS x FROM t1 UNION ALL SELECT 2 ORDER BY 1',[1n,2n,2n,3n,4n]],
   ['SELECT row_number() OVER (ORDER BY a) AS x FROM t1 WHERE 0 UNION ALL SELECT 2 ORDER BY 1',[2n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT d.x FROM (SELECT a AS x FROM t1 WHERE a>3) d UNION ALL SELECT 2 ORDER BY 1',[2n,5n,7n]],
   ['SELECT d.x FROM (SELECT a AS x FROM t1 WHERE a>3) d WHERE d.x<7 UNION ALL SELECT 2 ORDER BY 1',[2n,5n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [
   ['SELECT d.x FROM (SELECT a AS x FROM t1 LIMIT 2) d UNION ALL SELECT 2 ORDER BY 1',[1n,2n,3n]],
   ['SELECT d.x FROM (SELECT a AS x FROM t1 LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1',[2n]]
  ]){const stmt=db.prepare(sql).statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  {const stmt=db.prepare("SELECT d.x FROM (SELECT 'a' COLLATE NOCASE AS x FROM t1 LIMIT 1) d UNION ALL SELECT 'B' ORDER BY 1").statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'text');rows.push(stmt.column(0));}assert.deepEqual(rows,['a','B']);stmt.reset();}}finally{stmt.finalize();}}
  {const stmt=db.prepare("SELECT d.x FROM (SELECT 'a' AS x FROM t1 LIMIT 1) d UNION ALL SELECT 'B' COLLATE NOCASE ORDER BY 1").statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'text');rows.push(stmt.column(0));}assert.deepEqual(rows,['B','a']);stmt.reset();}}finally{stmt.finalize();}}
  {const stmt=db.prepare("SELECT d.x FROM (SELECT 'a' COLLATE NOCASE AS x UNION ALL SELECT 'c') d UNION ALL SELECT 'B' ORDER BY 1").statement;try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'text');rows.push(stmt.column(0));}assert.deepEqual(rows,['a','B','c']);stmt.reset();}}finally{stmt.finalize();}}
  for(const sql of [
   'SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT missing FROM t1) d UNION ALL SELECT 2 ORDER BY 1',
   'SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT missing FROM t1 LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1'
  ])assert.throws(()=>db.prepare(sql),error=>error.kind==='sqlite'&&error.message.includes('no such column: missing'));
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT 1 AS x UNION ALL SELECT n.missing FROM (SELECT a AS x FROM t1 LIMIT 0) n) d UNION ALL SELECT 2 ORDER BY 1'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare("SELECT d.x AS renamed FROM (SELECT 'a' COLLATE NOCASE AS x LIMIT 1) d UNION ALL SELECT 'B' ORDER BY 1").statement;try{assert.equal(stmt.columnMetadata(0).name,'renamed');const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,['a','B']);}finally{stmt.finalize();}}
  {const stmt=db.prepare('WITH q(x) AS (VALUES(2),(1)) SELECT d.renamed FROM (SELECT x AS renamed FROM q UNION ALL SELECT x FROM q) d LIMIT 4').statement;try{assert.equal(stmt.columnMetadata(0).name,'renamed');const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[2n,1n,2n,1n]);}finally{stmt.finalize();}}
  for(const name of ['rowid','_rowid_','oid'])assert.throws(()=>db.prepare(`SELECT d.${name} FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1`),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT d.rowid FROM (SELECT 1 AS rowid LIMIT 1) d UNION ALL SELECT 2 ORDER BY 1').statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,[1n,2n]);}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT d.missing COLLATE NOCASE FROM (SELECT 1 AS x LIMIT 0) d UNION ALL SELECT 2 ORDER BY 1'),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  for(const name of ['rowid','_rowid_','oid'])assert.throws(()=>db.prepare(`SELECT (SELECT d.${name} FROM (SELECT a AS x FROM t1 UNION ALL SELECT 2) d LIMIT 0)`),error=>error.kind==='sqlite'&&/no such column/.test(error.message));
  {const stmt=db.prepare('SELECT d.x FROM (SELECT ((CAST(1 AS REAL))) AS x UNION ALL SELECT 2 LIMIT 2) d UNION ALL SELECT 3 ORDER BY 1').statement;try{assert.equal(stmt.columnMetadata(0).name,'x');assert.equal(stmt.columnMetadata(0).declaredType,null);for(let cycle=0;cycle<2;cycle++){const rows=[],types=[];while(await stmt.step()==='row'){rows.push(stmt.column(0));types.push(stmt.columnType(0));}assert.deepEqual(rows,[1,2n,3n]);assert.deepEqual(types,['real','integer','integer']);stmt.reset();}}finally{stmt.finalize();}}
  // Pinned window.c keeps ORDER BY on the parent, outside lifted AggInfo.
  const aliasOrder=db.prepare('SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY r DESC LIMIT 2 OFFSET 1').statement;
  try{assert.equal(aliasOrder.columnCount,2);assert.equal(aliasOrder.columnMetadata(0).name,'s');assert.equal(aliasOrder.columnMetadata(1).name,'r');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await aliasOrder.step()==='row'){assert.equal(aliasOrder.columnType(0),'integer');assert.equal(aliasOrder.columnType(1),'integer');rows.push([aliasOrder.column(0),aliasOrder.column(1)]);}assert.deepEqual(rows,[[5n,3n],[3n,2n]]);aliasOrder.reset();}}finally{aliasOrder.finalize();}
  for(const [sql,expected] of [['SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY s DESC LIMIT 2 OFFSET 1',[[5n,3n],[3n,2n]]],['SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY 2 DESC LIMIT 2 OFFSET 1',[[5n,3n],[3n,2n]]],['SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a ORDER BY a DESC LIMIT 2 OFFSET 1',[[5n,3n],[3n,2n]]],['SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 WHERE 0 GROUP BY a',[]],['SELECT sum(a) AS s, row_number() OVER (ORDER BY a) AS r FROM t1 GROUP BY a LIMIT 0',[]]]){const stmt=db.prepare(sql).statement;try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row')rows.push([stmt.column(0),stmt.column(1)]);assert.deepEqual(rows,expected);stmt.reset();}}finally{stmt.finalize();}}
  for(const [sql,expected] of [['SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1 ORDER BY d.r DESC LIMIT 2 OFFSET 1',[3n,2n]],['SELECT d.r FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1 ORDER BY d.r DESC LIMIT 0',[]]]){
   const stmt=db.prepare(sql).statement;
   try{
    assert.equal(stmt.columnCount,1);assert.equal(stmt.columnMetadata(0).name,'r');
    for(let i=0;i<2;i++){
     const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0))}
     assert.deepEqual(rows,expected);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT d.missing FROM (SELECT row_number() OVER (ORDER BY a) AS r FROM t1) d WHERE d.r>1'),/no such column: d\.missing/);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
});
