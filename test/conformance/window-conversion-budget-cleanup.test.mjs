import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';

// No-conversion window succeeds at359; retained-row pressure fails at358.
// Actual affinity conversion admission is covered by make-record-small-budget-cleanup.
for(const mode of ['window-success','window-pressure-failure'])test(mode, async () => {
  const bytes=fs.readFileSync('test/fixtures/aggregate-window/w2rows.db');
  const server=http.createServer((req,res)=>res.end(bytes));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const reserve=PrivateStateByteBudget.prototype.reserve, budgets=new Set();
  PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args);};
  let db,statement;
  try {
    db=await open(`http://127.0.0.1:${server.address().port}/db`,{limits:{maxPrivateBytes:mode==='window-success'?359:358}});
    statement=db.prepare('SELECT a, sum(d) OVER (ORDER BY d ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) FROM t1').statement;
    for(let attempt=0;attempt<2;attempt++) {
      if(mode==='window-success') {
        let rows=0;
        while(await statement.step()==='row')rows++;
        assert.ok(rows>0);
        statement.reset();
        assert.ok([...budgets].every(b=>b.usedBytes===0));
        continue;
      }
      let saved;
      await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>{saved=error;return error.kind==='limit';});
      assert.ok(budgets.size>0);
      assert.ok([...budgets].every(b=>b.usedBytes===0),'failure releases sorter and transient/private owners');
      await assert.rejects(statement.step(),error=>error===saved);
      assert.throws(()=>statement.reset(),error=>error===saved);
      statement.reset();
    }
    statement.finalize();statement=undefined;
    assert.ok([...budgets].every(b=>b.usedBytes===0));
  } finally {
    try {statement?.finalize();} finally {
      db?.closeDeferred();
      PrivateStateByteBudget.prototype.reserve=reserve;
      await new Promise(resolve=>server.close(resolve));
    }
  }
});
