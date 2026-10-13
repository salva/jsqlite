import test from 'node:test';
import assert from 'node:assert/strict';
import {VdbeStatement} from '../../src/internal/vdbe.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {Mem} from '../../src/internal/mem.ts';

function statement(encoding,affinity,maxBytes=100000){
 return new VdbeStatement({encoding,registers:5,parameters:[{index:1,name:null}],columns:[{name:'x'}],maxWorkUnits:10000,maxResultBytes:10000,
 privateStateLimits:{maxEntries:10,maxKeyBytes:10000,maxBytes},ops:[
 {code:'Integer',p1:7n,p2:1},{code:'Variable',p1:1,p2:2},
 {code:'MakeRecord',p1:1,p2:2,p3:3,...(affinity?{p4Affinity:['blob',affinity]}:{})},
 {code:'ResultRow',p1:2,p2:1},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
}
for(const encoding of ['utf-8','utf-16le','utf-16be'])for(const input of [null,7n,'abc',new Uint8Array([1,2,3])])test(`no-conversion MakeRecord ${encoding} ${typeof input}`,async()=>{
 const original=PrivateStateByteBudget.prototype.reserve,events=[];
 PrivateStateByteBudget.prototype.reserve=function(bytes,...args){events.push(bytes);return original.call(this,bytes,...args)};
 const s=statement(encoding,null,100);
 try{s.bind(1,input);assert.equal(await s.step(),'row');assert.deepEqual(s.column(0),input);assert.equal(await s.step(),'done');assert.ok(!events.includes(64),'no baseline conversion charge');s.reset();assert.equal(await s.step(),'row');}
 finally{s.finalize();PrivateStateByteBudget.prototype.reserve=original;}
});
test('INTEGER7/TEXTabc retains original81 admission witness',async()=>{const s=statement('utf-8',null,81);try{s.bind(1,'abc');assert.equal(await s.step(),'row');assert.equal(s.column(0),'abc');assert.equal(await s.step(),'done');}finally{s.finalize()}});
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`actual numeric TEXT conversion reserves before mutation ${encoding}`,async()=>{
 const s=statement(encoding,'numeric',81);s.bind(1,'7');let failure;
 try{await assert.rejects(s.step(),e=>{failure=e;return /byte limit/.test(e.message)});assert.throws(()=>s.reset(),e=>e===failure);s.bind(1,7n);assert.equal(await s.step(),'row');assert.equal(s.column(0),7n);assert.equal(await s.step(),'done');}finally{s.finalize()}
});
test('Mem branch prediction distinguishes UTF swap, numeric stringify and no-ops',()=>{
 const m=new Mem();m.setInt64(7n);assert.equal(m.recordConversionBytes(undefined,'utf-8'),0);assert.ok(m.recordConversionBytes('text','utf-8')>0);
 m.setText(new TextEncoder().encode('abc'),'utf-8');assert.equal(m.recordConversionBytes('text','utf-8'),0);assert.ok(m.recordConversionBytes(undefined,'utf-16le')>0);assert.ok(m.recordConversionBytes('numeric','utf-8')>0);
 m.setNull();assert.equal(m.recordConversionBytes('numeric','utf-8'),0);m.setBlob(new Uint8Array([1]));assert.equal(m.recordConversionBytes('text','utf-16le'),0);
});
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`numeric stringify branch and same-encoding text ${encoding}`,async()=>{
 const s=statement(encoding,'text');try{s.bind(1,7n);assert.equal(await s.step(),'row');assert.equal(s.column(0),'7');assert.equal(await s.step(),'done');s.reset();s.bind(1,'abc');assert.equal(await s.step(),'row');assert.equal(s.column(0),'abc');}finally{s.finalize()}
});
test('cancel before conversion preserves error identity and supports reset/rerun',async()=>{
 const s=statement('utf-16le','text'),controller=new AbortController();s.bind(1,7n);controller.abort();let failure;
 try{await assert.rejects(s.step({signal:controller.signal}),e=>{failure=e;return e.kind==='cancelled'});assert.throws(()=>s.reset(),e=>e===failure);assert.equal(await s.step(),'row');assert.equal(s.column(0),'7');}finally{s.finalize()}
});
test('MakeRecord alias guard precedes conversion mutation',async()=>{
 const s=new VdbeStatement({encoding:'utf-8',registers:3,parameters:[],columns:[],maxWorkUnits:1000,maxResultBytes:1000,privateStateLimits:{maxBytes:10000,maxEntries:10,maxKeyBytes:1000},ops:[{code:'Integer',p1:7n,p2:1},{code:'MakeRecord',p1:1,p2:1,p3:1,p4Affinity:['text']},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
 try{await assert.rejects(s.step(),/MakeRecord output overlaps inputs/);assert.throws(()=>s.reset(),/MakeRecord output overlaps inputs/)}finally{s.finalize()}
});
test('UTF translation prediction tracks actual encoding branch while preserving values',()=>{
 for(const source of ['utf-8','utf-16le','utf-16be'])for(const target of ['utf-8','utf-16le','utf-16be']){
  const m=new Mem();const bytes=source==='utf-8'?new Uint8Array([97]):source==='utf-16le'?new Uint8Array([97,0]):new Uint8Array([0,97]);m.setText(bytes,source);
  assert.equal(m.recordConversionBytes(undefined,target)>0,source!==target);m.changeEncoding(target);assert.equal(m.textValue(),'a');m.release();
 }
});
