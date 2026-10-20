import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,orRuntimeArmClause,branchConsumedTerms} from '../../src/internal/where-plan.ts';
import {btreeFromConnection,IndexCursor} from '../../src/internal/btree.ts';
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
function assertTwoArmKeyControls(program,primary){
 const ops=program.ops,set=ops.find(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo);assert.ok(set);
 const found=ops.filter(o=>o.code==='Found'&&o.p1===set.p1),insert=ops.filter(o=>o.code==='IdxInsert'&&o.p1===set.p1);
 assert.equal(found.length,1);assert.equal(insert.length,1);assert.equal(insert[0].useSeekResult,false);
 const start=found[0].keyStart,width=primary.keyInfo.keyFieldCount;
 assert.equal(insert[0].keyStart,start);assert.equal(found[0].keyCount,width);assert.equal(insert[0].keyCount,width);
 assert.deepEqual(set.keyInfo.terms,primary.keyInfo.terms.slice(0,width));
 const record=ops[ops.indexOf(insert[0])-1];assert.equal(record.code,'MakeRecord');assert.deepEqual([record.p1,record.p2,record.p3],[start,width,insert[0].p2]);
 const second=ops[found[0].jump-1];assert.equal(second.code,'Gosub');assert.equal(ops.indexOf(second),ops.indexOf(found[0])+1);
 const pair=ops.filter(o=>o.code==='Gosub'&&o.p1===second.p1&&o.p2===second.p2);assert.equal(pair.length,2);
 assert.ok(ops.indexOf(insert[0])<ops.indexOf(pair[0]));assert.ok(ops.indexOf(pair[0])<ops.indexOf(found[0]));
 assert.ok(ops.some(o=>o.code==='Return'&&o.p1===second.p1));
 let identityCursor;
 for(const boundary of [ops.indexOf(insert[0])-1,ops.indexOf(found[0])]){
  const identity=ops.slice(0,boundary).filter(o=>o.code==='Column'&&o.p2>=start&&o.p2<start+width).slice(-width);
  assert.deepEqual(identity.map(o=>o.p2),Array.from({length:width},(_,i)=>start+i));
  assert.deepEqual(identity.map(o=>o.p1),Array.from({length:width},(_,i)=>i),'PK storage aiColumn mapping, not logical declaration order');
  identityCursor??=identity[0].p3??0;
  assert.ok(identity.every(o=>(o.p3??0)===identityCursor),'both arms extract from the same positioned primary');
  const keyOps=ops.slice(ops.indexOf(identity[0]),boundary);
  for(let i=0;i<width;i++){
   const affinities=keyOps.filter(o=>o.code==='RealAffinity'&&o.p1===start+i);
   assert.equal(affinities.length,primary.fields[i].column.affinity==='real'?1:0,'logical REAL adaptation follows PK Column');
  }
 }
}
const decode=c=>c.type==='integer'?BigInt(c.value):c.value;
async function withDb(v,run,options){
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>r.end(bytes)); await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);await run(db)}finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
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
 // Selected acceptance assertions. Do not spoof a rowid;
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
  const set=program.ops.find(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo);
  assert.ok(set,'selected union must use typed page VM');
  assert.equal(set.keyInfo.totalFieldCount,set.keyInfo.keyFieldCount);
  const found=program.ops.filter(o=>o.code==='Found'),insert=program.ops.filter(o=>o.code==='IdxInsert');
  assert.deepEqual(insert.map(o=>o.useSeekResult),[false,true]);
  for(const op of found){assert.equal(op.p1,set.p1);assert.equal(op.keyCount,set.keyInfo.keyFieldCount);assert.equal(program.ops[op.jump-1].code,'Gosub','duplicate skips exactly the arm Gosub');}
  for(const op of insert){assert.equal(op.p1,set.p1);assert.equal(program.ops[program.ops.indexOf(op)-1].code,'MakeRecord');assert.ok(op.p2!==undefined);}
  const primary=schema.findTable('w').indexes.find(i=>i.origin==='primary-key').physical;
  assert.equal(primary.keyInfo.keyFieldCount,2);assert.deepEqual(primary.fields.slice(0,2).map(f=>f.column.name),['k','n'],'physical PK aiColumn order differs from declaration');
  const calls=program.ops.filter(o=>o.code==='Gosub');assert.equal(calls.length,3);assert.ok(calls.every(o=>o.p1===calls[0].p1&&o.p2===calls[0].p2));
  assert.ok(program.ops.some(o=>o.code==='Return'&&o.p1===calls[0].p1));
  const starts=[...found.map(o=>o.keyStart),...insert.map(o=>o.keyStart)];assert.ok(starts.every(r=>r===starts[0]));
  assert.deepEqual(set.keyInfo.terms,primary.keyInfo.terms.slice(0,2));
  for(let arm=0;arm<calls.length;arm++){
   const end=program.ops.indexOf(calls[arm]),begin=arm?program.ops.indexOf(calls[arm-1])+1:program.ops.indexOf(set)+1;
   const slice=program.ops.slice(begin,end),identity=slice.filter(o=>o.code==='Column'&&o.p2>=starts[0]&&o.p2<starts[0]+2);
   assert.deepEqual(identity.map(o=>[o.p1,o.p2,o.p3??0]),[[0,starts[0],0],[1,starts[0]+1,0]]);
   assert.equal(slice.filter(o=>o.code==='Found').length,arm===0?0:1);
   assert.equal(slice.filter(o=>o.code==='IdxInsert').length,arm===2?0:1);
   if(arm>0){const f=slice.find(o=>o.code==='Found');assert.equal(f.jump,end+1);}
  }
  assert.equal(program.ops.filter(o=>o.code==='DeferredIndexSeek').length,0);
  assert.ok(program.ops.some(o=>o.code==='NotFound'),'secondary positions primary through NotFound');

 }));
}

