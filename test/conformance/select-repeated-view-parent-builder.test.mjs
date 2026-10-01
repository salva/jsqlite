import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// select.c tag-select-0486/0488 emits into one Vdbe, then opens duplicate
// independent cursor readers. Pinned/public pair: select-repeated-view-parent-*.
test('repeated immutable view fill uses enclosing builder destination',()=>{
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileRepeatedImmutableView('),end=source.indexOf('function compileCteDerivedSources(',start);
 assert.ok(start>=0&&end>start);
 const route=source.slice(start,end);
 assert.match(route,/new SelectProgramBuilder<Op>\(/);
 assert.match(route,/compileInnerTableSelect\(/);
 assert.match(route,/destination:\{kind:'ephemeral',cursor:owner\}/);
 assert.doesNotMatch(route,/for\(const original of inner\.ops\)|producerBase/);
});
