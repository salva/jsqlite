import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Pinned select.c:sqlite3Select tag-select-0482 compiles the subquery into
// the enclosing Vdbe with SRT_Coroutine. This is an ownership boundary check,
// not a claim about observable SQL row differences.
test('derived-table coroutine source uses parent-owned producer, not finished-child PC relocation',()=>{
 const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const coroutine=source.slice(source.indexOf('const tableProducer=!values&&!ordered&&derived.select.from.items.length===1'),source.indexOf('const consumer=ops.length;',source.indexOf('const tableProducer=!values&&!ordered&&derived.select.from.items.length===1')));
 assert.ok(coroutine.includes("destination:{kind:'coroutine'"),'selected table producer is emitted in parent');
  const fallback=coroutine.slice(coroutine.indexOf('}else{\n    // Existing non-VALUES fallback'));
 assert.doesNotMatch(fallback,/const child=inner as Program;[\s\S]*?for\(const original of child\.ops\)/,'remaining derived producer must not relocate a finished child Program');
});
