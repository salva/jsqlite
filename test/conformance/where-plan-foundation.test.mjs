import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalRowidIndex,columnTypeEstimate,sqliteLogEst} from '../../src/internal/schema.ts';
import {standaloneBloomDescriptors,automaticIndexCandidates,automaticIndexDescriptor,automaticIndexPathEligible,columnIsGoodAutomaticIndexCandidate,termCanDriveAutomaticIndex,automaticIndexCosts,admitIndexConstraint,btreeLoops,sourceBit,whereClause,wherePathSolver,WherePlanningUnsupportedError} from '../../src/internal/where-plan.ts';

const expression={tokens:[],reduction:null};
function fixture(){
 const a=Object.freeze({name:'a',declaredType:'TEXT',affinity:'text',szEst:columnTypeEstimate('TEXT').szEst,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:true,primaryKeyPosition:null,unique:false,collation:'NOCASE',generatedStorage:null,checks:[]});
 const b=Object.freeze({...a,name:'b',declaredType:'INTEGER',affinity:'integer',szEst:columnTypeEstimate('INTEGER').szEst,collation:null,notNull:false});
 // build.c sqlite3DefaultRowEst: default population200, nonunique prefixes33/32.
 // This ordinary table has no IPK alias; the physical index tail is rowid.
 const table={nRowLogEst:200,hasStat1:false,integerPrimaryKey:null,szTabRow:sqliteLogEst(BigInt((a.szEst+b.szEst+1)*4)),kind:'table',name:'t',tableName:'t',rootPage:2,sql:'',columns:Object.freeze([a,b]),indexes:[],withoutRowid:false,primaryKey:[],storageKey:[],checks:[],foreignKeys:[],referencedBy:[]};
 const index={rowLogEst:Object.freeze([200,33,32]),szIdxRow:sqliteLogEst(BigInt((a.szEst+b.szEst+1)*4)),hasStat1:false,unordered:false,noSkipScan:false,kind:'index',name:'i_ab',tableName:'t',rootPage:3,sql:'',table,terms:Object.freeze([Object.freeze({column:a,expression:null,expressionSql:null,descending:false,collation:'NOCASE',nulls:null}),Object.freeze({column:b,expression:null,expressionSql:null,descending:true,collation:null,nulls:null})]),unique:false,origin:'create',physical:null};
 index.physical=physicalRowidIndex(index,'utf-8');table.indexes.push(index);Object.freeze(table.indexes);
 const source={table,cursorId:0,tableName:'t',databaseName:null,alias:null,indexedBy:null,notIndexed:false,join:null,joinFromLeft:{left:false,right:false,outer:false,inner:false,cross:false,natural:false},leftOfRightJoin:false,on:null,using:[],subquery:null};
 return {a,b,table,index,source};
}
function term(id,source,column,columnIndex,operator,extra={}){return Object.freeze({id,expression,origin:{kind:'where'},operator,left:{source,sourceOrdinal:0,column,columnIndex,rowid:false},rightAffinity:column.affinity,effectiveCollation:column.collation?.toLowerCase()??'binary',originalIndexedOperand:'left',prereqRight:0n,prereqAll:sourceBit(0),parentId:null,childIds:Object.freeze([]),virtual:false,outerJoinSafe:Object.freeze({mayDrive:true,mayOmitResidual:true}),...extra});}

const automaticContext={enabled:true,orOptimization:false,rightJoinDrain:false,orSubclause:false,correlated:false,recursive:false,ephemeral:false,costMultiplier:0n,sourcePrereq:0n};

test('automatic candidate gates and smallouter admission stay independent of executable plans',()=>{
 const {source,b}=fixture(),eq=term(1,source,b,1,'eq',{prereqRight:2n}),clause=whereClause([eq]);
 const candidates=automaticIndexCandidates(source,0,clause,automaticContext);
 assert.equal(candidates.length,1);assert.equal(candidates[0].seed,eq);
 assert.equal(automaticIndexPathEligible(candidates[0],2n,2n),false);
 assert.equal(automaticIndexPathEligible(candidates[0],2n,3n),true);
 assert.equal(automaticIndexPathEligible(candidates[0],0n,100n),false);
 assert.equal(automaticIndexPathEligible(candidates[0],3n,100n),false);
 for(const flag of ['orOptimization','rightJoinDrain','orSubclause','correlated','recursive'])assert.equal(automaticIndexCandidates(source,0,clause,{...automaticContext,[flag]:true}).length,0);
 assert.equal(automaticIndexCandidates(source,0,clause,{...automaticContext,enabled:false}).length,0);
 for(const change of [{notIndexed:true},{indexedBy:'forced'}])assert.equal(automaticIndexCandidates({...source,...change},0,clause,automaticContext).length,0);
 assert.equal(automaticIndexCandidates(source,0,whereClause([{...eq,prereqRight:1n}]),automaticContext).length,0);
 assert.ok(btreeLoops(source,0,clause,{forcedIndex:null,neededColumns:new Set(),orderBy:[]}).every(loop=>loop.kind!=='automatic-index'));
});

