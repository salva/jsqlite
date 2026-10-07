// Preserve the red predicate; adapted acceptance compares its emitted evidence.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const baseline=JSON.parse(fs.readFileSync('docs/research/card-h-e/red-report.json'));
const root=process.env.SAIVAGE_CARD_WORK_ROOT;
for(let batch=0;batch<2;batch++){
 const child=spawnSync(process.execPath,['test/browser/scheduler-latency-red.mjs'],{env:process.env,encoding:'utf8'});
 assert.equal(child.status,1,child.stderr);assert.match(child.stderr,/current timer suspension must dominate/);
 const r=JSON.parse(fs.readFileSync(path.join(root,'scheduler-red/report.json')));
 for(const run of r.runs){
  assert.deepEqual(run.program,baseline.runs[0].program);
  assert.deepEqual(run.perPC,baseline.runs[0].perPC);
  assert.equal(run.work,baseline.runs[0].work);
  assert.deepEqual(run.rows,baseline.runs[0].rows);
  assert(run.elapsedMs<baseline.runs[0].elapsedMs/2);
  assert(run.ticks>=Math.floor(run.elapsedMs/10),'real interval tasks must progress');
  assert.equal(run.timerYields,136);
 }
 fs.writeFileSync(`docs/research/card-h-e/green-latency-${batch+2}.json`,JSON.stringify(r,null,2));
 console.log(child.stdout.trim());
}
console.log('PASS: six real-browser adapted runs: unchanged program/perPC/work/types, periodic timer fairness, lower elapsed latency');
