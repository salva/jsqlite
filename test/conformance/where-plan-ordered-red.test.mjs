import test from 'node:test';
import assert from 'node:assert/strict';
import {btreeLoops, sourceBit, whereClause, wherePathSolver} from '../../src/internal/where-plan.ts';

// SQLite 3.53.4 where.c:2744-2939, 5940-6000, 6060-6075.
// Private owning-path discriminators; no new public planner diagnostics.
const table = Object.freeze({kind:'table', name:'t', tableName:'t', rootPage:2,
  szTabRow:16, nRowLogEst:200, hasStat1:false,
  columns:Object.freeze([]), indexes:Object.freeze([]), withoutRowid:false,
  primaryKey:Object.freeze([]), primaryKeyTerms:Object.freeze([])});
const source = Object.freeze({table, cursorId:0, joinFromLeft:Object.freeze({left:false,right:false})});
const loop = (kind, runCost=10n, outputRows=0n) => Object.freeze({source,
  sourceOrdinal:0, prereq:0n, capability:null, kind, setupCost:0n,
  runCost, outputRows, terms:Object.freeze([])});
const rowidTerm = id => Object.freeze({id, expression:{tokens:[],reduction:null},
  origin:{kind:'where'}, operator:'eq', left:{source,sourceOrdinal:0,column:null,columnIndex:-1,rowid:true},
  rightAffinity:null,effectiveCollation:'binary',originalIndexedOperand:'left',
  prereqRight:0n,prereqAll:sourceBit(0),parentId:null,childIds:Object.freeze([]),virtual:false,
  outerJoinSafe:Object.freeze({mayDrive:true,mayOmitResidual:true})});

test('ordered insertion replaces dominated scan and drops duplicate IPK equality candidate', () => {
  // Both IPK proposals have iTab=0/iSortIdx=0, prereq=0, setup=0,
  // run=20 and nOut=0. First replaces scan; second is discarded before xfer.
  const first=rowidTerm(0), second=rowidTerm(1);
  const candidates=btreeLoops(source,0,whereClause([first,second]),
    {forcedIndex:null,neededColumns:new Set(),orderBy:[]});
  assert.equal(candidates.length,1);
  assert.equal(candidates[0].capability.rowidEquality.term,first);
});

test('no-sort solver saves biased unsorted accumulator separately from total cost', () => {
  const first=loop('table-scan');
  const path=wherePathSolver([[first]],1);
  // sqlite3LogEstAdd(10,0)=16; rCost=16; rUnsort=16-2.
  assert.equal(path.cost,16n);
  assert.equal(path.unsortedCost,14n);
});

test('equal cost vector non-indexed paths retain insertion order, not kind sorting', () => {
  const first=loop('table-scan'), second=loop('rowid');
  // whereLoopIsNoBetter returns true for a non-indexed tie. The later
  // candidate must not replace the earlier slot, regardless of kind spelling.
  assert.equal(wherePathSolver([[first,second]],1).loops[0],first);
});

test('insertion isolates sort owners and incomparable prerequisites; replaces and deletes tails in place', async () => {
 const {whereLoopInsertCandidates}=await import('../../src/internal/where-plan.ts');
 const mk=(prereq,sortIdentity,runCost,outputRows=0n)=>Object.freeze({...loop('table-scan',runCost,outputRows),prereq,sortIdentity});
 const a=mk(1n,0,30n), b=mk(2n,0,30n), separate=mk(0n,1,40n), c=mk(4n,0,30n);
 assert.deepEqual(whereLoopInsertCandidates([a,b,separate,c]),[a,b,separate,c]);
 const winner=mk(0n,0,20n);
 assert.deepEqual(whereLoopInsertCandidates([a,b,separate,c,winner]),[winner,separate]);
 assert.deepEqual(whereLoopInsertCandidates([winner,a]),[winner]);
 assert.ok(Object.isFrozen(winner));
});

test('setup invariant checked before dominance; budget consumed even by dropped templates', async () => {
 const {whereLoopInsertCandidates}=await import('../../src/internal/where-plan.ts');
 const zero=loop('table-scan',30n), setup=Object.freeze({...zero,setupCost:10n});
 assert.throws(()=>whereLoopInsertCandidates([zero,setup]),/setup invariant/);
 const budget={remaining:2n}, winner=loop('table-scan',10n), worse=loop('table-scan',20n);
 assert.deepEqual(whereLoopInsertCandidates([winner,worse,loop('rowid',1n)],budget),[winner]);
 assert.equal(budget.remaining,0n);
 assert.deepEqual(whereLoopInsertCandidates([winner],budget),[]);
});

test('solver cost vector prefers smaller rows before unsorted cost; indexed size breaks exact ties', () => {
 const first=loop('table-scan',10n,3n), smaller=loop('table-scan',10n,1n);
 assert.equal(wherePathSolver([[first,smaller]],1).loops[0],smaller);
 const wide=Object.freeze({...loop('index'),indexRowSize:40n}), narrow=Object.freeze({...loop('index'),indexRowSize:30n});
 assert.equal(wherePathSolver([[wide,narrow]],1).loops[0],narrow);
 assert.equal(wherePathSolver([[narrow,wide]],1).loops[0],narrow);
 assert.throws(()=>wherePathSolver([[first]],1,0),/choice width/);
});

test('bounded slots keep prerequisite-delayed feasible winner at widths 1 and 5', () => {
 const mk=(sourceOrdinal,prereq,runCost,outputRows=0n)=>Object.freeze({...loop('table-scan',runCost,outputRows),sourceOrdinal,prereq});
 const expensive=mk(0,0n,50n), cheap=mk(1,0n,10n), delayed=mk(0,sourceBit(1),1n);
 for(const width of [1,5]){
  const path=wherePathSolver([[expensive,delayed],[cheap]],2,width);
  assert.deepEqual(path.loops,[cheap,delayed]);
  assert.equal(path.ready,3n);
 }
});
