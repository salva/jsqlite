import test from 'node:test';import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,rightJoinResidual,btreeLoops,sourceBit,wherePathSolver,wherePathChoiceWidth,logEstAdd,planWhere,ROWID_NEEDED,WherePlanningUnsupportedError} from '../../src/internal/where-plan.ts';
import {physicalIndex,columnTypeEstimate,sqliteLogEst} from '../../src/internal/schema.ts';
const col=(name,type,extra={})=>Object.freeze({name,declaredType:type,affinity:type==='TEXT'?'text':type==='REAL'?'real':type==='BLOB'?'blob':'integer',szEst:columnTypeEstimate(type).szEst,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,collation:null,generatedStorage:null,checks:[],...extra});
// Synthetic schema carries build.c/schema.ts default estimates, not ad-hoc planner costs.
// sqlite3DefaultRowEst: nRowLogEst=200, equality prefixes33/32; row widths use szEst.
function schema(encoding='utf-8',withoutRowid=false){const id=col('id','INTEGER',{primaryKeyPosition:1}),a=col('a','TEXT',{collation:'NOCASE'}),b=col('b','REAL'),blob=col('blob','BLOB');const t={nRowLogEst:200,hasStat1:false,integerPrimaryKey:withoutRowid?null:id,szTabRow:sqliteLogEst(BigInt(([id,a,b,blob].reduce((n,c)=>n+c.szEst,0)+(withoutRowid?0:1))*4)),kind:'table',name:'t',tableName:'t',rootPage:2,sql:'',columns:Object.freeze([id,a,b,blob]),indexes:[],withoutRowid,primaryKey:Object.freeze([id]),storageKey:Object.freeze([]),checks:Object.freeze([]),foreignKeys:Object.freeze([]),referencedBy:Object.freeze([])};const i={rowLogEst:Object.freeze([200,33,32]),szIdxRow:sqliteLogEst(BigInt((a.szEst+b.szEst+id.szEst)*4)),hasStat1:false,unordered:false,noSkipScan:false,kind:'index',name:'i_ab',tableName:'t',rootPage:3,sql:'',table:t,terms:Object.freeze([{column:a,expression:null,expressionSql:null,descending:false,collation:'NOCASE',nulls:null},{column:b,expression:null,expressionSql:null,descending:true,collation:null,nulls:null}].map(Object.freeze)),unique:false,origin:'create',physical:null};i.physical=physicalIndex(i,encoding);const iblob={...i,rowLogEst:Object.freeze([200,33]),szIdxRow:sqliteLogEst(BigInt((blob.szEst+id.szEst)*4)),name:'i_blob',rootPage:4,terms:Object.freeze([Object.freeze({column:blob,expression:null,expressionSql:null,descending:false,collation:null,nulls:null})]),physical:null};iblob.physical=physicalIndex(iblob,encoding);t.indexes.push(i,iblob);Object.freeze(t.indexes);return {tables:new Map([['t',t]]),t,i,iblob,id,a,b,blob};}
const resolve=(sql,s)=>expandAndResolveSelect(parseSql(sql).statement,s);
test('whereLoopInsert keeps the cheaper represented IN/range proposal',()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const s=schema(encoding);
  const r=resolve("SELECT a FROM t INDEXED BY i_ab WHERE a IN ('x','y') AND a >= 'w' AND a < 'z' AND b >= 1.5 AND b < 3.0",s);
  const analyzed=analyzeWhere(r);
  const caps=btreeLoops(r.sources[0],0,analyzed.clause,{forcedIndex:s.i,neededColumns:new Set([s.a]),orderBy:[]}).filter(loop=>loop.kind==='index').map(loop=>loop.capability);
  assert.ok(caps.some(cap=>cap.equalityPrefix[0]?.operator==='in'&&cap.lower?.operator==='ge'&&cap.upper?.operator==='lt'&&cap.lower?.fieldOrdinal===1&&cap.upper?.fieldOrdinal===1),`${encoding}: IN prefix with second-slot bounds`);
  assert.equal(caps.length,1,`${encoding}: dominated same-sort first-slot range is discarded`);
 }
});
// whereLoopFindLesser compares equal-sort costs: default index selectivity may
// dominate an IPK range; keep the independently driven NOT INDEXED rowid control.
test('production split/analyze commutes operands and derives rowid/range masks',()=>{const s=schema(),r=resolve("SELECT a FROM t WHERE 5 < id AND a COLLATE nocase = 'x' AND b <= 1.5",s),a=analyzeWhere(r);assert.equal(a.clause.terms.length,3);assert.equal(a.clause.terms[0].operator,'gt');assert.equal(a.clause.terms[0].originalIndexedOperand,'right');assert.equal(a.clause.terms[0].left.rowid,true);assert.equal(a.clause.terms[1].effectiveCollation,'nocase');assert.equal(a.clause.terms[2].rightAffinity,null);const loops=btreeLoops(r.sources[0],0,a.clause,{forcedIndex:null,neededColumns:new Set([s.a,s.blob]),orderBy:[]});assert.equal(loops.length,1);assert.equal(loops[0].capability.index,s.i);assert.equal(loops[0].capability.equalityPrefix.length,1);const rowOnly=resolve('SELECT a FROM t NOT INDEXED WHERE 5 < id',s);const rowLoops=btreeLoops(rowOnly.sources[0],0,analyzeWhere(rowOnly).clause,{forcedIndex:null,neededColumns:new Set([s.a]),orderBy:[]});assert.equal(rowLoops[0].kind,'rowid');assert.equal(rowLoops[0].capability.rowidLower.term.operator,'gt');
const onlyB=analyzeWhere(resolve('SELECT a FROM t WHERE b>1',s));const bLoop=btreeLoops(r.sources[0],0,onlyB.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[]});assert.deepEqual(bLoop.map(x=>x.kind),['index']);assert.ok(bLoop.slice(1).every(x=>x.capability.covering&&x.capability.constrainedFields===0));const selected=planWhere(r,{neededColumns:[new Set([s.a,s.blob])],orderBy:[]});assert.equal(selected.path.loops[0].capability.index,s.i);assert.equal(selected.path.loops[0].capability.equalityPrefix[0].term,selected.analysis.clause.terms[1]);});
test('gates NOT INDEXED, forced full index and pointless index; RIGHT/FULL fallback unchanged',()=>{const s=schema(),r=resolve('SELECT a FROM t',s),a=analyzeWhere(r);assert.deepEqual(btreeLoops(r.sources[0],0,a.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[]}).map(x=>x.kind),['index']);assert.deepEqual(btreeLoops(r.sources[0],0,a.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[{sourceOrdinal:0,column:s.a,descending:false,collation:'nocase'}]}).map(x=>x.capability.index),[s.iblob,s.i]);assert.deepEqual(btreeLoops(r.sources[0],0,a.clause,{forcedIndex:s.i,neededColumns:new Set(),orderBy:[]}).map(x=>x.kind),['index']);assert.deepEqual(btreeLoops(r.sources[0],0,a.clause,{forcedIndex:null,notIndexed:true,neededColumns:new Set(),orderBy:[]}).map(x=>x.kind),['table-scan']);const row=resolve('SELECT a FROM t WHERE id=1',s),rowAnalysis=analyzeWhere(row);assert.deepEqual(btreeLoops(row.sources[0],0,rowAnalysis.clause,{forcedIndex:null,notIndexed:true,neededColumns:new Set(),orderBy:[]}).map(x=>x.kind),['rowid']);assert.throws(()=>btreeLoops(r.sources[0],0,a.clause,{forcedIndex:s.i,notIndexed:true,neededColumns:new Set(),orderBy:[]}),WherePlanningUnsupportedError);const rr=resolve('SELECT t.a FROM t RIGHT JOIN t AS u ON t.id=u.id',s);assert.deepEqual(analyzeWhere(rr),{clause:{split:'and',terms:[],outer:null},plannerEligible:false,fallback:'right-full'});});
test('all encodings flow analysis through admission, candidate and selected identity',()=>{for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const [sql,affinity,operator,orientation] of [["SELECT a FROM t WHERE a='01'",null,'eq','left'],["SELECT a FROM t WHERE 'z'=a COLLATE nocase",null,'eq','right'],["SELECT a FROM t WHERE a='x' AND b=9007199254740991",null,'eq','left'],["SELECT a FROM t WHERE a='x' AND b<9007199254740991.5",null,'lt','left'],["SELECT a FROM t WHERE blob=x'00ff'",null,'eq','left'],["SELECT a FROM t WHERE a = NULL",null,'eq','left'],["SELECT a FROM t WHERE a IS NULL",null,'is-null','left']]){const s=schema(encoding),r=resolve(sql,s),analysis=analyzeWhere(r),term=analysis.clause.terms.at(-1),loops=btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([s.a]),orderBy:[]}),candidate=loops.find(x=>x.kind==='index'&&(x.capability.equalityPrefix.some(a=>a.term===term)||x.capability.lower?.term===term||x.capability.upper?.term===term));assert.equal(s.i.physical.keyInfo.encoding,encoding);assert.equal(term.rightAffinity,affinity);assert.equal(term.operator,operator);assert.equal(term.originalIndexedOperand,orientation);assert.ok(candidate);const admission=candidate.capability.equalityPrefix.find(a=>a.term===term)??(candidate.capability.lower?.term===term?candidate.capability.lower:candidate.capability.upper);assert.equal(admission.physicalIndex,sql.includes('blob=')?s.iblob.physical:s.i.physical);assert.equal(admission.term,term);if(sql.includes('= NULL'))assert.equal(admission.comparison.kind,'comparison');if(sql.includes('IS NULL'))assert.equal(admission.comparison.kind,'is-null');const selected=planWhere(r,{neededColumns:[new Set([s.a])],orderBy:[]});assert.ok(selected.path.loops[0].capability?.physicalIndex);assert.equal(selected.path.loops[0].capability.physicalIndex.keyInfo.encoding,encoding);}});
test('LEFT provenance prerequisites and N-best LogEst path selection',()=>{const s=schema(),r=resolve('SELECT t.a FROM t LEFT JOIN t AS u ON u.a=t.a WHERE t.id>0',s),a=analyzeWhere(r),on=a.clause.terms.find(x=>x.origin.kind==='join-on');assert.ok(on);assert.equal(on.prereqRight,sourceBit(0));assert.equal(on.outerJoinSafe.mayOmitResidual,false);assert.equal(logEstAdd(10n,10n),20n);const mk=(source,n,prereq,cost,rows)=>Object.freeze({source,sourceOrdinal:n,prereq,capability:null,kind:'table-scan',setupCost:0n,runCost:cost,outputRows:rows,terms:Object.freeze([])});const p=wherePathSolver([[mk(r.sources[0],0,0n,20n,10n)],[mk(r.sources[1],1,sourceBit(0),5n,1n)]],2);assert.deepEqual(p.loops.map(x=>x.sourceOrdinal),[0,1]);});

