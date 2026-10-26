import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
// Native-FIRST proc-30244942728a: pinned 3.53.4, read-only public API.
test('empty CAST type is NUMERIC, distinct from absent column declaration',async()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/column-default-affinity-utf-8.db',import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 const failures=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  const controls=[["SELECT CAST('12' AS )",'integer',12n],['SELECT CAST(\'12\' AS "")','integer',12n],["SELECT CAST('12' AS MYSTERY)",'integer',12n],["SELECT CAST('12' AS BLOB REAL)",'blob',Uint8Array.of(49,50)],["SELECT c11 FROM t WHERE id=1",'text','0012']];
  for(const [sql,type,value] of controls){let st;
   try{
    st=db.prepare(sql).statement;
    for(let run=0;run<2;run++){
     assert.equal(await st.step(),'row');assert.equal(st.columnType(0),type);assert.deepEqual(st.column(0),value);
     assert.equal(await st.step(),'done');st.reset();
    }
   }catch(e){failures.push(`${sql}: ${e.message}`)}finally{st?.finalize()}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
