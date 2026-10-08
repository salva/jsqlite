import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere} from '../../src/internal/where-plan.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
const profile=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/oracle-profile.json',import.meta.url)));
// Authenticate provenance in each native boundary test, so the focused native
// subset cannot silently accept a capture from a different SQLite revision.
function authenticateCapture(){
 assert.equal(capture.sourceId,manifest.sqliteSourceId);
 assert.equal(profile.sourceId,manifest.sqliteSourceId);
 assert.equal(profile.versionNumber,manifest.versionNumber);
 assert.deepEqual(capture.variants.map(v=>v.encoding),['UTF-8','UTF-16le','UTF-16be']);
 for(const v of capture.variants){
  assert.equal(v.cases.filter(c=>c.id==='whereI-3.0').length,1);
  assert.equal(new Set(v.cases.map(c=>c.id)).size,v.cases.length);
 }
}
const decode=c=>c.type==='integer'?BigInt(c.value):c.value;
async function withDb(v,run){
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>r.end(bytes)); await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await run(db)}finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
}
for(const v of capture.variants){
 test(`${v.encoding}: native WR Case5 first/middle/final key union provenance`,()=>{
  authenticateCapture();
  const c=v.cases.find(c=>c.id==='middle');
  const ops=c.explain.rows.map(r=>r.map(decode));
  assert.ok(c.eqp.rows.some(r=>r.some(c=>c.value==='MULTI-INDEX OR')));
  assert.equal(ops.filter(r=>r[1]==='OpenEphemeral').length,1);
  assert.equal(ops.find(r=>r[1]==='OpenEphemeral')[3],2n,'primary nKeyCol not physical total column count');
  assert.equal(ops.filter(r=>r[1]==='Found').length,2,'first arm bypass');
  assert.equal(ops.filter(r=>r[1]==='IdxInsert').length,2,'final arm bypass');
  assert.equal(ops.filter(r=>r[1]==='RowSetTest').length,0,'no rowid surrogate');
  // Assert per-arm control flow, not only global opcode counts: Found must
  // bypass that arm's Gosub; the first/final bypasses are asymmetric.
  const calls=ops.filter(r=>r[1]==='Gosub');assert.equal(calls.length,3);
  assert.ok(calls.every(r=>r[3]===calls[0][3]),'one shared body');
  const open=ops.find(r=>r[1]==='OpenEphemeral');
  assert.equal(open[5],'k(2,-NOCASE,)','primary collation and DESC descriptor');
  let previous=open[0];
  for(let arm=0;arm<3;arm++){
   const call=calls[arm],body=ops.filter(r=>r[0]>previous&&r[0]<call[0]);
   const found=body.filter(r=>r[1]==='Found'),insert=body.filter(r=>r[1]==='IdxInsert');
   assert.equal(found.length,arm===0?0:1);assert.equal(insert.length,arm===2?0:1);
   if(found.length){assert.equal(found[0][2],open[2]);assert.equal(found[0][5],'2');assert.ok(found[0][3]>call[0],'duplicate skips shared body');}
   if(insert.length){assert.equal(insert[0][2],open[2]);assert.equal(insert[0][5],'2');assert.ok(body.some(r=>r[1]==='MakeRecord'&&r[4]===insert[0][3]));}
   previous=call[0];
  }
  assert.equal(new Set(c.rows.map(r=>JSON.stringify(r.slice(0,2)))).size,c.rows.length,'composite identity dedup');
 });
 for(const c of v.cases){
  test(`${v.encoding}/${c.id}: native typed public rows and reset`,async()=>withDb(v,async db=>{
   if(c.error){assert.throws(()=>db.prepare(c.sql),e=>e.code===c.error.code&&e.message===c.error.message);return}
   const st=db.prepare(c.sql).statement;
   try{
    assert.equal(st.columnCount,c.names.length);
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i).name),c.names,'native result names');
    for(let run=0;run<2;run++){
     st.reset(); const rows=[];
     while(await st.step()==='row') rows.push(Array.from({length:st.columnCount},(_,i)=>({type:st.columnType(i),value:st.column(i)})));
     const expected=c.rows.map(r=>r.map(c=>({type:c.type,value:decode(c)})));
     // whereI-3.0 has no ORDER BY: native arm schedule is evidence, not
     // a public row-order guarantee. Compare its multiset without crediting
     // fallback as selected Case5; plan/opcode assertions remain separate.
     if(c.id==='whereI-3.0'){
      const key=r=>JSON.stringify(r); assert.deepEqual(rows.map(key).sort(),expected.map(key).sort());
     }else assert.deepEqual(rows,expected);
    }
   }finally{st.finalize()}
  }));
 }
 // Active red acceptance assertions. Do not force-enable WR or spoof a rowid;
 // an ordinary fallback matching rows is not selected Case5 coverage.
 test(`${v.encoding}: WR selected owner immutable handoff`,async()=>withDb(v,async db=>{
  const schema=loadSchemaGraph(db),c=v.cases.find(c=>c.id==='middle');
  const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema);
  const chosen=planWhere(resolved,{neededColumns:[new Set(resolved.sources[0].table.columns)],orderBy:[]});
  const loop=chosen.path?.loops[0]; assert.equal(loop?.kind,'multi-or','WR source must publish a primary-key union candidate');
  assert.equal(loop.capability,null);assert.ok(Object.isFrozen(loop));
  assert.ok(chosen.analysis.clause.terms.includes(loop.orInfo.parentTerm));
 }));
 test(`${v.encoding}: WR key-union opcode contract`,async()=>withDb(v,async db=>{
  const c=v.cases.find(c=>c.id==='middle'),schema=loadSchemaGraph(db);
  const program=compileTableSelect(parseSql(c.sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.equal(program.ops.filter(o=>o.code==='RowSetTest').length,0);
  assert.equal(program.ops.filter(o=>o.code==='Found').length,2,'first branch must not test prior keys');
  assert.equal(program.ops.filter(o=>o.code==='IdxInsert').length,2,'final branch must not retain keys');
  assert.ok(program.ops.some(o=>o.code==='Gosub'));assert.ok(program.ops.some(o=>o.code==='Return'));
 }));
}
