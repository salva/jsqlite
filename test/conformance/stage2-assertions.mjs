// Pinned capi3c.test 1.1/1.4 and 2.1/2.2 prepare success/tail; invalid namex stays an error.
// Empty-fixture DONE and TEXT/main/sqlite_master/name metadata independently checked by
// card-i-c schema native/public evidence and card-w current-d593 replay. UTF16 native
// entry points remain JS-string adaptations with zero compatibility credit.
// Assertions belong to the actual operation phase; absence retains diagnostic-only lanes.
import assert from 'node:assert/strict';
export function assertOperation(op, observed) {
 if (!op.assertion) return;
 assert.equal(op.assertion.phase, op.op, 'expected phase must match attempted operation');
 assert.equal(observed.phase, op.op, 'observed phase must match attempted operation');
 for (const [key,value] of Object.entries(op.assertion)) assert.deepEqual(observed[key], value, `Stage2 ${op.key}: ${key}`);
}
