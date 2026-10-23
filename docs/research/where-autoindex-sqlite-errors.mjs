// Real public SQLite error checks against the adjacent pinned-native receipt.
import assert from 'node:assert/strict';
import {JSQLiteError} from '../../src/index.ts';
export async function sqliteErrorRuns(db,sql,mode) {
  const s=db.prepare(sql).statement;
  try {
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),mode.columns);
    for(const run of mode.runs) {
      assert.equal(run.rc,1);assert.deepEqual(run.rows,[]);assert.equal(run.resetRc,1);
      let saved;
      await assert.rejects(s.step(),e=>{
        assert.ok(e instanceof JSQLiteError);assert.equal(e.kind,'sqlite');
        assert.equal(e.code,run.error.code);assert.equal(e.extendedCode,run.error.extendedCode);
        assert.equal(e.message,run.error.message);saved=e;return true;
      });
      await assert.rejects(s.step(),e=>e===saved);
      assert.throws(()=>s.reset(),e=>e===saved);
    }
  } finally {s.finalize();} // both native and public reset have cleared the error
}
