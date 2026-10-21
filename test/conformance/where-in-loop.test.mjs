import test from 'node:test';
import assert from 'node:assert/strict';
import {beginInLoop,finishInLoops} from '../../src/internal/where-in-loop.ts';
// Control-flow witness only; public caller tests exercise the VM separately.
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