// Source-control-flow regression: wherecode.c seeks a different table cursor,
// but never emits secondary positioning for an already positioned WR primary.
for(const v of capture.variants){
 test(`${v.encoding}: WR primary arms keep positioned primary cursor`,async()=>withDb(v,async db=>{
  const schema=loadSchemaGraph(db),sql="SELECT k,n,v FROM w WHERE (k='beta0' AND n=1) OR (k='Éclair0' AND n=2)";
  const program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo),'must genuinely select union');
  assert.equal(program.ops.filter(o=>o.code==='NotFound').length,0,'primary arms are already table positioned');
  const st=db.prepare(sql).statement;try{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1),st.column(2)]);assert.deepEqual(rows,[['beta0',1n,1],['Éclair0',2n,2]]);}finally{st.finalize()}
 }));
}

// Invocation-owned set must not retain identities across reset/rebind. Covers
// SQL type distinctions and clear_bindings NULL production without new fixtures.
for(const v of capture.variants){
 test(`${v.encoding}: selected WR typed rebinding and clearBindings lifecycle`,async()=>withDb(v,async db=>{
  const sql='SELECT k,n,v FROM w WHERE a=?1 OR b=?2 ORDER BY k,n';
  const schema=loadSchemaGraph(db);
  const program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo),'binding lifecycle must exercise selected union');
  const st=db.prepare(sql).statement;
  const read=async()=>{const rows=[];while(await st.step()==='row')rows.push(Array.from({length:3},(_,i)=>({type:st.columnType(i),value:st.column(i)})));return rows;};
  const expected=v.cases.find(c=>c.id==='overlap').rows.map(r=>r.map(c=>({type:c.type,value:decode(c)})));
  try{
   for(const pair of [[1n,2n],[1,2],['1','2'],[null,null],[new Uint8Array([1]),new Uint8Array([2])],[1n,2n]]){
    st.reset();st.bind(1,pair[0]);st.bind(2,pair[1]);
    assert.deepEqual(await read(),pair[0]===null||pair[0] instanceof Uint8Array?[]:expected);
   }
   st.reset();st.clearBindings();assert.deepEqual(await read(),[]);
   st.reset();st.bind(1,1n);st.bind(2,2n);assert.deepEqual(await read(),expected);
  }finally{st.finalize()}
 }));
}

// wherecode Case5 reopens invocation-owned state for each surrounding row;
// arm-local residual truth must run before retaining a PK identity.
for(const v of capture.variants){
 test(`${v.encoding}: WR correlated scalar resets dedup and preserves residual`,async()=>withDb(v,async db=>{
  const sql='SELECT u.x,(SELECT w.n FROM w WHERE (w.a=1 AND w.n=u.x) OR (w.b=2 AND w.n=u.x) LIMIT 1) FROM u WHERE u.x<=40 ORDER BY u.x';
  const schema=loadSchemaGraph(db);
  const program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo),'correlated scalar must select WR union');
  assertTwoArmKeyControls(program,schema.findTable('w').indexes.find(i=>i.origin==='primary-key').physical);
  const wanted=new Set(v.cases.find(c=>c.id==='overlap').rows.map(r=>decode(r[1])));
  const expected=Array.from({length:40},(_,i)=>{const n=BigInt(i+1);return [n,wanted.has(n)?n:null]});
  const st=db.prepare(sql).statement;
  try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);assert.deepEqual(rows,expected);}}finally{st.finalize()}
 }));
}

test('WR nested correlated empty-arm unions retain independent invocation state',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT u.x,(SELECT (SELECT z.n FROM w AS z WHERE (z.a=999 AND z.n=w.n) OR (z.a=1 AND z.n=w.n) OR (z.b=2 AND z.n=w.n) LIMIT 1) FROM w WHERE (w.a=1 AND w.n=u.x) OR (w.a=999 AND w.n=u.x) OR (w.b=2 AND w.n=u.x) LIMIT 1) FROM u WHERE u.x<=40 ORDER BY u.x';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 const sets=program.ops.filter(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo);assert.equal(sets.length,2,'both scalar levels must own selected typed union');assert.notEqual(sets[0].p1,sets[1].p1);
 const primary=loadSchemaGraph(db).findTable('w').indexes.find(i=>i.origin==='primary-key').physical;
 const registerStarts=[],returnRegisters=[],bodyTargets=[];
 for(const set of sets){
  const ops=program.ops,found=ops.filter(o=>o.code==='Found'&&o.p1===set.p1),inserts=ops.filter(o=>o.code==='IdxInsert'&&o.p1===set.p1);
  assert.equal(found.length,2);assert.equal(inserts.length,2);
  assert.deepEqual(inserts.map(o=>o.useSeekResult),[false,true]);
  const start=found[0].keyStart,width=set.keyInfo.keyFieldCount;registerStarts.push(start);
  const calls=found.map(o=>ops[o.jump-1]);assert.ok(calls.every(o=>o.code==='Gosub'));
  assert.equal(calls[0].p1,calls[1].p1);assert.equal(calls[0].p2,calls[1].p2);
  returnRegisters.push(calls[0].p1);bodyTargets.push(calls[0].p2);
  assert.equal(ops.filter(o=>o.code==='Gosub'&&o.p1===calls[0].p1&&o.p2===calls[0].p2).length,3);
  assert.ok(ops.some(o=>o.code==='Return'&&o.p1===calls[0].p1));
  for(const o of found){assert.equal(o.keyStart,start);assert.equal(o.keyCount,width);assert.equal(ops.indexOf(ops[o.jump-1]),ops.indexOf(o)+ (o===found[0]?3:1));}
  for(const insert of inserts){const record=ops[ops.indexOf(insert)-1];assert.deepEqual([record.code,record.p1,record.p2,record.p3],['MakeRecord',start,width,insert.p2]);}
  assert.deepEqual(set.keyInfo.terms,primary.keyInfo.terms.slice(0,width));
  let primaryCursor;
  // First arm identity precedes MakeRecord; middle/final precede Found.
  for(const boundary of [ops.indexOf(inserts[0])-1,...found.map(o=>ops.indexOf(o))]){
   const identity=ops.slice(0,boundary).filter(o=>o.code==='Column'&&o.p2>=start&&o.p2<start+width).slice(-width);
   assert.equal(identity.length,width);
   assert.deepEqual(identity.map(o=>o.p1),Array.from({length:width},(_,i)=>i));
   assert.deepEqual(identity.map(o=>o.p2),Array.from({length:width},(_,i)=>start+i));
   primaryCursor??=identity[0].p3??0;
   assert.ok(identity.every(o=>(o.p3??0)===primaryCursor));
  }

 }
 assert.equal(new Set(registerStarts).size,2);assert.equal(new Set(returnRegisters).size,2);assert.equal(new Set(bodyTargets).size,2);
 const wanted=new Set(capture.variants[0].cases.find(c=>c.id==='overlap').rows.map(r=>decode(r[1])));
 const expected=Array.from({length:40},(_,i)=>{const n=BigInt(i+1);return [n,wanted.has(n)?n:null]});
 const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);assert.deepEqual(rows,expected);}}finally{st.finalize()}
}));

