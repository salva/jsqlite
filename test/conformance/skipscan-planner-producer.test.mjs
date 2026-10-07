import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops,btreeIndexLoops,resolvedWhereOrder} from '../../src/internal/where-plan.ts';
import {physicalIndex} from '../../src/internal/schema.ts';

// Producer proof checkpoint (not public selection acceptance): pinned where.c:3614–3650 (stat1 threshold42).
// These are schema-state discriminators, not native query-output credit.
function fixture({unordered=false,hasStat1=true,noSkipScan=false,duplicates=60,skipScan=true,order=false,orderA=false,multiple=false,deep=false,orSet=null,budget=null,completion=null,recursive=false,sql='SELECT b FROM t INDEXED BY ab WHERE b=7'}={}) {
 const column=name=>Object.freeze({name,declaredType:'INTEGER',affinity:'integer',szEst:1,defaultExpr:null,generatedExpr:null,defaultIndex:null,notNull:false,primaryKeyPosition:null,unique:false,collation:null,generatedStorage:null,checks:[]});
 const a=column('a'),b=column('b'),z=column('z'),columns=deep?[a,z,b,...['c','d','e'].map(column)]:multiple?[a,z,b]:[a,b];
 const table={kind:'table',name:'t',tableName:'t',rootPage:2,sql:'',nRowLogEst:100,hasStat1,szTabRow:16,integerPrimaryKey:null,columns:Object.freeze(columns),indexes:[],withoutRowid:false,primaryKey:Object.freeze([]),storageKey:Object.freeze([]),checks:Object.freeze([]),foreignKeys:Object.freeze([]),referencedBy:Object.freeze([])};
 const index={kind:'index',name:'ab',tableName:'t',rootPage:3,sql:'',table,rowLogEst:Object.freeze(deep?[100,80,60,42,30,20,0]:multiple?[100,duplicates,42,0]:[100,duplicates,0]),szIdxRow:10,hasStat1,noSkipScan,unordered,terms:Object.freeze(columns.map(column=>Object.freeze({column,expression:null,expressionSql:null,descending:false,collation:null,nulls:null}))),unique:false,origin:'create',physical:null};
 index.physical=physicalIndex(index,'utf-8');table.indexes.push(index);Object.freeze(table.indexes);
 const resolved=expandAndResolveSelect(parseSql(sql).statement,{tables:new Map([['t',table]])});
 const analysis=analyzeWhere(resolved);
 const produce=recursive?(source,ordinal,clause,options)=>btreeIndexLoops(source,ordinal,index,clause,options):btreeLoops;
 const loops=produce(resolved.sources[0],0,analysis.clause,{forcedIndex:index,neededColumns:new Set([b]),orderBy:orderA?[{sourceOrdinal:0,column:a,collation:"binary",descending:false}]:order?[{sourceOrdinal:0,column:b,collation:"binary",descending:false}]:[],skipScan,orSet:orSet??undefined,resolved,planBudget:budget??undefined,completion:completion??undefined});
 return {loops,term:analysis.clause.terms[0],terms:analysis.clause.terms,orSet};
}
for(const [name,options,expected] of [
 ['stat1 duplicate60',{},true],
 ['producer flag disabled',{skipScan:false},false],
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
  assert.equal(suffix.capability.equalitySlots[0],null);
  assert.equal(suffix.capability.equalitySlots[1].term,term);
  assert.equal(suffix.outputRows,BigInt(100-(options.duplicates??60)+5));
 }
});

test('skipped ordinal cannot credit suffix-only global order',()=>{
 const {loops,term}=fixture({order:true});
 const cap=loops.find(loop=>loop.capability?.equalitySlots.some(a=>a?.term===term)).capability;
 assert.equal(cap.orderTermsSatisfied,0);
});

test('multiple leading slots retain ordinal, unmultiplied output and surcharge',()=>{
 const {loops,term}=fixture({multiple:true});
 const loop=loops.find(l=>l.capability?.nSkip===2&&l.capability.equalitySlots.some(a=>a?.term===term));
 assert.ok(loop);
 assert.equal(loop.capability.nEq,3);
 assert.deepEqual(loop.capability.equalitySlots.slice(0,2),[null,null]);
 assert.equal(loop.capability.equalitySlots[2].fieldOrdinal,2);
 assert.equal(loop.outputRows,68n); // (100-60+5)+(60-42+5)+0
});

test('cost-only recursion sees suffix and restores enclosing insertion return',()=>{
 const set={a:[]},budget={remaining:10n};
 const {loops}=fixture({orSet:set,budget});
 assert.deepEqual(loops,[], 'cost collector does not publish branch choices');
 assert.equal(set.a.length,1);
 assert.equal(set.a[0].nOut,45n);
 assert.ok(budget.remaining<10n);
});
test('cost-only exhausted skip child clears set and consumes no phantom budget',()=>{
 for(const remaining of [0n,1n]){
  const set={a:[{prereq:0n,rRun:500n,nOut:100n}]},budget={remaining},completion={done:false};
  const {loops}=fixture({recursive:remaining===0n,orSet:set,budget,completion});
  assert.deepEqual(loops,[]);
  assert.equal(budget.remaining,0n);
  assert.deepEqual(set.a,[]);
  assert.equal(completion.done,false,"successful skip-slot resize owns enclosing OK, not child DONE");
 }
});

