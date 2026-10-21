import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const directory=process.env.SELECT_IN_NATIVE_DIR;
assert.ok(directory,'SELECT_IN_NATIVE_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
for(const variant of capture.variants)test(`${variant.encoding}: NULL equality bypasses later SELECT-IN production`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`),{limits:{maxPrivateBytes:0}});
  for(const name of ['null-prefix','left-null-prefix']){
   const oracle=variant.cases[name];assert.ok(oracle,name);
   // Native codeAllEqualityTerms guards the equality before the later set.
   const guard=oracle.program.find(op=>op.opcode==='IsNull');
   const set=oracle.program.find(op=>op.opcode==='OpenEphemeral');
   assert.ok(guard&&set&&guard.addr<set.addr,name);
   const st=db.prepare(oracle.sql).statement;
   try{
    for(let run=0;run<2;run++){
     oracle.bindings.forEach((value,i)=>st.bind(i+1,value));
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     assert.deepEqual(rows,oracle.rows.map(row=>row.map(cell=>cell.type==='null'?null:cell.type==='integer'?BigInt(cell.value):cell.type==='real'?Buffer.from(cell.ieee754be,'hex').readDoubleBE():cell.type==='text'?Buffer.from(cell.utf8Hex,'hex').toString('utf8'):cell.type==='blob'?new Uint8Array(Buffer.from(cell.hex,'hex')):assert.fail(cell.type))),name);
     assert.equal(privateAccounting(st).inProbes,0,name);
     st.reset();
    }
   }finally{st.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
