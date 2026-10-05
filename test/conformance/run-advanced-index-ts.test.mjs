import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,ROWID_NEEDED} from '../../src/internal/where-plan.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
import {btreeFromConnection,BtreeDatabase,TableScanCursor,IndexCursor} from '../../src/internal/btree.ts';
import {UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {decodeRecord} from '../../src/internal/record.ts';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/stage3-advanced-index.json',import.meta.url),'utf8'));
const specification=JSON.parse(fs.readFileSync(new URL('./cases/stage3-advanced-index.spec.json',import.meta.url),'utf8'));
const pinnedManifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));
const privateContracts=new Map(specification.cases.map(c=>[c.id,c.futurePrivateExpected]));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
const value=v=>v&&v.type==='blob'?Uint8Array.from(Buffer.from(v.hex,'hex')):typeof v==='number'&&Number.isInteger(v)?BigInt(v):v;
const expectedRows=rows=>rows.map(row=>row.map(decode));
// Internal schema assertion, not selected-path credit: schema identity alone
// does not establish which loop the planner chose.
test('loaded partial/expression PhysicalIndex and KeyInfo match pinned per-encoding xinfo',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const graph=loadSchemaGraph(db);
  const roots=new Map(variant.fixture.schema.map(row=>[decode(row[1]),Number(decode(row[3]))]));
  for(const name of ['p_live','e_expr']){
   const index=graph.indexes.get(name),physical=index?.physical;
   assert.ok(physical,`${variant.id}/${name}: physical index`);
   assert.equal(index.rootPage,roots.get(name),`${variant.id}/${name}: captured root`);
   const xinfo=variant.fixture.indexXinfo[name];
   assert.equal(physical.declaredFieldCount,2);
   assert.equal(physical.rowidField,2);
   assert.equal(physical.fields.length,xinfo.length);
   assert.equal(physical.keyInfo.totalFieldCount,xinfo.length);
   assert.equal(physical.keyInfo.keyFieldCount,xinfo.length);
   for(let i=0;i<xinfo.length;i++){
    const row=xinfo[i],field=physical.fields[i],term=physical.keyInfo.terms[i],cid=Number(decode(row[1]));
    assert.equal(field.role,i===2?'rowid-tail':'declared',`${variant.id}/${name}/${i}: role`);
    assert.equal(field.column?.name??null,cid>=0?decode(row[2]):null,`${variant.id}/${name}/${i}: column`);
    assert.equal(field.expression!==null,cid===-2,`${variant.id}/${name}/${i}: expression`);
    assert.equal(field.descending,Boolean(Number(decode(row[3]))),`${variant.id}/${name}/${i}: direction`);
    assert.equal(field.collation,decode(row[4]).toLowerCase(),`${variant.id}/${name}/${i}: collation`);
    assert.equal(term.desc,field.descending);assert.equal(term.collation,field.collation);
    assert.equal(field.nullsLarge,false);assert.equal(term.nullsLarge,false);
   }
  }
 });
});
// Internal handoff identity, distinct from an assertion about public execution
// or SQLite's exact cost-model choice for unforced queries.
test('forced frozen selected paths hand off exact loaded roots and KeyInfo to the planner',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const graph=loadSchemaGraph(db);
  for(const [name,sql] of [
   ['p_live','SELECT id,b FROM p INDEXED BY p_live WHERE a=?1 AND c IS NOT NULL ORDER BY b'],
   ['e_expr','SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+1=?2'],
  ]){
   const resolved=expandAndResolveSelect(parseSql(sql).statement,graph);
   const table=resolved.sources[0].table;
   const needed=new Set([ROWID_NEEDED,...table.columns]);
   const selection=planWhere(resolved,{neededColumns:[needed],orderBy:[]});
   const loop=selection.path?.loops[0],physical=graph.indexes.get(name).physical;
   assert.equal(loop?.kind,'index',`${variant.id}/${name}: forced selected loop`);
   assert.equal(loop.source,resolved.sources[0],`${variant.id}/${name}: resolved source`);
   assert.equal(loop.capability.index,physical.index,`${variant.id}/${name}: exact root owner`);
   assert.equal(loop.capability.physicalIndex,physical,`${variant.id}/${name}: exact descriptor`);
   const admissions=[...loop.capability.equalityPrefix,...(loop.capability.lower?[loop.capability.lower]:[]),...(loop.capability.upper?[loop.capability.upper]:[])];
   assert.ok(admissions.length,`${variant.id}/${name}: index constraints admitted`);
   for(const admission of admissions){
    assert.equal(admission.physicalIndex,physical);
    assert.equal(admission.field,physical.fields[admission.fieldOrdinal]);
    assert.equal(admission.keyInfoTerm,physical.keyInfo.terms[admission.fieldOrdinal]);
    assert.equal(admission.term.left?.source,resolved.sources[0]);
   }
  }
 });
});
// Private compiled-program observation; public stepping and native nine-counter
// parity remain separate requirements.
test('forced frozen partial/expression lowering opens the planned physical root and seeks with its KeyInfo',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const graph=loadSchemaGraph(db),btree=btreeFromConnection(db);
  for(const [name,sql] of [
   ['p_live','SELECT id,b FROM p INDEXED BY p_live WHERE a=?1 AND c IS NOT NULL ORDER BY b'],
   ['e_expr','SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+1=?2'],
  ]){
   const physical=graph.indexes.get(name).physical;
   const program=compileTableSelect(parseSql(sql).statement,graph,btree,100);
   const opens=program.ops.filter(op=>op.code==='OpenIndex'&&op.p1===physical.index.rootPage);
   assert.equal(opens.length,1,`${variant.id}/${name}: selected physical open`);
   assert.equal(opens[0].physical,physical,`${variant.id}/${name}: same loaded descriptor`);
   const seeks=program.ops.filter(op=>op.code==='IndexSeekPrefix'&&op.p1===opens[0].p2);
   assert.equal(seeks.length,1,`${variant.id}/${name}: selected cursor seek`);
   assert.equal(seeks[0].keyInfo,physical.keyInfo,`${variant.id}/${name}: same selected KeyInfo`);
   assert.equal(seeks[0].keys.length, name==='e_expr'?2:1,`${variant.id}/${name}: equality prefix width`);
  }
 });
});
// Frozen native SQL, unlike the neighboring forced cases: assert the actual
// unforced lowering choice and public typed rows without promoting credit for
// nine-family accounting until the full contract is checked.
test('frozen unforced partial/expression SQL selects captured roots and returns pinned typed rows',async()=>{
 const selected=new Map([['partial-implied','p_live'],['expression-identical','e_expr']]);
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const graph=loadSchemaGraph(db),btree=btreeFromConnection(db);
  const captured=new Map(variant.cases.map(c=>[c.id,c]));
  for(const spec of specification.cases.filter(c=>['partial-implied','partial-not-implied','expression-identical','expression-mismatch'].includes(c.id))){
   const program=compileTableSelect(parseSql(spec.sql).statement,graph,btree,100);
   const root=selected.get(spec.id),physical=root?graph.indexes.get(root).physical:null;
   const opens=program.ops.filter(op=>op.code==='OpenIndex'&&(op.p1===graph.indexes.get('p_live').rootPage||op.p1===graph.indexes.get('e_expr').rootPage));
   if(root){
    assert.equal(opens.length,1,`${variant.id}/${spec.id}: selected root`);
    assert.equal(program.ops.filter(op=>op.code==='OpenIndex').length,1,`${variant.id}/${spec.id}: exactly one index open globally`);
    assert.equal(program.ops.filter(op=>op.code==='IndexSeekPrefix').length,1,`${variant.id}/${spec.id}: exactly one index seek globally`);
    assert.equal(opens[0].physical,physical,`${variant.id}/${spec.id}: selected descriptor`);
    const seeks=program.ops.filter(op=>op.code==='IndexSeekPrefix'&&op.p1===opens[0].p2);
    assert.equal(seeks.length,1,`${variant.id}/${spec.id}: selected seek`);
    assert.equal(seeks[0].keyInfo,physical.keyInfo,`${variant.id}/${spec.id}: selected KeyInfo`);
   }else{
    assert.equal(opens.length,0,`${variant.id}/${spec.id}: no partial/expression root`);
    assert.equal(program.ops.filter(op=>op.code==='OpenIndex').length,0,`${variant.id}/${spec.id}: no other index root`);
    assert.equal(program.ops.filter(op=>op.code==='IndexSeekPrefix').length,0,`${variant.id}/${spec.id}: no orphan index seek`);
   }
   assert.deepEqual(await execute(db,spec.sql,spec.bindings),expectedRows(captured.get(spec.id).rows),`${variant.id}/${spec.id}: pinned rows`);
  }
 });
});
// Bind the existing nine-family private bounds to the *same* frozen public
// execution whose unforced compiled program selects (or avoids) the captured
// physical root. This is not native runtime root telemetry or credit metadata.
test('frozen partial/expression selected roots and nine-family counters stay paired across reset',async()=>{
 const chosen=new Map([['partial-implied','p_live'],['expression-identical','e_expr']]);
 const cases=specification.cases.filter(c=>['partial-implied','partial-not-implied','expression-identical','expression-mismatch'].includes(c.id));
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const graph=loadSchemaGraph(db),btree=btreeFromConnection(db),native=new Map(variant.cases.map(c=>[c.id,c]));
  for(const spec of cases){
   const expected=spec.futurePrivateExpected,program=compileTableSelect(parseSql(spec.sql).statement,graph,btree,100);
   const index=chosen.get(spec.id),physical=index?graph.indexes.get(index).physical:null;
   const selected=program.ops.filter(op=>op.code==='OpenIndex'&&['p_live','e_expr'].some(name=>op.p1===graph.indexes.get(name).rootPage));
   assert.equal(selected.length,index?1:0,`${variant.id}/${spec.id}: selected-root count`);
   if(physical){
    assert.equal(selected[0].physical,physical,`${variant.id}/${spec.id}: selected physical identity`);
    assert.ok(program.ops.some(op=>op.code==='IndexSeekPrefix'&&op.p1===selected[0].p2&&op.keyInfo===physical.keyInfo),`${variant.id}/${spec.id}: selected cursor/KeyInfo`);
   }
   const statement=db.prepare(spec.sql).statement;
   try{for(let run=0;run<2;run++){
    if(run)statement.reset();statement.clearBindings();spec.bindings.forEach((binding,i)=>statement.bind(i+1,value(binding)));
    assert.deepEqual(await rows(statement),expectedRows(native.get(spec.id).rows),`${variant.id}/${spec.id}/${run}: typed rows`);
    assertAccounting(privateAccounting(statement),expected,`${variant.id}/${spec.id}/${run}: nine-family`);
   }}finally{statement.finalize()}
  }
 });
});
// A first row leaves the statement active: resetting here must release its
// selected cursor (or scan state), not merely replay a completed statement.
test('frozen partial/expression access survives reset after one public row',async()=>{
 const selected=new Map([['partial-implied','p_live'],['expression-identical','e_expr']]);
 const cases=specification.cases.filter(c=>['partial-implied','partial-not-implied','expression-identical','expression-mismatch'].includes(c.id));
 const openIndex=BtreeDatabase.prototype.indexCursor,seekIndex=BtreeDatabase.prototype.indexSeek,nextIndex=IndexCursor.prototype.next,moveIndex=BtreeDatabase.prototype.indexMove,boundaryIndex=BtreeDatabase.prototype.indexBoundary;
 let active=null;
 BtreeDatabase.prototype.indexCursor=function(root){const cursor=openIndex.call(this,root);if(active){active.opens.push(root);active.cursors.push(cursor)}return cursor};
 BtreeDatabase.prototype.indexBoundary=function(root,direction){if(active)active.boundaries.push({root,direction});return boundaryIndex.call(this,root,direction)};
 BtreeDatabase.prototype.indexSeek=function(root,compare,bias){const result=seekIndex.call(this,root,compare,bias);if(active)active.seeks.push({root,bias,exact:result.exact});return result};
 IndexCursor.prototype.next=function(){if(active)active.nexts.push(this);return nextIndex.call(this)};
 BtreeDatabase.prototype.indexMove=function(position,direction){if(active)active.moves.push(direction);return moveIndex.call(this,position,direction)};
 try{for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const graph=loadSchemaGraph(db),native=new Map(variant.cases.map(c=>[c.id,c]));
  for(const spec of cases){
   const expected=expectedRows(native.get(spec.id).rows),statement=db.prepare(spec.sql).statement;
   try{
    spec.bindings.forEach((binding,i)=>statement.bind(i+1,value(binding)));
    const first={opens:[],seeks:[],cursors:[],nexts:[],moves:[],boundaries:[]};active=first;
    try{assert.equal(await statement.step(),'row',`${variant.id}/${spec.id}: first row`)}finally{active=null}
    assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)),expected[0],`${variant.id}/${spec.id}: first typed row`);
    // After an active e_expr row, invalidate its *second* equality field;
    // p_live and the scan neighbors continue to invalidate the first field.
    const emptySlot=spec.id==='expression-identical'?1:0;
    statement.reset();statement.clearBindings();spec.bindings.forEach((binding,i)=>statement.bind(i+1,i===emptySlot?null:value(binding)));
    const empty={opens:[],seeks:[],cursors:[],nexts:[],moves:[],boundaries:[]};active=empty;
    try{assert.deepEqual(await rows(statement),[],`${variant.id}/${spec.id}: empty after active reset`)}finally{active=null}
    if(selected.has(spec.id))assert.equal(privateAccounting(statement).tableSeeks,0,`${variant.id}/${spec.id}: no base seek on empty run`);
    statement.reset();statement.clearBindings();spec.bindings.forEach((binding,i)=>statement.bind(i+1,value(binding)));
    const rebound={opens:[],seeks:[],cursors:[],nexts:[],moves:[],boundaries:[]};active=rebound;
    try{assert.deepEqual(await rows(statement),expected,`${variant.id}/${spec.id}: complete rebound rows`)}finally{active=null}
    const root=selected.has(spec.id)?graph.indexes.get(selected.get(spec.id)).rootPage:null;
    if(root){
     assert.equal(first.cursors.length,1,`${variant.id}/${spec.id}: active first row owns one selected cursor`);
     assert.equal(empty.cursors.length,1,`${variant.id}/${spec.id}: NULL run opens its own selected cursor`);
     assert.equal(rebound.cursors.length,1,`${variant.id}/${spec.id}: rebound opens its own selected cursor`);
     assert.notStrictEqual(first.cursors[0],empty.cursors[0],`${variant.id}/${spec.id}: NULL rebind cannot retain active-row cursor`);
     assert.notStrictEqual(empty.cursors[0],rebound.cursors[0],`${variant.id}/${spec.id}: rebound cannot retain NULL cursor`);
     assert.notStrictEqual(first.cursors[0],rebound.cursors[0],`${variant.id}/${spec.id}: rebound cannot revive active-row cursor`);
    }
    for(const [phase,events] of [['first',first],['empty',empty],['rebound',rebound]]){
     assert.deepEqual(events.opens,root?[root]:[],`${variant.id}/${spec.id}/${phase}: opened root`);
     assert.deepEqual(events.seeks,root&&phase!=='empty'?[{root,bias:'ge',exact:true}]:[],`${variant.id}/${spec.id}/${phase}: seek restarts with live bound prefix`);
     assert.deepEqual(events.boundaries,[],`${variant.id}/${spec.id}/${phase}: no full-index boundary fallback during active-row reset`);
     assert.deepEqual(events.nexts,root&&phase==='rebound'?events.cursors:[],`${variant.id}/${spec.id}/${phase}: active reset has no stale index iteration`);
     assert.deepEqual(events.moves,root&&phase==='rebound'?['next']:[],`${variant.id}/${spec.id}/${phase}: only complete rebound advances physically`);
    }
    if(selected.has(spec.id))assertAccounting(privateAccounting(statement),spec.futurePrivateExpected,`${variant.id}/${spec.id}: rebound selected bounds`);
    else assert.equal(privateAccounting(statement).indexSeeks,0,`${variant.id}/${spec.id}: rebound scan`);
   }finally{statement.finalize()}
  }
 });}finally{active=null;BtreeDatabase.prototype.indexCursor=openIndex;BtreeDatabase.prototype.indexSeek=seekIndex;IndexCursor.prototype.next=nextIndex;BtreeDatabase.prototype.indexMove=moveIndex;BtreeDatabase.prototype.indexBoundary=boundaryIndex}
});
// Test-only interception of the production BtreeDatabase.indexCursor primitive.
// Limit to this test's serial window and restore in finally; no public API added.
test('frozen unforced executions open the expected runtime index root only on selected paths',async()=>{
 assert.deepEqual([capture.source.version,capture.source.sourceId],[pinnedManifest.version,pinnedManifest.sqliteSourceId],'runtime probe uses the declared pinned SQLite identity');
 assert.deepEqual([specification.source.version,specification.source.sourceId],[pinnedManifest.version,pinnedManifest.sqliteSourceId],'runtime contract uses the same pinned SQLite identity');
 const chosen=new Map([['partial-implied','p_live'],['expression-identical','e_expr']]);
 const observedPaths={selected:0,scan:0};
 const expectedVariants=new Map([['utf8','UTF-8'],['utf16le','UTF-16le'],['utf16be','UTF-16be']]);
 assert.equal(capture.variants.length,expectedVariants.size,'one frozen fixture per declared database encoding');
 assert.deepEqual(new Map(capture.variants.map(v=>[v.id,v.encoding])),expectedVariants,'frozen runtime observations cover three distinct database encodings');
 const cases=specification.cases.filter(c=>['partial-implied','partial-not-implied','expression-identical','expression-mismatch'].includes(c.id));
 // Credit is limited to frozen positive selected-access assertions; negative
 // scan controls remain attempted public rows but not selected-access credit.
 assert.deepEqual(cases.map(c=>[c.id,c.futurePrivateExpected.status,c.futurePrivateExpected.credit]),[
  ['partial-implied','passing',3],['partial-not-implied','unattempted',0],
  ['expression-identical','passing',3],['expression-mismatch','unattempted',0]
 ],'selected positives and scan-only negatives retain distinct credit status');
 assert.equal(capture.accounting.tsCreditedCases,24,'selected positive credit is bounded to the frozen six encoding pairs');
 const expectedCaseIds=['partial-implied','partial-not-implied','expression-identical','expression-mismatch'];
 assert.deepEqual(cases.map(c=>c.id).sort(),[...expectedCaseIds].sort(),'contract supplies exactly one of each four frozen index cases');
 const openIndex=BtreeDatabase.prototype.indexCursor,seekIndex=BtreeDatabase.prototype.indexSeek,cursorSeek=IndexCursor.prototype.seek,indexBoundary=BtreeDatabase.prototype.indexBoundary,indexMove=BtreeDatabase.prototype.indexMove,scanTable=BtreeDatabase.prototype.tableScanCursor,seekTable=BtreeDatabase.prototype.tableSeek,scanFirst=TableScanCursor.prototype.first,scanNext=TableScanCursor.prototype.next,indexFirst=IndexCursor.prototype.first,indexLast=IndexCursor.prototype.last,indexPrevious=IndexCursor.prototype.previous,indexNext=IndexCursor.prototype.next,assertLive=UnpackedRecordKey.prototype.assertLive;
 let observation=null,expectedKeyInfo=null,expectedSeekWidth=null,expectedSeekValues=null;
 UnpackedRecordKey.prototype.assertLive=function(){
  if(expectedKeyInfo){assert.equal(this.keyInfo,expectedKeyInfo,'runtime unpacked seek KeyInfo is the selected PhysicalIndex KeyInfo');assert.equal(this.caller,'seek','runtime comparison uses a seek key');assert.equal(this.values.length,expectedSeekWidth,'runtime seek width matches pinned equality prefix');assert.deepEqual(this.values.map(v=>v.initialStorageClass==='null'?null:v.initialStorageClass==='integer'?v.integerValue():v.textValue()),expectedSeekValues,'runtime equality seek preserves bound values and storage classes');observation.keyChecks++}
  return assertLive.call(this)
 };
 BtreeDatabase.prototype.indexCursor=function(root){const cursor=openIndex.call(this,root);if(observation){observation.opens.push(root);observation.indexCursors.add(cursor)}return cursor};
 BtreeDatabase.prototype.indexBoundary=function(root,direction){if(observation)observation.boundaries.push({root,direction});return indexBoundary.call(this,root,direction)};
 IndexCursor.prototype.seek=function(compare,bias){const tracked=observation&&observation.indexCursors.has(this),result=cursorSeek.call(this,compare,bias);if(tracked)observation.cursorSeeks.push({bias,exact:result});return result};
 BtreeDatabase.prototype.indexMove=function(position,direction){if(observation)observation.indexMoves.push({direction,from:position});const result=indexMove.call(this,position,direction);if(observation&&observation.indexMoves.length)observation.indexMoves.at(-1).to=result;return result};
 IndexCursor.prototype.first=function(){if(observation&&observation.indexCursors.has(this))observation.indexFirstCalls++;return indexFirst.call(this)};
 IndexCursor.prototype.last=function(){if(observation&&observation.indexCursors.has(this))observation.indexLastCalls++;return indexLast.call(this)};
 IndexCursor.prototype.previous=function(){if(observation&&observation.indexCursors.has(this))observation.indexPreviousCalls++;return indexPrevious.call(this)};
 IndexCursor.prototype.next=function(){const tracked=observation&&observation.indexCursors.has(this);if(tracked)observation.indexNextCalls++;const result=indexNext.call(this);if(tracked)observation.indexNextResults.push(result);return result};
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=scanTable.call(this,root);if(observation){observation.tableScans.push(root);observation.scanCursors.add(cursor)}return cursor};
 TableScanCursor.prototype.first=function(){if(observation&&observation.scanCursors.has(this))observation.scanMoves++;return scanFirst.call(this)};
 TableScanCursor.prototype.next=function(){if(observation&&observation.scanCursors.has(this)){observation.scanMoves++;observation.scanNextCalls++}return scanNext.call(this)};
 BtreeDatabase.prototype.tableSeek=function(root,key,bias){const result=seekTable.call(this,root,key,bias);if(observation)observation.tableSeeks.push({root,key,bias,exact:result.exact,rowid:result.entry?.rowid});return result};
 BtreeDatabase.prototype.indexSeek=function(root,compare,bias){
  if(!observation)return seekIndex.call(this,root,compare,bias);
  const event={root,bias,comparisons:0,signs:[],keyChecks:[]};observation.seeks.push(event);
  const result=seekIndex.call(this,root,payload=>{const before=observation.keyChecks,sign=compare(payload);event.comparisons++;event.signs.push(Math.sign(sign));event.keyChecks.push(observation.keyChecks-before);return sign},bias);
  event.exact=result.exact;event.positioned=result.position!==null;event.position=result.position;
  return result;
 };
 try{for(const variant of capture.variants){
  const fixtureBytes=fs.readFileSync(path.resolve(variant.fixture.path));
  assert.equal(fixtureBytes.readUInt32BE(56),variant.id==='utf8'?1:variant.id==='utf16le'?2:3,`${variant.id}: SQLite database header encoding matches frozen variant`);
  assert.equal(createHash('sha256').update(fixtureBytes).digest('hex'),variant.fixture.sha256,`${variant.id}: exact pinned fixture under runtime probe`);
  await withBytes(fixtureBytes,async db=>{
  const graph=loadSchemaGraph(db),native=new Map(variant.cases.map(c=>[c.id,c]));
  const probeNames=['p','e','p_live','e_expr'];
  const capturedRoots=new Map(variant.fixture.schema.map(row=>[decode(row[1]),Number(decode(row[3]))]));
  const probeRoots=probeNames.map(name=>name==='p'||name==='e'?graph.tables.get(name).rootPage:graph.indexes.get(name).rootPage);
  assert.deepEqual(probeRoots,probeNames.map(name=>capturedRoots.get(name)),`${variant.id}: runtime scan and index roots match captured sqlite_master roots`);
  assert.equal(new Set(probeRoots).size,probeRoots.length,`${variant.id}: selected and scan roots are physically distinct so off-path assertions discriminate access`);
  assert.deepEqual(variant.cases.filter(c=>expectedCaseIds.includes(c.id)).map(c=>c.id).sort(),[...expectedCaseIds].sort(),`${variant.id}: capture supplies exactly one of each four probed cases`);
  for(const spec of cases){
   const nativeCase=native.get(spec.id),plannedRoot=chosen.get(spec.id);
   // Pair the physically probed paths with the contract's declared plan
   // requirements without changing its separately owned credit decision.
   if(plannedRoot){assert.equal(spec.requiresPlan,plannedRoot,`${variant.id}/${spec.id}: selected public path has matching required plan`);assert.equal(spec.forbidsPlan,undefined,`${variant.id}/${spec.id}: selected path is not forbidden`)}
   else{assert.equal(spec.forbidsPlan,spec.id==='partial-not-implied'?'p_live':'e_expr',`${variant.id}/${spec.id}: scanned neighbor forbids its corresponding index`);assert.equal(spec.requiresPlan,undefined,`${variant.id}/${spec.id}: scan neighbor requires no selected plan`)}
   // A zero-credit future contract must not silently point at a different
   // physical access path than the one observed in this public execution.
   assert.equal(spec.futurePrivateExpected.selectedRoot,plannedRoot??(spec.id==='partial-not-implied'?'p':'e'),`${variant.id}/${spec.id}: declared root paired with runtime probe`);
   // The plan and typed rows must describe the SQL and bindings we actually run,
   // not just a capture row sharing this case id.
   assert.equal(nativeCase.sql,spec.sql,`${variant.id}/${spec.id}: pinned SQL paired with runtime probe`);
   assert.deepEqual(nativeCase.bindings,spec.bindings,`${variant.id}/${spec.id}: pinned bindings paired with runtime probe`);
   // Guard this runtime observation against testing a different frozen plan:
   // the oracle EQP must select exactly this named root or scan the table.
   assert.deepEqual(nativeCase.eqp,plannedRoot
    ?[`SEARCH ${plannedRoot==='p_live'?'p':'e'} USING INDEX ${plannedRoot}${plannedRoot==='p_live'?' (a=?)':' (<expr>=? AND <expr>=?)'}`]
    :spec.id==='partial-not-implied'?['SCAN p','USE TEMP B-TREE FOR ORDER BY']:['SCAN e'],`${variant.id}/${spec.id}: pinned plan paired with public execution`);
   const program=compileTableSelect(parseSql(spec.sql).statement,graph,btreeFromConnection(db),100);
   if(plannedRoot){
    // Root/KeyInfo alone could still seek the wrong number of equality terms.
    // Compare the unforced program's actual seek width with native EQP's
    // one-field partial or two-field expression equality prefix.
    const physical=graph.indexes.get(plannedRoot).physical;
    const opens=program.ops.filter(op=>op.code==='OpenIndex'&&op.physical===physical);
    assert.equal(opens.length,1,`${variant.id}/${spec.id}: unforced physical open`);
    assert.equal(program.ops.filter(op=>op.code==='OpenIndex').length,1,`${variant.id}/${spec.id}: no competing index open`);
    const seeks=program.ops.filter(op=>op.code==='IndexSeekPrefix'&&op.p1===opens[0].p2);
    assert.equal(program.ops.filter(op=>op.code==='IndexSeekPrefix').length,1,`${variant.id}/${spec.id}: no competing index seek`);
    assert.equal(seeks.length,1,`${variant.id}/${spec.id}: unforced seek count`);
    assert.equal(seeks[0].keyInfo,physical.keyInfo,`${variant.id}/${spec.id}: unforced seek KeyInfo`);
    assert.equal(seeks[0].keys.length,plannedRoot==='p_live'?1:2,`${variant.id}/${spec.id}: pinned equality-prefix width`);
   }else{
    // In addition to observing no runtime opens, reject a dormant compiled
    // index arm that would make the scan-neighbor fallback path ambiguous.
    assert.equal(program.ops.filter(op=>op.code==='OpenIndex').length,0,`${variant.id}/${spec.id}: scan compiles no index open`);
    assert.equal(program.ops.filter(op=>op.code==='IndexSeekPrefix').length,0,`${variant.id}/${spec.id}: scan compiles no index seek`);
   }
   const statement=db.prepare(spec.sql).statement;
   try{for(let run=0;run<3;run++){
    if(run)statement.reset();statement.clearBindings();spec.bindings.forEach((binding,i)=>statement.bind(i+1,run===1&&i===0?null:value(binding)));
    const opens=[],seeks=[],cursorSeeks=[],boundaries=[],tableScans=[],tableSeeks=[],indexMoves=[],observed={opens,seeks,cursorSeeks,boundaries,tableScans,tableSeeks,indexMoves,scanCursors:new WeakSet(),indexCursors:new WeakSet(),scanMoves:0,scanNextCalls:0,indexFirstCalls:0,indexLastCalls:0,indexPreviousCalls:0,indexNextCalls:0,indexNextResults:[],keyChecks:0};observation=observed;expectedKeyInfo=chosen.has(spec.id)?graph.indexes.get(chosen.get(spec.id)).physical.keyInfo:null;expectedSeekWidth=plannedRoot?(plannedRoot==='p_live'?1:2):null;expectedSeekValues=plannedRoot?(plannedRoot==='p_live'?[run===1?null:1n]:[run===1?null:'alpha',5n]):null;
    try{assert.deepEqual(await rows(statement),run===1?[]:expectedRows(native.get(spec.id).rows),`${variant.id}/${spec.id}/${run}: rows`)}finally{expectedKeyInfo=null;expectedSeekWidth=null;expectedSeekValues=null;observation=null}
    const expected=chosen.get(spec.id);
    observedPaths[expected?'selected':'scan']++;
    if(expected){
     // OpenRead constructs a lazy table scan cursor even on index paths;
     // only first/next would actually traverse the base table.
     assert.equal(observed.scanMoves,0,`${variant.id}/${spec.id}/${run}: selected path does not traverse a base-table scan`);
    }
    if(!expected){
     const tableRoot=graph.tables.get(spec.id==='partial-not-implied'?'p':'e').rootPage;
     assert.ok(tableScans.length>0,`${variant.id}/${spec.id}/${run}: scan neighbor actually opens its base scan`);
     assert.ok(observed.scanMoves>0,`${variant.id}/${spec.id}/${run}: scan neighbor actually traverses its base scan`);
     assert.ok(tableScans.every(root=>root===tableRoot),`${variant.id}/${spec.id}/${run}: scan neighbor opens only its captured base table`);
    }
    const selectedRoots=['p_live','e_expr'].map(name=>graph.indexes.get(name).rootPage);
    assert.deepEqual(opens.filter(root=>selectedRoots.includes(root)),expected?[graph.indexes.get(expected).rootPage]:[],`${variant.id}/${spec.id}/${run}: actual runtime selected open`);
    const root=expected?graph.indexes.get(expected).rootPage:null;
    assert.deepEqual(opens,expected?[root]:[],`${variant.id}/${spec.id}/${run}: exact runtime index opens`);
    assert.deepEqual(boundaries,[],`${variant.id}/${spec.id}/${run}: frozen equality seek/scan never silently starts a full-index boundary scan`);
    assert.deepEqual(cursorSeeks,expected&&run!==1?[{bias:'ge',exact:true}]:[],`${variant.id}/${spec.id}/${run}: selected cursor ge prefix seek returns exact only for non-NULL binding`);
    assert.deepEqual(seeks.map(({root,bias})=>({root,bias})),expected&&run!==1?[{root,bias:'ge'}]:[],`${variant.id}/${spec.id}/${run}: exact runtime index seeks`);
    const selectedSeeks=seeks.filter(seek=>selectedRoots.includes(seek.root));
    assert.deepEqual(selectedSeeks.map(({root,bias})=>({root,bias})),expected&&run!==1?[{root,bias:'ge'}]:[],`${variant.id}/${spec.id}/${run}: actual runtime selected seek`);
    if(expected&&run!==1){
     assert.ok(selectedSeeks[0].comparisons>0,`${variant.id}/${spec.id}/${run}: selected KeyInfo comparator invoked`);
     assert.equal(selectedSeeks[0].keyChecks.length,selectedSeeks[0].comparisons,`${variant.id}/${spec.id}/${run}: each physical seek comparison is observed`);
     assert.ok(selectedSeeks[0].keyChecks.every(count=>count===1),`${variant.id}/${spec.id}/${run}: every physical comparison validates one live seek key with selected KeyInfo`);
     assert.equal(observed.keyChecks,selectedSeeks[0].comparisons,`${variant.id}/${spec.id}/${run}: no unaccounted live seek-key comparisons`);
     assert.equal(selectedSeeks[0].positioned,true,`${variant.id}/${spec.id}/${run}: ge prefix seek positions before equality filtering`);
     assert.equal(selectedSeeks[0].exact,run!==1,`${variant.id}/${spec.id}/${run}: exact match only for non-NULL frozen prefix`);
     assert.equal(selectedSeeks[0].signs.includes(0),run!==1,`${variant.id}/${spec.id}/${run}: physical KeyInfo comparator finds equality only for non-NULL prefix`);
     assert.ok(observed.keyChecks>0,`${variant.id}/${spec.id}/${run}: runtime unpacked KeyInfo checked`);
     assert.ok(selectedSeeks[0].keyChecks.every(count=>count>0),`${variant.id}/${spec.id}/${run}: every selected payload comparison checks physical KeyInfo`);
     assert.ok(selectedSeeks[0].signs.every(sign=>sign===-1||sign===0||sign===1),`${variant.id}/${spec.id}/${run}: ordered comparison result`);
    }
    if(!expected){
     assert.deepEqual(opens,[],`${variant.id}/${spec.id}/${run}: native scan neighbor opens no alternative index`);
     assert.deepEqual(seeks,[],`${variant.id}/${spec.id}/${run}: native scan neighbor seeks no alternative index`);
    }
    const accounting=privateAccounting(statement);
    assert.equal(accounting.indexSeeks,seeks.length,`${variant.id}/${spec.id}/${run}: private index-seek count matches actual intercepted B-tree calls`);
    assert.equal(accounting.tableNext,observed.scanNextCalls,`${variant.id}/${spec.id}/${run}: private table-next count matches actual base-scan next calls`);
    assert.equal(observed.indexFirstCalls,0,`${variant.id}/${spec.id}/${run}: equality-prefix path does not rewind selected index from first`);
    assert.equal(observed.indexLastCalls,0,`${variant.id}/${spec.id}/${run}: equality-prefix path does not rewind selected index from last`);
    assert.equal(observed.indexPreviousCalls,0,`${variant.id}/${spec.id}/${run}: equality-prefix path does not traverse selected index in reverse`);
    assert.equal(accounting.indexNext,observed.indexNextCalls,`${variant.id}/${spec.id}/${run}: private index-next count matches actual selected cursor next calls`);
    // The frozen nonempty equality prefixes emit one row and advance once;
    // the NULL-bound branch is empty before any index iteration.
    assert.equal(observed.indexNextCalls,expected&&run!==1?1:0,`${variant.id}/${spec.id}/${run}: selected nonempty prefix advances, NULL/scan does not`);
    assert.deepEqual(observed.indexNextResults,expected&&run!==1?[true]:[],`${variant.id}/${spec.id}/${run}: selected cursor remains positioned after its one forward move`);
    assert.deepEqual(indexMoves.map(move=>move.direction),expected&&run!==1?['next']:[],`${variant.id}/${spec.id}/${run}: physical index traversal only advances once from nonempty selected seek`);
    if(expected&&run===1)assert.deepEqual(selectedSeeks,[],`${variant.id}/${spec.id}/${run}: codeAllEqualityTerms bypasses NULL seek`);
    if(expected&&run!==1){
     assert.equal(indexMoves[0].from,selectedSeeks[0].position,`${variant.id}/${spec.id}/${run}: physical next starts at the exact B-tree equality-seek position`);
     const physical=graph.indexes.get(expected).physical;
     const entry=selectedSeeks[0].position.entry;
     const fields=decodeRecord(btreeFromConnection(db).payload(entry),variant.id==='utf8'?'utf-8':variant.id==='utf16le'?'utf-16le':'utf-16be').values;
     assert.equal(fields.length,physical.keyInfo.totalFieldCount,`${variant.id}/${spec.id}/${run}: physical seek entry has the selected index's full key shape`);
     if(expected==='p_live'){
      assert.equal(fields[0].storageClass,'integer',`${variant.id}/${spec.id}/${run}: partial seek entry has INTEGER equality key`);
      assert.equal(fields[0].value,1n,`${variant.id}/${spec.id}/${run}: partial seek entry matches bound equality key`);
     }else{
      assert.equal(fields[0].storageClass,'text',`${variant.id}/${spec.id}/${run}: expression seek entry has TEXT lower(a) key`);
      const textBytes=variant.id==='utf8'?Buffer.from('alpha','utf8'):variant.id==='utf16le'?Buffer.from('alpha','utf16le'):Buffer.from('alpha','utf16le').swap16();
      assert.deepEqual(fields[0].bytes,Uint8Array.from(textBytes),`${variant.id}/${spec.id}/${run}: actual expression seek entry matches encoded TEXT prefix`);
      assert.equal(fields[1].storageClass,'integer',`${variant.id}/${spec.id}/${run}: expression seek entry has INTEGER b+1 key`);
      assert.equal(fields[1].value,5n,`${variant.id}/${spec.id}/${run}: actual expression seek entry matches second equality operand`);
     }
     const tail=fields[physical.rowidField];
     assert.equal(tail.storageClass,'integer',`${variant.id}/${spec.id}/${run}: physical selected seek entry has INTEGER rowid tail`);
     if(expected==='e_expr')assert.equal(tableSeeks[0].key,tail.value,`${variant.id}/${spec.id}/${run}: deferred base lookup uses the rowid tail of the actual selected B-tree seek entry`);
     const nextFields=decodeRecord(btreeFromConnection(db).payload(indexMoves[0].to.entry),variant.id==='utf8'?'utf-8':variant.id==='utf16le'?'utf-16le':'utf-16be').values;
     assert.equal(nextFields.length,physical.keyInfo.totalFieldCount,`${variant.id}/${spec.id}/${run}: physical out-of-prefix successor has the selected KeyInfo's complete key shape`);
     assert.equal(nextFields[physical.rowidField].storageClass,'integer',`${variant.id}/${spec.id}/${run}: out-of-prefix successor has an INTEGER rowid tail`);
     assert.notEqual(nextFields[physical.rowidField].value,tail.value,`${variant.id}/${spec.id}/${run}: successor belongs to a different physical index row`);
     const samePrefix=expected==='p_live'
      ?nextFields[0].storageClass==='integer'&&nextFields[0].value===fields[0].value
      :nextFields[0].storageClass==='text'&&Buffer.from(nextFields[0].bytes).equals(Buffer.from(fields[0].bytes))&&nextFields[1].storageClass==='integer'&&nextFields[1].value===fields[1].value;
     assert.equal(samePrefix,false,`${variant.id}/${spec.id}/${run}: selected forward move reaches a real out-of-prefix index entry, not another matching row`);
    }
    assert.ok(indexMoves.every(({from,to})=>to!==null&&to!==from&&(to.pageNumber!==from.pageNumber||to.cellIndex!==from.cellIndex)),`${variant.id}/${spec.id}/${run}: physical next changes the selected index cell position`);
    assert.equal(accounting.tableSeeks,tableSeeks.length,`${variant.id}/${spec.id}/${run}: private table-seek count matches actual intercepted B-tree calls`);
    if(expected){
     const baseRoot=graph.tables.get(expected==='p_live'?'p':'e').rootPage;
     assert.equal(tableSeeks.length,expected==='p_live'?0:run===1?0:1,`${variant.id}/${spec.id}/${run}: deferred-unused partial versus deferred-base expression lookup`);
     assert.ok(tableSeeks.every(({exact,rowid,key})=>exact&&rowid===key),`${variant.id}/${spec.id}/${run}: each selected deferred lookup resolves the exact index-derived rowid`);
     assert.ok(tableSeeks.every(({root,key,bias})=>root===baseRoot&&typeof key==='bigint'&&bias==='ge'),`${variant.id}/${spec.id}/${run}: selected deferred rowid lookups target only their base table with an integer exact-seek bias`);
    }
    if(!expected)assert.deepEqual(tableSeeks,[],`${variant.id}/${spec.id}/${run}: scan neighbor has no hidden base-table point seek`);
    if(expected){
     const contract=spec.futurePrivateExpected;
     if(run===1){
      assert.equal(privateAccounting(statement).indexSeeks,0,`${variant.id}/${spec.id}/${run}: NULL equality exits before seek`);
      assert.equal(privateAccounting(statement).tableSeeks,0,`${variant.id}/${spec.id}/${run}: empty seek avoids base lookup`);
     }else assertAccounting(privateAccounting(statement),contract,`${variant.id}/${spec.id}/${run}: selected counters`);
    }else if(run===1){
     // NULL on the first equality operand is an empty result, but a scan
     // neighbor must still remain a scan, not silently take another index.
     assert.equal(privateAccounting(statement).indexSeeks,0,`${variant.id}/${spec.id}/${run}: NULL scan avoids index seek`);
    }else{
     // Pair scan-neighbor movement/residual/sorter bounds with the actual
     // no-index-open execution, not just a separate counter-only test.
     assertAccounting(privateAccounting(statement),spec.futurePrivateExpected,`${variant.id}/${spec.id}/${run}: scan counters with no index open`);
    }
   }}finally{statement.finalize()}
  }
 });}
 assert.deepEqual(observedPaths,{selected:18,scan:18},'three encodings times two selected and two scan cases times original/NULL/rebound');
 }finally{observation=null;expectedKeyInfo=null;expectedSeekWidth=null;expectedSeekValues=null;UnpackedRecordKey.prototype.assertLive=assertLive;BtreeDatabase.prototype.indexCursor=openIndex;BtreeDatabase.prototype.indexSeek=seekIndex;IndexCursor.prototype.seek=cursorSeek;BtreeDatabase.prototype.indexBoundary=indexBoundary;BtreeDatabase.prototype.indexMove=indexMove;BtreeDatabase.prototype.tableScanCursor=scanTable;BtreeDatabase.prototype.tableSeek=seekTable;TableScanCursor.prototype.first=scanFirst;TableScanCursor.prototype.next=scanNext;IndexCursor.prototype.first=indexFirst;IndexCursor.prototype.last=indexLast;IndexCursor.prototype.previous=indexPrevious;IndexCursor.prototype.next=indexNext}
});
// Review-derived NULL transition, not an additional pinned-native capture. The
// original frozen binding is restored after the empty execution on one statement.
test('frozen selected partial and expression paths restart after NULL reset/rebind',async()=>{
 const chosen=new Map([['partial-implied','p_live'],['expression-identical','e_expr']]);
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const graph=loadSchemaGraph(db),native=new Map(variant.cases.map(c=>[c.id,c]));
  for(const spec of specification.cases.filter(c=>chosen.has(c.id))){
   const statement=db.prepare(spec.sql).statement;
   try{for(const [run,first,second] of [
    ['first',value(spec.bindings[0]),value(spec.bindings[1])],
    ['null',null,value(spec.bindings[1])],
    ...(spec.id==='expression-identical'?[['second-null',value(spec.bindings[0]),null]]:[]),
    ['rebound',value(spec.bindings[0]),value(spec.bindings[1])]
   ]){
    if(run!=='first')statement.reset();statement.clearBindings();statement.bind(1,first);
    if(spec.bindings.length>1)statement.bind(2,second);
    const physicalSeeks=[],physicalMoves=[],seekKeys=[],tableSeeks=[],indexOpens=[],boundaries=[],cursorNexts=[];
    const originalSeek=BtreeDatabase.prototype.indexSeek,originalMove=BtreeDatabase.prototype.indexMove,originalLive=UnpackedRecordKey.prototype.assertLive,originalTableSeek=BtreeDatabase.prototype.tableSeek,originalOpen=BtreeDatabase.prototype.indexCursor,originalBoundary=BtreeDatabase.prototype.indexBoundary,originalNext=IndexCursor.prototype.next;
    IndexCursor.prototype.next=function(){cursorNexts.push(this);return originalNext.call(this)};
    BtreeDatabase.prototype.indexCursor=function(root){indexOpens.push(root);return originalOpen.call(this,root)};
    BtreeDatabase.prototype.indexBoundary=function(root,direction){boundaries.push({root,direction});return originalBoundary.call(this,root,direction)};
    BtreeDatabase.prototype.indexSeek=function(root,compare,bias){const result=originalSeek.call(this,root,compare,bias);physicalSeeks.push({root,bias,position:result.position,exact:result.exact});return result};
    BtreeDatabase.prototype.tableSeek=function(...args){tableSeeks.push(args);return originalTableSeek.apply(this,args)};
    BtreeDatabase.prototype.indexMove=function(position,direction){physicalMoves.push(direction);return originalMove.call(this,position,direction)};
    UnpackedRecordKey.prototype.assertLive=function(){
     if(this.caller==='seek')seekKeys.push({keyInfo:this.keyInfo,values:this.values.map(v=>v.initialStorageClass==='null'?null:v.initialStorageClass==='integer'?v.integerValue():v.textValue())});
     return originalLive.call(this)
    };
    let actual;
    try{actual=await rows(statement)}finally{BtreeDatabase.prototype.indexSeek=originalSeek;BtreeDatabase.prototype.indexMove=originalMove;BtreeDatabase.prototype.tableSeek=originalTableSeek;BtreeDatabase.prototype.indexCursor=originalOpen;BtreeDatabase.prototype.indexBoundary=originalBoundary;IndexCursor.prototype.next=originalNext;UnpackedRecordKey.prototype.assertLive=originalLive}
    assert.equal(cursorNexts.length,run==='first'||run==='rebound'?1:0,`${variant.id}/${spec.id}/${run}: selected cursor advances only on exact nonempty equality`);
    assert.deepEqual(physicalMoves,run==='first'||run==='rebound'?['next']:[],`${variant.id}/${spec.id}/${run}: physical forward move matches cursor iteration`);
    const selectedRoot=graph.indexes.get(chosen.get(spec.id)).rootPage;
    assert.deepEqual(indexOpens,[selectedRoot],`${variant.id}/${spec.id}/${run}: one selected cursor, no other index opened`);
    assert.deepEqual(boundaries,[],`${variant.id}/${spec.id}/${run}: equality prefix does not fall back to index boundary scan`);
    assert.deepEqual(physicalSeeks.map(({root,bias,exact})=>({root,bias,exact})),run==='first'||run==='rebound'?[{root:selectedRoot,bias:'ge',exact:true}]:[],`${variant.id}/${spec.id}/${run}: selected physical equality result`);
    // codeAllEqualityTerms exits before seeking on any NULL '=' operand.
    if(run==='null'||run==='second-null')assert.deepEqual(tableSeeks,[],`${variant.id}/${spec.id}/${run}: NULL equality prefix performs no deferred base lookup`);
    assert.equal(seekKeys.length>0,run==='first'||run==='rebound',`${variant.id}/${spec.id}/${run}: only non-NULL equality seeks compare entries`);
    assert.ok(seekKeys.every(key=>key.keyInfo===graph.indexes.get(chosen.get(spec.id)).physical.keyInfo),`${variant.id}/${spec.id}/${run}: comparator uses loaded selected KeyInfo`);
    for(const key of seekKeys)assert.deepEqual(key.values,spec.id==='partial-implied'?[first]:[first,second],`${variant.id}/${spec.id}/${run}: comparator receives live bound equality operands`);
    if(run==='null'||run==='second-null')assert.deepEqual(physicalMoves,[],`${variant.id}/${spec.id}/${run}: NULL prefix cannot advance the selected B-tree`);
    assert.deepEqual(actual,run==='null'||run==='second-null'?[]:expectedRows(native.get(spec.id).rows),`${variant.id}/${spec.id}/${run}: rows`);
    const accounting=privateAccounting(statement);
    if(run==='first'||run==='rebound')assertAccounting(accounting,privateContracts.get(spec.id),`${variant.id}/${spec.id}/${run}: selected counters`);
    else assert.equal(accounting.indexSeeks,0,`${variant.id}/${spec.id}/${run}: NULL equality exits before selected seek`);
   }}finally{statement.finalize()}
  }
 });
});
async function rowsWithoutIndexOpen(statement,label){
 // Off-path corruption must not even open the damaged root: zero seeks alone
 // would also hold if the index were opened but never positioned.
 const original=BtreeDatabase.prototype.indexCursor,opens=[];
 BtreeDatabase.prototype.indexCursor=function(root){opens.push(root);return original.call(this,root)};
 try{return await rows(statement)}finally{BtreeDatabase.prototype.indexCursor=original;assert.deepEqual(opens,[],`${label}: no index cursor opened`)}
}
async function rows(statement){const result=[];while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return result}
async function withBytes(bytes,run){
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});r.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await run(db)}finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
}
async function execute(db,sql,bindings=[]){const statement=db.prepare(sql).statement;try{bindings.forEach((v,i)=>statement.bind(i+1,value(v)));return await rows(statement)}finally{statement.finalize()}}
function assertAccounting(actual,expected,label){
 for(const [name,bound] of Object.entries(expected.counters)){const value=actual[name];assert.equal(typeof value,'number',`${label}/${name}/present`);if(bound.exact!==undefined)assert.equal(value,bound.exact,`${label}/${name}`);if(bound.min!==undefined)assert.ok(value>=bound.min,`${label}/${name}: ${value} < ${bound.min}`);if(bound.max!==undefined)assert.ok(value<=bound.max,`${label}/${name}: ${value} > ${bound.max}`)}
}

