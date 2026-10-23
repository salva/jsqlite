import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {Stat4Probe} from '../../src/internal/stat4-probe.ts';
import {whereKeyStats} from '../../src/internal/stat4-estimate.ts';
const dir='docs/research/card-s-h/';
const captures=JSON.parse(fs.readFileSync(dir+'c-red/keystats-native.json','utf8'));
for(const enc of ['UTF-8','UTF-16le','UTF-16be'])test(`${enc} KeyStats direct native virtual-prefix/gap controls`,()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+enc+'.db')));
 try{const index=loadSchemaGraph({[storageOwner]:db}).indexes.get('ab'),probe=new Stat4Probe(index.physical.keyInfo);
 try{for(const values of [[null],[0n],[1n],[99n],[0n,7n],[0n,8n],[0n,10n],[1n,5n],[98n,0n],[99n,4n]])for(const round of [false,true]){
  values.forEach((v,i)=>probe.setLiteral(i,v));probe.nField=values.length;probe.nRecValid=values.length;
  const actual=whereKeyStats(index.stat4,probe,round);
  const args=[dir+enc+'.db','ab',String(values.length),String(Number(round)),...values.map(v=>v===null?'null':String(v))];
  const oracle=process.env.STAT4_KEY_ORACLE?JSON.parse(execFileSync(process.env.STAT4_KEY_ORACLE,args,{encoding:'utf8'})):captures.find(c=>JSON.stringify(c.args)===JSON.stringify(args)).result;
  assert.deepEqual(actual,{sample:oracle.sample,less:BigInt(oracle.less),equal:BigInt(oracle.equal)});
  assert.equal(probe.nField,values.length);assert.equal(probe.nRecValid,values.length);assert.equal(probe.errCode,oracle.error);
 }}finally{probe.release();assert.throws(()=>probe.assertLive());}
 }finally{db.close();}
});
test('KeyStats throwing work callback restores active extent and valid prefix',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const index=loadSchemaGraph({[storageOwner]:db}).indexes.get('ab');let remaining=2;
 const probe=new Stat4Probe(index.physical.keyInfo,()=>{if(--remaining===0)throw new Error('cancelled');});
 try{probe.values[0].setInt64(0n);probe.values[1].setInt64(7n);probe.nField=2;probe.nRecValid=1;
 assert.throws(()=>whereKeyStats(index.stat4,probe,false),/cancelled/);assert.equal(probe.nField,2);assert.equal(probe.nRecValid,1);
 }finally{probe.release();}
 }finally{db.close();}
});
import {parseSql,SqlParseError} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,ROWID_NEEDED,resolvedWhereOrder} from '../../src/internal/where-plan.ts';
test('production hot equality rebuilds every group with shared truth; cold prefix and range retain searches',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const schema=loadSchemaGraph({[storageOwner]:db});
 const plan=(sql,budget)=>{const r=expandAndResolveSelect(parseSql(sql).statement,schema);return planWhere(r,{neededColumns:r.sources.map(s=>new Set([...s.table.columns,ROWID_NEEDED])),orderBy:resolvedWhereOrder(r),planBudget:budget});};
 let ticks=0;const budget={remaining:20000n,progressCheck:()=>{ticks++;}};
 const hot=plan('SELECT id,r,b FROM t WHERE a=0 ORDER BY id',budget);
 assert.equal(hot.path.loops[0].kind,'table-scan');assert.equal(budget.truth.secondPass,true);assert.equal(budget.truth.high.size,1);assert.ok(budget.truth.heuristic.size);assert.ok(ticks>0);
 const cold=plan('SELECT id,r,b FROM t WHERE a=99 ORDER BY id',{remaining:20000n});assert.equal(cold.path.loops[0].kind,'index');
 const range=plan('SELECT id,r,b FROM t WHERE a=0 AND b>7 AND b<=9 ORDER BY id',{remaining:20000n});assert.equal(range.path.loops[0].kind,'index');assert.ok(range.path.loops[0].capability.lower);assert.ok(range.path.loops[0].capability.upper);
 const failure={remaining:20000n,progressCheck:()=>{throw new Error('deadline');}};assert.throws(()=>plan('SELECT id FROM t WHERE a=0',failure),/deadline/);
 assert.equal(plan('SELECT id,r,b FROM t WHERE a=0 ORDER BY id',{remaining:20000n}).path.loops[0].kind,'table-scan');
 }finally{db.close();}
});
for(const mode of ['overflow','zero','malformed'])test(`KeyStats native ${mode} count/error controls`,()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const index=loadSchemaGraph({[storageOwner]:db}).indexes.get('ab');
 const state={...index.stat4,samples:index.stat4.samples.map(s=>({...s,p:mode==='malformed'?Uint8Array.from({length:s.n+8},(_,i)=>i===0?127:0):s.p,anEq:s.anEq.map(v=>mode==='overflow'?(1n<<64n)-1n:mode==='zero'?0n:v),anLt:s.anLt.map(v=>mode==='overflow'?(1n<<64n)-6n:mode==='zero'?0n:v)}))};
 for(const values of [[0n],[0n,7n],[98n,0n]])for(const round of [false,true]){
 const probe=new Stat4Probe(index.physical.keyInfo);try{values.forEach((v,i)=>probe.setLiteral(i,v));probe.nField=values.length;
 const args=[dir+'UTF-8.db','ab',String(values.length),String(Number(round)),...values.map(String),mode];
 const expected=process.env.STAT4_KEY_ORACLE?JSON.parse(execFileSync(process.env.STAT4_KEY_ORACLE,args,{encoding:'utf8'})):captures.find(c=>JSON.stringify(c.args)===JSON.stringify(args)).result;
 assert.deepEqual(whereKeyStats(state,probe,round),{sample:expected.sample,less:BigInt(expected.less),equal:BigInt(expected.equal)});assert.equal(probe.errCode,expected.error);assert.equal(probe.nField,values.length);
 }finally{probe.release();}
 }
 }finally{db.close();}
});
test('production unavailable IN member preserves prefix fallback and sibling builder retry',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const schema=loadSchemaGraph({[storageOwner]:db});
  const plan=(sql,budget)=>{const r=expandAndResolveSelect(parseSql(sql).statement,schema);return planWhere(r,{neededColumns:r.sources.map(s=>new Set([...s.table.columns,ROWID_NEEDED])),orderBy:resolvedWhereOrder(r),planBudget:budget});};
  for(const sql of ['SELECT id FROM t WHERE a IN (0, ?1) AND b=7','SELECT id FROM t WHERE a IN (0, abs(1)) AND b=7']){
   const budget={remaining:20000n};const selected=plan(sql,budget);
   assert.ok(selected.path);assert.equal(budget.truth.high.size,0,'partial membership sample must not mark hot truth');
  }
  const cold=plan('SELECT id FROM t WHERE a=99 AND b=4',{remaining:20000n});
  assert.equal(cold.path.loops[0].kind,'index');assert.equal(cold.path.loops[0].capability.nEq,2);
  const joined=plan('SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=99',{remaining:20000n});
  assert.equal(joined.path.loops.length,2);assert.equal(joined.path.loops[0].sourceOrdinal,0);assert.equal(joined.path.loops[1].sourceOrdinal,1);
 }finally{db.close();}
});
import {whereLoopAddBtreeIndex} from '../../src/internal/where-plan.ts';
test('recursive proposal frame closes child and parent sample scopes on stop/error',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const schema=loadSchemaGraph({[storageOwner]:db});
  const resolved=expandAndResolveSelect(parseSql('SELECT id FROM t WHERE a=0 AND b=7').statement,schema);
  const source=resolved.sources[0],index=schema.indexes.get('ab');
  const analysis=planWhere(resolved,{neededColumns:[new Set([ROWID_NEEDED])],orderBy:[]}).analysis;
  for(const failChild of [false,true]){
   let valid=0;const transitions=[];const result={ok:true};
   const generator=whereLoopAddBtreeIndex(index,[],0,new Set([ROWID_NEEDED]),[],source,true,true,{clause:analysis.clause,resolved,source,result,sampleEnter:(_a,prefix)=>{
    const previous=valid;transitions.push(['enter',prefix.length]);
    if(failChild&&prefix.length===1)throw new Error('probe work');
    valid=prefix.length+1;return ()=>{transitions.push(['restore',prefix.length]);valid=previous;};
   }});
   assert.equal(generator.next().value.nEq,1);assert.equal(valid,1);
   if(failChild)assert.throws(()=>generator.next(),/probe work/);
   else {assert.equal(generator.next().value.nEq,2);assert.equal(valid,2);generator.return();}
   assert.equal(valid,0);
   assert.deepEqual(transitions,failChild?[['enter',0],['enter',1],['restore',0]]:[['enter',0],['enter',1],['restore',1],['restore',0]]);
  }
 }finally{db.close();}
});
test('connection-owned probe reservations reject over-envelope and restore on all-slot free',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const index=loadSchemaGraph({[storageOwner]:db}).indexes.get('ab');
  const probe=new Stat4Probe(index.physical.keyInfo,()=>{},n=>db.reserveSchemaTemporary(n));
  try{assert.ok(db.schemaTemporaryBytes>0);probe.setLiteral(0,'sample text');
   assert.ok(db.schemaTemporaryBytes>probe.values.length*64);
   const held=db.schemaTemporaryBytes;assert.throws(()=>db.reserveSchemaTemporary(db.schemaAllowance),RangeError);assert.equal(db.schemaTemporaryBytes,held);
  }finally{probe.release();probe.release();}
  assert.equal(db.schemaTemporaryBytes,0);
  let checks=0;const failed=new Stat4Probe(index.physical.keyInfo,()=>{if(++checks===1)throw new Error('deadline');},n=>db.reserveSchemaTemporary(n));
  try{assert.throws(()=>failed.setLiteral(0,'cancelled'),/deadline/);}finally{failed.release();}
  assert.equal(db.schemaTemporaryBytes,0);
 }finally{db.close();}
});
test('production probe reservation releases on second pass and work failure, same owner retry',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const schema=loadSchemaGraph({[storageOwner]:db});let peak=0,allocations=0;
  const reserveProbe=n=>{allocations++;const release=db.reserveSchemaTemporary(n);peak=Math.max(peak,db.schemaTemporaryBytes);return release;};
  const resolved=expandAndResolveSelect(parseSql('SELECT id,r,b FROM t WHERE a=0 ORDER BY id').statement,schema);
  const plan=budget=>planWhere(resolved,{neededColumns:[new Set([...resolved.sources[0].table.columns,ROWID_NEEDED])],orderBy:resolvedWhereOrder(resolved),planBudget:budget});
  const budget={remaining:20000n,reserveProbe};plan(budget);assert.ok(budget.truth.secondPass);assert.ok(peak>0);assert.ok(allocations>1);assert.equal(db.schemaTemporaryBytes,0);
  assert.throws(()=>plan({remaining:20000n,reserveProbe,progressCheck:()=>{if(db.schemaTemporaryBytes)throw new Error('deadline');}}),/deadline/);assert.equal(db.schemaTemporaryBytes,0);
  plan({remaining:20000n,reserveProbe});assert.equal(db.schemaTemporaryBytes,0);
 }finally{db.close();}
});
test('nested planning restores enclosing truth carrier and invocation construction limit',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const schema=loadSchemaGraph({[storageOwner]:db});
  const resolve=sql=>expandAndResolveSelect(parseSql(sql).statement,schema);
  const outer=resolve('SELECT id,r,b FROM t WHERE a=0 ORDER BY id'),inner=resolve('SELECT id FROM t WHERE a=99');
  const request=r=>({neededColumns:r.sources.map(s=>new Set([...s.table.columns,ROWID_NEEDED])),orderBy:resolvedWhereOrder(r),planBudget:budget});
  let nested=false,outerTruth;const budget={remaining:20000n,progressCheck:()=>{
   if(nested)return;nested=true;outerTruth=budget.truth;const limit=budget.remaining;
   planWhere(inner,request(inner));assert.equal(budget.truth,outerTruth,'nested analysis must restore outer truth');assert.equal(budget.remaining,limit,'nested builder must restore outer insertion frontier');
  }};
  const result=planWhere(outer,request(outer));assert.ok(nested);assert.equal(result.path.loops[0].kind,'table-scan');assert.equal(budget.truth,outerTruth);assert.equal(budget.truth.high.size,1);
  const first=budget.remaining;planWhere(outer,request(outer));assert.equal(budget.remaining,first,'fresh AddAll must start at source planner limit, not depleted sibling budget');
 }finally{db.close();}
});
test('nested failed invocation restores truth, insertion frontier and outstanding probes',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const schema=loadSchemaGraph({[storageOwner]:db}),resolve=sql=>expandAndResolveSelect(parseSql(sql).statement,schema);
  const outer=resolve('SELECT id FROM t WHERE a=0'),inner=resolve('SELECT id FROM t WHERE a=99');let nested=false;
  const budget={remaining:20000n,reserveProbe:n=>db.reserveSchemaTemporary(n),progressCheck:()=>{
   if(nested)return;nested=true;const truth=budget.truth,limit=budget.remaining,held=db.schemaTemporaryBytes;
   const previous=budget.progressCheck;budget.progressCheck=()=>{throw new Error('cancel nested');};
   try{assert.throws(()=>planWhere(inner,{neededColumns:[new Set(inner.sources[0].table.columns)],orderBy:[],planBudget:budget}),/cancel nested/);}finally{budget.progressCheck=previous;}
   assert.equal(budget.truth,truth);assert.equal(budget.remaining,limit);assert.equal(db.schemaTemporaryBytes,held);
  }};
  planWhere(outer,{neededColumns:[new Set(outer.sources[0].table.columns)],orderBy:[],planBudget:budget});assert.ok(nested);assert.equal(db.schemaTemporaryBytes,0);
 }finally{db.close();}
});
test('bounded source AddAll construction resets per invocation, retaining stop/error outcome',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{const schema=loadSchemaGraph({[storageOwner]:db});const resolved=expandAndResolveSelect(parseSql('SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=99').statement,schema);
  let checks=0;const budget={remaining:90000n,constructionLimit:-1000n,progressCheck:()=>{checks++;}};
  const request={neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[],planBudget:budget};
  assert.throws(()=>planWhere(resolved,request),/no query solution/);const frontier=budget.remaining,calls=checks;assert.equal(frontier,90000n,'failed AddAll restores caller frontier rather than publishing partial state');
  checks=0;assert.throws(()=>planWhere(resolved,request),/no query solution/);assert.equal(budget.remaining,frontier);assert.equal(checks,calls);
 }finally{db.close();}
});

