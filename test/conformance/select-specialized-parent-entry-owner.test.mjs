import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Pinned select.c sqlite3Select7590ff and FROM materialization recursively
// consume the same Parse/Vdbe and SelectDest. This check is construction
// ownership evidence, not an SQL/native-result compatibility assertion.
const source = fs.readFileSync(new URL('../../src/internal/vdbe.ts', import.meta.url), 'utf8');
for (const name of ['compileJoinedUnionAll', 'compileSingleCompoundDerived', 'compileRepeatedImmutableView', 'compileCteDerivedSources', 'compileCteDerivedSourcesFallback']) {
  test(`${name} live parent edge accepts enclosing construction owner`, () => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} remains identifiable`);
    const signature = source.slice(start, source.indexOf('{', start));
    assert.match(signature, /parent|context|owner/, `${name} still lacks enclosing builder/parameters/destination handoff`);
  });
}

for (const name of ['compileJoinedUnionAll', 'compileSingleCompoundDerived', 'compileRepeatedImmutableView', 'compileCteDerivedSources', 'compileCteDerivedSourcesFallback']) {
  test(`${name} consumes parent allocation and destination and defers publication`, () => {
    const start = source.indexOf(`function ${name}(`);
    const body = source.slice(start, source.indexOf('\n}', start) + 2);
    assert.match(body, /builder=parent\?\.builder\?\?new SelectProgramBuilder/);
    assert.match(body, /parameters:ParameterBuilder=parent\?\.parameters/);
    assert.match(body, /emitSelectDestination\(ops,parent\?\.destination/);
    assert.match(body, /if\(parent\)return \{columns:/);
    assert.doesNotMatch(body, /code:['"]ResultRow['"]/);
    assert.doesNotMatch(body.replace(/if\(!parent\)ops\.push\(\{code:['"]Halt['"]\}\);/g, ''), /code:['"]Halt['"]/);
  });
}

test('live specialized table callers pass enclosing owner before publication', () => {
  for (const name of ['compileCteDerivedSources','compileRepeatedImmutableView','compileSingleCompoundDerived']) {
    assert.match(source, new RegExp(`${name}\\(select,schema,database,maxRows,maxWorkUnits,maxResultBytes,privateStateLimits,shared\\)`));
  }
  assert.match(source, /if\(owner\)return compileJoinedUnionAll\([^\n]*privateStateLimits,owner\)/);
});
