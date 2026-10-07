import test from 'node:test';import assert from 'node:assert/strict';
import * as schema from '../../src/internal/schema.ts';
const row=(name,n=3)=>({name,neq:'2 1',nlt:'4 5',ndlt:'2 5',bytes:Uint8Array.from({length:n},(_,i)=>i)});
const load=(rows,options={})=>{assert.equal(typeof schema.loadStat4Samples,'function');const identity={};return {identity,result:schema.loadStat4Samples(()=>rows.values(),name=>['wr','sqlite_autoindex_wr_1'].includes(name.toLowerCase())?identity:null,()=>({nSampleCol:2,nKeyCol:1,aiRowEst:[10n,2n]}),{maxBytes:1024*1024,...options})}};
test('two-pass NOCASE groups, physical WR duplicate alias capacity, original-order skip',()=>{
 const rows=[row('wr'),row('WR'),row('sqlite_autoindex_wr_1'),row('missing')];
 const {identity,result}=load(rows);const s=result.get(identity);
 // Alphabetical group allocation: autoindex alias group has capacity 1.
 assert.equal(s.mxSample,1);assert.equal(s.nSample,1);assert.equal(s.samples.length,1);
 assert.deepEqual([...s.samples[0].p],[0,1,2,0,0,0,0,0,0,0,0]);assert.equal(s.samples[0].n,3);
 assert.deepEqual(s.samples[0].anEq,[2n,1n]);assert.deepEqual(s.aAvgEq,[2n,1n]);
 rows[0].bytes[0]=99;assert.equal(s.samples[0].p[0],0,'copy ownership');
});
test('internal envelope checks before allocation and pass/copy primary failures allow retry',()=>{
 const rows=[row('wr'),row('WR')];assert.throws(()=>load(rows,{maxBytes:1}),/statistics allocation/);
 for(const phase of ['count','capacity','load','copy','finalize']){
  const primary=new Error(phase);assert.throws(()=>load(rows,{check:(p)=>{if(p===phase)throw primary}}),e=>e===primary);
  assert.equal(load(rows).result.size,1,'same inputs retry; no published partial result');
 }
});
test('count array missing values stay zero; raw empty/malformed samples are not decoded',()=>{
 const r=row('wr',0);r.neq=null;r.nlt='7';r.ndlt='x';const s=load([r]).result.values().next().value;
 assert.equal(s.samples[0].n,0);assert.equal(s.samples[0].p.length,8);assert.deepEqual(s.samples[0].anLt,[7n,0n]);
});
test('checks occur after partial capacity/load/copy work and preserve primary errors',()=>{
 const rows=[row('wr',9000),row('WR',9000)];
 for(const phase of ['load','copy']){
  let calls=0;const primary=new Error('partial '+phase);
  assert.throws(()=>load(rows,{check:p=>{if(p===phase&&++calls===2)throw primary}}),e=>e===primary);
  assert.equal(calls,2);assert.equal(load(rows).result.values().next().value.nSample,2);
 }
 let calls=0;const a={},b={},primary=new Error('second capacity');
 assert.throws(()=>schema.loadStat4Samples(()=>[row('a'),row('b')],name=>name==='a'?a:b,()=>({nSampleCol:2,nKeyCol:1,aiRowEst:null}),{maxBytes:10000,check:p=>{if(p==='capacity'&&++calls===2)throw primary}}),e=>e===primary);
 assert.equal(calls,2);
});
test('interleaved accepted index transitions recompute averages and finalize last owner',()=>{
 const a={},b={};const ra=row('a'),rb=row('b'),ra2=row('a');ra.nlt='20 21';ra.ndlt='10 21';ra2.nlt='100 101';ra2.ndlt='20 101';
 const result=schema.loadStat4Samples(()=>[ra,rb,ra2],name=>name==='a'?a:b,()=>({nSampleCol:2,nKeyCol:1,aiRowEst:null}),{maxBytes:10000});
 assert.equal(result.get(a).nRowEst0,100n);assert.equal(result.get(b).nRowEst0,4n);
 assert.deepEqual(result.get(a).aAvgEq,[5n,1n]);assert.deepEqual(result.get(b).aAvgEq,[2n,1n]);
});
test('count digit production is checked during a single long count before record copy',()=>{
 const primary=new Error('digits cancelled');let checked=false;
 assert.throws(()=>load([{...row('wr'),neq:'9'.repeat(16384)}],{check:(phase,units)=>{if(phase==='load'&&units>=4096){checked=true;throw primary}}}),e=>e===primary);
 assert.equal(checked,true);
});
