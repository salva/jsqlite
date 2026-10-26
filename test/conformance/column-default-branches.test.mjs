import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
const receipt=JSON.parse(fs.readFileSync(new URL('./cases/column-default-branches-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='blob'?Uint8Array.from(Buffer.from(c.hex,'hex')):Buffer.from(c.utf8Hex,'hex').toString();
for(const variant of receipt.variants)test(`FLOAT/INTEGER/unary/CAST DEFAULT branches ${variant.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 assert.deepEqual(variant.shortRecordSerials,[0]);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 const mismatches=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const [query,item] of variant.cases.entries()){const st=db.prepare(item.sql).statement;
   try{for(let run=0;run<2;run++){
    const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
    const expected=item.native.rows.map(r=>r.map(decode));
    for(let row=0;row<expected.length;row++)for(let col=0;col<expected[row].length;col++){
     try{assert.deepEqual(rows[row]?.[col],expected[row][col])}catch{mismatches.push(`run${run} query${query} row${row} col${col}: actual=${String(rows[row]?.[col])} (${typeof rows[row]?.[col]}) expected=${String(expected[row][col])} (${typeof expected[row][col]})`)}
    }
    assert.equal(rows.length,expected.length);
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.native.metadata.map(m=>({name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName})));st.reset();
   }}finally{st.finalize()}
  }
  assert.deepEqual(mismatches,[], 'native FLOAT spelling differential (all controls executed)');
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
