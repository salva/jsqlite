// Executable future private contract, NOT an implemented observation seam.
// Implementers supply an observation only after actual public execution. Never
// synthesize it from SQL or native counters. See where-autoindex-boundary.md.
import assert from 'node:assert/strict';
export function assertRuntimeWork(o, {buildRows, probes, absent, collisions}) {
  assert.equal(o.version, 1);
  assert.equal(o.planKind, 'automatic-index');
  assert.deepEqual(o.executedOps.filter(x=>['OpenAutoindex','FilterAdd','Filter'].includes(x)).sort(),
    ['Filter','FilterAdd','OpenAutoindex']);
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
  assert.equal(o.ownedBytes, 0);
  assert.equal(o.openCursors, 0);
  assert.equal(o.onceActive, false);
  assert.equal(o.filterBytes, 0);
  assert.deepEqual(independentAfter, independentBefore);
}
export function assertFresh(before, after) {
  assert.notEqual(after.executionId, before.executionId);
  assert.equal(after.builds, 1);
  assert.equal(before.planIdentity, after.planIdentity);
}
