import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const inventory=()=>JSON.parse(fs.readFileSync(new URL('./cases/stage2-ts.json',import.meta.url)));
function runInventory(input,status){
 const r=spawnSync(process.execPath,[new URL('./run-ts.mjs',import.meta.url).pathname,...(input?[input]:[])],{encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024});
 assert.equal(r.error,undefined);assert.equal(r.signal,null);assert.equal(r.status,status,r.stderr+'\n'+r.stdout);
 const rows=r.stdout.trim().split('\n').map(s=>JSON.parse(s));const summary=rows.pop().summary;
 return {rows,summary};
}
function assertAccounting(data,rows,summary){
 assert.equal(rows.length,data.cases.length);
 assert.deepEqual(rows.map(r=>r.caseId),data.cases.map(c=>c.id));
 assert.ok(rows.every(r=>r.credit===0));
 for(let i=0;i<rows.length;i++){
  const c=data.cases[i],r=rows[i];
  // A failing operation cannot complete its assertion; later operations must
  // remain explicitly unattempted rather than gaining compatibility credit.
  const completed=r.attempted?c.operations.slice(0,r.attempted.index):c.operations;
  assert.equal(r.sourceAssertionsChecked,completed.filter(o=>o.assertion).length,`source assertions for ${r.caseId}`);
  assert.deepEqual(r.notAttempted,r.attempted?c.operations.slice(r.attempted.index+1).map((o,j)=>({index:r.attempted.index+1+j,key:o.key,op:o.op})):[]);
 }
 assert.equal(summary.declared,data.cases.length);assert.equal(summary.attempted,data.cases.length);
 assert.equal(summary.upstream,38);assert.equal(summary.companions,9);
 assert.equal(summary.unattempted,0);assert.equal(summary.credit,0);
 assert.equal(summary.disposition,'diagnostic-no-credit');
}

test('explicit missing-expectation Stage2 input reports every allocated case as no-credit',()=>{
 const data=inventory();
 // Keep the real default expectations intact. Exercise the absent-expectation
 // contract with an explicit clone of the same allocated operations/identities.
 for(const c of data.cases)delete c.diagnosticExpected;
 const dir=fs.mkdtempSync(path.join(process.env.SAIVAGE_CARD_WORK_ROOT??os.tmpdir(),'stage2-missing-expectations-'));
 try{
  const input=path.join(dir,'cases.json');fs.writeFileSync(input,JSON.stringify(data));
  const {rows,summary}=runInventory(input,1);
  assertAccounting(data,rows,summary);
  assert.ok(rows.every(r=>r.matched===false&&r.matchReason==='missing-diagnostic-expectation'));
  assert.equal(summary.failed,data.cases.length);assert.equal(summary.passed,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('real default Stage2 diagnostic inventory matches all47 lanes without compatibility credit',()=>{
 const data=inventory();assert.equal(data.cases.length,47);
 assert.ok(data.cases.every(c=>c.diagnosticExpected));
 const {rows,summary}=runInventory(undefined,0);
 assertAccounting(data,rows,summary);
 for(let i=0;i<rows.length;i++){
  const r=rows[i],expected=data.cases[i].diagnosticExpected;
  assert.equal(r.matched,true,r.caseId);assert.equal(r.disposition,expected.disposition,r.caseId);
  if(expected.disposition==='observed-error'){
   assert.equal(r.matchReason,'observed-error');assert.equal(r.attempted.op,expected.error.operation);
   assert.equal(r.error.name,'JSQLiteError');
   for(const key of ['kind','code','extendedCode','message'])assert.equal(r.error[key],expected.error[key],`${r.caseId} ${key}`);
  }else{assert.equal(r.matchReason,'completion');assert.equal(r.error,null);assert.equal(r.attempted,null);}
 }
 assert.equal(summary.completed,44);assert.equal(summary.observedErrors,3);
 assert.equal(summary.passed,47);assert.equal(summary.failed,0);
});
