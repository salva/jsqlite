import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// select.c tag-select-0488: sqlite3Select(pSub,&SRT_EphemTab) uses the
// enclosing Vdbe; selectInnerLoop inserts rows before the parent predicate.
// Pinned/public behavior: select-derived-window-parent-native.py / .test.mjs.
test('window-derived materialization emits into parent builder destination',()=>{
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileDerivedProducer('),end=source.indexOf(' if(derived&&derived.index===0&&select.from.items.length===1&&!select.where',start);
 assert.ok(start>=0&&end>start);
 const window=source.slice(start,end);
 assert.match(window,/compileWindowSelectLowering\(/);
 assert.match(window,/new SelectProgramBuilder<Op>\(\)/);
 assert.match(window,/destination:\{kind:'sorter',cursor:spool,keyCount:0\}/);
 assert.doesNotMatch(window,/inner\.ops\.map\(|pcMap\[/);
});
