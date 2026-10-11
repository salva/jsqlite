import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';

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
