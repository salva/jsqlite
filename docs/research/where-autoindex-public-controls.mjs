// Public operation controls on the native-derived join baseline. No feature credit.
import assert from 'node:assert/strict';
import {JSQLiteError} from '../../src/index.ts';
export async function publicJoinControls(db,sql,mode,cell) {
  const columns=s=>Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
  const row=s=>Array.from({length:s.columnCount},(_,i)=>cell(s,i));
  const expected=mode.runs[0].rows;
  assert.ok(expected.length>1,'live survivor needs multiple native rows');
  let checks=0;
  for(const phase of ['before-first-row','after-first-row'])
  for(const kind of ['cancelled','timeout']) {
    const s=db.prepare(sql).statement,survivor=db.prepare(sql).statement;
    try {
      assert.deepEqual(columns(s),mode.columns);
      assert.deepEqual(columns(survivor),mode.columns);
      assert.equal(await survivor.step(),'row');
      const survivorRows=[row(survivor)];
      assert.deepEqual(survivorRows[0],expected[0]);
      if(phase==='after-first-row') {assert.equal(await s.step(),'row');assert.deepEqual(row(s),expected[0]);}
      const reason={control:'caller-owned-reason'};
      const controller=new AbortController();controller.abort(reason);
      const options=kind==='cancelled'?{signal:controller.signal}:{timeoutMs:0};
      let saved;
      await assert.rejects(s.step(options),error=>{
        assert.ok(error instanceof JSQLiteError);
        assert.equal(error.kind,kind);
        assert.equal(error.message,kind==='cancelled'?'statement execution was cancelled':'statement execution timed out');
        assert.equal(error.code,null);assert.equal(error.extendedCode,null);
        assert.equal(error.cause,kind==='cancelled'?reason:undefined);
        saved=error;return true;
      });
      // Failed state preserves the actual error, rather than replaying work.
      await assert.rejects(s.step(),error=>error===saved);
      assert.throws(()=>s.reset(),error=>error===saved);
      s.reset(); // cleanup already completed; repeated reset is safe
      const retry=[];while(await s.step()==='row')retry.push(row(s));
      assert.deepEqual(retry,expected);assert.deepEqual(columns(s),mode.columns);
      // A separately live owner survives failure AND reset/retry of s.
      while(await survivor.step()==='row')survivorRows.push(row(survivor));
      assert.deepEqual(survivorRows,expected);
      assert.deepEqual(columns(survivor),mode.columns);
      checks++;
    } finally {s.finalize();survivor.finalize();}
  }
  return checks;
}
