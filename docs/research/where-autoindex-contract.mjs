// Runtime work contract for actual public execution. Resource/lifetime
// contracts below remain pending full production acceptance. Never synthesize
// observations from SQL or native counters. See where-autoindex-boundary.md.
import assert from 'node:assert/strict';
export function assertRuntimeWork(o, {buildRows, probes, absent, collisions}) {
  assert.equal(o.version, 1);
  assert.equal(o.planKind, 'automatic-index');
  assert.deepEqual(o.executedOps.filter(x=>['OpenAutoindex','FilterAdd','Filter'].includes(x)).sort(),
    (buildRows>0?['Filter','FilterAdd','OpenAutoindex']:['Filter','OpenAutoindex']));
  assert.ok(o.emittedOps.includes('FilterAdd'),'empty build retains emitted insert path');
  assert.equal(o.builds, 1);
  assert.equal(o.insertedRecords, buildRows);
  assert.equal(o.probes, probes);
  assert.equal(o.filterAbsent, absent);
  assert.equal(o.filterPresent, probes-absent);
  assert.equal(o.indexSeeks, probes-absent);
  assert.equal(o.collisionRejects, collisions);
  assert.equal(o.coveringTableLookups, 0);
}
export function assertReleased(o, independentBefore, independentAfter) {
  assert.ok(Number.isSafeInteger(o.ownerId) && o.ownerId>0);
  for(const field of ['chargedBytes','refundedBytes','ownedBytes'])
    assert.ok(Number.isSafeInteger(o[field]) && o[field]>=0,field);
  assert.ok(o.chargedBytes>0,'release fixture must have owned resources');
  assert.equal(o.chargedBytes-o.refundedBytes,o.ownedBytes);
  assert.equal(o.ownedBytes, 0);
  assert.equal(o.openCursors, 0);
  assert.equal(o.onceActive, false);
  assert.equal(o.filterBytes, 0);
  assert.equal(o.packedPages,0);
  assert.equal(o.payloadScratchBytes,0);
  assert.ok(independentBefore && independentAfter,'survivor snapshots required');
  assert.ok(Number.isSafeInteger(independentBefore.ownerId) && independentBefore.ownerId>0);
  assert.notEqual(independentBefore.ownerId,o.ownerId);
  assert.ok(Number.isSafeInteger(independentBefore.ownedBytes) && independentBefore.ownedBytes>0);
  assert.deepEqual(independentAfter, independentBefore);
}
export function assertFresh(before, after) {
  assert.notEqual(after.executionId, before.executionId);
  assert.equal(after.builds, 1);
  assert.equal(before.planIdentity, after.planIdentity);
}
