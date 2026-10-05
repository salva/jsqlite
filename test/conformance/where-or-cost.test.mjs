import assert from 'node:assert/strict';
import test from 'node:test';
import {whereOrInsert,whereOrMove,whereOrCollect} from '../../src/internal/where-or-cost.ts';
const cost=(prereq,rRun,nOut)=>({prereq:BigInt(prereq),rRun:BigInt(rRun),nOut:BigInt(nOut)});
const set=(...entries)=>({a:entries});
test('pinned whereOrInsert append, replacement, tie, discard and minimum nOut',()=>{
 const s=set();assert.equal(whereOrInsert(s,1n,20n,9n),true);
 assert.deepEqual(s.a,[cost(1,20,9)]);
 assert.equal(whereOrInsert(s,3n,21n,1n),false); // old subset
 assert.equal(whereOrInsert(s,1n,20n,12n),true); // new branch wins exact tie
 assert.deepEqual(s.a,[cost(1,20,9)]);
 assert.equal(whereOrInsert(s,0n,19n,8n),true);
 assert.deepEqual(s.a,[cost(0,19,8)]);
});
test('ordered first match replaces only one slot, without Pareto cleanup',()=>{
 const s=set(cost(3,30,7),cost(5,40,4));
 assert.equal(whereOrInsert(s,1n,20n,9n),true);
 assert.deepEqual(s.a,[cost(1,20,7),cost(5,40,4)]);
 // Earlier discard wins over a later replacement.
 const t=set(cost(1,10,2),cost(3,30,7));
 assert.equal(whereOrInsert(t,3n,20n,1n),false);
 assert.deepEqual(t.a,[cost(1,10,2),cost(3,30,7)]);
});
test('incomparable masks append in order and exact full-slot smallest-run branch',()=>{
 const s=set();for(const c of [cost(1,30,7),cost(2,10,6),cost(4,20,5)])assert.equal(whereOrInsert(s,c.prereq,c.rRun,c.nOut),true);
 assert.equal(whereOrInsert(s,8n,15n,1n),false); // NOT replace worst (30)
 assert.equal(whereOrInsert(s,8n,9n,12n),true);
 assert.deepEqual(s.a,[cost(1,30,7),cost(8,9,6),cost(4,20,5)]);
 assert.equal(whereOrInsert(s,16n,9n,1n),false); // chosen run <= new
 assert.equal(whereOrInsert(s,16n,8n,2n),true);
 assert.deepEqual(s.a,[cost(1,30,7),cost(16,8,2),cost(4,20,5)]);
});
test('full-slot tied minima retain first pointer',()=>{
 const s=set(cost(1,10,7),cost(2,10,6),cost(4,20,5));
 assert.equal(whereOrInsert(s,8n,9n,8n),true);
 assert.deepEqual(s.a,[cost(8,9,7),cost(2,10,6),cost(4,20,5)]);
});
test('whereOrMove copies active values and order; clearing source cannot change dest',()=>{
 const src=set(cost(2,20,3),cost(1,10,4)),dst=set(cost(4,40,9));
 whereOrMove(dst,src);assert.deepEqual(dst.a,src.a);
 src.a[0].rRun=99n;src.a.length=0;
 assert.deepEqual(dst.a,[cost(2,20,3),cost(1,10,4)]);
 whereOrMove(dst,src);assert.deepEqual(dst.a,[]);
});
test('pOrSet collector consumes shared budget before nLTerm guard and clears on DONE',()=>{
 const s=set(),budget={remaining:2},c=cost(1,20,4);
 assert.equal(whereOrCollect(s,budget,0,c),true);assert.equal(budget.remaining,1);assert.deepEqual(s.a,[]);
 assert.equal(whereOrCollect(s,budget,1,c),true);assert.equal(budget.remaining,0);assert.deepEqual(s.a,[c]);
 assert.equal(whereOrCollect(s,budget,1,c),false);assert.deepEqual(s.a,[]);
});