test('without skip resize, insertion DONE remains owned by enclosing frame',()=>{
 for(const options of [{noSkipScan:true},{hasStat1:false},{duplicates:41},{skipScan:false}]){
  const set={a:[]},budget={remaining:0n},completion={done:false};
  fixture({...options,orSet:set,budget,completion});
  assert.equal(completion.done,true);
  assert.equal(budget.remaining,0n);
 }
});
test('each discarded cost proposal consumes budget; null slots do not create a physical choice',()=>{
 const set={a:[{prereq:0n,rRun:0n,nOut:0n}]},budget={remaining:5n},completion={done:false};
 fixture({orSet:set,budget,completion});
 // Forced index full alternative then skip suffix; both are discarded by
 // the cheaper pre-existing cost but each still consumes insertion budget.
 assert.equal(budget.remaining,3n);
 assert.deepEqual(set.a,[{prereq:0n,rRun:0n,nOut:0n}]);
 assert.equal(completion.done,false);
});

test('source IN unfavorable estimate rejects skipped proposal before insertion',()=>{
 const {loops}=fixture({duplicates:42,sql:`SELECT b FROM t INDEXED BY ab WHERE b IN (${Array.from({length:32},(_,i)=>i).join(',')})`});
 assert.ok(!loops.some(loop=>loop.capability.nSkip>0));
});
test('source IN favorable estimate retains skipped positional suffix',()=>{
 const {loops}=fixture({duplicates:60,sql:'SELECT b FROM t INDEXED BY ab WHERE b IN (7,NULL,8)'});
 assert.ok(loops.some(loop=>loop.capability.nSkip===1&&loop.capability.equalitySlots[1]?.operator==='in'));
});

test('canonical positional carrier has no independently dense plan state',()=>{
 const {loops}=fixture({multiple:true});
 const cap=loops.find(loop=>loop.capability.nSkip===2)?.capability;
 assert.ok(cap);assert.equal(Object.hasOwn(cap,'equalityPrefix'),false);
 assert.deepEqual(cap.equalitySlots.slice(0,2),[null,null]);
 assert.equal(cap.equalitySlots[2].fieldOrdinal,2);
});

// where.c4235 INDEXED BY inserts a full-index alternative before recursion.
test('ordinary recursive insertion observes source term order and resumes before skip',()=>{
 const completion={done:false},budget={remaining:2n};
 const {loops}=fixture({budget,completion,sql:'SELECT b FROM t INDEXED BY ab WHERE b IS NULL AND b=7'});
 assert.ok(loops.some(l=>l.capability?.nSkip===1));
 assert.equal(loops.find(l=>l.capability?.nSkip===1).capability.equalitySlots[1].operator,'is-null');
 assert.equal(budget.remaining,0n);
 assert.equal(completion.done,false); // enclosing successful skip resize owns OK
});

test('ordinary equality frame emits before deeper equality and consumes discarded proposal',()=>{
 const budget={remaining:2n},completion={done:false};
 const {loops}=fixture({multiple:true,budget,completion,skipScan:true,sql:'SELECT b FROM t INDEXED BY ab WHERE a=1 AND z=2 AND b=7'});
 assert.equal(loops.length,1);
 assert.equal(loops[0].capability.nEq,1);
 assert.equal(budget.remaining,0n);
 assert.equal(completion.done,false); // parent successful insertion owns OK
});

 test('unordered stat1 admits skip equality but never credits physical ordering',()=>{
 const {loops}=fixture({unordered:true,sql:'SELECT b FROM t INDEXED BY ab WHERE b=7',order:false});
 const selected=loops.find(l=>l.capability?.nSkip===1);assert.ok(selected);
 });

test('unordered skip cannot satisfy ORDER BY skipped leading column',()=>{
 const normal=fixture({orderA:true}).loops.find(l=>l.capability?.nSkip===1);assert.equal(normal.capability.orderTermsSatisfied,1);
 const unordered=fixture({unordered:true,orderA:true}).loops.find(l=>l.capability?.nSkip===1);assert.ok(unordered);assert.equal(unordered.capability.orderTermsSatisfied,0);assert.equal(unordered.capability.reverse,false);
});