test('all 30 pinned advanced-index cases execute through the public TS API',async()=>{
 let attempts=0;
 for(const variant of capture.variants){const bytes=fs.readFileSync(path.resolve(variant.fixture.path));await withBytes(bytes,async db=>{
  for(const c of variant.cases){attempts++;assert.deepEqual(await execute(db,c.sql,c.bindings),expectedRows(c.rows),`${variant.id}/${c.id}`)}
 })}
 assert.equal(attempts,30);
});

test('forced partial index is admitted only when its predicate is implied in every encoding',async()=>{
 for(const variant of capture.variants){const bytes=fs.readFileSync(path.resolve(variant.fixture.path));
  await withBytes(bytes,async db=>{
   const statement=db.prepare('SELECT id,b FROM p INDEXED BY p_live WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
   try{statement.bind(1,1n);assert.deepEqual(await rows(statement),[[1n,'x']],`${variant.id}/forced-implied/rows`);assert.equal(privateAccounting(statement).indexSeeks,1,`${variant.id}/forced-implied/indexSeeks`)}finally{statement.finalize()}
   assert.throws(()=>db.prepare('SELECT id,b FROM p INDEXED BY p_live WHERE a=?1 ORDER BY b'),/forced index is unusable/,`${variant.id}/forced-not-implied`);
  });
 }
});

test('unforced implied partial seek rebinds NULL and recovers selected access',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id,b FROM p WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
  try{for(const [run,binding,expected] of [['first',1n,[[1n,'x']]],['null',null,[]],['rebound',1n,[[1n,'x']]]]){
   if(run!=='first')statement.reset();statement.clearBindings();statement.bind(1,binding);
   assert.deepEqual(await rows(statement),expected,`${variant.id}/${run}: rows`);
   const accounting=privateAccounting(statement);
   assert.equal(accounting.tableSeeks,0,`${variant.id}/${run}: no base lookup`);
   if(binding!==null)assert.equal(accounting.indexSeeks,1,`${variant.id}/${run}: selected seek`);
  }}finally{statement.finalize()}
 });
});

