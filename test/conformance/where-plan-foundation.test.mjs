import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalRowidIndex,columnTypeEstimate,sqliteLogEst} from '../../src/internal/schema.ts';
import {admitIndexConstraint,btreeLoops,sourceBit,whereClause,wherePathSolver,WherePlanningUnsupportedError} from '../../src/internal/where-plan.ts';

const expression={tokens:[],reduction:null};
function fixture(){
 const a=Object.freeze({name:'a',declaredType:'TEXT',affinity:'text',szEst:columnTypeEstimate('TEXT').szEst,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:true,primaryKeyPosition:null,unique:false,collation:'NOCASE',generatedStorage:null,checks:[]});
 const b=Object.freeze({...a,name:'b',declaredType:'INTEGER',affinity:'integer',szEst:columnTypeEstimate('INTEGER').szEst,collation:null,notNull:false});
 // build.c sqlite3DefaultRowEst: default population200, nonunique prefixes33/32.
 // This ordinary table has no IPK alias; the physical index tail is rowid.
 const table={nRowLogEst:200,hasStat1:false,integerPrimaryKey:null,szTabRow:sqliteLogEst(BigInt((a.szEst+b.szEst+1)*4)),kind:'table',name:'t',tableName:'t',rootPage:2,sql:'',columns:Object.freeze([a,b]),indexes:[],withoutRowid:false,primaryKey:[],storageKey:[],checks:[],foreignKeys:[],referencedBy:[]};
 const index={rowLogEst:Object.freeze([200,33,32]),szIdxRow:sqliteLogEst(BigInt((a.szEst+b.szEst+1)*4)),hasStat1:false,unordered:false,noSkipScan:false,kind:'index',name:'i_ab',tableName:'t',rootPage:3,sql:'',table,terms:Object.freeze([Object.freeze({column:a,expression:null,expressionSql:null,descending:false,collation:'NOCASE',nulls:null}),Object.freeze({column:b,expression:null,expressionSql:null,descending:true,collation:null,nulls:null})]),unique:false,origin:'create',physical:null};
 index.physical=physicalRowidIndex(index,'utf-8');table.indexes.push(index);Object.freeze(table.indexes);
 const source={table,cursorId:0,tableName:'t',databaseName:null,alias:null,indexedBy:null,notIndexed:false,join:null,on:null,using:[],subquery:null};
 return {a,b,table,index,source};
}
function term(id,source,column,columnIndex,operator,extra={}){return Object.freeze({id,expression,origin:{kind:'where'},operator,left:{source,sourceOrdinal:0,column,columnIndex,rowid:false},rightAffinity:column.affinity,effectiveCollation:column.collation?.toLowerCase()??'binary',originalIndexedOperand:'left',prereqRight:0n,prereqAll:sourceBit(0),parentId:null,childIds:Object.freeze([]),virtual:false,outerJoinSafe:Object.freeze({mayDrive:true,mayOmitResidual:true}),...extra});}

test('physical descriptor and composite admission preserve exact identities',()=>{
 const {a,b,index,source}=fixture(),physical=index.physical;assert.ok(physical);assert.equal(physical.index,index);assert.equal(physical.fields[0].column,a);assert.equal(physical.fields[2].role,'rowid-tail');assert.equal(physical.keyInfo.totalFieldCount,3);assert.equal(physical.keyInfo.keyFieldCount,3);
 const eq=term(1,source,a,0,'eq'),upper=term(2,source,b,1,'lt',{originalIndexedOperand:'right',operator:'gt'});const ae=admitIndexConstraint(eq,physical,0),au=admitIndexConstraint(upper,physical,1);assert.ok(ae&&au);assert.equal(ae.term,eq);assert.equal(ae.field,physical.fields[0]);assert.equal(ae.keyInfoTerm,physical.keyInfo.terms[0]);assert.equal(au.originalIndexedOperand,'right');assert.equal(au.bound,'lower-exclusive');
 const loops=btreeLoops(source,0,whereClause([eq,upper]),{forcedIndex:null,neededColumns:new Set([a]),orderBy:[{sourceOrdinal:0,column:b,descending:false,collation:'binary'}]});const chosen=loops.find(loop=>loop.kind==='index');assert.ok(chosen);assert.equal(chosen.capability.equalityPrefix[0],ae);assert.equal(chosen.capability.lower.term,upper);assert.equal(chosen.capability.reverse,true);assert.equal(chosen.capability.covering,true);assert.equal(chosen.capability.needsTableLookup,false);
});

test('affinity/collation, null and forced/unforced gates are atomic',()=>{
 const {a,index,source,table}=fixture(),physical=index.physical;const wrong=term(1,source,a,0,'eq',{effectiveCollation:'binary'});assert.equal(admitIndexConstraint(wrong,physical,0),null);const unsafe=term(9,source,a,0,'eq',{origin:{kind:'join-on',rightSource:1,join:'left'},prereqRight:sourceBit(1),outerJoinSafe:Object.freeze({mayDrive:false,mayOmitResidual:false})});assert.equal(admitIndexConstraint(unsafe,physical,0),null);const nil=term(2,source,a,0,'is-null',{rightAffinity:null,effectiveCollation:null});assert.equal(admitIndexConstraint(nil,physical,0).comparison.kind,'is-null');
 const unsupported={...index,name:'bad',physical:null};assert.throws(()=>btreeLoops(source,0,whereClause([]),{forcedIndex:unsupported,neededColumns:new Set(),orderBy:[]}),WherePlanningUnsupportedError);const loops=btreeLoops(source,0,whereClause([]),{forcedIndex:null,neededColumns:new Set(),orderBy:[]});assert.equal(loops.length,1);assert.equal(loops[0].kind,'table-scan'); // equal physical widths: full index is not cheaper (whereLoopFindLesser).
 const forced=btreeLoops(source,0,whereClause([]),{forcedIndex:index,neededColumns:new Set(),orderBy:[]});assert.equal(forced.length,1);assert.equal(forced[0].kind,'index');assert.equal(forced[0].capability.physicalIndex,physical);assert.equal(forced[0].capability.covering,true);assert.equal(forced[0].capability.needsTableLookup,false);
});

test('path solver obeys bigint prerequisites and deterministic selection',()=>{
 const {source}=fixture(),other={...source,cursorId:1};const mk=(s,n,prereq,cost)=>Object.freeze({source:s,sourceOrdinal:n,prereq,capability:null,kind:'table-scan',setupCost:0n,runCost:cost,outputRows:1n,terms:Object.freeze([])});const first=mk(source,0,0n,5n),dependent=mk(other,1,sourceBit(0),1n);const path=wherePathSolver([[first],[dependent]],2);assert.deepEqual(path.loops,[first,dependent]);assert.equal(path.ready,3n);assert.equal(path.cost,17n);
});
