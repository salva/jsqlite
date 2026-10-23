import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
for(const reverse of [false,true])test(`VM packed prefix dispatch ${reverse?'reverse':'forward'} with reset and duplicate payloads`,async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{},{}]});
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info}];
 for(const tail of [1n,2n])ops.push(
  {code:'Integer',p1:7n,p2:1},{code:'Integer',p1:tail,p2:2},
  {code:'MakeRecord',p1:1,p2:2,p3:3},{code:'IdxInsert',p1:0,p2:3,keyStart:1,keyCount:2});
 ops.push({code:'Integer',p1:7n,p2:1});
 const seek=ops.length;const common={p1:0,keys:[1],affinities:['blob'],keyInfo:info};
 ops.push({code:'IndexSeekPrefix',...common,reverse,p2:0});
 const loop=ops.length;ops.push({code:'IndexPrefixEnd',...common,p2:0},
  {code:'Column',p1:1,p2:4,p3:0},{code:'ResultRow',p1:4,p2:1},
  {code:reverse?'IndexPrev':'IndexNext',p1:0,p2:loop});
 const end=ops.length;ops.push({code:'Halt'});ops[seek].p2=end;ops[loop].p2=end;
 const program={encoding:'utf-8',registers:5,parameters:[],columns:[{name:'tail'}],maxWorkUnits:100000,maxResultBytes:10000,privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes:1000000},ops};
 const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 try{for(let run=0;run<2;run++){
  const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
  assert.deepEqual(rows,reverse?[2n,1n]:[1n,2n]);if(!run)statement.reset();
 }}finally{statement.finalize()}
});
