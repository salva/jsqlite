// Contract self-tests only. A future production adapter must not use these
// synthetic observations. Native expected values belong to separate captures.
import test from 'node:test';
import assert from 'node:assert/strict';
import {workAndLifetime} from './where-autoindex-pending-controls.mjs';
const work={buildRows:128,probes:63,absent:0,collisions:0};
const columns=[{name:'rid',declaredType:'INTEGER',database:'main',table:'rhs',origin:'id'}];
const expectations=[1,1,17,17].map(n=>({rows:[[{type:'integer',value:String(n)}]],columns,work:{...work,absent:n===17?63:0}}));
function adapter(change=()=>{}) {
 let run=0;
 return {async reset(){},async bind(n){assert.equal(n,17)},async reprepare(){return {
  snapshot:{ownerId:1,chargedBytes:128,refundedBytes:128,ownedBytes:0,openCursors:0,filterBytes:0,onceActive:false},
  independentBefore:{ownerId:2,ownedBytes:64},independentAfter:{ownerId:2,ownedBytes:64}}},
 async execute(){const i=run++,e=expectations[i],absent=e.work.absent;
 const result={version:1,planKind:'automatic-index',executedOps:['OpenAutoindex','FilterAdd','Filter'],
  error:null,rows:structuredClone(e.rows),columns:structuredClone(e.columns),
  builds:1,insertedRecords:128,probes:63,filterAbsent:absent,filterPresent:63-absent,indexSeeks:63-absent,
  collisionRejects:0,coveringTableLookups:0,executionId:i+1,planIdentity:i===3?'new':'old'};
 change(result,i);return result;}};
}
test('lifetime driver checks distinct expectations through reset bind and reprepare',async()=>{
 await workAndLifetime(adapter(),expectations);
});
test('lifetime driver rejects stale rows metadata errors work and identities after reprepare',async()=>{
 for(const mutation of [r=>r.rows=[],r=>r.columns=[],r=>r.error=new Error('wrong'),r=>r.builds=0,r=>r.executionId=3,r=>r.planIdentity='old'])
  await assert.rejects(workAndLifetime(adapter((r,i)=>{if(i===3)mutation(r)}),expectations));
 await assert.rejects(workAndLifetime(adapter((r,i)=>{if(i===2)r.filterAbsent=0}),expectations));
 await assert.rejects(workAndLifetime(adapter((r,i)=>{if(i===2)r.rows=expectations[0].rows}),expectations));
});
