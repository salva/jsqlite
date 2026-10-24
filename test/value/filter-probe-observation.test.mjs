import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
// Filter cannot establish presence. Initial SeekGE/IdxGT owns rejection;
// later duplicate exhaustion is not a collision for an already matched probe.
test('filter candidates resolve once at initial seek/prefix',async()=>{
 const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 for(const probe of [0n,1n,2n]){
  const ops=[{code:'OpenAutoindex',p1:0,keyInfo},{code:'FilterInit',p1:5,bytes:1}];
  for(const tail of [1n,2n])ops.push({code:'Integer',p1:1n,p2:0},{code:'Integer',p1:tail,p2:1},{code:'MakeRecord',p1:0,p2:2,p3:2},{code:'IdxInsert',p1:0,p2:2,consumeRecord:true});
  // Deliberately install candidate bit: no dependence on incidental collisions.
  ops.push({code:'Integer',p1:probe,p2:3},{code:'FilterAdd',p1:5,p3:3,p4:1});
  const filter=ops.length;ops.push({code:'Filter',p1:5,p2:0,p3:3,p4:1,probeCursor:0});
  const seek=ops.length;ops.push({code:'IndexSeekPrefix',p1:0,p2:0,keys:[3],affinities:['blob'],keyInfo,reverse:false});
  const prefix=ops.length;ops.push({code:'IndexPrefixEnd',p1:0,p2:0,keys:[3],affinities:['blob'],keyInfo},
   {code:'Column',p1:1,p2:4,p3:0},{code:'ResultRow',p1:4,p2:1},{code:'IndexNext',p1:0,p2:prefix});
  const end=ops.length;ops.push({code:'Halt'});for(const at of [filter,seek,prefix])ops[at].p2=end;
  const vm=new VdbeStatement({encoding:'utf-8',registers:6,parameters:[],columns:[{name:'id'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:100,maxKeyBytes:1000,maxBytes:100000},ops},()=>{},()=>()=>{},()=>{});
  try{for(let run=0;run<2;run++){
   const rows=[];while(await vm.step()==='row')rows.push(vm.column(0));
   assert.deepEqual(rows,probe===1n?[1n,2n]:[]);
   assert.equal(vm.privateAccounting().filterPresent,1);
   assert.equal(vm.privateAccounting().collisionRejects,probe===1n?0:1);
   if(!run){vm.reset();assert.equal(vm.privateAccounting().collisionRejects,0);}
  }}finally{vm.finalize();}
 }
});
