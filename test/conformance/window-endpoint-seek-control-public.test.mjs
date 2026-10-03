import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {open} from '../../src/index.ts';
import {EphemeralIndexCursor} from '../../src/internal/private-state.ts';

// window.c1948–1950 regApp bounds: first599 outputs are NULL; output600
// seeks the real application cursor's last record. No injected traversal work.
const sql='SELECT a,nth_value(a,600) OVER (ORDER BY a ROWS BETWEEN 599 PRECEDING AND CURRENT ROW) FROM t';
test('public large partition seek accounts visits, host yields, aborts/deadlines and resets',async()=>{
 const bytes=fs.readFileSync(new URL('../fixtures/endpoint-seek/partition.db',import.meta.url));
 const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':String(bytes.length)});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const original=EphemeralIndexCursor.prototype.seekRowid,timer=globalThis.setTimeout,now=Date.now;
 let mode='normal',visits=0,active=false,hostYields=0,controller;
 EphemeralIndexCursor.prototype.seekRowid=async function(rowid,control){active=true;try{return await original.call(this,rowid,{checkpoint:async(units=0)=>{visits+=units;if(mode==='deadline'&&visits===260)Date.now=()=>now()+100000;await control.checkpoint(units);}})}finally{active=false;}};
 globalThis.setTimeout=(callback,delay,...args)=>{
  if(active&&delay===0){hostYields++;return timer(()=>{assert.throws(()=>db.prepare('SELECT 1'),e=>e.kind==='misuse','connection remains admitted during actual seek host suspension');if(mode==='abort')controller.abort();callback(...args)},delay);}
  return timer(callback,delay,...args);
 };
 let db,s;
 const prefix=async(options)=>{for(let i=1;i<600;i++){assert.equal(await s.step(options),'row');assert.equal(s.column(0),BigInt(i));assert.equal(s.columnType(1),'null');}assert.equal(visits,0);};
 try{
  db=await open(new Request(`http://127.0.0.1:${server.address().port}/partition.db`));s=db.prepare(sql).statement;
  await prefix();assert.equal(await s.step(),'row');assert.equal(visits,600);assert.ok(hostYields>=2,'actual VM host yields occur inside seek');assert.equal(s.columnType(1),'integer');assert.equal(s.column(1),600n);assert.equal(await s.step(),'done');
  s.reset();visits=0;await prefix();assert.equal(await s.step(),'row');assert.equal(visits,600);s.reset();
  // Public maxWorkUnits is cumulative. Compare first600-output threshold with
  // a diagnostic no-charge control wrapper to isolate ONLY lookup work.
  const minimum=async()=>{let lo=0,hi=100000;while(lo<hi){const mid=Math.floor((lo+hi)/2);s.reset();try{for(let i=0;i<600;i++)await s.step({maxWorkUnits:mid});hi=mid}catch(e){assert.equal(e.kind,'limit');assert.throws(()=>s.reset(),error=>error.kind==='limit');lo=mid+1;}}s.reset();return lo;};
  const charged=await minimum();
  EphemeralIndexCursor.prototype.seekRowid=async function(rowid,control){return original.call(this,rowid,{checkpoint:()=>control.checkpoint(0)});};
  const uncharged=await minimum();assert.equal(charged-uncharged,600);
  EphemeralIndexCursor.prototype.seekRowid=async function(rowid,control){active=true;try{return await original.call(this,rowid,{checkpoint:async(units=0)=>{visits+=units;if(mode==='deadline'&&visits===260)Date.now=()=>now()+100000;await control.checkpoint(units);}})}finally{active=false;}};
  s.reset();visits=0;await prefix();mode='abort';controller=new AbortController();
  await assert.rejects(s.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.ok(visits>0&&visits<600);
  assert.throws(()=>s.reset(),e=>e.kind==='cancelled');mode='normal';visits=0;await prefix();assert.equal(await s.step(),'row');s.reset();
  visits=0;await prefix();mode='deadline';
  await assert.rejects(s.step({timeoutMs:10000}),e=>e.kind==='timeout');assert.equal(visits,260);
  Date.now=now;assert.throws(()=>s.reset(),e=>e.kind==='timeout');mode='normal';visits=0;await prefix();assert.equal(await s.step(),'row');s.finalize();s=undefined;
 }finally{Date.now=now;globalThis.setTimeout=timer;EphemeralIndexCursor.prototype.seekRowid=original;try{s?.finalize()}catch{}db?.close();await new Promise(r=>server.close(r));}
});