test('unforced implied partial index defers base lookup until an uncovered column is read',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const covered=db.prepare('SELECT id,b FROM p WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
  const uncovered=db.prepare('SELECT id,b,c FROM p WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
  try{for(let run=0;run<2;run++){
   for(const [id,statement,expected,seeks] of [['covered',covered,[[1n,'x']],0],['uncovered',uncovered,[[1n,'x',1]],1]]){
    if(run)statement.reset();statement.clearBindings();statement.bind(1,1n);
    assert.deepEqual(await rows(statement),expected,`${variant.id}/${id}/${run}: rows`);
    const accounting=privateAccounting(statement);
    assert.equal(accounting.indexSeeks,1,`${variant.id}/${id}/${run}: selected index`);
    assert.equal(accounting.tableSeeks,seeks,`${variant.id}/${id}/${run}: deferred base lookup`);
   }
  }}finally{covered.finalize();uncovered.finalize()}
 });
});

test('forced partial deferred table access materializes only for an uncovered read in every encoding',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id,b,c FROM p INDEXED BY p_live WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
  try{for(let run=0;run<2;run++){if(run)statement.reset();statement.clearBindings();statement.bind(1,1n);assert.deepEqual(await rows(statement),[[1n,'x',1]],`${variant.id}/${run}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,1,`${variant.id}/${run}/indexSeeks`);assert.equal(accounting.tableSeeks,1,`${variant.id}/${run}/tableSeeks`)}}finally{statement.finalize()}
 });
});

test('forced partial unused deferred access never materializes across empty and multi-row scans',async()=>{
 const shapes=[
  {id:'empty',sql:'SELECT id,b FROM p INDEXED BY p_live WHERE a=?1 AND c IS NOT NULL ORDER BY b',bindings:[99n],rows:[],indexSeeks:1},
  {id:'multi',sql:'SELECT id,b FROM p INDEXED BY p_live WHERE a>=?1 AND c IS NOT NULL ORDER BY a,b',bindings:[1n],rows:[[1n,'x'],[3n,'z'],[4n,'q']],indexSeeks:1},
 ];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const shape of shapes){const statement=db.prepare(shape.sql).statement;try{for(let run=0;run<2;run++){if(run)statement.reset();statement.clearBindings();shape.bindings.forEach((v,i)=>statement.bind(i+1,v));assert.deepEqual(await rows(statement),shape.rows,`${variant.id}/${shape.id}/${run}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,shape.indexSeeks,`${variant.id}/${shape.id}/${run}/indexSeeks`);assert.equal(accounting.tableSeeks,0,`${variant.id}/${shape.id}/${run}/tableSeeks`)}}finally{statement.finalize()}}
 });
});

