import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import fs from 'node:fs';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

// Reactivate all four retained native byte mismatches without altering the
// previously accepted finite first-match matrix or its historical evidence.
const rows=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-b-mergepatch-native.json',import.meta.url),'utf8')).cases.filter(r=>r.expression.startsWith('hex(jsonb_patch(')&&r.expression.includes("'[1,2]'"));
assert.equal(rows.length,4);
for(const enc of ['utf8','utf16le','utf16be'])test(`mergepatch remaining byte and parse order ${enc}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  const failures=[];
  const cases=[...rows,...['json_patch','jsonb_patch'].map(f=>({expression:`${f}('bad',NULL)`,error:'malformed JSON'})),
   {expression:"json_patch(NULL,'bad')",type:5,value:null},
   {expression:"json_patch('{}',NULL)",type:5,value:null},
   {expression:"hex(jsonb_patch('{}','[1,2]'))",type:3,value:'4B13311332'}];
  for(const row of cases){
   let s;
   try{
    s=db.prepare(`SELECT ${row.expression}`).statement;
    for(let run=0;run<2;run++){
     let error;
     try{
      assert.equal(await s.step(),'row');
      if(row.error)failures.push({expression:row.expression,run,expectedError:row.error,actual:s.column(0)});
      else{
       const actual=s.column(0),type=s.columnType(0);
       if(actual!==row.value||type!==(row.type===5?'null':'text'))failures.push({expression:row.expression,run,expected:row.value,actual,type});
      }
      assert.equal(await s.step(),'done');
     }catch(e){error=e}
     if(error&&!(row.error&&error.kind==='sqlite'&&error.code===1&&error.extendedCode===1&&error.message===row.error))throw error;
     if(run===0){try{s.reset()}catch(e){if(!(row.error&&e.kind==='sqlite'&&e.code===1&&e.message===row.error))throw e}}
    }
   }finally{try{s?.finalize()}catch(e){if(!(row.error&&e.kind==='sqlite'&&e.code===1&&e.message===row.error))throw e}}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
