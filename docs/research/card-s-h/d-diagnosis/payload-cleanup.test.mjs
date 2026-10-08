import test from 'node:test';
import assert from 'node:assert/strict';
import {BtreeDatabase, BtreeFormatError} from '../../../../src/internal/btree.ts';

// Pinned btree.c accessPayload: copy current page before successor progression.
// payloadChunks owns traversal; payload must close its iterator on every exit.
// Strict final-link validation is the project's existing malformed-file contract,
// not a claim that SQLite validates the same unused tail.
function reader(next = 0) {
  const db = Object.create(BtreeDatabase.prototype), events = [];
  Object.defineProperties(db, {
    pageCount: {value: 4}, usableSize: {value: 8192}, maxOverflowPages: {value: 4},
  });
  db.pageBytes = page => {
    events.push(`read:${page}`);
    const bytes = new Uint8Array(8192).fill(0x5a);
    new DataView(bytes.buffer).setUint32(0, next);
    return bytes;
  };
  const original = db.payloadChunks;
  db.payloadChunks = function* (cell) {
    try { yield* original.call(this, cell); }
    finally { events.push('close'); }
  };
  return {db, events, cell: {
    payloadLength: 5003, local: Uint8Array.of(1, 2, 3), overflowPage: 2,
    pageNumber: 1, cellOffset: 0,
  }};
}

test('second copy-chunk failure closes traversal before malformed successor and allows retry', () => {
  const h = reader(2), primary = new Error('stop second chunk');
  const units = [];
  assert.throws(() => h.db.payload(h.cell, n => {
    units.push(n);
    if (n === 904) throw primary;
  }), e => e === primary);
  assert.deepEqual(units, [1, 3, 1, 4096, 904]);
  assert.deepEqual(h.events, ['read:2', 'close']);
  // Retry is not poisoned by closed iterator state. The unchanged bad final link
  // now reaches its proper error owner only after all current bytes are copied.
  assert.throws(() => h.db.payload(h.cell), e => e instanceof BtreeFormatError);
  assert.deepEqual(h.events, ['read:2', 'close', 'read:2', 'close']);
});

test('partial final overflow page charges only requested bytes and closes exactly once', () => {
  const h = reader(), units = [];
  const result = h.db.payload(h.cell, n => units.push(n));
  assert.deepEqual([...result.subarray(0, 3)], [1, 2, 3]);
  assert.equal(result.length, 5003);
  assert.ok(result.subarray(3).every(n => n === 0x5a));
  assert.deepEqual(units, [1, 3, 1, 4096, 904]);
  assert.deepEqual(h.events, ['read:2', 'close']);
});

test('pre-fetch failure closes traversal without reading overflow, then same owner succeeds', () => {
  const h = reader(), primary = new Error('stop fetch');
  let calls = 0;
  assert.throws(() => h.db.payload(h.cell, () => {
    if (++calls === 3) throw primary;
  }), e => e === primary);
  assert.deepEqual(h.events, ['close']);
  assert.equal(h.db.payload(h.cell).length, 5003);
  assert.deepEqual(h.events, ['close', 'read:2', 'close']);
});
