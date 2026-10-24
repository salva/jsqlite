import assert from 'node:assert/strict';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {PrivateStateLimitError} from '../../src/internal/private-state.ts';
import {assertRuntimeWork,assertReleased} from './where-autoindex-contract.mjs';

// Public open limits, real same-execution VM consumers; no budget substitute.
export async function realByteCapacity(open,db,sql,expected,cell,workExpected,limitMessage){
 const survivor=db.prepare(sql).statement,measure=db.prepare(sql).statement;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  while(await measure.step()==='row'){}
  const measured=privateAccounting(measure);
  for(const [dimension,field,message] of [['maxPrivateBytes','highwaterBytes',limitMessage.bytes],['maxPrivateEntries','highwaterEntries',limitMessage.entries],['maxPrivateKeyBytes','highwaterKeyBytes',limitMessage.key]]){
  const H=measured[field];assert.ok(H>1);
  console.error(JSON.stringify({control:'actual-capacity',dimension,H,capacities:[H-1,H,H+1]}));
  for(const cap of [H-1,H,H+1]){
   const limited=await open({maxPrivateBytes:100000000,maxPrivateEntries:100000,maxPrivateKeyBytes:1000000,[dimension]:cap});
   const statement=limited.prepare(sql).statement;let failed=false;
   try{
    const rows=[];
    if(cap<H){
     let primary;try{await statement.step();assert.fail('below-boundary query published a row or DONE');}catch(error){assert.equal(error.kind,'limit');assert.ok(error.cause instanceof PrivateStateLimitError);assert.equal(error.message,message);primary=error;failed=true;}
     assertReleased(privateAccounting(statement),before,privateAccounting(survivor));
     assert.throws(()=>statement.reset(),error=>error===primary);
    }else{
     while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,i)=>cell(statement,i)));
     assert.deepEqual(rows,expected.runs[0].rows);
     assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.columnMetadata(i)),expected.columns);
     const result=privateAccounting(statement);assert.equal(result[field],H);if(typeof workExpected==='function')workExpected(result);else assertRuntimeWork(result,workExpected);
     assertReleased(result,before,privateAccounting(survivor));
    }
   }finally{statement.finalize();limited.closeDeferred();}
   assert.equal(failed,cap<H);
  }
  }
  const rows=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')rows.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(rows,expected.runs[0].rows);
 }finally{measure.finalize();survivor.finalize();}
}
