import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const arm='SELECT x,x+1,x+2,x+3,x+4,x+5 FROM t1 WHERE x<2';
const sql=arm+' UNION ALL '+arm+' ORDER BY 1';
test('six-field merge sorter exact entry/key/shared-byte boundaries preserve first error, reset and later admission',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,s;
 try{for(const [limits,passes] of [
  [{maxPrivateEntries:2,maxPrivateKeyBytes:8,maxPrivateBytes:224},true],
  [{maxPrivateEntries:1,maxPrivateKeyBytes:8,maxPrivateBytes:224},false],
  [{maxPrivateEntries:2,maxPrivateKeyBytes:7,maxPrivateBytes:224},false],
  [{maxPrivateEntries:2,maxPrivateKeyBytes:8,maxPrivateBytes:223},false],
 ]){
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`),{limits});s=db.prepare(sql).statement;
  for(let run=0;run<2;run++){
   if(passes){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:6},(_,i)=>s.column(i)));assert.deepEqual(rows,[0n,0n,1n,1n].map(x=>Array.from({length:6},(_,i)=>x+BigInt(i))));s.reset();}
   else{let first;await assert.rejects(s.step(),e=>(first=e,e.kind==='limit'));await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);}
  }
  try{s.finalize()}catch(e){assert.equal(e.kind,'limit')}s=undefined;
  const next=db.prepare('SELECT 1').statement;assert.equal(await next.step(),'row');next.finalize();db.closeDeferred();db=undefined;
 }}finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});
