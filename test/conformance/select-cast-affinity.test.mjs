import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
// Native-FIRST public capture proc-1ebe5c8e05b4, pinned SQLite 3.53.4.
const controls=[['BLOB REAL','blob'],['REAL BLOB','blob'],
 ['REAL BLOB INT','integer'],['INT BLOB REAL','integer'],
 ['BLOB REAL TEXT','text'],['TEXT REAL BLOB','text'],
 ['CLOB REAL','text'],['CHAR BLOB','text'],['FLOA','real'],
 ['DOUB','real'],['MYSTERY','integer']];
test('CAST affinity follows native mixed-marker precedence',async()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/column-default-cast-utf-8.db',import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 const failures=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const [type,storage] of controls){let st;
   try{st=db.prepare(`SELECT CAST('12' AS ${type})`).statement;
    for(let run=0;run<2;run++){
     assert.equal(await st.step(),'row');
     assert.equal(st.columnType(0),storage);
     const expected=storage==='blob'?Uint8Array.of(0x31,0x32):storage==='integer'?12n:storage==='real'?12:'12';
     assert.deepEqual(st.column(0),expected);
     assert.equal(await st.step(),'done');st.reset();
    }
   }catch(error){failures.push(`${type}: ${error.message}`)}finally{st?.finalize()}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