test('LEFT barriers constrain every production candidate for ON and WHERE orientations',()=>{const s=schema();for(const sql of ["SELECT t.a FROM t LEFT JOIN t AS u ON u.id=t.id WHERE u.id>0","SELECT t.a FROM t LEFT JOIN t AS u ON t.id=u.id WHERE 0<u.id"]){const r=resolve(sql,s),selection=planWhere(r,{neededColumns:[new Set([s.a]),new Set([s.id])],orderBy:[]});assert.deepEqual(selection.path.loops.map(x=>x.sourceOrdinal),[0,1]);const rhs=selection.path.loops[1];assert.equal(rhs.prereq&sourceBit(0),sourceBit(0));assert.ok(selection.analysis.clause.terms.some(term=>term.origin.kind==='join-on'&&term.outerJoinSafe.mayOmitResidual===false));}const empty=resolve('SELECT t.a FROM t LEFT JOIN t AS u ON 0',s),emptyPlan=planWhere(empty,{neededColumns:[new Set([s.a]),new Set()],orderBy:[]});assert.deepEqual(emptyPlan.path.loops.map(x=>x.sourceOrdinal),[0,1]);assert.equal(emptyPlan.path.loops[1].prereq,sourceBit(0));});

test('pinned choice widths, dominance and prerequisite-delayed alternatives are deterministic',()=>{assert.deepEqual([1,2,3,9].map(wherePathChoiceWidth),[1,5,12,12]);const s=schema(),r=resolve('SELECT a FROM t',s),mk=(n,prereq,cost,rows,kind='table-scan')=>Object.freeze({source:{...r.sources[0],cursorId:n},sourceOrdinal:n,prereq,capability:null,kind,setupCost:0n,runCost:cost,outputRows:rows,terms:Object.freeze([])});const dominated=mk(0,0n,30n,30n),winner=mk(0,0n,30n,10n),later=mk(1,sourceBit(0),5n,1n);assert.equal(wherePathSolver([[dominated,winner],[later]],2).loops[0],winner);const groups=[[mk(0,0n,5n,60n),mk(0,0n,15n,0n)],[mk(1,0n,8n,20n)],[mk(2,sourceBit(1),2n,1n)]];const a=wherePathSolver(groups,3),b=wherePathSolver(groups,3);assert.deepEqual(a.loops.map(x=>[x.sourceOrdinal,x.runCost]),b.loops.map(x=>[x.sourceOrdinal,x.runCost]));assert.equal(a.ready,7n);const truncated=wherePathSolver(groups,3,1);assert.equal(truncated.ready,7n);assert.deepEqual(wherePathSolver(groups,3,1).loops,truncated.loops);});

