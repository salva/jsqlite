import assert from 'node:assert/strict';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased,assertRuntimeWork} from './where-autoindex-contract.mjs';

// Real public statements, independently positioned on the same immutable DB.
// Expectations belong to the native receipt caller, not this observation seam.
export async function realSurvivor(db,sql,expected,cell,workExpected){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;let ownerFinalized=false;
 try{
  const columns=s=>Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
  assert.deepEqual(columns(owner),expected.columns);assert.deepEqual(columns(survivor),expected.columns);
  assert.equal(await survivor.step(),'row');
  const survivorRows=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  const before=privateAccounting(survivor);
  assert.ok(before.openCursors>0);assert.ok(before.filterBytes>0);assert.equal(before.onceActive,true);
  for(const exit of ['done','reset','cancel','timeout','finalize']){
   assert.equal(await owner.step(),'row');
   const live=privateAccounting(owner);assert.ok(live.openCursors>0);assert.ok(live.filterBytes>0);assert.equal(live.onceActive,true);
   assert.notEqual(live.ownerId,before.ownerId);
   if(exit==='done'){
    const rows=[Array.from({length:owner.columnCount},(_,i)=>cell(owner,i))];
    while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
    assert.deepEqual(rows,expected.runs[0].rows);if(typeof workExpected==='function')workExpected(privateAccounting(owner));else assertRuntimeWork(privateAccounting(owner),workExpected);
   }else if(exit==='cancel'||exit==='timeout'){
    // Build and at least one Filter probe completed before interruption.
    if(live.planKind==='standalone-bloom'){assert.ok(live.filterAdds>0);assert.ok(live.probes>0);}else{assert.equal(live.builds,1);assert.ok(live.probes>0);}
    const controller=new AbortController();controller.abort('real survivor control');
    const kind=exit==='cancel'?'cancelled':'timeout';
    const message=exit==='cancel'?'statement execution was cancelled':'statement execution timed out';
    let primary;try{await owner.step(exit==='cancel'?{signal:controller.signal}:{timeoutMs:0});assert.fail('interruption accepted');}catch(error){primary=error;assert.equal(error.kind,kind);assert.equal(error.message,message);}
    assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
    assert.throws(()=>owner.reset(),error=>error===primary,'reset returns saved first error');
   }else if(exit==='reset')owner.reset();else {owner.finalize();ownerFinalized=true;}
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   if(exit==='done')owner.reset();
  }
  while(await survivor.step()==='row')survivorRows.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(survivorRows,expected.runs[0].rows);
  assert.equal(privateAccounting(survivor).ownedBytes,0);
 }finally{if(!ownerFinalized)owner.finalize();survivor.finalize();}
}
