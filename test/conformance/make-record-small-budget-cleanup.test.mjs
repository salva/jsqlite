import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement, DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

// Real numeric-affinity scan admission must fail atomically before mutation.
// Original no-conversion 81/82 success witnesses remain in record-overlap.
test('MakeRecord small-budget admission failure is atomic and retains error across reset', async () => {
  const original = PrivateStateByteBudget.prototype.reserve;
  const budgets = new Set();
  PrivateStateByteBudget.prototype.reserve = function(bytes, ...args) {
    budgets.add(this);
    return original.call(this, bytes, ...args);
  };
  let statement;
  try {
    statement = new VdbeStatement({ops: [
      {code:'OpenEphemeral',p1:1,keyInfo:new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:0,terms:[]})},
      {code:'Integer',p1:7n,p2:1},{code:'String',p1:'abc',p2:2},
      {code:'MakeRecord',p1:1,p2:2,p3:3,p4Affinity:['blob','numeric']},{code:'NewRowid',p1:1,p2:4},
      {code:'Insert',p1:1,p2:3,p3:4},{code:'Halt'},
    ],registers:5,encoding:'utf-8',columns:[],parameters:[],maxRows:1,maxWorkUnits:100,maxResultBytes:1000,
    privateStateLimits:{...DEFAULT_PRIVATE_STATE_LIMITS,maxEntries:1,maxKeyBytes:32,maxBytes:81}},()=>{},()=>()=>{},()=>{});
    let saved;
    await assert.rejects(statement.step(), error => {saved=error;return error.kind==='limit';});
    assert.ok(budgets.size>0);
    assert.ok([...budgets].every(b=>b.usedBytes===0));
    await assert.rejects(statement.step(), error=>error===saved);
    assert.throws(()=>statement.reset(),error=>error===saved);
    statement.reset();
    let second;
    await assert.rejects(statement.step(),error=>{second=error;return error.kind==='limit';});
    assert.ok([...budgets].every(b=>b.usedBytes===0));
    assert.throws(()=>statement.reset(),error=>error===second);
    statement.reset();
    statement.finalize();statement=undefined;
    assert.ok([...budgets].every(b=>b.usedBytes===0));
  } finally {
    try {statement?.finalize();} finally {PrivateStateByteBudget.prototype.reserve=original;}
  }
});
