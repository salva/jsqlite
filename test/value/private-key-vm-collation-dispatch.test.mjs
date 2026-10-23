import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
for(const encoding of ['utf-8','utf-16le','utf-16be'])
for(const collation of ['binary','nocase','rtrim'])
for(const reverse of [false,true])test(`VM multipage ${encoding}/${collation}/${reverse?'reverse':'forward'} prefix and reset`,async()=>{
 const info=new KeyInfo({encoding,totalFieldCount:3,keyFieldCount:2,terms:[{collation},{},{}]});
 const ops=[{code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info}];
 for(const group of ['c','b','a'])for(let i=39;i>=0;i--){
  const value=collation==='nocase'&&i%2?group.toUpperCase():collation==='rtrim'&&i%2?group+'   ':group;
  ops.push({code:'String',p1:value,p2:1},{code:'Integer',p1:BigInt(i),p2:2},
   {code:'Blob',p1:new Uint8Array(180).fill(17),p2:3},
   {code:'MakeRecord',p1:1,p2:3,p3:4},{code:'IdxInsert',p1:0,p2:4,keyStart:1,keyCount:2});
 }
 ops.push({code:'String',p1:'b',p2:1});
 const common={p1:0,keys:[1],affinities:['blob'],keyInfo:info};
 const seek=ops.length;ops.push({code:'IndexSeekPrefix',...common,reverse,p2:0});
 const loop=ops.length;ops.push({code:'IndexPrefixEnd',...common,p2:0},
  {code:'Column',p1:1,p2:5,p3:0},{code:'ResultRow',p1:5,p2:1},
  {code:reverse?'IndexPrev':'IndexNext',p1:0,p2:loop});
 const end=ops.length;ops.push({code:'Halt'});ops[seek].p2=end;ops[loop].p2=end;
 const program={encoding,registers:6,parameters:[],columns:[{name:'suffix'}],maxWorkUnits:2000000,maxResultBytes:10000,privateStateLimits:{maxEntries:200,maxKeyBytes:10000,maxBytes:4000000},ops};
 const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 const expected=Array.from({length:40},(_,i)=>BigInt(reverse?39-i:i));
 try{for(let run=0;run<2;run++){
  const rows=[];while(await statement.step()==='row')rows.push(statement.column(0));
  assert.deepEqual(rows,expected);if(!run)statement.reset();
 }}finally{statement.finalize()}
});
