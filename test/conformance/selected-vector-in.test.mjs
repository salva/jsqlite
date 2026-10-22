import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {open} from '../../src/index.ts';
import {privateAccounting} from './public-api-adapter.mjs';
// Native-first receipts are produced by the card's pinned C API capture;
// this test intentionally requires them, rather than silently skipping.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: selected vector maps one RHS row into composite prefix`,async()=>{
 const root=process.env.SELECT_IN_VECTOR_DIR??`${process.env.SAIVAGE_CARD_WORK_ROOT}/vector-red`;
 const native=JSON.parse(fs.readFileSync(`${root}/${encoding}.json`));
 const bytes=fs.readFileSync(`${root}/${encoding}.db`);
 const server=http.createServer((request,response)=>response.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db,statement;
 try{
  db=await open(new Request(`http://127.0.0.1:${server.address().port}/db`));
 const receipts=native.cases??[{sql:native.sql,rows:[[{type:'integer',value:'1'}]]},...JSON.parse(fs.readFileSync(`${process.env.SELECT_IN_VECTOR_PREFIX_DIR??`${process.env.SAIVAGE_CARD_WORK_ROOT}/vector-prefix-red`}/${encoding}.json`)).cases];
 for(const receipt of [...receipts,...(native.frontierCases??[])]){
  statement=db.prepare(receipt.sql).statement;
  if(receipt.metadata)assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i)),receipt.metadata);
  for(let pass=0;pass<2;pass++){
   const rows=[];while(await statement.step()==='row'){
    assert.equal(statement.columnType(0),'integer');
    rows.push([{type:'integer',value:String(statement.column(0))}]);
   }
   assert.deepEqual(rows,receipt.rows);
   const work=privateAccounting(statement);
   assert.ok(work.indexSeeks>0&&work.inProbes>0,`${receipt.name??receipt.sql}: must use selected prefix, not scan-equivalent rows ${JSON.stringify(work)}`);
   if(receipt.name==='or')assert.equal(work.orBranchStarts,2,'both vector OR arms must execute');
   if(pass===0)await statement.reset();
  }
  if(receipt.name==='or'){
   const scan=db.prepare(receipt.sql.replace('INDEXED BY t_ab','NOT INDEXED')).statement;
   try{
    const rows=[];while(await scan.step()==='row')rows.push([{type:'integer',value:String(scan.column(0))}]);
    assert.deepEqual(rows,receipt.rows,'NOT INDEXED scan control');
    assert.equal(privateAccounting(scan).indexSeeks,0);
    assert.equal(privateAccounting(scan).inProbes,0);
    assert.equal(privateAccounting(scan).orBranchStarts,0);
   }finally{scan.finalize();}
  }
  await statement.finalize();statement=undefined;
 }
 }finally{await statement?.finalize();db?.closeDeferred();await new Promise(resolve=>server.close(resolve));}
});