test('forced partial deferred access materializes once per row, not once per uncovered read',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id,c,c FROM p INDEXED BY p_live WHERE a>=?1 AND c IS NOT NULL ORDER BY a,b').statement;
  try{for(let run=0;run<2;run++){if(run)statement.reset();statement.clearBindings();statement.bind(1,1n);assert.deepEqual(await rows(statement),[[1n,1,1],[3n,2.5,2.5],[4n,3,3]],`${variant.id}/${run}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,1,`${variant.id}/${run}/indexSeeks`);assert.equal(accounting.tableSeeks,3,`${variant.id}/${run}/tableSeeks`)}}finally{statement.finalize()}
 });
});

test('forced expression mismatch falls back to a truthful full index scan in every encoding',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const root=loadSchemaGraph(db).indexes.get('e_expr').rootPage;
  const tableRoot=loadSchemaGraph(db).tables.get('e').rootPage;
  const originalOpen=BtreeDatabase.prototype.indexCursor,originalFirst=IndexCursor.prototype.first,originalBoundary=BtreeDatabase.prototype.indexBoundary,originalNext=IndexCursor.prototype.next,originalPrevious=IndexCursor.prototype.previous,originalMove=BtreeDatabase.prototype.indexMove,originalSeek=BtreeDatabase.prototype.indexSeek,originalTableSeek=BtreeDatabase.prototype.tableSeek,originalTableFirst=TableScanCursor.prototype.first,originalTableNext=TableScanCursor.prototype.next,opened=[],boundaries=[],cursors=new WeakSet(),moves=[],baseLookups=[];let firstCalls=0,nextCalls=0,previousCalls=0,physicalSeeks=0,tableScanMoves=0;
  BtreeDatabase.prototype.indexBoundary=function(page,direction){boundaries.push({page,direction});return originalBoundary.call(this,page,direction)};
  BtreeDatabase.prototype.indexCursor=function(page){opened.push(page);const cursor=originalOpen.call(this,page);cursors.add(cursor);return cursor};
  IndexCursor.prototype.first=function(){if(cursors.has(this))firstCalls++;return originalFirst.call(this)};
  IndexCursor.prototype.next=function(){if(cursors.has(this))nextCalls++;return originalNext.call(this)};
  IndexCursor.prototype.previous=function(){if(cursors.has(this))previousCalls++;return originalPrevious.call(this)};
  BtreeDatabase.prototype.indexMove=function(position,direction){moves.push(direction);return originalMove.call(this,position,direction)};
  BtreeDatabase.prototype.indexSeek=function(...args){physicalSeeks++;return originalSeek.apply(this,args)};
  BtreeDatabase.prototype.tableSeek=function(page,key,bias){const result=originalTableSeek.call(this,page,key,bias);baseLookups.push({page,key,bias,exact:result.exact,rowid:result.entry?.rowid});return result};
  TableScanCursor.prototype.first=function(...args){tableScanMoves++;return originalTableFirst.apply(this,args)};
  TableScanCursor.prototype.next=function(...args){tableScanMoves++;return originalTableNext.apply(this,args)};
  try{
   const statement=db.prepare('SELECT id,a FROM e INDEXED BY e_expr WHERE upper(a)=?1 AND b+1=?2 ORDER BY id').statement;
   try{for(let run=0;run<2;run++){if(run)statement.reset();statement.clearBindings();statement.bind(1,'ALPHA');statement.bind(2,5n);const before=firstCalls,beforeNext=nextCalls,beforeLookups=baseLookups.length;assert.deepEqual(await rows(statement),[[1n,'Alpha']],`${variant.id}/${run}/rows`);assert.equal(firstCalls,before+1,`${variant.id}/${run}: exactly one index first per execution`);assert.ok(nextCalls>beforeNext,`${variant.id}/${run}: forced full index scan advances`);assert.equal(nextCalls-beforeNext,moves.slice(beforeNext).length,`${variant.id}/${run}: every cursor next physically moves`);assert.ok(moves.every(direction=>direction==='next'),`${variant.id}/${run}: only physical forward moves`);assert.equal(previousCalls,0,`${variant.id}/${run}: no reverse index traversal`);assert.equal(physicalSeeks,0,`${variant.id}/${run}: mismatch performs no physical equality seek`);assert.equal(tableScanMoves,0,`${variant.id}/${run}: forced index scan never traverses base scan`);assert.deepEqual(opened,[root,root].slice(0,run+1),`${variant.id}/${run}: only forced e_expr root opened`);assert.deepEqual(boundaries,Array.from({length:run+1},()=>({page:root,direction:'first'})),`${variant.id}/${run}: each full scan descends from loaded index root`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,0,`${variant.id}/${run}/indexSeeks`);assert.ok(accounting.tableSeeks>=1,`${variant.id}/${run}/tableSeeks`);assert.equal(accounting.tableSeeks,baseLookups.length-beforeLookups,`${variant.id}/${run}: counted base lookups match physical calls`);assert.ok(baseLookups.slice(beforeLookups).every(({exact,rowid,key})=>exact&&rowid===key),`${variant.id}/${run}: every deferred lookup resolves the exact index rowid`);assert.ok(baseLookups.every(({page,key,bias})=>page===tableRoot&&typeof key==='bigint'&&bias==='ge'),`${variant.id}/${run}: forced full index lookup uses owning table integer rowid`)}}finally{statement.finalize()}
  }finally{TableScanCursor.prototype.next=originalTableNext;TableScanCursor.prototype.first=originalTableFirst;BtreeDatabase.prototype.tableSeek=originalTableSeek;BtreeDatabase.prototype.indexSeek=originalSeek;BtreeDatabase.prototype.indexMove=originalMove;IndexCursor.prototype.previous=originalPrevious;IndexCursor.prototype.next=originalNext;IndexCursor.prototype.first=originalFirst;BtreeDatabase.prototype.indexBoundary=originalBoundary;BtreeDatabase.prototype.indexCursor=originalOpen}
 });
});

test('pinned advanced-index cases satisfy selected-access counters freshly after reset',async()=>{
 let attempts=0;const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const c of variant.cases){const expected=privateContracts.get(c.id);assert.ok(expected,`${c.id}/contract`);const statement=db.prepare(c.sql).statement;
   try{for(let run=0;run<2;run++){try{if(run)statement.reset();statement.clearBindings();c.bindings.forEach((v,i)=>statement.bind(i+1,value(v)));assert.deepEqual(await rows(statement),expectedRows(c.rows),`${variant.id}/${c.id}/${run}/rows`);assertAccounting(privateAccounting(statement),expected,`${variant.id}/${c.id}/${run}`)}catch(error){failures.push(error)}finally{attempts++}}}
   finally{statement.finalize()}
  }
 });
 assert.equal(attempts,60);if(failures.length)throw new AggregateError(failures,`${failures.length} advanced-index accounting contract failures`);
});

// Review-derived physical-root neighbor, not a pinned native corruption capture.
test('unforced implied partial path selects its root and isolates unrelated rowid access',async()=>{
 for(const variant of capture.variants){
  await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
   const selected=db.prepare('SELECT id,b FROM p WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
   try{for(let run=0;run<2;run++){
    if(run)selected.reset();selected.clearBindings();selected.bind(1,1n);
    assert.deepEqual(await rows(selected),[[1n,'x']],`${variant.id}/${run}: implied rows`);
    assert.equal(privateAccounting(selected).indexSeeks,1,`${variant.id}/${run}: selected index seek`);
   }}finally{selected.finalize()}
  });
  const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-partial-root-page.db`);
  await withBytes(fs.readFileSync(fixture),async db=>{
   assert.deepEqual(await execute(db,'SELECT id,b FROM p NOT INDEXED WHERE id=4'),[[4n,'q']],`${variant.id}: rowid off-path`);
   const selected=db.prepare('SELECT id,b FROM p WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;
   let failure;try{selected.bind(1,1n);await rows(selected)}catch(error){failure=error}finally{try{selected.finalize()}catch{}}
   assert.equal(failure?.kind,'sqlite',`${variant.id}: implied unforced path reaches partial root`);
   assert.deepEqual(await execute(db,'SELECT id,b FROM p NOT INDEXED WHERE id=4'),[[4n,'q']],`${variant.id}: off-path after corruption`);
  });
 }
});

// Unforced non-implication must preserve rows through a table path rather than
// reading the partial root, which omits rows excluded by its WHERE predicate.
test('unforced non-implied partial predicate scans omitted rows without touching selected root',async()=>{
 for(const variant of capture.variants){
  for(const fixture of [path.resolve(variant.fixture.path),path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-partial-root-page.db`)]){
   await withBytes(fs.readFileSync(fixture),async db=>{
    const statement=db.prepare('SELECT id,b FROM p WHERE a=?1 ORDER BY id').statement;
    try{for(let run=0;run<2;run++){
     if(run)statement.reset();statement.clearBindings();statement.bind(1,1n);
     const originalScan=BtreeDatabase.prototype.tableScanCursor,originalFirst=TableScanCursor.prototype.first,scanCursors=new WeakSet();let scanFirstCalls=0;
     const tableRoot=loadSchemaGraph(db).tables.get('p').rootPage;
     BtreeDatabase.prototype.tableScanCursor=function(root){assert.equal(root,tableRoot,`${variant.id}/${run}: non-implied scan uses p root`);const cursor=originalScan.call(this,root);scanCursors.add(cursor);return cursor};
     TableScanCursor.prototype.first=function(){if(scanCursors.has(this))scanFirstCalls++;return originalFirst.call(this)};
     try{assert.deepEqual(await rowsWithoutIndexOpen(statement,`${variant.id}/${run}: non-implied partial off-path`),[[1n,'x'],[2n,'y']],`${variant.id}/${run}: non-implied full result`)}finally{TableScanCursor.prototype.first=originalFirst;BtreeDatabase.prototype.tableScanCursor=originalScan}
     assert.ok(scanFirstCalls>0,`${variant.id}/${run}: non-implied neighbor physically starts its base scan`);
     assert.equal(privateAccounting(statement).indexSeeks,0,`${variant.id}/${run}: no partial seek`);
    }}finally{statement.finalize()}
   });
  }
 }
});

test('selected partial-index corruption stays isolated from off-path table access',async()=>{
 for(const variant of capture.variants){const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-partial-root-page.db`);await withBytes(fs.readFileSync(fixture),async db=>{
  assert.deepEqual(await execute(db,'SELECT id,b FROM p NOT INDEXED WHERE id=?1',[4]),[[4n,'q']],`${variant.id}/off-path`);
  const statement=db.prepare('SELECT id,b FROM p INDEXED BY p_live WHERE a=?1 AND c IS NOT NULL ORDER BY b').statement;let failure;try{statement.bind(1,1n);await rows(statement)}catch(error){failure=error}finally{try{statement.finalize()}catch(error){if(error?.kind!=='sqlite'||error.code!==11)throw error}}
  assert.equal(failure?.kind,'sqlite',`${variant.id}/selected`);
  assert.equal(failure?.code,11,`${variant.id}/selected: damaged selected partial root reports SQLITE_CORRUPT`);
  assert.deepEqual(await execute(db,'SELECT id,b FROM p NOT INDEXED WHERE id=?1',[4]),[[4n,'q']],`${variant.id}/reuse`);
 })}
});

test('selected expression-index corruption stays isolated from off-path table access',async()=>{
 for(const variant of capture.variants){const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-expression-root-page.db`);await withBytes(fs.readFileSync(fixture),async db=>{
  assert.deepEqual(await execute(db,'SELECT id,a FROM e NOT INDEXED WHERE id=?1',[1]),[[1n,'Alpha']],`${variant.id}/off-path`);
  const statement=db.prepare('SELECT id,a,b FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+1=?2 ORDER BY id').statement;let failure;try{statement.bind(1,'alpha');statement.bind(2,5n);await rows(statement)}catch(error){failure=error}finally{try{statement.finalize()}catch(error){if(error?.kind!=='sqlite'||error.code!==11)throw error}}
  assert.equal(failure?.kind,'sqlite',`${variant.id}/selected`);
  assert.equal(failure?.code,11,`${variant.id}/selected: damaged selected expression root reports SQLITE_CORRUPT`);
  assert.deepEqual(await execute(db,'SELECT id,a FROM e NOT INDEXED WHERE id=?1',[1]),[[1n,'Alpha']],`${variant.id}/reuse`);
 })}
});

// Review-derived damaged root (not a pinned native corruption capture). Unlike
// the forced control above, these are the unchanged frozen unforced statements.
test('frozen unforced expression selection reaches damaged root while mismatch stays off-path',async()=>{
 const identical=specification.cases.find(c=>c.id==='expression-identical');
 const mismatch=specification.cases.find(c=>c.id==='expression-mismatch');
 for(const variant of capture.variants){
  const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-expression-root-page.db`);
  const native=new Map(variant.cases.map(c=>[c.id,c]));
  await withBytes(fs.readFileSync(fixture),async db=>{
   for(let run=0;run<2;run++){
    const probe=db.prepare(identical.sql).statement;
    try{
     probe.clearBindings();identical.bindings.forEach((binding,i)=>probe.bind(i+1,value(binding)));
     await assert.rejects(rows(probe),error=>error?.kind==='sqlite'&&error.code===11,`${variant.id}/${run}: selected unforced corrupt expression root`);
    }finally{try{probe.finalize()}catch(error){if(error?.kind!=='sqlite'||error.code!==11)throw error}}
   }
   const scan=db.prepare(mismatch.sql).statement;
   try{for(let run=0;run<2;run++){
    if(run)scan.reset();scan.clearBindings();mismatch.bindings.forEach((binding,i)=>scan.bind(i+1,value(binding)));
    const originalScan=BtreeDatabase.prototype.tableScanCursor,originalFirst=TableScanCursor.prototype.first,scanCursors=new WeakSet();let scanFirstCalls=0;
    const tableRoot=loadSchemaGraph(db).tables.get('e').rootPage;
    BtreeDatabase.prototype.tableScanCursor=function(root){assert.equal(root,tableRoot,`${variant.id}/${run}: mismatch scans e root`);const cursor=originalScan.call(this,root);scanCursors.add(cursor);return cursor};
    TableScanCursor.prototype.first=function(){if(scanCursors.has(this))scanFirstCalls++;return originalFirst.call(this)};
    try{assert.deepEqual(await rowsWithoutIndexOpen(scan,`${variant.id}/${run}: mismatched off-path`),expectedRows(native.get(mismatch.id).rows),`${variant.id}/${run}: mismatched off-path rows`)}finally{TableScanCursor.prototype.first=originalFirst;BtreeDatabase.prototype.tableScanCursor=originalScan}
    assert.ok(scanFirstCalls>0,`${variant.id}/${run}: mismatch physically starts its base scan`);
    assert.equal(privateAccounting(scan).indexSeeks,0,`${variant.id}/${run}: mismatched off-path index seeks`);
   }}finally{scan.finalize()}
  });
 }
});

// The same frozen-SQL selected/off-path corruption boundary for the partial
// predicate, whose non-implied neighbor includes rows absent from p_live.
test('frozen unforced partial implication reaches damaged root while non-implication stays off-path',async()=>{
 const implied=specification.cases.find(c=>c.id==='partial-implied');
 const other=specification.cases.find(c=>c.id==='partial-not-implied');
 for(const variant of capture.variants){
  const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-partial-root-page.db`);
  const native=new Map(variant.cases.map(c=>[c.id,c]));
  await withBytes(fs.readFileSync(fixture),async db=>{
   for(let run=0;run<2;run++){
    const probe=db.prepare(implied.sql).statement;
    try{
     probe.clearBindings();implied.bindings.forEach((binding,i)=>probe.bind(i+1,value(binding)));
     await assert.rejects(rows(probe),error=>error?.kind==='sqlite'&&error.code===11,`${variant.id}/${run}: selected unforced corrupt partial root`);
    }finally{try{probe.finalize()}catch(error){if(error?.kind!=='sqlite'||error.code!==11)throw error}}
   }
   const scan=db.prepare(other.sql).statement;
   try{for(let run=0;run<2;run++){
    if(run)scan.reset();scan.clearBindings();other.bindings.forEach((binding,i)=>scan.bind(i+1,value(binding)));
    const originalScan=BtreeDatabase.prototype.tableScanCursor,originalFirst=TableScanCursor.prototype.first,scanCursors=new WeakSet();let scanFirstCalls=0;
    const tableRoot=loadSchemaGraph(db).tables.get('p').rootPage;
    BtreeDatabase.prototype.tableScanCursor=function(root){assert.equal(root,tableRoot,`${variant.id}/${run}: frozen non-implied scans p root`);const cursor=originalScan.call(this,root);scanCursors.add(cursor);return cursor};
    TableScanCursor.prototype.first=function(){if(scanCursors.has(this))scanFirstCalls++;return originalFirst.call(this)};
    try{assert.deepEqual(await rowsWithoutIndexOpen(scan,`${variant.id}/${run}: non-implied off-path`),expectedRows(native.get(other.id).rows),`${variant.id}/${run}: non-implied off-path rows`)}finally{TableScanCursor.prototype.first=originalFirst;BtreeDatabase.prototype.tableScanCursor=originalScan}
    assert.ok(scanFirstCalls>0,`${variant.id}/${run}: frozen non-implied physically starts p scan`);
    assert.equal(privateAccounting(scan).indexSeeks,0,`${variant.id}/${run}: non-implied off-path index seeks`);
   }}finally{scan.finalize()}
  });
 }
});

test('partial implication honors safe INNER and LEFT JOIN provenance in every encoding',async()=>{
 const admitted=[
  {id:'inner-on',sql:'SELECT m.id,p.id FROM m JOIN p INDEXED BY p_live ON p.a=m.a AND p.c IS NOT NULL WHERE m.id=1 ORDER BY p.id'},
  {id:'left-on',sql:'SELECT m.id,p.id FROM m LEFT JOIN p INDEXED BY p_live ON p.a=m.a AND p.c IS NOT NULL WHERE m.id=1 ORDER BY p.id'},
  {id:'inner-where',sql:'SELECT m.id,p.id FROM m JOIN p INDEXED BY p_live ON p.a=m.a WHERE m.id=1 AND p.c IS NOT NULL ORDER BY p.id'},
 ];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const c of admitted)try{assert.deepEqual(await execute(db,c.sql),[[1n,1n]],`${variant.id}/${c.id}`)}catch(error){failures.push(error)}
  assert.throws(()=>db.prepare('SELECT m.id,p.id FROM m LEFT JOIN p INDEXED BY p_live ON p.a=m.a WHERE m.id=1 AND p.c IS NOT NULL ORDER BY p.id'),/forced index is unusable/,`${variant.id}/left-where-too-late`);
  assert.throws(()=>db.prepare('SELECT m.id,p.id FROM m LEFT JOIN p INDEXED BY p_live ON p.a=m.a WHERE m.id=1 ORDER BY p.id'),/forced index is unusable/,`${variant.id}/missing-proof`);
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} join-provenance failures`);
});

test('unforced LEFT WHERE partial proof never opens damaged partial root',async()=>{
 // The WHERE proof is too late to constrain the nullable side of this LEFT JOIN.
 // An unforced plan must fall back instead of reading a damaged p_live root.
 for(const variant of capture.variants){
  const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-partial-root-page.db`);
  await withBytes(fs.readFileSync(fixture),async db=>{
   const sql='SELECT m.id,p.id FROM m LEFT JOIN p ON p.a=m.a WHERE m.id=?1 AND p.c IS NOT NULL ORDER BY p.id';
   const scanSql='SELECT m.id,p.id FROM m LEFT JOIN p NOT INDEXED ON p.a=m.a WHERE m.id=?1 AND p.c IS NOT NULL ORDER BY p.id';
   const expected=await execute(db,scanSql,[1n]),statement=db.prepare(sql).statement;
   try{for(const [run,id,rowsExpected] of [['first',1n,expected],['empty',999n,[]],['rebound',1n,expected]]){
    if(run!=='first')statement.reset();statement.clearBindings();statement.bind(1,id);
    assert.deepEqual(await rowsWithoutIndexOpen(statement,`${variant.id}/left-WHERE/${run} off-path`),rowsExpected,`${variant.id}/left-WHERE/${run} rows`);
    assert.equal(privateAccounting(statement).indexSeeks,0,`${variant.id}/left-WHERE/${run} index seeks`);
   }}finally{statement.finalize()}
  });
 }
});

test('LEFT ON partial proof selects damaged root while late WHERE proof stays off-path',async()=>{
 // Review-derived corruption control: provenance changes root eligibility, not
 // the stored SQL/index identity. Forced ON admission avoids cost-based ambiguity.
 for(const variant of capture.variants){
  const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-partial-root-page.db`);
  await withBytes(fs.readFileSync(fixture),async db=>{
   const on='SELECT m.id,p.id FROM m LEFT JOIN p INDEXED BY p_live ON p.a=m.a AND p.c IS NOT NULL WHERE m.id=?1 ORDER BY p.id';
   const statement=db.prepare(on).statement;
   try{
    statement.bind(1,1n);
    await assert.rejects(rows(statement),error=>error?.kind==='sqlite'&&error.code===11,`${variant.id}: eligible ON reaches corrupt root`);
   }finally{try{statement.finalize()}catch(error){if(error?.kind!=='sqlite'||error.code!==11)throw error}}
   const off=db.prepare('SELECT m.id,p.id FROM m LEFT JOIN p ON p.a=m.a WHERE m.id=?1 AND p.c IS NOT NULL ORDER BY p.id').statement;
   try{off.bind(1,1n);assert.deepEqual(await rowsWithoutIndexOpen(off,`${variant.id}: late WHERE after ON failure`),[[1n,1n]],`${variant.id}: off-path still usable`)}finally{off.finalize()}
  });
 }
});

