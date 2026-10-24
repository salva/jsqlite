import assert from 'node:assert/strict';
import {PrivateBloomFilter} from '../../src/internal/private-bloom.ts';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased} from './where-autoindex-contract.mjs';

// Serial source-owned allocator control. Select the actual packRecord backing
// allocation by its owning stack, after prior successful SQL build insertion.
// Do not replace packing, SQL execution, errors, or result rows.
export async function realRecordFault(db,sql,expected,cell){
 await recordFault(db,sql,expected,cell,false);
 await recordFault(db,sql,expected,cell,true);
}
async function recordFault(db,sql,expected,cell,secondaryCleanup){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;
 const Native=globalThis.Uint8Array,fault=new Error('actual packed record backing allocation fault');
 const close=PrivateBloomFilter.prototype.close,secondary=new Error('second cleanup diagnostic');
 let cleanupCalls=0;
 let witnessed,primary;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  // Serial source-owned control: release the real allocation before throwing.
  // This tests diagnostic precedence, not a destructor failing before release.
  if(secondaryCleanup)PrivateBloomFilter.prototype.close=function(){close.call(this);cleanupCalls++;throw secondary;};
  globalThis.Uint8Array=new Proxy(Native,{construct(target,args,newTarget){
   const current=privateAccounting(owner);
   if(!witnessed&&current.automaticInserts>0&&current.builds===0&&new Error().stack?.includes('at packRecord ')){
    witnessed=current;assert.ok(current.ownedBytes>0);assert.ok(current.packedPages>=2);throw fault;
   }
   return Reflect.construct(target,args,newTarget);
  }});
  try{await assert.rejects(owner.step(),error=>{primary=error;assert.equal(error,fault);return true;});}
  finally{globalThis.Uint8Array=Native;PrivateBloomFilter.prototype.close=close;}
  assert.equal(cleanupCalls,secondaryCleanup?1:0,'actual owned filter cleanup must run exactly once when instrumented');
  assert.ok(witnessed,'must fail actual MakeRecord allocation during partial build');
  assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
  assert.throws(()=>owner.reset(),error=>error===primary);
  const rows=[];while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
  assert.deepEqual(rows,expected.runs[0].rows);
  assert.deepEqual(Array.from({length:owner.columnCount},(_,i)=>owner.columnMetadata(i)),expected.columns);
  assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
  const remaining=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')remaining.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(remaining,expected.runs[0].rows);
  console.error(JSON.stringify({control:'actual-record-allocation-fault',secondaryCleanup,cleanupCalls,inserted:witnessed.automaticInserts,ownedBytes:witnessed.ownedBytes}));
 }finally{PrivateBloomFilter.prototype.close=close;globalThis.Uint8Array=Native;owner.finalize();survivor.finalize();}
}