for(const v of capture.variants){
 test(`${v.encoding}: WR empty arm continuations and result origins`,async()=>withDb(v,async db=>{
  const schema=loadSchemaGraph(db);
  const expected=v.cases.find(c=>c.id==='overlap').rows.map(r=>r.map(c=>({type:c.type,value:decode(c)})));
  // Empty first, middle and final while retaining overlap of nonempty arms.
  for(const predicate of ['a=999 OR a=1 OR b=2','a=1 OR a=999 OR b=2','a=1 OR b=2 OR a=999']){
   const sql=`SELECT k,n,v FROM w WHERE ${predicate} ORDER BY k,n`;
   const program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
   assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo),'empty-arm control must exercise selected union');
   const st=db.prepare(sql).statement;
   try{
    assert.deepEqual(Array.from({length:3},(_,i)=>st.columnMetadata(i)),[
     {name:'k',declaredType:'TEXT',database:'main',table:'w',origin:'k'},
     {name:'n',declaredType:'INTEGER',database:'main',table:'w',origin:'n'},
     {name:'v',declaredType:'REAL',database:'main',table:'w',origin:'v'}]);
    for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push(Array.from({length:3},(_,i)=>({type:st.columnType(i),value:st.column(i)})));assert.deepEqual(rows,expected);}
   }finally{st.finalize()}
  }
 }));
}

for(const v of capture.variants){
 test(`${v.encoding}: selected WR private entry failure releases statement state`,async()=>withDb(v,async db=>{
  const sql='SELECT k,n,v FROM w WHERE a=1 OR b=2';
  const schema=loadSchemaGraph(db),program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
  const st=db.prepare(sql).statement;
  await assert.rejects(st.step(),e=>e.kind==='limit');
  assert.throws(()=>st.reset(),e=>e.kind==='limit','reset preserves original failure');
  st.finalize();
  const next=db.prepare('SELECT 1').statement;try{assert.equal(await next.step(),'row');assert.equal(next.column(0),1n);}finally{next.finalize()}
 },{limits:{maxPrivateEntries:0}}));
}

test('selected WR private key and byte limits preserve reset and finalize ownership',async()=>{
 for(const limit of ['maxPrivateKeyBytes','maxPrivateBytes'])await withDb(capture.variants[0],async db=>{
  const sql='SELECT k,n,v FROM w WHERE a=1 OR b=2';
  const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
  const st=db.prepare(sql).statement;let primary;
  try{
   await assert.rejects(st.step(),e=>{primary=e;return e.kind==='limit'});
   assert.throws(()=>st.reset(),e=>e===primary);st.reset();
   await assert.rejects(st.step(),e=>{primary=e;return e.kind==='limit'});
  }finally{ assert.throws(()=>st.finalize(),e=>e===primary,'finalize releases statement and returns saved execution failure'); }
  const next=db.prepare('SELECT 1').statement;try{assert.equal(await next.step(),'row');assert.equal(next.column(0),1n);}finally{next.finalize()}
 },{limits:{[limit]:0}});
});

// where.c caller eligibility guards are distinct from AddOr's RIGHT guard.
// Public fallback rows alone do not demonstrate suppression of Case5 admission.
test('WR forced and NOT INDEXED eligibility owns fallback before union allocation',async()=>{
 const v=capture.variants[0];
 await withDb(v,async db=>{
  const schema=loadSchemaGraph(db);
  for(const id of ['forced','not-indexed']){
   const c=v.cases.find(c=>c.id===id),parsed=parseSql(c.sql).statement;
   const resolved=expandAndResolveSelect(parsed,schema);
   const chosen=planWhere(resolved,{neededColumns:[new Set(resolved.sources[0].table.columns)],orderBy:[]});
   assert.notEqual(chosen.path?.loops[0]?.kind,'multi-or',`${id} must not admit Case5`);
   const program=compileTableSelect(parsed,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
   assert.equal(program.ops.filter(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo).length,0,`${id} must not allocate key union`);
   assert.equal(program.ops.filter(o=>o.code==='Found'||o.code==='IdxInsert'||o.code==='RowSetTest').length,0,`${id} must not emit union dedup`);
  }
 });
});

// Interrupt a genuinely yielded union, not merely a pre-execution statement.
test('selected WR interruption preserves terminal error and reset admission',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT k,n,v FROM w WHERE a=1 OR b=2';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 for(const terminal of ['cancelled','timeout','limit']){
  const st=db.prepare(sql).statement;
  try{
   assert.equal(await st.step(),'row','union must be live at interruption');
   const controller=new AbortController();controller.abort('selected WR primary');
   const options=terminal==='cancelled'?{signal:controller.signal}:terminal==='timeout'?{timeoutMs:0}:{maxWorkUnits:0};
   await assert.rejects(st.step(options),e=>e.kind===terminal);
   assert.throws(()=>st.reset(),e=>e.kind===terminal);
   st.reset();assert.equal(await st.step(),'row','second reset clears saved failure and readmits same program');
  }finally{st.finalize()}
 }
}));

