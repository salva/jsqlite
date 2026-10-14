import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
test('default historical Stage2 inventory reports every allocated case as no-credit when current diagnostics are absent',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('./cases/stage2-ts.json',import.meta.url)));
 assert.ok(data.cases.every(c=>c.diagnosticExpected===undefined),'default inventory changed: reassess this missing-expectation control');
 const r=spawnSync(process.execPath,[new URL('./run-ts.mjs',import.meta.url).pathname],{encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
 assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,1,r.stderr);
 const rows=r.stdout.trim().split('\n').map(s=>JSON.parse(s));const summary=rows.pop().summary;
 assert.equal(rows.length,data.cases.length);
 assert.deepEqual(rows.map(r=>r.caseId),data.cases.map(c=>c.id));
 assert.ok(rows.every(r=>r.credit===0&&r.matched===false&&r.matchReason==='missing-diagnostic-expectation'));
 for(let i=0;i<rows.length;i++){
  const allocated=data.cases[i].operations.filter(o=>o.assertion).length;
  assert.equal(rows[i].sourceAssertionsChecked,allocated,`source assertions for ${rows[i].caseId}`);
 }
 assert.equal(summary.declared,data.cases.length);assert.equal(summary.attempted,data.cases.length);
 assert.equal(summary.unattempted,0);assert.equal(summary.failed,data.cases.length);assert.equal(summary.credit,0);
});
