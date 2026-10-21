import test from 'node:test';
import assert from 'node:assert/strict';
import {stat4Column,stat4SkipScanRange} from '../../src/internal/stat4-skipscan.ts';
import {Mem} from '../../src/internal/mem.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Stat4Probe} from '../../src/internal/stat4-probe.ts';
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`${encoding}: scalar types, collation and allocated NULL vs unavailable`,()=>{
 const m=new Mem();const bytes=encoding==='utf-8'?[65]:encoding==='utf-16le'?[65,0]:[0,65];
 stat4Column(packed(3,8,13+2*bytes.length,...bytes),1,encoding,m);assert.equal(m.initialStorageClass,'text');assert.deepEqual([...m.textBytes()],bytes);
 stat4Column(packed(3,8,12+2*bytes.length,...bytes),1,encoding,m);assert.equal(m.initialStorageClass,'blob');
 stat4Column(packed(3,8,7,0x7f,0xf8,0,0,0,0,0,0),1,encoding,m);assert.equal(m.initialStorageClass,'null');m.release();
 const ki=new KeyInfo({encoding,totalFieldCount:2,keyFieldCount:2,terms:[{}, {collation:'nocase',desc:true}]});
 const probe=new Stat4Probe(ki);
 const string={kind:'reduction',signature:'term ::= STRING',children:[{kind:'terminal',value:{kind:'string',text:"'a'"}}]};
 const options={probe,samples:[packed(3,8,13+bytes.length*2,...bytes)],column:1,affinity:'text'};
 assert.equal(stat4SkipScanRange({...options,lower:string}).nLower,1);
 const nil={kind:'reduction',signature:'term ::= NULL',children:[{kind:'terminal',value:{kind:'keyword',text:'NULL'}}]};
 assert.equal(stat4SkipScanRange({...options,lower:nil}).done,true);
 const unknown={kind:'reduction',signature:'expr ::= unsupported',children:[]};
 assert.equal(stat4SkipScanRange({...options,lower:unknown}).done,false);probe.release();
});
const packed=(...bytes)=>({p:Uint8Array.from([...bytes,...Array(8).fill(0)]),n:bytes.length});
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{}, {desc:true}]});
const expr=text=>({kind:'reduction',signature:'term ::= INTEGER',children:[{kind:'terminal',value:{kind:'integer',text}}]});
test('lazy column skips later malformed serial; corruption precedes mutation',()=>{
 const m=new Mem();m.setInt64(99n);
 stat4Column(packed(4,8,1,255,42),1,'utf-8',m);assert.equal(m.integerValue(),42n);
 for(const sample of [packed(4,8,1),packed(3,8,6,1)])assert.throws(()=>stat4Column(sample,1,'utf-8',m),e=>e.reason==='corrupt');
 assert.equal(m.integerValue(),42n);
 stat4Column(packed(3,8,10),1,'utf-8',m);assert.equal(m.initialStorageClass,'null');m.release();
});
test('native counts, absent/unavailable, paired narrow fallback; DESC does not invert',()=>{
 const probe=new Stat4Probe(info);probe.nRecValid=1;probe.nField=1;probe.setLiteral(0,123n);
 const samples=[1,2,3,4].map(x=>packed(3,8,1,x));
 const run=(lower,upper)=>stat4SkipScanRange({probe,samples,column:1,affinity:'integer',lower,upper});
 const result=run(expr('2'),undefined);assert.equal(result.nLower,2);assert.equal(result.nUpper,5);assert.equal(result.nDiff,3);assert.equal(result.done,true);
 assert.equal(run(expr('2'),expr('3')).done,false);
 assert.equal(run(undefined,undefined).done,false);
 assert.equal(run({kind:'reduction',signature:'expr ::= unsupported',children:[]},expr('2')).nLower,0);
 assert.equal(probe.values[0].integerValue(),123n);assert.equal(probe.nRecValid,1);assert.equal(probe.nField,1);probe.release();
});
test('all check frontiers preserve primary, release scratch, retry; corrupt sample and denied allocation',()=>{
 let held=0,calls=0,fail=Infinity;const primary=new Error('primary');
 const probe=new Stat4Probe(info,()=>{if(++calls===fail)throw primary},bytes=>{held+=bytes;return()=>{held-=bytes}});
 const baseline=held;const options={probe,samples:[packed(3,8,1,1),packed(3,8,1,2)],column:1,affinity:'integer',lower:expr('1')};
 stat4SkipScanRange(options);const total=calls;assert.equal(held,baseline);
 for(let at=1;at<=total;at++){calls=0;fail=at;assert.throws(()=>stat4SkipScanRange(options),e=>e===primary);assert.equal(held,baseline)}
 fail=Infinity;assert.throws(()=>stat4SkipScanRange({...options,samples:[packed(3,8,6,1)]}),e=>e.reason==='corrupt');assert.equal(held,baseline);
 stat4SkipScanRange(options);probe.release();assert.equal(held,0);
 let deny=false;const denied=new Stat4Probe(info,()=>{},()=>{if(deny)throw primary;return()=>{}});deny=true;
 assert.throws(()=>stat4SkipScanRange({...options,probe:denied}),e=>e===primary);denied.release();
});