// Supplemental JS destructor failure: native xDel cannot throw.
test('selected WR cancellation wins over typed owner cleanup collision',async()=>withDb(capture.variants[0],async db=>{
 const original=PrivateKeyVmCursor.prototype.close,secondary=new Error('secondary WR cleanup');
 const sql='SELECT k,n,v FROM w WHERE a=1 OR b=2';
 let st;
 try{
  for(const terminal of ['reset','finalize']){
   st=db.prepare(sql).statement;assert.equal(await st.step(),'row');
   const closed=new Map();
   PrivateKeyVmCursor.prototype.close=function(){closed.set(this,(closed.get(this)??0)+1);original.call(this);throw secondary;};
   const ac=new AbortController();ac.abort('primary WR cancellation');let primary;
   await assert.rejects(st.step({signal:ac.signal}),e=>{primary=e;return e.kind==='cancelled'&&e!==secondary});
   assert.ok(closed.size>0,'production typed owner reached cleanup');
   for(const n of closed.values())assert.equal(n,1);
   await assert.rejects(st.step(),e=>e===primary);
   assert.throws(()=>st[terminal](),e=>e===primary);
   for(const n of closed.values())assert.equal(n,1,'detached owner must not close twice');
   PrivateKeyVmCursor.prototype.close=original;
   if(terminal==='reset'){assert.equal(await st.step(),'row');st.finalize();}else await assert.rejects(st.step(),e=>e.kind==='misuse');
   st=null;
  }
 }finally{PrivateKeyVmCursor.prototype.close=original;if(st)try{st.finalize()}catch{}}
}));

// Supplemental common-secondary witness, not a new transcribed native case.
// Case5 pCov agreement rewrites the shared body; WR primary never qualifies.
test('WR common secondary covering rewrites shared PK columns only',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT k,n FROM w WHERE (a=1 AND n<50) OR (a=2 AND n>350)';
 const schema=loadSchemaGraph(db),program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 const set=program.ops.find(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo);assert.ok(set,'must select typed union');
 const calls=program.ops.filter(o=>o.code==='Gosub');assert.equal(calls.length,2);assert.equal(calls[0].p2,calls[1].p2);
 const body=program.ops.slice(calls[0].p2),columns=body.filter(o=>o.code==='Column');
 assert.ok(columns.length>=2);assert.ok(columns.every(o=>o.p3!==0),'common body must use agreed secondary not primary');
 const expected=[];for(let i=1;i<=400;i++)if((i%19===1&&i<50)||(i%19===2&&i>350))expected.push([['Alpha','beta','Éclair','zeta'][i%4]+Math.floor(i/4),BigInt(i)]);
 const key=r=>`${r[1]}:${r[0]}`;
 const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);assert.deepEqual(rows.map(key).sort(),expected.map(key).sort());}}finally{st.finalize()}
}));

test('WR INNER common-secondary covering shares body and per-outer continuation',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT u.x,w.k,w.n FROM u INNER JOIN w ON w.n=u.x WHERE (w.a=1 AND w.n<50) OR (w.a=2 AND w.n>350)';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 const sets=program.ops.filter(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo);assert.equal(sets.length,1);
 assertTwoArmKeyControls(program,loadSchemaGraph(db).findTable('w').indexes.find(i=>i.origin==='primary-key').physical);
 const calls=program.ops.filter(o=>o.code==='Gosub');assert.equal(calls.length,2);assert.equal(calls[0].p1,calls[1].p1);assert.equal(calls[0].p2,calls[1].p2);
 const body=program.ops.slice(calls[0].p2),columns=body.filter(o=>o.code==='Column');
 assert.ok(columns.length>0);assert.ok(columns.every(o=>(o.p3??0)!==1),'WR logical PK body must use agreed secondary, not table cursor1');
 const found=program.ops.find(o=>o.code==='Found'&&o.p1===sets[0].p1);assert.ok(found);const at=program.ops.indexOf(found);assert.equal(found.jump,at+2);assert.equal(program.ops[at+1].code,'Gosub');
 const expected=[];for(let i=1;i<=400;i++)if((i%19===1&&i<50)||(i%19===2&&i>350))expected.push([BigInt(i),['Alpha','beta','Éclair','zeta'][i%4]+Math.floor(i/4),BigInt(i)]);
 const independent=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-inner-cover.json',import.meta.url)));assert.equal(independent.sourceId,manifest.sqliteSourceId);assert.equal(independent.sql,sql);
 const oracle=independent.variants.find(v=>v.encoding===capture.variants[0].encoding);assert.equal(oracle.fixtureSha256,capture.variants[0].fixture.sha256);
 const serial=r=>r.map(x=>typeof x==='bigint'?x.toString():x).join('|');
 assert.deepEqual(expected.map(serial).sort(),oracle.rows.map(r=>r.map(decode)).map(serial).sort());
 const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1),st.column(2)]);assert.deepEqual(rows.map(serial).sort(),expected.map(serial).sort());}}finally{st.finalize()}
}));

