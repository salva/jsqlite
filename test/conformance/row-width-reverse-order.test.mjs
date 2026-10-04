import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-reverse-order-native.json',import.meta.url)));
for(const v of cap.variants)test(`native reverse-order proof ${v.id}/${v.hint}`,async()=>{
 const bytes=fs.readFileSync(v.fixture),server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));st=db.prepare(v.sql).statement;
 const read=async()=>{const rows=[];while(await st.step()==='row')rows.push(String(st.column(0)));return rows};
 for(let run=0;run<2;run++){if(run)st.reset();assert.deepEqual(await read(),v.rows);assert.equal(privateAccounting(st).sorterRows>0,v.sort>0,'native sort/no-sort proof')}
 }finally{try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await new Promise(r=>server.close(r))}}}
});
