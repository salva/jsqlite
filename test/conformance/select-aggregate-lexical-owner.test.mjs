import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// resolve.c1356–1378 assigns TK_AGG_FUNCTION to the nearest NameContext
// whose SrcList its arguments reference; expr.c7473 consumes the matching depth.
// Paired pinned public capture: select-aggregate-lexical-owner-native.py.
for(const [label,sql,expected] of [
 ['composite empty scalar','SELECT t.a,(SELECT sum(t.a)+1 FROM t1 u WHERE NULL) AS s FROM t1 t GROUP BY t.a ORDER BY t.a',[[1n,null],[3n,null],[5n,null],[7n,null]]],
 ['composite CASE REAL short circuit','SELECT t.a,(SELECT CASE WHEN sum(t.a)>0 THEN sum(CAST(t.a AS REAL))+1 ELSE abs(-9223372036854775808) END FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a',[[1n,2],[3n,4],[5n,6],[7n,8]]],
 ['all-outer scalar expression ungrouped','SELECT t.a,(SELECT sum(t.a)+1 FROM t1 u) AS s FROM t1 t ORDER BY t.a',[[1n,17n]]],
 ['all-outer scalar expression grouped','SELECT t.a,(SELECT sum(t.a)+1 FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a',[[1n,2n],[3n,4n],[5n,6n],[7n,8n]]],
 ['all-outer ungrouped','SELECT t.a,(SELECT sum(t.a) FROM t1 u) AS s FROM t1 t ORDER BY t.a',[[1n,16n]]],
 ['all-outer grouped','SELECT t.a,(SELECT sum(t.a) FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a',[[1n,1n],[3n,3n],[5n,5n],[7n,7n]]],
 ['empty scalar source','SELECT t.a,(SELECT sum(t.a) FROM t1 u WHERE NULL) AS s FROM t1 t GROUP BY t.a ORDER BY t.a',[[1n,null],[3n,null],[5n,null],[7n,null]]],
 ['REAL argument','SELECT t.a,(SELECT sum(CAST(t.a AS REAL)) FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a',[[1n,1],[3n,3],[5n,5],[7n,7]]],
 ['local-owning grouped control','SELECT t.a,(SELECT sum(u.a+t.a) FROM t1 u) AS s FROM t1 t GROUP BY t.a ORDER BY t.a',[[1n,20n],[3n,28n],[5n,36n],[7n,44n]]],
]) test(`aggregate lexical ownership: ${label}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const s=db.prepare(sql).statement;
  try{
   assert.deepEqual(s.columnMetadata(0),{name:'a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'});
   assert.equal(s.columnMetadata(1).name,'s');
   for(let iteration=0;iteration<2;iteration++){
    const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)]));
    assert.deepEqual(rows,expected.map(row=>row.map(value=>[value===null?'null':typeof value==='number'?'real':'integer',value])));
    if(iteration===0)s.reset();
   }
  }finally{s.finalize();}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()));}
});
