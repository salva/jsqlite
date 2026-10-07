import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {parseSql} from '../../src/internal/parse.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
import {storageOwner,StorageClosedError} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/frontier-review-native.json',import.meta.url)));
// Pinned wherecode.c Case5 pSubWInfo->untestedTerms: AND predicates on
// notReady tables must survive arm selection and be tested downstream. These
// two arms disagree on y; disabling the parent too early admits false pairs.
for(const v of capture.variants)test(`${v.id}: unready AND arm truth survives selected parent and enclosing continuation`,async()=>{
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st,deferred=false;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));st=db.prepare(capture.sql).statement;
  const table=loadSchemaGraph(db).findTable('o');
  const program=compileTableSelect(parseSql(capture.sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const tests=program.ops.filter(op=>op.code==='RowSetTest');
  const calls=program.ops.filter(op=>op.code==='Gosub');
  const owners=[...new Set(tests.map(op=>op.p1))];
  assert.ok(owners.length>0);
  const ownedRegisters=[];
  for(const owner of owners){
   const arms=tests.filter(op=>op.p1===owner);
   assert.deepEqual(arms.map(op=>op.p4),[0,-1],'per-level first/final batch ownership');
   const armCalls=arms.map(op=>program.ops[program.ops.indexOf(op)+1]);
   assert.ok(armCalls.every(op=>op.code==='Gosub'));
   assert.equal(armCalls[0].p1,armCalls[1].p1,'shared return register within level');
   assert.equal(armCalls[0].p2,armCalls[1].p2,'one downstream continuation within level');
   assert.equal(arms[0].p3,arms[1].p3,'one rowid scratch register per owner');
   ownedRegisters.push(owner,arms[0].p3,armCalls[0].p1);
   const first=program.ops.indexOf(arms[0]);
   const initializers=program.ops.slice(0,first);
   assert.ok(initializers.some(op=>op.code==='Null'&&op.p2===owner),'owning invocation resets RowSet before arm membership');
   assert.ok(initializers.some(op=>op.code==='Integer'&&op.p2===armCalls[0].p1),'safe return state initialized before arm entry');
   for(const arm of arms){
    const at=program.ops.indexOf(arm);
    assert.equal(arm.p2,at+2,'duplicate resumes immediately after common-body call, not an enclosing break');
    const producer=program.ops[at-1];
    assert.equal(producer.code,'Rowid','membership consumes rowid from positioned table owner');
    assert.equal(producer.p2,arm.p3,'rowid producer feeds this owner scratch');
   }
   const sourceCursors=arms.map(arm=>program.ops[program.ops.indexOf(arm)-1].p1);
   assert.equal(sourceCursors[0],sourceCursors[1],'both arm rowids belong to the same selected table cursor');
   assert.ok(program.ops.some(op=>op.code==='OpenRead'&&op.p2===sourceCursors[0]),'membership rowid owner is an opened table cursor');
   assert.ok(program.ops.some(op=>op.code==='Return'&&op.p1===armCalls[0].p1));
  }
  assert.equal(new Set(ownedRegisters).size,ownedRegisters.length,'RowSet, rowid scratch and return owners cannot alias within or across levels');
  assert.equal(new Set(calls.map(op=>op.p1)).size,owners.length,'distinct levels cannot alias return ownership');
  const roots=['oa','ob'].map(name=>table.indexes.find(index=>index.name===name).rootPage);
  const expected=v.rows.map(row=>row.map(cell=>{assert.equal(cell.type,'integer');return BigInt(cell.value);}));
  for(const prefix of [1,2,0]){
   for(let i=0;i<prefix;i++){assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1)],expected[i]);}
   const metadataBeforeReset=[st.columnMetadata(0),st.columnMetadata(1)];
   st.reset();
   assert.deepEqual([st.columnMetadata(0),st.columnMetadata(1)],metadataBeforeReset,'reset retains prepared result metadata while invalidating row');
   assert.notEqual(st.columnMetadata(0),metadataBeforeReset[0],'metadata records remain fresh across reset');
   assert.ok(Object.isFrozen(st.columnMetadata(0)),'retained metadata stays immutable');
   assert.throws(()=>st.column(0),error=>error.kind==='misuse','partial reset invalidates previously exposed selected row');
   assert.deepEqual(privateAccounting(st),{plannerCandidates:0,plannerPaths:0,indexSeeks:0,indexNext:0,tableSeeks:0,tableNext:0,residualTests:0,sorterRows:0,inProbes:0,orBranchStarts:0,orBranchRoots:[],orDuplicateSkips:0},'reset clears complete per-execution access state before replay');
   const resetAccounting=privateAccounting(st);
   assert.doesNotThrow(()=>st.reset(),'second reset with no intervening step remains valid');
   assert.deepEqual(privateAccounting(st),resetAccounting,'second reset retains zero per-execution state');
   assert.deepEqual([st.columnMetadata(0),st.columnMetadata(1)],metadataBeforeReset,'repeated reset retains prepared metadata');
   const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);
   assert.deepEqual(rows,expected,'notReady arm conditions remain common-body owned');
   assert.equal(privateAccounting(st).orBranchStarts,2,'actual selected branches, not scan-only truth');
   assert.deepEqual(privateAccounting(st).orBranchRoots,roots,'ordered original arm identity is restored after partial reset');
   assert.ok(privateAccounting(st).residualTests>0,'unready truth executes downstream residual control');
   const halted=privateAccounting(st);
   assert.equal(await st.step(),'done','completed selected caller remains halted until reset');
   assert.deepEqual(privateAccounting(st),halted,'repeated done must not restart arms or mutate access accounting');
   st.reset();
  }
  assert.equal(await st.step(),'row','finalize with selected unready caller suspended');
  assert.deepEqual([st.column(0),st.column(1)],expected[0]);
  assert.throws(()=>db.close(),error=>error.kind==='sqlite'&&error.code===5,'busy close preserves selected caller rather than cascading finalize');
  assert.deepEqual([st.column(0),st.column(1)],expected[0],'busy close leaves current row usable');
  assert.equal(await st.step(),'row','busy close leaves suspended continuation usable');
  assert.deepEqual([st.column(0),st.column(1)],expected[1]);
  const resident=db[storageOwner],generation=resident.generation;
  db.closeDeferred();deferred=true;
  assert.equal(resident.closed,false,'zombie retains resident bytes for suspended caller');
  assert.throws(()=>db.prepare(capture.sql),error=>error.kind==='misuse','zombie rejects new selected callers');
  const remaining=[];while(await st.step()==='row')remaining.push([st.column(0),st.column(1)]);
  assert.deepEqual(remaining,expected.slice(2),'existing selected continuation survives deferred close');
  st.reset();assert.equal(await st.step(),'row','existing zombie caller can reset and suspend again');
  assert.deepEqual([st.column(0),st.column(1)],expected[0]);
  const finalized=st;st.finalize();st=null;
  assert.throws(()=>finalized.column(0),error=>error.kind==='misuse','finalize invalidates suspended selected row');
  assert.throws(()=>finalized.columnMetadata(0),error=>error.kind==='misuse','finalize destroys prepared metadata handle too');
  assert.equal(resident.closed,true,'last suspended statement finalization releases zombie storage owner');
  assert.equal(resident.generation,generation+1,'resident owner closes exactly once');
  assert.throws(()=>resident.read(0,1),StorageClosedError,'resident reads are invalidated, not merely new prepare');
  assert.throws(()=>db.prepare(capture.sql),error=>error.kind==='misuse','last finalize leaves connection unusable');
  await assert.rejects(finalized.step(),error=>error.kind==='misuse');
  assert.throws(()=>finalized.reset(),error=>error.kind==='misuse');
  assert.throws(()=>finalized.finalize(),error=>error.kind==='misuse');
 }finally{if(st)try{st.finalize();}catch{} db&& !deferred && db.closeDeferred();await new Promise(r=>server.close(r));}
});
