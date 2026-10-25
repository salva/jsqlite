import test from 'node:test';
import {createHash} from 'node:crypto';
import {Mem} from '../../src/internal/mem.ts';
import {packRecord} from '../../src/internal/record-pack.ts';
import assert from 'node:assert/strict';
import {VdbeStatement, DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

// Original UTF-8 81/82 controls retained; source Mem3 additionally overlaps
// packed71 and logical11, so current exact admission boundary is85.
// vdbe.c MakeRecord -> Insert keeps serialized input live through insertion;
// the bounded TS ephemeral carrier additionally charges copied logical cells.
// Observe real reserve/release calls, never replace their arithmetic or limits.
test('packed record and logical insertion overlap, failed reserve is atomic, cleanup refunds', async () => {
  const integer=new Mem(),text=new Mem();integer.setInt64(7n);text.setText(new TextEncoder().encode('abc'),'utf-8');
  const packed=packRecord([integer,text],'utf-8');
  assert.equal(Buffer.from(packed).toString('hex'),'03011307616263');
  assert.equal(createHash('sha256').update(packed).digest('hex'),'d41c818785e3b7c14af6ee24cbfa1dd08d3dad09d4738948ed88e937635435a0');
  integer.setNull();text.setNull();
  for (const maxBytes of [81, 82, 84, 85, 86]) {
    const events = [], budgets = new Set();
    const reserve = PrivateStateByteBudget.prototype.reserve;
    const release = PrivateStateByteBudget.prototype.release;
    PrivateStateByteBudget.prototype.reserve = function (bytes, ...args) {
      budgets.add(this); const before = this.usedBytes;
      try { const result = reserve.call(this, bytes, ...args); if(bytes!==0)events.push(['reserve', before, bytes, this.usedBytes]); return result; }
      catch (error) { assert.equal(this.usedBytes,before,'failed reservation is byte-atomic');events.push(['reject', before, bytes, this.usedBytes]); throw error; }
    };
    PrivateStateByteBudget.prototype.release = function (bytes) {
      const before = this.usedBytes; const result = release.call(this, bytes);
      if(bytes!==0)events.push(['release', before, bytes, this.usedBytes]); return result;
    };
    let statement, primary;
    try {
      statement = new VdbeStatement({ops: [
        {code:'OpenEphemeral',p1:1,keyInfo:new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:0,terms:[]})},
        {code:'Integer',p1:7n,p2:1},{code:'String',p1:'abc',p2:2},
        {code:'MakeRecord',p1:1,p2:2,p3:3},{code:'NewRowid',p1:1,p2:4},
        {code:'Insert',p1:1,p2:3,p3:4},{code:'Halt'},
      ],registers:5,encoding:'utf-8',columns:[],parameters:[],maxRows:1,maxWorkUnits:100,maxResultBytes:1000,
      privateStateLimits:{...DEFAULT_PRIVATE_STATE_LIMITS,maxEntries:1,maxKeyBytes:32,maxBytes}},()=>{},()=>()=>{},()=>{});
      if (maxBytes < 85) {
        let saved;
        await assert.rejects(statement.step(), error => {saved=error; return error.kind==='limit';});
        assert.deepEqual(events.slice(0,3), [['reserve',0,3,3],['reserve',3,71,74],['reject',74,11,74]]);
        assert.ok(events.some(e => e[0]==='release' && e[1]===74 && e[2]===71 && e[3]===3));
        await assert.rejects(statement.step(),error=>error===saved);
        assert.throws(()=>statement.reset(), error=>error===saved);
        statement.reset(); // saved error consumed only once
        await assert.rejects(statement.step(),error=>error.kind==='limit');
        assert.throws(()=>statement.reset(),error=>error.kind==='limit');
      } else {
        assert.equal(await statement.step(),'done');
        assert.deepEqual(events.slice(0,4), [['reserve',0,3,3],['reserve',3,71,74],['reserve',74,11,85],['release',85,71,14]]);
        assert.ok(events.some(e=>e[0]==='release' && e[1]===14 && e[2]===11 && e[3]===3));
        statement.reset();events.length=0;assert.equal(await statement.step(),'done');
        assert.deepEqual(events.slice(0,4), [['reserve',0,3,3],['reserve',3,71,74],['reserve',74,11,85],['release',85,71,14]]);
        assert.ok([...budgets].every(b=>b.usedBytes===0));
      }
      assert.ok([...budgets].every(b=>{const a=b.snapshot();return b.usedBytes===0&&a.memBytes===0&&a.recordBytes===0&&a.scratchBytes===0&&a.chargedBytes===a.refundedBytes}));
      statement.finalize(); statement=undefined;
      assert.ok([...budgets].every(b=>b.usedBytes===0));
    } catch(error) {
      primary=error; throw error;
    } finally {
      // Cleanup must not replace an assertion failure with saved execution error.
      try {statement?.finalize();} catch(error) {if(!primary)throw error;} finally {
        PrivateStateByteBudget.prototype.reserve=reserve;
        PrivateStateByteBudget.prototype.release=release;
      }
    }
  }
});