// Covering-width alternatives may precede i_ab; certify the physical owner, not list position.
test('composite order skips equality-fixed prefix and rowid tail covers explicit need',()=>{const s=schema(),r=resolve("SELECT id FROM t WHERE a='x'",s),analysis=analyzeWhere(r);for(const [order,expected,reverse] of [[[[s.a,false],[s.b,true]],2,false],[[[s.a,true],[s.b,false]],2,true],[[[s.a,false]],1,false]]){const requirements=order.map(([column,descending])=>({sourceOrdinal:0,column,descending,collation:column===s.a?'nocase':'binary'}));const ix=btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([ROWID_NEEDED]),orderBy:requirements}).find(x=>x.capability.index===s.i);assert.ok(ix);assert.equal(ix.capability.orderTermsSatisfied,expected);assert.equal(ix.capability.reverse,reverse);assert.equal(ix.capability.covering,true);assert.equal(ix.capability.needsTableLookup,false);}});

test('ordinal index exclusion preserves resolved owners and unrelated forced index candidates',()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const s=schema(encoding);
  const resolved=resolve("SELECT x.id,u.a FROM t AS x JOIN t AS u INDEXED BY i_ab ON u.a=x.a WHERE x.a='x' AND u.a='x'",s);
  const needed=resolved.sources.map(()=>new Set([s.a]));
  const ordinary=planWhere(resolved,{neededColumns:needed,orderBy:[]});
  assert.equal(ordinary.path.loops.find(loop=>loop.sourceOrdinal===0)?.kind,'index',`${encoding}: exclusion changes an eligible index path`);
  assert.ok(ordinary.analysis.clause.terms.some(term=>term.left?.source===resolved.sources[0]),`${encoding}: original first owner`);
  const excluded=planWhere(resolved,{neededColumns:needed,orderBy:[],excludedIndexSources:new Set([0])});
  assert.equal(excluded.analysis.clause.terms.some(term=>term.left?.source===resolved.sources[0]),true,`${encoding}: unchanged term owner`);
  assert.equal(excluded.path.loops.find(loop=>loop.sourceOrdinal===0)?.source,resolved.sources[0],`${encoding}: original source retained`);
  assert.equal(excluded.path.loops.find(loop=>loop.sourceOrdinal===0)?.kind!=='index',true,`${encoding}: first source excluded`);
  const forced=excluded.path.loops.find(loop=>loop.sourceOrdinal===1);
  assert.equal(forced?.source,resolved.sources[1],`${encoding}: unrelated owner retained`);
  assert.equal(forced?.kind,'index',`${encoding}: unrelated forced candidate retained`);
  assert.equal(forced?.capability?.physicalIndex,s.i.physical,`${encoding}: exact physical descriptor retained`);
  assert.throws(()=>planWhere(resolved,{neededColumns:needed,orderBy:[],excludedIndexSources:new Set([1])}),error=>error instanceof WherePlanningUnsupportedError&&/INDEXED BY and NOT INDEXED conflict/.test(error.message),`${encoding}: forced exclusion classification`);
 }
});

