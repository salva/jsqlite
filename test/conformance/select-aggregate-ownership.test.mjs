import assert from 'node:assert/strict';
import test from 'node:test';
import {parseSql} from '../../src/internal/parse.ts';
import {selectHasAggregate} from '../../src/internal/vdbe.ts';

// resolve.c:resolveExprStep TK_IN walks its left Expr in the current
// NameContext; its RHS SELECT (as with TK_EXISTS/TK_SELECT) gets a child one.
test('aggregate ownership stops at child SELECT but includes IN left operand',()=>{
 for(const [sql,expected] of [
  ['SELECT (SELECT count(*) FROM t2) FROM t2',false],
  ['SELECT EXISTS(SELECT count(*) FROM t2) FROM t2',false],
  ['SELECT 3 IN (SELECT count(*) FROM t2) FROM t2',false],
  ['SELECT count(*) IN (SELECT x FROM t2) FROM t2',true],
 ]){
  const select=parseSql(sql).statement;
  assert.equal(select?.kind,'select');
  assert.equal(selectHasAggregate(select),expected,sql);
 }
});