test('source shared planner budget exact zero returns DONE without decrement or OR residue; nullable resize restores enclosing OK',()=>{
 const set={a:[{prereq:0n,rRun:9n,nOut:9n}]},budget={remaining:0n},completion={done:false};
 fixture({recursive:true,orSet:set,budget,completion});
 assert.equal(budget.remaining,0n);assert.deepEqual(set.a,[]);assert.equal(completion.done,false);
});
test('ordinary and OR recursive producers debit the same exact BigInt budget',()=>{
 const initial=2n**60n,shared={remaining:initial};
 const first={a:[]};fixture({orSet:first,budget:shared});
 const afterOr=shared.remaining;assert.ok(afterOr<initial&&afterOr>0n);
 fixture({budget:shared});assert.ok(shared.remaining<afterOr);
 const reference={remaining:100n};fixture({orSet:{a:[]},budget:reference});fixture({budget:reference});
 assert.equal(initial-shared.remaining,100n-reference.remaining);
});

// Native primitive companion selects a>? for leading NOTNULL and ANY(a,b)
// for suffix NOTNULL+c range. whereexpr.c1331 owns the virtual x>NULL child;
// equal rows from residual filtering do not establish producer fidelity.
test('source NOTNULL analysis produces linked virtual lower bound',()=>{
 const {loops,term}=fixture({sql:'SELECT b FROM t INDEXED BY ab WHERE a IS NOT NULL'});
 const range=loops.find(loop=>loop.capability?.lower?.term.parentId===term.id);
 assert.ok(range,'whereexpr.c1331 virtual NOTNULL child must reach production btreeLoops');
 assert.equal(range.capability.lower.operator,'gt');
 assert.equal(range.capability.lower.fieldOrdinal,0);
 assert.equal(range.capability.lower.term.virtual,true);
 assert.equal(range.capability.lower.term.virtualNull,true);
 assert.equal(range.capability.lower.term.prereqRight,0n);
 assert.ok(term.childIds.includes(range.capability.lower.term.id));
});

// where.c3618–3650: admission owns >=42 independently of unordered,
// while where.c5289 forbids physical order credit on unordered indexes.
test('source stat1 admission and unordered order ownership Cartesian boundary',()=>{
 for(const duplicates of [41,42,43,60])for(const unordered of [false,true])for(const hasStat1 of [false,true])for(const noSkipScan of [false,true]){
  const {loops,term}=fixture({duplicates,unordered,hasStat1,noSkipScan,orderA:true});
  const suffix=loops.find(loop=>loop.capability?.equalitySlots.some(a=>a?.term===term));
  const admitted=duplicates>=42&&hasStat1&&!noSkipScan;
  assert.equal(!!suffix,admitted,JSON.stringify({duplicates,unordered,hasStat1,noSkipScan}));
  if(suffix){
   assert.equal(suffix.capability.nSkip,1);
   assert.equal(suffix.capability.nEq,2);
   assert.equal(suffix.capability.equalitySlots[0],null);
   assert.equal(suffix.outputRows,BigInt(100-duplicates+5),'unmultiplied output restored with nIter+5');
   assert.equal(suffix.capability.orderTermsSatisfied,unordered?0:1);
   if(unordered)assert.equal(suffix.capability.reverse,false);
  }
 }
});

test('rowid ordering remains a separate scan owner without a declared IPK alias',()=>{
 const {loops}=fixture({sql:'SELECT b FROM t WHERE b>7 OR b=1'});
 const table=loops[0].source.table;
 const resolved=expandAndResolveSelect(parseSql('SELECT b FROM t WHERE b>7 OR b=1 ORDER BY rowid DESC').statement,{tables:new Map([['t',table]])});
 const order=resolvedWhereOrder(resolved);
 assert.equal(order.length,1);assert.equal(order[0].column,null);
 const analysis=analyzeWhere(resolved);
 const candidates=btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:null,neededColumns:new Set(table.columns),orderBy:order,resolved});
 const scan=candidates.find(l=>l.kind==='table-scan');
 assert.ok(scan,'OR insertion must not erase rowid sort owner');
 assert.equal(scan.sortIdentity,1);assert.equal(scan.capability.reverse,true);assert.equal(scan.capability.orderTermsSatisfied,1);
});


test('where.c3595 deep equality construction checks control before recursion and propagates error, not DONE',()=>{
 const sql='SELECT b FROM t INDEXED BY ab WHERE a=1 AND z=2 AND b=3 AND c=4 AND d=5 AND e=6';
 const sentinel=new Error('construction interrupt'),budget={remaining:20000n,progressCheck(){if(new Error().stack.includes('visit'))throw sentinel;}};
 assert.throws(()=>fixture({deep:true,sql,budget}),error=>error===sentinel);
 const recovery=fixture({deep:true,sql,budget:{remaining:20000n}});
 assert.ok(recovery.loops.some(l=>l.capability?.nEq===6),'fresh construction has all six equalities');
});

test('shared OR construction control error preserves identity instead of normal insertion exhaustion',()=>{
 const sentinel=new Error('OR construction interrupt'),budget={remaining:20000n,progressCheck(){throw sentinel;}};
 assert.throws(()=>fixture({deep:true,sql:'SELECT b FROM t WHERE (a=1 AND z=2 AND b=3 AND c=4 AND d=5 AND e=6) OR b=7',budget}),e=>e===sentinel);
});