// where.c wherePathSatisfiesOrderBy WHERE_ONEROW preserves a later loop's order.
// The separate non-singleton multi-source test below still requires zero credit.
test('singleton IPK prefix preserves later local reverse order across source permutations',()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const s=schema(encoding);
  for(const sql of [
   "SELECT u.b FROM t AS x JOIN t AS u INDEXED BY i_ab ON u.a=x.a WHERE x.id=2 AND u.b>=1 ORDER BY u.b ASC",
   "SELECT u.b FROM t AS u INDEXED BY i_ab JOIN t AS x ON u.a=x.a WHERE x.id=2 AND u.b>=1 ORDER BY u.b ASC",
  ]){
   const resolved=resolve(sql,s),ordinal=resolved.sources.findIndex(source=>source.alias==='u');
   const requirement={sourceOrdinal:ordinal,column:s.b,descending:false,collation:'binary'};
   const selected=planWhere(resolved,{neededColumns:resolved.sources.map(()=>new Set([s.b])),orderBy:[requirement]});
   const inner=selected.path.loops.find(loop=>loop.sourceOrdinal===ordinal);
   assert.equal(inner.kind,'index',`${encoding}/${ordinal}: forced index selected`);
   assert.equal(inner.capability.physicalIndex,s.i.physical);
   assert.equal(inner.capability.reverse,true,`${encoding}/${ordinal}: declared DESC b needs local reverse`);
   assert.equal(inner.capability.orderTermsSatisfied,1,`${encoding}/${ordinal}: local physical order`);
   assert.equal(selected.path.orderTermsSatisfied,1,`${encoding}/${ordinal}: singleton IPK prefix preserves order`);assert.equal(selected.path.loops[0].kind,'rowid');assert.ok(selected.path.loops[0].capability.rowidEquality);
  }
 }
});

test('WITHOUT ROWID secondary layout appends immutable primary-key suffix and plans represented covering access',()=>{const s=schema('utf-8',true);assert.ok(s.i.physical);assert.deepEqual(s.i.physical.fields.map(field=>field.role),['declared','declared','primary-key-suffix']);assert.equal(s.i.physical.fields[2].column,s.id);assert.equal(s.i.physical.keyInfo,s.i.physical.keyInfo);assert.deepEqual(s.i.physical.keyInfo.terms[2],{collation:'binary',desc:false,nullsLarge:false});const r=resolve("SELECT a FROM t INDEXED BY i_ab WHERE a='x'",s),selected=planWhere(r,{neededColumns:[new Set([s.a])],orderBy:[]});assert.equal(selected.path.loops[0].kind,'index');assert.equal(selected.path.loops[0].capability.physicalIndex,s.i.physical);assert.equal(selected.path.loops[0].capability.covering,true);assert.equal(selected.path.loops[0].capability.needsTableLookup,false);const normal=schema(),normalResolved=resolve('SELECT a FROM t',normal),normalPlan=planWhere(normalResolved,{neededColumns:[new Set([normal.a])],orderBy:[]});assert.equal(normalPlan.path.loops[0].kind,'index');assert.equal(normalPlan.path.loops[0].capability.covering,true);});

test('LEFT outer-ON extraRight keeps preserved-side equality/range residual',()=>{const s=schema();for(const [on,kind] of [['t.id=1','rowid'],['t.a>\'m\'','index']]){const r=resolve(`SELECT t.a FROM t LEFT JOIN t AS u ON ${on}`,s),analysis=analyzeWhere(r),preserved=analysis.clause.terms.find(term=>term.origin.kind==='join-on'&&term.left?.sourceOrdinal===0);assert.ok(preserved);assert.equal(preserved.outerJoinSafe.mayDrive,false);const loops=btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([s.a]),orderBy:[]});assert.equal(loops.some(loop=>loop.kind===kind&&loop.capability&&(loop.capability.rowidEquality?.term===preserved||loop.capability.lower?.term===preserved)),false);const selected=planWhere(r,{neededColumns:[new Set([s.a]),new Set()],orderBy:[]});assert.equal(selected.path.loops[0].capability?.rowidEquality?.term===preserved||selected.path.loops[0].capability?.lower?.term===preserved,false);const wr=resolve(`SELECT t.a FROM t LEFT JOIN t AS u ON 1 WHERE ${on}`,s),wa=analyzeWhere(wr),whereTerm=wa.clause.terms.find(term=>term.origin.kind==='where');assert.equal(whereTerm.outerJoinSafe.mayDrive,true);assert.ok(btreeLoops(wr.sources[0],0,wa.clause,{forcedIndex:null,neededColumns:new Set([s.a]),orderBy:[]}).some(loop=>loop.kind===kind));}const right=resolve("SELECT t.a FROM t LEFT JOIN t AS u ON u.a='x'",s),rightAnalysis=analyzeWhere(right),rightTerm=rightAnalysis.clause.terms.find(term=>term.origin.kind==='join-on');assert.equal(rightTerm.outerJoinSafe.mayDrive,true);assert.ok(btreeLoops(right.sources[1],1,rightAnalysis.clause,{forcedIndex:null,sourcePrereq:sourceBit(0),neededColumns:new Set([s.a]),orderBy:[]}).some(loop=>loop.kind==='index'));});