test('forced expression-index joins preserve rows across exact-source identity neighbors',async()=>{
 const cases=[
  {id:'other-source-mismatch',sql:'SELECT x.id,y.id FROM e x JOIN e y INDEXED BY e_expr ON y.id=x.id WHERE lower(x.a)=?1 AND y.b+1=?2 ORDER BY x.id'},
  {id:'selected-source-match',sql:'SELECT x.id,y.id FROM e x JOIN e y INDEXED BY e_expr ON y.id=x.id WHERE lower(y.a)=?1 AND y.b+1=?2 ORDER BY x.id'},
 ];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const c of cases)try{assert.deepEqual(await execute(db,c.sql,['alpha',5]),[[1n,1n]],`${variant.id}/${c.id}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} expression-index join failures`);
});

test('ordinary covering-index self-joins preserve exact-source neighbors in every encoding',async()=>{
 const cases=[
  'SELECT x.id,y.id FROM m x JOIN m y INDEXED BY m_abc ON y.id=x.id WHERE y.a=1 AND y.b=2 AND y.c=2 ORDER BY x.id',
  'SELECT x.id,y.id FROM m x JOIN m y INDEXED BY m_abc ON y.id=x.id WHERE x.a=1 AND y.b=2 AND y.c=2 ORDER BY x.id',
 ];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [i,sql] of cases.entries())try{assert.deepEqual(await execute(db,sql),[[2n,2n]],`${variant.id}/${i}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} ordinary-index join failures`);
});

test('unforced joined-index selection never suppresses executable table fallback',async()=>{
 const automatic='SELECT x.id,y.id FROM m x JOIN m y ON y.id=x.id WHERE y.a=1 AND y.b=2 AND y.c=2 ORDER BY x.id';
 const table='SELECT x.id,y.id FROM m x JOIN m y NOT INDEXED ON y.id=x.id WHERE y.a=1 AND y.b=2 AND y.c=2 ORDER BY x.id';
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [id,sql] of [['automatic',automatic],['table',table]])try{assert.deepEqual(await execute(db,sql),[[2n,2n]],`${variant.id}/${id}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} unforced-index fallback failures`);
});

// Partial implication may not borrow the other source's identically named c.
// Pinned expr.c:exprImpliesNotNull does not infer non-NULL from an AND
// beneath NOT: NULL AND false is false, so its negation can be true.
test('partial implication rejects NOT over AND with nullable operand',async()=>{
 for(const variant of capture.variants){
  const fixtures=[variant.fixture.path,`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-partial-root-page.db`];
  for(const fixture of fixtures)await withBytes(fs.readFileSync(path.resolve(fixture)),async db=>{
   for(const predicate of ['NOT(c>0 AND a=?2)','NOT(a=?2 AND c>0)']){
    const suffix=` WHERE a=?1 AND ${predicate} ORDER BY id`;
    const automatic=db.prepare('SELECT id FROM p'+suffix).statement;
    const scan=db.prepare('SELECT id FROM p NOT INDEXED'+suffix).statement;
    try{
     for(const [a,opposite,expected] of [[1n,2n,[[1n],[2n]]],[1n,1n,[]],[null,2n,[]],[1n,2n,[[1n],[2n]]]]){
      for(const st of [scan,automatic]){st.reset();st.clearBindings();st.bind(1,a);st.bind(2,opposite)}
      assert.deepEqual(await rows(scan),expected,`${variant.id}/${predicate}: typed scan`);
      assert.deepEqual(await rows(automatic),expected,`${variant.id}/${predicate}: nullable/reset fallback`);
      assert.equal(privateAccounting(automatic).indexSeeks,0,'no partial seek on unsafe proof');
     }
    }finally{scan.finalize();automatic.finalize()}
    assert.throws(()=>db.prepare('SELECT id FROM p INDEXED BY p_live'+suffix),/forced index is unusable/,'forced rejects before cursor publication');
   }
   for(const predicate of ['NOT(c>0 OR c<0)','NOT(c<0 OR c>0)']){
    const suffix=` WHERE a=1 AND ${predicate} ORDER BY id`;
    assert.throws(()=>db.prepare('SELECT id FROM p INDEXED BY p_live'+suffix),/forced index is unusable/,'no non-NULL OR proof beneath NOT');
    assert.deepEqual(await execute(db,'SELECT id FROM p'+suffix),await execute(db,'SELECT id FROM p NOT INDEXED'+suffix));
   }
   if(fixture===variant.fixture.path){
    const positive=db.prepare('SELECT id FROM p INDEXED BY p_live WHERE a=?1 AND c>0 ORDER BY id').statement;
    try{positive.bind(1,1n);assert.deepEqual(await rows(positive),[[1n]]);assert.ok(privateAccounting(positive).indexSeeks>0,'valid neighboring proof retains selected access')}finally{positive.finalize()}
   }
  });
 }
});

test('joined same-name operand cannot prove partial predicate across sources',async()=>{
 const cases=[
  ['forward','SELECT p.id,p.c FROM p%s JOIN m ON p.a=m.c WHERE m.id=?1 ORDER BY p.id'],
  ['reversed','SELECT p.id,p.c FROM m JOIN p%s ON p.a=m.c WHERE m.id=?1 ORDER BY p.id'],
  ['left','SELECT p.id,p.c FROM m LEFT JOIN p%s ON p.a=m.c WHERE m.id=?1 ORDER BY p.id'],
 ];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [label,template] of cases){
   const scan=db.prepare(template.replace('%s',' NOT INDEXED')).statement;
   const automatic=db.prepare(template.replace('%s','')).statement;
   try{
    for(let run=0;run<2;run++){
     if(run){scan.reset();automatic.reset();scan.clearBindings();automatic.clearBindings()}
     scan.bind(1,1n);automatic.bind(1,1n);
     const control=await rows(scan);
     assert.deepEqual(control,[[1n,1n],[2n,null]],`${variant.id}/${label}/${run}: nullable control`);
     assert.deepEqual(await rows(automatic),control,`${variant.id}/${label}/${run}: unforced`);
     assert.equal(privateAccounting(automatic).indexSeeks,0,`${variant.id}/${label}/${run}: no partial index seek`);
    }
   }finally{scan.finalize();automatic.finalize()}
   assert.throws(()=>db.prepare(template.replace('%s',' INDEXED BY p_live')),/forced index is unusable/,`${variant.id}/${label}: forced rejects before publication`);
  }
 });
});

