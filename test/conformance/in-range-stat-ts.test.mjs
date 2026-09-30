import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/in-range-stat-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function withFixture(bytes,fn){
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});r.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));return await fn(db)}finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
}
async function run(db,sql,values){const st=db.prepare(sql).statement;try{values.forEach((x,i)=>st.bind(i+1,x));const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));return {rows,accounting:privateAccounting(st)}}finally{st.finalize()}}
test('pinned IN/range typed public rows and forced scan controls on immutable files',async()=>{
 for(const variant of cap.variants){
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  await withFixture(bytes,async db=>{
   for(const name of ['in-composite','in-composite-unforced','in-composite-scan','stat-choice','in-null']){
    let actual;
    try{actual=await run(db,cap.sql[name],cap.parameters[name])}catch(error){
     if(name==='in-composite-scan')throw error;
     // Current TS rejects these selected IN paths at prepare. Even stat-choice
     // (with a=1) retains an IN on b. Rejection is not native access parity.
     assert.equal(error.kind,'unsupported',`${variant.encoding}/${variant.state}/${name}: temporary unsupported`);
     assert.equal(error.unsupportedClassification,'temporary');
     assert.match(String(error),/composite index IN probes are not implemented|forced index is unusable/i,`${variant.encoding}/${variant.state}/${name}: atomic temporary rejection`);
     // The failed prepare must leave the connection usable by the scan control.
     const control=await run(db,cap.sql['in-composite-scan'],cap.parameters['in-composite-scan']);
     assert.deepEqual(control.rows,variant.cases['in-composite-scan'].rows.map(r=>r.map(decode)));
     assert.ok(control.accounting.tableNext>0,`${variant.encoding}/${variant.state}: scan control is not indexed credit`);
     continue;
    }
    assert.deepEqual(actual.rows,variant.cases[name].rows.map(r=>r.map(decode)),`${variant.encoding}/${variant.state}/${name}`);
    if(name==='in-composite-unforced' || name==='in-composite' || name==='in-null')assert.ok(actual.accounting.indexSeeks>=(name==='in-null'?1:2),`${variant.encoding}/${variant.state}/${name}: selected non-NULL probes, not a residual-only full scan`);
    // Rows alone do not grant selected-path credit. Native EQP/VDBE are separately asserted in Python.
   }
  });
 }
});
