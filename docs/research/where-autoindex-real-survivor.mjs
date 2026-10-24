import assert from 'node:assert/strict';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased,assertRuntimeWork} from './where-autoindex-contract.mjs';

// Real public statements, independently positioned on the same immutable DB.
// Expectations belong to the native receipt caller, not this observation seam.
export async function realDeferredSurvivor(open,sql,expected,cell,workExpected){
 const db=await open();
 let completed=false;
 try{await realSurvivor(db,sql,expected,cell,workExpected,{deferredClose:true});completed=true;}
 finally{if(!completed){try{db.closeDeferred();}catch{/* Preserve failed assertion; driver finalized both owned statements. */}}}
}

export async function realSurvivor(db,sql,expected,cell,workExpected,{deferredClose=false,parameterBinding}={}){
 // Native LIMIT -1 preserves the complete independently captured result.
 const ownerSql=parameterBinding===undefined?`${sql.replace(/;\s*$/,'')} LIMIT ?1`:sql;
 const binding=parameterBinding??-1n;
 const prepareOwner=()=>{const s=db.prepare(ownerSql).statement;s.bind(1,binding);return s;};
 const survivor=db.prepare(sql).statement;if(parameterBinding!==undefined)survivor.bind(1,binding);
 let owner=prepareOwner(),ownerFinalized=false;
 try{
  const columns=s=>Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
  assert.deepEqual(columns(owner),expected.columns);assert.deepEqual(columns(survivor),expected.columns);
  assert.equal(await survivor.step(),'row');
  const survivorRows=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  const before=privateAccounting(survivor);
  assert.ok(before.openCursors>0);assert.ok(before.filterBytes>0);assert.equal(before.onceActive,true);
  assert.throws(()=>db.close(),error=>error.kind==='sqlite'&&error.code===5&&error.message==='unable to close due to unfinalized statements');
  assert.deepEqual(privateAccounting(survivor),before,'legacy busy close must not destroy the live survivor');
  const executions=new Set();
  for(const exit of ['done','reset','rebind','cancel','timeout','cancel-finalize','timeout-finalize','finalize']){
   assert.equal(await owner.step(),'row');
   const live=privateAccounting(owner);assert.ok(live.openCursors>0);assert.ok(live.filterBytes>0);assert.equal(live.onceActive,true);
   assert.notEqual(live.ownerId,before.ownerId);
   assert.ok(live.ownedBytes>0);assert.ok(before.ownedBytes>0,'distinct owners simultaneously retain live resources');
   assert.ok(live.executionId);assert.ok(!executions.has(live.executionId),'new entry has a fresh execution identity');executions.add(live.executionId);
   if(exit==='done'){
    const rows=[Array.from({length:owner.columnCount},(_,i)=>cell(owner,i))];
    while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
    assert.deepEqual(rows,expected.runs[0].rows);if(typeof workExpected==='function')workExpected(privateAccounting(owner));else assertRuntimeWork(privateAccounting(owner),workExpected);
   }else if(exit.startsWith('cancel')||exit.startsWith('timeout')){
    // Build and at least one Filter probe completed before interruption.
    if(live.planKind==='standalone-bloom'){assert.ok(live.filterAdds>0);assert.ok(live.probes>0);}else{assert.equal(live.builds,1);assert.ok(live.probes>0);}
    const controller=new AbortController();controller.abort('real survivor control');
    const cancelled=exit.startsWith('cancel');
    const kind=cancelled?'cancelled':'timeout';
    const message=cancelled?'statement execution was cancelled':'statement execution timed out';
    let primary;try{await owner.step(cancelled?{signal:controller.signal}:{timeoutMs:0});assert.fail('interruption accepted');}catch(error){primary=error;assert.equal(error.kind,kind);assert.equal(error.message,message);}
    assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
    await assert.rejects(owner.step(),error=>error===primary,'step retains saved first error');
    if(exit.endsWith('-finalize')){
     assert.throws(()=>owner.finalize(),error=>error===primary,'finalize returns saved first error after disposal');
     ownerFinalized=true;
     assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
    }else{
     assert.throws(()=>owner.reset(),error=>error===primary,'reset returns saved first error');
     owner.reset(); // Saved error was consumed; repeated reset is harmless.
    }
   }else if(exit==='rebind'){
    owner.reset();assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
    if(parameterBinding!==undefined){
     // prepare.c:sqlite3Reprepare returns before swap on construction failure.
     // One successful compile check consumes the work unit; a later check
     // fails inside construction, not at entry or after replacement dispatch.
     for(const cleanup of ['reset','finalize']){
      assert.equal(await owner.step(),'row');
      const retainedPlan=privateAccounting(owner).planId;
      owner.reset();assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
      owner.bind(1,binding);
      const retained=privateAccounting(owner);let checks=0,primary;
      const signal={get aborted(){checks++;return false;}};
      try{await owner.step({maxWorkUnits:1,signal});assert.fail('replacement construction accepted');}
      catch(error){primary=error;assert.equal(error.kind,'limit');assert.equal(error.message,'statement exceeds maxWorkUnits');}
      assert.ok(checks>=2,'construction progressed past its initial successful check');
      assert.match(primary.stack,/planWhereInvocation/,'failure originates in actual replacement planning');
      const failed=privateAccounting(owner);
      assert.equal(failed.planId,retainedPlan,'failed replacement is not published');
      assert.notEqual(failed.executionId,retained.executionId);
      assert.equal(failed.filterAdds,0);assert.equal(failed.probes,0);
      for(const field of ['ownedBytes','openCursors','filterBytes','packedPages','payloadScratchBytes'])assert.equal(failed[field],0,field);
      assert.equal(failed.onceActive,false);
      assert.equal(failed.chargedBytes,failed.refundedBytes);
      assert.notEqual(failed.ownerId,before.ownerId);
      assert.deepEqual(privateAccounting(survivor),before);
      await assert.rejects(owner.step(),error=>error===primary);
      if(cleanup==='reset'){
       assert.throws(()=>owner.reset(),error=>error===primary);owner.reset();
      }else{
       assert.throws(()=>owner.finalize(),error=>error===primary);ownerFinalized=true;
       assert.deepEqual(privateAccounting(owner),failed,'finalize retains failed-entry accounting');
       assert.deepEqual(privateAccounting(survivor),before);
       owner=prepareOwner();ownerFinalized=false;
      }
     }
    }
    owner.bind(1,binding);
    const rows=[];
    while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
    assert.deepEqual(rows,expected.runs[0].rows);
    const rebound=privateAccounting(owner);
    assert.notEqual(rebound.executionId,live.executionId);
    if(parameterBinding===undefined)assert.equal(rebound.planId,live.planId,'non-sensitive LIMIT rebind retains program');
    else assert.notEqual(rebound.planId,live.planId,'sensitive binding must replace actual consumer program');
    if(typeof workExpected==='function')workExpected(rebound);else assertRuntimeWork(rebound,workExpected);
    owner.reset();
   }else if(exit==='reset')owner.reset();else {
    if(deferredClose){
     db.closeDeferred();
     assert.deepEqual(privateAccounting(owner),live,'zombie close preserves owner');
     assert.deepEqual(privateAccounting(survivor),before,'zombie close preserves survivor');
     assert.throws(()=>db.prepare(sql),error=>error.kind==='misuse');
    }
    owner.finalize();ownerFinalized=true;
   }
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   if(exit==='done')owner.reset();
   if(ownerFinalized&&exit!=='finalize'){owner=prepareOwner();ownerFinalized=false;}
  }
  while(await survivor.step()==='row')survivorRows.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(survivorRows,expected.runs[0].rows);
  assert.equal(privateAccounting(survivor).ownedBytes,0);
 }catch(error){try{owner.reset();}catch{/* Consume saved execution error without masking the assertion. */}throw error;}
 finally{try{if(!ownerFinalized)owner.finalize();}finally{survivor.finalize();}}
}
