import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root = new URL('../../', import.meta.url);
const load = path => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const prefix = 'docs/research/card-s-h/';
const first = load(prefix + 'main-integration/fresh-first-native.json');
const edge = load(prefix + 'main-integration/fresh-edge-native.json');
const pin = load('reference/sqlite/manifest.json');

test('MAIN native inventory identifies enabled and disabled profiles, exact fixtures and typed paired denominator', () => {
  assert.equal(first.profiles.length, 2);
  for (const profile of first.profiles) {
    assert.equal(profile.sourceId, pin.sqliteSourceId);
    assert.match(profile.librarySha256, /^[a-f0-9]{64}$/);
  }
  assert.ok(first.profiles[0].compileOptions.includes('ENABLE_STAT4'));
  assert.ok(!first.profiles[1].compileOptions.includes('ENABLE_STAT4'));
  assert.equal(edge.sourceId, pin.sqliteSourceId);
  assert.equal(first.variants.length, 3);
  assert.equal(edge.variants.length, 33);
  const counts = [];
  for (const capture of [first, edge]) {
    let pairs = 0;
    assert.deepEqual(new Set(capture.variants.map(v => v.encoding)), new Set(['UTF-8', 'UTF-16le', 'UTF-16be']));
    for (const variant of capture.variants) {
      const bytes = fs.readFileSync(new URL(prefix + variant.fixture, root));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.sha256, variant.fixture);
      assert.equal(variant.stat4.length, variant.control.length);
      for (let i = 0; i < variant.stat4.length; i++) {
        const a = variant.stat4[i], b = variant.control[i];
        assert.equal(a.sql, b.sql);
        assert.deepEqual(a.rows, b.rows, `${variant.fixture}: typed rows`);
        // Edge recorder retains return codes; first recorder throws on failure
        // and retains typed rows/work instead, so do not invent absent metadata.
        if (capture === edge) {
          assert.equal(a.prepareRc, 0); assert.equal(b.prepareRc, 0);
          assert.equal(a.stepRc, 101); assert.equal(b.stepRc, 101);
        }
        for (const q of [a, b]) {
          assert.ok(Array.isArray(q.eqp));
          assert.ok(Number.isInteger(q.work.vmSteps) && q.work.vmSteps > 0);
        }
        pairs++;
      }
    }
    counts.push(pairs);
  }
  assert.deepEqual(counts, [27, 132], 'distinct native pair inventories, not summed TS test runs or claimed225');
  assert.ok(first.variants.some(v => v.stat4.some(q => q.rows.some(row => row.some(cell => cell.type === 'real')))), 'retain INTEGER/REAL distinction');
});
