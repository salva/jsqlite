import assert from 'node:assert/strict';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {PrivateBlobkeyFormatError} from '../../src/internal/private-blobkey-pages.ts';
import {privateAccounting} from '../../test/conformance/public-api-adapter.mjs';
import {assertReleased} from './where-autoindex-contract.mjs';

// Retain allocator-owned backing only inside this serial fault control. Damage
// pointer arrays on all index backing pages before a selected probe; unselected
// page-one signature damage is not traversed. This is not an isolated child or
// unrelated-subtree witness (root metadata may already be cached).
export async function realCorruption(db,sql,expected,cell){
 const survivor=db.prepare(sql).statement,owner=db.prepare(sql).statement;
 const seek=PrivateKeyVmCursor.prototype.seekBound,Native=globalThis.Uint8Array;
 try{
  assert.equal(await survivor.step(),'row');const before=privateAccounting(survivor);
  for(const selected of [true,false]){
   let witnessed=false,primary;const backing=[];
   globalThis.Uint8Array=new Proxy(Native,{construct(target,args,newTarget){
    const result=Reflect.construct(target,args,newTarget);
    if(args[0]===4096&&new Error().stack?.includes('at #append '))backing.push(result);
    return result;
   }});
   PrivateKeyVmCursor.prototype.seekBound=function(...args){
    if(!witnessed){
     witnessed=true;const work=privateAccounting(owner);
     assert.equal(work.builds,1);assert.equal(work.automaticInserts,128);assert.ok(work.packedPages>=2);
     assert.ok(backing.length>=2);
     if(selected){for(const page of backing.slice(1))for(let i=8;i<512;i++)page[i]=0xff;}else backing[0][0]=0;
    }
    return seek.apply(this,args);
   };
   const rows=[];
   try{
    if(selected)await assert.rejects(owner.step(),error=>{primary=error;assert.ok(error instanceof PrivateBlobkeyFormatError);return true;});
    else while(await owner.step()==='row')rows.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
   }finally{PrivateKeyVmCursor.prototype.seekBound=seek;globalThis.Uint8Array=Native;}
   assert.ok(witnessed);if(!selected)assert.deepEqual(rows,expected.runs[0].rows);
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));
   if(selected)assert.throws(()=>owner.reset(),error=>error===primary);else owner.reset();
   const retry=[];while(await owner.step()==='row')retry.push(Array.from({length:owner.columnCount},(_,i)=>cell(owner,i)));
   assert.deepEqual(retry,expected.runs[0].rows);
   assert.deepEqual(Array.from({length:owner.columnCount},(_,i)=>owner.columnMetadata(i)),expected.columns);
   assertReleased(privateAccounting(owner),before,privateAccounting(survivor));owner.reset();
   console.error(JSON.stringify({control:'actual-packed-corruption',selected}));
  }
  const remaining=[Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i))];
  while(await survivor.step()==='row')remaining.push(Array.from({length:survivor.columnCount},(_,i)=>cell(survivor,i)));
  assert.deepEqual(remaining,expected.runs[0].rows);
 }finally{PrivateKeyVmCursor.prototype.seekBound=seek;globalThis.Uint8Array=Native;owner.finalize();survivor.finalize();}
}