// pCov excludes WR primary even when every arm selects that same physical tree.
test('WR primary agreement never rewrites shared body as secondary covering',async()=>withDb(capture.variants[0],async db=>{
 const sql="SELECT k,n FROM w WHERE (k='beta0' AND n=1) OR (k='Éclair0' AND n=2)";
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 const calls=program.ops.filter(o=>o.code==='Gosub');assert.equal(calls.length,2);assert.equal(calls[0].p2,calls[1].p2);
 const columns=program.ops.slice(calls[0].p2).filter(o=>o.code==='Column');assert.ok(columns.length>=2);assert.ok(columns.every(o=>(o.p3??0)===0),'primary remains the table cursor in shared body');
 assert.equal(program.ops.filter(o=>o.code==='NotFound').length,0);
 const st=db.prepare(sql).statement;try{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);assert.deepEqual(rows,[['beta0',1n],['Éclair0',2n]]);}finally{st.finalize()}
}));

// Enclosing conjunct remains independently tested; rejected first-arm rows
// must not poison PK dedup before a later arm accepts the same identity.
test('WR commuted factored arms retain independent residual before dedup',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT k,n,v FROM w WHERE ((1=a AND n<10) OR (2=b AND n>5)) AND n<350';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 const set=program.ops.find(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo);assert.ok(set,'must use selected WR union');
 const insert=program.ops.findIndex(o=>o.code==='IdxInsert'&&o.p1===set.p1);
 const call=program.ops.findIndex(o=>o.code==='Gosub');
 assert.ok(program.ops.slice(0,insert).some(o=>o.code==='IfNot'&&o.residual),'first-arm residual precedes retention');
 const found=program.ops.find(o=>o.code==='Found'&&o.p1===set.p1);assert.ok(found);assert.equal(program.ops[found.jump-1].code,'Gosub');
 assert.ok(insert<call);
 const expected=[];for(let i=1;i<=400;i++)if(((i%19===1&&i<10)||(i%23===2&&i>5))&&i<350)expected.push([['Alpha','beta','Éclair','zeta'][i%4]+Math.floor(i/4),BigInt(i),i]);
 const key=r=>`${r[1]}:${r[0]}:${r[2]}`;
 assert.ok(expected.some(r=>r[1]===324n),'overlapping identity rejected by first residual then accepted later');
 const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row'){assert.equal(st.columnType(2),'real');rows.push([st.column(0),st.column(1),st.column(2)]);}assert.deepEqual(rows.map(key).sort(),expected.map(key).sort());}}finally{st.finalize()}
}));

// Native AddOr admits LEFT; nullable ON terms are excluded from factoring,
// not from Case5 admission. RIGHT/FULL remain a separate exclusion.
test('WR nullable-side OR admits Case5 and preserves null extension',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT u.x,w.n FROM u LEFT JOIN w ON (w.a=1 OR w.b=2) AND w.n=u.x WHERE u.x<=40 ORDER BY u.x';
 const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
 const plan=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[]});
 assert.ok(plan.path);assert.ok(plan.path.loops.some(loop=>loop.kind==='multi-or'&&loop.source.table.name==='w'),'LEFT admission must use source-shaped WR union');
 const program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.equal(program.ops.filter(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo).length,1);
 assert.ok(program.ops.some(o=>o.code==='Found'));assert.ok(program.ops.some(o=>o.code==='IdxInsert'));assert.equal(program.ops.filter(o=>o.code==='RowSetTest').length,0);
 const wanted=new Set(capture.variants[0].cases.find(c=>c.id==='overlap').rows.map(r=>decode(r[1])));
 const expected=Array.from({length:40},(_,i)=>{const n=BigInt(i+1);return[n,wanted.has(n)?n:null]});
 const independent=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-left.json',import.meta.url)));assert.equal(independent.sourceId,manifest.sqliteSourceId);assert.equal(independent.sql,sql);
 const variant=independent.variants.find(v=>v.encoding===capture.variants[0].encoding);
 assert.equal(variant.fixtureSha256,createHash('sha256').update(fs.readFileSync(new URL(`../../docs/research/card-s-i/${variant.encoding}.db`,import.meta.url))).digest('hex'));
 assert.deepEqual(expected,variant.rows.map(r=>r.map(decode)));
 const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);assert.deepEqual(rows,expected);}}finally{st.finalize()}
}));

test('WR selected unready arm preserves downstream parent truth',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT w.n,u.x FROM w CROSS JOIN u WHERE ((w.a=1 AND u.x=1) OR (w.b=2 AND u.x=2)) AND u.x<=2';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 const calls=program.ops.filter(o=>o.code==='Gosub');assert.ok(calls.length>=2);assert.ok(calls.some((a,i)=>calls.some((b,j)=>i!==j&&a.p1===b.p1&&a.p2===b.p2)),'selected arm pair shares continuation');
 const expected=[];for(let i=1;i<=400;i++){if(i%19===1)expected.push([BigInt(i),1n]);if(i%23===2)expected.push([BigInt(i),2n]);}
 const serial=r=>r.map(String).join('|');
 const independent=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-unready.json',import.meta.url)));assert.equal(independent.sourceId,manifest.sqliteSourceId);assert.equal(independent.sql,sql);
 const oracle=independent.variants.find(v=>v.encoding===capture.variants[0].encoding);assert.equal(oracle.fixtureSha256,capture.variants[0].fixture.sha256);assert.deepEqual(expected.map(serial).sort(),oracle.rows.map(r=>r.map(decode)).map(serial).sort());
 const resolved=expandAndResolveSelect(parseSql(sql).statement,loadSchemaGraph(db));
 const planned=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[]});
 const wr=planned.path.loops.find(l=>l.kind==='multi-or'&&l.source.table.name==='w');assert.ok(wr);
 const arms=wr.orInfo.clause.terms.filter(t=>!t.virtual);assert.ok(arms.some(t=>(t.prereqAll&~1n)!==0n),'w-only frontier cannot consume parent OR truth');
 const shared=calls.find(a=>calls.some(b=>a!==b&&a.p1===b.p1&&a.p2===b.p2));
 assert.ok(program.ops.slice(shared.p2).some(o=>o.code==='IfNot'&&o.residual),'downstream body retains untested arm truth');
 const st=db.prepare(sql).statement;try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);assert.deepEqual(rows.map(serial).sort(),expected.map(serial).sort());}}finally{st.finalize()}
}));

