import {suspendExecutionTask} from './suspend-execution-task.mjs';
import {EphemeralIndexCursor} from '../../src/internal/private-state.ts';
import {closeTestServer} from './close-test-server.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
test('filtered compound variables retain lexical identity across WHERE/projection/LIMIT and reset',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));
  for(const operator of ['UNION','UNION ALL'])for(const order of ['ORDER BY v','']){
  s=db.prepare('SELECT a+? AS v FROM left_meta WHERE a>? '+operator+' SELECT CAST(b AS INTEGER)+? FROM right_meta WHERE CAST(b AS INTEGER)<? '+order+' LIMIT ? OFFSET ?').statement;
  const values=[100n,6n,200n,9n,2n,0n];values.forEach((value,i)=>s.bind(i+1,value));
  const rows=async()=>{const result=[];while(await s.step()==='row')result.push(s.column(0));return result;};
  assert.deepEqual(await rows(),[107n,208n]);s.reset();assert.deepEqual(await rows(),[107n,208n]);
  s.reset();s.bind(2,10n);assert.deepEqual(await rows(),[208n]);s.finalize();s=undefined;
  }
 }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});

test('filtered compound active suspension preserves PC, exclusive admission, cancellation, cleanup, reset and finalize',async()=>{
 const gate=suspendExecutionTask(),{suspended,release}=gate;
 const bridge=await startFixtureServer(root);let db,s;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));const sql=Array.from({length:10},()=> 'SELECT x FROM t1 WHERE x IS NOT NULL').join(' UNION ALL ');s=db.prepare(sql).statement;const abort=new AbortController(),pending=(async()=>{while(await s.step({signal:abort.signal})==='row'){} })();await suspended;assert.throws(()=>db.prepare('SELECT 1'),e=>e.kind==='misuse');await assert.rejects(s.step(),e=>e.kind==='misuse');abort.abort('compound-stop');release();await assert.rejects(pending,e=>e.kind==='cancelled'&&e.cause==='compound-stop');assert.throws(()=>s.reset(),e=>e.kind==='cancelled');gate.restore();let count=0;while(await s.step()==='row')count++;assert.equal(count,320,'reset executes each arm once without restart or duplicates');s.finalize();s=undefined;const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize()}
 finally{gate.restore();try{release?.()}catch{}try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});

test('filtered compound deadline and exact work bound keep first error and cleanup',async()=>{
 const insert=EphemeralIndexCursor.prototype.insert,now=Date.now;let active=false;EphemeralIndexCursor.prototype.insert=async function(key,control){active=true;await control.checkpoint(1);return insert.call(this,key,control)};Date.now=()=>active?100:0;
 const bridge=await startFixtureServer(root);let db,s;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));s=db.prepare('SELECT a FROM left_meta WHERE a>0 UNION SELECT b FROM right_meta WHERE b IS NOT NULL').statement;await assert.rejects(s.step({timeoutMs:2}),e=>e.kind==='timeout');assert.throws(()=>s.finalize(),e=>e.kind==='timeout');s=undefined;Date.now=now;const limited=db.prepare('SELECT a FROM left_meta WHERE a>0 UNION SELECT b FROM right_meta WHERE b IS NOT NULL').statement;await assert.rejects(limited.step({maxWorkUnits:0}),e=>e.kind==='limit');assert.throws(()=>limited.finalize(),e=>e.kind==='limit');const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize()}
 finally{Date.now=now;EphemeralIndexCursor.prototype.insert=insert;try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});

test('ordered filtered merge positions A before B and skips unused B on initial A EOF',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));
  // Pinned multiSelectByMerge addrEofA_noB: EXCEPT/INTERSECT end
  // immediately; UNION/ALL must position B. Native return codes and reset
  // observations are recorded in card-j-d-b-a-c status v233.
  for(const operator of ['EXCEPT','INTERSECT','UNION','UNION ALL']){
   s=db.prepare(`SELECT a FROM left_meta WHERE a>99 ${operator} SELECT abs(-9223372036854775808) FROM right_meta ORDER BY 1`).statement;
   for(let run=0;run<2;run++){
    if(operator==='EXCEPT'||operator==='INTERSECT')assert.equal(await s.step(),'done');
    else await assert.rejects(()=>s.step(),/integer overflow/);
    try{s.reset()}catch{}
   }
   try{s.finalize()}catch{}s=undefined;
  }
  // Nonempty A must reach the failing B; LIMIT zero skips both producers
  // and OFFSET coercion, whereas nonzero LIMIT still positions both.
  for(const operator of ['EXCEPT','INTERSECT','UNION','UNION ALL']){
   s=db.prepare(`SELECT a FROM left_meta ${operator} SELECT abs(-9223372036854775808) FROM right_meta ORDER BY 1 LIMIT 1`).statement;
   await assert.rejects(()=>s.step(),/integer overflow/);
   try{s.finalize()}catch{}s=undefined;
   s=db.prepare(`SELECT a FROM left_meta ${operator} SELECT abs(-9223372036854775808) FROM right_meta ORDER BY 1 LIMIT 0 OFFSET 'invalid'`).statement;
   assert.equal(await s.step(),'done');s.reset();assert.equal(await s.step(),'done');s.finalize();s=undefined;
  }
 }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server);}
});
