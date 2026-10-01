import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// Pinned source-ID-checked native comparison: $SAIVAGE_CARD_WORK_ROOT/cte-order/oracle.py
// select.c:sqlite3Select tag-select-0488 uses one SRT_EphemTab destination;
// selectInnerLoop branches to its producer continuation on LIMIT exhaustion.
test('limited table-backed materialized CTE uses parent builder and retains row order',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  for(const [sql,expected] of [
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2 ORDER BY a DESC) SELECT x FROM q',[[7n],[5n],[3n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2 ORDER BY a DESC) SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x ORDER BY 1',[[3n,3n],[5n,5n],[7n,7n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2 ORDER BY a DESC LIMIT 2 OFFSET 1) SELECT x FROM q',[[5n],[3n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2 LIMIT 0) SELECT x FROM q',[]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2 LIMIT 2) SELECT x FROM q',[[3n],[5n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2 LIMIT 2 OFFSET 1) SELECT x FROM q',[[5n],[7n]]],
   ['WITH q(x) AS MATERIALIZED (SELECT a FROM t1 WHERE a>2 LIMIT 2) SELECT a.x,b.x FROM q a JOIN q b ON a.x=b.x ORDER BY 1',[[3n,3n],[5n,5n]]],
  ]){
   const stmt=db.prepare(sql).statement;
   try{assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),sql.includes('a.x,b.x')?['x','x']:['x']);
    for(let pass=0;pass<2;pass++){
     const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>{assert.equal(stmt.columnType(i),'integer');return stmt.column(i)}));
     assert.deepEqual(rows,expected,sql);if(pass===0)stmt.reset();
    }
   }finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
