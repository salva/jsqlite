import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {RowSet} from '../../src/internal/rowset.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {VdbeStatement,DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
const column={name:'v',declaredType:null,database:null,table:null,origin:null};
function statement(ops,limits=DEFAULT_PRIVATE_STATE_LIMITS,maxWorkUnits=10000){return new VdbeStatement({ops,registers:4,encoding:'utf-8',columns:[column],parameters:[],maxRows:100,maxWorkUnits,maxResultBytes:1000,privateStateLimits:limits},()=>{},()=>()=>{},()=>{});}
async function rows(st){const result=[];while(await st.step()==='row')result.push(st.column(0));return result;}
test('RowSetTest first/middle/final batches and exact Gosub/Return continuation, reset and NULL invocation',async()=>{
 const ops=[{code:'Null',p2:1},{code:'Integer',p1:0n,p2:4}],calls=[];
 for(const [batch,value] of [[0,9n],[0,9n],[1,9n],[1,2n],[1,2n],[-1,2n],[-1,3n],[-1,3n]]){
  ops.push({code:'Integer',p1:value,p2:2});const test=ops.length;
  ops.push({code:'RowSetTest',p1:1,p2:test+2,p3:2,p4:batch});calls.push(ops.length);ops.push({code:'Gosub',p1:4,p2:0});
 }
 // NULL destroys the old forest, so an identical key in a fresh invocation
 // cannot be suppressed by prior batches.
 ops.push({code:'Null',p2:1},{code:'Integer',p1:9n,p2:2});const fresh=ops.length;
 ops.push({code:'RowSetTest',p1:1,p2:fresh+2,p3:2,p4:1});calls.push(ops.length);ops.push({code:'Gosub',p1:4,p2:0},{code:'Halt'});
 const body=ops.length;for(const call of calls)ops[call].p2=body;
 ops.push({code:'ResultRow',p1:2,p2:1},{code:'Return',p1:4});
 const st=statement(ops);
 try{assert.deepEqual(await rows(st),[9n,9n,2n,2n,3n,3n,9n]);st.reset();assert.deepEqual(await rows(st),[9n,9n,2n,2n,3n,3n,9n]);}finally{st.finalize();}
});
test('RowSetTest primary byte limit error survives halt and reset',async()=>{
 const st=statement([{code:'Integer',p1:1n,p2:2},{code:'RowSetTest',p1:1,p2:3,p3:2,p4:0},{code:'Halt'},{code:'Halt'}],{...DEFAULT_PRIVATE_STATE_LIMITS,maxBytes:64});
 try{await assert.rejects(st.step(),e=>e.kind==='limit');assert.throws(()=>st.reset(),e=>e.kind==='limit');await assert.rejects(st.step(),e=>e.kind==='limit');assert.throws(()=>st.reset(),e=>e.kind==='limit');}finally{st.finalize();}
});
test('RowSetTest uses current step control after yielding a row',async()=>{
 const st=statement([{code:'Integer',p1:1n,p2:2},{code:'RowSetTest',p1:1,p2:3,p3:2,p4:0},{code:'ResultRow',p1:2,p2:1},{code:'RowSetTest',p1:1,p2:5,p3:2,p4:1},{code:'Halt'},{code:'Halt'}]);
 try{assert.equal(await st.step(),'row');const ac=new AbortController();ac.abort('stop');await assert.rejects(st.step({signal:ac.signal}),e=>e.kind==='cancelled');assert.throws(()=>st.reset(),e=>e.kind==='cancelled');assert.deepEqual(await rows(st),[1n]);}finally{st.finalize();}
});
test('Mem owns RowSet destructor on overwrite and move; SQL copy is forbidden',async()=>{
 const budget=new PrivateStateByteBudget(10000),set=new RowSet(budget,1000,{async checkpoint(){}});
 await set.insert(1n);const source=new Mem(),dest=new Mem();source.setRowSet(set);
 assert.throws(()=>dest.copyFrom(source),/rowset state cannot be copied/);
 assert.throws(()=>dest.shallowCopyFrom(source),/rowset state cannot be copied/);
 dest.moveFrom(source);assert.equal(source.rowSet(),null);assert.equal(dest.rowSet(),set);
 source.release();assert.ok(budget.usedBytes>0);dest.setInt64(2n);assert.equal(budget.usedBytes,0);dest.release();
});

