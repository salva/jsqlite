import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
import {readSkiprangeCapture} from './read-skiprange-capture.mjs';
const cap=readSkiprangeCapture(new URL('./skiprange-native.json',import.meta.url));
const canonical=rows=>rows.map(r=>JSON.stringify(r)).sort();
for(const v of cap.variants)for(const id of ['unordered-b<0','unordered-b<1','unordered-b>=190','b BETWEEN 100 AND 120','forced-ab','covering']){
 const c=v.stat4.find(c=>c.id===id);
 test(`${v.encoding}/${id}: native selected range path and actual work`,async()=>{
  const bytes=fs.readFileSync(new URL(v.fixture,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,st;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/f`));st=db.prepare(c.sql).statement;
   const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{const type=st.columnType(i),v=st.column(i);return type==='integer'?{type,value:String(v)}:type==='text'?{type,utf8Hex:Buffer.from(v).toString('hex')}:type==='null'?{type}:(()=>{throw Error('unexpected fixture value')})()}));
   assert.deepEqual(canonical(rows),canonical(c.rows));const a=privateAccounting(st);
   if(c.eqp[0]==='SCAN t'){assert.equal(a.indexSeeks,0);assert.ok(a.tableNext>0)}else{assert.ok(a.indexSeeks>0);if(c.eqp[0].includes('COVERING'))assert.equal(a.tableSeeks,0)}
   assert.equal(a.sorterRows>0,c.eqp.some(p=>p.includes('TEMP B-TREE'))&&rows.length>0);
  }finally{try{st?.finalize();db?.closeDeferred()}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}}
 });
}
