import {suspendExecutionTask} from './suspend-execution-task.mjs';
import {EphemeralIndexCursor} from '../../src/internal/private-state.ts';
import {closeTestServer} from './close-test-server.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
test('full-row compound active suspension retains admission, cancellation and reset ownership',async()=>{
 const gate=suspendExecutionTask(),{suspended,release}=gate;
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  s=db.prepare(Array.from({length:10},()=> 'SELECT x,x+1,x+2 FROM t1 WHERE x IS NOT NULL').join(' UNION ALL ')).statement;
  const abort=new AbortController(),pending=(async()=>{while(await s.step({signal:abort.signal})==='row'){} })();
  await suspended;assert.throws(()=>db.prepare('SELECT 1'),e=>e.kind==='misuse');await assert.rejects(s.step(),e=>e.kind==='misuse');
  abort.abort('wide-stop');release();await assert.rejects(pending,e=>e.kind==='cancelled'&&e.cause==='wide-stop');assert.throws(()=>s.reset(),e=>e.kind==='cancelled');
  gate.restore();let count=0;while(await s.step()==='row'){assert.equal(s.columnCount,3);assert.equal(s.column(1),s.column(0)+1n);assert.equal(s.column(2),s.column(0)+2n);count++;}assert.equal(count,320);
  s.finalize();s=undefined;const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
 }finally{gate.restore();release();try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});
test('full-row compound deadline/work first error releases private state and admission',async()=>{
 const insert=EphemeralIndexCursor.prototype.insert,now=Date.now;let active=false;
 EphemeralIndexCursor.prototype.insert=async function(key,control){active=true;await control.checkpoint(1);return insert.call(this,key,control)};Date.now=()=>active?100:0;
 const bridge=await startFixtureServer(root);let db,s;
 const sql='SELECT a,a+1 FROM left_meta WHERE a>0 UNION SELECT b,b FROM right_meta WHERE b IS NOT NULL';
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));s=db.prepare(sql).statement;
  await assert.rejects(s.step({timeoutMs:2}),e=>e.kind==='timeout');assert.throws(()=>s.finalize(),e=>e.kind==='timeout');s=undefined;Date.now=now;
  s=db.prepare(sql).statement;await assert.rejects(s.step({maxWorkUnits:0}),e=>e.kind==='limit');assert.throws(()=>s.finalize(),e=>e.kind==='limit');s=undefined;
  const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();
 }finally{Date.now=now;EphemeralIndexCursor.prototype.insert=insert;try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});
