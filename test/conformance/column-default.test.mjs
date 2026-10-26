import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
const receipts=['column-default-original-native.json','column-default-native.json'].map(name=>JSON.parse(fs.readFileSync(new URL(`./cases/${name}`,import.meta.url))));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
for(const [receiptIndex,receipt] of receipts.entries())for(const variant of receipt.variants)test(`short-record DEFAULT ${receiptIndex} ${variant.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const item of variant.cases){const st=db.prepare(item.sql).statement;
   try{for(let run=0;run<2;run++){
    const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
    assert.deepEqual(rows,item.native.rows.map(r=>r.map(decode)),item.sql);
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.native.metadata.map(m=>({name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName})));st.reset();
   }}finally{st.finalize()}
  }
  if(receiptIndex===0){const st=db.prepare('SELECT id,k FROM t NOT INDEXED WHERE id=1').statement;
  try{assert.equal(await st.step(),'row');assert.equal(st.column(1),'tenant')}finally{st.finalize()}}
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
