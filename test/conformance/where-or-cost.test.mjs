import assert from 'node:assert/strict';
import test from 'node:test';
import {whereOrInsert,whereOrMove,whereOrCollect,whereOrAccumulate} from '../../src/internal/where-or-cost.ts';
import {logEstAdd} from '../../src/internal/where-plan.ts';
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
test('recursive arm accumulation moves first arm then ordered products with prereq union and LogEstAdd',()=>{
 const sum=set(),first=set(cost(1,20,4),cost(2,30,6));
 assert.equal(whereOrAccumulate(sum,first,true,logEstAdd),true);
 assert.deepEqual(sum.a,first.a);first.a[0].rRun=999n;
 const next=set(cost(4,10,2));
 assert.equal(whereOrAccumulate(sum,next,false,logEstAdd),true);
 assert.deepEqual(sum.a,[{prereq:5n,rRun:logEstAdd(20n,10n),nOut:logEstAdd(4n,2n)},{prereq:6n,rRun:logEstAdd(30n,10n),nOut:logEstAdd(6n,2n)}]);
});
test('pinned C cost-set insertion and move agree after every ordered transition',async()=>{
 const fs=await import('node:fs');const path=await import('node:path');const {spawnSync}=await import('node:child_process');
 const work=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'or-cost-native');fs.mkdirSync(work,{recursive:true});
 const source=fs.readFileSync('reference/sqlite/sqlite-src-3530400/src/where.c','utf8');
 const start=source.indexOf('static void whereOrMove(');
 const end=source.indexOf('/*\n** Return the bitmask',start);
 assert.ok(start>=0&&end>start,'extract actual pinned insertion/move routines');
 const driver=`#include <stdint.h>\n#include <stdio.h>\n#include <string.h>\ntypedef uint16_t u16; typedef uint64_t Bitmask; typedef int16_t LogEst;\n#define N_OR_COST 3\ntypedef struct {Bitmask prereq; LogEst rRun,nOut;} WhereOrCost;\ntypedef struct {u16 n; WhereOrCost a[3];} WhereOrSet;\n${source.slice(start,end)}\nint main(void){WhereOrSet s={0},d={0}; unsigned long long mask; int run,out; while(scanf("%llu %d %d",&mask,&run,&out)==3){int rc=whereOrInsert(&s,(Bitmask)mask,(LogEst)run,(LogEst)out);whereOrMove(&d,&s);printf("%d",rc);for(int i=0;i<d.n;i++)printf(" %llu,%d,%d",(unsigned long long)d.a[i].prereq,d.a[i].rRun,d.a[i].nOut);puts("");}return 0;}\n`;
 fs.writeFileSync(path.join(work,'driver.c'),driver);
 const compiled=spawnSync('cc',['-std=c99','-Wall','-Wextra','-Werror',path.join(work,'driver.c'),'-o',path.join(work,'driver')],{encoding:'utf8'});
 assert.equal(compiled.status,0,compiled.stderr);
 // Incomparable masks fill all slots before a deterministic tie/subset matrix;
 // high bits exercise unsigned C Bitmask versus the TS BigInt representation.
 const inputs=[[1n,30n,7n],[2n,10n,6n],[4n,20n,5n],[8n,9n,12n]];
 const masks=[0n,1n,2n,3n,4n,5n,8n,1n<<63n,(1n<<63n)|1n];
 for(let i=0;i<360;i++)inputs.push([masks[(i*7)%masks.length],BigInt((i*13)%41-10),BigInt((i*11)%29-5)]);
 const native=spawnSync(path.join(work,'driver'),[],{encoding:'utf8',input:inputs.map(c=>c.join(' ')).join('\n')+'\n'});
 assert.equal(native.status,0,native.stderr);
 const actual=[],s=set(),moved=set();
 for(const [mask,run,out] of inputs){const rc=whereOrInsert(s,mask,run,out);whereOrMove(moved,s);actual.push([rc?'1':'0',...moved.a.map(c=>`${c.prereq},${c.rRun},${c.nOut}`)].join(' '));assert.notStrictEqual(moved.a,s.a);for(let i=0;i<s.a.length;i++)assert.notStrictEqual(moved.a[i],s.a[i]);}
 assert.deepEqual(actual,native.stdout.trim().split('\n'));
});
test('zero alternative arm clears previous sum, including first arm, not a table-scan substitute',()=>{
 const sum=set(cost(1,20,4));
 assert.equal(whereOrAccumulate(sum,set(),false,logEstAdd),false);assert.deepEqual(sum.a,[]);
 sum.a.push(cost(2,30,5));
 assert.equal(whereOrAccumulate(sum,set(),true,logEstAdd),false);assert.deepEqual(sum.a,[]);
});
