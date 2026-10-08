import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../../../src/internal/schema.ts';
const root=new URL('../',import.meta.url);
const hashes=JSON.parse(fs.readFileSync(new URL('first-inputs.json',root)));
// analyze.c loadStatTbl owns count/capacity/load/finalization. JS checkpoints
// add cooperative failure boundaries; do not assert native malloc equivalence.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be']){
 test(`${encoding}: every observed schema construction checkpoint preserves primary and same-owner retry`,()=>{
  const bytes=fs.readFileSync(new URL(`${encoding}.db`,root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),hashes[`docs/research/card-s-h/${encoding}.db`]);
  const trace=[];const baseline=ImmutableStorage.open(bytes);
  let expectedBytes;
  try{loadSchemaGraph({[storageOwner]:baseline},{check:phase=>trace.push(phase)});expectedBytes=baseline.schemaBytes;}
  finally{baseline.close();}
  for(const phase of ['count','capacity','load','copy','finalize'])assert.ok(trace.includes(phase),phase);
  // Fail each real invocation, not just one fixture-selected phase ordinal.
  for(let fail=0;fail<trace.length;fail++){
   const owner=ImmutableStorage.open(bytes),carrier={[storageOwner]:owner};
   const primary=new Error(`${encoding}/${fail}/${trace[fail]}`);let ordinal=0;
   try{
    assert.throws(()=>loadSchemaGraph(carrier,{check:phase=>{
     assert.equal(phase,trace[ordinal]);if(ordinal++===fail)throw primary;
    }}),e=>e===primary);
    assert.equal(ordinal,fail+1);
    assert.equal(owner.schemaBytes,0,'failed construction must not publish');
    assert.equal(owner.schemaTemporaryBytes,0,'failed construction must not retain temporary ownership');
    const graph=loadSchemaGraph(carrier);
    assert.equal(owner.schemaBytes,expectedBytes);
    assert.ok(graph.indexes.get('ab').stat4.nSample>0);
    assert.equal(loadSchemaGraph(carrier),graph);
   }finally{owner.close();}
   assert.equal(owner.schemaBytes,0);assert.equal(owner.schemaTemporaryBytes,0);
  }
 });
}
