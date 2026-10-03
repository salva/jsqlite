import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Architectural regression, not a SQL wrong-row claim. Pinned select.c
// sqlite3Select shares Parse/Vdbe; selectInnerLoop consumes caller SelectDest.
const source = fs.readFileSync(new URL('../../src/internal/vdbe.ts', import.meta.url), 'utf8');
const start = source.indexOf('function compileTableSelectProducer(');
const json = source.slice(start, source.indexOf('  const derived=select.from.derived;', start));
const retained = source.slice(source.indexOf('  const derived=select.from.derived;', start), source.indexOf('  const cteSources=', start));
test('JSON parent-consuming table branches use enclosing builder and parameter owner', () => {
  assert.match(json, /shared\?\.builder/);
  assert.match(json, /shared\?\.parameters/);
});
test('JSON parent-consuming row drains consume caller destination', () => {
  assert.match(json, /shared\?\.destination/);
  assert.doesNotMatch(json, /code:["']ResultRow["']/);
});
test('retained window parent edge forwards enclosing builder and parameters', () => {
  assert.match(retained, /shared\?\.builder/);
  assert.match(retained, /parameters:shared\.parameters/);
});
test('retained window parent edge consumes destination and defers terminal publication', () => {
  assert.match(retained, /shared\?\.destination/);
  assert.match(retained, /if\s*\(\s*!shared\s*\)/);
});

test('JSON shared publication preserves ops identity and synchronizes register frontier', () => {
 assert.doesNotMatch(json, /ops:Object\.freeze\(ops\)/);
 assert.match(json, /ops:shared\?ops:builder\.finish\(\)/);
 assert.match(json, /builder\.registers=registers/);
 assert.doesNotMatch(json.replace(/if\(!shared\)ops\.push\(\{code:"Halt"\}\);/g,''), /code:"Halt"/);
});
test('retained window flattened caller forwards owner and leaves labels late', () => {
 assert.match(retained, /compileTableSelect\(flattened,[^\n]*privateStateLimits,shared\)/);
 assert.match(retained, /ops:shared\?builder\.ops:builder\.finish\(\)/);
 assert.doesNotMatch(retained.replace(/if\(!shared\)builder\.ops\.push\(\{code:'Halt'\}\);/g,''), /code:'Halt'/);
});
