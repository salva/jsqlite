import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

const native=JSON.parse(fs.readFileSync(new URL('./cases/like-prefix-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
for(const variant of native.variants){
 test(`prefix selected corruption/${variant.encoding}`,async()=>{
  const bytes=Buffer.from(fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url)));
  const root=variant.cases[0].native.program.find(row=>decode(row[1])==='OpenRead'&&decode(row[3])===3n);
  assert.ok(root,'native receipt identifies selected NOCASE root');
  bytes[(Number(decode(root[3]))-1)*(bytes.readUInt16BE(16)||65536)]=0;
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const scan=db.prepare(variant.cases[2].sql).statement;
   try{const rows=[];while(await scan.step()==='row')rows.push(Array.from({length:scan.columnCount},(_,i)=>scan.column(i)));assert.deepEqual(rows,variant.cases[2].native.rows.map(row=>row.map(decode)));}finally{scan.finalize()}
   const st=db.prepare(variant.cases[0].sql).statement;
   await assert.rejects(async()=>{while(await st.step()==='row'){}},e=>e.kind==='sqlite'&&e.code===11);
   assert.equal(privateAccounting(st).openCursors,0);assert.equal(privateAccounting(st).ownedBytes,0);
   assert.throws(()=>st.finalize(),e=>e.kind==='sqlite'&&e.code===11);
  }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
 });
 test(`prefix lifecycle and independent survivor/${variant.encoding}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,other,survivor;
  const request=()=>new Request(`http://127.0.0.1:${server.address().port}/fixture`);
  try{
   db=await openFixture(request());other=await openFixture(request());
   survivor=other.prepare(variant.cases[0].sql).statement;assert.equal(await survivor.step(),'row');
   const saved=privateAccounting(survivor),survivorRows=[Array.from({length:survivor.columnCount},(_,i)=>survivor.column(i))];
   for(const [options,kind] of [[{signal:AbortSignal.abort()},'cancelled'],[{timeoutMs:0},'timeout'],[{maxWorkUnits:1},'limit']]){
    const st=db.prepare(variant.cases[0].sql).statement;
    assert.equal(await st.step(),'row');assert.ok(privateAccounting(st).indexSeeks>0,'affected range has executed before interruption');
    let error;try{await st.step(options)}catch(e){error=e}assert.equal(error?.kind,kind);
    await assert.rejects(st.step(),e=>e===error);
    assert.equal(privateAccounting(st).openCursors,0);assert.equal(privateAccounting(st).ownedBytes,0);
    assert.deepEqual(privateAccounting(survivor),saved,'cleanup must not alter independent survivor');
    try{st.reset()}catch(e){assert.equal(e,error)}
    const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
    assert.deepEqual(rows,variant.cases[0].native.rows.map(row=>row.map(decode)));st.finalize();
   }
   while(await survivor.step()==='row')survivorRows.push(Array.from({length:survivor.columnCount},(_,i)=>survivor.column(i)));
   assert.deepEqual(survivorRows,variant.cases[0].native.rows.map(row=>row.map(decode)));
  }finally{survivor?.finalize();db?.closeDeferred();other?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
 });
 for(const dimension of ['rows and metadata','selected work'])test(`native prefix ${dimension}/${variant.encoding}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   for(const item of variant.cases.filter(item=>item.native)){
    if(dimension==='selected work'&&!variant.cases.slice(0,6).includes(item))continue;
    const st=db.prepare(item.sql).statement;
    try{
     for(let run=0;run<2;run++){
      const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
      const work=privateAccounting(st);
      console.log(JSON.stringify({encoding:variant.encoding,dimension,mode:item.mode,control:item.dimension,run,rows:rows.length,work}));
      if(dimension==='rows and metadata'){
       assert.deepEqual(rows,item.native.rows.map(row=>row.map(decode)),item.sql);
       const metadata=item.native.metadata.map(m=>({name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName}));
       assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),metadata,item.sql);
      }else if(item.dimension.includes('NOT INDEXED')){
       assert.equal(work.indexSeeks,0,'scan control has no prefix seek');
       assert.ok(work.tableNext>=500,'scan control consumes the table');
      }else{
       assert.ok(work.indexSeeks>0,'prefix must execute actual bounded persistent-index seek');
       assert.ok(work.indexNext<50,'prefix must not traverse the entire index');
      }
      st.reset();
     }
    }finally{st.finalize()}
   }
   if(dimension==='rows and metadata'){
    const item=variant.cases.find(item=>item.dimension==='bound-patterns'),st=db.prepare(item.sql).statement;
    try{
     for(const run of [...item.runs,...item.runs.slice(0,1)]){
      st.bind(1,run.bindings[0]);
      const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
      assert.deepEqual(rows,run.rows.map(row=>row.map(decode)),'same statement pattern rebind');
      const work=privateAccounting(st);
      if(run.bindings[0]==='abc%')assert.ok(work.indexSeeks>0,'bound pattern reparses into selected range');
      if(run.bindings[0]==='%abc')assert.equal(work.indexSeeks,0,'no-prefix rebound pattern removes range');
      st.reset();
     }
     st.clearBindings();assert.equal(await st.step(),'done','cleared pattern is NULL');st.reset();
    }finally{st.finalize()}
   }
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
 });
}
