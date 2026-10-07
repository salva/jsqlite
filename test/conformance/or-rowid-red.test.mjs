import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,wherePathSolver,btreeLoops,orArmClause,orRuntimeArmClause,ROWID_NEEDED} from '../../src/internal/where-plan.ts';
import {BtreeDatabase,btreeFromConnection} from '../../src/internal/btree.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
import {SelectProgramBuilder} from '../../src/internal/select-program.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function withDb(v,run,options,mutate){
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 if(mutate)mutate(bytes);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);await run(db)}finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
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
 test(`${v.id}: shared-builder multi-or opcodes`,async()=>withDb(v,async db=>{
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
  const builder=new SelectProgramBuilder();builder.reserveCursorsThrough(30);
  const parameters={maximum:0,names:[],named:new Map()};
  const initial=builder.wherePlanBudget.remaining;
  compileTableSelect(parsed,schema,database,Number.MAX_SAFE_INTEGER,undefined,undefined,undefined,{builder,parameters,destination:{kind:'output'}});
  assert.notEqual(builder.wherePlanBudget.remaining,initial,'planning and selected arm lowering consume the enclosing construction frontier');
  const after=builder.wherePlanBudget.remaining;
  compileTableSelect(parsed,schema,database,Number.MAX_SAFE_INTEGER,undefined,undefined,undefined,{builder,parameters,destination:{kind:'output'}});
  assert.equal(builder.wherePlanBudget.remaining-initial,2n*(after-initial),'shared caller never replaces the construction budget');

 }));
 for(const c of v.cases){
  test(`${v.id}/${c.id}: typed public rows, metadata, reset/rebind/clear${c.selectedRequired?' and selected work (red)':''}`,async()=>withDb(v,async db=>{
   if(c.error){assert.throws(()=>db.prepare(c.sql),e=>e.kind==='sqlite'&&e.code===c.error.code&&e.message===c.error.message);return}
   const st=db.prepare(c.sql).statement;
   try{
    for(let i=0;i<c.metadata.length;i++)assert.deepEqual(st.columnMetadata(i),c.metadata[i]);
    for(const [runOrdinal,run] of c.runs.entries()){
     st.reset();st.clearBindings();assert.deepEqual(run.bindingCells.map(c=>c.type),run.bindingTypes,'native executed binding storage classes');run.bindingCells.forEach((b,i)=>st.bind(i+1,decode(b)));
     const rows=[],types=[];
     while(await st.step(c.id==='inner-cover'?{maxWorkUnits:100000}:undefined)==='row'){rows.push(Array.from({length:st.columnCount},(_,i)=>{assert.equal(st.columnType(i),run.rows[rows.length]?.[i]?.type);return st.column(i)}));types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)))}
     assert.deepEqual(rows,run.rows.map(r=>r.map(decode)));
     assert.deepEqual(types,run.rows.map(r=>r.map(c=>c.type)));
     if(c.selectedRequired){
      const work=privateAccounting(st);
      // codeAllEqualityTerms skips seeks for NULL equality RHS. Branch
      // opens must still execute; do not mistake empty-key guards for scans.
      const nullEqualityRun=c.id==='rebind'&&run.bindingCells.every(c=>c.type==='null');
      assert.ok(nullEqualityRun?work.indexSeeks===0:c.id==='rowid-affinity'?work.indexSeeks===1:work.indexSeeks>=2,`persistent seeks: ${c.id} run ${runOrdinal}`);
      // The reset case deliberately advances its ordinary rowid outer range.
      assert.equal(work.tableNext,['inner-or-reset','correlated-or'].includes(c.id)?2:0,'only the ordinary outer rowid range may advance the table');
      // No new public diagnostics. This proposed private selected counter must
      // count executed branch opens including empty branches, reset per run.
      assert.ok(c.id==='rowid-affinity'?work.orBranchStarts===1:work.orBranchStarts>=2,'selected secondary-index arm execution provenance');
      if(['unready-residual','inner-cover','common-rowid','common-cover','overlap','empty','repeated-arm','rebind','nested-arm','inner-or','inner-or-reset','correlated-or','inner-in','inner-in-empty','inner-in-composite'].includes(c.id)){const schema=loadSchemaGraph(db),table=schema.findTable('o');const names=['inner-cover','common-rowid','common-cover'].includes(c.id)?['oa','oa']:c.id==='repeated-arm'?['oa','ob','oa']:c.id==='inner-in-composite'?['oa','ob']:c.id==='nested-arm'?['oa','ob','oc']:['inner-or-reset','correlated-or'].includes(c.id)?['oa','ob','oa','ob']:['oa','ob'];assert.equal(work.orBranchStarts,names.length);assert.deepEqual(work.orBranchRoots,names.map(name=>table.indexes.find(index=>index.name===name).rootPage),'complete executed branch roots including repeated/empty arms')}
      if(c.id==='overlap')assert.ok(work.orDuplicateSkips>=1,'cross-branch overlap deduplicated by RowSetTest');
      if(c.sql.includes('ORDER BY')&&run.rows.length)assert.ok(work.sorterRows>=run.rows.length,'OR makes no physical ORDER proof');
     }
    }
    if(c.id==='rebind'){assert.equal(c.runs[3].bindingTypes[0],'real');assert.equal(c.runs[4].bindingTypes[0],'integer');assert.deepEqual(c.runs[3].rows,c.runs[4].rows,'NUMERIC index affinity preserves rows but not binding storage class')}
    // clearBindings must not preserve the previous branch keys.
    if(c.id==='rebind'){st.reset();st.clearBindings();assert.equal(await st.step(),'done')}
   }finally{st.finalize()}
  }));
 }
}