// Unsafe means losing nullable/unready truth, not banning LEFT admission.
test('WR nullable ON cannot be factored or coded before its correlated owner is ready',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT u.x,w.n FROM u LEFT JOIN w ON (w.a=1 OR w.b=2) AND w.n=u.x WHERE u.x<=40 ORDER BY u.x';
 const resolved=expandAndResolveSelect(parseSql(sql).statement,loadSchemaGraph(db));
 const plan=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[]});
 const loop=plan.path.loops.find(l=>l.kind==='multi-or'&&l.source.table.name==='w');assert.ok(loop);
 const clause=plan.analysis.clause,onTerms=clause.terms.filter(t=>t.outerOn);assert.ok(onTerms.length>=2);
 for(const arm of loop.orInfo.clause.terms.filter(t=>!t.virtual)){
  const scope=orRuntimeArmClause(arm,loop.sourceOrdinal,clause,loop.orInfo.clause);assert.ok(scope);
  assert.equal(scope.outer.terms.length,0,'LEFT ON disjunction cannot borrow enclosing terms, even indexable WHERE');
 }
 const correlated=onTerms.find(t=>t.prereqAll===3n&&t.operator==='eq');assert.ok(correlated);
 const ordinary=plan.path.loops.find(l=>l.source.table.name==='u');assert.ok(ordinary.capability);
 // Feed the actual owned ON term through disableTerm, without fabricating a
 // safe flag: notReady and nullable omission protections must both hold.
 const candidate={...ordinary,capability:{...ordinary.capability,equalitySlots:[{term:correlated}] ,lower:null,upper:null,rowidEquality:null,rowidLower:null,rowidUpper:null}};
 assert.equal(branchConsumedTerms(candidate,clause,2n).has(correlated),false,'unavailable outer source cannot be marked CODED');
 assert.equal(branchConsumedTerms(candidate,clause,3n).has(correlated),false,'ready nullable ON still retains owning residual');
}));

// RIGHT/FULL admission does not imply selected Case5 OR. Exercise both original
// shapes against pinned public execution, without assuming unordered scan order.
for(const join of ['RIGHT','FULL'])test(`WR ${join} nullable composition matches pinned execution`,async()=>{
 const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-right-full.json',import.meta.url)));
 assert.equal(native.sourceId,manifest.sqliteSourceId);
 for(const v of capture.variants)await withDb(v,async db=>{
  const sql=`SELECT u.x,w.n FROM u ${join} JOIN w ON (w.a=1 OR w.b=2) AND w.n=u.x`;
  const c=native.cases.find(c=>c.encoding===v.encoding&&c.sql===sql);assert.ok(c);
  assert.equal(c.fixtureSha256,v.fixture.sha256);
  const resolved=expandAndResolveSelect(parseSql(sql).statement,loadSchemaGraph(db));
  const plan=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[]});
  assert.ok(plan.path===null||plan.path.loops.every(loop=>loop.kind!=='multi-or'),'nullable OR retains non-Case5 execution');
  const s=db.prepare(sql).statement;
  try{
   const metadata=()=>Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,database:m.database,table:m.table,origin:m.origin}});
   const bag=rows=>rows.map(row=>JSON.stringify(row)).sort();
   for(let pass=0;pass<2;pass++){
    assert.deepEqual(metadata(),c.metadata);
    const rows=[];
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
     const type=s.columnType(i);assert.ok(type==='integer'||type==='null');
     return type==='null'?{type}:{type,value:String(s.column(i))};
    }));
    assert.deepEqual(bag(rows),bag(c.rows),`${v.encoding} ${join} pass${pass}`);
    assert.equal(await s.step(),'done');s.reset();
   }
  }finally{s.finalize()}
 });
});

