import test from 'node:test';import assert from 'node:assert/strict';
import {whereLoopInsertCandidates} from '../../src/internal/where-plan.ts';
// Independent branch transcription of pinned where.c2662-2697, exercised through
// production insertion/cost adjustment rather than a private predicate export.
function subset(x,y){
 if(x.runCost>y.runCost&&x.outputRows>y.outputRows)return false;
 const a=x.capability,b=y.capability;
 if(a.index===b.index&&a.nEq<b.nEq&&a.nSkip===0&&b.nSkip===0)return true;
 const xt=[...a.equalitySlots,a.lower,a.upper].filter(Boolean).map(v=>v.term),yt=[...b.equalitySlots,b.lower,b.upper].filter(Boolean).map(v=>v.term);
 if(xt.length>=yt.length)return false;
 if(b.nSkip>a.nSkip)return false;
 for(const term of xt)if(!yt.includes(term))return false;
 if(a.covering&&!b.covering)return false;
 return true;
}
test('source proper-subset cost adjustment Cartesian branches through insertion',()=>{
 const terms=[{},{}],indexes=[{},{}];let count=0;
 for(const xs of [0,1,2])for(const ys of [0,1,2])for(const same of [false,true])for(const xc of [false,true])for(const yc of [false,true])for(const xm of [0,1,2,3])for(const ym of [0,1,2,3])for(const expensive of [false,true]){
  const cap=(skip,mask,index,covering)=>{const slots=[...Array(skip).fill(null),...terms.filter((_,i)=>mask&(1<<i)).map(term=>({term}))];return {index,nEq:slots.length,nSkip:skip,equalitySlots:slots,lower:null,upper:null,covering};};
  const x={kind:'index',sourceOrdinal:0,prereq:1n,setupCost:0n,runCost:expensive?20n:10n,outputRows:expensive?20n:10n,capability:cap(xs,xm,indexes[0],xc)};
  const y={...x,prereq:2n,runCost:15n,outputRows:15n,capability:cap(ys,ym,same?indexes[0]:indexes[1],yc)};
  let expected=y;if(subset(x,y))expected={...y,runCost:y.runCost<x.runCost?y.runCost:x.runCost,outputRows:y.outputRows<x.outputRows-1n?y.outputRows:x.outputRows-1n};else if(subset(y,x))expected={...y,runCost:y.runCost>x.runCost?y.runCost:x.runCost,outputRows:y.outputRows>x.outputRows+1n?y.outputRows:x.outputRows+1n};
  const budget={remaining:2n},result=whereLoopInsertCandidates([x,y],budget);assert.equal(result.length,2,'incomparable prerequisites retain both');assert.equal(result[1].runCost,expected.runCost);assert.equal(result[1].outputRows,expected.outputRows);assert.equal(budget.remaining,0n);count++;
 }
 assert.equal(count,2304);
});

test('source insertion dominance and sort identity Cartesian branches for skip plans',()=>{
 const index={},term={};let count=0;
 for(const skip of [1,2])for(const xp of [0n,1n,2n,3n])for(const yp of [0n,1n,2n,3n])for(const xr of [10n,15n,20n])for(const yr of [10n,15n,20n])for(const xo of [10n,15n,20n])for(const yo of [10n,15n,20n])for(const sameSort of [false,true]){
  const capability={index,nEq:skip+1,nSkip:skip,equalitySlots:[...Array(skip).fill(null),{term}],lower:null,upper:null,covering:true};
  const x={kind:'index',sourceOrdinal:0,prereq:xp,setupCost:0n,runCost:xr,outputRows:xo,sortIdentity:1,capability},y={...x,prereq:yp,runCost:yr,outputRows:yo,sortIdentity:sameSort?1:2};
  const oldDominates=sameSort&&(xp&yp)===xp&&xr<=yr&&xo<=yo,newDominates=sameSort&&(xp&yp)===yp&&xr>=yr&&xo>=yo;
  const budget={remaining:2n},result=whereLoopInsertCandidates([x,y],budget);assert.equal(budget.remaining,0n);assert.equal(result.length,oldDominates||newDominates?1:2);if(oldDominates)assert.equal(result[0],x);else if(newDominates)assert.equal(result[0],y);count++;
 }
 assert.equal(count,5184);
});
