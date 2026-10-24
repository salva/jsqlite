import assert from 'node:assert/strict';
import {VdbeHostAdmission} from '../../src/internal/vdbe-host-admission.ts';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased} from './where-autoindex-contract.mjs';

// Source-owned, serial research control at the existing host admission seam.
// No production option/registry; restore both transport and clock even on error.
export async function realProgressInterrupt(db,sql,expected,cell){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  for(const phase of ['build','probe'])for(const kind of ['cancelled','timeout']){
   const controller=new AbortController(),checkpoint=VdbeHostAdmission.prototype.checkpoint,now=Date.now;
   let witnessed=null,expired=false,primary;
   VdbeHostAdmission.prototype.checkpoint=function(){
    const current=privateAccounting(owner);
    const ready=phase==='build'?current.automaticInserts>0&&current.builds===0:current.builds===1&&current.probes>0;
    if(!witnessed&&ready){
     witnessed=current;
     assert.ok(current.ownedBytes>0);assert.ok(current.openCursors>0);
     assert.ok(current.filterBytes>0);assert.equal(current.onceActive,true);
     if(kind==='cancelled')controller.abort('confirmed '+phase+' progress');else expired=true;
    }
    return checkpoint.call(this);
   };
   Date.now=()=>now()+(expired?1_000_000:0);
   try{
    await assert.rejects(owner.step(kind==='cancelled'?{signal:controller.signal}:{timeoutMs:500000}),error=>{
     primary=error;assert.equal(error.kind,kind);
     assert.equal(error.message,kind==='cancelled'?'statement execution was cancelled':'statement execution timed out');
     if(kind==='cancelled')assert.equal(error.cause,'confirmed '+phase+' progress');
     return true;
    });
   }finally{VdbeHostAdmission.prototype.checkpoint=checkpoint;Date.now=now;}
   assert.ok(witnessed,'must interrupt inside '+phase+' after actual progress, not before whole query');
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   assert.throws(()=>owner.reset(),error=>error===primary);
   const rows=[];while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
   assert.deepEqual(rows,expected.runs[0].rows);
   assert.deepEqual(Array.from({length:owner.columnCount},(_,i)=>owner.columnMetadata(i)),expected.columns);
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   owner.reset();
   console.error(JSON.stringify({control:'actual-inflight-interrupt',phase,kind,inserted:witnessed.automaticInserts,probes:witnessed.probes}));
  }
  const rows=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')rows.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(rows,expected.runs[0].rows);
 }finally{owner.finalize();survivor.finalize();}
}
