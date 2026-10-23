// Native receipt is obtained BEFORE this test: BLOOM_NATIVE_RECEIPTS=path:path.
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPulldownPlacement,pulldownExecution} from './where-bloom-placement.mjs';
const paths=process.env.BLOOM_NATIVE_RECEIPTS?.split(':');
test('native three-source placement and dependency exclusion feed pending driver', {skip:!paths && 'Run pinned pulldown and pulldown-dependent captures FIRST; no runtime credit'},async()=>{
 const receipts=paths.map(p=>JSON.parse(fs.readFileSync(p)));
 assert.deepEqual(receipts.map(r=>r.case),['pulldown','pulldown-dependent']);
 for(const r of receipts) {
  assert.equal(r.variants.length,3);
  for(const v of r.variants) for(const m of v.modes) {
   const e=r.case==='pulldown'&&m.pulldownEnabled;
   assertPulldownPlacement(m.placement,e);
   assert.throws(()=>assertPulldownPlacement(m.placement,!e));
  }
  // Synthetic adapter exercises the pending driver using independent native
  // rows/metadata/placement expectations, not hand-authored one-loop objects.
  const adapter=mutate=>{let n=0;return {reset:async()=>{},execute:async c=>{
   const v=r.variants.find(v=>v.encoding===c.encoding),m=v.modes.find(m=>m.pulldownEnabled===c.pulldownEnabled);
   return {rows:m.runs[0].rows,columns:m.columns,error:null,executionId:++n,planIdentity:'retained',placement:mutate?{...m.placement,laterFilterBeforeFirstSeek:!m.placement.laterFilterBeforeFirstSeek}:structuredClone(m.placement)};
  }};};
  await pulldownExecution(adapter(false),r);
  await assert.rejects(()=>pulldownExecution(adapter(true),r));
 }
});
