import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {IndexCursor} from '../../src/internal/btree.ts';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

// Expectations captured independently before this test was authored. No sorting
// here: SQL ordering and TEXT/BLOB pass order are part of the comparison.
const receipt=JSON.parse(fs.readFileSync(new URL('./cases/like-prefix-composite-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
const readRow=st=>Array.from({length:st.columnCount},(_,i)=>st.column(i));
async function rows(st){const out=[];while(await st.step()==='row')out.push(readRow(st));return out;}
for(const variant of receipt.variants)test(`selected prefix direction/empty/seek lifecycle ${variant.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=()=>new Request(`http://127.0.0.1:${server.address().port}/fixture`);
 let db,other,survivor;
 try{
  db=await openFixture(request());other=await openFixture(request());
  for(const item of variant.cases.filter(c=>c.dimension==='branches')){
   assert.ok(item.native.eqp.some(s=>s.includes('SEARCH t USING INDEX')));
   const names=item.native.program.map(row=>decode(row[1]));
   assert.ok(names.includes('DecrJumpZero'),'native repeats even an empty pass');
   assert.ok(names.includes(item.reverse!==item.descending?'Prev':'Next'));
   const st=db.prepare(item.sql).statement;
   try{
    for(let run=0;run<2;run++){
     assert.deepEqual(await rows(st),item.native.rows.map(row=>row.map(decode)),item.sql);
     assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.native.metadata.map(m=>({name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName})));
     const work=privateAccounting(st);
     assert.equal(work.indexSeeks,2,'both passes position, including empty first or second pass');
     assert.ok(work.indexNext<20);assert.equal(work.tableNext,0);
     assert.ok(work.emittedOps.includes(item.reverse!==item.descending?'IndexPrev':'IndexNext'));
     if(item.native.rows.length)assert.ok(work.executedOps.includes(item.reverse!==item.descending?'IndexPrev':'IndexNext'));
     assert.equal(work.openCursors,0);assert.equal(work.ownedBytes,0);
     assert.equal(await st.step(),'done','exhausted statement stays exhausted');
     st.reset();
    }
   }finally{st.finalize()}
  }
  for(const item of variant.cases.filter(c=>c.dimension!=='branches'&&c.native)){
   const st=db.prepare(item.sql).statement;
   try{for(let run=0;run<2;run++){
    assert.deepEqual(await rows(st),item.native.rows.map(r=>r.map(decode)),item.sql);
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.native.metadata.map(m=>({name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName})));
    const work=privateAccounting(st);
    if(item.dimension==='unforced'){assert.equal(work.indexSeeks,2);assert.ok(work.indexNext<20);assert.equal(work.tableNext,0)}
    if(item.dimension==='scan'){assert.equal(work.indexSeeks,0);assert.ok(work.tableNext>=500)}
    assert.equal(work.openCursors,0);assert.equal(work.ownedBytes,0);st.reset();
   }}finally{st.finalize()}
  }
  const bound=variant.cases.find(c=>c.runs), rebound=db.prepare(bound.sql).statement;
  try{
   for(const run of [...bound.runs,bound.runs[0]]){
    run.bindings.forEach((v,i)=>rebound.bind(i+1,v));
    assert.deepEqual(await rows(rebound),run.rows.map(r=>r.map(decode)));
    assert.deepEqual(Array.from({length:rebound.columnCount},(_,i)=>rebound.columnMetadata(i)),run.metadata.map(m=>({name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName})));
    if(run.bindings[0]==='TENANT')assert.equal(privateAccounting(rebound).indexSeeks,2);
    rebound.reset();
   }
   rebound.clearBindings();assert.equal(await rebound.step(),'done');rebound.reset();
  }finally{rebound.finalize()}
  // Instrument the existing persistent cursor primitive, not a production hook.
  // Injection occurs inside an actual selected seek after positioning, including
  // the second-pass seek. Restore before retry and before touching survivor.
  const item=variant.cases[0];
  survivor=other.prepare(item.sql).statement;assert.equal(await survivor.step(),'row');
  const saved=privateAccounting(survivor),survivorRows=[readRow(survivor)];
  for(const pass of [1,2])for(const kind of ['cancel','fault']){
   const st=db.prepare(item.sql).statement,original=IndexCursor.prototype.seekKey;
   const controller=new AbortController(),fault=new Error('selected prefix seek fault');
   let seeks=0,injected=false,error;
   IndexCursor.prototype.seekKey=function(...args){
    const result=original.apply(this,args);
    if(++seeks===pass){injected=true;if(kind==='fault')throw fault;controller.abort(fault)}
    return result;
   };
   try{
    while(await st.step({signal:controller.signal})==='row'){}
   }catch(e){error=e}finally{IndexCursor.prototype.seekKey=original}
   assert.ok(injected);assert.equal(seeks,pass);
   assert.ok(error);if(kind==='cancel')assert.equal(error.kind,'cancelled');else assert.equal(error,fault);
   await assert.rejects(st.step(),e=>e===error);
   assert.equal(privateAccounting(st).openCursors,0);assert.equal(privateAccounting(st).ownedBytes,0);
   assert.deepEqual(privateAccounting(survivor),saved);
   assert.throws(()=>st.reset(),e=>e===error);
   assert.deepEqual(await rows(st),item.native.rows.map(row=>row.map(decode)));st.finalize();
  }
  survivorRows.push(...await rows(survivor));assert.deepEqual(survivorRows,item.native.rows.map(row=>row.map(decode)));
 }finally{survivor?.finalize();db?.closeDeferred();other?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
