import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const repair = '58a22728c6c6d9bf8261aa3154359de8695c47ec';

// Documentation is evidence guidance, not an oracle or a browser execution gate.
// Preserve the original discriminators while guarding against reintroducing the
// stale current failure instructions found by card-m-f-d after the repair.
test('browser lane guidance distinguishes repaired gap2 from accepted current38', () => {
  for (const name of ['LANES.md', 'README.md']) {
    const text = read(name);
    assert.ok(text.includes(repair), `${name}: identify the exact repair`);
    assert.match(text, /current 38\/38 pass/);
    assert.match(text, /original gap 2\/2 pass/);
    assert.match(text, /denominators are separate|separate\s+denominators/);
    assert.match(text, /not a 40\/40 conformance claim/);
    assert.match(text, /[Hh]istorical\s+unsupported prepare failures/);
    assert.doesNotMatch(text, /exit 1 today|Currently exits 1|remain runnable \*\*failures\*\*|remain unchanged, runnable and failing|Latest saved[\s\S]*2\/2 fail unsupported/);
  }
  const history = read('BUDGET-GAP.md');
  assert.match(history, /38 executed, 36 pass, 2 fail/);
  assert.match(history, /Historical\s+prepare failures above remain historical evidence/);
  assert.match(history, /passes \*\*2\/2\*\*/);
});

test('original browser gap SQL and success/limit thresholds remain distinct', () => {
  const sql = 'SELECT a FROM (SELECT a,b FROM t1 ORDER BY b LIMIT 4) ORDER BY b DESC';
  const capture = JSON.parse(read('budget-native.json'));
  const composed = capture.cases.find(c => c.id === 'budget-composed');
  assert.equal(composed.sql, sql);
  assert.deepEqual(composed.rows, ['7', '5', '3', '1'].map(value => [{type:'integer', value}]));
  assert.equal(capture.cases.find(c => c.id === 'budget-inner').sql, 'SELECT a,b FROM t1 ORDER BY b LIMIT 4');
  assert.equal(capture.cases.find(c => c.id === 'budget-outer').sql, 'SELECT a FROM t1 ORDER BY b DESC');
  const runner = read('run.mjs');
  assert.ok(runner.includes("lane:c.id==='budget-composed'?'gap':'current'"));
  assert.ok(runner.includes("maxPrivateBytes:c.id==='budget-composed'?300:150"));
  assert.ok(runner.includes(`['private-shared', '${sql}',{limits:{maxPrivateBytes:150}}, {},{kind:'limit'},false]`));
  assert.ok(runner.includes("lane:id==='private-shared'?'gap':'current'"));
});