// Review-derived companion to pinned wherecode.c:codeAllEqualityTerms / Case 4
// and the captured m_abc equality-prefix-plus-range fixture. Unlike the frozen
// single-source capture, the bound is evaluated inside the joined loop.
test('joined forced composite index range retains equality prefix and strict endpoint in every encoding',async()=>{
 const cases=[
  {id:'two-sided',predicate:'y.b>1 AND y.b<=2',expected:[[2n,2n]]},
  {id:'lower-only',predicate:'y.b>1',expected:[[2n,2n],[2n,3n]]},
  {id:'upper-only',predicate:'y.b<3',expected:[[2n,1n],[2n,2n]]},
 ];
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const c of cases)for(const [id,hint] of [['forced','INDEXED BY m_abc'],['scan','NOT INDEXED']])try{
   const sql=`SELECT x.id,y.id FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id=2 AND ${c.predicate} ORDER BY y.id`;
   const statement=db.prepare(sql).statement;
   try{
    for(let run=0;run<2;run++){
     assert.deepEqual(await rows(statement),c.expected,`${variant.id}/${c.id}/${id}/run${run}`);
     if(id==='forced')assert.ok(privateAccounting(statement).indexSeeks>=1,`${variant.id}/${c.id}/${id}/run${run}: selected index seek`);
     if(run===0)statement.reset();
    }
   }finally{statement.finalize()}
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined composite-index range failures`);
});

test('joined strict composite bound rebinds across first, empty and partial ranges',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [hint,selected] of [['INDEXED BY m_abc',true],['NOT INDEXED',false]]){
   const statement=db.prepare(`SELECT y.id FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id=2 AND y.b>?1 ORDER BY y.id`).statement;
   try{
    statement.bind(1,1n);
    assert.equal(await statement.step(),'row',`${variant.id}/${hint}: first step`);
    assert.equal(statement.column(0),2n,`${variant.id}/${hint}: first qualifying row`);
    for(const [bound,expected] of [[2n,[[3n]]],[3n,[]],[1n,[[2n],[3n]]]]){
     statement.reset();statement.clearBindings();statement.bind(1,bound);
     assert.deepEqual(await rows(statement),expected,`${variant.id}/${hint}/${bound}: strict boundary`);
     if(selected)assert.ok(privateAccounting(statement).indexSeeks>=1,`${variant.id}/${bound}: selected composite seek`);
    }
   }finally{statement.finalize()}
  }
 });
});

// Single-source ORDER proof differs from joined ORDER: this case has a fixed
// leading a key and requests reverse movement within its equality prefix.
test('single-source composite reverse order returns boundary rows without a sorter',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id,b FROM m INDEXED BY m_abc WHERE a=?1 AND b>=1 AND b<=3 ORDER BY b DESC').statement;
  const scan=db.prepare('SELECT id,b FROM m NOT INDEXED WHERE a=?1 AND b>=1 AND b<=3 ORDER BY b DESC').statement;
  try{for(let run=0;run<2;run++)for(const [id,s] of [['scan',scan],['selected',statement]]){
   if(run)s.reset();s.clearBindings();s.bind(1,1n);
   assert.deepEqual(await rows(s),[[3n,3n],[2n,2n],[1n,1n]],`${variant.id}/${id}/${run}: descending rows`);
   if(id==='selected'){
    const accounting=privateAccounting(s);
    assert.equal(accounting.sorterRows,0,`${variant.id}/${run}: single-source ORDER proof`);
    assert.ok(accounting.indexNext>=3,`${variant.id}/${run}: selected index movement`);
   }
  }}finally{statement.finalize();scan.finalize()}
 });
});

// wherecode.c Case 4 appends a reverse range start after equality terms and
// distinguishes strict/inclusive start from the opposite termination bound.
test('single-source selected reverse composite range respects strict and empty starts across reset',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,b FROM m ${hint} WHERE a=1 AND b>?1 AND b<?2 ORDER BY b DESC`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement;
  const control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const [run,lower,upper,expected] of [
   ['interior',1n,3n,[[2n,2n]]],['empty',2n,3n,[]],
   ['no-upper-match',0n,1n,[]],['all',0n,4n,[[3n,3n],[2n,2n],[1n,1n]]],
  ])for(const [name,s] of [['scan',control],['selected',selected]]){
   if(run!=='interior')s.reset();s.clearBindings();s.bind(1,lower);s.bind(2,upper);
   assert.deepEqual(await rows(s),expected,`${variant.id}/${run}/${name}: strict reverse range`);
   if(name==='selected'){
    const accounting=privateAccounting(s);
    assert.equal(accounting.sorterRows,0,`${variant.id}/${run}: no sorter`);
    assert.ok(accounting.indexSeeks>=1,`${variant.id}/${run}: selected seek`);
   }
  }}finally{selected.finalize();control.finalize()}
 });
});

// Case 4 may have nEq>0 and no inequality at all. A reverse seek must land
// at the *last* key of the equality prefix, not at its first matching key.
test('single-source reverse equality prefix without a range starts at its last key',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,b FROM m ${hint} WHERE a=?1 ORDER BY b DESC`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement;
  const control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const [run,key,expected] of [
   ['many',1n,[[3n,3n],[2n,2n],[1n,1n]]],
   ['single',2n,[[4n,2n]]],['missing',4n,[]],
   ['again',1n,[[3n,3n],[2n,2n],[1n,1n]]],
  ])for(const [name,s] of [['scan',control],['selected',selected]]){
   if(run!=='many')s.reset();s.clearBindings();s.bind(1,key);
   assert.deepEqual(await rows(s),expected,`${variant.id}/${run}/${name}: reverse prefix`);
   if(name==='selected'){
    const accounting=privateAccounting(s);
    assert.ok(accounting.indexSeeks>=1,`${variant.id}/${run}: physical seek`);
    assert.equal(accounting.sorterRows,0,`${variant.id}/${run}: no sorter`);
   }
  }}finally{selected.finalize();control.finalize()}
 });
});

// wherecode.c Case 4 has a distinct no-start-constraint branch: OP_Last
// (not OP_Rewind) when scanning a forced index backwards. Existing range and
// equality-prefix tests do not exercise this boundary.
test('unbounded forced index reverse scan positions at last before Prev',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,a,b FROM m ${hint} ORDER BY a DESC,b DESC,c DESC,id DESC`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement;
  const control=db.prepare(sql('NOT INDEXED')).statement;
  try{
   const expected=await rows(control);
   assert.ok(expected.length>2,`${variant.id}: reverse scan spans multiple keys`);
   assert.deepEqual(await rows(selected),expected,`${variant.id}: reverse selected rows`);
   assert.equal(privateAccounting(selected).sorterRows,0,`${variant.id}: index order, not a masking sorter`);
   selected.reset();control.reset();
   assert.equal(await selected.step(),'row',`${variant.id}: first selected row before reset`);
   selected.reset();
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}: reset after first row`);
  }finally{selected.finalize();control.finalize()}
 });
});

// codeAllEqualityConstraints sends nullable '=' RHS to addrBrk before
// IndexSeekPrefix, but IS must retain a NULL key. Exercise a selected
// outer equality prefix with duplicate keys and reset/rebind.
test('selected equality NULL exits before seek but IS retains NULL key',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const comparison of ['=','IS']){
   const sql=hint=>`SELECT id,a FROM m ${hint} WHERE a ${comparison} ?1 ORDER BY a,id`;
   const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
   try{for(const value of [1n,null,2n,null,1n]){
    for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,value)}
    assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${comparison}/${String(value)}`);
   }}finally{selected.finalize();control.finalize()}
  }
 });
});

// codeINTerm's RHS set filters NULL and duplicates, then the inner IN
// cursor must restart when the outer IN cursor advances.
test('selected two-field IN duplicates NULL and outer restart match scan',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,a,b FROM m ${hint} WHERE a IN (?1,?2,?3) AND b IN (?4,?5,?6) ORDER BY a,b,id`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const params of [[1n,1n,null,1n,3n,null],[2n,null,1n,2n,2n,null],[null,null,null,1n,2n,null],[1n,2n,1n,3n,1n,3n]]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();params.forEach((value,i)=>statement.bind(i+1,value))}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(params)}`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// A failed range start in the inner IN level must advance the outer IN
// level, not terminate the selected scan or revisit a stale cursor.
test('selected nested IN with nullable range start advances outer level',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,a,b FROM m ${hint} WHERE a IN (?1,?2,?3) AND b IN (?4,?5,?6) AND c>=?7 ORDER BY a,b,c,id`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const params of [[1n,2n,null,1n,2n,null,null],[1n,2n,null,1n,2n,null,2n],[2n,1n,2n,3n,1n,null,1n]]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();params.forEach((value,i)=>statement.bind(i+1,value))}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(params)}`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// A joined selected inner range must branch to the next outer row when its
// start RHS is NULL; this caller constructs its own WHERE loop graph.
test('joined selected nullable inner range advances outer cursor',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT x.id,y.id FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id IN (1,2,3) AND y.b>=?1 ORDER BY x.id,y.id`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const bound of [2n,null,1n,null,3n]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,bound)}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(bound)}: nullable joined range`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// Joined equality keys must not turn = NULL into a seek over NULL keys;
// the outer row must still advance, while IS may search NULL keys.
test('joined selected nullable equality advances outer row',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const comparison of ['=','IS']){
   const sql=hint=>`SELECT x.id,y.id FROM m x JOIN m y ${hint} ON y.a ${comparison} ?1 WHERE x.id IN (1,2,3) AND y.b=x.b ORDER BY x.id,y.id`;
   const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
   try{for(const key of [1n,null,2n,null,1n]){
    for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,key)}
    assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${comparison}/${String(key)}: joined nullable equality`);
   }}finally{selected.finalize();control.finalize()}
  }
 });
});

// wherecode.c checks a nullable selected range RHS before seeking even
// inside a join. Public rows may be rescued by residual predicates, but
// skipping the branch still performs a cursor seek and changes budget/error
// ordering. Keep the producer graph contract explicit until migrated.
test('joined selected nullable range emits pre-seek VM IsNull branch',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const joined=source.slice(source.indexOf('function compileInnerTableSelect('),source.indexOf('interface FullScanPlan'));
 const seek=joined.slice(joined.indexOf('const keys=admissions.map('),joined.indexOf('rewinds[level]=ops.length;ops.push({code:\'IndexSeekPrefix\''));
 assert.match(seek,/code:'IsNull'.*p1:keys\[keys\.length-1\]!/, 'joined selected loop must branch on nullable start register before seek');
});

// A NULL start must skip the selected seek before work-limit accounting;
// the upper bound on a fresh failed seek is source-owned loop control.
test('joined selected NULL range bypasses seek while preserving sticky budget errors',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql='SELECT x.id,y.id FROM m x JOIN m y INDEXED BY m_abc ON y.a=x.a WHERE x.id IN (1,2,3) AND y.b>=?1 ORDER BY x.id,y.id';
  const statement=db.prepare(sql).statement;
  try{statement.bind(1,null);assert.deepEqual(await rows(statement),[],variant.id);
   const nullSeeks=privateAccounting(statement).indexSeeks;
   statement.reset();statement.clearBindings();statement.bind(1,1n);
   assert.ok((await rows(statement)).length>0,`${variant.id}: bound rows`);
   assert.ok(privateAccounting(statement).indexSeeks>nullSeeks,`${variant.id}: NULL branch did not seek`);
  }finally{statement.finalize()}
  const limited=db.prepare(sql).statement;limited.bind(1,1n);
  let failure;try{await limited.step({maxWorkUnits:1})}catch(error){failure=error}
  assert.equal(failure?.kind,'limit',`${variant.id}: work limit`);
  assert.throws(()=>limited.reset(),error=>error===failure);
  assert.doesNotThrow(()=>limited.finalize());
 });
});

// where.c:sqlite3WhereEnd emits NullRow on both the table and its selected
// index cursor for a LEFT miss. Probe an index-covered column after a hit,
// then after a miss, across reset and outer iteration.
test('selected LEFT index miss clears covered index row and deferred table row',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT x.id,y.id,y.a,y.b FROM m x LEFT JOIN m y ${hint} ON y.a=x.a AND y.b=?1 WHERE x.id IN (1,2,3) ORDER BY x.id,y.id`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const b of [2n,99n,1n,99n,2n]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,b)}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${b}: LEFT selected miss`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// where.c:sqlite3WhereEnd nulls both selected index and table cursors on
// a LEFT miss, and vdbe.c:OP_NullRow invalidates pending deferred seeks.
// Demand an uncovered column after a prior hit to catch stale table state.
test('selected LEFT miss after hit never materializes stale deferred row',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT x.id,y.id,y.c FROM m x LEFT JOIN m y ${hint} ON y.a=x.a AND y.b=?1 WHERE x.id IN (1,2,3) ORDER BY x.id,y.id`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const b of [1n,2n,null,99n]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,b)}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(b)}: deferred LEFT row`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// A LEFT miss must clear a pending rowid from the preceding selected hit.
// The index does not cover ov.payload; force a miss between two hits.
test('selected LEFT miss clears pending uncovered payload from prior hit',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT x.id,y.id,y.payload FROM m x LEFT JOIN ov y ${hint} ON y.k=?1 WHERE x.id IN (1,2) ORDER BY x.id,y.id`;
  const selected=db.prepare(sql('INDEXED BY ov_k_payload')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const k of ['needle','absent','other',null,'needle']){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,k)}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(k)}: LEFT payload`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// sqlite3WhereEnd emits NullRow on the selected index as well as the
// nullable table; vdbe.c:OP_NullRow cancels pending deferred seeks. The
// producer and VM must implement both state transitions, even when residual
// row tests happen to hide a stale cursor in selected public fixtures.
test('selected LEFT null-row closes index and pending deferred table cursor',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const joined=source.slice(source.indexOf('function compileInnerTableSelect('),source.indexOf('interface FullScanPlan'));
 const unmatched=joined.slice(joined.indexOf('const match=leftMatches[level];if(match!==undefined){'),joined.indexOf('const normalScanEnd='));
 assert.match(unmatched,/code:'NullRow',p1:.*indexCursor/, 'selected LEFT miss must null its index cursor');
 const vm=source.slice(source.indexOf('case "NullRow":'),source.indexOf('case "Column":',source.indexOf('case "NullRow":')));
 assert.match(vm,/#deferredRowids\.delete\(op\.p1\)/,'NullRow must clear the table cursor pending seek');
});

// wherecode.c:sqlite3WhereRightJoinLoop nulls each left table AND its
// selected index before invoking the unmatched-right continuation.
test('selected RIGHT unmatched pass nulls left selected index before continuation',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const joined=source.slice(source.indexOf('function compileInnerTableSelect('),source.indexOf('interface FullScanPlan'));
 const pass=joined.slice(joined.indexOf('for(const [rightLevel,right] of rightStates)'),joined.indexOf('const rewind=ops.length;ops.push({code:\'Rewind\'',joined.indexOf('for(const [rightLevel,right] of rightStates)')));
 assert.match(pass,/for\(let level=0;level<rightLevel;level\+\+\)\{[\s\S]*?indexCursors\.get\(ordinal\)[\s\S]*?code:'NullRow',p1:indexCursor/, 'unmatched RIGHT continuation must null selected left index with table');
});

test('selected left cursor is NULL across RIGHT unmatched pass and reset',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT x.id,x.a,x.b,y.id FROM m x ${hint} RIGHT JOIN m y ON x.a=y.a AND x.b=?1 WHERE y.id IN (1,4,5) ORDER BY y.id,x.id`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement,control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const b of [1n,99n,2n,null,1n]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,b)}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(b)}: RIGHT null left`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// Case 4 null range starts must take the next-loop edge before any row,
// including a reverse prefix with duplicate leading keys and reset/rebind.
test('forward selected equality prefix and nullable lower bound restart',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,b FROM m ${hint} WHERE a=?1 AND b>=?2 ORDER BY b,id`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement;
  const control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const [a,b] of [[1n,2n],[1n,null],[1n,1n],[null,2n],[1n,2n]]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,a);statement.bind(2,b)}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(a)}/${String(b)}: forward nullable range`);
  }}finally{selected.finalize();control.finalize()}
 });
});

test('reverse selected equality prefix and nullable upper bound restart',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,b FROM m ${hint} WHERE a=?1 AND b<=?2 ORDER BY b DESC,id DESC`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement;
  const control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const [a,b] of [[1n,3n],[1n,null],[1n,2n],[null,3n],[1n,3n]]){
   for(const statement of [selected,control]){statement.reset();statement.clearBindings();statement.bind(1,a);statement.bind(2,b)}
   assert.deepEqual(await rows(selected),await rows(control),`${variant.id}/${String(a)}/${String(b)}: reverse nullable range`);
   if(a!==null&&b!==null)assert.ok(privateAccounting(selected).indexSeeks>0,`${variant.id}: selected seek`);
  }}finally{selected.finalize();control.finalize()}
 });
});

// Case 4's nEq=0 reverse start is a full-key seek, not the equality-prefix
// rewind; cover a strict range that changes both the first and last key.
test('single-source reverse leading-key range without equality seeks the upper edge',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const sql=hint=>`SELECT id,a FROM m ${hint} WHERE a>?1 AND a<?2 ORDER BY a DESC,id DESC`;
  const selected=db.prepare(sql('INDEXED BY m_abc')).statement;
  const control=db.prepare(sql('NOT INDEXED')).statement;
  try{for(const [run,lower,upper,expected] of [
   ['interior',1n,3n,[[4n,2n]]],['empty',2n,3n,[]],
   ['wide',0n,4n,[[5n,3n],[4n,2n],[3n,1n],[2n,1n],[1n,1n]]],
  ])for(const [name,s] of [['scan',control],['selected',selected]]){
   if(run!=='interior')s.reset();s.clearBindings();s.bind(1,lower);s.bind(2,upper);
   assert.deepEqual(await rows(s),expected,`${variant.id}/${run}/${name}: leading reverse range`);
   if(name==='selected'){
    const accounting=privateAccounting(s);
    assert.ok(accounting.indexSeeks>=1,`${variant.id}/${run}: selected seek`);
   }
  }}finally{selected.finalize();control.finalize()}
 });
});

