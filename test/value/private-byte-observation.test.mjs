import test from 'node:test';
import assert from 'node:assert/strict';
import {PrivateStateByteBudget,PrivateStateLimitError} from '../../src/internal/private-state.ts';

test('shared byte owner records only successful transfers and preserves survivor',()=>{
 const a=new PrivateStateByteBudget(100),b=new PrivateStateByteBudget(100);
 b.reserve(19);const survivor=b.snapshot();
 assert.ok(a.ownerId>0);assert.notEqual(a.ownerId,b.ownerId);
 a.reserve(60);const retained=a.snapshot();assert.ok(Object.isFrozen(retained));
 assert.throws(()=>a.reserve(41),PrivateStateLimitError);assert.deepEqual(a.snapshot(),retained);
 assert.throws(()=>a.replace(10,51),PrivateStateLimitError);assert.deepEqual(a.snapshot(),retained);
 a.replace(30,50);a.release(80);
 assert.deepEqual(a.snapshot(),{payloadScratchBytes:0,payloadScratchHighwaterBytes:0,packedPages:0,packedPagesHighwater:0,highwaterEntries:0,highwaterKeyBytes:0,ownerId:a.ownerId,chargedBytes:110,refundedBytes:110,ownedBytes:0,highwaterBytes:80});
 assert.equal(retained.ownedBytes,60);assert.deepEqual(b.snapshot(),survivor);
 b.release(19);assert.equal(b.snapshot().ownedBytes,0);
});
