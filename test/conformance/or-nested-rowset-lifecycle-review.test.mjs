import test from 'node:test';
import assert from 'node:assert/strict';
import {RowSet} from '../../src/internal/rowset.ts';
import {VdbeStatement,DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';

// Pinned vdbe.c OP_RowSetTest/OP_Gosub/OP_Return and wherecode.c Case5:
// nested invocations own independent RowSets and return registers. C saves the
// call opcode address then advances; TS saves the already-advanced pc. Returning
// must resume the enclosing call, never restart/skip its next arm. NULL begins a
// fresh inner invocation. This VM-level witness does not assert planner choice.
function program(){
 const ops=[{code:'Null',p2:1},{code:'Integer',p1:0n,p2:3}];
 const outerCalls=[];
 for(const key of [10n,20n]){
  ops.push({code:'Integer',p1:key,p2:2});
  const at=ops.length;ops.push({code:'RowSetTest',p1:1,p2:at+2,p3:2,p4:0});
  outerCalls.push(ops.length);ops.push({code:'Gosub',p1:3,p2:0});
 }
 ops.push({code:'Halt'});
 const outer=ops.length;for(const at of outerCalls)ops[at].p2=outer;
 ops.push({code:'Null',p2:4},{code:'Integer',p1:0n,p2:6});
 const innerCalls=[];
 for(const [batch,key] of [[0,1n],[1,1n],[-1,2n]]){
  ops.push({code:'Integer',p1:key,p2:5});
  const at=ops.length;ops.push({code:'RowSetTest',p1:4,p2:at+2,p3:5,p4:batch});
  innerCalls.push(ops.length);ops.push({code:'Gosub',p1:6,p2:0});
 }
 ops.push({code:'Return',p1:3});
 const inner=ops.length;for(const at of innerCalls)ops[at].p2=inner;
 ops.push({code:'Copy',p1:2,p2:7},{code:'Copy',p1:5,p2:8},{code:'ResultRow',p1:7,p2:2},{code:'Return',p1:6});
 return {ops,registers:8,encoding:'utf-8',columns:[{name:'outer',declaredType:null,database:null,table:null,origin:null},{name:'inner',declaredType:null,database:null,table:null,origin:null}],parameters:[],maxRows:100,maxWorkUnits:10000,maxResultBytes:1000,privateStateLimits:DEFAULT_PRIVATE_STATE_LIMITS};
}
async function rows(st){const out=[];while(await st.step()==='row')out.push([st.column(0),st.column(1)]);return out;}
const expected=[[10n,1n],[10n,2n],[20n,1n],[20n,2n]];

test('nested RowSet subroutines preserve enclosing continuation and invocation reset',async()=>{
 const st=new VdbeStatement(program(),()=>{},()=>()=>{},()=>{});
 try{assert.deepEqual(await rows(st),expected);st.reset();assert.deepEqual(await rows(st),expected);}finally{st.finalize();}
});

test('cancelled nested RowSets release both owners, retain primary and permit reset replay',async()=>{
 const original=RowSet.prototype.delete;
 for(const terminal of ['reset','finalize']){
  const deleted=new Map(),budgets=new Set();let finalized=0,done=false;
  const st=new VdbeStatement(program(),()=>{},()=>()=>{},()=>{finalized++;});
  RowSet.prototype.delete=function(){deleted.set(this,(deleted.get(this)??0)+1);budgets.add(this.budget);return original.call(this);};
  try{
   assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1)],expected[0]);
   const ac=new AbortController();ac.abort('nested-stop');let primary;
   await assert.rejects(st.step({signal:ac.signal}),e=>{primary=e;return e.kind==='cancelled';});
   assert.equal(deleted.size,2,'outer and inner live owners are both detached');
   assert.deepEqual([...deleted.values()],[1,1]);
   for(const budget of budgets)assert.equal(budget.usedBytes,0);
   assert.throws(()=>st[terminal](),e=>e===primary,'terminal keeps exact primary identity');
   assert.deepEqual([...deleted.values()],[1,1],'terminal cannot delete detached owners twice');
   if(terminal==='reset'){
    assert.equal(finalized,0);assert.deepEqual(await rows(st),expected);
    st.reset();assert.deepEqual(await rows(st),expected);st.finalize();done=true;
   }else{done=true;await assert.rejects(st.step(),e=>e.kind==='misuse');}
   assert.equal(finalized,1);
   for(const budget of budgets)assert.equal(budget.usedBytes,0);
  }finally{RowSet.prototype.delete=original;if(!done)try{st.finalize();}catch{}}
 }
});
