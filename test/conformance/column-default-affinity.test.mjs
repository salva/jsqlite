import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
const receipt=JSON.parse(fs.readFileSync(new URL('./cases/column-default-affinity-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='blob'?Uint8Array.from(Buffer.from(c.hex,'hex')):Buffer.from(c.utf8Hex,'hex').toString();
for(const variant of receipt.variants)test(`mixed affinity SELECT and short DEFAULT ${variant.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 assert.deepEqual(variant.shortRecordSerials,[0]);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 const failures=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const [q,item] of variant.cases.entries()){
   const st=db.prepare(item.sql).statement;
   try{for(let run=0;run<2;run++){
    const rows=[],types=[];while(await st.step()==='row'){
     rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)));
    }
    try{
     assert.deepEqual(rows,item.native.rows.map(row=>row.map(decode)));
     assert.deepEqual(types,item.native.rows.map(row=>row.map(c=>c.type)));
     assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.native.metadata.map(m=>({name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName})));
    }catch(e){failures.push(`query${q} run${run}: ${e.message}`)}
    st.reset();
   }}finally{st.finalize()}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
