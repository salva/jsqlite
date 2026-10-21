import test from 'node:test';
import assert from 'node:assert/strict';
import {beginInLoop,finishInLoops} from '../../src/internal/where-in-loop.ts';
import {dispatchPrivateInCursor} from '../../src/internal/private-in-dispatch.ts';
// where.c sqlite3WhereEnd LEFT path: an equality NULL bypasses construction
// of a later RHS, but unmatched-once body still enters level continuation.
// This isolates continuation ownership, not SQL join match/null-row semantics.
for(const reverse of [false,true])test(`LEFT continuation skips unopened inner RHS ${reverse?'Prev':'Next'}`,async()=>{
 const ops=[],outer=beginInLoop(ops,21,1,false),inner=beginInLoop(ops,22,2,reverse);
 const continuation=ops.length,exit=continuation+4;
 assert.equal(finishInLoops(ops,[outer,inner],exit,true),continuation);
 const visited=[];
 const cursors=new Map([[21,{nullRow:false,async next(){visited.push('outer-next');return false}}]]);
 let pc=continuation,steps=0;
 while(pc!==exit){
  assert.ok(++steps<10,'LEFT drain must terminate');
  const op=ops[pc++];assert.notEqual(op.code,'Column','no phantom row after unmatched body');
  const result=await dispatchPrivateInCursor(op,cursors,[],{checkpoint(){}});
  assert.equal(result.handled,true,'unopened inner movement must be guarded');
  if(result.jump!==null)pc=result.jump;
 }
 assert.deepEqual(visited,['outer-next']);
 assert.deepEqual(ops[continuation],{code:'IfNotOpen',p1:22,p2:continuation+2});
 assert.equal(ops[inner.start].p2,continuation+2);
 assert.equal(ops[inner.nullGuard].p2,continuation);
 assert.equal(ops[outer.start].p2,exit);
 // Native OP_IfNotOpen also branches for an open cursor marked nullRow.
 const guarded={nullRow:true};
 assert.deepEqual(await dispatchPrivateInCursor({code:'IfNotOpen',p1:22,p2:99},new Map([[22,guarded]]),[],{checkpoint(){throw Error('no Btree work')}}),{handled:true,jump:99});
 guarded.nullRow=false;
 assert.deepEqual(await dispatchPrivateInCursor({code:'IfNotOpen',p1:22,p2:99},new Map([[22,guarded]]),[],{checkpoint(){}}),{handled:true,jump:null});
 // All unopened: no cursor is fabricated and no movement method runs.
 assert.deepEqual(await dispatchPrivateInCursor({code:'IfNotOpen',p1:22,p2:99},new Map(),[],{checkpoint(){throw Error('no Btree work')}}),{handled:true,jump:99});
});
