import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL(`../../docs/${name}`, import.meta.url), 'utf8');
const map = read('SQLITE_SOURCE_MAP.md');
const guide = read('TRANSLATION.md');
const audit = read('reviews/translation-fidelity-2026-09-14.md');

test('STAT4 primitive checkpoint locally supersedes pending consumers with delivered caller ownership', () => {
  const start = map.indexOf('STAT4 primitive verification:');
  const end = map.indexOf('### STAT4 selectivity callers', start);
  assert.ok(start >= 0 && end > start);
  const primitive = map.slice(start, end);
  assert.doesNotMatch(primitive, /Consumers\/selectivity estimates remain pending\./,
    'review v6: primitive-only checkpoint must not compete with current callers');
  assert.match(primitive, /Historical primitive-only checkpoint/);
  assert.match(primitive, /\[current bounded callers\]\(#stat4-selectivity-callers\)/);
  const callers = map.slice(end);
  for (const owner of ['whereKeyStats', 'whereEqualScanEst/whereInScanEst/whereRangeScanEst', 'second pass 7090ff']) {
    assert.ok(callers.includes(owner), `missing delivered caller owner ${owner}`);
  }
  assert.match(guide, /## Optional STAT4 loading and selectivity consumers/);
});

test('directly affected absent-sample and HIGHTRUTH checkpoints retain local supersession', () => {
  for (const [name, text] of [['guide', guide], ['map', map], ['audit', audit]]) {
    for (const phrase of ['STAT4 sample estimates remain unimplemented', 'STAT4 sample estimates unimplemented', 'truthProb/HIGHTRUTH/LIKE/self-cull flags remain unrepresented', 'truthProb/HIGHTRUTH/LIKE/self-cull producers still absent', 'Full truthProb/HIGHTRUTH/LIKE/self-cull gap persists', 'optional STAT4 samples are not consumed']) {
      for (const match of text.matchAll(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))) {
        const paragraphStart = text.lastIndexOf('\n\n', match.index);
        const before = text.slice(Math.max(0, paragraphStart), match.index);
        assert.match(before, /Historical checkpoint.*superseded by \[current owners\]/s, `${name}: unqualified ${phrase}`);
      }
    }
  }
});
