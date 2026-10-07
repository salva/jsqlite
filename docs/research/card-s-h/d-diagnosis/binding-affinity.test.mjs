import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture} from '../../../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../../../test/conformance/close-test-server.mjs';
const oracle=JSON.parse(fs.readFileSync(new URL('binding-affinity-native.json',import.meta.url)));
// vdbe.c applyAffinity converts numeric TEXT but leaves BLOB/NULL distinct.
// This is public execution/rebinding coverage, not STAT4 parameter reprepare.
for(const v of oracle.variants)test(`${v.encoding}: one STAT4 statement preserves binding affinity and BLOB/NULL distinctions`,async()=>{
 const bytes=fs.readFileSync(new URL('../'+v.fixture,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
 let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));st=db.prepare(oracle.sql).statement;
  for(const c of [...v.cases,v.cases[0]]){
   st.reset();const b=c.binding;st.bind(1,b?.type==='blob'?Uint8Array.from(Buffer.from(b.hex,'hex')):c.bindingType==='integer'?BigInt(b):b);
   const rows=[];
   while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{
    const type=st.columnType(i),value=st.column(i);
    if(type==='integer')return {type,value:String(value)};
    if(type==='real'){const raw=Buffer.alloc(8);raw.writeDoubleBE(value);return {type,ieee754be:raw.toString('hex')};}
    throw new Error(`unexpected result type ${type}`);
   }));
   assert.deepEqual(rows,c.rows,`binding ${JSON.stringify(b)}`);
  }
 }finally{try{st?.finalize();}finally{try{db?.closeDeferred();}finally{await closeTestServer(server);}}}
});
