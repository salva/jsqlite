import test from 'node:test';
import assert from 'node:assert/strict';
import {wherePathSolver} from '../../src/internal/where-plan.ts';

// Independent transcription of pinned where.c5920–6130, no ORDER BY.
// Includes the source mxUnsort initialization from nRow (not a correction).
function add(a,b){const t=[10,10,9,9,8,8,7,7,7,6,6,6,5,5,5,4,4,4,4,3,3,3,3,3,3,2,2,2,2,2,2,2];if(a<b)[a,b]=[b,a];const d=a-b;return d>49n?a:d>31n?a+1n:a+BigInt(t[Number(d)]);}
function nativeFrontier(groups,n,width){
 let from=[{loops:[],mask:0n,rows:0n,cost:0n,unsorted:0n}];
 for(let round=0;round<n;round++){
  const to=[];let mxI=0,mxCost=0n,mxUnsort=0n;
  for(const old of from)for(const loop of groups.flat()){
   const bit=1n<<BigInt(loop.sourceOrdinal);
   if(loop.prereq&~old.mask||old.mask&bit)continue;
   let unsorted=loop.runCost+old.rows;
   if(loop.setupCost)unsorted=add(loop.setupCost,unsorted);
   unsorted=add(unsorted,old.unsorted);const cost=unsorted;unsorted-=2n;
   const rows=old.rows+loop.outputRows,mask=old.mask|bit;
   let slot=to.findIndex(x=>x.mask===mask);
   if(slot<0){
    if(to.length>=width&&(cost>mxCost||(cost===mxCost&&unsorted>=mxUnsort)))continue;
    slot=to.length<width?to.length:mxI;
   }else{
    const prev=to[slot],last=prev.loops[round];
    const noBetter=loop.kind!=='index'||last.kind!=='index'||loop.indexRowSize>=last.indexRowSize;
    if(prev.cost<cost||prev.cost===cost&&(prev.rows<rows||prev.rows===rows&&(prev.unsorted<unsorted||prev.unsorted===unsorted&&noBetter)))continue;
   }
   to[slot]={loops:[...old.loops,loop],mask,rows,cost,unsorted};
   if(to.length>=width){mxI=0;mxCost=to[0].cost;mxUnsort=to[0].rows;for(let j=1;j<to.length;j++)if(to[j].cost>mxCost||to[j].cost===mxCost&&to[j].unsorted>mxUnsort){mxI=j;mxCost=to[j].cost;mxUnsort=to[j].unsorted;}}
  }
  from=to;
 }
 assert.equal(from.length,1);return from[0];
}
test('production frontier preserves pinned list order, pruning and cost ties',()=>{
 let seed=0x5340400;const rnd=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};let count=0;
 for(let sample=0;sample<400;sample++)for(const width of [1,2,3,5]){
  const n=2+sample%3,groups=[];
  for(let sourceOrdinal=0;sourceOrdinal<n;sourceOrdinal++){
   const source={cursorId:sourceOrdinal},group=[];
   for(let k=0;k<3;k++){
    const kind=k===0?'table-scan':'index';
    group.push({source,sourceOrdinal,prereq:sourceOrdinal&&rnd(2)?1n<<BigInt(sourceOrdinal-1):0n,kind,capability:null,indexRowSize:BigInt(10+rnd(3)),setupCost:k===2?BigInt(rnd(30)):0n,runCost:BigInt(10+rnd(6)),outputRows:BigInt(rnd(6)),terms:[],id:`${sourceOrdinal}/${k}`});
   }
   if(sample%2)group.reverse();groups.push(group);
  }
  const expected=nativeFrontier(groups,n,width),actual=wherePathSolver(groups,n,width);
  assert.deepEqual(actual.loops.map(x=>x.id),expected.loops.map(x=>x.id),`sample${sample} width${width}`);
  assert.equal(actual.cost,expected.cost);assert.equal(actual.rows,expected.rows);assert.equal(actual.unsortedCost,expected.unsorted);assert.equal(actual.ready,expected.mask);count++;
 }
 assert.equal(count,1600);
});
