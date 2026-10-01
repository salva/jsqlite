import assert from 'node:assert/strict';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
test('joined scalar consumes linked outer cursor and rowid identity',async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/subquery-utf8`));
  const base='SELECT t.a,(SELECT count(*) FROM t1 AS i WHERE i.a={}) AS n FROM t1 AS t JOIN t1 AS u ON u.a=t.a WHERE t.a IN (1,3) ORDER BY 1';
  for(const [field,expected] of [['t.rowid',[1n,1n]],['u.a',[1n,1n]],['t.b',[0n,0n]]]){
   const stmt=db.prepare(base.replace('{}',field)).statement;
   try{
    assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i).name),['a','n']);
    for(let pass=0;pass<2;pass++){
     const rows=[];while(await stmt.step()==='row')rows.push([stmt.columnType(0),stmt.column(0),stmt.columnType(1),stmt.column(1)]);
     assert.deepEqual(rows,[[ 'integer',1n,'integer',expected[0]],['integer',3n,'integer',expected[1]]]);if(!pass)stmt.reset();
    }
   }finally{stmt.finalize()}
  }
  for(const [sql,message] of [[base.replace('{}','t.missing'),'no such column: t.missing'],[base.replace('{}','t.a').replace('FROM t1 AS i WHERE i.a=t.a','FROM t1 AS i JOIN t1 AS j WHERE a=t.a'),'ambiguous column name: a']])assert.throws(()=>db.prepare(sql),e=>e.message.includes(message));
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve()))}
});