test('complete multi-group rebuild publishes immutable clause-owned truth independently of builder reuse',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const schema=loadSchemaGraph({[storageOwner]:db});
  const resolved=expandAndResolveSelect(parseSql('SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=0').statement,schema);
  const budget={remaining:20000n};
  const request={neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[],planBudget:budget};
  const selected=planWhere(resolved,request);
  assert.equal(selected.truth.secondPass,true);assert.equal(selected.truth.high.length,2);
  assert.ok(Object.isFrozen(selected.truth));assert.ok(Object.isFrozen(selected.truth.high));assert.ok(Object.isFrozen(selected.truth.heuristic));
  for(const term of selected.truth.high)assert.ok(selected.analysis.clause.terms.includes(term),'published flags belong to this analyzed clause');
  assert.deepEqual(selected.path.loops.map(l=>l.kind),['table-scan','table-scan']);
  const high=[...selected.truth.high],heuristic=[...selected.truth.heuristic];
  budget.truth.high.clear();budget.truth.heuristic.clear();budget.truth.secondPass=false;
  planWhere(resolved,request);
  assert.deepEqual(selected.truth.high,high);assert.deepEqual(selected.truth.heuristic,heuristic);assert.equal(selected.truth.secondPass,true);
 }finally{db.close();}
});

