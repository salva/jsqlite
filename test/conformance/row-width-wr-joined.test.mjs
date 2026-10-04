import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {openFixture} from './public-api-adapter.mjs';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-wr-joined-native.json',import.meta.url)));
for(const v of cap.variants)test(`joined WR physical storage native ${v.encoding}/${v.state}`,async()=>{
 const bytes=fs.readFileSync(v.fixture),server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));st=db.prepare(cap.sql).statement;
 const read=async()=>{const rows=[];while(await st.step()==='row')rows.push([st.column(0),String(st.column(1)),st.column(2)]);return rows};
 for(let run=0;run<2;run++){if(run)st.reset();assert.deepEqual(await read(),v.rows)}
 }finally{try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await new Promise(r=>server.close(r))}}}
});
