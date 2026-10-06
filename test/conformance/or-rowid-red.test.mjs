import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,ROWID_NEEDED} from '../../src/internal/where-plan.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function withDb(v,run){
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await run(db)}finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
}
// These are active acceptance tests, not expected-failure wrappers. Missing OR
// production must stay visible as red; final rows on a scan are not selection.
for(const v of capture.variants){
 test(`${v.id}: production multi-or immutable planning handoff`,async()=>withDb(v,async db=>{
  const schema=loadSchemaGraph(db);
  const c=v.cases.find(c=>c.id==='overlap'),parsed=parseSql(c.sql).statement,resolved=expandAndResolveSelect(parsed,schema);
  const chosen=planWhere(resolved,{neededColumns:[new Set([...resolved.sources[0].table.columns,ROWID_NEEDED])],orderBy:[]});
  const loop=chosen.path?.loops[0];
  assert.equal(loop?.kind,'multi-or','selected production must not be an ordinary full scan');
  // Approved immutable handoff; physical arm choice belongs to lowering.
  // never infer branches from SQL text or native EQP at runtime.
  assert.ok(chosen.analysis.clause.terms.includes(loop.orInfo.parentTerm),'OR parent retains analyzed term identity');
  assert.equal(loop.sortIdentity,0);
  assert.equal(loop.capability,null);
  assert.equal(loop.setupCost,0n);
  assert.ok(Object.isFrozen(loop));
 }));
 test(`${v.id}: shared-builder multi-or opcodes (lowering remains red)`,async()=>withDb(v,async db=>{
  const schema=loadSchemaGraph(db),database=btreeFromConnection(db);
  const c=v.cases.find(c=>c.id==='overlap'),parsed=parseSql(c.sql).statement,resolved=expandAndResolveSelect(parsed,schema);
  const program=compileTableSelect(parsed,schema,database,Number.MAX_SAFE_INTEGER);
  const opens=program.ops.filter(op=>op.code==='OpenIndex');
  for(const name of ['oa','ob']){const index=resolved.sources[0].table.indexes.find(index=>index.name===name);assert.ok(opens.some(op=>op.physical===index.physical&&op.p1===index.rootPage),`selected branch uses loaded ${name} identity/root`)}
  const batches=program.ops.filter(op=>op.code==='RowSetTest');
  assert.deepEqual(batches.map(op=>op.p4),[0,-1],'first/final batches for two-arm union');
  assert.ok(batches.every(op=>Number.isInteger(op.p2)&&op.p2>0),'duplicate branch continuation targets patched');
  assert.ok(program.ops.some(op=>op.code==='Gosub'));
  assert.ok(program.ops.some(op=>op.code==='Return'));
 }));
 for(const c of v.cases){
  test(`${v.id}/${c.id}: typed public rows, metadata, reset/rebind/clear${c.selectedRequired?' and selected work (red)':''}`,async()=>withDb(v,async db=>{
   if(c.error){assert.throws(()=>db.prepare(c.sql),e=>e.kind==='sqlite'&&e.code===c.error.code&&e.message===c.error.message);return}
   const st=db.prepare(c.sql).statement;
   try{
    for(let i=0;i<c.metadata.length;i++)assert.deepEqual(st.columnMetadata(i),c.metadata[i]);
    for(const run of c.runs){
     st.reset();st.clearBindings();run.bindings.forEach((b,i)=>st.bind(i+1,typeof b==='number'&&Number.isInteger(b)?BigInt(b):b));
     const rows=[],types=[];
     while(await st.step()==='row'){rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)))}
     assert.deepEqual(rows,run.rows.map(r=>r.map(decode)));
     assert.deepEqual(types,run.rows.map(r=>r.map(c=>c.type)));
     if(c.selectedRequired){
      const work=privateAccounting(st);
      assert.ok(work.indexSeeks>=2,'distinct OR branches must seek persistent indexes');
      assert.equal(work.tableNext,0,'selected OR cannot quietly scan the table');
      // No new public diagnostics. This proposed private selected counter must
      // count executed branch opens including empty branches, reset per run.
      assert.ok(work.orBranchStarts>=2,'selected OR branch execution provenance');
      if(c.id==='overlap'){const schema=loadSchemaGraph(db),table=schema.findTable('o');assert.deepEqual([...new Set(work.orBranchRoots)],['oa','ob'].map(name=>table.indexes.find(index=>index.name===name).rootPage),'executed persistent branch roots, not inferred from SQL')}
      if(c.id==='overlap')assert.ok(work.orDuplicateSkips>=1,'cross-branch overlap deduplicated by RowSetTest');
      if(c.sql.includes('ORDER BY')&&run.rows.length)assert.ok(work.sorterRows>=run.rows.length,'OR makes no physical ORDER proof');
     }
    }
    // clearBindings must not preserve the previous branch keys.
    if(c.id==='rebind'){st.reset();st.clearBindings();assert.equal(await st.step(),'done')}
   }finally{st.finalize()}
  }));
 }
}
