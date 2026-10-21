import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere} from '../../src/internal/where-plan.ts';
import {emitSelectedInRhs} from '../../src/internal/where-in-producer.ts';
import {SelectProgramBuilder,emitSelectDestination} from '../../src/internal/select-program.ts';
import {beginInLoop,finishInLoops} from '../../src/internal/where-in-loop.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {VdbeStatement} from '../../src/internal/vdbe.ts';

// This is an actual VDBE consumption regression, not another PC interpreter.
// Synthetic child rows isolate the destination/cursor boundary; this does not
// claim linked SELECT production or public selected LHS access.
for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const reverse of [false,true])for(const rows of [[2n,null,1n,2n],[],[null,null]])test(`${encoding} ${reverse?'Prev':'Next'} ${rows.length} RHS rows: VDBE consumes producer-owned UNIQUE LOOP cursor and reconstructs after reset`,async()=>{
 const plan=expandAndResolveSelect(parseSql('SELECT 1 WHERE 1 IN (SELECT ?1)').statement,{objects:[]});
 const rhs=analyzeWhere(plan).clause.terms.find(term=>term.inSelectRhs).inSelectRhs;
 const builder=new SelectProgramBuilder();
 const input=builder.register(),output=builder.register();
 const info=new KeyInfo({encoding,totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary'}]});
 const set=emitSelectedInRhs(builder,rhs,info,'numeric',(_resolved,dest)=>{
  for(const value of rows){
   builder.emit(value===null?{code:'Null',p2:input}:{code:'Integer',p1:value,p2:input});
   emitSelectDestination(builder.ops,dest,input,1);
  }
 });
 const loop=beginInLoop(builder.ops,set.cursor,output,reverse);
 builder.emit({code:'ResultRow',p1:output,p2:1});
 // One scalar continuation op follows body, then Halt.
 finishInLoops(builder.ops,[loop],builder.ops.length+1);
 builder.emit({code:'Halt'});
 const program={encoding,registers:builder.registers,parameters:[],columns:[{name:'key'}],maxWorkUnits:100000,maxResultBytes:100000,privateStateLimits:{maxEntries:100,maxKeyBytes:10000,maxBytes:1000000},ops:builder.finish()};
 const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 let primary;
 try{
  for(let run=0;run<2;run++){
   const values=[];
   while(await statement.step()==='row')values.push(statement.column(0));
   assert.deepEqual(values,rows.some(value=>value!==null)?(reverse?[2n,1n]:[1n,2n]):[]);
   await statement.reset();
  }
 }catch(error){primary=error;throw error}
 finally{try{await statement.finalize()}catch(error){if(!primary)throw error}}
});
