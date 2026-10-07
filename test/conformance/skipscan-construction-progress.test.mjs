import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// Preserve the accepted red structural discriminator alongside behavioral
// producer/public tests. Naming alone is not fidelity or cancellation evidence.
test('pinned deep equality ProgressCheck has a production construction owner',()=>{
 const c=fs.readFileSync(new URL('../../reference/sqlite/sqlite-src-3530400/src/where.c',import.meta.url),'utf8');
 const ts=fs.readFileSync(new URL('../../src/internal/where-plan.ts',import.meta.url),'utf8');
 assert.match(c,/if\( pNew->u.btree.nEq>3 \)\{\s*sqlite3ProgressCheck\(pParse\);/);
 assert.match(ts,/progressCheck|checkProgress|onProgress/,'source deep-equality recursion progress owner missing (candidate-budget debit is not a control check)');
});
