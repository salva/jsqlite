import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateKeyVmCursor} from '../../src/internal/private-key-vm.ts';
import {KeyInfo,UnpackedRecordKey} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
const control={async checkpoint(){}};
function owner(primitive,arena={async clearTable(){},close(){}}){return new PrivateKeyVmCursor(arena,primitive,info)}
// Direct branch fixtures mirror vdbe.c Found error/success and IdxInsert ordering;
// public internal VM programs retain real page-owned regression coverage.
test('Found publishes signed seek, equality nullRow and cache only on success',async()=>{
  const value=new Mem();value.setInt64(7n);const key=new UnpackedRecordKey([value],0,'seek',info);
  let res=0,fail=false;const error=new Error('seek');
  const cursor=owner({async indexMoveto(){if(fail)throw error;return {res,state:res===1?'INVALID':'VALID'}},close(){}});
  try{for(const n of [0,-1,1]){res=n;cursor.cacheStale=false;cursor.deferredMoveto=true;await cursor.seek(key,control);assert.equal(cursor.seekResult,n);assert.equal(cursor.nullRow,n!==0);assert.equal(cursor.cacheStale,true);assert.equal(cursor.deferredMoveto,false)}
    cursor.cacheStale=false;cursor.deferredMoveto=true;fail=true;await assert.rejects(cursor.seek(key,control),e=>e===error);assert.equal(cursor.cacheStale,false);assert.equal(cursor.deferredMoveto,true);assert.equal(cursor.seekResult,1);
  }finally{key.release();value.release()}
});
test('IdxInsert stales cache after primitive error and preserves primary collision ownership',async()=>{
  const primary=new Error('insert'),cleanup=new Error('close');let calls=0;
  const cursor=owner({async insertIndex(bytes,options){calls++;assert.deepEqual(Array.from(bytes),[2,1,7]);assert.deepEqual(options,{});throw primary},close(){throw cleanup}});
  cursor.cacheStale=false;await assert.rejects(cursor.insert(new Uint8Array([2,1,7]),control),e=>e===primary);assert.equal(calls,1);assert.equal(cursor.cacheStale,true);assert.throws(()=>cursor.close(),e=>e===cleanup);
});
test('reuse clears same arena, stales before failure, and does not reset seek/deferred state',async()=>{
  let fail=false,closes=0;const error=new Error('clear');const cursor=owner({close(){closes++}},{async clearTable(){if(fail)throw error}});
  cursor.nullRow=false;cursor.seekResult=-1;cursor.deferredMoveto=true;cursor.cacheStale=false;fail=true;
  await assert.rejects(cursor.reuse(control),e=>e===error);assert.equal(cursor.cacheStale,true);assert.equal(cursor.nullRow,false);assert.equal(closes,0);
  fail=false;await cursor.reuse(control);assert.equal(cursor.nullRow,true);assert.equal(cursor.seekResult,-1);assert.equal(cursor.deferredMoveto,true);cursor.close();assert.equal(closes,1);
});
