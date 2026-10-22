import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const directory=process.env.COVERED_DEFERRED_DIR;
assert.ok(directory,'COVERED_DEFERRED_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceid,pin.sqliteSourceId);assert.equal(capture.version,pin.version);
// where.c substitutes available OP_Column/Rowid fields even on non-covering
// loops. Keep the uncovered table read observable rather than omitting it.
for(const variant of capture.variants)test(`${variant.fixture}: selected covered rejection defers table read`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const c of variant.cases){
   st=db.prepare(c.sql).statement;
   assert.equal(st.columnCount,c.rows?3:2);assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i).name),c.rows?['a','id','id']:['a','id']);
   for(let run=0;run<2;run++){
    if(c.rows){
     const rows=[],types=[];
     while(await st.step()==='row'){rows.push([0,1,2].map(i=>st.column(i)));types.push([0,1,2].map(i=>st.columnType(i)));}
     assert.deepEqual(rows,c.rows.map(row=>row.map(cell=>BigInt(cell.value))));
     assert.deepEqual(types,c.rows.map(row=>row.map(cell=>cell.type)));
     // Only the inner u.id=1 rowid lookup seeks the table, once per outer row.
     assert.equal(privateAccounting(st).tableSeeks,2);st.reset();
    }else if(c.rc===101){
     assert.equal(await st.step(),'done');
     const work=privateAccounting(st);
     assert.equal(work.tableSeeks,0);assert.equal(work.tableNext,0);
     assert.equal(work.indexNext,2);assert.equal(work.residualTests,2);
     st.reset();
    }else{
     const message=variant.corrupt?/unexpected b-tree page type/:/integer overflow/;
     await assert.rejects(st.step(),e=>e.kind==='sqlite'&&message.test(e.message));
     assert.equal(privateAccounting(st).tableSeeks,1);
     assert.throws(()=>st.reset(),e=>e.kind==='sqlite'&&message.test(e.message));
    }
   }
   st.finalize();st=undefined;
  }
 }finally{st?.finalize();await db?.close();await new Promise(r=>server.close(r));}
});
