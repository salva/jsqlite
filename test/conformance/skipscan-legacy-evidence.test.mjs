import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const note = fs.readFileSync(new URL('../../docs/research/card-s-g-legacy-root-repair.md', import.meta.url), 'utf8');
const reviewed = JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-g/review-legacy-root-inputs.json', import.meta.url), 'utf8'));

// F5: counts are test units reported by Node, not assertion invocations.
// Six single-unit producer/layout files + prefix14 + SeekScan3; ROOT helper1
// and five companions are separate. This does not run or replace native tests.
test('legacy closure current results count original test units separately from helper and companions', () => {
  const units = 6 + 14 + 3;
  assert.equal(reviewed.original_tests, units, 'independent native-root review inventory');
  assert.equal(reviewed.companion_tests, 5);
  const current = note.split('Actual final results:')[1]?.split('\n\n')[0];
  assert.ok(current, 'owning current result paragraph must remain identifiable');
  const claim = current.match(/Original eight files\s*(\d+)\s+test units\s+pass/i);
  assert.ok(claim, 'report test units, not an unmeasured assertion count');
  assert.equal(Number(claim[1]), units, 'eight originals exclude the separate ROOT helper');
  assert.match(current, /ROOT helper1\/1/);
  assert.match(current, /five companions additionally pass/);
});
