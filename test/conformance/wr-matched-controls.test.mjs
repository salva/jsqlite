import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {privateAccounting} from './public-api-adapter.mjs';
for(const enc of ['utf8','utf16le','utf16be'])test(`WR selected matched lifecycle ${enc}`,async()=>{
 const bytes=fs.readFileSync(new URL(`./fixtures/advanced-index-${enc}.db`,import.meta.url));const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 const sql='SELECT l.id,r.a,r.b FROM m l NOT INDEXED FULL JOIN wr r INDEXED BY wr_c ON r.c=l.b';
 const budgets=new Set(),reserve=PrivateStateByteBudget.prototype.reserve;
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args);};
 const refunded=()=>{assert.ok(budgets.size);for(const b of budgets)assert.equal(b.usedBytes,0);};
 try{db=await open('https://fixture.invalid/wr-controls');
  for(const mode of ['cancel','deadline','work'])for(const finish of ['reset','finalize']){
   const s=db.prepare(sql).statement;assert.equal(await s.step(),'row');assert.ok(privateAccounting(s).indexSeeks>0);
   const controller=new AbortController();controller.abort();let error;try{await s.step(mode==='cancel'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:{maxWorkUnits:0});}catch(e){error=e;}
   assert.equal(error?.kind,mode==='cancel'?'cancelled':mode==='deadline'?'timeout':'limit');
   await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s[finish](),e=>e===error);if(finish==='reset')s.finalize();refunded();
   const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');recovery.finalize();
  }
  db.closeDeferred();
  const corrupt=Buffer.from(bytes),pageSize=bytes.readUInt16BE(16)||65536;corrupt[2*pageSize]=0;
  globalThis.fetch=async()=>new Response(corrupt);db=await open('https://fixture.invalid/wr-corrupt');
  for(const suffix of ['', ' LIMIT 0']){
   const s=db.prepare(sql+suffix).statement;
   if(suffix){assert.equal(await s.step(),'done');assert.equal(privateAccounting(s).indexSeeks,0);s.finalize();}
   else {let error;try{while(await s.step()==='row'){};}catch(e){error=e;}assert.equal(error?.kind,'sqlite');assert.ok(privateAccounting(s).indexSeeks>0);assert.throws(()=>s.reset(),e=>e===error);s.finalize();refunded();}
  }
  db.closeDeferred();globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/wr-capacity',{limits:{maxPrivateEntries:0}});
  const limited=db.prepare(sql).statement;let error;try{await limited.step();}catch(e){error=e;}assert.equal(error?.kind,'limit');assert.throws(()=>limited.finalize(),e=>e===error);refunded();
  const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');recovery.finalize();
 }finally{db?.closeDeferred();PrivateStateByteBudget.prototype.reserve=reserve;globalThis.fetch=old;}
});
