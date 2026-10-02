import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Structural migration gate for the supported single-source no-FROM VALUES
// derived caller. Behavioral typed/lifecycle controls live in
// derived-values-registers.test.mjs (pinned multiSelectValues: select.c 2862ff).
test('derived VALUES producer emits into parent SelectDest without relocating a finished child',()=>{
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileDerivedProducer(');
 const end=source.indexOf('\nfunction substituteViewExpression(',start);
 assert.ok(start>=0&&end>start,'derived producer owner identifiable');
 const owner=source.slice(start,end);
 assert.match(owner,/const producerDest:SelectDest=\{kind:'coroutine'/,'VALUES arm emits into the parent destination');
 const valuesBranch=owner.slice(owner.indexOf('if(values){\n    const producerDest'),owner.indexOf('}else{\n    // select.c sqlite3Select dispatches semantic SELECT owners'));
 assert.ok(valuesBranch.length>0,'VALUES branch remains separate from fallback');
 assert.doesNotMatch(valuesBranch,/relocateControlTargets\(|child\.ops|inner\.ops/,'VALUES arm never splices completed child PCs');
});
