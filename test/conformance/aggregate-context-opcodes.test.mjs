import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement,DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';

test('AggValue reads through value callback without destroying shared Mem context',async()=>{
  const program={ops:[
    {code:'Integer',p1:1n,p2:1},
    {code:'AggStep',name:'sum',args:[1],p2:2,collation:'binary'},
    {code:'AggValue',name:'sum',p1:2,p2:3},
    {code:'AggStep',name:'sum',args:[1],p2:2,collation:'binary'},
    {code:'AggValue',name:'sum',p1:2,p2:4},
    {code:'ResultRow',p1:3,p2:2},{code:'Halt'}
  ],registers:4,encoding:'utf-8',columns:[{name:'first',declaredType:null,database:null,table:null,origin:null},{name:'second',declaredType:null,database:null,table:null,origin:null}],parameters:[],maxRows:1,maxWorkUnits:100,maxResultBytes:1000,privateStateLimits:DEFAULT_PRIVATE_STATE_LIMITS};
  const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
  try{assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);assert.equal(statement.column(1),2n);assert.equal(await statement.step(),'done')}finally{statement.finalize()}
});
