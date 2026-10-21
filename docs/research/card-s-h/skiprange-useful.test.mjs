import assert from 'node:assert/strict';
import fs from 'node:fs';import http from 'node:http';import test from 'node:test';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
const cap=JSON.parse(fs.readFileSync(new URL('./skiprange-useful/skiprange-native.json',import.meta.url)));
for(const v of cap.variants)test(`${v.encoding}: unforced sample-range beats ci work control`,async()=>{
 const bytes=fs.readFileSync(new URL('./skiprange-useful/'+v.fixture,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/f`));const measured=[];
  for(const id of ['unordered-b>100','unordered-forced-ci']){
   const c=v.stat4.find(c=>c.id===id),st=db.prepare(c.sql).statement;
   try{
    const rows=[];while(await st.step()==='row')rows.push([{type:'integer',value:String(st.column(0))},{type:'text',utf8Hex:Buffer.from(st.column(1)).toString('hex')}]);
    const canon=r=>r.map(x=>JSON.stringify(x)).sort();assert.deepEqual(canon(rows),canon(c.rows));measured.push(privateAccounting(st));
   }finally{st.finalize()}
  }
  const [chosen,forced]=measured;console.log(v.encoding,JSON.stringify({chosen,forced}));
  assert.ok(chosen.indexNext<forced.indexNext,'unforced sample skipscan must visit fewer index entries than ci control');
  assert.ok(chosen.tableSeeks<forced.tableSeeks,'unforced skipscan must fetch fewer table rows');assert.equal(chosen.sorterRows,0);assert.equal(chosen.tableNext,0);
 }finally{try{db?.closeDeferred()}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}}
});
