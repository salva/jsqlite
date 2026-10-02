import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

// select.c tag-select-0482 calls sqlite3Select(pSub,&dest) with SRT_Coroutine
// in the enclosing Parse/Vdbe. Paired behavior: select-derived-table-parent-*.
test('admitted table-backed derived coroutine emits its inner scan into parent destination',()=>{
 const source=readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=source.indexOf('function compileDerivedProducer('),end=source.indexOf('\nfunction substituteViewExpression(',start);
 assert.ok(start>=0&&end>start);
 const owner=source.slice(start,end);
 const table=owner.slice(owner.indexOf('}else if(tableProducer){'),owner.indexOf('}else{\n    // select.c sqlite3Select dispatches semantic SELECT owners'));
 assert.ok(table.length>0,'table-backed route is distinct from completed-child fallback');
 assert.match(table,/compileInnerTableSelect\(/);
 assert.match(table,/kind:'coroutine'/);
 assert.doesNotMatch(table,/child\.ops|pcMap\[|relocateControlTargets\(/);
});
