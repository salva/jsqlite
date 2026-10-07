import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../../src/internal/schema.ts';
import {decodeRecord} from '../../../src/internal/record.ts';
const root=new URL('./',import.meta.url), capture=JSON.parse(fs.readFileSync(new URL('first-native.json',root)));
for(const v of capture.variants){
 test(`${v.encoding}: analyze9-1.2 raw sample assertions (harness adaptation only)`,()=>{
  const samples=v.samples.filter(s=>s.idx==='ti');assert.equal(samples.length,5);
  for(let i=0;i<5;i++){
   assert.deepEqual(samples[i].counts,[['1','1','1'],[String(i),String(i),String(i)],[String(i),String(i),String(i)]]);
   const record=decodeRecord(Uint8Array.from(Buffer.from(samples[i].hex,'hex')),v.encoding.toLowerCase());
   assert.deepEqual(record.values.map(v=>v.storageClass==='text'?new TextDecoder(v.encoding).decode(v.bytes):v.value),[`(${i})`,`(${i})`,BigInt(i+1)]);
  }
 });
 test(`${v.encoding}: shared Index sample owner acceptance BEFORE consuming code`,()=>{
  const bytes=fs.readFileSync(new URL(v.fixture,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
  const owner=ImmutableStorage.open(new Uint8Array(bytes));
  try{
   const carrier={[storageOwner]:owner},schema=loadSchemaGraph(carrier),index=schema.indexes.get('ab');
   assert.equal(loadSchemaGraph(carrier),schema,'cache identity');
   assert.ok(index.stat4,'proposed source-owned Index.stat4 is absent: expected current red');
   assert.equal(index.stat4.nSampleCol,3);
   const expected=v.samples.filter(s=>s.idx==='ab');assert.equal(index.stat4.nSample,expected.length);
   assert.equal(index.stat4.samples.length,expected.length);
   expected.forEach((s,i)=>{
    const a=index.stat4.samples[i];assert.equal(a.n,s.hex.length/2);
    assert.equal(Buffer.from(a.p.subarray(0,a.n)).toString('hex'),s.hex);
    assert.deepEqual([...a.p.subarray(a.n)],Array(8).fill(0));
    assert.deepEqual(a.anEq,s.counts[0].map(BigInt));assert.deepEqual(a.anLt,s.counts[1].map(BigInt));assert.deepEqual(a.anDLt,s.counts[2].map(BigInt));
   });
  }finally{owner.close();}
 });
}
