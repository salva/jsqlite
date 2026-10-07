import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
const fixture=new URL('../../docs/research/card-s-h/UTF-8.db',import.meta.url);
test('low internal schema envelope failure leaves no cache, same-handle retry and close release',()=>{
 const owner=ImmutableStorage.open(fs.readFileSync(fixture));const carrier={[storageOwner]:owner};
 try{
  assert.throws(()=>loadSchemaGraph(carrier,{maxStat4Bytes:1}),/statistics allocation/);
  assert.equal(owner.schemaBytes,0);
  const graph=loadSchemaGraph(carrier);assert.ok(graph.indexes.get('ab').stat4);assert.ok(owner.schemaBytes>0);
  assert.equal(loadSchemaGraph(carrier),graph);owner.close();assert.equal(owner.schemaBytes,0);
 }finally{if(!owner.closed)owner.close()}
});
test('pass failures preserve primary error, unpublished bytes and retry on same owner',()=>{
 for(const phase of ['count','capacity','load','copy','finalize']){
  const owner=ImmutableStorage.open(fs.readFileSync(fixture)),carrier={[storageOwner]:owner},primary=new Error(phase);let calls=0;
  try{
   assert.throws(()=>loadSchemaGraph(carrier,{check:p=>{if(p===phase&&++calls===2)throw primary;if(p==='finalize'&&phase==='finalize')throw primary}}),e=>e===primary);
   assert.equal(owner.schemaBytes,0);assert.ok(loadSchemaGraph(carrier).indexes.get('ab').stat4);
  }finally{owner.close()}assert.equal(owner.schemaBytes,0);
 }
});
test('no stat1 still loads samples, WITHOUT ROWID aliases do not merge capacities',()=>{
 for(const suffix of ['no-stat1','wr-alias']){
  const owner=ImmutableStorage.open(fs.readFileSync(new URL(`../../docs/research/card-s-h/edge-UTF-8-${suffix}.db`,import.meta.url)));
  try{const graph=loadSchemaGraph({[storageOwner]:owner});assert.ok([...graph.indexes.values()].some(i=>i.stat4?.nSample>0));}
  finally{owner.close()}
 }
});
test('close during construction prevents publication and keeps primary failure',()=>{
 const owner=ImmutableStorage.open(fs.readFileSync(fixture));const primary=new Error('closed during copy');
 assert.throws(()=>loadSchemaGraph({[storageOwner]:owner},{check:p=>{if(p==='copy'){owner.close();throw primary}}}),e=>e===primary);
 assert.equal(owner.schemaBytes,0);assert.equal(owner.closed,true);
});
test('schema sample bytes are privately owned, published count arrays are frozen',()=>{
 const owner=ImmutableStorage.open(fs.readFileSync(fixture));
 try{const sample=loadSchemaGraph({[storageOwner]:owner}).indexes.get('ab').stat4.samples[0];const p=sample.p,old=p[0];p[0]^=255;
 assert.equal(sample.p[0],old);assert.ok(Object.isFrozen(sample.anEq));}
 finally{owner.close()}
});
test('outer stat4 btree payload copy is checked before unpublished schema construction',()=>{
 const owner=ImmutableStorage.open(fs.readFileSync(fixture)),carrier={[storageOwner]:owner};const primary=new Error('outer payload');let copy=false;
 try{assert.throws(()=>loadSchemaGraph(carrier,{check:(phase,units)=>{if(phase==='copy'&&units>1){copy=true;throw primary}}}),e=>e===primary);
 assert.equal(copy,true);assert.equal(owner.schemaBytes,0);
 assert.ok(loadSchemaGraph(carrier).indexes.get('ab').stat4.nSample>0);
 }finally{owner.close()}
});
