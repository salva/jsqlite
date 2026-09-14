import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
import {EphemeralIndexCursor,PrivateStateLimitError,SorterCursor} from '../../src/internal/private-state.ts';
const m=n=>{const x=new Mem();n===null?x.setNull():x.setInt64(BigInt(n));return x};
const text=value=>{const x=new Mem();x.setText(new TextEncoder().encode(value),'utf-8');return x};
test('typed sorter is stable, bounded, and resumable at comparison checkpoints',async()=>{const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),s=new SorterCursor(info,{maxEntries:3,maxKeyBytes:8,maxBytes:48});s.insert([m(2)],[m(20)]);s.insert([m(1)],[m(10)]);s.insert([m(1)],[m(11)]);let checks=0;await s.sort({async checkpoint(){checks++;await Promise.resolve()}});const out=[];for(let ok=s.first();ok;ok=s.next())out.push(s.data()[0].integerValue());assert.deepEqual(out,[10n,11n,20n]);assert.ok(checks>0);assert.throws(()=>s.insert([m(4)],[m(4)]),PrivateStateLimitError);s.close();s.close()});
test('ephemeral index uses Mem equality including NULL and enforces entry limit',async()=>{const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]}),e=new EphemeralIndexCursor(info,{maxEntries:1,maxKeyBytes:8,maxBytes:8}),control={async checkpoint(){}};e.insert([m(null)]);assert.equal(await e.found([m(null)],control),true);assert.throws(()=>e.insert([m(1)]),PrivateStateLimitError);e.close();e.close()});

test('private cursors enforce key and aggregate logical-byte limits atomically',async()=>{
 const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
 const keyBounded=new SorterCursor(info,{maxEntries:1,maxKeyBytes:2,maxBytes:100});
 assert.throws(()=>keyBounded.insert([text('abc')],[]),/sorter key exceeds byte limit/);
 // Rejection consumes neither the sole entry nor its byte budget.
 keyBounded.insert([text('ab')],[]);
 await keyBounded.sort({async checkpoint(){}});
 assert.equal(keyBounded.first(),true);
 keyBounded.close();

 const totalBounded=new SorterCursor(info,{maxEntries:1,maxKeyBytes:4,maxBytes:3});
 assert.throws(()=>totalBounded.insert([text('ab')],[text('cd')]),/sorter exceeds total byte limit/);
 totalBounded.insert([text('ab')],[text('c')]);
 await totalBounded.sort({async checkpoint(){}});
 assert.equal(totalBounded.first(),true);
 assert.equal(totalBounded.data()[0].textValue(),'c');
 totalBounded.close();

 const ephemeral=new EphemeralIndexCursor(info,{maxEntries:1,maxKeyBytes:4,maxBytes:2});
 assert.throws(()=>ephemeral.insert([text('abc')]),/ephemeral index exceeds total byte limit/);
 ephemeral.insert([text('ab')]);
 assert.equal(await ephemeral.found([text('ab')],{async checkpoint(){}}),true);
 ephemeral.close();
});
