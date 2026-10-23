// Pending private observation contract, not a production seam or planner.
// where.c:sqlite3ConstructBloomFilter; wherecode.c:filterPullDown.
import assert from 'node:assert/strict';
export function assertStandaloneBloom(actual, expected) {
  assert.equal(actual.version,1);
  assert.equal(actual.planKind,'persistent-index');
  assert.equal(actual.error,null);
  assert.deepEqual(actual.rows,expected.rows);
  assert.deepEqual(actual.columns,expected.columns);
  assert.equal(actual.executedOps.includes('OpenAutoindex'),false);
  assert.equal(actual.autoindexBuilds,0);
  assert.equal(actual.indexIdentity,expected.indexIdentity);
  for(const field of ['builds','insertedFilterKeys','probes','absent','present','persistentSeeks','collisionRejects']) {
    assert.ok(Number.isSafeInteger(actual[field]) && actual[field]>=0,field);
    assert.equal(actual[field],expected[field],field);
  }
  assert.equal(actual.probes,actual.absent+actual.present);
  assert.equal(actual.persistentSeeks,actual.present);
  for(const op of ['Once','FilterAdd','Filter']) assert.ok(actual.executedOps.includes(op),op);
  // Actual dispatch sequence; IDs identify selected loop/filter and iteration.
  assert.deepEqual(actual.trace,expected.trace);
}
export async function standaloneBloom(adapter, cases) {
  assert.ok(cases.length>0);
  for(const c of cases) {
    const first=await adapter.execute(c.id);
    assertStandaloneBloom(first,c.expected);
    await adapter.reset();
    const second=await adapter.execute(c.id);
    assertStandaloneBloom(second,c.expected);
    for(const o of [first,second]) {
      assert.ok(Number.isSafeInteger(o.executionId) && o.executionId>0);
      assert.equal(typeof o.planIdentity,'string');assert.ok(o.planIdentity.length>0);
    }
    assert.notEqual(first.executionId,second.executionId);
    assert.equal(first.planIdentity,second.planIdentity);
  }
}
// Caller supplies source-based expectations, never adapter-reported eligibility.
export function assertPulldown(actual, expected) {
  assert.deepEqual(actual,expected);
  assert.ok(actual.length>0);
  for(const loop of actual) {
    assert.ok(Number.isSafeInteger(loop.loopId) && loop.loopId>=0);
    for(const flag of [loop.outer,loop.inOperator,loop.notReady,loop.skipScan,loop.early]) assert.equal(typeof flag,'boolean');
    if(loop.outer || loop.inOperator || loop.notReady || loop.skipScan) {
      assert.equal(loop.early,false);assert.deepEqual(loop.earlyTrace,[]);
    } else if(loop.early) {
      assert.ok(['rowid','index'].includes(loop.keyKind));
      assert.equal(loop.filterRegisterAfter,0);
      assert.equal(loop.breakTargetAfter,loop.breakTargetBefore);
      assert.deepEqual(loop.earlyTrace,[loop.keyKind==='rowid'?'MustBeInt':'Affinity','Filter','OuterNext']);
      assert.equal(loop.absentTarget,loop.outerNext);
    }
  }
}
