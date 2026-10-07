import test from 'node:test';
import assert from 'node:assert/strict';
import * as planner from '../../../src/internal/where-plan.ts';
import * as schema from '../../../src/internal/schema.ts';
// Proposed private semantic-owner seams, not public diagnostic exports. Names
// require parent approval; expected failures mark missing owner, not native parity.
const requireOwner=(module,name)=>{assert.equal(typeof module[name],'function',`${name}: proposed upstream-owned seam missing`);return module[name]};
test('decodeIntArray uint64 digit accumulation and zero-initialized short slots',()=>{
 const decode=requireOwner(schema,'decodeStat4Counts');
 assert.deepEqual(decode('18446744073709551616 18446744073709551617',3),[0n,1n,0n]);
 assert.deepEqual(decode(null,3),[0n,0n,0n]);
 assert.deepEqual(decode('2  7',3),[2n,0n,7n],'exact single-space consumption, not whitespace split');
});
test('whereKeyStats translated debug assertions and active prefix restoration',()=>{
 const create=requireOwner(planner,'createStat4Probe'),stats=requireOwner(planner,'whereKeyStats');
 const samples=[0,1,2,3,4].map(i=>({p:Uint8Array.from([2,1,i,0,0,0,0,0,0,0,0]),n:3,anEq:[1n],anLt:[BigInt(i)],anDLt:[BigInt(i)]}));
 const index={nSample:5,nSampleCol:1,nRowEst0:5n,aAvgEq:[1n],samples};
 const probe=create({encoding:'utf-8',nColumn:1,terms:[{}]});
 try{
  probe.setLiteral(0,2n);probe.nField=1;probe.nRecValid=1;
  const result=stats(index,probe,false);assert.equal(result.iSample,2);assert.deepEqual(result.aStat,[2n,1n]);assert.equal(probe.nField,1);
  // Exact-match source DEBUG invariants: i<nSample, iCol==nField-1,
  // packed sample equals probe. Probe owner supplies compare, not another evaluator.
  assert.equal(probe.compare(samples[result.iSample]),0);
  probe.setLiteral(0,9n);assert.equal(stats(index,probe,false).iSample,5);assert.equal(probe.nField,1);
 }finally{probe.release();}
});
test('IN/error/recursive builder restoration and all-slot cleanup obligations',()=>{
 const create=requireOwner(planner,'createStat4Probe'),scope=requireOwner(planner,'withStat4ProbeFrame');
 const probe=create({encoding:'utf-8',nColumn:3,terms:[{},{},{}]});
 probe.setLiteral(0,1n);probe.nRecValid=1;probe.nField=1;
 const primary=new Error('comparison failure');
 try{
  assert.throws(()=>scope(probe,()=>{probe.setLiteral(2,'owned tail');probe.nRecValid=3;probe.nField=2;throw primary}),e=>e===primary);
  assert.equal(probe.nRecValid,1);assert.equal(probe.nField,1);
  scope(probe,()=>{probe.nRecValid=2;probe.nField=2});assert.equal(probe.nRecValid,1);
 }finally{probe.release()}
 assert.ok(probe.slots.every(cell=>cell.initialStorageClass==='null'),'free ALL slots beyond valid prefix too');
});