// Parenthesized AND arm prevents associative OR flattening. The selected
// parent must recursively consume its owned arm plan, not scan that arm.
for(const v of capture.variants){
 test(`${v.id}: nested selected OR arm consumes recursive physical continuation`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='nested-arm'),sql=captured.sql;
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
  const selection=planWhere(resolved,{neededColumns:[new Set([...resolved.sources[0].table.columns,ROWID_NEEDED])],orderBy:[]});
  assert.equal(selection.path?.loops[0].kind,'multi-or');
  const program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const tests=program.ops.filter(op=>op.code==='RowSetTest');
  const registers=[...new Set(tests.map(op=>op.p1))];
  assert.equal(registers.length,2,'nested and parent own independent RowSets');
  for(const register of registers)assert.deepEqual(tests.filter(op=>op.p1===register).map(op=>op.p4),[0,-1]);
  const returns=program.ops.filter(op=>op.code==='Return');
  assert.equal(returns.length,2);assert.notEqual(returns[0].p1,returns[1].p1,'exact PC ownership per level');
  const statement=db.prepare(sql).statement;
  try{
   const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));
   const expected=captured.runs[0].rows.map(row=>row.map(decode));
   assert.deepEqual(rows,expected);
   const accounting=privateAccounting(statement);
   const roots=['oa','ob','oc'].map(name=>resolved.sources[0].table.indexes.find(i=>i.name===name).rootPage);
   assert.deepEqual(accounting.orBranchRoots,roots,'owned nested arm must open oa/ob before outer oc');
   assert.equal(accounting.tableNext,0,'nested selected arm must not fall back to table scan');
  }finally{statement.finalize()}
 }));
}

for(const v of capture.variants){
 test(`${v.id}: represented inner caller consumes selected OR plan`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='inner-or'),sql=captured.sql;
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
  const chosen=planWhere(resolved,{neededColumns:resolved.sources.map(source=>new Set([...source.table.columns,ROWID_NEEDED])),orderBy:[]});
  assert.equal(chosen.path.loops.find(loop=>loop.sourceOrdinal===1)?.kind,'multi-or','inner source actually selected');
  const st=db.prepare(sql).statement;
  try{
   const rows=[];while(await st.step()==='row')rows.push(st.column(0));
   assert.deepEqual(rows,captured.runs[0].rows.map(row=>decode(row[0])));
   const roots=['oa','ob'].map(name=>resolved.sources[1].table.indexes.find(index=>index.name===name).rootPage);
   assert.deepEqual(privateAccounting(st).orBranchRoots,roots,'inner selected plan must open both actual arms');
   assert.equal(privateAccounting(st).tableNext,0,'rowid outer and selected inner do not scan');
  }finally{st.finalize()}
 }));
}

for(const v of capture.variants){
 test(`${v.id}: correlated selected OR arm retains ready outer prerequisite`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='correlated-or'),sql=captured.sql;
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
  const chosen=planWhere(resolved,{neededColumns:resolved.sources.map(source=>new Set([...source.table.columns,ROWID_NEEDED])),orderBy:[]});
  assert.equal(chosen.path.loops.find(loop=>loop.sourceOrdinal===1)?.kind,'multi-or');
  const parent=chosen.path.loops.find(loop=>loop.sourceOrdinal===1);
  const arm=parent.orInfo.clause.terms.find(term=>!term.virtual);
  const clause=orArmClause(arm,1,chosen.analysis.clause);
  const candidates=btreeLoops(parent.source,1,clause,{forcedIndex:null,neededColumns:new Set([...parent.source.table.columns,ROWID_NEEDED]),orderBy:[],resolved});
  const readyPlan=wherePathSolver([candidates],1,undefined,0,1,null,1n);
  assert.equal(readyPlan.loops[0].capability?.physicalIndex?.index.name,'oa');
  assert.equal(readyPlan.ready,3n);
  const cold=wherePathSolver([candidates],1);
  assert.ok(cold.loops.every(loop=>(loop.prereq&1n)===0n),'unpositioned outer prerequisite remains forbidden');
  const st=db.prepare(sql).statement;
  try{
   const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1)]);
   assert.deepEqual(rows,captured.runs[0].rows.map(row=>row.map(decode)));
   const roots=['oa','ob','oa','ob'].map(name=>resolved.sources[1].table.indexes.find(index=>index.name===name).rootPage);
   assert.deepEqual(privateAccounting(st).orBranchRoots,roots,'correlated arm must seek its selected persistent index');
  }finally{st.finalize()}
 }));
}