test('fallback selection publishes empty truth rather than a previous clause carrier',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const schema=loadSchemaGraph({[storageOwner]:db}),budget={remaining:20000n};
  const plan=sql=>{const r=expandAndResolveSelect(parseSql(sql).statement,schema);return planWhere(r,{neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[],planBudget:budget});};
  const hot=plan('SELECT id FROM t WHERE a=0');assert.equal(hot.truth.high.length,1);
  // Three-rowid layouts with one RIGHT barrier participate in matched planning.
  // Repeated RIGHT barriers retain fallback; preserve truth-reset assertions.
  const fallback=plan('SELECT x.id FROM t AS x RIGHT JOIN t AS y ON x.id=y.id RIGHT JOIN t AS z ON y.id=z.id');
  assert.equal(budget.truth.high.size,0,'successful fallback resets reusable carrier');assert.equal(budget.truth.heuristic.size,0);assert.equal(budget.truth.secondPass,false);
  assert.equal(fallback.path,null);assert.deepEqual(fallback.truth,{high:[],heuristic:[],secondPass:false});assert.ok(Object.isFrozen(fallback.truth.high));
  assert.equal(hot.truth.high.length,1);
 }finally{db.close();}
});

test('native finite AddAll frontier preserves SQLITE_ERROR rather than unsupported classification',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const r=expandAndResolveSelect(parseSql('SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=99').statement,loadSchemaGraph({[storageOwner]:db}));
  for(const limit of [-1000n,-999n,-998n,0n,20000n]){
   const args=[dir+'UTF-8.db','SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=99',String(limit)];
   const expected=JSON.parse(fs.readFileSync(dir+'c-red/frontier-native.json','utf8')).find(c=>JSON.stringify(c.args)===JSON.stringify(args)).result;
   if(process.env.STAT4_FRONTIER_ORACLE)assert.equal(execFileSync(process.env.STAT4_FRONTIER_ORACLE,[dir+'UTF-8.db','SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=99',String(limit)],{encoding:'utf8'}).trim(),expected);
   const budget={remaining:90000n,constructionLimit:limit,reserveProbe:n=>db.reserveSchemaTemporary(n)};
   const run=()=>planWhere(r,{neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[],planBudget:budget});
   if(limit===-1000n)assert.throws(run,e=>e instanceof SqlParseError&&e.message==='no query solution');else assert.ok(run().path);
   assert.equal(db.schemaTemporaryBytes,0);
  }
 }finally{db.close();}
});

