import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSql} from '../../src/internal/parse.ts';

// Pinned parse.y:967-973: production identity, not descendant punctuation,
// determines which direct expr reduction is LIMIT and which is OFFSET.
test('LIMIT production owns direct expression roles and reduction identities',()=>{
 for(const limit of ['max(0,0)','min(1,2)','min(-1,-2)','(SELECT max(1,2))']){
  for(const offset of ['0','max(0,0)','(SELECT min(0,1))']){
   for(const comma of [false,true]){
    const sql=`SELECT 1 LIMIT ${comma?`${offset},${limit}`:`${limit} OFFSET ${offset}`}`;
    const result=parseSql(sql);const statement=result.statement;
    assert.equal(statement.kind,'select');
    for(const [expr,expected] of [[statement.limit,limit],[statement.offset,offset]]){
     assert.ok(expr.reduction);
     const tokens=expr.tokens;
     assert.equal(sql.slice(tokens[0].startByte,tokens.at(-1).endByte),expected);
     assert.equal(expr.reduction.kind,'reduction');
    }
   }
  }
  const s=parseSql(`SELECT 1 LIMIT ${limit}`).statement;
  assert.ok(s.limit);assert.equal(s.offset,null);
 }
});
