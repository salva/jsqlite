import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
// vdbe.c MakeRecord3520: P4 affinity changes the actual input registers;
// REAL affinity marks INTEGER as IntReal (manifest REAL). A record-only
// conversion would not satisfy this caller contract.
test('MakeRecord REAL affinity mutates source register before private-key insertion',async()=>{
  const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
  const program={encoding:'utf-8',registers:4,parameters:[],columns:[{name:'source'}],maxWorkUnits:10000,maxResultBytes:10000,privateStateLimits:{maxEntries:4,maxKeyBytes:100,maxBytes:100000},ops:[
    {code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info},
    {code:'String',p1:'7',p2:1},
    {code:'MakeRecord',p1:1,p2:1,p3:2,p4Affinity:['real']},
    {code:'IdxInsert',p1:0,p2:2,keyStart:1,keyCount:1},
    {code:'ResultRow',p1:1,p2:1},{code:'Halt'},
  ]};
  const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
  try{assert.equal(await statement.step(),'row');assert.equal(statement.column(0),7);assert.equal(typeof statement.column(0),'number')}finally{statement.finalize()}
});
