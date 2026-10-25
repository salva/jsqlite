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
const decode=cell=>cell.type==='null'?null:cell.type==='integer'?BigInt(cell.value):cell.type==='real'?Buffer.from(cell.ieee754be,'hex').readDoubleBE():cell.type==='text'?Buffer.from(cell.utf8Hex,'hex').toString('utf8'):cell.type==='blob'?new Uint8Array(Buffer.from(cell.hex,'hex')):assert.fail(cell.type);
const drain=async st=>{const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));return rows};
function noSet(st,name){
 const a=privateAccounting(st);
 assert.equal(a.inProbes,0,name);
 assert.ok(!a.executedOps.includes('OpenEphemeral'),`${name}: NULL guard bypasses RHS set production`);
 for(const k of ['ownedBytes','memBytes','recordBytes','scratchBytes','packedPages'])assert.equal(a[k],0,`${name}: released ${k}`);
 assert.equal(a.chargedBytes,a.refundedBytes,name);
}
for(const variant of capture.variants)test(`${variant.encoding}: NULL equality bypasses later SELECT-IN production`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=()=>new Request(`http://127.0.0.1:${server.address().port}/fixture`);
 let db;
 try{
  for(const name of ['null-prefix','left-null-prefix']){
   const oracle=variant.cases[name];assert.ok(oracle,name);
   const guard=oracle.program.find(op=>op.opcode==='IsNull');
   const set=oracle.program.find(op=>op.opcode==='OpenEphemeral');
   assert.ok(guard&&set&&guard.addr<set.addr,name);
   const expected=oracle.rows.map(row=>row.map(decode));
   // OP_Column owns projected TEXT even when a later NULL equality suppresses
   // the entire RHS set. Measure that independent register demand, not a guessed
   // set allowance; no producer/seek/scratch admission may hide inside it.
   db=await openFixture(request());
   let st=db.prepare(oracle.sql).statement,peak;
   try{
    oracle.bindings.forEach((v,i)=>st.bind(i+1,v));
    assert.deepEqual(await drain(st),expected,name);noSet(st,name);
    const a=privateAccounting(st);peak=a.highwaterBytes;
    assert.equal(peak,a.memHighwaterBytes,'only Column register backing is admitted');
    assert.equal(a.recordHighwaterBytes,0);assert.equal(a.scratchHighwaterBytes,0);assert.equal(a.packedPagesHighwater,0);
    assert.equal(peak===0,name==='null-prefix','LEFT projection, not RHS production, needs bytes');
   }finally{st.finalize();db.closeDeferred();db=undefined}
   for(const cap of [...new Set([0,Math.max(0,peak-1),peak])]){
    db=await openFixture(request(),{limits:{maxPrivateBytes:cap}});
    st=db.prepare(oracle.sql).statement;
    try{
     for(let run=0;run<2;run++){
      oracle.bindings.forEach((v,i)=>st.bind(i+1,v));
      if(cap<peak){
       let first;await assert.rejects(drain(st),e=>{first=e;return e.kind==='limit'});
       noSet(st,name);await assert.rejects(st.step(),e=>e===first);
       assert.throws(()=>st.reset(),e=>e===first);
      }else{assert.deepEqual(await drain(st),expected,name);noSet(st,name);st.reset()}
     }
    }finally{st.finalize();db.closeDeferred();db=undefined}
   }
   console.log(`${variant.encoding}/${name}: register peak ${peak}; original zero quota ${peak?'rejects owned projection':'succeeds'}`);
  }
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
