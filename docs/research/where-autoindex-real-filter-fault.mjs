import assert from 'node:assert/strict';
import {PrivateBloomFilter} from '../../src/internal/private-bloom.ts';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased} from './where-autoindex-contract.mjs';

export async function realFilterFault(db,sql,expected,cell){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;
 const open=PrivateBloomFilter.open;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  const fault=new Error('actual private filter initialization fault');let witnessed=false,primary;
  PrivateBloomFilter.open=function(budget,length,control){
   const prior=budget.usedBytes;
   return open.call(this,budget,length,{...control,checkpoint(units){
    if(!witnessed){witnessed=true;assert.equal(budget.usedBytes,prior+length+128);throw fault;}
    return control.checkpoint(units);
   }});
  };
  try{await assert.rejects(owner.step(),error=>{primary=error;assert.equal(error,fault);return true;});}
  finally{PrivateBloomFilter.open=open;}
  assert.ok(witnessed);assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
  assert.throws(()=>owner.reset(),error=>error===primary);
  const rows=[];while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
  assert.deepEqual(rows,expected.runs[0].rows);assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
  const remaining=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')remaining.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(remaining,expected.runs[0].rows);
  console.error(JSON.stringify({control:'actual-filter-init-fault',witnessed}));
 }finally{PrivateBloomFilter.open=open;owner.finalize();survivor.finalize();}
}
