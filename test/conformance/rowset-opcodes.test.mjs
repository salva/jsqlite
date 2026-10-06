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