test('every consuming work frontier unwinds second-pass and membership probes before same-owner retry',t=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const schema=loadSchemaGraph({[storageOwner]:db});
  for(const sql of [
   'SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=0',
   'SELECT id FROM t WHERE a=0 AND b IN (7,8,10)',
   'SELECT id FROM t WHERE a=0 AND b>=7 AND b<=10',
   'SELECT id FROM t WHERE a IN (99,?1) AND b=4',
   'SELECT id FROM t WHERE (a=0 AND b=7) OR (a=99 AND b=4)',
   'SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE (x.a=0 OR x.a=99) AND y.a=0',
  ]){
   const r=expandAndResolveSelect(parseSql(sql).statement,schema),reserveProbe=n=>db.reserveSchemaTemporary(n);
   const request=budget=>({neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[],planBudget:budget});
   let work=0;const reference=planWhere(r,request({remaining:20000n,reserveProbe,progressCheck:()=>work++}));assert.ok(work>0);assert.equal(db.schemaTemporaryBytes,0);t.diagnostic(`${sql}: ${work} work frontiers`);
   const signature=s=>s.path.loops.map(l=>[l.sourceOrdinal,l.kind,l.index?.name??null,l.outputRows,l.runCost]);
   for(let failAt=1;failAt<=work;failAt++){
    let ticks=0;const primary=new Error(`consuming frontier ${failAt}`),budget={remaining:20000n,reserveProbe,progressCheck:()=>{if(++ticks===failAt)throw primary;}};
    assert.throws(()=>planWhere(r,request(budget)),e=>e===primary,`${sql}: exact primary at frontier ${failAt}`);
    assert.equal(db.schemaTemporaryBytes,0,`${sql}: all-slot release at frontier ${failAt}`);
    delete budget.progressCheck;const retry=planWhere(r,request(budget));assert.deepEqual(signature(retry),signature(reference));assert.equal(db.schemaTemporaryBytes,0);
    assert.equal(retry.truth.secondPass,reference.truth.secondPass);assert.deepEqual(retry.truth.high.map(t=>t.id),reference.truth.high.map(t=>t.id));
   }
  }
 }finally{db.close();}
});

