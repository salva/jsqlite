import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sourceMap = fs.readFileSync(new URL('../../docs/SQLITE_SOURCE_MAP.md', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../../docs/api.md', import.meta.url), 'utf8');

// Independent review F4: current mappings are authority; revision-bound capture
// accounts may remain, but must be labeled at paragraph entry, not halfway
// through a default-production mapping. No fixture/output rewriting required.
const staleProduction = /Skipscan lowering itself is not enabled|all current callers remain non-skipped|skipped branches remain production-unreachable/;
test('skipscan map separates historical disabled callers from current production', () => {
  const paragraphs = sourceMap.split(/\n\s*\n/);
  const mixed = paragraphs.filter(p => staleProduction.test(p) &&
    !/^\s*(?:Historical checkpoint|Revision-bound checkpoint)/.test(p));
  assert.equal(mixed.length, 0,
    'F4: label the entire historical disabled-caller paragraph at entry; do not mix it into a current default mapping');
});

test('linked NOTNULL mapping does not retain the superseded blanket full-range gap', () => {
  // whereexpr.c1331ff supplies the linked VNULL bound; wherecode.c1997/2099
  // exempt its synthetic NULL guard, and aStartOp selects Rewind/Last for zero
  // keys. A remaining narrower gap needs its own source/caller boundary, not
  // the old blanket prediction contradicted by this current mapping.
  const owner = sourceMap.split('### Linked NOTNULL range owner')[1]?.split(/\n### /)[0];
  assert.ok(owner, 'retain the navigable linked NOTNULL owner mapping');
  assert.match(owner, /zero-key Rewind\/Last/);
  const currentParagraphs = sourceMap.split(/\n\s*\n/).filter(p =>
    !/^\s*(?:Historical checkpoint|Revision-bound checkpoint)/.test(p));
  assert.ok(!currentParagraphs.some(p => p.includes('NOTNULL full-range opcode lowering remains open.')),
    'F4: remove/revision-label superseded full-range prediction, or document a precise remaining branch separately');
});

test('public skipscan contract retains bounded callers and exclusions without diagnostics', () => {
  const contracts = api.split(/\n\s*\n/).filter(p => p.startsWith('Represented stat1 positional skip-scan'));
  assert.equal(contracts.length, 1, 'one public bounded skipscan contract');
  assert.match(contracts[0], /ordinary, joined and recursive-OR callers/);
  assert.match(contracts[0], /represented LEFT ON-OR/);
  assert.match(contracts[0], /RIGHT\/FULL/);
  assert.match(contracts[0], /STAT4, transformed EXISTS producer admission, vectors\/subquery-IN/);
  assert.match(contracts[0], /no public planner, ordering, timing or work-count guarantee/);
});
