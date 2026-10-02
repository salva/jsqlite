import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

// select.c sqlite3Select() tag-select-0482/0484 materializes derived arms in
// the enclosing Parse/Vdbe; multiSelect and selectInnerLoop share destinations.
// Paired with select-derived-composition-native.py on pinned 3.53.4.
for(const sql of [
 'SELECT sum(missing) FROM (SELECT x FROM t2 UNION ALL SELECT NULL) d LIMIT 0',
 'SELECT sum(d.missing) FROM (SELECT x FROM t2 UNION ALL SELECT NULL) d LIMIT 0',
 'SELECT d.x FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t ORDER BY t.a',
 'SELECT d.x FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t ORDER BY t.a LIMIT 0',
])test(`prepare owner: ${sql}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
 if(sql.includes('missing'))assert.throws(()=>db.prepare(sql),error=>error.kind==='sqlite'&&error.code===1&&error.message.includes(`no such column: ${sql.includes('d.missing')?'d.missing':'missing'}`));
 else{const {statement}=db.prepare(sql);statement.finalize();}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

for(const [suffix,rows] of [
 ['',[[1n,1n],[1n,1n],[1n,3n],[1n,3n],[1n,5n],[1n,5n],[1n,7n],[1n,7n]]],
 [' LIMIT 0',[]],[' LIMIT 3 OFFSET 2',[[1n,3n],[1n,3n],[1n,5n]]],[' LIMIT -1 OFFSET 6',[[1n,7n],[1n,7n]]],
])test(`source0 parent destination ${suffix}`,async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
 const {statement}=db.prepare('SELECT d.x,t.a FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t ORDER BY t.a'+suffix);
 try{assert.deepEqual([0,1].map(i=>statement.columnMetadata(i).name),['x','a']);
 for(let iteration=0;iteration<2;iteration++){const actual=[];while(await statement.step()==='row')actual.push([0,1].map(i=>[statement.columnType(i),statement.column(i)]));assert.deepEqual(actual,rows.map(row=>row.map(value=>['integer',value])));statement.reset();}}
 finally{statement.finalize();}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});

test('source0 unsorted limit offset uses output destination',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
 const {statement}=db.prepare('SELECT d.x,t.a FROM (SELECT x FROM t2 LIMIT 2) d CROSS JOIN t1 t LIMIT 3 OFFSET 2');
 try{for(let i=0;i<2;i++){const actual=[];while(await statement.step()==='row')actual.push([statement.column(0),statement.column(1)]);assert.deepEqual(actual,[[1n,5n],[1n,7n],[1n,1n]]);statement.reset();}}finally{statement.finalize();}
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
