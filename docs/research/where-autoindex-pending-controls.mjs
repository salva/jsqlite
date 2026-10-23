// Future adapter-driven controls. This file adds no production hook/counter.
// Adapter methods must execute the public statement API and return the private
// version-1 snapshots described in where-autoindex-boundary.md.
import assert from 'node:assert/strict';
import {assertReleased,assertFresh,assertRuntimeWork} from './where-autoindex-contract.mjs';
export async function workAndLifetime(adapter, expected) {
  const first=await adapter.execute();
  assertRuntimeWork(first,expected);
  await adapter.reset();
  const second=await adapter.execute();
  assertRuntimeWork(second,expected);assertFresh(first,second);
  await adapter.reset();await adapter.bind(17);
  const rebound=await adapter.execute();
  assertFresh(second,rebound);assertRuntimeWork(rebound,expected);
  await adapter.reprepare();
  const replacement=await adapter.execute();
  assert.notEqual(replacement.planIdentity,rebound.planIdentity);
  assert.notEqual(replacement.executionId,rebound.executionId);
}
export async function capacity(adapter) {
  const measured=await adapter.measureHighWater();
  assert.ok(Number.isSafeInteger(measured) && measured>0);
  for(const limit of [measured-1,measured,measured+1]) {
    const result=await adapter.executeWithLimit(limit);
    if(limit<measured) assert.equal(result.error.name,'PrivateStateLimitError');
    else assert.equal(result.error,null);
    assertReleased(result.released,result.independentBefore,result.independentAfter);
  }
}
export async function interrupted(adapter) {
  for(const phase of ['build','probe']) for(const cause of ['cancel','deadline','page','record','filter']) {
    const result=await adapter.interruptAfterProgress(phase,cause);
    assert.equal(result.phase,phase);assert.ok(result.completedWork>0);
    assert.ok(result.error);assert.equal(result.reportedError,result.error);
    assert.equal(result.fallback,false);
    assertReleased(result.released,result.independentBefore,result.independentAfter);
    await adapter.reset();
    const retry=await adapter.execute();assert.equal(retry.error,null);
  }
  for(const operation of ['reset','finalize','close']) {
    const result=await adapter.releasePartialBuild(operation);
    assertReleased(result.released,result.independentBefore,result.independentAfter);
  }
}