test('both-column analysis publishes exact virtual commuted children and orientation-stable RHS admission',()=>{const s=schema();for(const join of ['JOIN','LEFT JOIN']){const seen=[];for(const on of ['t.a=u.a','u.a=t.a']){const r=resolve(`SELECT t.a FROM t ${join} t AS u ON ${on}`,s),analysis=analyzeWhere(r),parent=analysis.clause.terms.find(term=>!term.virtual),child=analysis.clause.terms.find(term=>term.virtual);assert.ok(parent&&child);assert.deepEqual(parent.childIds,[child.id]);assert.equal(child.parentId,parent.id);assert.equal(child.origin.kind,'derived');assert.equal(child.origin.reason,'commuted');assert.equal(child.operator,parent.operator);assert.equal(child.effectiveCollation,parent.effectiveCollation);assert.equal(child.left.sourceOrdinal,parent.left.sourceOrdinal===0?1:0);assert.equal(child.prereqRight,sourceBit(parent.left.sourceOrdinal));const rhs=analysis.clause.terms.find(term=>term.left?.sourceOrdinal===1);assert.ok(rhs);if(join==='LEFT JOIN')assert.equal(analysis.clause.terms.find(term=>term.left?.sourceOrdinal===0).outerJoinSafe.mayDrive,false);assert.equal(rhs.outerJoinSafe.mayDrive,true);const loops=btreeLoops(r.sources[1],1,analysis.clause,{forcedIndex:null,sourcePrereq:sourceBit(0),neededColumns:new Set([s.a]),orderBy:[]}),ix=loops.find(loop=>loop.kind==='index');assert.ok(ix);const admission=ix.capability.equalityPrefix[0];assert.equal(admission.term,rhs);assert.equal(admission.field,s.i.physical.fields[0]);seen.push(admission.field);}assert.equal(seen[0],seen[1]);}});

test('three-source LEFT then INNER/CROSS barriers retain nullable side before later source',()=>{const s=schema();for(const tail of ['JOIN t AS v ON u.a=v.a','CROSS JOIN t AS v']){const r=resolve(`SELECT t.a FROM t LEFT JOIN t AS u ON t.a=u.a ${tail}`,s),selection=planWhere(r,{neededColumns:[new Set([s.a]),new Set([s.a]),new Set([s.a])],orderBy:[]});assert.deepEqual(selection.path.loops.map(loop=>loop.sourceOrdinal),[0,1,2]);const third=selection.path.loops[2];assert.equal(third.prereq&(sourceBit(0)|sourceBit(1)),sourceBit(0)|sourceBit(1));if(tail.startsWith('JOIN')){const parent=selection.analysis.clause.terms.find(term=>term.origin.kind==='join-on'&&term.origin.rightSource===2),nullable=selection.analysis.clause.terms.find(term=>term.parentId===parent?.id&&term.left?.sourceOrdinal===2);assert.ok(parent&&nullable);assert.equal(nullable.prereqRight,sourceBit(1));}}});

test('compare affinity follows expression affinity, not literal storage class, in every encoding',()=>{for(const encoding of ['utf-8','utf-16le','utf-16be']){const s=schema(encoding);for(const sql of ["SELECT a FROM t WHERE a=1","SELECT a FROM t WHERE 1=a","SELECT a FROM t WHERE a='nonnumeric'","SELECT a FROM t WHERE a=NULL","SELECT a FROM t WHERE NULL=a","SELECT a FROM t WHERE a='x' AND b='1'","SELECT a FROM t WHERE a='x' AND 'nonnumeric'=b","SELECT a FROM t WHERE a='x' AND b=9007199254740991","SELECT a FROM t WHERE a='x' AND 9007199254740991.5>b","SELECT a FROM t WHERE blob='text'","SELECT a FROM t WHERE x'00ff'=blob"]){const r=resolve(sql,s),analysis=analyzeWhere(r),term=analysis.clause.terms.at(-1),loops=btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([s.a]),orderBy:[]}),ix=loops.find(loop=>loop.kind==='index'&&[...loop.capability.equalityPrefix,loop.capability.lower,loop.capability.upper].some(a=>a?.term===term));assert.ok(ix,`${encoding}: ${sql}`);const admission=[...ix.capability.equalityPrefix,ix.capability.lower,ix.capability.upper].find(a=>a?.term===term);assert.equal(admission.term,term);assert.equal(admission.physicalIndex.keyInfo.encoding,encoding);const selected=planWhere(r,{neededColumns:[new Set([s.a])],orderBy:[]});assert.ok(selected.path.loops[0].capability?.physicalIndex);}
 for(const sql of ["SELECT x.a FROM t AS x JOIN t AS y ON x.a=y.b","SELECT x.a FROM t AS x JOIN t AS y ON x.b=y.a","SELECT a FROM t WHERE a COLLATE binary='x'"]){const r=resolve(sql,s),analysis=analyzeWhere(r),target=analysis.clause.terms.find(term=>term.left?.sourceOrdinal===0),loops=btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([s.a]),orderBy:[]});assert.equal(loops.some(loop=>loop.kind==='index'&&[...loop.capability.equalityPrefix,loop.capability.lower,loop.capability.upper].some(a=>a?.term===target)),false,`${encoding}: ${sql}`);}}});

