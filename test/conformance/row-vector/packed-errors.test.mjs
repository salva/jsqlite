import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture} from '../public-api-adapter.mjs';
const native=JSON.parse(fs.readFileSync(new URL('./packed-errors-native.json',import.meta.url)));
const digest=b=>createHash('sha256').update(b).digest('hex');
assert.equal(native.sourceId,JSON.parse(fs.readFileSync(new URL('./spec.json',import.meta.url))).sourceId);
const queryBytes=fs.readFileSync(new URL('./packed-errors-queries.json',import.meta.url));
assert.equal(digest(queryBytes),native.queriesSha256);
const queries=JSON.parse(queryBytes);
function checkError(error,expected){
 assert.equal(error.name,'JSQLiteError');assert.equal(error.kind,'sqlite');
 for(const key of ['code','extendedCode','message'])assert.equal(error[key],expected[key],key);
 return true;
}
for(const [encoding,fixture] of Object.entries(native.encodings)){
 for(const c of fixture.cases)test(`joined packed native error ${encoding}: ${c.sql}`,async()=>{
  assert.deepEqual(fixture.cases.map(c=>c.sql),queries);
  const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
  assert.equal(digest(body),fixture.fixtureSha256);
  const server=http.createServer((_q,r)=>r.end(body));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,st;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
   if(c.phase==='prepare')assert.throws(()=>db.prepare(c.sql),error=>checkError(error,c.error));
   else{
    st=db.prepare(c.sql).statement;
    for(const run of c.runs){
     let rows=0;
     await assert.rejects(async()=>{while(await st.step()==='row')rows++},error=>checkError(error,run.error));
     assert.equal(rows,run.rowsBeforeError,'no partial rows before native error');
     assert.equal(run.resetCode,run.error.code);
     assert.throws(()=>st.reset(),error=>checkError(error,run.error));
     // reset reports saved error and clears it; next iteration must execute anew.
    }
    assert.equal(c.finalizeCode,0);st.finalize();st=null;
   }
   const recovery=db.prepare('SELECT 1').statement;
   try{assert.equal(await recovery.step(),'row');assert.equal(recovery.columnType(0),'integer');assert.equal(recovery.column(0),1n);assert.equal(await recovery.step(),'done')}finally{recovery.finalize()}
  }finally{try{st?.finalize()}finally{await db?.close();await new Promise(resolve=>server.close(resolve))}}
 });
}
