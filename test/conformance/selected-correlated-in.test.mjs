import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {open} from '../../src/index.ts';
import {privateAccounting} from './public-api-adapter.mjs';
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: correlated selected vector frontier rebuilds RHS`,async()=>{
 const root=process.env.SELECT_IN_CORRELATED_DIR??`${process.env.SAIVAGE_CARD_WORK_ROOT}/correlated-red`;
 const receipt=JSON.parse(fs.readFileSync(`${root}/${encoding}.json`));
 const bytes=fs.readFileSync(`${root}/${encoding}.db`);
 const server=http.createServer((q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await open(new Request(`http://127.0.0.1:${server.address().port}/db`));st=db.prepare(receipt.sql).statement;
  for(let pass=0;pass<2;pass++){
   const rows=[];while(await st.step()==='row')rows.push([0,1].map(i=>({type:st.columnType(i),value:String(st.column(i))})));
   assert.deepEqual(rows,receipt.rows);
   const work=privateAccounting(st);
   assert.ok(work.indexSeeks>0&&work.inProbes>0,JSON.stringify(work));
   if(!pass)await st.reset();
  }
 }finally{await st?.finalize();db?.closeDeferred();await new Promise(r=>server.close(r));}
});