for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`${encoding}: automatic descriptor expands ready deduplicated keys and covering fields`,()=>{
 const {source,a,b}=fixture();
 // No existing index: both columns can now drive an automatic key.
 source.table.indexes=[];
 const first=term(1,source,b,1,'eq',{prereqRight:2n}),duplicate=term(2,source,b,1,'is',{prereqRight:2n});
 const second=term(3,source,a,0,'eq',{prereqRight:4n});
 const clause=whereClause([first,duplicate,second]),candidate=automaticIndexCandidates(source,0,clause,automaticContext)[0];
 const limited=automaticIndexDescriptor(candidate,clause,4n,new Set([a]),encoding);
 assert.deepEqual(limited.keys.map(key=>key.term),[first]);
 assert.deepEqual(limited.fields,[b,a,null]);
 assert.equal(limited.prereq,2n);assert.equal(limited.bloom,true);
 const all=automaticIndexDescriptor(candidate,clause,0n,new Set([a]),encoding);
 assert.deepEqual(all.keys.map(key=>key.term),[first,second]);
 assert.deepEqual(all.fields,[b,a,null]);assert.equal(all.prereq,6n);
 assert.equal(all.keys[1].collation,'nocase');assert.equal(all.keyInfo.encoding,encoding);
 assert.equal(all.keyInfo.terms[1].collation,'nocase');
 assert.ok(Object.isFrozen(all)&&Object.isFrozen(all.keys)&&Object.isFrozen(all.fields));
 assert.equal(automaticIndexDescriptor(candidate,clause,2n,new Set(),encoding),null);
});

test('standalone Bloom is independent: selected persistent path, stat1 search threshold and selfcull proof',()=>{
 const {source,a,index}=fixture();source.table.hasStat1=true;source.table.nRowLogEst=100;
 const eq=term(1,source,a,0,'is');
 const loop=btreeLoops(source,0,whereClause([eq]),{forcedIndex:index,neededColumns:new Set(),orderBy:[]})[0];
 const outer={...loop,sourceOrdinal:1,outputRows:101n};
 const path={loops:[outer,loop]};
 assert.equal(standaloneBloomDescriptors(path,new Set(),true).length,0);
 const descriptors=standaloneBloomDescriptors(path,new Set([loop]),true);
 assert.equal(descriptors.length,1);assert.equal(descriptors[0].loop,loop);
 assert.equal(descriptors[0].equality[0].term,eq);assert.equal(descriptors[0].bytes,10000);
 assert.equal(descriptors[0].requiresTableCursor,true);
 assert.equal(standaloneBloomDescriptors(path,new Set([loop]),false).length,0);
 outer.outputRows=100n;assert.equal(standaloneBloomDescriptors(path,new Set([loop]),true).length,0);
 source.table.hasStat1=false;assert.equal(standaloneBloomDescriptors(path,new Set([loop]),true).length,0);
});

test('automatic driving admission follows declared-key statistics, affinity and readiness',()=>{
 const {a,b,source,index}=fixture();
 assert.equal(columnIsGoodAutomaticIndexCandidate(source.table,a),false);
 assert.equal(columnIsGoodAutomaticIndexCandidate(source.table,b),true);
 const eq=term(1,source,b,1,'eq',{prereqRight:2n});
 assert.equal(termCanDriveAutomaticIndex(eq,source,0,0n),true);
 assert.equal(termCanDriveAutomaticIndex(eq,source,0,2n),false);
 assert.equal(termCanDriveAutomaticIndex({...eq,operator:'is'},source,0,0n),true);
 for(const operator of ['in','is-null','gt'])assert.equal(termCanDriveAutomaticIndex({...eq,operator},source,0,0n),false);
 assert.equal(termCanDriveAutomaticIndex({...eq,left:{...eq.left,columnIndex:-1,rowid:true}},source,0,0n),false);
 assert.equal(termCanDriveAutomaticIndex({...eq,outerJoinSafe:{mayDrive:false}},source,0,0n),false);
 // Numeric comparison cannot be implemented by a TEXT automatic key.
 const textTerm=term(2,source,a,0,'eq',{rightAffinity:'integer'});
 assert.equal(termCanDriveAutomaticIndex(textTerm,source,0,0n),false);
 index.hasStat1=true;index.rowLogEst=[200,33,21];
 assert.equal(columnIsGoodAutomaticIndexCandidate(source.table,b),false);
 index.rowLogEst=[200,33,20];
 assert.equal(columnIsGoodAutomaticIndexCandidate(source.table,b),true);
 const left={...source,joinFromLeft:{...source.joinFromLeft,left:true}};
 const on={...eq,left:{...eq.left,source:left},origin:{kind:'join-on',rightSource:0,join:'left'},joinOwner:0,outerOn:true};
 assert.equal(termCanDriveAutomaticIndex(on,left,0,0n),true);
 assert.equal(termCanDriveAutomaticIndex({...on,outerOn:false},left,0,0n),false);
 assert.equal(termCanDriveAutomaticIndex({...on,joinOwner:1},left,0,0n),false);
 assert.equal(termCanDriveAutomaticIndex({...on,origin:{kind:'where'}},left,0,0n),true); // commuted terms retain EP_OuterON independently of origin
 assert.equal(termCanDriveAutomaticIndex({...on,origin:{kind:'where'},outerOn:false},left,0,0n),false);
});