for(const v of capture.variants){
 test(`${v.id}: represented inner selected OR executes IN arm restarts`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='inner-in'),sql=captured.sql;
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
  const chosen=planWhere(resolved,{neededColumns:resolved.sources.map(source=>new Set([...source.table.columns,ROWID_NEEDED])),orderBy:[]});
  assert.equal(chosen.path.loops.find(loop=>loop.sourceOrdinal===1)?.kind,'multi-or');
  const composite=v.cases.find(c=>c.id==='inner-in-composite');
  const program=compileTableSelect(parseSql(composite.sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.equal(program.ops.filter(op=>op.code==='InListValue').length,2,'both composite IN prefix fields own iterators');
  const st=db.prepare(sql).statement;
  try{
   const rows=[];while(await st.step()==='row')rows.push(st.column(0));
   assert.deepEqual(rows,captured.runs[0].rows.map(row=>decode(row[0])));
   const roots=['oa','ob'].map(name=>resolved.sources[1].table.indexes.find(index=>index.name===name).rootPage);
   assert.deepEqual(privateAccounting(st).orBranchRoots,roots,'selected IN arm must execute its persistent access');
  }finally{st.finalize()}
 }));
}

for(const v of capture.variants){
 test(`${v.id}: streaming composite IN OR reset interrupts live arm continuation`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='inner-in-composite');assert.ok(captured);
  const sql=captured.sql.replace(/ ORDER BY i\.id$/,'');assert.notEqual(sql,captured.sql);
  const expected=captured.runs[0].rows.map(row=>decode(row[0])).sort((a,b)=>a<b?-1:a>b?1:0);
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
  const program=compileTableSelect(parseSql(sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(!program.ops.some(op=>op.code==='SorterOpen'),'public yield must not be buffered by ORDER sorter');
  assert.equal(program.ops.filter(op=>op.code==='InListValue').length,2);
  const roots=['oa','ob'].map(name=>resolved.sources[1].table.indexes.find(index=>index.name===name).rootPage);
  const st=db.prepare(sql).statement;
  try{
   for(let cycle=0;cycle<3;cycle++){
    assert.equal(await st.step(),'row');
    assert.ok(expected.includes(st.column(0)));
    assert.deepEqual(privateAccounting(st).orBranchRoots,[roots[0]],'second branch has not run at first live-arm yield');
    st.reset();
    const rows=[];while(await st.step()==='row')rows.push(st.column(0));
    rows.sort((a,b)=>a<b?-1:a>b?1:0);
    assert.deepEqual(rows,expected,'unordered variant preserves pinned ordered query multiset including duplicate counts');
    assert.deepEqual(privateAccounting(st).orBranchRoots,roots);
    st.reset();
   }
  }finally{st.finalize()}
 }));
}
for(const v of capture.variants){
 test(`${v.id}: composite IN OR early reset rebuilds inside-out arm iterators`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='inner-in-composite');assert.ok(captured);
  const expected=captured.runs[0].rows.map(row=>row.map(decode));assert.ok(expected.length>0);
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(captured.sql).statement,schema);
  const program=compileTableSelect(parseSql(captured.sql).statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.equal(program.ops.filter(op=>op.code==='InListValue').length,2);
  const roots=['oa','ob'].map(name=>resolved.sources[1].table.indexes.find(index=>index.name===name).rootPage);
  const st=db.prepare(captured.sql).statement;
  try{
   // Interrupt the public result sequence and reconstruct composite arm
   // state. ORDER sorting may have already exhausted physical iterators:
   // this is restart coverage, not proof of suspension inside an IN step.
   for(const prefix of [...new Set([1,Math.min(2,expected.length)])]){
    for(let i=0;i<prefix;i++){
     assert.equal(await st.step(),'row');
     assert.deepEqual(expected[i].map((_,column)=>st.column(column)),expected[i]);
    }
    st.reset();
    const rows=[];while(await st.step()==='row')rows.push(expected[0].map((_,column)=>st.column(column)));
    assert.deepEqual(rows,expected,'both IN positions and RowSet batch restart after early reset');
    assert.deepEqual(privateAccounting(st).orBranchRoots,roots,'full selected branch sequence after reset');
    st.reset();
   }
  }finally{st.finalize()}
 }));
}
for(const v of capture.variants){
 test(`${v.id}: correlated OR early reset reconstructs enclosing and shared-body continuations`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='correlated-or');assert.ok(captured);
  const expected=captured.runs[0].rows.map(row=>row.map(decode));assert.ok(expected.length>1);
  const st=db.prepare(captured.sql).statement;
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parseSql(captured.sql).statement,schema);
  const roots=['oa','ob','oa','ob'].map(name=>resolved.sources[1].table.indexes.find(index=>index.name===name).rootPage);
  try{
   // Halt between shared-body yields instead of completing whereEnd. Reset
   // must destroy old RowSet/return state and restart the enclosing loop.
   for(const prefix of [1,2,1]){
    for(let i=0;i<prefix;i++){
     assert.equal(await st.step(),'row');
     assert.deepEqual(expected[i].map((_,column)=>st.column(column)),expected[i]);
    }
    st.reset();
    const rows=[];while(await st.step()==='row')rows.push(expected[0].map((_,column)=>st.column(column)));
    assert.deepEqual(rows,expected,'no stale RowSet suppresses first outer iteration after reset');
    assert.deepEqual(privateAccounting(st).orBranchRoots,roots,'complete repeated enclosing-loop root sequence after reset');
    st.reset();
   }
  }finally{st.finalize()}
 }));
}
// wherecode.c Case 5 tag-20220303a: factored subqueries must not
// become arm index constraints; their common-body truth remains required.
for(const v of capture.variants){
 test(`${v.id}: OR runtime arm replanning excludes subquery residual from factored access`,async()=>withDb(v,async db=>{
  const schema=loadSchemaGraph(db);
  const sql="SELECT id FROM o WHERE (a=1 OR b='beta') AND c=(SELECT 5) ORDER BY id";
  const resolved=expandAndResolveSelect(parseSql(sql).statement,schema);
  const chosen=planWhere(resolved,{neededColumns:[new Set([...resolved.sources[0].table.columns,ROWID_NEEDED])],orderBy:[]});
  // This SQL need not select OR; validate the owned arm construction itself.
  const parent=chosen.analysis.clause.terms.find(term=>term.info?.kind==='or');assert.ok(parent);
  const arm=parent.info.clause.terms.find(term=>term.left?.column?.name==='a');assert.ok(arm);
  const clause=orRuntimeArmClause(arm,0,chosen.analysis.clause);
  const candidates=btreeLoops(resolved.sources[0],0,clause,{forcedIndex:null,neededColumns:new Set([...resolved.sources[0].table.columns,ROWID_NEEDED]),orderBy:[],resolved});
  const index=candidates.find(loop=>loop.kind==='index'&&loop.capability.physicalIndex.index.name==='oa');assert.ok(index);
  assert.equal(index.capability.equalitySlots.length,1,'EP_Subquery residual must not be factored into composite access');
  assert.equal(clause.outer.outer,null,'factored scope must not retain unsafe pOuter');
  const plain=expandAndResolveSelect(parseSql("SELECT id FROM o WHERE ((a=1 AND c>3) OR b='beta') AND c<7").statement,schema);
  const analysis=planWhere(plain,{neededColumns:[new Set([...plain.sources[0].table.columns,ROWID_NEEDED])],orderBy:[]}).analysis;
  const or=analysis.clause.terms.find(term=>term.info?.kind==='or');
  const andArm=or.info.clause.terms.find(term=>term.info?.kind==='and');
  const scope=orRuntimeArmClause(andArm,0,analysis.clause);
  assert.deepEqual(scope.terms,andArm.info.clause.terms,'AND arm retains original owned terms');
  assert.ok(scope.outer.terms.some(term=>term.operator==='lt'),'usable factored range retained');
  assert.ok(scope.outer.terms.every(term=>!term.virtual&&!term.outerOn&&term.operator!==null));
  const excluded=orRuntimeArmClause({...andArm,outerOn:true},0,analysis.clause);
  assert.equal(excluded.outer.terms.length,0,'LEFT ON parent must not factor enclosing predicates');
  const polluted={...analysis.clause,terms:analysis.clause.terms.map(term=>term.operator==='lt'?{...term,virtual:true}:term)};
  assert.ok(!orRuntimeArmClause(andArm,0,polluted).outer.terms.some(term=>term.operator==='lt'),'virtual enclosing term excluded');

 }));
}

