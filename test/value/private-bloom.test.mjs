import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {filterHash,PrivateBloomFilter} from '../../src/internal/private-bloom.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const control={async checkpoint(){}};
function integer(n){const m=new Mem();m.setInt64(n);return m}
// docs/research/where-autoindex-hash.c includes the actual pinned amalgamation.
test('native filterHash witnesses, numeric flags before cached Str and uint64 wrap',()=>{
 const m=new Mem();const u64=(1n<<64n)-1n;
 for(const [value,expected] of [[1.75,1n],[-1.75,u64],[1e300,(1n<<63n)-1n],[-1e300,1n<<63n],[1,1n],[-0,0n]]){
  m.setDouble(value);assert.equal(filterHash([m]),expected);
 }
 m.setIntReal(1n);assert.equal(filterHash([m]),1n);
 m.stringify('utf-8');assert.equal(filterHash([m]),1n,'cached string must not override numeric flags');
 m.setText(new TextEncoder().encode('anything'),'utf-8');assert.equal(filterHash([m]),4095n);
 m.setBlob(new Uint8Array([0,255]));assert.equal(filterHash([m]),4109n);
 m.setNull();assert.equal(filterHash([m]),0n);
 assert.equal(filterHash([integer(-1n),integer(2n)]),1n);
});
test('filter absent/collision and allocation H-1/H/H+1, interruption refunds and independent owners',async()=>{
 for(const extra of [-1,0,1]){
  const b=new PrivateStateByteBudget(10128+extra);
  if(extra<0){await assert.rejects(PrivateBloomFilter.open(b,10000,control));assert.equal(b.usedBytes,0);continue}
  const f=await PrivateBloomFilter.open(b,10000,control);
  assert.equal(b.usedBytes,10128);assert.equal(f.absent([integer(1n)]),true);
  f.add([integer(1n)]);assert.equal(f.absent([integer(1n)]),false);
  assert.equal(f.absent([integer(80001n)]),false,'collision falls through, never proves membership');
  assert.equal(f.absent([integer(17n)]),true);f.close();f.close();assert.equal(b.usedBytes,0);
  assert.throws(()=>f.add([integer(1n)]),/closed/);
 }
 const b=new PrivateStateByteBudget(100000),survivor=await PrivateBloomFilter.open(b,10000,control);
 survivor.add([integer(1n)]);
 for(const failAt of [1,2]){
  let calls=0;const primary=new Error('interrupted');
  await assert.rejects(PrivateBloomFilter.open(b,10000,{checkpoint(){if(++calls===failAt)throw primary}}),e=>e===primary);
  assert.equal(b.usedBytes,10128);assert.equal(survivor.absent([integer(1n)]),false);
 }
 survivor.close();assert.equal(b.usedBytes,0);
});
