import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
// Native-FIRST proc-02c476a27234: pinned 3.53.4 read-only prepare/step/reset.
test('CAST affinity consumes raw typename and dimension span',async()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/column-default-affinity-utf-8.db',import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 const failures=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  const controls=[['X/*TEXT*/Y','text','12'],['X/*BLOB*/Y','blob',Uint8Array.of(49,50)],['X Y','integer',12n],['X/*TEXT*/Y(4)','text','12'],['X(4/*TEXT*/)','text','12'],['X/*BLOB*/Y(4,2)','blob',Uint8Array.of(49,50)],['""','integer',12n],['','integer',12n]];
  for(const [type,storage,value] of controls){let st;
   const sql=`SELECT CAST('12' AS ${type})`;
   try{
    st=db.prepare(sql).statement;
    for(let run=0;run<2;run++){
     assert.equal(await st.step(),'row');assert.equal(st.columnType(0),storage);assert.deepEqual(st.column(0),value);
     assert.equal(await st.step(),'done');st.reset();
    }
   }catch(e){failures.push(`${sql}: ${e.message}`)}finally{st?.finalize()}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
