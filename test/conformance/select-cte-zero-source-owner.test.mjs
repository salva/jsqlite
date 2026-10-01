import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Pinned select.c:sqlite3Select/ selectInnerLoop: no-FROM WHERE precedes the
// destination insertion; vdbeaux.c builds both in one Vdbe address space.
// Independently captured 3.53.4 source-ID-checked native output: see
// $SAIVAGE_CARD_WORK_ROOT/cte-vm/oracle.py (typed sqlite3_column_type/int64).
test('zero-source materialized CTE WHERE owns its parent destination',async()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const owner=source.slice(source.indexOf('function compileCteDerivedSources('),source.indexOf('function compileCteDerivedSourcesFallback('));
 assert.match(owner,/const gate=producer\.where\?compileExpression\(producer\.where,ops,\(\)=>builder\.register\(\),parameters\)/);
 assert.match(owner,/emitSelectDestination\(ops,destination,first,columns\.length\)/);
 const {startFixtureServer}=await import('./fixture-server.mjs');
 const {openFixture}=await import('./public-api-adapter.mjs');
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const [sql,expected] of [
   ['WITH q(x) AS MATERIALIZED (SELECT 1 AS x WHERE 0) SELECT x FROM q',[]],
   ['WITH q(x) AS MATERIALIZED (SELECT 1 AS x WHERE 1) SELECT x FROM q',[[1n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT 1 AS x WHERE 1) SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x ORDER BY 1',[[1n,1n]]],
  ]){
   const stmt=db.prepare(sql).statement;
   try{for(let pass=0;pass<2;pass++){
    const rows=[];
    while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>{assert.equal(stmt.columnType(i),'integer');return stmt.column(i)}));
    assert.deepEqual(rows,expected,sql);if(pass===0)stmt.reset();
   }}finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
