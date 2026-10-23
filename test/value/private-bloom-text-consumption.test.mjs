import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
// Exercise existing dispatch only: no private register injection or test opcode.
for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const value of [1n,1.5])
test(`numeric text consumption then Filter/packed failure and reset ${encoding}/${value}`,async()=>{
 const info=new KeyInfo({encoding,totalFieldCount:2,keyFieldCount:1,terms:[{},{}]});
 const common={p1:0,keys:[1],affinities:['blob'],keyInfo:info};
 const program={encoding,registers:9,parameters:[],columns:[{name:'value'}],maxWorkUnits:100000,maxResultBytes:10000,
  privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes:200000},ops:[
   {code:'OpenEphemeral',p1:0,keyInfo:info,p4KeyInfo:info},
   {code:'FilterInit',p1:7,bytes:10000},
   typeof value==='bigint'?{code:'Integer',p1:value,p2:1}:{code:'Real',p1:value,p2:1},
   {code:'String',p1:'',p2:5},{code:'Binary',op:'||',p1:1,p2:5,p3:6},
   {code:'Integer',p1:9n,p2:2},
   {code:'MakeRecord',p1:1,p2:2,p3:3,p4Affinity:['blob','blob']},
   {code:'FilterAdd',p1:7,p3:1,p4:1},{code:'IdxInsert',p1:0,p2:3,keyStart:1,keyCount:1},
   {code:'ResultRow',p1:6,p2:1},
   {code:'Filter',p1:7,p2:15,p3:1,p4:1},
   {code:'IndexSeekPrefix',...common,p2:15},
   {code:'IndexPrefixEnd',...common,p2:15},
   {code:'ResultRow',p1:1,p2:1},{code:'Halt'},
   {code:'Integer',p1:-99n,p2:1},{code:'ResultRow',p1:1,p2:1},{code:'Halt'}]};
 const s=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
 try{
  assert.equal(await s.step(),'row');assert.equal(s.column(0),String(value));
  let primary;
  // Shared work admission fails at the next execution boundary, before
  // Filter may borrow registers. Do not resume a halted VM without reset.
  await assert.rejects(s.step({maxWorkUnits:1}),e=>{primary=e;return e.kind==='limit'});
  await assert.rejects(s.step(),e=>e===primary);
  assert.throws(()=>s.reset(),e=>e===primary);
  for(let run=0;run<2;run++){
   assert.equal(await s.step(),'row');assert.equal(s.column(0),String(value));
   assert.equal(await s.step(),'row');assert.equal(s.column(0),value);
   assert.equal(await s.step(),'done');if(!run)s.reset();
  }
 }finally{s.finalize()}
});
