import assert from 'node:assert/strict';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased} from './where-autoindex-contract.mjs';

// Inject through the existing arena-owned page hook, not substituted SQL results.
export async function realPageFault(db,sql,expected,cell){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;
 const open=PrivateBlobkeyPages.open;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  const fault=new Error('actual private second-page allocation fault');let allocated=0,primary;
  PrivateBlobkeyPages.open=function(budget,control,hook,limits){
   return open.call(this,budget,control,(event,pgno,bytes)=>{
    hook?.(event,pgno,bytes);
    if(event==='allocate'&&++allocated===2){
     assert.ok(budget.usedBytes>0,'first page and arena must already be owned');throw fault;
    }
   },limits);
  };
  try{await assert.rejects(owner.step(),error=>{primary=error;assert.equal(error,fault);return true;});}
  finally{PrivateBlobkeyPages.open=open;}
  assert.equal(allocated,2);assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
  assert.throws(()=>owner.reset(),error=>error===primary);
  const rows=[];while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
  assert.deepEqual(rows,expected.runs[0].rows);assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
  const remaining=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')remaining.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(remaining,expected.runs[0].rows);
  console.error(JSON.stringify({control:'actual-partial-arena-fault',allocated}));
 }finally{PrivateBlobkeyPages.open=open;owner.finalize();survivor.finalize();}
}