test('every consuming reservation frontier preserves primary memory failure and releases prior index builders',t=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const schema=loadSchemaGraph({[storageOwner]:db});
  for(const sql of ['SELECT x.id,y.id FROM t AS x CROSS JOIN t AS y WHERE x.a=0 AND y.a=0','SELECT id FROM t WHERE a=0 AND b IN (7,8,10)','SELECT id FROM t WHERE a=0 AND b>=7 AND b<=10','SELECT id FROM t WHERE (a=0 AND b=7) OR (a=99 AND b=4)']){
   const r=expandAndResolveSelect(parseSql(sql).statement,schema),request=planBudget=>({neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[],planBudget});
   let allocations=0;planWhere(r,request({remaining:20000n,reserveProbe:n=>{allocations++;return db.reserveSchemaTemporary(n)}}));assert.ok(allocations>0);t.diagnostic(`${sql}: ${allocations} reservation frontiers`);
   for(let failAt=1;failAt<=allocations;failAt++){
    let calls=0;const primary=new RangeError(`memory frontier ${failAt}`),budget={remaining:20000n,reserveProbe:n=>{if(++calls===failAt)throw primary;return db.reserveSchemaTemporary(n)}};
    assert.throws(()=>planWhere(r,request(budget)),e=>e===primary);assert.equal(db.schemaTemporaryBytes,0);
    budget.reserveProbe=n=>db.reserveSchemaTemporary(n);assert.ok(planWhere(r,request(budget)).path);assert.equal(db.schemaTemporaryBytes,0);
   }
  }
 }finally{db.close();}
});

