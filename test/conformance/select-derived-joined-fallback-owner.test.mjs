import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const sql='SELECT d.x FROM (SELECT t2.x AS x FROM t1 JOIN t2 ON t1.a=t2.x UNION ALL SELECT 9 ORDER BY 1) d LIMIT 2 OFFSET 1';
test('admitted joined ordered ALL derived producer preserves public boundary',async()=>{
 const current=JSON.parse(fs.readFileSync('test/fixtures/CURRENT.json','utf8'));
 const body=fs.readFileSync(`test/fixtures/generations/${current.generationId}/generated/subquery-utf8.db`);
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':body.length});res.end(body)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  const mixed=db.prepare('SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d LIMIT 2 OFFSET 1').statement;
  try{for(let cycle=0;cycle<2;cycle++){const rows=[];while(await mixed.step()==='row'){assert.equal(mixed.columnType(0),'integer');rows.push(mixed.column(0));}assert.deepEqual(rows,[9n,8n]);mixed.reset();}}finally{mixed.finalize();}
  for(const [query,expected] of [['SELECT d.x FROM (SELECT 8 AS x UNION ALL SELECT x FROM t2 WHERE x>1) d LIMIT 2 OFFSET 1',[3n,9n]],['SELECT d.x FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8) d LIMIT 2',[8n]],['SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d LIMIT 0',[]]]){
   const stmt=db.prepare(query).statement;
   try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);}finally{stmt.finalize();}
  }
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT x FROM t2 UNION ALL SELECT missing) d LIMIT 1'),error=>error.code===1);
  const agg=db.prepare('SELECT count(d.x) AS n FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d').statement;
  try{assert.equal(agg.columnMetadata(0).name,'n');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await agg.step()==='row'){assert.equal(agg.columnType(0),'integer');rows.push(agg.column(0));}assert.deepEqual(rows,[3n]);agg.reset();}}finally{agg.finalize();}
  for(const [query,expected] of [['SELECT sum(d.x) AS s FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8) d',[20n]],['SELECT count(d.x) AS n FROM (SELECT x FROM t2 WHERE 0 UNION ALL SELECT 8 WHERE 0) d',[0n]],['SELECT count(d.x) AS n FROM (SELECT x FROM t2 UNION ALL SELECT x FROM t2) d',[8n]]]){const stmt=db.prepare(query).statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT count(d.missing) FROM (SELECT x FROM t2 UNION ALL SELECT 8) d'),error=>error.code===1);
  const distinctMixed=db.prepare('SELECT d.x FROM (SELECT DISTINCT x FROM t2 UNION ALL SELECT 8) d LIMIT 2 OFFSET 1').statement;
  try{assert.equal(distinctMixed.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await distinctMixed.step()==='row'){assert.equal(distinctMixed.columnType(0),'integer');rows.push(distinctMixed.column(0));}assert.deepEqual(rows,[3n,9n]);distinctMixed.reset();}}finally{distinctMixed.finalize();}
  for(const [query,expected] of [['SELECT d.x FROM (SELECT DISTINCT 4 AS x FROM t2 UNION ALL SELECT DISTINCT 4) d',[4n,4n]],['SELECT d.x FROM (SELECT DISTINCT 8 AS x UNION ALL SELECT DISTINCT 4 FROM t2) d',[8n,4n]],['SELECT d.x FROM (SELECT DISTINCT 4 AS x FROM t2 WHERE 0 UNION ALL SELECT DISTINCT 8) d LIMIT 0',[]]]){const stmt=db.prepare(query).statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT DISTINCT x FROM t2 UNION ALL SELECT DISTINCT missing) d'),error=>error.code===1);
  const limitedMixed=db.prepare('SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8 LIMIT 2 OFFSET 1) d LIMIT 1').statement;
  try{assert.equal(limitedMixed.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await limitedMixed.step()==='row'){assert.equal(limitedMixed.columnType(0),'integer');rows.push(limitedMixed.column(0));}assert.deepEqual(rows,[9n]);limitedMixed.reset();}}finally{limitedMixed.finalize();}
  for(const [query,expected] of [['SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8 LIMIT 0) d',[]],['SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT 8 LIMIT -1 OFFSET 2) d',[8n]],['SELECT d.x FROM (SELECT 8 AS x UNION ALL SELECT x FROM t2 WHERE x>1 LIMIT 2 OFFSET 1) d',[3n,9n]],['SELECT d.x FROM (SELECT DISTINCT 4 AS x FROM t2 UNION ALL SELECT 8 LIMIT 1 OFFSET 1) d',[8n]]]){const stmt=db.prepare(query).statement;try{const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);}finally{stmt.finalize();}}
  assert.throws(()=>db.prepare('SELECT d.x FROM (SELECT x FROM t2 WHERE x>1 UNION ALL SELECT missing LIMIT 0) d'),error=>error.code===1);
  const stmt=db.prepare(sql).statement;
  try{assert.equal(stmt.columnMetadata(0).name,'x');for(let cycle=0;cycle<2;cycle++){const rows=[];while(await stmt.step()==='row'){assert.equal(stmt.columnType(0),'integer');rows.push(stmt.column(0));}assert.deepEqual(rows,[1n,3n]);stmt.reset();}}finally{stmt.finalize();}
  for(const [query,expected] of [[sql.replace('LIMIT 2 OFFSET 1','LIMIT 0'),[]],[sql.replace('t1.a=t2.x','t1.a=t2.x AND 0').replace('LIMIT 2 OFFSET 1','LIMIT 2'),[9n]],[sql.replace('SELECT 9','SELECT ?').replace('LIMIT 2 OFFSET 1','LIMIT 2 OFFSET 2'),[3n,12n]]]){
   const stmt=db.prepare(query).statement;
   try{if(query.includes('?'))stmt.bind(1,12n);const rows=[];while(await stmt.step()==='row')rows.push(stmt.column(0));assert.deepEqual(rows,expected);}finally{stmt.finalize();}
  }
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve));}
});
test('joined ordered ALL derived branch emits parent destination rather than completed child splice',()=>{
 const source=fs.readFileSync('src/internal/vdbe.ts','utf8');
 const branch=source.slice(source.indexOf('function compileDerivedProducer('),source.indexOf('function compileRepeatedImmutableView('));
 // This actual admitted fixture misses tableProducer (compound), tableCompoundProducer
 // (join first arm and scalar second), ordered (FROM), and groupedAll (ORDER).
 // Require a source-specialized parent owner before the finished-child fallback.
 const parentBranch=branch.match(/else if\(joinedOrderedAllProducer\)\{([\s\S]*?)\n  \}else/);
 assert.ok(parentBranch,'joined ordered ALL derived branch still enters finished child fallback');
 assert.match(parentBranch[1],/destination:/,'producer must consume enclosing destination');
 assert.doesNotMatch(parentBranch[1],/child.ops|pcMap|relocateControlTargets/,'no finished-child splice in replacement');
});

test('unordered mixed physical/scalar ALL derived owner consumes enclosing destination',()=>{
 const source=fs.readFileSync('src/internal/vdbe.ts','utf8');
 const branch=source.slice(source.indexOf('function compileDerivedProducer('),source.indexOf('function compileRepeatedImmutableView('));
 // Physical WHERE arm plus zero-source tail excludes tableCompoundProducer,
 // groupedAll, scalar unionProducer, ordered and joinedOrderedAllProducer.
 const parentBranch=branch.match(/else if\(mixedPhysicalAllProducer\)\{([\s\S]*?)\n  \}else/);
 assert.ok(parentBranch,'live mixed physical/scalar ALL still enters completed-child fallback');
 assert.match(parentBranch[1],/destination:/);
 assert.doesNotMatch(parentBranch[1],/child.ops|pcMap|relocateControlTargets/);
});
