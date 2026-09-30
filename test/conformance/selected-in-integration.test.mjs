import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('./cases/selected-in-integration-native.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function fixture(bytes,fn){
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await fn(db)}finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
}
test('manifest-pinned native three-slot, LEFT and descending IN/range rows match public selected access in three encodings',async()=>{
 assert.equal(capture.sourceId,manifest.sqliteSourceId);
 assert.deepEqual(capture.variants.map(v=>v.encoding),['utf8','utf16le','utf16be'],'oracle must cover every requested encoding');
 const caseNames=['triple-first','triple-rebound','triple-left','triple-left-unmatched','desc-in','desc-range','desc-range-open-closed','desc-range-empty'];
 for(const variant of capture.variants)assert.deepEqual(variant.cases.map(c=>c.name),caseNames,`${variant.encoding}: no missing oracle discriminator`);
 for(const variant of capture.variants){
  const life=variant.cases.find(c=>c.name==='triple-first');
  assert.deepEqual(variant.lifecycle.map(r=>r.bindings),[[2,1],[3,1],[null,2]],`${variant.encoding}: same-statement rebind sequence, including NULL`);
  const lifeBytes=fs.readFileSync(new URL(`../../${life.fixture}`,import.meta.url));
  assert.equal(createHash('sha256').update(lifeBytes).digest('hex'),life.sha256);
  await fixture(lifeBytes,async db=>{
   const st=db.prepare(life.sql).statement;
   try{
    assert.equal(variant.lifecycle.length,3);
    for(const run of variant.lifecycle){
     st.reset();run.bindings.forEach((value,i)=>st.bind(i+1,value));
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     assert.deepEqual(rows,run.rows.map(row=>row.map(decode)),`${variant.encoding} same-statement rebound ${run.bindings}`);
     assert.equal(run.fullscanSteps,0,'native lifecycle selected cursor');
     assert.ok(privateAccounting(st).indexSeeks>=3,'rebound selected seeks, not just correct rows');
    }
   }finally{st.finalize()}
  });
  for(const c of variant.cases){
   const bytes=fs.readFileSync(new URL(`../../${c.fixture}`,import.meta.url));
   assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);
   assert.ok(c.eqp.some(x=>/INDEX/.test(x)),`${c.name} native index plan`);
   if(c.name==='triple-left-unmatched'){
    assert.deepEqual(c.rows.map(row=>row.map(decode)),[[1n,null],[2n,null],[3n,null],[4n,null],[5n,null]],'native LEFT emits each unmatched outer row once');
    assert.ok(c.eqp.some(x=>x.includes('LEFT-JOIN')&&x.includes('INDEX')),'native selected nullable-side access');
   }
   if(c.name==='desc-in'){
    assert.ok(c.eqp.some(x=>x.includes('COVERING INDEX ix_ab_desc (a=? AND b=?)')),'native DESC composite equality owner');
    assert.ok(c.ops.some(x=>x.opcode==='Prev'),'native DESC IN RHS ephemeral cursor walks backwards');
    assert.deepEqual(c.rows.map(row=>row[0].value),['2','1','5','4'],'native no-ORDER physical traversal is observable');
   }
   if(c.name==='desc-range-empty'){
    assert.deepEqual(c.rows,[],'native contradictory DESC bounds have no row');
    assert.ok(c.eqp.some(x=>x.includes('COVERING INDEX ix_ab_desc (a=? AND b>? AND b<?)')),'native empty range still selected');
    assert.ok(c.ops.some(x=>x.opcode==='SeekGT')&&c.ops.some(x=>x.opcode==='IdxGE'),'native empty cursor has physical start/end opcodes');
    assert.ok(c.work.vmSteps<=50,'native empty selected range terminates without scanning');
   }
   if(c.name==='desc-range-open-closed'){
    assert.ok(c.eqp.some(x=>x.includes('COVERING INDEX ix_ab_desc (a=? AND b>? AND b<?)')),'native opposite inclusive/exclusive DESC range');
    assert.ok(c.ops.some(x=>x.opcode==='SeekGE')&&c.ops.some(x=>x.opcode==='IdxGE'),'native physical bound direction/termination');
    assert.deepEqual(c.rows.map(row=>row[0].value),['2','5'],'NOCASE DESC open/closed boundaries differ from prior range');
   }
   if(c.name==='desc-range'){
    assert.ok(c.eqp.some(x=>x.includes('COVERING INDEX ix_ab_desc (a=? AND b>? AND b<?)')),'native DESC bounded range');
    assert.ok(c.ops.some(x=>x.opcode==='SeekGT'),'native exclusive physical seek');
   }
   assert.ok(c.ops.some(x=>/Seek(GE|GT|LE|LT)/.test(x.opcode)),`${c.name} native seek`);
   assert.equal(c.work.fullscanSteps,0,`${c.name} native bounded cursor`);
   await fixture(bytes,async db=>{
    const st=db.prepare(c.sql).statement;
    try{
     c.bindings.forEach((value,i)=>st.bind(i+1,value));
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     assert.deepEqual(rows,c.rows.map(row=>row.map(decode)),`${variant.encoding}/${c.name} native typed ordered rows`);
     const work=privateAccounting(st);
     assert.ok(work.indexSeeks>=(c.name.startsWith('triple')?3:2),`${variant.encoding}/${c.name} selected index probes`);
     // LEFT's outer x cursor legitimately advances over five rows; only the
     // inner y index is credited by the selected seek count.
     if(!c.name.startsWith('triple-left'))assert.equal(work.tableNext,0,`${variant.encoding}/${c.name} no base scan credit`);
    }finally{st.finalize()}
   });
  }
 }
});
