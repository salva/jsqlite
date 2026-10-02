import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import {openFixture, privateAccounting} from './public-api-adapter.mjs';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/in-range-stat-native.json',import.meta.url)));
// Pinned vdbe.c check_for_interrupt/abort_due_to_interrupt and OP_IdxInsert:
// interrupt after selected access, preserve first error, and release transient
// RHS ownership on reset/finalize. Browser deadlines/private bytes are adapter
// controls, not claims of native EQP or work-unit equivalence.
for(const variant of capture.variants.filter(v=>v.state==='after')){
 test(`selected IN interruption and private-byte cleanup ${variant.encoding}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  const request=()=>new Request(`http://127.0.0.1:${server.address().port}/fixture`);
  let db,limited;
  const sql='SELECT id FROM t INDEXED BY t_ab WHERE a IN (1) AND b>=13 AND b<15';
  const drain=async s=>{const rows=[];while(await s.step()==='row')rows.push(s.column(0));return rows};
  try{
   assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
   db=await openFixture(request());
   const control=db.prepare(sql).statement;
   const expected=await drain(control);assert.ok(expected.length>0);assert.ok(privateAccounting(control).indexSeeks>0);control.finalize();
   const s=db.prepare(sql).statement;
   assert.equal(await s.step(),'row');assert.ok(privateAccounting(s).indexSeeks>0);
   // Next step runs after an actual selected row, not a pre-start abort.
   const controller=new AbortController(),reason=new Error('selected IN abort');
   controller.abort(reason);
   let cancel;try{await s.step({signal:controller.signal})}catch(e){cancel=e}
   assert.equal(cancel?.kind,'cancelled');assert.equal(cancel.message,'statement execution was cancelled');assert.equal(cancel.cause,reason);
   await assert.rejects(s.step(),e=>e===cancel);
   assert.throws(()=>s.reset(),e=>e===cancel);
   assert.deepEqual(await drain(s),expected);s.finalize();

   const live=db.prepare(`SELECT id, hex('${'z'.repeat(256*1024)}') FROM t INDEXED BY t_ab WHERE a=1 AND b>=13 AND b<15`).statement;
   const liveController=new AbortController(),liveReason=new Error('live selected abort');
   setTimeout(()=>liveController.abort(liveReason),0);
   let interrupted;try{await live.step({signal:liveController.signal})}catch(e){interrupted=e}
   assert.equal(interrupted?.kind,'cancelled');assert.equal(interrupted.cause,liveReason);
   assert.ok(privateAccounting(live).indexSeeks>0,'host cancellation occurs after selected seek, not RHS preparation');
   assert.throws(()=>live.finalize(),e=>e===interrupted);

   const during=db.prepare(`SELECT id, hex('${'z'.repeat(256*1024)}') FROM t INDEXED BY t_ab WHERE a=1 AND b>=13 AND b<15`).statement;
   const realNow=Date.now;Date.now=()=>privateAccounting(during).indexSeeks>0?1002:1000;
   let deadline;try{await during.step({timeoutMs:2})}catch(e){deadline=e}finally{Date.now=realNow}
   assert.equal(deadline?.kind,'timeout');assert.ok(privateAccounting(during).indexSeeks>0,'deadline expires only after actual selected access');
   assert.throws(()=>during.reset(),e=>e===deadline);
   assert.equal(await during.step(),'row');during.finalize();

   const timed=db.prepare(sql).statement;
   assert.equal(await timed.step(),'row');assert.ok(privateAccounting(timed).indexSeeks>0);
   const now=Date.now;let clock=1000;Date.now=()=>clock++;
   let timeout;try{await timed.step({timeoutMs:1})}catch(e){timeout=e}finally{Date.now=now}
   assert.equal(timeout?.kind,'timeout');assert.equal(timeout.message,'statement execution timed out');await assert.rejects(timed.step(),e=>e===timeout);
   assert.throws(()=>timed.finalize(),e=>e===timeout);
   const reuse=db.prepare(sql).statement;assert.deepEqual(await drain(reuse),expected);reuse.finalize();

   limited=await openFixture(request(),{limits:{maxPrivateBytes:0}});
   const rhs=limited.prepare('SELECT id FROM t INDEXED BY t_ab WHERE a IN (1,2) AND b>=13 AND b<15').statement;
   let limit;try{await rhs.step()}catch(e){limit=e}
   assert.equal(limit?.kind,'limit');assert.match(limit.message,/byte limit/);
   assert.equal(privateAccounting(rhs).indexSeeks,0,'RHS byte admission fails before first index seek');
   await assert.rejects(rhs.step(),e=>e===limit);assert.throws(()=>rhs.reset(),e=>e===limit);
   await assert.rejects(rhs.step(),e=>e.kind==='limit');assert.throws(()=>rhs.finalize(),e=>e.kind==='limit');
   // No transient RHS required for this selected control; admission is restored.
   const fresh=limited.prepare('SELECT id FROM t INDEXED BY t_ab WHERE a=1 AND b>=13 AND b<15').statement;
   assert.deepEqual(await drain(fresh),expected);assert.ok(privateAccounting(fresh).indexSeeks>0);fresh.finalize();
  }finally{db?.closeDeferred();limited?.closeDeferred();await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
 });
}
