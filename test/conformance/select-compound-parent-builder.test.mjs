import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// Migration gate, not a behavioral oracle: the paired native/public
// select-table-compound-names probes already establish the admitted behavior.
// This checks that its owning table-arm producer no longer composes completed
// child Programs (which requires rebasing their control edges after emission).
test('table-backed compound derived emits arms into a shared SELECT builder',()=>{
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileSingleCompoundDerived(');
 const end=source.indexOf('\nexport type FromSubqueryRouteFacts',start);
 assert.ok(start>=0&&end>start,'table-backed compound owner must remain identifiable');
 const owner=source.slice(start,end);
 assert.match(owner,/compileInnerTableSelect\(/,'table-arm production consumes parent builder');
 assert.doesNotMatch(owner,/relocateControlTargets\(|children\.map\(arm=>|child\.ops/,'no completed-child program splicing');
});
