import test from 'node:test';
import assert from 'node:assert/strict';
import {beginInLoop,beginInVectorLoop,finishInLoops} from '../../src/internal/where-in-loop.ts';
// Control-flow witness only; public caller tests exercise the VM separately.
test('vector aiMap fields share movement and every NULL guard skips that row',()=>{
 for(const reverse of [false,true])for(const descending of [false,true]){
  const ops=[],loop=beginInVectorLoop(ops,71,[{target:89,field:1},{target:90,field:0},{target:91,field:1}],reverse,descending);
  const advance=finishInLoops(ops,[loop],999);
  assert.equal(loop.top,1);assert.deepEqual(loop.nullGuards,[2,4,6]);
  assert.deepEqual(ops.filter(op=>op.code==='Column').map(op=>[op.p1,op.p2,op.p3]),[[1,89,71],[0,90,71],[1,91,71]]);
  for(const address of loop.nullGuards)assert.equal(ops[address].p2,advance);
  assert.equal(ops[advance].code,reverse!==descending?'IndexPrev':'IndexNext');
  assert.equal(ops[advance].p2,loop.top);
  assert.equal(ops.filter(op=>op.code==='IndexNext'||op.code==='IndexPrev').length,1);
 }
});
test('LEFT NULL continuation retains initial JumpHere unless EARLYOUT retargets it',()=>{
 for(const left of [false,true])for(const early of [false,true])for(const reverse of [false,true]){
  const ops=[],prefix=early?{p1:7,keys:[8],affinities:['integer'],keyInfo:{}}:undefined;
  const loop=beginInVectorLoop(ops,71,[{target:89,field:1},{target:90,field:0}],reverse,false,prefix);
  const advance=finishInLoops(ops,[loop],999,left);
  const movement=advance+(left?1:0)+(early?1:0);
  for(const address of loop.nullGuards)assert.equal(ops[address].p2,early?movement:advance);
  assert.equal(ops[movement].code,reverse?'IndexPrev':'IndexNext');
  if(left)assert.deepEqual(ops[advance],{code:'IfNotOpen',p1:71,p2:movement+1});
  if(early)assert.equal(ops[movement-1].code,'IndexIfNoHope');
 }
});
// Inputs stand for already-unique Btree records, not SQL evaluation.
function run(sets,reverses){
 const ops=[],loops=sets.map((_,i)=>beginInLoop(ops,i,i,reverses[i]));
 const emit=ops.length;ops.push({code:'WitnessRow'});
 const advance=finishInLoops(ops,loops,999);
 const exit=ops.length;ops.push({code:'Halt'});
 ops[loops[0].start]={...ops[loops[0].start],p2:exit};
 const positions=[],registers=[],rows=[];let pc=0,steps=0;
 while(pc!==exit){
  assert.ok(++steps<1000,'continuation must terminate');const op=ops[pc++];
  switch(op.code){
   case 'IndexRewind':case 'IndexLast':positions[op.p1]=op.code==='IndexLast'?sets[op.p1].length-1:0;if(!sets[op.p1].length)pc=op.p2;break;
   case 'Column':registers[op.p2]=sets[op.p3][positions[op.p3]];break;
   case 'IsNull':if(registers[op.p1]===null)pc=op.p2;break;
   case 'IndexNext':case 'IndexPrev':positions[op.p1]+=op.code==='IndexNext'?1:-1;if(positions[op.p1]>=0&&positions[op.p1]<sets[op.p1].length)pc=op.p2;break;
   case 'WitnessRow':rows.push([...registers]);pc=advance;break;
   default:assert.fail(op.code);
  }
 }
 return {ops,loops,rows,emit,advance,exit};
}
test('codeINTerm LOOP slots restart inside-out, skip NULL and preserve direction',()=>{
 for(const a of [false,true])for(const b of [false,true]){
  const result=run([[null,1,2],[null,10,20]],[a,b]);
  const expected=(a?[2,1]:[1,2]).flatMap(x=>(b?[20,10]:[10,20]).map(y=>[x,y]));
  assert.deepEqual(result.rows,expected);
  assert.equal(result.ops[result.loops[1].start].p2,result.advance+1);
  assert.equal(result.ops[result.loops[1].nullGuard].p2,result.advance);
 }
});
test('three independent slots restart every inner endpoint after outer advancement',()=>{
 const {rows}=run([[null,1,2],[null,10,20],[null,100,200]],[false,true,false]);
 assert.deepEqual(rows,[1,2].flatMap(a=>[20,10].flatMap(b=>[100,200].map(c=>[a,b,c]))));
});
test('empty or all-NULL slots never publish a probe and outer restart terminates',()=>{
 for(const sets of [[[],[1]],[[1],[]],[[null],[1]],[[1],[null]],[[null],[null]]])assert.deepEqual(run(sets,[false,true]).rows,[]);
});
test('RHS index DESC toggles direction; cursor/register/field identity is retained',()=>{
 const ops=[],loop=beginInLoop(ops,71,89,true,true,3);
 assert.equal(Object.isFrozen(loop),true);assert.equal(loop.reverse,false);
 assert.deepEqual(ops,[{code:'IndexRewind',p1:71,p2:0},{code:'Column',p1:3,p2:89,p3:71,inProbe:true},{code:'IsNull',p1:89,p2:0}]);
 assert.equal(finishInLoops(ops,[loop],100),3);
 assert.deepEqual(ops[3],{code:'IndexNext',p1:71,p2:1});assert.equal(ops[0].p2,100);assert.equal(ops[2].p2,3);
});