// Synthetic exception adaptation: native xDel cannot throw. Invoke the real
// RowSet destructor before injecting its secondary diagnostic, so this checks
// ownership/error precedence, not recovery from an unfinished destructor.
test('partial RowSet sort interruption retains primary through reset/finalize cleanup collision',async()=>{
 const originalTest=RowSet.prototype.test,originalDelete=RowSet.prototype.delete;
 const primary=new Error('interrupted partial sort'),secondary=new Error('secondary destructor error');
 for(const terminal of ['reset','finalize']){
  const ops=[{code:'Null',p2:1}];
  for(const v of [9n,2n,-4n,9n])ops.push({code:'Integer',p1:v,p2:2},{code:'RowSetTest',p1:1,p2:0,p3:2,p4:0});
  ops.push({code:'Integer',p1:2n,p2:2});const branch=ops.length;
  ops.push({code:'RowSetTest',p1:1,p2:branch+1,p3:2,p4:1},{code:'ResultRow',p1:2,p2:1},{code:'Halt'});
  const st=statement(ops);let checkpoints=0,deletes=0,budget,finalized=false;
  RowSet.prototype.test=async function(...args){
   budget=this.budget;const control=this.control;
   this.control={async checkpoint(n){await control.checkpoint(n);if(++checkpoints===4)throw primary;}};
   return originalTest.apply(this,args);
  };
  RowSet.prototype.delete=function(){deletes++;originalDelete.call(this);throw secondary;};
  try{
   await assert.rejects(st.step(),e=>e===primary);
   assert.equal(checkpoints,4);assert.equal(budget.usedBytes,0);assert.equal(deletes,1);
   assert.throws(()=>st[terminal](),e=>e===primary);
   assert.equal(deletes,1,'destroyed owner is detached, not destroyed twice');
   RowSet.prototype.test=originalTest;RowSet.prototype.delete=originalDelete;
   if(terminal==='reset'){
    assert.deepEqual(await rows(st),[2n]);assert.equal(budget.usedBytes,0);
    st.reset();assert.deepEqual(await rows(st),[2n]);st.finalize();finalized=true;
   }else{
    finalized=true;assert.throws(()=>st.reset(),e=>e.kind==='misuse');
    await assert.rejects(st.step(),e=>e.kind==='misuse');
   }
  }finally{
   RowSet.prototype.test=originalTest;RowSet.prototype.delete=originalDelete;
   if(!finalized)try{st.finalize();}catch{}
  }
 }
});

test('live RowSet cleanup-only errors finish reset/finalize and notify finalization once',async()=>{
 const originalDelete=RowSet.prototype.delete,secondary=new Error('cleanup-only');
 for(const terminal of ['reset','finalize']){
  let finalized=0,deletes=0,budget;
  const st=new VdbeStatement({ops:[{code:'Integer',p1:7n,p2:2},{code:'RowSetTest',p1:1,p2:2,p3:2,p4:0},{code:'ResultRow',p1:2,p2:1},{code:'Halt'}],registers:4,encoding:'utf-8',columns:[column],parameters:[],maxRows:100,maxWorkUnits:10000,maxResultBytes:1000,privateStateLimits:DEFAULT_PRIVATE_STATE_LIMITS},()=>{},()=>()=>{},()=>{finalized++;});
  let done=false;
  try{
   assert.equal(await st.step(),'row');
   RowSet.prototype.delete=function(){budget=this.budget;deletes++;originalDelete.call(this);throw secondary;};
   assert.throws(()=>st[terminal](),e=>e===secondary);
   assert.equal(budget.usedBytes,0);assert.equal(deletes,1);
   RowSet.prototype.delete=originalDelete;
   if(terminal==='reset'){
    assert.equal(finalized,0);assert.equal(await st.step(),'row');assert.equal(st.column(0),7n);
    st.finalize();done=true;
   }else{done=true;assert.throws(()=>st.reset(),e=>e.kind==='misuse');}
   assert.equal(finalized,1);
   assert.throws(()=>st.finalize(),e=>e.kind==='misuse');assert.equal(finalized,1);
  }finally{RowSet.prototype.delete=originalDelete;if(!done)try{st.finalize();}catch{}}
 }
});

test('Mem clears dynamic state even when cleanup throws, with exactly-once ownership',async()=>{
 const budget=new PrivateStateByteBudget(10000),set=new RowSet(budget,1000,{async checkpoint(){}});
 await set.insert(8n);const mem=new Mem(),secondary=new Error('cleanup'),del=set.delete.bind(set);let deletes=0;
 set.delete=()=>{deletes++;del();throw secondary;};mem.setRowSet(set);
 assert.throws(()=>mem.setInt64(2n),e=>e===secondary);
 assert.equal(mem.rowSet(),null);assert.equal(mem.initialStorageClass,'null');assert.equal(budget.usedBytes,0);
 mem.setInt64(3n);assert.equal(mem.integerValue(),3n);mem.release();assert.equal(deletes,1);
 let aggregates=0;mem.setAggregate({cleanup(){aggregates++;throw secondary;}});
 assert.throws(()=>mem.release(),e=>e===secondary);assert.equal(mem.aggregateState(),null);assert.equal(mem.initialStorageClass,'null');
 mem.release();assert.equal(aggregates,1);
});
