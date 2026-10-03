import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Source-owned entry contract: pinned select.c sqlite3Select7615 obtains
// enclosing Parse/Vdbe; FROM0482/0488 recurse using that Parse/destination.
// This is construction ownership RED, not a wrong-row compatibility claim.
const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
const start=source.indexOf('function compileTableSelectProducer(');
const body=source.slice(start,source.indexOf('\nfunction ',start+1));
for(const [name,pattern] of [
 ['ordinary flatten',/if\(flattened!==select\)return compileTableSelect\(flattened,[^\n]*privateStateLimits,shared\)/],
 ['materialized derived',/const materialized=compileDerivedProducer\(select,[^\n]*privateStateLimits,shared\)/],
 ['immutable view',/return compileTableSelect\(expandedView,[^\n]*privateStateLimits,shared\)/],
 ['zero-source scalar',/return compileScalarSelect\(select,[^\n]*maxRows,[^\n]*(shared|owner)/],
 ['multiple source',/compileInnerTableSelect\(select,expanded,[^\n]*privateStateLimits,[^\n]*(shared|owner)/],
])test(`${name} admitted table parent edge forwards construction owner`,()=>assert.match(body,pattern));
