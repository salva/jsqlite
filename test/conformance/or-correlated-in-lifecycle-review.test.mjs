import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/nested-caller-review-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
// wherecode.c Case5 calls the common downstream body, whereEnd advances IN
// probes before enclosing loops. This production caller combines correlated
// RHS, composite IN restart, residual rowid end and live cancellation; the
// separate synthetic fixture cannot establish these lowering relationships.
for(const v of native.variants)test(`${v.id}: correlated IN selected caller cancellation and complete replay`,async()=>{
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));st=db.prepare(native.sql).statement;
  const table=loadSchemaGraph(db).findTable('o');
  const roots=['oa','ob','oa','ob'].map(name=>table.indexes.find(i=>i.name===name).rootPage);
  const expected=v.rows.map(row=>row.map(decode));
  const program=compileTableSelect(parseSql(native.sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  // Native WhereEnd emits Next for outer x; selected inner i uses index
  // movement plus Return. Global tableNext includes this enclosing owner.
  const tableMoves=program.ops.filter(op=>op.code==='Next'||op.code==='Prev');
  assert.equal(tableMoves.length,1,'only the enclosing table loop moves');
  const outerCursor=program.ops.filter(op=>op.code==='OpenRead')[0].p2;
  assert.equal(tableMoves[0].p1,outerCursor,'no selected inner table scan');
  for(const mode of ['cancel','deadline']){
   assert.equal(await st.step(),'row');
   assert.deepEqual(Array.from({length:4},(_,i)=>st.column(i)),expected[0]);
   assert.equal(privateAccounting(st).orBranchStarts,1,'cancel while first inner selected arm is live');
   const ac=new AbortController();ac.abort('caller-stop');const options=mode==='cancel'?{signal:ac.signal}:{timeoutMs:0};
   const primary=await st.step(options).then(()=>null,e=>e);assert.equal(primary?.kind,mode==='cancel'?'cancelled':'timeout');
   await assert.rejects(st.step(),e=>e===primary);assert.throws(()=>st.reset(),e=>e===primary);
   const rows=[];while(await st.step()==='row')rows.push(Array.from({length:4},(_,i)=>st.column(i)));
   assert.deepEqual(rows,expected,'reset rebuilds correlated RHS, IN continuations and dedup');
   assert.deepEqual(privateAccounting(st).orBranchRoots,roots,'both selected arms execute for both enclosing rows');
   assert.equal(privateAccounting(st).tableNext,2,'two enclosing rowid-range advances; no inner table scan');
   st.reset();
  }
  st.finalize();st=null;
 }finally{if(st)try{st.finalize();}catch{} db?.closeDeferred();await new Promise(r=>server.close(r));}
});
