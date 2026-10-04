import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {openFixture} from './public-api-adapter.mjs';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-left-in-reset-native.json',import.meta.url)));
for(const v of cap.variants)test(`LEFT IN null-continuation native reset ${v.encoding}/${v.state}`,async()=>{
 const bytes=fs.readFileSync(v.fixture),server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));st=db.prepare(cap.sql).statement;
 const read=async()=>{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);return rows};
 for(const run of v.runs){st.reset();st.clearBindings();run.bindings.forEach((b,i)=>st.bind(i+1,b===null?null:BigInt(b)));const expected=run.rows.map(row=>row.map(c=>c===null?null:BigInt(c)));assert.deepEqual(await read(),expected);st.reset();assert.deepEqual(await read(),expected,'retained bindings/null guard resets');}
 }finally{try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await new Promise(r=>server.close(r))}}}
});
