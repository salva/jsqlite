// Future adapter-driven controls. This file adds no production hook/counter.
// Adapter methods must execute the public statement API and return the private
// version-1 snapshots described in where-autoindex-boundary.md.
import assert from 'node:assert/strict';
import {assertReleased,assertFresh,assertRuntimeWork} from './where-autoindex-contract.mjs';
function assertResult(actual, expected) {
  assert.equal(actual.error,null);
  assert.deepEqual(actual.rows,expected.rows);
  assert.deepEqual(actual.columns,expected.columns);
  assertRuntimeWork(actual,expected.work);
}
export async function workAndLifetime(adapter, expectations) {
  assert.equal(expectations.length,4);
  const first=await adapter.execute();
  assertResult(first,expectations[0]);
  await adapter.reset();
  const second=await adapter.execute();
  assertResult(second,expectations[1]);assertFresh(first,second);
  await adapter.reset();await adapter.bind(17);
  const rebound=await adapter.execute();
  assertFresh(second,rebound);assertResult(rebound,expectations[2]);
  const released=await adapter.reprepare();
  assertReleased(released.snapshot,released.independentBefore,released.independentAfter);
  const replacement=await adapter.execute();
  assertResult(replacement,expectations[3]);
  assert.notEqual(replacement.planIdentity,rebound.planIdentity);
  assert.notEqual(replacement.executionId,rebound.executionId);
}
export async function capacity(adapter, expected) {
  // H includes all private consumers of this same execution, not a global or
  // survivor budget. Vary one dimension while holding the others nonbinding.
  for(const dimension of ['maxBytes','maxEntries','maxKeyBytes']) {
    const measured=await adapter.measureHighWater(dimension);
    assert.ok(Number.isSafeInteger(measured) && measured>0);
    for(const limit of [measured-1,measured,measured+1]) {
      const result=await adapter.executeWithLimit(dimension,limit);
      assert.equal(result.dimension,dimension);
      assert.equal(result.fallback,false);
      if(limit<measured) {
        assert.equal(result.error?.name,'PrivateStateLimitError');
        assert.equal(result.publishedResultRows,0);
      } else assertResult(result,expected);
      assertReleased(result.released,result.independentBefore,result.independentAfter);
    }
  }
}
export async function interrupted(adapter, expectations) {
  // Allocation failures target build allocation sites only; cancellation and
  // deadlines can interrupt either phase. Expected errors come from the caller's
  // existing public error contract, never from adapter-reported expected fields.
  const events=[...['build','probe'].flatMap(phase=>['cancel','deadline'].map(cause=>({phase,cause}))),
    ...['page','record','filter'].map(cause=>({phase:'build',cause}))];
  for(const {phase,cause} of events) {
    const result=await adapter.interruptAfterProgress(phase,cause);
    assert.equal(result.phase,phase);assert.ok(result.completedWork>0);
    assert.ok(expectations.errors[cause]);
    assert.deepEqual({name:result.error?.name,message:result.error?.message},expectations.errors[cause]);
    assert.equal(result.reportedError,result.error);
    assert.equal(result.fallback,false);
    assertReleased(result.released,result.independentBefore,result.independentAfter);
    await adapter.reset();
    const retry=await adapter.execute();assertResult(retry,expectations.retry);
    const survivor=await adapter.resumeIndependent();
    assert.equal(survivor.ownerId,result.independentBefore.ownerId);
    assert.ok(survivor.completedWork>0);
    assert.equal(survivor.error,null);
    assert.deepEqual(survivor.rows,expectations.survivorRows);
  }
  for(const operation of ['reset','finalize','close']) {
    const result=await adapter.releasePartialBuild(operation);
    assertReleased(result.released,result.independentBefore,result.independentAfter);
  }
}
