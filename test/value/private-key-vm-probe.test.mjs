import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
// vdbe.c Found/NotFound5363ff: register-range and packed probes share
// IndexMoveto, default_rc=0, success/error publication, opposite jump polarity.
for(const code of ['Found','NotFound'])for(const packed of [false,true])for(const probe of [6n,7n,8n]){
  test(`private VM ${code} ${packed?'packed':'register'} probe ${probe}`,async()=>{
    const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
    const ops=[
      {code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info},
      {code:'Integer',p1:7n,p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},
      {code:'IdxInsert',p1:0,p2:2,keyStart:1,keyCount:1,useSeekResult:true},
      {code:'Integer',p1:probe,p2:3},{code:'MakeRecord',p1:3,p2:1,p3:4},
      {code,p1:0,keyStart:packed?4:3,keyCount:packed?0:1,jump:9},
      {code:'Integer',p1:0n,p2:5},{code:'Goto',p2:10},
      {code:'Integer',p1:1n,p2:5},{code:'ResultRow',p1:5,p2:1},{code:'Halt'},
    ];
    const program={encoding:'utf-8',registers:6,parameters:[],columns:[{name:'missing'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:4,maxKeyBytes:100,maxBytes:100000},ops};
    const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
    try{assert.equal(await statement.step(),'row');assert.equal(statement.column(0),(probe===7n)===(code==='Found')?1n:0n)}finally{statement.finalize()}
  });
}
