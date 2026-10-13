import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from '../public-api-adapter.mjs';
const cases=JSON.parse(fs.readFileSync(new URL('./review33-cases.json',import.meta.url)));
// Native-first source-ID-checked receipt: card-t-c/review33-red/native.log.
// Review33 findings are source observations, not prior executed reproducers.
for(const encoding of ['utf8','utf16le','utf16be'])for(const c of cases)test(`review33 ${encoding}: ${c.sql}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  if(c.error){
   for(let attempt=0;attempt<2;attempt++)assert.throws(()=>{
    const prepared=db.prepare(c.sql).statement;
    // Finalize an erroneously published statement before the failed assertion.
    prepared?.finalize();
   },e=>e.kind==='sqlite'&&e.code===1&&e.extendedCode===1&&e.message===c.error);
   st=db.prepare('SELECT 1 AS result').statement;assert.equal(await st.step(),'row');assert.equal(st.column(0),1n);assert.equal(await st.step(),'done');
  }else{
   st=db.prepare(c.sql).statement;assert.equal(st.columnCount,1);assert.deepEqual(st.columnMetadata(0),c.sql.startsWith('SELECT (SELECT a FROM')?{name:'result',declaredType:'NUMERIC',database:'main',table:'pairs',origin:'a'}:{name:'result',declaredType:null,database:null,table:null,origin:null});
   for(let replay=0;replay<2;replay++){
    if(c.stepError){await assert.rejects(st.step(),e=>e.kind==='sqlite'&&e.code===1&&e.extendedCode===1&&e.message===c.stepError);assert.throws(()=>st.reset(),e=>e.kind==='sqlite'&&e.code===1&&e.message===c.stepError);continue;}
    const rows=[];while(await st.step()==='row'){assert.equal(st.columnType(0),'integer');rows.push([String(st.column(0))]);}
    assert.deepEqual(rows,c.rows);st.reset();
   }
  }
  st.finalize();st=undefined;db.close();db=undefined;
 }finally{try{st?.finalize()}catch{}db?.closeDeferred();await new Promise(r=>server.close(r));}
});
