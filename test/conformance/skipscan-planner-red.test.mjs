import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops} from '../../src/internal/where-plan.ts';
import {physicalIndex} from '../../src/internal/schema.ts';

// Owning-path red check: pinned where.c:3614–3650 (stat1 threshold42).
// These are schema-state discriminators, not native query-output credit.
function fixture({hasStat1=true,noSkipScan=false,duplicates=60}={}) {
 const column=name=>Object.freeze({name,declaredType:'INTEGER',affinity:'integer',szEst:1,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,collation:null,generatedStorage:null,checks:[]});
 const a=column('a'),b=column('b');
 const table={kind:'table',name:'t',tableName:'t',rootPage:2,sql:'',nRowLogEst:100,hasStat1,szTabRow:16,integerPrimaryKey:null,columns:Object.freeze([a,b]),indexes:[],withoutRowid:false,primaryKey:Object.freeze([]),storageKey:Object.freeze([]),checks:Object.freeze([]),foreignKeys:Object.freeze([]),referencedBy:Object.freeze([])};
 const index={kind:'index',name:'ab',tableName:'t',rootPage:3,sql:'',table,rowLogEst:Object.freeze([100,duplicates,0]),szIdxRow:10,hasStat1,noSkipScan,unordered:false,terms:Object.freeze([a,b].map(column=>Object.freeze({column,expression:null,expressionSql:null,descending:false,collation:null,nulls:null}))),unique:false,origin:'create',physical:null};
 index.physical=physicalIndex(index,'utf-8');table.indexes.push(index);Object.freeze(table.indexes);
 const resolved=expandAndResolveSelect(parseSql('SELECT b FROM t INDEXED BY ab WHERE b=7').statement,{tables:new Map([['t',table]])});
 const analysis=analyzeWhere(resolved);
 const loops=btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:index,neededColumns:new Set([b]),orderBy:[]});
 return {loops,term:analysis.clause.terms[0]};
}
for(const [name,options,expected] of [
 ['stat1 duplicate60',{},true],
 ['threshold42',{duplicates:42},true],
 ['threshold41',{duplicates:41},false],
 ['no stat1',{hasStat1:false},false],
 ['noskipscan',{noSkipScan:true},false],
])test(`source skip recursion admission: ${name}`,()=>{
 const {loops,term}=fixture(options);
 const suffix=loops.find(loop=>loop.capability?.equalitySlots.some(admission=>admission?.term===term));
 assert.equal(!!suffix,expected,`${name}: production btreeLoops must ${expected?'admit':'not admit'} ordinal1 equality after a skipped leading field`);
 if(expected){
  assert.equal(suffix.capability.nSkip,1);
  assert.equal(suffix.capability.nEq,2);
  assert.equal(typeof suffix.runCost,'bigint');
  assert.equal(typeof suffix.outputRows,'bigint');
 }
});