// Review-derived joined reverse neighbor of the frozen m_abc fixture. Compare
// public typed rows with a table-scan control; private movement establishes
// only that the forced branch actually touched the selected physical index.
test('joined selected reverse range preserves public rows across encodings and reset',async()=>{
 const cases=[
  {id:'reverse',predicate:'y.b>=1 AND y.b<=3',order:'y.b DESC,y.id DESC',expected:[[2n,3n],[2n,2n],[2n,1n]]},
 ];
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const c of cases)for(const [id,hint] of [['forced','INDEXED BY m_abc'],['scan','NOT INDEXED']])try{
   const sql=`SELECT x.id,y.id FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id=2 AND ${c.predicate} ORDER BY ${c.order}`;
   const statement=db.prepare(sql).statement;
   try{for(let run=0;run<2;run++){
    assert.deepEqual(await rows(statement),c.expected,`${variant.id}/${c.id}/${id}/run${run}`);
    if(id==='forced')assert.ok(privateAccounting(statement).indexNext>=1,`${variant.id}/${c.id}/${id}/run${run}: selected index movement`);
    if(run===0)statement.reset();
   }}finally{statement.finalize()}
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined reverse-range failures`);
});

// Pinned where.c5273 WHERE_ONEROW skips the exact-IPK outer loop.
// The forced suffix supplies reverse b order; NOT INDEXED needs a sorter.
test('joined reverse b order consumes selected ONEROW suffix proof',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [id,hint] of [['forced','INDEXED BY m_abc'],['scan','NOT INDEXED']])try{
   const statement=db.prepare(`SELECT y.b FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id=2 AND y.b>=1 AND y.b<=3 ORDER BY y.b DESC`).statement;
   try{for(let run=0;run<2;run++){
    assert.deepEqual(await rows(statement),[[3n],[2n],[1n]],`${variant.id}/${id}/run${run}`);
    if(id==='forced'){
     const accounting=privateAccounting(statement);
     assert.ok(accounting.indexSeeks>=1,`${variant.id}/${id}/run${run}: selected root seek`);
     assert.equal(accounting.sorterRows,0,`${variant.id}/${id}/run${run}: pinned forced SORT0`);
    }
    if(id==='scan')assert.equal(privateAccounting(statement).sorterRows,3,`${variant.id}/${run}: scan SORT1, three rows`);
    if(run===0)statement.reset();
   }}finally{statement.finalize()}
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined reverse-order coverage failures`);
});

// An indexed join and its NOT INDEXED control must agree for a two-value IN.
// Pinned expr.c:sqlite3ExprCodeIN requires the left operand to use the joined
// source cursor; an empty result in both paths is not an index-only defect.
test('joined IN-list residual preserves source identity in every encoding',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const hint of ['INDEXED BY m_abc','NOT INDEXED'])try{
   const sql=`SELECT x.id,y.id FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id=2 AND y.b IN (1,3) ORDER BY y.id DESC`;
   let statement;
   try{statement=db.prepare(sql).statement}catch(error){if(hint==='NOT INDEXED')throw error;assert.match(String(error),/forced index is unusable/,`${variant.id}: forced access rejected`);continue;}
   try{for(let run=0;run<2;run++){
    assert.deepEqual(await rows(statement),[[2n,3n],[2n,1n]],`${variant.id}/${hint}/run${run}`);
    if(run===0)statement.reset();
   }}finally{statement.finalize()}
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined IN-list residual failures`);
});

// Rebinding IN-list operands after a partially consumed joined row must use
// the selected source's current value, not the first source or stale registers.
test('joined IN-list residual rebinds typed RHS after partial step across encodings',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const hint of ['INDEXED BY m_abc','NOT INDEXED'])try{
   const sql=`SELECT x.id,y.id FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id=2 AND y.b IN (?1,?2) ORDER BY y.id DESC`;
   let statement;
   try{statement=db.prepare(sql).statement}catch(error){if(hint==='NOT INDEXED')throw error;assert.match(String(error),/forced index is unusable/,`${variant.id}: forced access rejected`);continue;}
   try{
    statement.bind(1,1n);statement.bind(2,3n);
    assert.equal(await statement.step(),'row',`${variant.id}/${hint}/first step`);
    assert.deepEqual([statement.column(0),statement.column(1)],[2n,3n],`${variant.id}/${hint}/first row`);
    statement.reset();statement.bind(1,null);statement.bind(2,2n);
    assert.deepEqual(await rows(statement),[[2n,2n]],`${variant.id}/${hint}/rebind with NULL`);
    statement.reset();statement.bind(1,3n);statement.bind(2,1n);
    assert.deepEqual(await rows(statement),[[2n,3n],[2n,1n]],`${variant.id}/${hint}/second rebind`);
   }finally{statement.finalize()}
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined IN-list rebind failures`);
});

// A forced joined IN path must either lower both key probes or reject the
// unsupported selected access at prepare; scanning the forced root and applying
// IN only as a residual is not equivalent to selected IN-prefix execution.
test('joined forced IN-prefix either seeks each key or rejects preparation atomically',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const forced='SELECT x.id,y.id FROM m x JOIN m y INDEXED BY m_abc ON y.a=x.a WHERE x.id=2 AND y.b IN (1,3) ORDER BY y.id DESC';
  const control='SELECT x.id,y.id FROM m x JOIN m y NOT INDEXED ON y.a=x.a WHERE x.id=2 AND y.b IN (1,3) ORDER BY y.id DESC';
  try{
   let statement,rejected=false;
   try{statement=db.prepare(forced).statement}catch(error){
    assert.match(String(error),/forced index is unusable|not implemented/i,`${variant.id}: atomic forced rejection`);
    assert.deepEqual(await execute(db,control),[[2n,3n],[2n,1n]],`${variant.id}: connection after reject`);
    rejected=true;
   }
   if(!rejected){
    try{
     assert.deepEqual(await rows(statement),[[2n,3n],[2n,1n]],`${variant.id}: forced rows`);
     assert.ok(privateAccounting(statement).indexSeeks>=2,`${variant.id}: two selected IN key seeks or atomic prepare rejection`);
    }finally{statement.finalize()}
   }
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined IN-prefix admission failures`);
});

// Demanding selected-path gate: the permissive admission neighbor accepts
// rejection, whereas this one requires actual codeINTerm restart per RHS.
// Pinned 3.53.4 where.c selects the join equality on m_abc (a=?),
// leaving the IN list as a residual filter: EXPLAIN has one SeekGE/IdxGT
// pair and no per-IN seek, for both INNER and LEFT join.
test('joined forced single-field IN filters within the selected equality probe after rebind',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT x.id,y.id FROM m x JOIN m y INDEXED BY m_abc ON y.a IN (?1,?2) WHERE x.id=2 AND y.a=x.a ORDER BY y.id').statement;
  try{
   for(const [a,b,expected] of [[1n,3n,[[2n,1n],[2n,2n],[2n,3n]]],[null,1n,[[2n,1n],[2n,2n],[2n,3n]]],[3n,3n,[]]]){
    statement.bind(1,a);statement.bind(2,b);
    assert.deepEqual(await rows(statement),expected,variant.id);
    assert.equal(privateAccounting(statement).indexSeeks,1,variant.id+' selected join equality probe with residual IN');
    statement.reset();statement.clearBindings();
   }
  }finally{statement.finalize()}
  const outer=db.prepare('SELECT x.id,y.id FROM m x LEFT JOIN m y INDEXED BY m_abc ON y.a=x.a AND y.a IN (?1,?2) WHERE x.id=5 ORDER BY y.id').statement;
  try{
   outer.bind(1,1n);outer.bind(2,2n);
   assert.deepEqual(await rows(outer),[[5n,null]],variant.id+' LEFT unmatched emitted once');
   assert.equal(privateAccounting(outer).indexSeeks,1,variant.id+' LEFT join equality probe with residual IN');
   outer.reset();outer.bind(1,3n);outer.bind(2,3n);
   assert.deepEqual(await rows(outer),[[5n,5n]],variant.id+' LEFT rebind match once');
  }finally{outer.finalize()}
 });
});

// The joined lowerer now restarts the selected composite seek per IN value;
// verify native-shaped rows and private access through reset and NULL rebind.
test('joined forced and unforced composite IN seek across rebind',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const hint of ['INDEXED BY m_abc','']){
   const st=db.prepare(`SELECT x.id,y.id FROM m x JOIN m y ${hint} ON y.a=x.a WHERE x.id=2 AND y.b IN (?1,?2) ORDER BY y.id DESC`).statement;
   try{
    for(const [phase,values,expected] of [
     ['initial',[1n,3n],[[2n,3n],[2n,1n]]],
     ['empty',[null,null],[]],
     ['rebound',[3n,1n],[[2n,3n],[2n,1n]]],
    ]){
     if(phase!=='initial')st.reset();st.clearBindings();
     values.forEach((value,i)=>st.bind(i+1,value));
     assert.deepEqual(await rows(st),expected,`${variant.id}/${hint}/${phase}: rows`);
     assert.ok(privateAccounting(st).indexSeeks>=(phase==='empty'?0:2),`${variant.id}/${hint}/${phase}: selected probes`);
    }
   }finally{st.finalize()}
  }
 });
});

test('joined selected-path order is honored rather than source-order lowered',async()=>{
 const reordered='SELECT x.id,y.id FROM m x JOIN m y ON y.id=x.id WHERE y.a=1 AND y.b=2 AND y.c=2 ORDER BY x.id';
 const aligned='SELECT x.id,y.id FROM m y JOIN m x ON x.id=y.id WHERE y.a=1 AND y.b=2 AND y.c=2 ORDER BY x.id';
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [id,sql] of [['reordered',reordered],['aligned',aligned]])try{assert.deepEqual(await execute(db,sql),[[2n,2n]],`${variant.id}/${id}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined path-order failures`);
});

test('joined forced expression path does not bypass selected-index corruption',async()=>{
 const failures=[];
 for(const variant of capture.variants){const fixture=path.resolve(variant.fixture.path.replace(/\.db$/, '-corrupt-expression-root-page.db'));await withBytes(fs.readFileSync(fixture),async db=>{
  const sql="SELECT x.id,y.id FROM e y INDEXED BY e_expr JOIN e x ON x.id=y.id WHERE lower(y.a)='alpha' AND y.b+1=5 ORDER BY x.id";
  try{const actual=await execute(db,sql);failures.push(new assert.AssertionError({message:`${variant.id}: selected corrupt e_expr unexpectedly returned rows`,actual,expected:'SQLite error',operator:'throws'}))}catch(error){if(error instanceof assert.AssertionError)throw error;assert.match(String(error?.kind??error),/sqlite/i,`${variant.id}: selected corruption classification`)}
 }).catch(error=>failures.push(error))}
 if(failures.length)throw new AggregateError(failures,`${failures.length} joined selected-corruption failures`);
});

test('partial implication unwraps only a qualifying query-side IIF or searched CASE condition',async()=>{
 const positive=['iif(c>0,1)','iif(c>0,1,NULL)','iif(c>0,1,false)','iif(c>0,1,0)','iif(c>0,1,00)','iif(c>0,1,0x0)','iif(c>0,1,+0)','iif(c>0,1,-0)','iif(c>0,1,+(+0))','iif(c>0,1,-(-0))','iif(c>0,1,(0))','IIF(c>0,1,0)','if(c>0,1,0)','IF(c>0,1,0)','CASE WHEN c>0 THEN 1 END','CASE WHEN c>0 THEN 1 ELSE NULL END','CASE WHEN c>0 THEN 1 ELSE false END','CASE WHEN c>0 THEN 1 ELSE 0 END','CASE WHEN c>0 THEN 1 ELSE 00 END','CASE WHEN c>0 THEN 1 ELSE 0x0 END','CASE WHEN c>0 THEN 1 ELSE +0 END','CASE WHEN c>0 THEN 1 ELSE -0 END','CASE WHEN c>0 THEN 1 ELSE +(+0) END','CASE WHEN c>0 THEN 1 ELSE -(-0) END','CASE WHEN c>0 THEN 1 ELSE (0) END'],negative=['iif(c IS NULL,1,0)','iif(c>0,1,true)','iif(c>0,1,1)','iif(c>0,1,0.0)','iif(c>0,1,+0.0)','iif(c>0,1,-0.0)','iif(c>0,1,+(+0.0))','iif(c>0,1,-(-0.0))','iif(c>0,1,(0.0))','iif(c>0,1,\'0\')','iif(c>0,1,CAST(0 AS INTEGER))','iif(c>0,1,0+0)','iif(c>0,1,?1)','iif(c>0,1,c<0,1,0)','if(c>0,1,c<0,1,0)','CASE WHEN c IS NULL THEN 1 END','CASE WHEN c>0 THEN 1 ELSE true END','CASE WHEN c>0 THEN 1 ELSE 1 END','CASE WHEN c>0 THEN 1 ELSE 0.0 END','CASE WHEN c>0 THEN 1 ELSE +0.0 END','CASE WHEN c>0 THEN 1 ELSE -0.0 END','CASE WHEN c>0 THEN 1 ELSE +(+0.0) END','CASE WHEN c>0 THEN 1 ELSE -(-0.0) END','CASE WHEN c>0 THEN 1 ELSE (0.0) END','CASE WHEN c>0 THEN 1 ELSE \'0\' END','CASE c WHEN 1 THEN 1 END','CASE WHEN c>0 THEN 1 WHEN c<0 THEN 1 END'],failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const expression of positive)try{assert.deepEqual(await execute(db,`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${expression} ORDER BY id`),[[1n]],`${variant.id}/${expression}`)}catch(cause){failures.push(new Error(`${variant.id}/${expression}: ${cause instanceof Error?cause.message:String(cause)}`,{cause}))}
  for(const expression of negative)assert.throws(()=>db.prepare(`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${expression} ORDER BY id`),error=>String(error?.message).includes('forced index is unusable'),`${variant.id}/${expression}`);
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} IIF/CASE implication failures`);
});

test('forced partial prepare rejection is atomic and does not poison the connection',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const original=BtreeDatabase.prototype.indexCursor,opens=[];
  BtreeDatabase.prototype.indexCursor=function(root){opens.push(root);return original.call(this,root)};
  try{for(let attempt=0;attempt<2;attempt++){
   assert.throws(()=>db.prepare('SELECT id FROM p INDEXED BY p_live WHERE a=1'),error=>String(error?.message).includes('forced index is unusable'),`${variant.id}/reject/${attempt}`);
   assert.deepEqual(opens,[],`${variant.id}/reject/${attempt}: no index cursor opened before rejection`);
  }}finally{BtreeDatabase.prototype.indexCursor=original}
  assert.deepEqual(await execute(db,'SELECT id FROM p NOT INDEXED WHERE a=1 ORDER BY id'),[[1n],[2n]],`${variant.id}/fresh fallback`);
  assert.deepEqual(await execute(db,'SELECT id FROM p INDEXED BY p_live WHERE a=1 AND c IS NOT NULL ORDER BY id'),[[1n]],`${variant.id}/fresh forced`);
 });
});

