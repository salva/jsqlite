import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {jsonWhereLoops} from '../../src/internal/where-json-loops.ts';
const resolve=sql=>expandAndResolveSelect(parseSql(sql).statement,{tables:new Map()});
test('module loop owns BestIndex args and native default estimates, not a physical scan',()=>{
 const plan=resolve("SELECT value FROM json_each('[1]')");
 const [loop]=jsonWhereLoops(plan,plan.sources[0],new Set());
 assert.equal(loop.kind,'json-module');assert.equal(loop.runCost,0n);assert.equal(loop.outputRows,46n);
 assert.equal(loop.prereq,0n);assert.equal(loop.index.idxNum,1);assert.equal(loop.arguments.length,1);
 assert.equal('rootPage' in loop,false);assert.equal('capability' in loop,false);
 const empty=resolve('SELECT value FROM json_each');
 assert.equal(jsonWhereLoops(empty,empty.sources[0],new Set())[0].runCost,3280n);
});
test('local dependency selects only a usable module order; unusable prerequisite rejects candidate',()=>{
 const plan=resolve("SELECT b.value FROM json_each('[1]') a, json_each(a.value) b");
 const loops=jsonWhereLoops(plan,plan.sources[1],new Set());
 assert.equal(loops.length,1);assert.equal(loops[0].prereq,1n);assert.equal(loops[0].index.idxNum,1);
 assert.deepEqual(jsonWhereLoops(plan,plan.sources[1],new Set(),0n,1n),[]);
});
test('selected duplicate EQ changes dependencies rather than consuming residual predicates',()=>{
 const plan=resolve("SELECT b.value FROM json_each('[1]') a, json_each b WHERE b.json=a.value AND b.json='[2]'");
 const loops=jsonWhereLoops(plan,plan.sources[1],new Set());
 assert.equal(loops.length,1);assert.equal(loops[0].prereq,0n);assert.equal(loops[0].index.arguments[0],1);
 assert.ok(loops[0].arguments[0].residual);
});
test('external linked source availability is supplied, not inferred from nesting',()=>{
 const outer=resolve("SELECT EXISTS(SELECT 1 FROM json_each(a.value) b) FROM json_each('[1]') a");
 const child=outer.nested[0];assert.ok(child);
 assert.deepEqual(jsonWhereLoops(child,child.sources[0],new Set()),[]);
 const loops=jsonWhereLoops(child,child.sources[0],new Set([outer.sources[0]]));
 assert.equal(loops.length,1);assert.equal(loops[0].prereq,0n);assert.equal(loops[0].index.idxNum,1);
});

test('distinct usable masks preserve both dependent and independent selected EQs',()=>{
 const plan=resolve("SELECT b.value FROM json_each('[1]') a, json_each b WHERE b.json='[2]' AND b.json=a.value");
 const loops=jsonWhereLoops(plan,plan.sources[1],new Set());
 assert.deepEqual(loops.map(loop=>[loop.prereq,loop.index.arguments[0]]),[[1n,1],[0n,0]]);
});
test('required join prefix remains a prerequisite even for constant Filter args',()=>{
 const plan=resolve("SELECT b.value FROM json_each('[1]') a CROSS JOIN json_each('[2]') b");
 const loops=jsonWhereLoops(plan,plan.sources[1],new Set(),1n);
 assert.equal(loops.length,1);assert.equal(loops[0].prereq,1n);
});
test('nested SELECT-local sources do not become outer prerequisites',()=>{
 const plan=resolve("SELECT value FROM json_each((SELECT value FROM json_each('[1]'))) b");
 const loops=jsonWhereLoops(plan,plan.sources[0],new Set());
 assert.equal(loops.length,1);assert.equal(loops[0].prereq,0n);
});

// Integration check: candidate groups flow through AddAll and the shared path
// solver. This is not a VDBE/runtime admission test.
import {planWhere} from '../../src/internal/where-plan.ts';
const selectPath=(plan,extra={})=>planWhere(plan,{neededColumns:plan.sources.map(()=>new Set()),orderBy:[],...extra});
test('AddAll dispatches genuine virtual candidates through the shared path solver',()=>{
 const plan=resolve("SELECT b.value FROM json_each('[1]') a CROSS JOIN json_each(a.value) b");
 const selected=selectPath(plan);
 assert.deepEqual(selected.path.loops.map(loop=>loop.kind),['json-module','json-module']);
 assert.deepEqual(selected.path.loops.map(loop=>loop.sourceOrdinal),[0,1]);
 assert.equal(selected.path.loops[1].prereq,1n);
 for(const loop of selected.path.loops){assert.equal('capability' in loop,false);assert.equal(loop.outputRows,46n);}
});
test('nested AddAll requires explicit outer position, not lexical correlation',()=>{
 const outer=resolve("SELECT EXISTS(SELECT 1 FROM json_each(a.value) b) FROM json_each('[1]') a");
 const inner=outer.nested[0];
 assert.throws(()=>selectPath(inner));
 const selected=selectPath(inner,{externalAvailable:new Set(outer.sources)});
 assert.equal(selected.path.loops[0].kind,'json-module');
 assert.equal(selected.path.loops[0].prereq,0n);
});
test('virtual no-input candidate retains native estimates and rejects INDEXED BY',()=>{
 const empty=selectPath(resolve('SELECT value FROM json_each'));
 assert.equal(empty.path.loops[0].runCost,3280n);
 assert.equal(empty.path.loops[0].outputRows,46n);
 assert.throws(()=>selectPath(resolve('SELECT value FROM json_each INDEXED BY missing')),/no such index/);
});

test('AddAll keeps LEFT join prefix while selecting hidden equality arguments',()=>{
 const plan=resolve("SELECT b.value FROM json_each('[1]') a LEFT JOIN json_each b ON b.json=a.value");
 const selected=selectPath(plan);
 assert.deepEqual(selected.path.loops.map(loop=>loop.sourceOrdinal),[0,1]);
 const right=selected.path.loops[1];
 assert.equal(right.prereq,1n);assert.equal(right.index.idxNum,1);
 assert.equal(right.arguments[0].joinOwner,plan.sources[1]);
 assert.ok(right.arguments[0].residual);
});

test('AddAll inserts module templates through shared dominance and budget',async()=>{
 const {planWhere}=await import('../../src/internal/where-plan.ts');
 const plan=resolve("SELECT b.value FROM json_each('[1]') a, json_each b WHERE b.json=a.value AND b.json='[2]'");
 const budget={remaining:0n,constructionLimit:0n};
 const selected=planWhere(plan,{neededColumns:plan.sources.map(()=>new Set()),orderBy:[],planBudget:budget});
 // BestIndex first chooses a.value; fallback chooses the independent literal.
 // Same cost/rows/sort identity means the latter replaces the dependent loop.
 assert.equal(selected.plannerCandidates,2);
 const right=selected.path.loops.find(loop=>loop.sourceOrdinal===1);
 assert.equal(right.prereq,0n);
 assert.equal(right.index.idxNum,1);
 assert.ok(budget.remaining<2000n,'each source grants1000; successful virtual templates spend insertion slots');
 assert.equal(selected.path.loops.length,2);
});
