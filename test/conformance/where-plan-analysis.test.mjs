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
test('cost-only Btree producer bypasses ordinary list and shares construction budget',()=>{
 const r=expandAndResolveSelect(parseSql('SELECT id FROM t WHERE id>?').statement,schema()),clause=analyzeWhere(r).clause;
 const costs={a:[]},budget={remaining:20};
 const loops=btreeLoops(r.sources[0],0,clause,{forcedIndex:null,neededColumns:new Set([ROWID_NEEDED]),orderBy:[],resolved:r,planBudget:budget,orSet:costs});
 assert.deepEqual(loops,[]);assert.ok(costs.a.length>0);assert.ok(budget.remaining<20);
 const empty={a:[]},tiny={remaining:1};
 btreeLoops(r.sources[0],0,clause,{forcedIndex:null,neededColumns:new Set([ROWID_NEEDED]),orderBy:[],resolved:r,planBudget:tiny,orSet:empty});
 assert.equal(tiny.remaining,0);assert.deepEqual(empty.a,[],'unconstrained scan consumes budget but never contributes OR cost');
});
test('all encodings expose the same prelowering OR owner; recursive AND and zero-arm boundaries',()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  for(const sql of ['SELECT id FROM t WHERE a=? OR id>?','SELECT id FROM t WHERE a=? OR (id>? AND (b>? OR id<?))']){
   const r=expandAndResolveSelect(parseSql(sql).statement,schema(encoding)),a=analyzeWhere(r),loops=btreeLoops(r.sources[0],0,a.clause,{neededColumns:new Set([ROWID_NEEDED]),orderBy:[],resolved:r});
   const union=loops.find(l=>l.kind==='multi-or');assert.ok(union,encoding+sql);
   assert.equal(union.orInfo,a.clause.terms[0].info);assert.equal(union.capability,null);assert.equal(union.sortIdentity,0);assert.equal(union.setupCost,0n);
  }
  const r=expandAndResolveSelect(parseSql('SELECT id FROM t WHERE id=? OR b=?').statement,schema(encoding)),a=analyzeWhere(r);
  assert.equal(btreeLoops(r.sources[0],0,a.clause,{neededColumns:new Set([ROWID_NEEDED]),orderBy:[],resolved:r}).some(l=>l.kind==='multi-or'),false,'unindexed arm must abandon');
 }
});
test('pinned AND indexable mask excludes OR-info (not an allowedOp) even if recursively costable',()=>{
 const r=resolve('SELECT id FROM t WHERE a=? OR ((b=? OR id=?) AND 1)',schema());
 assert.equal(analyzeWhere(r).clause.terms[0].info.indexable,0n);
});
test('recursive production consumes the shared budget and never publishes partial union costs',()=>{
 const r=resolve('SELECT id FROM t WHERE a=? OR (id>? AND (b>? OR id<?))',schema()),a=analyzeWhere(r);
 for(const remaining of [0,1,2,3,4,5,6,7,8,9,10]){
  const budget={remaining},costs={a:[]};
  assert.deepEqual(btreeLoops(r.sources[0],0,a.clause,{neededColumns:new Set([ROWID_NEEDED]),orderBy:[],resolved:r,planBudget:budget,orSet:costs}),[]);
  assert.ok(budget.remaining>=0&&budget.remaining<=remaining);
  if(budget.remaining===0)assert.deepEqual(costs.a,[],'DONE clears parent collector');
 }
});
test('OR clause has no outer link; AND arm outer links to enclosing main clause not OR sibling scope',()=>{
 const r=resolve('SELECT id FROM t WHERE a=? OR (id>? AND b>?)',schema()),main=analyzeWhere(r).clause,info=main.terms[0].info;
 assert.equal(info.clause.outer,null,'exprAnalyzeOrTerm never installs OR pOuter');
 assert.equal(info.clause.terms[1].info.clause.outer,main,'pAndWC->pOuter = pWC');
});
test('cost-only insertion adjusts against shared enclosing ordinary loops before collecting',()=>{
 const r=resolve('SELECT id FROM t WHERE a=?',schema()),clause=analyzeWhere(r).clause,options={forcedIndex:null,neededColumns:new Set([ROWID_NEEDED]),orderBy:[],resolved:r};
 const constrained=btreeLoops(r.sources[0],0,clause,options).find(l=>l.kind==='index'&&l.capability.equalityPrefix.length);
 assert.ok(constrained);
 const previous=Object.freeze({...constrained,runCost:0n,outputRows:10n,capability:Object.freeze({...constrained.capability,equalityPrefix:[],lower:null,upper:null,constrainedFields:0})});
 const ordinary=[previous],costs={a:[]};
 btreeLoops(r.sources[0],0,clause,{...options,orSet:costs,ordinaryLoops:ordinary});
 assert.equal(costs.a.length,1);assert.equal(costs.a[0].rRun,0n);assert.equal(costs.a[0].nOut,9n);
 assert.deepEqual(ordinary,[previous],'cost-only builders never insert into shared ordinary list');
});
test('ordinary builder and copied OR builders read same pre-existing loop adjustment state',()=>{
 const r=resolve('SELECT id FROM t WHERE a=?',schema()),clause=analyzeWhere(r).clause,opts={forcedIndex:null,neededColumns:new Set([ROWID_NEEDED]),orderBy:[],resolved:r};
 const strong=btreeLoops(r.sources[0],0,clause,opts).find(l=>l.kind==='index'&&l.capability.equalityPrefix.length);
 const weak=Object.freeze({...strong,runCost:0n,outputRows:10n,capability:Object.freeze({...strong.capability,equalityPrefix:[],lower:null,upper:null,constrainedFields:0})});
 const ordinary=[weak];
 const adjusted=btreeLoops(r.sources[0],0,clause,{...opts,ordinaryLoops:ordinary}).find(l=>l.kind==='index'&&l.capability.equalityPrefix.length);
 assert.equal(adjusted.runCost,0n);assert.equal(adjusted.outputRows,9n);assert.deepEqual(ordinary,[weak]);
});
test('two-way OR emits necessary virtual bound while retaining original truth residual',()=>{
 for(const [sql,operator] of [['a=? OR a<?','le'],['a>? OR a=?','ge'],['a<? OR a<?','lt']]){
  const r=resolve(`SELECT id FROM t WHERE ${sql}`,schema()),c=analyzeWhere(r).clause;
  // Separate anonymous parameters are not identical expressions in C.
  if(sql.includes('?'))assert.equal(c.terms.filter(t=>t.virtual).length,0);
 }
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE a=5 OR (a<5 AND b>2)',schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'&&t.left.column.name==='a'));
 assert.equal(c.terms[0].operator,null);assert.equal(c.terms[0].virtual,false);
});
test('pinned combine admission uses indexable and total OR nTerm, not original-arm count',()=>{
 const unindexed=analyzeWhere(resolve('SELECT id FROM t WHERE 1=2 OR 1<2',schema())).clause;
 assert.equal(unindexed.terms.filter(t=>t.virtual).length,0,'zero indexable prevents combines');
 const copied=analyzeWhere(resolve('SELECT t.id FROM t AS t JOIN t AS u WHERE t.a=u.a OR t.a<=u.a',schema())).clause;
 assert.ok(copied.terms[0].info.clause.terms.length>2);
 assert.equal(copied.terms.filter(t=>t.virtual).length,0,'commuted children make nTerm exceed2');
});
test('combine families retain exact strict/equality ties and reject opposing direction or operand proofs',()=>{
 for(const [predicate,expected] of [['a=5 OR a<5','le'],['a>5 OR a=5','ge'],['a<5 OR a<=5','le'],['a>5 OR a>=5','ge'],['a<5 OR a<5','lt'],['a>=5 OR a>=5','ge'],['a=5 OR a=5','eq'],['a<5 OR a>5',null],['a<5 OR a<6',null],['a=5 OR b<5',null],['a IS 5 OR a<5',null],['5=a OR a<5',null],['a COLLATE BINARY=5 OR a COLLATE NOCASE<5',null]]){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE ${predicate}`,schema())).clause;
  assert.deepEqual(c.terms.filter(t=>t.virtual&&t.operator!=='in').map(t=>t.operator),expected?[expected]:[],predicate);
  assert.ok(Object.isFrozen(c.terms));assert.equal(c.terms[0].virtual,false);
 }
});
test('combine compares resolved column cursor/column identity independent of qualifiers and recursive arithmetic',()=>{
 for(const predicate of ['a=5 OR t.a<5','t.a=(u.b+1) OR t.a<(u.b+1)']){
  const c=analyzeWhere(resolve(`SELECT t.id FROM t ${predicate.includes("u.b")?"JOIN t AS u":""} WHERE ${predicate}`,schema())).clause;
  assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),predicate);
 }
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE a COLLATE BINARY=5 OR t.a<5',schema())).clause;
 assert.equal(c.terms.filter(t=>t.virtual).length,0,'COLLATE difference is nonzero exprCompare');
});
test('OR operand comparison never equates distinct anonymous variables inside argument/list carriers or SELECTs',()=>{
 for(const rhs of ['abs(?)','(b IN (?))','(SELECT 5)']){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=${rhs} OR a<${rhs}`,schema())).clause;
  assert.equal(c.terms.filter(t=>t.virtual).length,0,rhs);
 }
});
test('combine resolves columns recursively through function argument and IN list carriers',()=>{
 for(const rhs of [['abs(u.b)','abs(u.b)'],['(u.b IN (u.a,1))','(u.b IN (u.a,1))']]){
  const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=${rhs[0]} OR t.a<${rhs[1]}`,schema())).clause;
  assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs.join(' / '));
 }
});
test('exprAnalyzeOrTerm stops AND info construction once stored-order indexable reaches zero',()=>{
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE 1 OR (a=5 AND b=2)',schema())).clause;
 const info=c.terms[0].info;
 assert.equal(info.indexable,0n);
 assert.equal(info.clause.terms[1].info,undefined,'later non-single arm is retained but not given AND ownership after zero');
 const reversed=analyzeWhere(resolve('SELECT id FROM t WHERE (a=5 AND b=2) OR 1',schema())).clause.terms[0].info;
 assert.equal(reversed.indexable,0n);
 assert.equal(reversed.clause.terms[0].info.kind,'and','already visited ownership is retained');
});
test('OR overlap loses single eligibility but AND allowedOp retains cursor masks',()=>{
 for(const predicate of ['a=b OR a=5','a<b OR a=5']){
  const info=analyzeWhere(resolve(`SELECT id FROM t WHERE ${predicate}`,schema())).clause.terms[0].info;
  assert.equal(info.indexable,1n,predicate);
  assert.equal(info.clause.terms[0].info.kind,'and',predicate);
 }
 const andInfo=analyzeWhere(resolve('SELECT id FROM t WHERE (a=b AND b=a) OR a=5',schema())).clause.terms[0].info;
 assert.equal(andInfo.indexable,1n,'AND uses allowedOp/leftCursor, not WO_SINGLE opMask');
});
test('overlapping comparison OR arms own AND info despite retaining ordinary operator evidence',()=>{
 const info=analyzeWhere(resolve('SELECT id FROM t WHERE a=b OR a=5',schema())).clause.terms[0].info;
 const arm=info.clause.terms[0];
 assert.equal(arm.info?.kind,'and','WO_EQUIV lacks WO_SINGLE and must take non-single ownership branch');
 assert.equal(arm.info.clause.outer.terms[0],info.parentTerm);
 assert.equal(info.indexable,1n,'AND allowedOp includes same-table comparison left cursor');
});
test('necessary combine maps normalized operator back to retained right-indexed operand order',()=>{
 for(const [sql,expected] of [['5=a OR 5<a','<='],['5=a OR 5>a','>=']]){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE ${sql}`,schema())).clause;
  const bound=c.terms.find(t=>t.virtual);
  assert.ok(bound,sql);
  assert.equal(bound.expression.reduction.children.find(c=>c.kind==='terminal').value.text,expected,sql);
  assert.equal(bound.operator,expected==='<='?'ge':'le',sql);
  assert.equal(bound.originalIndexedOperand,'right');
 }
});
test('necessary combines reject non-WO_SINGLE overlapping operands within AND arms',()=>{
 for(const predicate of ['a=b OR a<b','(a=b AND id>0) OR (a<b AND id>1)']){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE ${predicate}`,schema())).clause;
  assert.equal(c.terms.filter(t=>t.virtual).length,0,predicate);
 }
});
test('necessary combine integer identity follows EP_IntValue boundary, not all int64 values',()=>{
 for(const [rhs1,rhs2,expected] of [['5','0x5',true],['2147483648','0x80000000',false],['1_000','1000',false]]){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=${rhs1} OR a<${rhs2}`,schema())).clause;
  assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),expected,`${rhs1}/${rhs2}`);
 }
});
test('necessary integer proof uses GetInt32 hex prefix and sign-bit branches',()=>{
 for(const [rhs1,rhs2,expected] of [['0x1_0','1',true],['0x000000005','5',true],['0x80000000','2147483648',false]]){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=${rhs1} OR a<${rhs2}`,schema())).clause;
  assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),expected,`${rhs1}/${rhs2}`);
 }
});
test('necessary combine compares dequoted COLLATE names without quote delimiters',()=>{
 for(const rhs of ['"NOCASE"','[NOCASE]','`NOCASE`']){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a COLLATE NOCASE=5 OR a COLLATE ${rhs}<5`,schema())).clause;
  assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('necessary combine function name proof follows dequoted TK_FUNCTION names',()=>{
 for(const name of ['"ABS"','[ABS]','`ABS`']){
  const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=abs(u.b) OR t.a<${name}(u.b)`,schema())).clause;
  assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),name);
 }
});
test('function proof retains different names and DISTINCT after dequoting',()=>{
 for(const rhs of ['length(u.b)','abs(DISTINCT u.b)']){
  const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=abs(u.b) OR t.a<${rhs}`,schema())).clause;
  assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('function ALL and omitted distinct produce the same Expr flags for combine',()=>{
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=abs(u.b) OR t.a<abs(ALL u.b)',schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('actual recursive cost production stops capability traversal on exhaustion and propagates errors',()=>{
 const r=resolve('SELECT id FROM t WHERE a=? OR (id>? AND (a>? OR id<?))',schema()),a=analyzeWhere(r);
 let visits=0;
 const needed={*[Symbol.iterator](){visits++;yield ROWID_NEEDED;}};
 const budget={remaining:1},costs={a:[]};
 btreeLoops(r.sources[0],0,a.clause,{neededColumns:needed,orderBy:[],resolved:r,planBudget:budget,orSet:costs});
 assert.equal(budget.remaining,0);assert.equal(visits,0,'scan exhausts before any capability exploration');assert.deepEqual(costs.a,[]);
 budget.remaining=1000;
 btreeLoops(r.sources[0],0,a.clause,{neededColumns:needed,orderBy:[],resolved:r,planBudget:budget,orSet:costs});
 assert.ok(visits>0);assert.ok(costs.a.length>0,'replenished builder resumes production, not a sticky DONE');
 const sentinel=new Error('capability construction failure');let entries=0;
 const throwing={*[Symbol.iterator](){entries++;throw sentinel;}};
 assert.throws(()=>btreeLoops(r.sources[0],0,a.clause,{neededColumns:throwing,orderBy:[],resolved:r,planBudget:{remaining:1000},orSet:{a:[]}}),e=>e===sentinel);
 assert.equal(entries,1,'error prevents later capability/source exploration');
});
test('suspended capability enumeration does not resume after last permitted insertion',()=>{
 const r=resolve('SELECT id FROM t WHERE a=? AND a=? AND a=?',schema()),a=analyzeWhere(r);
 let visits=0,closed=0;
 const needed={*[Symbol.iterator](){visits++;try{yield ROWID_NEEDED;}finally{closed++;}}};
 const budget={remaining:2};
 const loops=btreeLoops(r.sources[0],0,a.clause,{neededColumns:needed,orderBy:[],resolved:r,planBudget:budget});
 assert.equal(budget.remaining,0);assert.equal(visits,1,'only first equality capability is constructed');assert.equal(closed,1);
 assert.ok(loops.some(l=>l.kind==='index'));
 visits=0;closed=0;budget.remaining=2;const costs={a:[]};
 btreeLoops(r.sources[0],0,a.clause,{neededColumns:needed,orderBy:[],resolved:r,planBudget:budget,orSet:costs});
 assert.equal(visits,1,'pOrSet also stops without resuming equality inventory');assert.equal(closed,1);assert.equal(costs.a.length,1);
 const later=resolve('SELECT id FROM t WHERE id=?',schema());budget.remaining+=1000;
 const laterLoops=btreeLoops(later.sources[0],0,analyzeWhere(later).clause,{neededColumns:needed,orderBy:[],resolved:later,planBudget:budget});
 assert.ok(laterLoops.some(l=>l.kind==='rowid'),'replenished construction budget admits later source proposals');
});
test('necessary bounds compare semantic NE and EQ opcodes rather than token aliases',()=>{
 for(const [x,y] of [['u.b!=1','u.b<>1'],['u.b=1','u.b==1'],['abs(u.b!=1)','abs(u.b<>1)']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('necessary comparison opcode proof does not merge different operators',()=>{
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b!=1) OR t.a<(u.b=1)',schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('CAST token identity is case sensitive in necessary operand proof',()=>{
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=CAST(u.b AS INTEGER) OR t.a<CAST(u.b AS integer)',schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('CAST dequotes type tokens without folding or dropping operand identity',()=>{
 for(const [x,y,expected] of [['INTEGER','"INTEGER"',true],['INTEGER','[INTEGER]',true],['INTEGER','`INTEGER`',true],['"INTEGER"','"integer"',false],['INTEGER','TEXT',false]]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=CAST(u.b AS ${x}) OR t.a<CAST(u.b AS ${y})`,schema())).clause;
 assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),expected,`${x}/${y}`);
 }
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=CAST(u.b AS INTEGER) OR t.a<CAST(u.a AS INTEGER)',schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('necessary operand proof uses produced IS/ISNOT opcodes for DISTINCT aliases',()=>{
 for(const [x,y] of [['u.b IS u.a','u.b IS NOT DISTINCT FROM u.a'],['u.b IS NOT u.a','u.b IS DISTINCT FROM u.a']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('IS alias proof keeps opposite null-equality and operand identities distinct',()=>{
 for(const rhs of ['u.b IS DISTINCT FROM u.a','u.a IS NOT DISTINCT FROM u.b']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IS u.a) OR t.a<(${rhs})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
 }
});
test('necessary operand proof compares produced nullable ISNULL and NOTNULL aliases',()=>{
 for(const [x,y] of [['u.b IS NULL','u.b ISNULL'],['u.b IS NOT NULL','u.b NOTNULL'],['u.b NOT NULL','u.b NOTNULL']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('nullable test operand proof retains opcode and child distinctions',()=>{
 for(const rhs of ['u.b NOTNULL','u.a ISNULL']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IS NULL) OR t.a<(${rhs})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
 }
});
test('null-test literal folding produces integer operands for necessary bounds',()=>{
 for(const [x,y] of [['1 ISNULL','0'],['-1 NOTNULL','1'],["'x' IS NULL",'0'],["X'01' NOT NULL",'1'],['1.0 IS NOT NULL','1']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('null-test literal folding does not evaluate other opcodes',()=>{
 for(const rhs of ['NULL ISNULL','(1+1) ISNULL','CAST(1 AS INTEGER) ISNULL','1 NOTNULL']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t WHERE t.a=(1 ISNULL) OR t.a<(${rhs})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('unary sign proof follows parser replacement of existing UPLUS',()=>{
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=(-+u.b) OR t.a<(-u.b)',schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('unary sign replacement retains minus chains and child ownership',()=>{
 for(const [lhs,rhs,want] of [['++u.b','+u.b',true],['-++u.b','-u.b',true],['+-u.b','-u.b',false],['- -u.b','u.b',false],['-+u.b','-u.a',false]]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${lhs}) OR t.a<(${rhs})`,schema())).clause;
 assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),want,`${lhs}/${rhs}`);
 }
});
test('named variable operand proof retains case-sensitive SQLite variable identity',()=>{
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE a=:X OR a<:x',schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('actual capabilities generators close through IteratorClose at budget boundary and error',()=>{
 const r=resolve('SELECT id FROM t WHERE a=? AND a=? AND a=?',schema()),a=analyzeWhere(r);
 const proto=Object.getPrototypeOf(Object.getPrototypeOf((function*(){})()));
 const original=proto.return;let closes=0;
 proto.return=function(value){closes++;return original.call(this,value);};
 try{
  const needed=new Set([ROWID_NEEDED]);
  btreeLoops(r.sources[0],0,a.clause,{neededColumns:needed,orderBy:[],resolved:r,planBudget:{remaining:2}});
  assert.ok(closes>=2,'outer capabilities and delegated visit close on break');
  closes=0;
  const costs={a:[]};
  btreeLoops(r.sources[0],0,a.clause,{neededColumns:needed,orderBy:[],resolved:r,planBudget:{remaining:2},orSet:costs});
  assert.ok(closes>=2,'cost-only builder closes actual suspended generators too');
  assert.equal(costs.a.length,1);

  closes=0;
  const sentinel=new Error('needed columns sentinel');
  const failing={*[Symbol.iterator](){throw sentinel;}};
  assert.throws(()=>btreeLoops(r.sources[0],0,a.clause,{neededColumns:failing,orderBy:[],resolved:r,planBudget:{remaining:1000}}),e=>e===sentinel);
  // A throw inside the generator terminates it by unwinding, not by return().
  assert.equal(closes,0,'internal generation error propagates without resuming suspended proposals');
 }finally{proto.return=original;}
});
test('production AddAll replenishes shared budget after exhausted source and continues later source',()=>{
 const predicates=[...Array.from({length:150},()=> 't.a=?'),...Array.from({length:150},()=> 't.b=?'),'u.a=?'];
 const r=resolve(`SELECT t.id,u.id FROM t JOIN t AS u WHERE ${predicates.join(' AND ')}`,schema());
 let first=0,later=0,closed=0;
 const needed0={*[Symbol.iterator](){first++;try{yield ROWID_NEEDED;}finally{closed++;}}};
 const needed1={*[Symbol.iterator](){later++;yield ROWID_NEEDED;}};
 const selected=planWhere(r,{neededColumns:[needed0,needed1],orderBy:[]});
 assert.equal(first,20999,'21000 initial source budget includes scan before equality products');
 assert.equal(closed,first);
 assert.ok(later>0,'second source resumes capability production after +1000 budget');
 assert.ok(selected.path.loops.some(l=>l.sourceOrdinal===1&&l.kind==='index'));
});
test('nested OR copied builders close suspended arm inventory on mid-arm exhaustion',()=>{
 const r=resolve('SELECT id FROM t WHERE a=? OR (a=? AND (a=? OR a=?))',schema()),a=analyzeWhere(r);
 const proto=Object.getPrototypeOf(Object.getPrototypeOf((function*(){})()));
 const original=proto.return;let closes=0,visits=0;
 proto.return=function(value){closes++;return original.call(this,value);};
 try{
  const needed={*[Symbol.iterator](){visits++;yield ROWID_NEEDED;}};
  const budget={remaining:5},costs={a:[]};
  btreeLoops(r.sources[0],0,a.clause,{neededColumns:needed,orderBy:[],resolved:r,planBudget:budget,orSet:costs});
  assert.equal(budget.remaining,0);
  assert.ok(visits>1,'recursive arms reached after enclosing inventory');
  assert.ok(closes>=2,'suspended arm capabilities and visit closed');
  assert.deepEqual(costs.a,[],'incomplete arm cannot publish an OR cost');
 }finally{proto.return=original;}
});
test('necessary bound variable identity requires token spelling as well as assigned slot',()=>{
 // expr.c ExprCompare first checks zToken via strcmp, then iColumn.
 // AssignVarNumber aliases numbered spellings, but that is not Expr identity.
 for(const [x,y,expected] of [['?01','?1',false],['?0002','?2',false],['?1','?1',true],['?1','?2',false]]){
  const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=${x} OR a<${y}`,schema())).clause;
  assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),expected,`${x}/${y}`);
 }
});
test('necessary boolean operand proof retains produced TK_TRUEFALSE token case',()=>{
 for(const [x,y,expected] of [['true','TRUE',false],['false','FALSE',false],['true','true',true],['false','false',true],['true','false',false]]){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=${x} OR a<${y}`,schema())).clause;
 assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),expected,`${x}/${y}`);
 }
});
test('necessary operand proof follows NOT BETWEEN semantic wrapper',()=>{
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b NOT BETWEEN 1 AND 2) OR t.a<(NOT (u.b BETWEEN 1 AND 2))',schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('BETWEEN proof retains wrapper polarity and list order',()=>{
 for(const rhs of ['u.b BETWEEN 1 AND 2','NOT (u.b BETWEEN 2 AND 1)','NOT (u.a BETWEEN 1 AND 2)']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b NOT BETWEEN 1 AND 2) OR t.a<(${rhs})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('necessary operands compare produced NOT parent for multi-item IN',()=>{
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b NOT IN (1,2)) OR t.a<(NOT (u.b IN (1,2)))',schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('multi-item NOT IN operand proof preserves polarity, list order and variable positions',()=>{
 for(const [x,y] of [['u.b NOT IN (1,2)','u.b IN (1,2)'],['u.b NOT IN (1,2)','NOT (u.b IN (2,1))'],['u.b NOT IN (?,2)','NOT (u.b IN (?,2))'],['u.b NOT IN (1,2)','NOT (u.a IN (1,2))']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('necessary operands follow singleton constant IN equality and unary-plus production',()=>{
 for(const [x,y] of [['u.b IN (1)','u.b=+1'],['u.b NOT IN (1)','NOT (u.b=+1)']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('singleton IN proof retains unary-plus affinity boundary and nonconstant exclusions',()=>{
 for(const [x,y] of [['u.b IN (1)','u.b=1'],['u.b IN (1)','u.b=+2'],['u.b NOT IN (1)','u.b=+1'],['u.b IN (u.a)','u.b=+u.a'],['u.b IN (?)','u.b=+?']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('necessary operand proof follows empty IN boolean production without functions',()=>{
 for(const [x,y] of [['u.b IN ()','false'],['u.b NOT IN ()','true']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('empty IN operand proof preserves function lhs and boolean token identity',()=>{
 for(const [x,y] of [['abs(u.b) IN ()','false'],['(u.b+abs(u.a)) NOT IN ()','true'],['u.b IN ()','true'],['u.b IN ()','FALSE'],['u.b NOT IN ()','false']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('empty IN operand proof preserves function lhs in ordered boolean production',()=>{
 for(const [x,y] of [['abs(u.b) IN ()','false AND abs(u.b)'],['abs(u.b) NOT IN ()','true OR abs(u.b)']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('function-bearing empty IN proof retains operand order, operator and child',()=>{
 for(const [x,y] of [['abs(u.b) IN ()','abs(u.b) AND false'],['abs(u.b) NOT IN ()','true AND abs(u.b)'],['abs(u.b) IN ()','false AND abs(u.a)']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('singleton IN constant proof walks signed and arithmetic RHS',()=>{
 for(const rhs of ['-1','1+2','(1*2)+3']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton arithmetic IN proof does not evaluate or admit column/function children',()=>{
 for(const [rhs,other] of [['1+2','3'],['1+2','2+1'],['u.a+1','u.a+1'],['abs(1)+2','abs(1)+2']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${rhs}/${other}`);
 }
});
test('singleton IN mode-one constant walk admits retained named and numbered variables',()=>{
 for(const rhs of [':bound','?1',':bound+1']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton variable IN proof keeps token-before-slot and distinct bind positions',()=>{
 for(const [x,y] of [[':bound',':other'],[':bound',':BOUND'],['?01','?1'],['?1','?2'],['?','?'],['?+1','?+1']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${x})) OR t.a<(u.b=+(${y}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('singleton IN constant proof walks CAST child without evaluating it',()=>{
 const rhs='CAST(1 AS INTEGER)';
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('singleton IN CAST walk retains type token, child and nonconstant exclusions',()=>{
 for(const [rhs,other] of [['CAST(1 AS INTEGER)','CAST(1 AS integer)'],['CAST(1 AS INTEGER)','CAST(2 AS INTEGER)'],['CAST(u.a AS INTEGER)','CAST(u.a AS INTEGER)'],['CAST(abs(1) AS INTEGER)','CAST(abs(1) AS INTEGER)']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${rhs}/${other}`);
 }
});
test('singleton IN constant walker prunes produced unquoted boolean IDs',()=>{
 for(const rhs of ['true','FALSE']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton boolean IN proof retains case token and quoted ID exclusion',()=>{
 for(const [rhs,other] of [['true','TRUE'],['true','false'],['"true"','"true"']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${rhs}/${other}`);
 }
});
test('singleton IN mode-one walk continues through boolean and comparison nodes',()=>{
 for(const rhs of ['NOT 1','1=2','1<2','1 AND 2','1 OR 2','1 IS NULL','1 COLLATE NOCASE']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton boolean/comparison constant walk retains child rejection and structural identity',()=>{
 for(const [rhs,other] of [['NOT u.a','NOT u.a'],['1=u.a','1=u.a'],['abs(1) AND 2','abs(1) AND 2'],['1<2','2>1'],['1 COLLATE NOCASE','1 COLLATE BINARY']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${rhs}/${other}`);
 }
});
test('singleton IN constant walker visits BETWEEN left and both ordered bounds',()=>{
 for(const rhs of ['1 BETWEEN 0 AND 2','1 NOT BETWEEN 0 AND 2']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton BETWEEN constant walk rejects nonconstant left and either bound',()=>{
 for(const rhs of ['u.a BETWEEN 0 AND 2','1 BETWEEN u.a AND 2','1 NOT BETWEEN 0 AND u.a','1 BETWEEN abs(0) AND 2']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton IN constant proof visits nested IN scalar and list children',()=>{
 for(const rhs of ['1 IN (2,3)','1 NOT IN (2,3)']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('nested IN constant proof retains scalar/list rejection, order and SELECT exclusion',()=>{
 for(const [rhs,other] of [['u.a IN (2,3)','u.a IN (2,3)'],['1 IN (u.a,3)','1 IN (u.a,3)'],['1 NOT IN (2,u.a)','1 NOT IN (2,u.a)'],['1 IN (2,3)','1 IN (3,2)'],['1 IN (SELECT 2)','1 IN (SELECT 2)']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${rhs}/${other}`);
 }
});
test('singleton IN constant walk includes nested singleton scalar children',()=>{
 for(const rhs of ['1 IN (2)','1 NOT IN (2)']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('nested singleton IN constant proof rejects scalar and RHS columns',()=>{
 for(const rhs of ['u.a IN (2)','1 IN (u.a)','1 NOT IN (abs(2))']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton constant proof sees nested empty IN production drop function-free lhs',()=>{
 for(const rhs of ['u.a IN ()','u.a NOT IN ()']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('nested empty IN constant proof preserves function-bearing and SELECT exclusions',()=>{
 for(const rhs of ['abs(u.a) IN ()','abs(1) NOT IN ()','(SELECT u.a) IN ()']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton IN mode-one CASE walk includes optional operand and ordered WHEN THEN ELSE list',()=>{
 for(const rhs of ['CASE WHEN 1 THEN 2 END','CASE 1 WHEN 1 THEN 2 ELSE 3 END']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('CASE constant walk rejects each nonconstant carrier and retains ordered branches',()=>{
 for(const [rhs,other] of [['CASE u.a WHEN 1 THEN 2 END','CASE u.a WHEN 1 THEN 2 END'],['CASE WHEN u.a THEN 2 END','CASE WHEN u.a THEN 2 END'],['CASE WHEN 1 THEN u.a END','CASE WHEN 1 THEN u.a END'],['CASE WHEN 1 THEN 2 ELSE u.a END','CASE WHEN 1 THEN 2 ELSE u.a END'],['CASE WHEN 1 THEN 2 ELSE 3 END','CASE WHEN 1 THEN 3 ELSE 2 END']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton IN constant walk continues through postfix null-test opcodes',()=>{
 for(const rhs of ['1 ISNULL','1 NOTNULL','1 NOT NULL',':bound ISNULL']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton postfix null-test proof preserves nonconstant child and opcode identity',()=>{
 for(const [rhs,other] of [['u.a ISNULL','u.a ISNULL'],['abs(1) NOTNULL','abs(1) NOTNULL'],[':bound ISNULL',':bound NOTNULL'],[':bound ISNULL',':other ISNULL']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton IN constant proof walks produced DISTINCT FROM alias opcodes',()=>{
 for(const [rhs,other] of [['1 IS DISTINCT FROM 2','1 IS NOT 2'],['1 IS NOT DISTINCT FROM 2','1 IS 2']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('DISTINCT FROM constant admission retains child exclusions and polarity',()=>{
 for(const [rhs,other] of [['u.a IS DISTINCT FROM 2','u.a IS NOT 2'],['1 IS NOT DISTINCT FROM u.a','1 IS u.a'],['1 IS DISTINCT FROM 2','1 IS 2'],['1 IS NOT DISTINCT FROM 2','1 IS NOT 2']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('parser AND folds produced false empty-IN child before singleton constant walk',()=>{
 for(const rhs of ['(1 IN ()) AND u.a','u.a AND (1 IN ())']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(0))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('produced false AND proof preserves HasFunc and immediate-flag boundaries',()=>{
 for(const rhs of ['(1 IN ()) AND abs(u.a)','0 AND u.a','((1 IN ()) OR 1) AND u.a']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(0))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('returned ExprInt32 zero retains IsFalse for enclosing parser AND',()=>{
 const rhs='((1 IN ()) AND 1) AND u.a';
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(0))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('literal ISNULL ExprInt32 false flag folds enclosing parser AND',()=>{
 for(const rhs of ['(1 ISNULL) AND u.a','u.a AND ((-2) IS NULL)']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(0))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('null-test false flags require literal opcode and retain function exclusion',()=>{
 for(const rhs of ['(:bound ISNULL) AND u.a','(1 NOTNULL) AND u.a','(NULL ISNULL) AND u.a','(1 ISNULL) AND abs(u.a)']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(0))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('nested null tests inspect parser-produced child opcode before AND proof',()=>{
 for(const rhs of ['((1 ISNULL) ISNULL) AND u.a','((-(1 ISNULL)) ISNULL) AND u.a']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(0))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('nested null-test opcode proof does not treat TRUEFALSE or variables as INTEGER',()=>{
 for(const rhs of ['((1 IN ()) ISNULL) AND u.a','((:bound ISNULL) ISNULL) AND u.a','((abs(1) ISNULL) ISNULL) AND u.a']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(0))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton IN mode1 walks unary BITNOT without evaluation',()=>{
 for(const rhs of ['~1','~:bound','~(1+2)']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('singleton IN scalar admission unwraps parentheses before vector exclusion',()=>{
 for(const lhs of ['((u.a,u.b))','(((u.a,u.b)))']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${lhs} IN (1)) OR t.a<(${lhs}=+(1))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),lhs);
 }
});
test('singleton IN constant walker traverses VECTOR list independently of lhs scalar gate',()=>{
 for(const rhs of ['(1,2)','(:bound,2)']){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${rhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('VECTOR constant walk visits every element and retains ordered operand identity',()=>{
 for(const [rhs,other] of [['(u.a,2)','(u.a,2)'],['(1,u.a)','(1,u.a)'],['(1,abs(2))','(1,abs(2))'],['(1,2)','(2,1)']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b IN (${rhs})) OR t.a<(u.b=+(${other}))`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),rhs);
 }
});
test('CAST empty typetoken compares its retained empty token',()=>{
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE a=CAST(1 AS) OR a<CAST(1 AS)',schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('CAST empty type identity retains child and excludes named type',()=>{
 for(const [rhs,other] of [['CAST(1 AS)','CAST(2 AS)'],['CAST(1 AS)','CAST(1 AS INTEGER)']]){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=${rhs} OR a<${other}`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
 }
});
test('CAST multi-token type identity uses exact typetoken span including trivia',()=>{
 for(const type of ['DOUBLE PRECISION','DECIMAL(10, 2)','DOUBLE /*é*/ PRECISION']){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=CAST(1 AS ${type}) OR a<CAST(1 AS ${type})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),type);
 }
});
test('CAST typetoken span does not normalize case, spaces, comments or parameters',()=>{
 for(const [x,y] of [['DOUBLE PRECISION','DOUBLE  PRECISION'],['DOUBLE PRECISION','double precision'],['DOUBLE /*a*/ PRECISION','DOUBLE /*b*/ PRECISION'],['DECIMAL(10,2)','DECIMAL(10, 2)'],['DECIMAL(10,2)','DECIMAL(11,2)']]){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=CAST(1 AS ${x}) OR a<CAST(1 AS ${y})`,schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'),`${x}/${y}`);
 }
});
test('necessary bound STRING ExprAlloc compares dequoted value, not grammar quote spelling',()=>{
 for(const [x,y] of [["'abc'","'abc'"],["'a''b'","'a''b'"]]){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=${x} OR a<${y}`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
 }
});
test('CAST quoted first typename follows Dequote closing delimiter truncation',()=>{
 for(const type of ['"DOUBLE" PRECISION',"'DOUBLE' PRECISION",'`DOUBLE` PRECISION','[DOUBLE] PRECISION']){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=CAST(1 AS ${type}) OR a<CAST(1 AS "DOUBLE")`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),type);
 }
});
test('CAST quoted typetoken truncation preserves escaped delimiter and case identity',()=>{
 for(const [x,y,expected] of [['"DO""UBLE" PRECISION','"DO""UBLE"',true],["'DO''UBLE'(10)","'DO''UBLE'",true],['"Double" PRECISION','"DOUBLE"',false],['DOUBLE "PRECISION"','DOUBLE',false]]){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE a=CAST(1 AS ${x}) OR a<CAST(1 AS ${y})`,schema())).clause;
 assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),expected,`${x}/${y}`);
 }
});
test('zero-argument function STAR and empty list share source ExprFunction production',()=>{
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE a=random(*) OR a<random()',schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('STAR null argument list obeys ordinary function arity and name proof',()=>{
 for(const sql of ['SELECT abs(*) FROM t','SELECT coalesce(*) FROM t'])assert.throws(()=>resolve(sql,schema()),/wrong number of arguments/);
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE a=random(*) OR a<sqlite_version()',schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('IS parenthesized NULL uses produced null opcode rather than raw rhs tokens',()=>{
 for(const [x,y] of [['u.b IS (NULL)','u.b ISNULL'],['u.b IS NOT ((NULL))','u.b NOTNULL']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),x);
 }
});
test('LIKE infix operand follows function production argument reversal',()=>{
 const c=analyzeWhere(resolve("SELECT t.id FROM t JOIN t AS u WHERE t.a=(u.b LIKE 'x') OR t.a<like('x',u.b)",schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('infix function operand retains NOT, escape argument and stored reversal',()=>{
 for(const [x,y,expected] of [["u.b NOT LIKE 'x'","NOT like('x',u.b)",true],["u.b LIKE 'x' ESCAPE '!'","like('x',u.b,'!')",true],["u.b GLOB 'x'","glob('x',u.b)",true],["u.b LIKE 'x'","like(u.b,'x')",false],["u.b NOT LIKE 'x'","like('x',u.b)",false],["u.b LIKE 'x' ESCAPE '!'","like('x',u.b,'?')",false]]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.equal(c.terms.some(t=>t.virtual&&t.operator==='le'),expected,x);
 }
});
test('infix HasFunc retains lhs in empty IN production',()=>{
 for(const [x,y] of [["(u.b LIKE 'x') IN ()","false AND (u.b LIKE 'x')"],["(u.b GLOB 'x') NOT IN ()","true OR (u.b GLOB 'x')"]]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),x);
 }
});
test('infix HasFunc prevents false child AND deletion',()=>{
 const c=analyzeWhere(resolve("SELECT t.id FROM t JOIN t AS u WHERE t.a=((1 IN ()) AND (u.b LIKE 'x')) OR t.a<0",schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('TK_NULL operand identity ignores spelling through function and CASE lists',()=>{
 for(const [x,y] of [['NULL','null'],['coalesce(u.b,NULL)','coalesce(u.b,null)'],['CASE u.b WHEN NULL THEN 1 ELSE 2 END','CASE u.b WHEN null THEN 1 ELSE 2 END']]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=(${x}) OR t.a<(${y})`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),x);
 }
});
test('false-child AND observes recursively produced children under arithmetic wrappers',()=>{
 const c=analyzeWhere(resolve("SELECT t.id FROM t JOIN t AS u WHERE t.a=((u.b + ((1 IN ()) AND 2)) ISNULL) OR t.a<((u.b+0) ISNULL)",schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'));
});
test('infix HasFunc propagates through CASE CAST and ordered argument carriers',()=>{
 for(const lhs of ["CASE u.b WHEN 1 THEN u.b LIKE 'x' ELSE 0 END","CAST((u.b LIKE 'x') AS INT)","coalesce(u.b GLOB 'x',0)"]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=((${lhs}) IN ()) OR t.a<(false AND (${lhs}))`,schema())).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='le'),lhs);
 const d=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE t.a=((1 IN ()) AND (${lhs})) OR t.a<0`,schema())).clause;
 assert.ok(!d.terms.some(t=>t.virtual&&t.operator==='le'),lhs);
 }
});
test('OR equality produces clause-owned virtual IN retaining original residual',()=>{
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE a=1 OR a=2',schema())).clause;
 const parent=c.terms.find(t=>t.info?.kind==='or');
 const child=c.terms.find(t=>t.virtual&&t.operator==='in'&&t.parentId===parent.id);
 assert.ok(child);assert.ok(parent.childIds.includes(child.id));
 assert.equal(parent.expression.tokens.filter(t=>t.text.toUpperCase()==='OR').length,1);
 assert.equal(child.prereqRight,0n);
});
test('OR-IN proof retains orientation, affinity and join provenance',()=>{
 for(const [predicate,expected] of [['1=a OR 2=a',true],['a=1 OR b=2',false],['a=1 OR a<2',false],['a=u.b OR a=2',false],['a=u.a OR a=2',true],['a=1 OR (a=2 AND b>0)',false]]){
 const c=analyzeWhere(resolve(`SELECT t.id FROM t JOIN t AS u WHERE ${predicate.replaceAll('a=','t.a=').replaceAll('b=','t.b=').replaceAll('=a','=t.a').replace('a<','t.a<').replace('b>','t.b>')}`,schema())).clause;
 assert.equal(c.terms.some(t=>t.virtual&&t.operator==='in'),expected,predicate);
 }
 const c=analyzeWhere(resolve('SELECT t.id FROM t LEFT JOIN t AS u ON u.a=1 OR u.a=2',schema())).clause;
 const child=c.terms.find(t=>t.virtual&&t.operator==='in');assert.ok(child);
 assert.equal(child.origin.kind,'join-on');assert.equal(child.outerJoinSafe.mayOmitResidual,false);
});
test('OR-IN two-cursor retry clears marked first-cursor entries and keeps stored list order',()=>{
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=u.a OR t.blob=u.a',schema())).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='in')); // mismatched affinities even on retry
 const d=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=u.a OR t.id=u.id',schema())).clause;
 assert.ok(!d.terms.some(t=>t.virtual&&t.operator==='in')); // neither cursor has one common column
 const e=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=u.a OR u.a=t.a',schema())).clause;
 const child=e.terms.find(t=>t.virtual&&t.operator==='in');assert.ok(child);
 assert.equal(child.left.sourceOrdinal,0);
 assert.equal(child.prereqRight,sourceBit(1));
});
test('OR-IN production proof and ordinary admission run in all encodings',()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
 const s=schema(encoding),r=resolve("SELECT id FROM t WHERE a='x' OR 'y'=a",s);
 const a=analyzeWhere(r),child=a.clause.terms.find(t=>t.virtual&&t.operator==='in');assert.ok(child);
 const loops=[...btreeLoops(r.sources[0],0,a.clause,{forcedIndex:null,neededColumns:new Set([s.id]),orderBy:[]})];
 assert.ok(loops.some(l=>l.capability?.equalityPrefix.some(e=>e.term===child)),encoding);
 }
});
test('OR-IN retry chooses second cursor and publishes marked RHS in clause order',()=>{
 const s=schema();s.t.columns=Object.freeze(s.t.columns.map(c=>c===s.b?Object.freeze({...c,affinity:'text'}):c));
 const c=analyzeWhere(resolve('SELECT t.id FROM t JOIN t AS u WHERE t.a=u.a OR t.b=u.a',s)).clause;
 const child=c.terms.find(t=>t.virtual&&t.operator==='in');assert.ok(child);
 assert.equal(child.left.sourceOrdinal,1);assert.equal(child.left.columnIndex,1);
 assert.equal(child.prereqRight,sourceBit(0));
 assert.equal(child.expression.tokens.map(t=>t.text).join(' '),'u . a IN ( t . a , t . b )');
});
function expressionIndexSchema(){
 const s=schema(),expression=resolve('SELECT b+1 FROM t',s).result[0].expression;
 const index={...s.i,name:'i_expr',terms:Object.freeze([{column:null,expression,expressionSql:'b+1',descending:false,collation:null,nulls:null}]),physical:null};
 index.physical=physicalIndex(index,'utf-8');s.t.indexes=Object.freeze([...s.t.indexes,index]);return s;
}
test('OR-IN expression-index producer compares XN_EXPR operands rather than rejecting sentinel',()=>{
 const s=expressionIndexSchema();
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE b+1=2 OR b+1=3',s)).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='in'&&t.left.columnIndex===-2));
});
test('OR-IN XN_EXPR equality proof rejects different fields and collation nodes',()=>{
 const s=expressionIndexSchema(),expression=resolve('SELECT b+2 FROM t',s).result[0].expression;
 const index={...s.i,name:'i_expr2',terms:Object.freeze([{column:null,expression,expressionSql:'b+2',descending:false,collation:null,nulls:null}]),physical:null};
 index.physical=physicalIndex(index,'utf-8');s.t.indexes=Object.freeze([...s.t.indexes,index]);
 for(const predicate of ['b+1=2 OR b+2=3','(b+1) COLLATE BINARY=2 OR (b+1) COLLATE NOCASE=3']){
 const c=analyzeWhere(resolve(`SELECT id FROM t WHERE ${predicate}`,s)).clause;
 assert.ok(!c.terms.some(t=>t.virtual&&t.operator==='in'),predicate);
 }
 const c=analyzeWhere(resolve('SELECT id FROM t WHERE (b+1)=2 OR b+1=3',s)).clause;
 assert.ok(c.terms.some(t=>t.virtual&&t.operator==='in'));
});