test('automatic costs retain source setup tuning and saturation without enrollment',()=>{
 assert.deepEqual(automaticIndexCosts(0n),{setupCost:28n,runCost:44n,outputRows:43n});
 assert.deepEqual(automaticIndexCosts(0n,true),{setupCost:0n,runCost:44n,outputRows:43n});
 assert.deepEqual(automaticIndexCosts(200n),{setupCost:271n,runCost:53n,outputRows:43n});
 assert.equal(automaticIndexCosts(200n,true).setupCost,218n);
 assert.equal(automaticIndexCosts(200n,false,10n).setupCost,281n);
});

test('physical descriptor and composite admission preserve exact identities',()=>{
 const {a,b,index,source}=fixture(),physical=index.physical;assert.ok(physical);assert.equal(physical.index,index);assert.equal(physical.fields[0].column,a);assert.equal(physical.fields[2].role,'rowid-tail');assert.equal(physical.keyInfo.totalFieldCount,3);assert.equal(physical.keyInfo.keyFieldCount,3);
 const eq=term(1,source,a,0,'eq'),upper=term(2,source,b,1,'lt',{originalIndexedOperand:'right',operator:'gt'});const ae=admitIndexConstraint(eq,physical,0),au=admitIndexConstraint(upper,physical,1);assert.ok(ae&&au);assert.equal(ae.term,eq);assert.equal(ae.field,physical.fields[0]);assert.equal(ae.keyInfoTerm,physical.keyInfo.terms[0]);assert.equal(au.originalIndexedOperand,'right');assert.equal(au.bound,'lower-exclusive');
 const loops=btreeLoops(source,0,whereClause([eq,upper]),{forcedIndex:null,neededColumns:new Set([a]),orderBy:[{sourceOrdinal:0,column:b,descending:false,collation:'binary'}]});const chosen=loops.find(loop=>loop.kind==='index');assert.ok(chosen);assert.equal(chosen.capability.equalitySlots[0],ae);assert.equal(chosen.capability.lower.term,upper);assert.equal(chosen.capability.reverse,true);assert.equal(chosen.capability.covering,true);assert.equal(chosen.capability.needsTableLookup,false);
});

test('affinity/collation, null and forced/unforced gates are atomic',()=>{
 const {a,index,source,table}=fixture(),physical=index.physical;const wrong=term(1,source,a,0,'eq',{effectiveCollation:'binary'});assert.equal(admitIndexConstraint(wrong,physical,0),null);const unsafe=term(9,source,a,0,'eq',{origin:{kind:'join-on',rightSource:1,join:'left'},prereqRight:sourceBit(1),outerJoinSafe:Object.freeze({mayDrive:false,mayOmitResidual:false})});assert.equal(admitIndexConstraint(unsafe,physical,0),null);const nil=term(2,source,a,0,'is-null',{rightAffinity:null,effectiveCollation:null});assert.equal(admitIndexConstraint(nil,physical,0).comparison.kind,'is-null');
 const unsupported={...index,name:'bad',physical:null};assert.throws(()=>btreeLoops(source,0,whereClause([]),{forcedIndex:unsupported,neededColumns:new Set(),orderBy:[]}),WherePlanningUnsupportedError);const loops=btreeLoops(source,0,whereClause([]),{forcedIndex:null,neededColumns:new Set(),orderBy:[]});assert.equal(loops.length,1);assert.equal(loops[0].kind,'table-scan'); // equal physical widths: full index is not cheaper (whereLoopFindLesser).
 const forced=btreeLoops(source,0,whereClause([]),{forcedIndex:index,neededColumns:new Set(),orderBy:[]});assert.equal(forced.length,1);assert.equal(forced[0].kind,'index');assert.equal(forced[0].capability.physicalIndex,physical);assert.equal(forced[0].capability.covering,true);assert.equal(forced[0].capability.needsTableLookup,false);
});

test('path solver obeys bigint prerequisites and deterministic selection',()=>{
 const {source}=fixture(),other={...source,cursorId:1};const mk=(s,n,prereq,cost)=>Object.freeze({source:s,sourceOrdinal:n,prereq,capability:null,kind:'table-scan',setupCost:0n,runCost:cost,outputRows:1n,terms:Object.freeze([])});const first=mk(source,0,0n,5n),dependent=mk(other,1,sourceBit(0),1n);const path=wherePathSolver([[first],[dependent]],2);assert.deepEqual(path.loops,[first,dependent]);assert.equal(path.ready,3n);assert.equal(path.cost,17n);
});
