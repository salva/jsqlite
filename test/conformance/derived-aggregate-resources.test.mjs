import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const root=process.env.COMMON_CHECKPOINT_OUTPUT;
assert.ok(root,'COMMON_CHECKPOINT_OUTPUT required');
const native=JSON.parse(readFileSync(resolve(root,'native.json')));
for(const image of native.encodings)for(const mode of ['bytes','entries','work','result','abort','deadline'])
test(`retained aggregate ${image.encoding} ${mode} saved error/refund/reset/rebind`,async()=>{
 const fetch=globalThis.fetch,reserve=PrivateStateByteBudget.prototype.reserve,budgets=new Set();
 globalThis.fetch=async()=>new Response(readFileSync(image.file));
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args)};
 let db,s;
 try{
  const limits=mode==='bytes'?{maxPrivateBytes:4096}:mode==='entries'?{maxPrivateEntries:1}:mode==='result'?{maxResultBytes:8}:{};
  db=await open('https://fixture.invalid/retained-resource',{limits});
  s=db.prepare(`SELECT ${mode==='result'?'group_concat(payload)':'sum(x)'} FROM (SELECT x,?1 AS payload FROM t ORDER BY x DESC LIMIT ?2)`).statement;
  assert.equal(s.parameterCount,2);
  s.bind(1,mode==='bytes'?'x'.repeat(10000):mode==='result'?'x'.repeat(100):'small');s.bind(2,2n);
  const controller=new AbortController();if(mode==='abort')controller.abort();
  const options=mode==='abort'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:mode==='work'?{maxWorkUnits:1}:{};
  let first;
  await assert.rejects(async()=>{while(await s.step(options)==='row'){}},e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit')});
  for(const b of budgets)assert.equal(b.usedBytes,0,'failed execution refunds shared budget');
  assert.throws(()=>s.reset(),e=>e===first);
  s.bind(1,'small');s.bind(2,1n);
  for(let run=0;run<2;run++){
   assert.equal(await s.step(),'row');assert.equal(s.column(0),mode==='result'?'small':3n);assert.equal(await s.step(),'done');
   for(const b of budgets)assert.equal(b.usedBytes,0,'halt refunds shared budget');s.reset();
  }
  s.finalize();s=null;for(const b of budgets)assert.equal(b.usedBytes,0,'finalize refunds');
  const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);recovery.finalize();
 }finally{try{s?.finalize();db?.close()}finally{globalThis.fetch=fetch;PrivateStateByteBudget.prototype.reserve=reserve;}}
});