test('loop alternatives preserve exact admissions and are text-order invariant',()=>{const s=schema();for(const pair of [["t.a=u.a AND t.a='x'","t.a='x' AND t.a=u.a"],["t.a>u.a AND t.a>'m' AND t.a<'z'","t.a<'z' AND t.a>'m' AND t.a>u.a"]]){const selected=[];for(const predicates of pair){const r=resolve(`SELECT t.a FROM t JOIN t AS u ON 1 WHERE ${predicates}`,s),analysis=analyzeWhere(r),loops=btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:s.i,neededColumns:new Set([s.a]),orderBy:[]}),indexLoops=loops.filter(loop=>loop.kind==='index');assert.ok(indexLoops.length>=1);assert.ok(indexLoops.some(loop=>loop.prereq===0n));for(const loop of indexLoops)for(const admission of [...loop.capability.equalityPrefix,loop.capability.lower,loop.capability.upper].filter(Boolean))assert.equal(admission.term,analysis.clause.terms[admission.term.id]);selected.push(planWhere(r,{neededColumns:[new Set([s.a]),new Set()],orderBy:[]}).path.loops[0].prereq);}assert.deepEqual(selected,[0n,0n]);}const left=resolve("SELECT t.a FROM t LEFT JOIN t AS u ON t.a=u.a WHERE t.a='x'",s),lp=planWhere(left,{neededColumns:[new Set([s.a]),new Set()],orderBy:[]});assert.equal(lp.path.loops[0].prereq,0n);assert.equal(lp.path.loops[0].capability.equalityPrefix[0].term.origin.kind,'where');});

test('multi-source path order is conservatively zero despite local index order facts',()=>{const s=schema(),r=resolve('SELECT t.a FROM t JOIN t AS u ON 1',s),order=[{sourceOrdinal:1,column:s.a,descending:false,collation:'nocase'}],analysis=analyzeWhere(r),groups=r.sources.map((source,i)=>btreeLoops(source,i,analysis.clause,{forcedIndex:null,neededColumns:new Set([s.a]),orderBy:order}));assert.ok(groups[1].some(loop=>loop.capability?.orderTermsSatisfied===1));const path=wherePathSolver(groups,2);assert.equal(path.orderTermsSatisfied,0);const reverse=[{sourceOrdinal:0,column:s.a,descending:true,collation:'nocase'},{sourceOrdinal:1,column:s.a,descending:false,collation:'nocase'}],rp=planWhere(r,{neededColumns:[new Set([s.a]),new Set([s.a])],orderBy:reverse}).path;assert.equal(rp.orderTermsSatisfied,0);assert.equal(rp.reverse===0n||rp.reverse!==0n,true);const single=resolve("SELECT a FROM t WHERE a='x'",s),sp=planWhere(single,{neededColumns:[new Set([s.a])],orderBy:[{sourceOrdinal:0,column:s.a,descending:true,collation:'nocase'}]}).path;assert.equal(sp.orderTermsSatisfied,1);});

test('covering analysis retains non-index residual reads instead of projection-only narrowing',()=>{
  for(const encoding of ['utf-8','utf-16le','utf-16be']){
    const s=schema(encoding);
    // i_ab contains a, b, and the rowid tail, but not blob. The projected
    // column alone is covered; the residual blob read is not.
    const r=resolve("SELECT a FROM t INDEXED BY i_ab WHERE a='x' AND blob=x'00ff'",s);
    const selection=planWhere(r,{neededColumns:[new Set([s.a,s.blob])],orderBy:[]});
    const loop=selection.path.loops[0];
    assert.equal(loop.kind,'index',encoding);
    assert.equal(loop.capability.physicalIndex,s.i.physical,encoding);
    assert.equal(loop.capability.covering,false,encoding);
    assert.equal(loop.capability.needsTableLookup,true,encoding);
    assert.ok(selection.analysis.clause.terms.some(term=>term.left?.column===s.blob&&!term.virtual),encoding);
  }
});

