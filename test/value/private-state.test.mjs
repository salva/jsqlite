import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
import {EphemeralIndexCursor,PrivateStateLimitError,SorterCursor} from '../../src/internal/private-state.ts';
const m=n=>{const x=new Mem();n===null?x.setNull():x.setInt64(BigInt(n));return x};
test('typed sorter is stable, bounded, and resumable at comparison checkpoints',async()=>{const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),s=new SorterCursor(info,{maxEntries:3,maxKeyBytes:8,maxBytes:48});s.insert([m(2)],[m(20)]);s.insert([m(1)],[m(10)]);s.insert([m(1)],[m(11)]);let checks=0;await s.sort({async checkpoint(){checks++;await Promise.resolve()}});const out=[];for(let ok=s.first();ok;ok=s.next())out.push(s.data()[0].integerValue());assert.deepEqual(out,[10n,11n,20n]);assert.ok(checks>0);assert.throws(()=>s.insert([m(4)],[m(4)]),PrivateStateLimitError);s.close();s.close()});
test('ephemeral index uses Mem equality including NULL and enforces entry limit',async()=>{const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),e=new EphemeralIndexCursor(info,{maxEntries:1,maxKeyBytes:8,maxBytes:8}),control={async checkpoint(){}};e.insert([m(null)]);assert.equal(await e.found([m(null)],control),true);assert.throws(()=>e.insert([m(1)]),PrivateStateLimitError);e.close();e.close()});
