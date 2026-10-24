import assert from 'node:assert/strict';
import {VdbeHostAdmission} from '../../src/internal/vdbe-host-admission.ts';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {PrivateBloomFilter} from '../../src/internal/private-bloom.ts';
import {assertReleased} from './where-autoindex-contract.mjs';

// Source-owned, serial research control at the existing host admission seam.
// No production option/registry; restore both transport and clock even on error.
export async function realProgressInterrupt(db,sql,expected,cell,{targetFilter=0}={}){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  for(const phase of ['build','probe'])for(const kind of ['cancelled','timeout']){
   const controller=new AbortController(),checkpoint=VdbeHostAdmission.prototype.checkpoint,now=Date.now;
   let witnessed=null,expired=false,primary;
   const open=PrivateBloomFilter.open,add=PrivateBloomFilter.prototype.add,absent=PrivateBloomFilter.prototype.absent;
   const ids=new Map();let selectedAdds=0,selectedProbes=0;
   PrivateBloomFilter.open=async function(...args){const filter=await open.apply(this,args);ids.set(filter,ids.size+1);return filter;};
   PrivateBloomFilter.prototype.add=function(values){const result=add.call(this,values);if(ids.get(this)===targetFilter)selectedAdds++;return result;};
   PrivateBloomFilter.prototype.absent=function(values){const result=absent.call(this,values);if(ids.get(this)===targetFilter)selectedProbes++;return result;};
   VdbeHostAdmission.prototype.checkpoint=function(){
    const current=privateAccounting(owner);
    const standalone=current.planKind==='standalone-bloom';
    const ready=standalone?(phase==='build'?current.filterAdds>0&&current.probes===0:current.filterAdds>0&&current.probes>0):(phase==='build'?current.automaticInserts>0&&current.builds===0:current.builds===1&&current.probes>0);
    const selectedReady=!targetFilter||(phase==='build'?selectedAdds>0&&selectedProbes===0:selectedAdds>0&&selectedProbes>0);
    if(!witnessed&&(targetFilter?selectedReady:ready)){
     witnessed=current;
     assert.ok(current.ownedBytes>0);assert.ok(current.openCursors>0);
     assert.ok(current.filterBytes>0);assert.equal(current.onceActive,true);
     if(!standalone){assert.ok(current.packedPages>=2);assert.ok(current.packedPagesHighwater>=current.packedPages);}
     if(kind==='cancelled')controller.abort('confirmed '+phase+' progress');else expired=true;
    }
    return checkpoint.call(this);
   };
   Date.now=()=>now()+(expired?1_000_000:0);
   try{
    await assert.rejects(async()=>{while(await owner.step(kind==='cancelled'?{signal:controller.signal}:{timeoutMs:500000})==='row'){}},error=>{
     primary=error;assert.equal(error.kind,kind);
     assert.equal(error.message,kind==='cancelled'?'statement execution was cancelled':'statement execution timed out');
     if(kind==='cancelled')assert.equal(error.cause,'confirmed '+phase+' progress');
     return true;
    });
   }finally{VdbeHostAdmission.prototype.checkpoint=checkpoint;Date.now=now;PrivateBloomFilter.open=open;PrivateBloomFilter.prototype.add=add;PrivateBloomFilter.prototype.absent=absent;}
   assert.ok(witnessed,'must interrupt inside '+phase+' after actual progress, not before whole query');
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   assert.throws(()=>owner.reset(),error=>error===primary);
   const rows=[];while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
   assert.deepEqual(rows,expected.runs[0].rows);
   assert.deepEqual(Array.from({length:owner.columnCount},(_,i)=>owner.columnMetadata(i)),expected.columns);
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   owner.reset();
   console.error(JSON.stringify({control:'actual-inflight-interrupt',phase,kind,targetFilter,selectedAdds,selectedProbes,inserted:witnessed.automaticInserts,probes:witnessed.probes}));
  }
  const rows=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')rows.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(rows,expected.runs[0].rows);
 }finally{owner.finalize();survivor.finalize();}
}
