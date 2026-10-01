import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// select.c:sqlite3Select tag-select-0482/0484: the admitted ordered,
// non-VALUES no-FROM derived SELECT is an SRT_Coroutine producer in the
// enclosing Parse/Vdbe, not a completed program copied by old PC address.
// Behavioral pair: select-derived-composition-native.py / .test.mjs,
// ordered LIMIT 1 compound derived case. This gate targets only the fallback.
test('ordered non-VALUES derived coroutine does not relocate a finished child',()=>{
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileDerivedProducer(');
 const end=source.indexOf('\nfunction uniqueTransientColumnNames(',start);
 assert.ok(start>=0&&end>start,'derived producer owner identifiable');
 const owner=source.slice(start,end);
 const ordered=owner.slice(owner.indexOf('}else if(ordered){'),owner.indexOf('}else{\n    // Existing non-VALUES fallback'));
 assert.ok(ordered.length>0,'ordered non-VALUES branch remains separate from table/window fallback');
 assert.match(ordered,/kind:'coroutine'/);
 assert.doesNotMatch(ordered,/relocateControlTargets\(|child\.ops|pcMap\[/,'ordered compound emits through parent destination without copying child PCs');
});