// wherecode.c Case5 pCov tracks one physical index through every selected arm.
for(const v of capture.variants){
 test(`${v.id}: selected same-index OR retains common covering cursor`,async()=>withDb(v,async db=>{
  const sql='SELECT a,c FROM o WHERE (a=1 AND c<5) OR (a=2 AND c>4) ORDER BY a,c';
  const schema=loadSchemaGraph(db),parsed=parseSql(sql).statement,resolved=expandAndResolveSelect(parsed,schema);
  const table=resolved.sources[0].table;
  const chosen=planWhere(resolved,{neededColumns:[new Set(table.columns.filter(column=>['a','c'].includes(column.name)))],orderBy:[]});
  assert.equal(chosen.path.loops[0].kind,'multi-or','test requires selected parent');
  const program=compileTableSelect(parsed,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const opens=program.ops.filter(op=>op.code==='OpenIndex');
  assert.equal(opens.length,2);assert.ok(opens.every(op=>op.physical===table.indexes.find(index=>index.name==='oa').physical));
  assert.equal(new Set(opens.map(op=>op.p2)).size,1,'pCov/iCovCur: same selected physical index shares covering cursor');
  assert.ok(program.ops.some(op=>op.code==='Column'&&op.p3===opens[0].p2),'common covered columns must read the retained index');
  const body=program.ops.findIndex(op=>op.code==='Return');
  assert.ok(!program.ops.slice(0,body).some(op=>op.code==='IfNot'&&op.residual),'exact selected equality/range constraints are consumed before common body');
  const mixed=compileTableSelect(parseSql("SELECT a,c FROM o WHERE a=1 OR b='beta' ORDER BY a,c").statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const mixedCursor=mixed.ops.find(op=>op.code==='OpenIndex').p2;
  const lastBranch=Math.max(...mixed.ops.map((op,i)=>op.code==='OpenIndex'?i:-1));
  assert.ok(!mixed.ops.slice(lastBranch).some(op=>op.code==='Column'&&op.p3===mixedCursor),'different indexes cannot leak covering state');

 }));
}

// where.c WhereEnd OP_Rowid -> OP_IdxRowid consumes Case5 pCoveringIdx.
for(const v of capture.variants){
 test(`${v.id}: selected same-index OR common rowid uses index tail`,async()=>withDb(v,async db=>{
  const parsed=parseSql('SELECT rowid,a,c FROM o WHERE (a=1 AND c<5) OR (a=2 AND c>4) ORDER BY rowid').statement;
  const schema=loadSchemaGraph(db),resolved=expandAndResolveSelect(parsed,schema),table=resolved.sources[0].table;
  const selected=planWhere(resolved,{neededColumns:[new Set(table.columns)],orderBy:[]});
  assert.equal(selected.path.loops[0].kind,'multi-or');
  const program=compileTableSelect(parsed,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const opens=program.ops.filter(op=>op.code==='OpenIndex');
  assert.equal(opens.length,2);assert.ok(opens.every(op=>op.physical===table.indexes.find(index=>index.name==='oa').physical));
  const bodyStart=program.ops.filter(op=>op.code==='Gosub').at(-1).p2;
  const bodyEnd=program.ops.findIndex((op,i)=>i>=bodyStart&&op.code==='Return');
  const body=program.ops.slice(bodyStart,bodyEnd);
  assert.ok(body.some(op=>(op.code==='Rowid'&&op.p1===opens[0].p2)||
    (op.code==='Column'&&op.p3===opens[0].p2&&opens[0].physical.fields[op.p1]?.role==='rowid-tail')),
    'common rowid must consume retained physical index tail, not table cursor');
  assert.ok(!body.some(op=>op.code==='Rowid'&&(op.p1??0)===0),'common-body table rowid is rewritten');
  const mixed=compileTableSelect(parseSql("SELECT rowid,a FROM o WHERE a=1 OR b='beta' ORDER BY rowid").statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const mixedStart=mixed.ops.filter(op=>op.code==='Gosub').at(-1).p2;
  assert.ok(mixed.ops.slice(mixedStart).some(op=>op.code==='Rowid'&&(op.p1??0)===0),'mixed-index body keeps table rowid');
 }));
}

// Case5 publishes pCov to WhereEnd at the represented inner-loop level too.
for(const v of capture.variants){
 test(`${v.id}: represented inner common covering consumes retained cursor`,async()=>withDb(v,async db=>{
  const parsed=parseSql('SELECT i.rowid,i.a,i.c FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id=1 AND ((i.a=1 AND i.c<5) OR (i.a=2 AND i.c>4)) ORDER BY i.rowid').statement;
  const schema=loadSchemaGraph(db),table=schema.findTable('o');
  const program=compileTableSelect(parsed,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const calls=program.ops.filter(op=>op.code==='Gosub');
  assert.equal(calls.length,2,'requires actual selected inner OR continuation');
  const opens=program.ops.filter(op=>op.code==='OpenIndex'&&op.orBranch);
  assert.equal(opens.length,2);assert.ok(opens.every(op=>op.physical===table.indexes.find(index=>index.name==='oa').physical));
  assert.equal(opens[0].p2,opens[1].p2,'common index cursor retained across arms');
  for(const op of program.ops.filter(op=>op.code==='IndexRangeEnd'))assert.ok(op.p2>0&&program.ops[op.p2]?.code==='OpenIndex','range end patches actual branch continuation, not bound producer');
  const bodyStart=calls[0].p2,bodyEnd=program.ops.findIndex((op,i)=>i>=bodyStart&&op.code==='Return');
  assert.ok(bodyEnd>bodyStart);
  const body=program.ops.slice(bodyStart,bodyEnd);
  assert.ok(body.some(op=>op.code==='Column'&&op.p3===opens[0].p2),'inner common columns must consume retained index');
  assert.ok(body.some(op=>op.code==='Rowid'&&op.p1===opens[0].p2),'inner common rowid must consume retained index');
  const mixed=compileTableSelect(parseSql("SELECT i.rowid,i.a FROM o AS outerrow CROSS JOIN o AS i WHERE outerrow.id=1 AND (i.a=1 OR i.b='beta') ORDER BY i.rowid").statement,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const mixedStart=mixed.ops.filter(op=>op.code==='Gosub')[0].p2;
  const indexCursor=mixed.ops.find(op=>op.code==='OpenIndex'&&op.orBranch).p2;
  assert.ok(!mixed.ops.slice(mixedStart).some(op=>op.code==='Column'&&op.p3===indexCursor),'different inner indexes invalidate covering');

 }));
}

// wherecode.c OR_SUBCLAUSE leaves notReady AND terms untested, so the
// enclosing OR remains live until the downstream source has a position.
for(const v of capture.variants){
 test(`${v.id}: selected OR unready residual ownership`,async()=>withDb(v,async db=>{
  const captured=v.cases.find(c=>c.id==='unready-residual');
  const schema=loadSchemaGraph(db),parsed=parseSql(captured.sql).statement;
  const resolved=expandAndResolveSelect(parsed,schema);
  const selected=planWhere(resolved,{neededColumns:resolved.sources.map(source=>new Set([...source.table.columns,ROWID_NEEDED])),orderBy:[]});
  assert.equal(selected.path.loops[0].kind,'multi-or','test must exercise selected outer OR');
  const program=compileTableSelect(parsed,schema,btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const calls=program.ops.filter(op=>op.code==='Gosub');assert.equal(calls.length,2);
  const body=calls[0].p2;
  const laterOpen=program.ops.find(op=>op.code==='OpenRead'&&op.p2===1);
  assert.ok(laterOpen);
  assert.ok(!program.ops.slice(0,body).some(op=>op.code==='Column'&&op.p3===1),'notReady later cursor cannot be read by an arm before downstream positioning');
  const end=program.ops.findIndex((op,i)=>i>=body&&op.code==='Return');
  assert.ok(program.ops.slice(body,end).some(op=>op.code==='Binary'&&op.op==='OR'),'full parent OR remains in downstream body');
  assert.equal(program.ops.slice(0,body).filter(op=>op.code==='IfNot'&&op.residual).length,0,'ready exact access constraints consumed; full unready parent retained downstream');
  const st=db.prepare(captured.sql).statement;
  try{
   const rows=[];while(await st.step({maxWorkUnits:100000})==='row')rows.push([st.column(0),st.column(1)]);
   assert.deepEqual(rows,captured.runs[0].rows.map(row=>row.map(decode)));
  }finally{st.finalize();}
 }));
}


// Public control/error ownership on actual selected OR (not synthetic VM rows).
for(const v of capture.variants){
 test(`${v.id}: selected OR lifecycle control and primary cleanup`,async()=>withDb(v,async db=>{
  const sql="SELECT id,p,r FROM o WHERE a=1 OR b='beta'";
  for(const mode of ['cancel','deadline','work']){
   const st=db.prepare(sql).statement;
   assert.equal(await st.step(),'row');
   assert.equal(privateAccounting(st).orBranchStarts,1,'first selected branch active before control change');
   const abort=new AbortController();abort.abort('OR control');
   const options=mode==='cancel'?{signal:abort.signal}:mode==='deadline'?{timeoutMs:0}:{maxWorkUnits:1};
   const first=await st.step(options).then(()=>null,e=>e);
   assert.equal(first?.kind,{cancel:'cancelled',deadline:'timeout',work:'limit'}[mode]);
   await assert.rejects(st.step(),e=>e===first,'saved primary error wins');
   assert.throws(()=>st.reset(),e=>e===first,'reset reports primary while cleaning');
   const rows=[];while(await st.step()==='row')rows.push(st.column(0));
   assert.deepEqual(rows.sort((a,b)=>Number(a-b)),[1n,2n,3n]);
   st.reset();assert.equal(await st.step(),'row');
   const finalError=await st.step(options).then(()=>null,e=>e);assert.equal(finalError?.kind,first.kind);
   assert.throws(()=>st.finalize(),e=>e===finalError,'finalize keeps primary and releases statement');
  }
  const other=db.prepare('SELECT 1').statement;assert.equal(await other.step(),'row');other.finalize();
 }));
 test(`${v.id}: selected OR private byte limit cleanup`,async()=>withDb(v,async db=>{
  const st=db.prepare("SELECT id FROM o WHERE a=1 OR b='beta'").statement;
  const first=await st.step().then(()=>null,e=>e);assert.equal(first?.kind,'limit');
  assert.equal(privateAccounting(st).orBranchStarts,1,'selected branch entered before allocation failure');
  await assert.rejects(st.step(),e=>e===first);assert.throws(()=>st.reset(),e=>e===first);
  const second=await st.step().then(()=>null,e=>e);assert.equal(second?.kind,'limit');
  assert.throws(()=>st.finalize(),e=>e===second);
  const plain=db.prepare('SELECT 1').statement;assert.equal(await plain.step(),'row');plain.finalize();
 },{limits:{maxPrivateBytes:64}}));
}


for(const v of capture.variants){
 test(`${v.id}: selected OR REAL re-expansion and owned blob liveness`,async()=>withDb(v,async db=>{
  const st=db.prepare("SELECT id,r,p FROM o WHERE a=1 OR b='beta'").statement,held=[];
  try{
   while(await st.step()==='row'){
    const id=st.column(0);assert.equal(st.columnType(1),'real');
    assert.equal(st.column(1),new Map([[1n,1],[2n,2.25],[3n,3]]).get(id));
    const blob=st.columnBlob(2);held.push([id,blob]);
    assert.equal(st.columnType(2),'blob');
   }
   assert.equal(privateAccounting(st).orBranchStarts,2);
   assert.deepEqual(privateAccounting(st).orBranchRoots,['oa','ob'].map(n=>loadSchemaGraph(db).findTable('o').indexes.find(i=>i.name===n).rootPage));
   st.reset();assert.equal(await st.step(),'row');
  }finally{st.finalize()}
  for(const [id,blob] of held)assert.deepEqual([...blob],new Map([[1n,[0,255]],[2n,[]],[3n,[1,2]]]).get(id),'owned public blob survives arm movement/reset/finalize');
 }));
 test(`${v.id}: selected OR rowid affinity with owned original binding`,async()=>withDb(v,async db=>{
  const sql="SELECT id FROM o WHERE rowid=?1 OR b='beta'";
  const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(program.ops.some(op=>op.code==='RowSetTest'),'actual selected union not ordinary scan');
  assert.ok(program.ops.some(op=>op.code==='SeekRowid'),'rowid arm uses owning seek');
  const st=db.prepare(sql).statement;
  try{
   for(const [binding,expected] of [['1',[1n,2n,3n]],['1.5',[2n,3n]],[1,[1n,2n,3n]],[1n,[1n,2n,3n]],[null,[2n,3n]]]){
    st.bind(1,binding);const rows=[];while(await st.step()==='row')rows.push(st.column(0));
    assert.deepEqual(rows.sort((a,b)=>Number(a-b)),expected);
    assert.equal(privateAccounting(st).orBranchStarts,1,'counter counts secondary OpenIndex arms, not rowid seeks');st.reset();st.clearBindings();
   }
  }finally{st.finalize()}
 }));
}


for(const v of capture.variants){
 test(`${v.id}: selected OR timer cancellation during suspended execution`,async()=>withDb(v,async db=>{
  const st=db.prepare("SELECT hex(zeroblob(1048576)) FROM o WHERE a=1 OR b='beta'").statement;
  const abort=new AbortController();let fired=false;
  const timer=setTimeout(()=>{fired=true;abort.abort('host timer')},0);
  try{
   const primary=await st.step({signal:abort.signal}).then(()=>null,e=>e);
   assert.equal(fired,true);assert.equal(primary?.kind,'cancelled');
   assert.equal(privateAccounting(st).orBranchStarts,1,'selected branch active before host cancellation');
   await assert.rejects(st.step(),e=>e===primary);assert.throws(()=>st.reset(),e=>e===primary);
   const deadline=await st.step({timeoutMs:20}).then(()=>null,e=>e);
   assert.equal(deadline?.kind,'timeout');
   assert.equal(privateAccounting(st).orBranchStarts,1,'deadline reached after selected branch entry');
   assert.throws(()=>st.reset(),e=>e===deadline);
   const work=await st.step({maxWorkUnits:100}).then(()=>null,e=>e);assert.equal(work?.kind,'limit');
   assert.throws(()=>st.reset(),e=>e===work);
  }finally{clearTimeout(timer);st.finalize()}
 }));
}


for(const v of capture.variants){
 test(`${v.id}: selected versus offpath index page corruption`,async()=>{
  let roots,pageSize;
  await withDb(v,async db=>{
   const table=loadSchemaGraph(db).findTable('o');roots=Object.fromEntries(table.indexes.map(i=>[i.name,i.rootPage]));pageSize=btreeFromConnection(db).pageSize;
  });
  // Corrupt a physical header only, leaving schema/other roots unchanged.
  for(const name of ['oc','ob'])await withDb(v,async db=>{
   const st=db.prepare("SELECT id FROM o WHERE a=1 OR b='beta' ORDER BY id").statement;
   try{
    if(name==='oc'){
     const rows=[];while(await st.step()==='row')rows.push(st.column(0));assert.deepEqual(rows,[1n,2n,3n]);
     assert.deepEqual(privateAccounting(st).orBranchRoots,[roots.oa,roots.ob]);
    }else{
     const primary=await st.step().then(()=>null,e=>e);assert.equal(primary?.kind,'sqlite');assert.equal(primary.code,11);
     assert.deepEqual(privateAccounting(st).orBranchRoots,[roots.oa,roots.ob],'second selected arm reached before corruption');
     await assert.rejects(st.step(),e=>e===primary);assert.throws(()=>st.reset(),e=>e===primary);
     const again=await st.step().then(()=>null,e=>e);assert.equal(again?.code,11);assert.throws(()=>st.reset(),e=>e===again);
    }
   }finally{st.finalize()}
  },undefined,bytes=>{bytes[(roots[name]-1)*pageSize]=0});
 });
}

const movement=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/movement-native.json',import.meta.url)));
for(const v of movement.variants){
 test(`${v.id}: selected OR multi-page movement is page local`,async()=>withDb(v,async db=>{
  const database=btreeFromConnection(db),table=loadSchemaGraph(db).findTable('o'),rootA=table.indexes.find(i=>i.name==='oa').rootPage,rootB=table.indexes.find(i=>i.name==='ob').rootPage;
  assert.equal(database.page(rootA,[2,10]).type,2,'multi-page interior oa root');
  assert.equal(database.page(rootB,[2,10]).type,2,'multi-page interior ob root');
  const original=BtreeDatabase.prototype.page,reads=[];
  BtreeDatabase.prototype.page=function(pgno,allowed){reads.push(pgno);return original.call(this,pgno,allowed)};
  const c=v.cases[0];
  const st=db.prepare(c.sql).statement;
  try{
   const rows=[];while(await st.step()==='row')rows.push(Array.from({length:3},(_,i)=>({value:st.column(i),type:st.columnType(i)})));
   assert.deepEqual(rows,c.runs[0].rows.map(row=>row.map(cell=>({value:decode(cell),type:cell.type}))));
   const work=privateAccounting(st);assert.deepEqual(work.orBranchRoots,[rootA,rootB]);assert.equal(work.tableNext,0);
   assert.ok(work.indexNext>1000);assert.ok(new Set(reads).size>10,'crosses multiple physical pages');
   // More than one positioned read per next is possible, but re-materializing
   // the full union/tree for every movement is not. Bound derives from dataset
   // and seek path height; preserve exact work diagnostics in evidence.
   assert.ok(reads.length<work.indexNext*20+100,'page reads proportional to movement, not eager whole-index rematerialization');
   st.reset();const rerun=[];while(await st.step()==='row')rerun.push(st.column(0));assert.deepEqual(rerun,c.runs[0].rows.map(row=>decode(row[0])));
  }finally{st.finalize();BtreeDatabase.prototype.page=original}
 }));
}

// Pinned Case5 omission probe: native non-deterministic random override returns
// zero, counts four arm invocations (verification evidence); no public hooks.
for(const v of capture.variants){
 test(`${v.id}/selected OR tested-parent omission preserves volatile call ownership`,async()=>withDb(v,async db=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');let calls=0;
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(bytes){calls++;bytes.fill(0);return bytes;}}});
  const st=db.prepare("SELECT id FROM o WHERE (a=1 AND random()=0) OR (b='beta' AND random()=0) ORDER BY id").statement;
  try{
   for(let repeat=0;repeat<2;repeat++){
    calls=0;const rows=[];while(await st.step()==='row')rows.push(st.column(0));
    assert.deepEqual(rows,[1n,2n,3n]);assert.equal(calls,4,'tested OR parent must not evaluate the arms again');
    assert.equal(privateAccounting(st).orBranchStarts,2);assert.equal(privateAccounting(st).orDuplicateSkips,1);st.reset();
   }
  }finally{st.finalize();if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto;}
 }));
}

// Native capture includes first-row, empty, sorted and correlated prepared callers.
const scalarNative=JSON.parse(fs.readFileSync('docs/research/card-s-f-or/scalar-native.json'));
for(const v of capture.variants){
 test(`${v.id}: prepared scalar selected OR owns seeks and first-row destination`,async()=>withDb(v,async db=>{
  const cases=scalarNative.variants.find(x=>x.id===v.id).cases;
  for(const c of cases){
   const st=db.prepare(c.sql).statement;
   try{
    for(let run=0;run<2;run++){
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{assert.equal(st.columnType(i),c.result[0][rows.length]?.[i]?.type);return st.column(i)}));
     assert.deepEqual(rows,c.result[0].map(row=>row.map(decode)));
     for(const row of c.result[0])assert.ok(row.every(cell=>['integer','null'].includes(cell.type)));
     const work=privateAccounting(st);
     assert.ok(work.orBranchStarts>0,'actual selected child branches, not root-only planning');
     assert.ok(work.indexSeeks>0);
     if(c.sql.includes('ORDER BY'))assert.ok(work.sorterRows>0||rows[0]?.[0]?.type==='null');
     st.reset();
    }
   }finally{st.finalize();}
  }
 }));
}

// Native Case3 addrBrk must exit only this join level, including an outer OR body.
for(const v of capture.variants)test(`${v.id}: joined rowid end owns level continuation 0`,async()=>withDb(v,async db=>{
 const st=db.prepare("SELECT x.id,y.id FROM o x CROSS JOIN o y WHERE (x.a=1 OR x.b='beta') AND x.id<=2 AND y.rowid<=2 ORDER BY x.id,y.id").statement;const rows=[];
 try{while(await st.step()==='row'){assert.equal(st.columnType(0),'integer');assert.equal(st.columnType(1),'integer');rows.push([st.column(0),st.column(1)])}assert.deepEqual(rows,[[1n,1n],[1n,2n],[2n,1n],[2n,2n]])}finally{st.finalize()}
}));
for(const v of capture.variants)test(`${v.id}: joined rowid end owns level continuation 1`,async()=>withDb(v,async db=>{
 const st=db.prepare("SELECT x.id,y.id FROM o x CROSS JOIN o y WHERE x.id<=2 AND y.rowid<=2 ORDER BY x.id,y.id").statement;const rows=[];
 try{while(await st.step()==='row'){assert.equal(st.columnType(0),'integer');assert.equal(st.columnType(1),'integer');rows.push([st.column(0),st.column(1)])}assert.deepEqual(rows,[[1n,1n],[1n,2n],[2n,1n],[2n,2n]])}finally{st.finalize()}
}));
for(const v of capture.variants)test(`${v.id}: joined rowid end owns level continuation 2`,async()=>withDb(v,async db=>{
 const st=db.prepare("SELECT x.id,y.id FROM o x CROSS JOIN o y WHERE x.id<=2 AND (y.a=1 OR y.b='beta') AND y.rowid<=2 ORDER BY x.id,y.id").statement;const rows=[];
 try{while(await st.step()==='row'){assert.equal(st.columnType(0),'integer');assert.equal(st.columnType(1),'integer');rows.push([st.column(0),st.column(1)])}assert.deepEqual(rows,[[1n,1n],[1n,2n],[2n,1n],[2n,2n]])}finally{st.finalize()}
}));

const joinEndNative=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/join-end-native.json',import.meta.url)));
for(const native of joinEndNative.variants)for(const c of native.cases)test(`${native.id}: joined end native ${c.id}`,async()=>withDb(capture.variants.find(v=>v.id===native.id),async db=>{
 const st=db.prepare(c.sql).statement,rows=[];
 try{while(await st.step()==='row'){rows.push(Array.from({length:st.columnCount},(_,i)=>({type:st.columnType(i),value:st.column(i)})))}
 assert.deepEqual(rows,c.rows.map(row=>row.map(cell=>({type:cell.type,value:cell.type==='null'?null:BigInt(cell.value)}))));}finally{st.finalize()}
}));
