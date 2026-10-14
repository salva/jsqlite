import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = name => fs.readFileSync(new URL(`../../docs/${name}`, import.meta.url), 'utf8');
const map = read('SQLITE_SOURCE_MAP.md');
const guide = read('TRANSLATION.md');
const audit = read('reviews/translation-fidelity-2026-09-14.md');

test('bounded STAT4 documentation maps current production and caller ownership', () => {
  const section = map.split('## Bounded STAT4 sample consumers')[1]?.split('\n## ')[0];
  assert.ok(section, 'current bounded STAT4 source mapping required');
  for (const owner of ['loadStat4', 'sqlite3Stat4ProbeSetValue', 'whereKeyStats',
    'sampleEquality', 'sampleRange', 'HIGHTRUTH/HEURTRUTH', 'buildAll']) {
    assert.ok(section.includes(owner), `missing semantic owner ${owner}`);
  }
  assert.match(section, /vector\/function\/subquery probes.*remain gaps/);
  assert.match(section, /not independent histograms or arbitrary native plan\/cost parity/);
  assert.match(guide, /###? Optional STAT4 loading and selectivity consumers/);
  assert.match(guide, /Immutable schema loading retains represented sqlite_stat4 samples/);
  const source = name => fs.readFileSync(new URL(`../../src/internal/${name}.ts`, import.meta.url), 'utf8');
  assert.match(source('schema'), /sampleStates=loadStat4Samples\(stat4Rows/);
  assert.match(source('stat4-estimate'), /export function whereKeyStats/);
  const planner = source('where-plan');
  assert.match(planner, /function sampleEquality[\s\S]*whereKeyStats\(index.stat4!,probe,false\).equal/);
  assert.match(planner, /for\(const expr of directExprReductions\(list\)\)[\s\S]*finally\{probe.nRecValid=valid;probe.nField=active;\}/);
  assert.match(planner, /if\(planBudget.truth.secondPass\)\{planBudget.remaining=initialLimit;planBudget.progressCheck\?\.\(\);groups=buildAll\(\);\}/);
  assert.match(source('stat4-probe'), /withPrefix<T>[\s\S]*finally/);
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
