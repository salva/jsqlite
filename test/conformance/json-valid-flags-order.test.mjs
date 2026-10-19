import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// src/json.c:jsonValidFunc validates flags before dispatching on input type.
// NULL flags convert to int64 zero; NULL document does not suppress flags errors.
test('json_valid flags errors precede NULL document handling',async()=>{
 const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
  for(const sql of ['SELECT json_valid(NULL,0)','SELECT json_valid(NULL,16)',"SELECT json_valid('{}',NULL)"]){
   const statement=db.prepare(sql).statement;
   try{
    await assert.rejects(statement.step(),e=>e.kind==='sqlite'&&e.code===1&&e.message==='FLAGS parameter to json_valid() must be between 1 and 15',sql);
   }finally{try{statement.finalize()}catch{}}
  }
  for(const [sql,value,type] of [
   ['SELECT json_valid(NULL,1)',null,'null'],
   ['SELECT json_valid(NULL,15)',null,'null'],
   ["SELECT json_valid('{}','1')",1n,'integer'],
   ["SELECT json_valid('{}',1.9)",1n,'integer'],
   ["SELECT json_valid('{}',x'31')",1n,'integer'],
   ["SELECT json_valid('{}',15)",1n,'integer'],
  ]){
   const statement=db.prepare(sql).statement;
   try{
    for(let run=0;run<2;run++){
     assert.equal(await statement.step(),'row');
     assert.equal(statement.columnType(0),type);assert.equal(statement.column(0),value);
     assert.equal(await statement.step(),'done');
     if(run===0)statement.reset();
    }
   }finally{statement.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
