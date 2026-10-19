import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
const root=process.argv[2];if(!root)throw Error('native receipt/fixture directory required');
const native=JSON.parse(fs.readFileSync(path.join(root,'native.json'),'utf8'));
let observations=0;
for(const encoding of ['UTF-8','UTF-16le','UTF-16be']){
 const bytes=fs.readFileSync(path.join(root,encoding+'.db'));
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
 for(const receipt of native.observations.filter(x=>x.encoding===encoding)){
  const {statement:s}=db.prepare(receipt.sql);
  try{for(let execution=0;execution<2;execution++){
   for(const [i,param] of (receipt.params??[]).entries())s.bind(i+1,param.kind==='text'?Buffer.from(param.hex,'hex').toString('utf8'):new Uint8Array(Buffer.from(param.hex,'hex')));
   if(receipt.error){let saved;await assert.rejects(s.step(),e=>{saved=e;return e.code===receipt.error&&/non-deterministic use of timediff/.test(e.message)});await assert.rejects(s.step(),e=>e===saved);assert.throws(()=>s.reset(),e=>e===saved);observations++;continue}
   assert.equal(await s.step(),'row',receipt.sql);assert.equal(s.columnCount,receipt.row.length);
   for(const [i,cell] of receipt.row.entries()){
    assert.equal(s.columnType(i),cell.type,`${encoding}: ${receipt.sql} col${i}`);
    const v=s.column(i);if(cell.type==='text')assert.equal(Buffer.from(v,'utf8').toString('hex'),cell.hex,receipt.sql);
    else if(cell.type==='integer')assert.equal(v,BigInt(cell.value),receipt.sql);
    else if(cell.type==='real'){
     const m=/^(-?)0x([0-9a-f]+)\.([0-9a-f]+)p([+-]?\d+)$/i.exec(cell.value);assert.ok(m);
     const n=(parseInt(m[2],16)+parseInt(m[3],16)/16**m[3].length)*2**Number(m[4])*(m[1]?-1:1);assert.ok(Object.is(v,n),receipt.sql);
    }else assert.equal(v,null,receipt.sql);
   }assert.equal(await s.step(),'done');if(execution===0)s.reset();observations++;
  }}finally{s.finalize()}
 }
 }finally{try{await db?.close()}finally{await new Promise(r=>server.close(r))}}
}
console.log(JSON.stringify({outcome:'pass',sourceId:native.sourceId,observations,executions:2,encodings:3,corpusCredit:0}));
