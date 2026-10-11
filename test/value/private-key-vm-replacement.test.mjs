import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
// vdbe.c OpenEphemeral: p2 > existing nField takes allocateCursor,
// not ClearTable reuse. The replacement must own the larger KeyInfo.
test('private VM replaces undersized open owner before inserting larger key',async()=>{
 const one=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const two=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo:one,p4KeyInfo:one},{code:'OpenEphemeral',p1:0,keyInfo:two,p4KeyInfo:two},
 {code:'Integer',p1:7n,p2:1},{code:'Integer',p1:8n,p2:2},{code:'MakeRecord',p1:1,p2:2,p3:3},{code:'IdxInsert',p1:0,p2:3,keyStart:1,keyCount:2},
 {code:'Found',p1:0,keyStart:1,keyCount:2,jump:9},{code:'Integer',p1:0n,p2:4},{code:'Goto',p2:10},{code:'Integer',p1:1n,p2:4},{code:'ResultRow',p1:4,p2:1},{code:'Halt'}];
 const stmt=new VdbeStatement({encoding:'utf-8',registers:5,parameters:[],columns:[{name:'found'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:4,maxKeyBytes:100,maxBytes:100000},ops},()=>{},()=>()=>{},()=>{});
 try{assert.equal(await stmt.step(),'row');assert.equal(stmt.column(0),1n)}finally{stmt.finalize()}
});
