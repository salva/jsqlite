import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// select.c:sqlite3Select tag-select-0484/0488 emits the child with
// SRT_EphemTab into the parent Vdbe, then reuses the CteUse via Gosub/OpenDup.
// Relocating a finished child Program and rewriting its Halt loses that owner.
test('materialized/repeated CTE producer emits into parent builder destination',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileCteDerivedSources(');
 const owner=source.slice(start,source.indexOf('function compileCteDerivedSourcesFallback(',start));
 assert.ok(owner.startsWith('function compileCteDerivedSources('));
 assert.match(owner,/new SelectProgramBuilder<Op>\(/);
 assert.match(owner,/emitSelectDestination\(/);
 assert.doesNotMatch(owner,/for\(const original of inner\.ops\)|op\.p2\+base|op\.code==='Halt'/);
});

// select.c:sqlite3Select recursive queue and selectInnerLoop SRT_EphemTab
// emit into the enclosing Parse/Vdbe. Completed child Program relocation
// cannot be the compiler-owned destination/PC construction contract.
test('multiple recursive CTE producers share parent builder and destination',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('export function compileMultipleRecursiveCtes(');
 const end=source.indexOf('\nexport function ',start+1);
 const owner=source.slice(start,end<0?undefined:end);
 assert.ok(owner.startsWith('export function compileMultipleRecursiveCtes('));
 assert.match(owner,/SelectProgramBuilder<Op>|emitSelectDestination\(/);
 assert.doesNotMatch(owner,/for\(const original of child\.ops\)|const relocate=|original\.code==='Halt'|original\.code==='ResultRow'/);
});

// select.c:multiSelect codes arms into the same Parse/Vdbe and copies the
// caller destination. Table-backed arms must not own an isolated allocator.
test('table-backed compound arms consume the enclosing builder and destination',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const owner=source.slice(source.indexOf('function compileSimpleTableCompound('),source.indexOf('function compileSingleCompoundDerived('));
 assert.ok(owner.startsWith('function compileSimpleTableCompound('));
 assert.match(owner,/new SelectProgramBuilder<Op>\(/);
 assert.match(owner,/emitSelectDestination\(/);
 assert.doesNotMatch(owner,/const ops:Op\[\]=\[\]|setCursor=1,auxCursor=2,sorterCursor=3|code:"ResultRow",p1:1/);
});

// Pinned select.c:multiSelect() emits both UNION ALL arms into one Vdbe and
// shared SelectDest. A completed Program/Halt relocation is not that contract.
test('unordered UNION ALL arm consumer emits into its enclosing destination',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const owner=source.slice(source.indexOf('function compileCteUnionAll('),source.indexOf('function compileSimpleTableCompound('));
 assert.ok(owner.startsWith('function compileCteUnionAll('));
 assert.doesNotMatch(owner,/const children=select\.arms\.map\(|for\(const child of children\)|const base=ops\.length|original\.code==='Halt'/);
});

// Pinned 3.53.4 sqlite3_prepare_v2/step/reset, source-ID-checked oracle.py
// under the card's compound-validation work directory.
test('unordered compound arms retain first-arm metadata, row order and atomic prepare errors',async()=>{
 const {startFixtureServer}=await import('./fixture-server.mjs');
 const {openFixture}=await import('./public-api-adapter.mjs');
 const root=new URL('../fixtures',import.meta.url).pathname;
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const [sql,values] of [
   ['SELECT 1 AS v UNION ALL SELECT 2 AS w',[1n,2n]],
   ['SELECT 1 AS v UNION ALL SELECT 2 AS w UNION ALL SELECT 3',[1n,2n,3n]],
   ['SELECT 1 AS v UNION ALL SELECT 2 AS w WHERE 0',[1n]],
   ['SELECT 1 AS v UNION ALL SELECT count(*)',[1n,1n]],
  ]){
   const statement=db.prepare(sql).statement;
   try{assert.equal(statement.columnCount,1);assert.equal(statement.columnMetadata(0).name,'v');
    for(let pass=0;pass<2;pass++){
     const rows=[];while(await statement.step()==='row')rows.push([statement.columnType(0),statement.column(0)]);
     assert.deepEqual(rows,values.map(value=>['integer',value]));assert.equal(await statement.step(),'done');
     if(pass===0)statement.reset();
    }
   }finally{statement.finalize()}
  }
  for(const [sql,message] of [
   ['SELECT 1 AS v UNION ALL SELECT 2,3','same number of result columns'],
   ['SELECT 1 AS v UNION ALL SELECT missing','no such column: missing'],
   ['SELECT 1 AS v UNION ALL SELECT 2 FROM missing_table','no such table: missing_table'],
  ]){assert.throws(()=>db.prepare(sql),error=>error?.kind==='sqlite'&&error?.code===1&&error.message.includes(message));}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

// Pinned select.c:multiSelectByMerge codes both ordered arms into the same
// Parse/Vdbe via coroutine destinations; completed Program opcode relocation
// is not the destination/program-construction contract.
test('ordered compound arm caller does not relocate completed child Programs',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const owner=source.slice(source.indexOf('function compileOrderedCteUnionAll('),source.indexOf('function compileCteUnionAll('));
 assert.ok(owner.startsWith('function compileOrderedCteUnionAll('));
 assert.doesNotMatch(owner,/const children=select\.arms\.map\(|for\(const child of children\)|registerOffset|cursorOffset|original\.code==="Halt"/);
});

test('pinned ordered compound public control: output, limit, CTE, VALUES and ORDER error',async()=>{
 const {startFixtureServer}=await import('./fixture-server.mjs');
 const {openFixture}=await import('./public-api-adapter.mjs');
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const [sql,expected] of [
   ['SELECT 2 AS v UNION ALL SELECT 1 ORDER BY 1',[1n,2n]],
   ['SELECT 2 AS v UNION ALL SELECT 1 ORDER BY 1 LIMIT 1 OFFSET 1',[2n]],
   ['WITH c(x) AS (SELECT 2) SELECT x AS v FROM c UNION ALL SELECT 1 ORDER BY 1',[1n,2n]],
   ['WITH c(x) AS (SELECT 2 WHERE 0) SELECT x AS v FROM c UNION ALL SELECT 1 ORDER BY 1',[1n]],
   ['WITH c(x) AS (SELECT 2.0) SELECT x AS v FROM c WHERE x>0 UNION ALL SELECT 1 ORDER BY 1',[1n,2]],
   ['WITH c(x) AS (SELECT 2) SELECT x AS v FROM c UNION ALL SELECT NULL ORDER BY 1',[null,2n]],
  ]){
   const statement=db.prepare(sql).statement;
   try{assert.equal(statement.columnMetadata(0).name,'v');for(let pass=0;pass<2;pass++){
    const rows=[];while(await statement.step()==='row')rows.push([statement.columnType(0),statement.column(0)]);
    assert.deepEqual(rows,expected.map(value=>[value===null?'null':typeof value==='number'?'real':'integer',value]));assert.equal(await statement.step(),'done');if(pass===0)statement.reset();
   }}finally{statement.finalize()}
  }
  for(const sql of ['VALUES(2),(1) ORDER BY 1','SELECT 2 AS v UNION ALL SELECT 1 ORDER BY 2'])assert.throws(()=>db.prepare(sql),error=>error?.kind==='sqlite'&&error?.code===1);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

// Native oracle: $SAIVAGE_CARD_WORK_ROOT/table-compound-oracle/probe.py,
// sqlite3_sourceid() verified against reference/sqlite/manifest.json.
test('pinned table-backed compound types, metadata, set/ordered limit and prepare errors',async()=>{
 const {startFixtureServer}=await import('./fixture-server.mjs');
 const {openFixture}=await import('./public-api-adapter.mjs');
 const root=new URL('../fixtures',import.meta.url).pathname;
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));
  for(const [sql,expected] of [
   ['SELECT a AS v FROM left_meta UNION SELECT b FROM right_meta UNION ALL SELECT a FROM left_meta', [['integer',7n],['text','8'],['integer',7n]]],
   ['SELECT a AS v FROM left_meta UNION SELECT b FROM right_meta UNION ALL SELECT a FROM left_meta ORDER BY 1 DESC LIMIT 2 OFFSET 1', [['integer',7n],['integer',7n]]],
   ['SELECT a AS v FROM left_meta UNION ALL SELECT b FROM right_meta', [['integer',7n],['text','8']]],
  ]){
   const s=db.prepare(sql).statement;
   try{assert.equal(s.columnCount,1);assert.equal(s.columnMetadata(0).name,'v');for(let pass=0;pass<2;pass++){
    const rows=[];while(await s.step()==='row')rows.push([s.columnType(0),s.column(0)]);
    assert.deepEqual(rows,expected);assert.equal(await s.step(),'done');if(pass===0)s.reset();
   }}finally{s.finalize()}
  }
  for(const [sql,fragment] of [
   ['SELECT a FROM left_meta UNION ALL SELECT b FROM right_meta ORDER BY 2','out of range'],
   ['SELECT a FROM left_meta UNION ALL SELECT b FROM missing_table','no such table: missing_table'],
  ])assert.throws(()=>db.prepare(sql),e=>e?.kind==='sqlite'&&e?.code===1&&e.message.includes(fragment));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

// Source-ID checked native comparison: $SAIVAGE_CARD_WORK_ROOT/cte-owner/oracle.py.
test('materialized/repeated CTE public rows, types, metadata, reset and prepare errors',async()=>{
 const {startFixtureServer}=await import('./fixture-server.mjs');
 const {openFixture}=await import('./public-api-adapter.mjs');
 const root=new URL('../fixtures',import.meta.url).pathname;
 const bridge=await startFixtureServer(root);let db;
 try{
  // subquery-utf8 is the independently pinned native oracle's database.
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  for(const [sql,names,values] of [
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1) SELECT x FROM q',['x'],[[1n],[3n],[5n],[7n]]],
   ['WITH q(x) AS (SELECT a FROM t1) SELECT a.x,b.x FROM q AS a JOIN q AS b ON a.x=b.x ORDER BY 1',['x','x'],[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]],
   ['WITH q(x) AS MATERIALIZED (VALUES(1),(2)) SELECT a.x,b.x FROM q AS a JOIN q AS b ON a.x=b.x ORDER BY 1 LIMIT 1',['x','x'],[[1n,1n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1) SELECT x FROM q WHERE x>3 ORDER BY x LIMIT 2 OFFSET 1',['x'],[[7n]]],
  ]){
   let statement;
   try{statement=db.prepare(sql).statement;assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i).name),names);
    for(let pass=0;pass<2;pass++){
     const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>{assert.equal(statement.columnType(i),'integer');return statement.column(i)}));
     assert.deepEqual(rows,values);assert.equal(await statement.step(),'done');if(pass===0)statement.reset();
    }
   }finally{statement?.finalize()}
  }
  for(const [sql,message] of [
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1) SELECT missing FROM q','no such column: missing'],
   ['WITH q(x) AS MATERIALIZED (SELECT z FROM t1) SELECT x FROM q','no such column: z'],
  ])assert.throws(()=>db.prepare(sql),e=>e?.kind==='sqlite'&&e?.code===1&&e.message.includes(message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

// select.c:sqlite3Select tag-select-0488 codes a filtered producer into the
// enclosing Vdbe's SRT_EphemTab, not a relocated completed child Program.
test('filtered materialized CTE producer retains parent destination ownership',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const fallback=source.slice(source.indexOf('function compileCteDerivedSourcesFallback('),source.indexOf('export function compileTableSelect(',source.indexOf('function compileCteDerivedSourcesFallback(')));
 const owner=source.slice(source.indexOf('function compileCteDerivedSources('),source.indexOf('function compileCteDerivedSourcesFallback('));
 // A filtered producer must not be excluded before the parent-owned
 // compileInnerTableSelect destination call. Other fallback consumers remain.
 assert.doesNotMatch(owner.slice(0,owner.indexOf('if(producer.from.items.length)expanded.set(')),/producer\.where\|\|/);
 assert.match(owner,/compileInnerTableSelect\(producer,expanded\.get\(source\.use\)!,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,\{builder,ops,parameters,destination\}\)/);
 assert.match(fallback,/for\(const original of inner\.ops\)/);
});

// Independently obtained native typed output: $SAIVAGE_CARD_WORK_ROOT/cte-owner/oracle-fallback.py.
test('filtered materialized CTE reuse: public types, names, reset and errors',async()=>{
 const {startFixtureServer}=await import('./fixture-server.mjs');
 const {openFixture}=await import('./public-api-adapter.mjs');
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  for(const [sql,names,expected] of [
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2) SELECT x FROM q ORDER BY 1',['x'],[[3n],[5n],[7n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2) SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x ORDER BY 1',['x','x'],[[3n,3n],[5n,5n],[7n,7n]]],
  ]){
   const stmt=db.prepare(sql).statement;
   try{assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),names);
    for(let pass=0;pass<2;pass++){
     const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>{assert.equal(stmt.columnType(i),'integer');return stmt.column(i)}));
     assert.deepEqual(rows,expected);if(pass===0)stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  for(const sql of ['WITH q(x) AS MATERIALIZED (SELECT z FROM t1 WHERE a>2) SELECT x FROM q','WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE z>2) SELECT x FROM q'])
   assert.throws(()=>db.prepare(sql),error=>error?.kind==='sqlite'&&error.code===1&&error.message.includes('no such column: z'));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
