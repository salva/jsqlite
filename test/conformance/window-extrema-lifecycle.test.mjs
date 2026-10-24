import test from 'node:test';
import assert from 'node:assert/strict';
import {open} from '../../src/index.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {privateAccounting} from './public-api-adapter.mjs';

for(const limits of [{maxPrivateEntries:0},{maxPrivateKeyBytes:1},{maxPrivateBytes:100},{maxWorkUnits:1}])test(`packed extrema rejects bounded resource admission ${JSON.stringify(limits)}`,async()=>{
 const server=await startFixtureServer('test/fixtures');let db,stmt;
 try{
  db=await open(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/expr-relational`),{limits});
  stmt=db.prepare('SELECT min(x) OVER (ORDER BY x DESC ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1 WHERE x>=29').statement;
  let saved;await assert.rejects(async()=>{while(await stmt.step()==='row'){}},e=>{saved=e;return e.kind==='limit'});
  assert.equal(privateAccounting(stmt).ownedBytes,0);assert.throws(()=>stmt.reset(),e=>e===saved);
 }finally{try{stmt?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.server.close(r))}}
});
for(const kind of ['cancelled','timeout'])test(`packed extrema live ${kind} releases arena and preserves first error`,async()=>{
 const server=await startFixtureServer('test/fixtures');let db,stmt;
 const original=PrivateKeyVmCursor.prototype.deleteCurrent;
 const controller=new AbortController();let calls=0;
 PrivateKeyVmCursor.prototype.deleteCurrent=async function(options,control){
  if(this.info.totalFieldCount===2){calls++;if(kind==='cancelled')controller.abort();else await new Promise(r=>setTimeout(r,30))}
  return original.call(this,options,control);
 };
 try{
  db=await open(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/expr-relational`));
  stmt=db.prepare('SELECT min(x) OVER (ORDER BY x DESC ROWS BETWEEN 1 PRECEDING AND CURRENT ROW) FROM t1 WHERE x>=29').statement;
  assert.equal(await stmt.step(),'row');assert.equal(await stmt.step(),'row');
  let saved;
  await assert.rejects(stmt.step(kind==='cancelled'?{signal:controller.signal}:{timeoutMs:10}),e=>{saved=e;return e.kind===kind});
  assert.equal(calls,1);assert.equal(privateAccounting(stmt).ownedBytes,0);
  assert.throws(()=>stmt.reset(),e=>e===saved);
  assert.equal(calls,1,'failed inverse must not replay');
 }finally{
  PrivateKeyVmCursor.prototype.deleteCurrent=original;
  try{stmt?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.server.close(r))}
 }
});
