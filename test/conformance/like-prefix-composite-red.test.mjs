import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops} from '../../src/internal/where-plan.ts';
import {physicalIndex,columnTypeEstimate,sqliteLogEst} from '../../src/internal/schema.ts';

// Red witness for whereexpr.c:isLikeOrGlob/exprAnalyze TERM_LIKEOPT.
// Explicit GE/LT is a positive control for the existing shared range consumer.
for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const [operator,collation,pattern] of [['LIKE','NOCASE','abc%'],['GLOB','BINARY','abc*']]){
 test(`prefix virtual bounds ${operator}/${encoding}`,()=>{
  const a={name:'a',declaredType:'TEXT',affinity:'text',szEst:columnTypeEstimate('TEXT').szEst,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,collation,generatedStorage:null,checks:[]};
  const k={...a,name:'k',collation:'BINARY'};
  const table={nRowLogEst:200,hasStat1:false,integerPrimaryKey:null,szTabRow:sqliteLogEst(100n),kind:'table',name:'t',tableName:'t',rootPage:2,sql:'',columns:[k,a],indexes:[],withoutRowid:false,primaryKey:[],storageKey:[],checks:[],foreignKeys:[],referencedBy:[]};
  const index={rowLogEst:[200,100,33],szIdxRow:sqliteLogEst(40n),hasStat1:false,unordered:false,noSkipScan:false,kind:'index',name:'i_a',tableName:'t',rootPage:3,sql:'',table,terms:[{column:k,expression:null,expressionSql:null,descending:false,collation:'BINARY',nulls:null},{column:a,expression:null,expressionSql:null,descending:false,collation,nulls:null}],unique:false,origin:'create',physical:null};
  index.physical=physicalIndex(index,encoding);table.indexes.push(index);
  const inspect=predicate=>{
   const resolved=expandAndResolveSelect(parseSql(`SELECT a FROM t WHERE k = 'tenant' AND (${predicate})`).statement,{tables:new Map([['t',table]])});
   const analysis=analyzeWhere(resolved);
   const loops=btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set([a]),orderBy:[]});
   return {terms:analysis.clause.terms,loops};
  };
  const explicit=inspect("a >= 'abc' AND a < 'abd'");
  assert.ok(explicit.loops.some(l=>l.capability?.lower&&l.capability?.upper),'positive control: existing shared GE/LT candidate');
  for(const patternControl of [operator==='LIKE'?'%abc':'*abc','']){
   const negative=inspect(`a ${operator} '${patternControl}'`);
   assert.ok(!negative.loops.some(l=>l.capability?.lower||l.capability?.upper),'no-prefix control');
  }
  const prefix=inspect(`a ${operator} '${pattern}'`);
  console.log(JSON.stringify({encoding,operator,terms:prefix.terms.map(t=>({operator:t.operator,virtual:t.virtual,children:t.childIds})),bounds:prefix.loops.map(l=>({kind:l.kind,lower:!!l.capability?.lower,upper:!!l.capability?.upper}))}));
  assert.ok(prefix.loops.some(l=>l.capability?.lower&&l.capability?.upper),'scalar equality prefix plus LIKE/GLOB must retain paired selected-index range');
 });
}