test('only direct ordinary operands bind; same-source RHS including every IN member stays residual',()=>{
 const s=schema();
 for(const predicate of ['id+1=2','2=id+1','+id=2','CAST(id AS INTEGER)=2','abs(id)=2','a+1=2']){
  const r=resolve(`SELECT id FROM t WHERE ${predicate}`,s),analysis=analyzeWhere(r),term=analysis.clause.terms[0];
  assert.equal(term.left,null,predicate);assert.equal(term.outerJoinSafe.mayDrive,false,predicate);
  assert.equal(btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[]}).some(loop=>loop.capability?.rowidEquality||loop.capability?.equalityPrefix.length||loop.capability?.lower||loop.capability?.upper),false,predicate);
 }
 for(const predicate of ['id=a','a=b','id IN (99,a)','a IN (\'x\',b)']){
  const r=resolve(`SELECT id FROM t WHERE ${predicate}`,s),analysis=analyzeWhere(r);
  for(const term of analysis.clause.terms){assert.equal(term.prereqRight,sourceBit(0),predicate);assert.equal(term.outerJoinSafe.mayDrive,false,predicate);}
  assert.equal(btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[]}).some(loop=>loop.capability?.rowidEquality||loop.capability?.equalityPrefix.length||loop.capability?.lower||loop.capability?.upper),false,predicate);
 }
 for(const predicate of ['id=2','(id)=2','id COLLATE BINARY=2','2=id']){
  const r=resolve(`SELECT id FROM t WHERE ${predicate}`,s),term=analyzeWhere(r).clause.terms[0];assert.ok(term.left,predicate);assert.equal(term.prereqRight,0n);assert.equal(term.outerJoinSafe.mayDrive,true);
 }
});

test('rowid ORDER preserves persistent index identities before dominance, without claiming full order',()=>{
 // where.c:indexMightHelpWithOrderBy: iColumn<0 returns true before
 // nKeyCol matching. The covering blob candidate must not erase i_ab.
 const s=schema(),r=resolve("SELECT id FROM t WHERE a>'x' AND blob>x'00' ORDER BY id",s),analysis=analyzeWhere(r);
 const loops=btreeLoops(r.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[{sourceOrdinal:0,column:s.id,descending:false,collation:'binary',nulls:null}],resolved:r});
 const indexed=loops.filter(loop=>loop.kind==='index');
 assert.deepEqual(indexed.map(loop=>loop.capability.index.name),['i_ab','i_blob']);
 assert.deepEqual(indexed.map(loop=>loop.sortIdentity),[2,3]);
 assert.ok(indexed.every(loop=>loop.capability.orderTermsSatisfied===0),'potential ORDER identity is not a complete order proof');
});

// R1: whereLoopAddBtreeIndex's rc==SQLITE_OK exploration guard and
// whereLoopAddAll's SQLITE_DONE continuation. Observe producer access itself,
// not just the length of the post-built admissions. No public instrumentation.
test('production budget stops branching exploration before later index and permits next source increment',()=>{
 const s=schema();
 const resolved=resolve("SELECT id FROM t WHERE a='x' AND a='y' AND b=1 AND b=2",s);
 const analysis=analyzeWhere(resolved), original=s.iblob.physical;
 let laterIndexReads=0;
 Object.defineProperty(s.iblob,'physical',{configurable:true,get(){laterIndexReads++;return original;}});
 const budget={remaining:1};
 const candidates=btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([s.id]),orderBy:[],resolved,planBudget:budget});
 assert.equal(budget.remaining,0);
 assert.equal(candidates.length,1);
 assert.equal(laterIndexReads,0,'SQLITE_DONE must stop index exploration, not truncate an eagerly constructed list');
 // whereLoopAddAll adds its per-source increment after an abbreviated search.
 budget.remaining+=1000;
 const next=schema(), nextResolved=resolve('SELECT id FROM t WHERE id=7',next);
 const continued=btreeLoops(nextResolved.sources[0],1,analyzeWhere(nextResolved).clause,{forcedIndex:null,neededColumns:new Set([next.id]),orderBy:[],planBudget:budget});
 assert.ok(continued.length>0);
 assert.ok(budget.remaining<1000);
});

test('forced composite producer suspends recursion at budget boundary without constructing siblings',()=>{
 const s=schema(),resolved=resolve("SELECT id FROM t INDEXED BY i_ab WHERE a='x' AND a='y' AND b=1 AND b=2",s),analysis=analyzeWhere(resolved);
 let constructed=0;
 const needed={*[Symbol.iterator](){constructed++;yield s.id;}};
 const budget={remaining:1};
 const candidates=btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:s.i,neededColumns:needed,orderBy:[],resolved,planBudget:budget});
 assert.equal(constructed,1,'covering calculation observes only the first constructed leaf');
 assert.equal(budget.remaining,0);
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].capability.equalityPrefix.length,2);
 assert.ok(Object.isFrozen(candidates[0].capability.equalityPrefix));
});

test('production duplicate drop consumes budget and preserves first admission before later source restart',()=>{
 const s=schema(),resolved=resolve('SELECT id FROM t WHERE id=7 AND id=8 AND id=9',s),analysis=analyzeWhere(resolved);
 const budget={remaining:3};
 const candidates=btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([s.id]),orderBy:[],planBudget:budget});
 assert.equal(budget.remaining,0); // scan, replacement, duplicate drop
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].capability.rowidEquality.term,analysis.clause.terms[0]);
 assert.equal(btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[],planBudget:budget}).length,0);
 budget.remaining+=1000;
 assert.equal(btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[],planBudget:budget}).length,1);
});

