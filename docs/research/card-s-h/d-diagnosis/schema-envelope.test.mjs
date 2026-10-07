import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ImmutableStorage,StorageClosedError} from '../../../../src/internal/storage.ts';

// Internal logical allocation adaptation, not native malloc parity or a public
// cursor-work limit. Probe ownership/free maps to vdbemem.c Stat4ProbeFree.
const bytes=fs.readFileSync(new URL('../UTF-8.db',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'36fc2f1ca53b323ce3553f79a120c3c9401fcbd5073a9788c8fbdf7f1d1a457e');
for(const acquisition of [bytes.length,bytes.length*2,Number.MAX_SAFE_INTEGER]){
 test(`schema envelope derives acquisition allowance ${acquisition} and conserves ownership at exact boundary`,()=>{
  const db=ImmutableStorage.open(new Uint8Array(bytes),acquisition);
  let closed=false;
  try{
   const expected=BigInt(acquisition)*2097152n;
   assert.equal(db.schemaAllowance,Number(expected>BigInt(Number.MAX_SAFE_INTEGER)?BigInt(Number.MAX_SAFE_INTEGER):expected));
   let cleanups=0;
   db.publishSchema(17,()=>{cleanups++});
   const available=db.schemaAllowance-17;
   const release=db.reserveSchemaTemporary(available);
   assert.equal(db.schemaTemporaryBytes,available);
   for(const invalid of [1,-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    assert.throws(()=>db.reserveSchemaTemporary(invalid),RangeError);
    assert.equal(db.schemaTemporaryBytes,available);
    assert.equal(db.schemaBytes,17);
   }
   assert.throws(()=>db.publishSchema(18,()=>{throw new Error('unpublished cleanup')}),RangeError);
   const zero=db.reserveSchemaTemporary(0);zero();zero();
   release();release();assert.equal(db.schemaTemporaryBytes,0);
   const retry=db.reserveSchemaTemporary(available);retry();
   db.close();closed=true;assert.equal(cleanups,1);assert.equal(db.schemaBytes,0);
   assert.throws(()=>db.reserveSchemaTemporary(0),StorageClosedError);
   release();assert.equal(db.schemaTemporaryBytes,0);
  }finally{if(!closed)db.close();}
 });
}
