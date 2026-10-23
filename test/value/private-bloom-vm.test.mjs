import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
for(const probe of [1n,17n,80001n])test(`Filter VM negative jump versus present/collision ${probe}, reset rebuild`,async()=>{
 const program={encoding:'utf-8',registers:4,parameters:[],columns:[{name:'absent'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes:10128},ops:[
  {code:'FilterInit',p1:1,bytes:10000},
  {code:'Integer',p1:1n,p2:2},{code:'FilterAdd',p1:1,p3:2,p4:1},
  {code:'Integer',p1:probe,p2:2},{code:'Filter',p1:1,p2:7,p3:2,p4:1},
  {code:'Integer',p1:0n,p2:3},{code:'Goto',p2:8},
  {code:'Integer',p1:1n,p2:3},{code:'ResultRow',p1:3,p2:1},{code:'Halt'},
 ]};
 const s=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 try{for(let i=0;i<2;i++){assert.equal(await s.step(),'row');assert.equal(s.column(0),probe===17n?1n:0n);assert.equal(await s.step(),'done');if(!i)s.reset()}}finally{s.finalize()}
});