const mixed=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-mixed.json',import.meta.url)));
for(const v of mixed.variants)test(`${v.encoding}: WR mixed typed PK union matches independent native`,async()=>withDb(v,async db=>{
 assert.equal(mixed.sourceId,manifest.sqliteSourceId);
 const program=compileTableSelect(parseSql(v.sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 assert.deepEqual(program.ops.filter(o=>o.code==='IdxInsert').map(o=>o.useSeekResult),[false,true]);
 const decodeMixed=c=>c.type==='blob'?Uint8Array.from(Buffer.from(c.value,'hex')):decode(c);
 const expected=v.rows.map(r=>r.map(decodeMixed));
 assert.ok(v.rows.some(r=>r[0].type==='blob'));assert.ok(v.rows.some(r=>r[0].type==='real'));assert.ok(v.rows.some(r=>r[0].type==='integer'));
 const st=db.prepare(v.sql).statement;try{for(let run=0;run<2;run++){st.reset();const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);assert.deepEqual(rows,expected);}}finally{st.finalize()}
}));

test('WR BLOB binding copies caller bytes and clearBindings drops identity',async()=>withDb(mixed.variants[0],async db=>{
 const sql='SELECT k,v FROM w WHERE (a=1 AND +k=?1) OR (b=2 AND +k=?1)';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 const st=db.prepare(sql).statement;const bytes=Uint8Array.of(0,255);
 const read=async()=>{const rows=[];while(await st.step()==='row')rows.push([st.columnType(0),st.column(0),st.column(1)]);return rows;};
 try{
  st.bind(1,bytes);bytes.fill(17);assert.deepEqual(await read(),[['blob',Uint8Array.of(0,255),5n]]);
  st.reset();st.clearBindings();assert.deepEqual(await read(),[]);
  st.reset();st.bind(1,Uint8Array.of(255,0));assert.deepEqual(await read(),[['blob',Uint8Array.of(255,0),6n]]);
  st.reset();st.bind(1,1.5);assert.deepEqual(await read(),[['real',1.5,1n]]);
 }finally{st.finalize()}
}));

const wrMetadata=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-wr-metadata.json',import.meta.url)));
assert.equal(wrMetadata.sourceId,manifest.sqliteSourceId);
for(const variant of capture.variants)test(`${variant.encoding}: WR selected alias expression and correlated scalar metadata origins`,async()=>withDb(variant,async db=>{
 const sql='SELECT w.k AS label,w.v AS amount,w.n+1 AS successor,(SELECT z.n FROM w AS z WHERE (z.a=1 AND z.n=w.n) OR (z.b=2 AND z.n=w.n) LIMIT 1) AS correlated FROM w WHERE a=1 OR b=2';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.equal(program.ops.filter(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo).length,2);
 assert.equal(sql,wrMetadata.sql);
 const native=wrMetadata.variants.find(v=>v.encoding===variant.encoding);assert.equal(native.fixtureSha256,variant.fixture.sha256);
 const expected=native.metadata;
 const st=db.prepare(sql).statement;try{
  assert.deepEqual(Array.from({length:4},(_,i)=>st.columnMetadata(i)),expected);
  for(let run=0;run<2;run++){st.reset();let count=0;while(await st.step()==='row'){assert.equal(st.columnType(1),'real');assert.equal(st.column(3),BigInt(st.column(2))-1n);count++;}assert.equal(count,variant.cases.find(c=>c.id==='overlap').rows.length);assert.deepEqual(Array.from({length:4},(_,i)=>st.columnMetadata(i)),expected);}
 }finally{st.finalize()}
}));

test('WR selected scalar carrier preserves logical TEXT and REAL comparison',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT w.n,w.v,(SELECT z.v FROM w AS z WHERE (z.a=1 AND z.n=w.n AND +z.k=w.k AND z.v=w.v) OR (z.b=2 AND z.n=w.n AND +z.k=w.k AND z.v=w.v) LIMIT 1) AS matched FROM w WHERE a=1 OR b=2';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.equal(program.ops.filter(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo).length,2,'outer and child actually select typed WR unions');
 const st=db.prepare(sql).statement;
 try{for(let run=0;run<2;run++){st.reset();let count=0;while(await st.step()==='row'){assert.equal(st.columnType(1),'real');assert.equal(st.columnType(2),'real');assert.equal(st.column(2),st.column(1));count++;}assert.equal(count,capture.variants[0].cases.find(c=>c.id==='overlap').rows.length);}}
 finally{st.finalize()}
}));

test('WR selected union bounded work versus NOT INDEXED offpath',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT k,n,v FROM w WHERE a=1 OR b=2';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 const selected=db.prepare(sql).statement,offpath=db.prepare('SELECT k,n,v FROM w NOT INDEXED WHERE a=1 OR b=2').statement;
 const collect=async st=>{const rows=[];while(await st.step({maxWorkUnits:1000000})==='row')rows.push([st.column(0),st.column(1),st.column(2)]);return rows;};
 try{
  const rows=await collect(selected);assert.equal(rows.length,capture.variants[0].cases.find(c=>c.id==='overlap').rows.length);
  assert.deepEqual((await collect(offpath)).sort(),rows.sort());
  const active=privateAccounting(selected),scan=privateAccounting(offpath);
  assert.equal(active.orBranchStarts,2);assert.equal(scan.orBranchStarts,0);
  assert.ok(active.indexSeeks>0);
  assert.ok(scan.indexNext>active.indexNext,'NOT INDEXED primary traversal advances more than selected secondary arms');
  assert.ok(scan.indexNext>=400,'offpath visits entire persistent primary');
  selected.reset();await assert.rejects(selected.step({maxWorkUnits:1}),e=>e.kind==='limit');
 }finally{try{try{selected.finalize()}catch(e){assert.equal(e.kind,'limit')}}finally{offpath.finalize()}}
}));

test('WR selected comparator and insert interruption preserve primary and release',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT k,n,v FROM w WHERE a=1 OR b=2';
 const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 for(const method of ['seek','insert']){
  const original=PrivateKeyVmCursor.prototype[method],close=PrivateKeyVmCursor.prototype.close;
  const ac=new AbortController(),closed=new Map();let reached=false,primary;
  const st=db.prepare(sql).statement;
  try{
   PrivateKeyVmCursor.prototype[method]=function(key,control){
    const wrapped={...control,checkpoint:async units=>{if(!reached&&units>0){reached=true;ac.abort('inside typed '+method);}await control.checkpoint(units);}};
    return original.call(this,key,wrapped);
   };
   PrivateKeyVmCursor.prototype.close=function(){closed.set(this,(closed.get(this)??0)+1);close.call(this);throw new Error('secondary cleanup');};
   await assert.rejects((async()=>{while(await st.step({signal:ac.signal})==='row'){} })(),e=>{primary=e;return e.kind==='cancelled'});
   assert.ok(reached);assert.ok(closed.size>0);for(const count of closed.values())assert.equal(count,1);
   assert.throws(()=>st.reset(),e=>e===primary);
   PrivateKeyVmCursor.prototype[method]=original;PrivateKeyVmCursor.prototype.close=close;
   st.reset();assert.equal(await st.step(),'row');
  }finally{PrivateKeyVmCursor.prototype[method]=original;PrivateKeyVmCursor.prototype.close=close;st.finalize()}
 }
}));

