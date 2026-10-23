// Native EXPLAIN placement boundary: deliberately separate from runtime counters.
import assert from 'node:assert/strict';
const early=['Once','FilterAdd','FilterAdd','Filter','Filter','SeekGE','SeekGE'];
const ordinary=['Once','FilterAdd','Filter','SeekGE','Once','FilterAdd','Filter','SeekGE'];
export function assertPulldownPlacement(actual, expectedEarly) {
  assert.equal(actual.laterFilterBeforeFirstSeek,expectedEarly);
  assert.equal(actual.onceBlocks,expectedEarly?1:2);
  assert.deepEqual(actual.order,expectedEarly?early:ordinary);
}
export async function pulldownExecution(adapter, receipt) {
  assert.ok(['pulldown','pulldown-dependent'].includes(receipt.case));
  for(const variant of receipt.variants) for(const mode of variant.modes) {
    const expectedEarly=receipt.case==='pulldown' && mode.pulldownEnabled;
    assertPulldownPlacement(mode.placement,expectedEarly);
    let previous;
    for(const run of mode.runs) {
      const actual=await adapter.execute({case:receipt.case,encoding:variant.encoding,pulldownEnabled:mode.pulldownEnabled});
      assert.deepEqual(actual.rows,run.rows);assert.deepEqual(actual.columns,mode.columns);
      assert.equal(actual.error,null);
      // Actual emitted control placement, not guessed from SQL or result rows.
      assertPulldownPlacement(actual.placement,expectedEarly);
      assert.ok(Number.isSafeInteger(actual.executionId)&&actual.executionId>0);
      if(previous) {assert.notEqual(actual.executionId,previous.executionId);assert.equal(actual.planIdentity,previous.planIdentity);}
      previous=actual;await adapter.reset();
    }
  }
}