test('failed outer invocation does not publish partial clause truth over prior completed analysis',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const schema=loadSchemaGraph({[storageOwner]:db}),r=expandAndResolveSelect(parseSql('SELECT id FROM t WHERE a=0').statement,schema);
  const budget={remaining:20000n,reserveProbe:n=>db.reserveSchemaTemporary(n)},request={neededColumns:[new Set(r.sources[0].table.columns)],orderBy:[],planBudget:budget};
  const completed=planWhere(r,request),truth=budget.truth,remaining=budget.remaining,primary=new Error('second-pass abort');
  budget.progressCheck=()=>{if(budget.truth!==truth&&budget.truth?.secondPass)throw primary;};
  assert.throws(()=>planWhere(r,request),e=>e===primary);assert.equal(db.schemaTemporaryBytes,0);
  assert.equal(budget.truth,truth);assert.equal(budget.remaining,remaining);assert.equal(completed.truth.secondPass,true);
  delete budget.progressCheck;assert.ok(planWhere(r,request).path);
 }finally{db.close();}
});

test('forced-index exhausted AddAll frontier retains native no-query-solution error channel',()=>{
 const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+'UTF-8.db')));
 try{
  const r=expandAndResolveSelect(parseSql('SELECT id FROM t INDEXED BY ab WHERE a=0').statement,loadSchemaGraph({[storageOwner]:db}));
  for(const limit of [-1000n,-999n,-998n,0n,20000n]){
   const budget={remaining:20000n,constructionLimit:limit,reserveProbe:n=>db.reserveSchemaTemporary(n)};
   const run=()=>planWhere(r,{neededColumns:[new Set(r.sources[0].table.columns)],orderBy:[],planBudget:budget});
   if(limit===-1000n)assert.throws(run,e=>e instanceof SqlParseError&&e.message==='no query solution');else assert.ok(run().path);
   assert.equal(db.schemaTemporaryBytes,0);
  }
 }finally{db.close();}
});

test('native OR and joined finite frontiers retain outcome and failed owner cleanup',()=>{
 const cases=JSON.parse(fs.readFileSync(dir+'c-red/or-frontier-native.json'));
 for(const c of cases){const db=ImmutableStorage.open(new Uint8Array(fs.readFileSync(dir+c.encoding+'.db')));
  try{
   const r=expandAndResolveSelect(parseSql(c.sql).statement,loadSchemaGraph({[storageOwner]:db})),budget={remaining:21000n,constructionLimit:BigInt(c.limit),reserveProbe:n=>db.reserveSchemaTemporary(n)};
   const run=()=>planWhere(r,{neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[],planBudget:budget});
   if(c.result==='0|not an error')assert.ok(run().path,`${c.encoding}/${c.limit}/${c.sql}`);
   else {assert.equal(c.result,'1|no query solution');assert.throws(run,e=>e instanceof SqlParseError&&e.message==='no query solution');assert.equal(budget.remaining,21000n);assert.equal(budget.truth,undefined);}
   assert.equal(db.schemaTemporaryBytes,0);
  }finally{db.close();}
 }
});