test('expression-index seeks preserve INTEGER REAL TEXT BLOB parameter classes',async()=>{
 const cases=[[5n,[[1n]]],[5,[[1n]]],['5',[]],[new Uint8Array([53]),[]]],failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [value,expected] of cases)try{const statement=db.prepare('SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+1=?2 ORDER BY id').statement;try{statement.bind(1,'alpha');statement.bind(2,value);assert.deepEqual(await rows(statement),expected,`${variant.id}/${typeof value}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,1,`${variant.id}/${typeof value}/seek`);assert.equal(accounting.indexNext,expected.length,`${variant.id}/${typeof value}/visits`)}finally{statement.finalize()}}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} expression parameter-class failures`);
});

// Review-derived neighbor of the frozen expression-identical/mismatch cases:
// without INDEXED BY, matching terms must select a seek, while a different
// expression cannot borrow that seek. This is private movement, not native credit.
test('unforced expression identity does not borrow a mismatched expression-index seek',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [id,sql,expected] of [
   ['identical','SELECT id FROM e WHERE lower(a)=?1 AND b+1=?2 ORDER BY id',[[1n]]],
   ['mismatch','SELECT id FROM e WHERE upper(a)=?1 AND b+1=?2 ORDER BY id',[]],
  ])try{
   const statement=db.prepare(sql).statement;
   try{for(let run=0;run<2;run++){
    if(run)statement.reset();statement.clearBindings();statement.bind(1,'alpha');statement.bind(2,5n);
    assert.deepEqual(await rows(statement),expected,`${variant.id}/${id}/${run}/rows`);
    const accounting=privateAccounting(statement);
    if(id==='identical')assert.equal(accounting.indexSeeks,1,`${variant.id}/${id}/${run}: selected identical expression seek`);
    else assert.equal(accounting.indexSeeks,0,`${variant.id}/${id}/${run}: no mismatched seek`);
   }}finally{statement.finalize()}
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} unforced expression identity failures`);
});

// The mismatched expression must return nonempty rows so zero seeks cannot be
// explained merely by a predicate that never matches a table row.
test('unforced mismatched expression preserves nonempty results without borrowing expression seek',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id FROM e WHERE upper(a)=?1 AND b+1>=?2 ORDER BY id').statement;
  try{for(let run=0;run<2;run++){
   if(run)statement.reset();statement.clearBindings();statement.bind(1,'ALPHA');statement.bind(2,5n);
   assert.deepEqual(await rows(statement),[[1n],[3n]],`${variant.id}/${run}: matching table rows`);
   assert.equal(privateAccounting(statement).indexSeeks,0,`${variant.id}/${run}: no borrowed expression seek`);
  }}finally{statement.finalize()}
 });
});

test('unforced identical expression rebinds text and NULL without stale selected rows',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id FROM e WHERE lower(a)=?1 AND b+1=?2 ORDER BY id').statement;
  try{for(const [run,left,right,expected] of [
   ['alpha','alpha',5n,[[1n]]],['null',null,5n,[]],['beta','beta',6n,[[2n]]],['rebound','alpha',5n,[[1n]]],
  ]){
   if(run!=='alpha')statement.reset();statement.clearBindings();statement.bind(1,left);statement.bind(2,right);
   assert.deepEqual(await rows(statement),expected,`${variant.id}/${run}: rows`);
   assert.equal(privateAccounting(statement).tableSeeks,0,`${variant.id}/${run}: no base lookup`);
   if(left!==null)assert.equal(privateAccounting(statement).indexSeeks,1,`${variant.id}/${run}: selected expression seek`);
  }}finally{statement.finalize()}
 });
});

test('unforced expression range releases partial cursor on reset and changes key',async()=>{
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id FROM e WHERE lower(a)=?1 AND b+1>=?2 ORDER BY id').statement;
  try{
   statement.bind(1,'alpha');statement.bind(2,5n);
   assert.equal(await statement.step(),'row',`${variant.id}: first step`);
   assert.equal(statement.column(0),1n,`${variant.id}: first id`);
   statement.reset();statement.clearBindings();statement.bind(1,'beta');statement.bind(2,6n);
   assert.deepEqual(await rows(statement),[[2n]],`${variant.id}: changed key after partial step`);
   assert.equal(privateAccounting(statement).indexSeeks,1,`${variant.id}: selected seek after reset`);
   statement.reset();statement.clearBindings();statement.bind(1,'alpha');statement.bind(2,5n);
   assert.deepEqual(await rows(statement),[[1n],[3n]],`${variant.id}: full original range after reset`);
   assert.equal(privateAccounting(statement).indexSeeks,1,`${variant.id}: selected range seek`);
  }finally{statement.finalize()}
 });
});

test('unforced identical expression reaches corrupt physical root while rowid path stays isolated',async()=>{
 for(const variant of capture.variants){
  const fixture=path.resolve(`test/conformance/fixtures/advanced-index-${variant.id}-corrupt-expression-root-page.db`);
  await withBytes(fs.readFileSync(fixture),async db=>{
   const offPath=db.prepare('SELECT id,a FROM e NOT INDEXED WHERE id=1').statement;
   try{assert.deepEqual(await rows(offPath),[[1n,'Alpha']],`${variant.id}: off-path row`);assert.equal(privateAccounting(offPath).indexSeeks,0,`${variant.id}: off-path has no index seek`)}finally{offPath.finalize()}
   const matching=db.prepare('SELECT id FROM e WHERE lower(a)=?1 AND b+1=?2 ORDER BY id').statement;
   let failure;try{matching.bind(1,'alpha');matching.bind(2,5n);await rows(matching)}catch(error){failure=error}finally{try{matching.finalize()}catch{}}
   assert.equal(failure?.kind,'sqlite',`${variant.id}: selected physical expression root fails`);
   assert.deepEqual(await execute(db,'SELECT id,a FROM e NOT INDEXED WHERE id=1'),[[1n,'Alpha']],`${variant.id}: unrelated table root remains usable`);
  });
 }
});

test('expression identity folds function-name case but not function shape',async()=>{
 const expressions=['LOWER(a)','lower( a )'];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const expression of expressions)try{const statement=db.prepare(`SELECT id FROM e INDEXED BY e_expr WHERE ${expression}=?1 AND b+1=?2 ORDER BY id`).statement;try{statement.bind(1,'alpha');statement.bind(2,5n);assert.deepEqual(await rows(statement),[[1n]],`${variant.id}/${expression}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,1,`${variant.id}/${expression}/seek`);assert.equal(accounting.indexNext,1,`${variant.id}/${expression}/two-field identity`);assert.equal(accounting.residualTests,0,`${variant.id}/${expression}/no residual`)}finally{statement.finalize()}}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} function-name identity failures`);
});

test('partial NOT NULL implication preserves arithmetic seenNot fallthrough',async()=>{
 // c&1 remains outside this checkpoint with separately attributed bitwise lowering.
 const cases=[['c*0',[]],['c/1',[[1n]]],['1/c',[[1n]]],['c%2',[[1n]]]],failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [predicate,expected] of cases)try{assert.deepEqual(await execute(db,`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${predicate} ORDER BY id`),expected,`${variant.id}/${predicate}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} arithmetic implication failures`);
});

test('partial NOT NULL implication descends into either comparison operand',async()=>{
 const cases=[['0<c',[[1n]]],['1=c',[[1n]]],['2>=c',[[1n]]],['0 BETWEEN c AND 2',[]]],failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [predicate,expected] of cases)try{assert.deepEqual(await execute(db,`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${predicate} ORDER BY id`),expected,`${variant.id}/${predicate}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} reverse-operand implication failures`);
});

test('partial NOT NULL implication preserves IN-subquery seenNot guard',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  try{assert.deepEqual(await execute(db,'SELECT id FROM p INDEXED BY p_live WHERE a=1 AND c IN (SELECT a FROM p) ORDER BY id'),[[1n]],`${variant.id}/IN SELECT`)}catch(error){failures.push(error)}
  try{assert.throws(()=>db.prepare('SELECT id FROM p INDEXED BY p_live WHERE a=1 AND c NOT IN (SELECT a FROM p)'),error=>String(error?.message).includes('forced index is unusable'),`${variant.id}/NOT IN SELECT`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} IN-subquery implication failures`);
});

test('partial NOT NULL implication preserves negated IN and BETWEEN asymmetry',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  try{assert.deepEqual(await execute(db,'SELECT id FROM p INDEXED BY p_live WHERE a=1 AND c NOT IN (1,2) ORDER BY id'),[],`${variant.id}/NOT IN`)}catch(error){failures.push(error)}
  try{assert.throws(()=>db.prepare('SELECT id FROM p INDEXED BY p_live WHERE a=1 AND c NOT BETWEEN 0 AND 2'),error=>String(error?.message).includes('forced index is unusable'),`${variant.id}/NOT BETWEEN`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} negated IN/BETWEEN implication failures`);
});

test('partial NOT NULL implication preserves IS truth polarity',async()=>{
 const admitted=[['c IS TRUE',[[1n]]],['c IS FALSE',[]]],rejected=['c IS NOT TRUE','c IS NOT FALSE'],failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [predicate,expected] of admitted)try{assert.deepEqual(await execute(db,`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${predicate} ORDER BY id`),expected,`${variant.id}/${predicate}`)}catch(error){failures.push(error)}
  for(const predicate of rejected)try{assert.throws(()=>db.prepare(`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${predicate}`),error=>String(error?.message).includes('forced index is unusable'),`${variant.id}/${predicate}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} IS-truth polarity failures`);
});

test('partial NOT NULL implication admits represented unary and concatenation operators',async()=>{
 const cases=[['NOT c',[]],['+c',[[1n]]],['-c',[[1n]]],["c||'x'",[[1n]]]];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [predicate,expected] of cases)try{assert.deepEqual(await execute(db,`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${predicate} ORDER BY id`),expected,`${variant.id}/${predicate}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} unary/concat implication failures`);
});

test('expression identity does not skip nested COLLATE',async()=>{
 const expressions=['lower(a COLLATE BINARY)','lower(a COLLATE NOCASE)'];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const expression of expressions)try{const statement=db.prepare(`SELECT id FROM e INDEXED BY e_expr WHERE ${expression}=?1 AND b+1=?2 ORDER BY id`).statement;try{statement.bind(1,'alpha');statement.bind(2,5n);assert.deepEqual(await rows(statement),[[1n]],`${variant.id}/${expression}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,0,`${variant.id}/${expression}/no seek`);assert.equal(accounting.indexNext,3,`${variant.id}/${expression}/full index`);assert.equal(accounting.residualTests,3,`${variant.id}/${expression}/residual`)}finally{statement.finalize()}}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} nested-COLLATE identity failures`);
});

test('expression identity preserves REAL literal class distinctions',async()=>{
 const literals=['1.0','1e0'];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const literal of literals)try{const statement=db.prepare(`SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+${literal}=?2 ORDER BY id`).statement;try{statement.bind(1,'alpha');statement.bind(2,5n);assert.deepEqual(await rows(statement),[[1n]],`${variant.id}/${literal}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,1,`${variant.id}/${literal}/prefix seek`);assert.equal(accounting.indexNext,2,`${variant.id}/${literal}/class mismatch candidates`);assert.equal(accounting.residualTests,2,`${variant.id}/${literal}/residual retained`)}finally{statement.finalize()}}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} REAL-literal identity failures`);
});

test('expression identity compares hexadecimal integer literal values',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+0x1=?2 ORDER BY id').statement;
  try{statement.bind(1,'alpha');statement.bind(2,5n);assert.deepEqual(await rows(statement),[[1n]],`${variant.id}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,1,`${variant.id}/seek`);assert.equal(accounting.indexNext,1,`${variant.id}/two-field seek`);assert.equal(accounting.residualTests,0,`${variant.id}/no residual`)}catch(error){failures.push(error)}finally{try{statement.finalize()}catch{}}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} hexadecimal-literal identity failures`);
});

test('partial implication rejects parameters constants and other-column non-null proofs',async()=>{
 const predicates=['?1 IS NOT NULL','1 IS NOT NULL','a IS NOT NULL'];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const predicate of predicates)assert.throws(()=>db.prepare(`SELECT id FROM p INDEXED BY p_live WHERE a=1 AND ${predicate}`),error=>String(error?.message).includes('forced index is unusable'),`${variant.id}/${predicate}`);
 });
});

test('expression identity preserves unary and CAST distinctions',async()=>{
 const expressions=['+b+1','b+(+1)','b+CAST(1 AS INTEGER)'];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const expression of expressions)try{const statement=db.prepare(`SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND ${expression}=?2 ORDER BY id`).statement;try{statement.bind(1,'alpha');statement.bind(2,5n);assert.deepEqual(await rows(statement),[[1n]],`${variant.id}/${expression}/rows`);const accounting=privateAccounting(statement);assert.equal(accounting.indexSeeks,1,`${variant.id}/${expression}/prefix only`);assert.equal(accounting.indexNext,2,`${variant.id}/${expression}/residual candidates`);assert.equal(accounting.residualTests,2,`${variant.id}/${expression}/residual retained`)}finally{statement.finalize()}}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} unary/CAST identity failures`);
});

test('single-source expression-index terms retain qualified alias bindings',async()=>{
 const sql='SELECT x.id FROM e AS x INDEXED BY e_expr WHERE lower(x.a)=?1 AND x.b+1=?2 ORDER BY x.id';const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  try{assert.deepEqual(await execute(db,sql,['alpha',5]),[[1n]],variant.id)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} qualified-alias expression failures`);
});

test('expression identity compares numeric literal values rather than token spelling',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare('SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+01=?2 ORDER BY id').statement;
  try{statement.bind(1,'alpha');statement.bind(2,5n);assert.deepEqual(await rows(statement),[[1n]],`${variant.id}/rows`);assert.equal(privateAccounting(statement).indexSeeks,1,`${variant.id}/two-field seek`);assert.equal(privateAccounting(statement).indexNext,1,`${variant.id}/one candidate`)}catch(error){failures.push(error)}finally{try{statement.finalize()}catch{}}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} numeric-literal identity failures`);
});

test('partial NOT NULL implication rejects OR when either arm permits NULL',async()=>{
 const predicates=['c>0 OR c IS NULL','c>0 OR a=1'];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const predicate of predicates)assert.throws(()=>db.prepare(`SELECT id,b FROM p INDEXED BY p_live WHERE a=1 AND (${predicate}) ORDER BY b`),error=>String(error?.message).includes('forced index is unusable'),`${variant.id}/${predicate}`);
 });
});

test('partial NOT NULL implication descends through query-side OR only when every arm proves it',async()=>{
 const sql='SELECT id,b FROM p INDEXED BY p_live WHERE a=1 AND (c>0 OR c<0) ORDER BY b';const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  try{assert.deepEqual(await execute(db,sql),[[1n,'x']],variant.id)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} query-side OR implication failures`);
});

test('partial NOT NULL implication admits represented non-null-producing operators',async()=>{
 const predicates=['c>0','c=1','c IN (1,2)','c BETWEEN 0 AND 2'];const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const predicate of predicates)try{assert.deepEqual(await execute(db,`SELECT id,b FROM p INDEXED BY p_live WHERE a=1 AND ${predicate} ORDER BY b`),[[1n,'x']],`${variant.id}/${predicate}`)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} NOT NULL implication failures`);
});

test('expression matching skips top-level COLLATE then applies physical collation gate',async()=>{
 const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const [collation,seeks] of [['BINARY',1],['NOCASE',0]])try{
   const statement=db.prepare(`SELECT id FROM e INDEXED BY e_expr WHERE lower(a) COLLATE ${collation}=?1 AND b+1=?2 ORDER BY id`).statement;
   try{statement.bind(1,'alpha');statement.bind(2,5n);assert.deepEqual(await rows(statement),[[1n]],`${variant.id}/${collation}/rows`);assert.equal(privateAccounting(statement).indexSeeks,seeks,`${variant.id}/${collation}/seeks`)}finally{statement.finalize()}
  }catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} expression COLLATE identity failures`);
});

test('partial implication follows source identity when SQL source order is reversed',async()=>{
 const sql='SELECT m.id,p.id FROM p INDEXED BY p_live JOIN m ON p.a=m.a AND p.c IS NOT NULL WHERE m.id=1 ORDER BY p.id';const failures=[];
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  try{assert.deepEqual(await execute(db,sql),[[1n,1n]],variant.id)}catch(error){failures.push(error)}
 });
 if(failures.length)throw new AggregateError(failures,`${failures.length} reversed-source partial implication failures`);
});

test('selected advanced-index work-limit failure is sticky and isolated in every encoding',async()=>{
 const sql='SELECT id FROM e INDEXED BY e_expr WHERE lower(a)=?1 AND b+1=?2 ORDER BY id';
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const statement=db.prepare(sql).statement;statement.bind(1,'alpha');statement.bind(2,5n);
  let failure;try{await statement.step({maxWorkUnits:1})}catch(error){failure=error}
  assert.equal(failure?.kind,'limit',`${variant.id}/limit kind`);
  assert.throws(()=>statement.reset(),error=>error===failure,`${variant.id}/sticky reset`);
  assert.doesNotThrow(()=>statement.finalize(),`${variant.id}/finalize releases after observed failure`);
  assert.deepEqual(await execute(db,sql,['alpha',5]),[[1n]],`${variant.id}/fresh statement after failure`);
 });
});

test('advanced-index lifecycle reset/rebind/finalize matches pinned rows in every encoding',async()=>{
 for(const variant of capture.variants){await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const c=variant.cases.find(c=>c.id==='wr-primary-exact'),statement=db.prepare(c.sql).statement;
  c.bindings.forEach((v,i)=>statement.bind(i+1,value(v)));assert.deepEqual(await rows(statement),expectedRows(variant.lifecycle.firstRows));
  statement.reset();statement.clearBindings();['beta',1].forEach((v,i)=>statement.bind(i+1,value(v)));assert.deepEqual(await rows(statement),expectedRows(variant.lifecycle.secondRows));
  statement.finalize();assert.throws(()=>statement.reset(),/final/i);
 })}
});

test('selected advanced-index corruption fails while off-path primary access remains isolated',async()=>{
 for(const variant of capture.variants)for(const corruption of variant.corruptions){await withBytes(fs.readFileSync(path.resolve(corruption.fixture.path)),async db=>{
  const overflow=corruption.pageKind==='overflow';
  const offPathSql=overflow?'SELECT b FROM p WHERE id=4':"SELECT payload FROM wr WHERE a='Alpha' AND b=1";
  const offPathBindings=[];
  assert.deepEqual(await execute(db,offPathSql,offPathBindings),expectedRows(corruption.offPathRows),`${variant.id}/${corruption.id}/off-path`);
  const selectedSql=overflow?"SELECT payload FROM ov INDEXED BY ov_k_payload WHERE k='needle'":"SELECT a,b FROM wr INDEXED BY wr_c WHERE c>=2.5";
  const statement=db.prepare(selectedSql).statement;let failure;try{await rows(statement)}catch(error){failure=error}finally{try{statement.finalize()}catch{}}
  assert.equal(failure?.kind,'sqlite',`${variant.id}/${corruption.id}/selected`);
  assert.deepEqual(await execute(db,offPathSql,offPathBindings),expectedRows(corruption.reuseRows),`${variant.id}/${corruption.id}/reuse`);
 })}
});
