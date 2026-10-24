import test from 'node:test';
import assert from 'node:assert/strict';
import {open} from '../../src/index.ts';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {startFixtureServer} from './fixture-server.mjs';
import {privateAccounting} from './public-api-adapter.mjs';

// Reviewer31: model the supported post-release close diagnostic, not arena damage.
for(const boundary of ['inverse','done','reset','finalize'])test(`packed extrema complete ${boundary} cleanup despite throwing destructors`,async()=>{
 const server=await startFixtureServer('test/fixtures');let db,stmt;
 const del=PrivateKeyVmCursor.prototype.deleteCurrent,close=PrivateKeyVmCursor.prototype.close;
 const primary=new Error('primary inverse'),secondary=new Error('secondary close'),later=new Error('later close');
 const closed=new Set();let inverses=0,errors=0;
 PrivateKeyVmCursor.prototype.deleteCurrent=async function(...args){if(boundary==='inverse'&&this.info.totalFieldCount===2){inverses++;throw primary}return del.apply(this,args)};
 PrivateKeyVmCursor.prototype.close=function(...args){
  const result=close.apply(this,args);
  if(this.info.totalFieldCount===2){assert.ok(!closed.has(this),'exactly once application close');closed.add(this);throw errors++===0?secondary:later}
  return result;
 };
 try{
  db=await open(new Request(`http://127.0.0.1:${server.port}/fixture/${server.token}/expr-relational`));
  stmt=db.prepare('SELECT min(x) OVER w,max(x) OVER w FROM t1 WHERE x>=29 WINDOW w AS (ORDER BY x DESC ROWS BETWEEN 1 PRECEDING AND CURRENT ROW)').statement;
  const expected=boundary==='inverse'?primary:secondary;
  if(boundary==='reset'||boundary==='finalize'){
   assert.equal(await stmt.step(),'row');
   assert.throws(()=>stmt[boundary](),e=>e===expected);
  }else{
   await assert.rejects(async()=>{while(await stmt.step()==='row'){}},e=>e===expected);
   assert.equal(privateAccounting(stmt).ownedBytes,0,'refund before reset');
   await assert.rejects(()=>stmt.step(),e=>e===expected);
   assert.throws(()=>stmt.reset(),e=>e===expected);
  }
  assert.equal(closed.size,2,'all applications attempted after first close failure');
  assert.equal(errors,2);assert.equal(inverses,boundary==='inverse'?1:0);
  if(boundary!=='finalize'){
   assert.equal(privateAccounting(stmt).ownedBytes,0);assert.equal(privateAccounting(stmt).openCursors,0);
   stmt.reset(); // no callback replay
  }
  // A successful new lifetime after reset demonstrates READY, not a half-reset VM.
  PrivateKeyVmCursor.prototype.deleteCurrent=del;PrivateKeyVmCursor.prototype.close=close;
  if(boundary!=='finalize'){while(await stmt.step()==='row'){};assert.equal(privateAccounting(stmt).ownedBytes,0);stmt.finalize()}
  else await assert.rejects(()=>stmt.step(),e=>e.kind==='misuse');
  stmt=undefined;
 }finally{
  PrivateKeyVmCursor.prototype.deleteCurrent=del;PrivateKeyVmCursor.prototype.close=close;
  try{stmt?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.server.close(r))}
 }
});