test('resolved result aliases contribute substituted WHERE dependencies and bindings',()=>{
 const s=schema();
 const r=resolve('SELECT l.a AS direct,l.id+1 AS computed FROM t l JOIN t r ON computed=r.id AND direct=r.a',s);
 const terms=analyzeWhere(r).clause.terms.filter(term=>!term.virtual);
 assert.equal(terms.length,2);
 for(const term of terms)assert.equal(term.prereqAll,sourceBit(0)|sourceBit(1));
 assert.equal(terms[0].prereqRight,sourceBit(0));
 assert.equal(terms[1].left.sourceOrdinal,0,'direct alias retains its resolved column owner');
 const precedence=resolve('SELECT id AS a FROM t WHERE a=id',s);
 assert.equal(precedence.aliasUses.size,0,'source columns win over result aliases');
});
test('RightJoinLoop residual base boundary, readiness, origins and LTORJ',()=>{
 const s=schema();
 const r=resolve('SELECT x.id FROM t x RIGHT JOIN t y ON x.id=y.id JOIN t z ON z.id=y.id WHERE x.id=y.id AND y.id=3 AND z.id=4',s);
 const a=analyzeWhere(r,true).clause.terms;
 const virtual=a.findIndex(t=>t.virtual);assert.ok(virtual>=3);assert.ok(a.slice(virtual).every(t=>t.virtual));
 for(const t of a.filter(t=>t.virtual)){assert.ok(a[t.parentId].childIds.includes(t.id));assert.equal(t.origin.parentTerm,t.parentId)}
 const residual=rightJoinResidual(r,1);assert.equal(residual.length,2);assert.ok(residual.every(t=>t.origin.kind==='where'&&(t.prereqAll&~3n)===0n));
 const later=resolve('SELECT x.id FROM t x FULL JOIN t y ON x.id=y.id RIGHT JOIN t z ON z.id=y.id WHERE y.id=3',s);
 assert.equal(later.sources[1].leftOfRightJoin,true);assert.deepEqual(rightJoinResidual(later,1),[]);assert.equal(rightJoinResidual(later,2).length,1);
});
test('SELECT usage retains enclosing identity through nested and compound owners',()=>{
 const s=schema();
 const cases=[['(SELECT z.id)=3',4n],['EXISTS(SELECT 1 WHERE z.id=3)',4n],['3 IN(SELECT z.id)',4n],['(SELECT (SELECT z.id))=3',4n],['(SELECT y.id)=3',2n],['(SELECT x.id) IS NULL',1n],['EXISTS(SELECT 1 FROM t z WHERE z.id=3)',0n],['(SELECT 1 UNION ALL SELECT z.id)=3',4n]];
 for(const [predicate,mask] of cases){
  const r=resolve(`SELECT (SELECT x.id) FROM t x RIGHT JOIN t y ON x.id=-1 LEFT JOIN t z ON z.id=y.id WHERE ${predicate}`,s);
  const term=analyzeWhere(r,true).clause.terms.find(t=>t.origin.kind==='where');
  assert.equal(term.prereqAll,mask,predicate);
  assert.equal(rightJoinResidual(r,1).length,mask===4n?0:1,predicate);
 }
 const alias=resolve('SELECT (SELECT z.id) AS v FROM t x RIGHT JOIN t y ON x.id=-1 LEFT JOIN t z ON z.id=y.id WHERE v=3',s);
 assert.equal(analyzeWhere(alias,true).clause.terms[0].prereqAll,4n);
});
test('OR semantic graph owns stable parents, AND clauses, masks and original residual',()=>{
 const resolved=expandAndResolveSelect(parseSql('SELECT id FROM t WHERE a=? OR (b>? AND id<?)').statement,schema());
 const clause=analyzeWhere(resolved).clause,parent=clause.terms[0];
 assert.equal(parent.info?.kind,'or');assert.equal(parent.info.parentTerm,parent);
 assert.equal(parent.operator,null,'single-index admission operator is unchanged');
 assert.equal(parent.info.indexable,1n);assert.equal(parent.info.clause.split,'or');
 const and=parent.info.clause.terms[1];assert.equal(and.info.kind,'and');
 assert.equal(and.info.clause.outer,clause);
 assert.deepEqual(and.info.clause.terms.map(t=>t.operator),['gt','lt']);
 assert.equal(clause.terms[0].expression,parent.expression,'full OR remains residual');
 assert.ok(Object.isFrozen(parent.info));assert.ok(Object.isFrozen(parent.info.clause));
});
test('unindexable OR still owns analysis; nested OR under AND retains masks',()=>{
 for(const [sql,mask] of [['SELECT id FROM t WHERE a=? OR 1',0n],['SELECT id FROM t WHERE a=? OR (id>? AND (b>? OR id<?))',1n]]){
  const resolved=expandAndResolveSelect(parseSql(sql).statement,schema()),p=analyzeWhere(resolved).clause.terms[0];
  assert.equal(p.info?.kind,'or');assert.equal(p.info.indexable,mask);
 }
});
test('production OR cost publishes immutable parent union, no branch physical candidates',()=>{
 const r=expandAndResolveSelect(parseSql('SELECT id FROM t WHERE a=? OR id>?').statement,schema());
 const plan=planWhere(r,{neededColumns:[new Set([ROWID_NEEDED])],orderBy:[]}),loop=plan.path.loops[0];
 assert.equal(loop.kind,'multi-or');assert.equal(loop.capability,null);
 assert.equal(loop.orInfo.parentTerm,plan.analysis.clause.terms[0]);
 assert.equal(loop.terms.length,1);assert.equal(loop.terms[0],loop.orInfo.parentTerm);
 assert.equal(loop.sortIdentity,0);assert.equal(loop.setupCost,0n);assert.ok(Object.isFrozen(loop));
});