// wherecode.c2175ff: a missing secondary PK resumes its arm, never the body.
test('WR secondary primary-miss targets exact arm advancement',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT k,n FROM w WHERE a=1 OR b=2 OR (a=3 AND n>200)';
 const schema=loadSchemaGraph(db),program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 const pk=schema.findTable('w').indexes.find(i=>i.origin==='primary-key').physical;
 const ops=program.ops,misses=ops.filter(o=>o.code==='NotFound');assert.equal(misses.length,3);
 for(const miss of misses){
  const at=ops.indexOf(miss),extract=ops.slice(at-pk.keyInfo.keyFieldCount,at);
  assert.ok(extract.every(o=>o.code==='Column'));
  assert.deepEqual(extract.map(o=>o.p2),Array.from({length:pk.keyInfo.keyFieldCount},(_,i)=>miss.keyStart+i));
  assert.equal(miss.keyCount,pk.keyInfo.keyFieldCount);assert.equal(miss.p1,0);
  const advance=ops[miss.jump];assert.equal(advance.code,'IndexNext');
  assert.ok(extract.every(o=>o.p3===advance.p1));
  assert.ok(miss.jump>at);assert.ok(ops.slice(at,miss.jump).some(o=>o.code==='Gosub'));
 }
}));

// Supplemental scoped persistent miss injection, not corrupt-file oracle parity.
test('WR persistent primary misses skip rows and reset repositions normally',async()=>withDb(capture.variants[0],async db=>{
 const sql='SELECT k,n FROM w WHERE a=1 OR b=2 OR (a=3 AND n>200)';
 const st=db.prepare(sql).statement,original=IndexCursor.prototype.seek;let probes=0;
 const read=async()=>{const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);return rows};
 try{
  const expected=await read();assert.ok(expected.length>0);st.reset();
  IndexCursor.prototype.seek=function(...args){probes++;original.apply(this,args);return false};
  assert.deepEqual(await read(),[]);assert.ok(probes>0);
  // Also exercise CURSOR_INVALID: no cached primary record may leak to body.
  st.reset();probes=0;
  IndexCursor.prototype.seek=function(...args){probes++;original.apply(this,args);this.clearPosition();return false};
  assert.deepEqual(await read(),[]);assert.ok(probes>0);
  IndexCursor.prototype.seek=original;st.reset();assert.deepEqual(await read(),expected);
 }finally{IndexCursor.prototype.seek=original;st.finalize()}
}));

// vdbe.c Found/NotFound aborts before publishing existence/cache/jump on rc error.
test('WR primary probe error preserves identity before branch and reset',async()=>withDb(capture.variants[0],async db=>{
 const st=db.prepare('SELECT k,n FROM w WHERE a=1 OR b=2 OR (a=3 AND n>200)').statement;
 const original=IndexCursor.prototype.seek,close=PrivateKeyVmCursor.prototype.close;
 const marker=new Error('supplemental primary seek failure'),secondary=new Error('secondary probe cleanup');let reached=0;
 const closed=new Map();
 try{
  PrivateKeyVmCursor.prototype.close=function(){closed.set(this,(closed.get(this)??0)+1);close.call(this);throw secondary};
  IndexCursor.prototype.seek=function(...args){original.apply(this,args);reached++;throw marker};
  await assert.rejects(st.step(),e=>e===marker);assert.equal(reached,1);
  assert.ok(closed.size>0);assert.ok([...closed.values()].every(n=>n===1),'failed probe detaches typed owners once');
  await assert.rejects(st.step(),e=>e===marker);assert.equal(reached,1,'failed VM must not resume another arm');
  assert.ok([...closed.values()].every(n=>n===1));
  IndexCursor.prototype.seek=original;PrivateKeyVmCursor.prototype.close=close;
  assert.throws(()=>st.reset(),e=>e===marker);st.reset();
  assert.equal(await st.step(),'row');
  st.reset();
  IndexCursor.prototype.seek=function(...args){original.apply(this,args);throw marker};
  await assert.rejects(st.step(),e=>e===marker);
  IndexCursor.prototype.seek=original;
  assert.throws(()=>st.finalize(),e=>e===marker);
  await assert.rejects(st.step(),e=>e.kind==='misuse');

 }finally{IndexCursor.prototype.seek=original;PrivateKeyVmCursor.prototype.close=close;try{st.finalize()}catch(e){assert.equal(e.kind,'misuse')}}

}));

const innerPrimary=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-inner-primary.json',import.meta.url)));
assert.equal(innerPrimary.sourceId,manifest.sqliteSourceId);
for(const variant of capture.variants)test(`${variant.encoding}: WR INNER primary arms exclude common-secondary remap`,async()=>withDb(variant,async db=>{
 const sql="SELECT u.x,w.k,w.n FROM u INNER JOIN w ON w.n=u.x WHERE (w.k='beta0' AND w.n=1) OR (w.k='Éclair0' AND w.n=2)";
 assert.equal(sql,innerPrimary.sql);
 const native=innerPrimary.variants.find(v=>v.encoding===variant.encoding);assert.equal(native.fixtureSha256,variant.fixture.sha256);
 const schema=loadSchemaGraph(db),program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
 assert.ok(program.ops.some(o=>o.code==='OpenEphemeral'&&o.p4KeyInfo));
 assertTwoArmKeyControls(program,schema.findTable('w').indexes.find(i=>i.origin==='primary-key').physical);
 assert.equal(program.ops.filter(o=>o.code==='NotFound').length,0);
 const calls=program.ops.filter(o=>o.code==='Gosub');assert.equal(calls.length,2);
 const columns=program.ops.slice(calls[0].p2).filter(o=>o.code==='Column');
 assert.ok(columns.some(o=>(o.p3??0)===1),'shared body retains primary cursor1');
 const st=db.prepare(sql).statement;
 try{for(let pass=0;pass<2;pass++){const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1),st.column(2)]);assert.deepEqual(rows,native.rows.map(r=>r.map(decode)));st.reset()}}
 finally{st.finalize()}
}));
