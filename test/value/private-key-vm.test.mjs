import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';

// Native Last/Rewind and Next/Prev act on the same Btree cursor.
test('packed VM bidirectional traversal dispatch preserves order and empty edges',async()=>{
 for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const reverse of [false,true])for(const count of [0,1,120]){
  const keyInfo=new KeyInfo({encoding,totalFieldCount:2,keyFieldCount:2,terms:[{collation:'nocase'},{}]});
  const ops=[{code:'OpenEphemeral',p1:0,keyInfo,p4KeyInfo:keyInfo}];
  for(let i=count;i>0;i--)ops.push({code:'String',p1:'é'+String(i%3),p2:1},{code:'Integer',p1:BigInt(i),p2:2},{code:'MakeRecord',p1:1,p2:2,p3:3},{code:'IdxInsert',p1:0,p2:3,consumeRecord:true});
  const start=ops.length;
  ops.push({code:reverse?'Last':'Rewind',p1:0,p2:start+5},{code:'Column',p1:0,p2:4,p3:0},{code:'Column',p1:1,p2:5,p3:0},{code:'ResultRow',p1:4,p2:2},{code:reverse?'Prev':'Next',p1:0,p2:start+1},
   {code:'Column',p1:1,p2:5,p3:0},{code:'ResultRow',p1:5,p2:1},{code:'Halt'});
  const expected=Array.from({length:count},(_,i)=>['é'+String((i+1)%3),BigInt(i+1)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:1);
  if(reverse)expected.reverse();
  const vm=new VdbeStatement({encoding,registers:6,parameters:[],columns:[{name:'a'},{name:'id'}],maxWorkUnits:1000000,maxResultBytes:1000000,privateStateLimits:{maxEntries:1000,maxKeyBytes:10000,maxBytes:1000000},ops},()=>{},()=>()=>{},()=>{});
  try{for(let run=0;run<2;run++){
   for(const [text,id] of expected){assert.equal(await vm.step(),'row');assert.equal(vm.column(0),text);assert.equal(vm.column(1),id);}
   assert.equal(await vm.step(),'row');assert.equal(vm.column(0),null);assert.equal(await vm.step(),'done');if(!run)vm.reset();
  }}finally{vm.finalize();}
 }
});

// vdbe.c OP_MakeRecord materializes bytes before later source-register writes;
// OP_IdxInsert P2 is the packed key, P3/P4 is optional unpacked seek input.
// Supplying both here keeps the old caller shape observable while establishing
// the consuming packed-record contract. No WR planner admission is exercised.
test('private-key VM IdxInsert owns the MakeRecord snapshot, not later register contents', async () => {
  const keyInfo = new KeyInfo({encoding:'utf-8', totalFieldCount:1, keyFieldCount:1, terms:[{collation:'binary'}]});
  const program = {
    encoding:'utf-8', registers:6, parameters:[], columns:[{name:'found'}], maxWorkUnits:10000, maxResultBytes:100000,
    privateStateLimits:{maxEntries:100, maxKeyBytes:10000, maxBytes:1000000},
    ops:[
      {code:'OpenEphemeral', p1:0, keyInfo},
      {code:'Integer', p1:7n, p2:1},
      {code:'MakeRecord', p1:1, p2:1, p3:2},
      {code:'Integer', p1:9n, p2:1},
      {code:'IdxInsert', p1:0, p2:2, keyStart:1, keyCount:1},
      {code:'Integer', p1:7n, p2:3},
      {code:'Found', p1:0, keyStart:3, keyCount:1, jump:9},
      {code:'Integer', p1:0n, p2:4},
      {code:'Goto', p2:10},
      {code:'Integer', p1:1n, p2:4},
      {code:'ResultRow', p1:4, p2:1},
      {code:'Halt'},
    ],
  };
  const statement = new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
  try {
    assert.equal(await statement.step(), 'row');
    assert.equal(statement.column(0), 1n, 'packed 7 must survive source register overwrite to 9');
    await statement.reset();
    assert.equal(await statement.step(), 'row');
    assert.equal(statement.column(0), 1n, 'reset must dispose and reconstruct private ownership');
  } finally { await statement.finalize(); }
});

test('private-key VM newly opened arena obeys maxWork and cancellation before publication', async () => {
  const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
  const program={encoding:'utf-8',registers:2,parameters:[],columns:[],maxWorkUnits:1,maxResultBytes:1000,privateStateLimits:{maxEntries:4,maxKeyBytes:100,maxBytes:100000},ops:[{code:'OpenEphemeral',p1:0,keyInfo,p4KeyInfo:keyInfo},{code:'Halt'}]};
  const statement=new VdbeStatement(program,()=>{},()=>()=>{},()=>{});
  try{await assert.rejects(statement.step());assert.throws(()=>statement.reset());const controller=new AbortController();controller.abort();await assert.rejects(statement.step({signal:controller.signal}));}finally{assert.throws(()=>statement.finalize())}
});
