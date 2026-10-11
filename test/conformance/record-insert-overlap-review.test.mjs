import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement, DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

// Supplemental semantic validation of the proposed 81/82 window witness.
// vdbe.c MakeRecord -> Insert keeps serialized input live through insertion;
// the bounded TS ephemeral carrier additionally charges copied logical cells.
// Observe real reserve/release calls, never replace their arithmetic or limits.
test('packed record and logical insertion overlap, failed reserve is atomic, cleanup refunds', async () => {
  for (const maxBytes of [81, 82]) {
    const events = [], budgets = new Set();
    const reserve = PrivateStateByteBudget.prototype.reserve;
    const release = PrivateStateByteBudget.prototype.release;
    PrivateStateByteBudget.prototype.reserve = function (bytes, ...args) {
      budgets.add(this); const before = this.usedBytes;
      try { const result = reserve.call(this, bytes, ...args); events.push(['reserve', before, bytes, this.usedBytes]); return result; }
      catch (error) { events.push(['reject', before, bytes, this.usedBytes]); throw error; }
    };
    PrivateStateByteBudget.prototype.release = function (bytes) {
      const before = this.usedBytes; const result = release.call(this, bytes);
      events.push(['release', before, bytes, this.usedBytes]); return result;
    };
    let statement;
    try {
      statement = new VdbeStatement({ops: [
        {code:'OpenEphemeral',p1:1,keyInfo:new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:0,terms:[]})},
        {code:'Integer',p1:7n,p2:1},{code:'String',p1:'abc',p2:2},
        {code:'MakeRecord',p1:1,p2:2,p3:3},{code:'NewRowid',p1:1,p2:4},
        {code:'Insert',p1:1,p2:3,p3:4},{code:'Halt'},
      ],registers:5,encoding:'utf-8',columns:[],parameters:[],maxRows:1,maxWorkUnits:100,maxResultBytes:1000,
      privateStateLimits:{...DEFAULT_PRIVATE_STATE_LIMITS,maxEntries:1,maxKeyBytes:32,maxBytes}},()=>{},()=>()=>{},()=>{});
      if (maxBytes === 81) {
        let saved;
        await assert.rejects(statement.step(), error => {saved=error; return error.kind==='limit';});
        assert.deepEqual(events.slice(0,2), [['reserve',0,71,71],['reject',71,11,71]]);
        assert.ok(events.some(e => e[0]==='release' && e[1]===71 && e[2]===71 && e[3]===0));
        assert.throws(()=>statement.reset(), error=>error===saved);
        statement.reset(); // saved error consumed only once
      } else {
        assert.equal(await statement.step(),'done');
        assert.deepEqual(events.slice(0,3), [['reserve',0,71,71],['reserve',71,11,82],['release',82,71,11]]);
        assert.ok(events.some(e=>e[0]==='release' && e[1]===11 && e[2]===11 && e[3]===0));
      }
      assert.ok([...budgets].every(b=>b.usedBytes===0));
      statement.finalize(); statement=undefined;
      assert.ok([...budgets].every(b=>b.usedBytes===0));
    } finally {
      try {statement?.finalize();} finally {
        PrivateStateByteBudget.prototype.reserve=reserve;
        PrivateStateByteBudget.prototype.release=release;
      }
    }
  }
});
