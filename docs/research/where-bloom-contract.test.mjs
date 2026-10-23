import test from 'node:test';
import assert from 'node:assert/strict';
import {assertStandaloneBloom,assertPulldown,standaloneBloom} from './where-bloom-contract.mjs';
// Synthetic fixtures validate pending assertions only, never runtime credit.
const expected={rows:[[{type:'integer',value:'1'}]],columns:[{name:'id',database:'main',table:'rhs',column:'id',declType:'INTEGER'}],indexIdentity:'main.rk',builds:1,insertedFilterKeys:8,probes:3,absent:1,present:2,persistentSeeks:2,collisionRejects:1,
 trace:['Once','rhs.Rewind','predicate','FilterAdd','rhs.Next','Affinity','Filter.absent','OuterNext','Affinity','Filter.present','SeekGE.collision','Affinity','Filter.present','SeekGE.match','residual','ResultRow']};
const good=()=>({...structuredClone(expected),version:1,planKind:'persistent-index',error:null,executedOps:['Once','FilterAdd','Filter','SeekGE'],autoindexBuilds:0,executionId:1,planIdentity:'p'});
test('standalone rejects automatic construction, false matches and wrong seek/work/result paths',()=>{
 assertStandaloneBloom(good(),expected);
 for(const change of [{planKind:'automatic-index'},{autoindexBuilds:1},{executedOps:['Once','FilterAdd','Filter','OpenAutoindex']},{persistentSeeks:3},{collisionRejects:0},{builds:2},{rows:[]},{columns:[]},{trace:['Filter.present','ResultRow']},{indexIdentity:'other'}])
  assert.throws(()=>assertStandaloneBloom({...good(),...change},expected));
});
test('standalone driver requires fresh reset build and stable retained plan',async()=>{
 const adapter=()=>{let n=0;return {reset:async()=>{},execute:async()=>({...good(),executionId:++n})};};
 await standaloneBloom(adapter(),[{id:'collision',expected}]);
 for(const field of ['executionId','planIdentity','builds']) {
  let n=0;
  const broken={reset:async()=>{},execute:async()=>({...good(),executionId:++n,...(field==='executionId'?{executionId:1}:field==='planIdentity'?{planIdentity:String(n)}:{builds:n})})};
  await assert.rejects(()=>standaloneBloom(broken,[{id:'collision',expected}]));
 }
});
const eligible=kind=>({loopId:1,outer:false,inOperator:false,notReady:false,skipScan:false,early:true,keyKind:kind,filterRegisterAfter:0,breakTargetBefore:10,breakTargetAfter:10,outerNext:20,absentTarget:20,earlyTrace:[kind==='rowid'?'MustBeInt':'Affinity','Filter','OuterNext']});
test('pulldown enforces affinity or rowid conversion before early skip and restores state',()=>{
 for(const kind of ['rowid','index']) {
  const e=eligible(kind);assertPulldown([e],[e]);
  for(const change of [{filterRegisterAfter:1},{breakTargetAfter:20},{absentTarget:10},{earlyTrace:['Filter','SeekGE']}]) {
   const wrong={...e,...change};assert.throws(()=>assertPulldown([wrong],[wrong]));
  }
 }
});
test('pulldown forbids outer, IN, unready and skip-scan early tests',()=>{
 for(const flag of ['outer','inOperator','notReady','skipScan']) {
  const safe={...eligible('index'),[flag]:true,early:false,earlyTrace:[]};
  assertPulldown([safe],[safe]);
  const unsafe={...safe,early:true};assert.throws(()=>assertPulldown([unsafe],[unsafe]));
  assert.throws(()=>assertPulldown([safe],[{...safe,loopId:2}]));
 }
});
test('standalone and pulled-down Bloom actual public execution',
 {skip:'PENDING persistent Bloom implementation and dispatch observation adapter; synthetic tests confer no runtime credit'},()=>{});
