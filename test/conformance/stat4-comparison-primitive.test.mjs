import test from 'node:test';import assert from 'node:assert/strict';import * as c from '../../src/internal/comparison.ts';import {Mem} from '../../src/internal/mem.ts';
const info=new c.KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{collation:'nocase'},{}]});
const padded=a=>Uint8Array.from([...a,...Array(8).fill(0)]);
const key=(values,n=values.length)=>{const k=new c.UnpackedRecordKey(values,0,'stat4',info);k.nField=n;return k};
const integer=n=>{const m=new Mem();m.setInt64(BigInt(n));return m};
test('active prefix shares Mem/KeyInfo; gap is CORRUPT channel, prefix equal seen',()=>{
 assert.equal(typeof c.compareStat4RecordKey,'function');const k=key([integer(1),integer(2)],1);
 try{assert.equal(c.compareStat4RecordKey(padded([2,9]),2,k,info),0);assert.equal(k.eqSeen,true);
 k.nField=2;k.eqSeen=false;assert.equal(c.compareStat4RecordKey(padded([2,9]),2,k,info),0);assert.equal(k.errCode,11);assert.equal(k.eqSeen,false)}finally{k.release()}
});
test('malformed numeric uses padding, text/blob overflow errors only in matching branch',()=>{
 assert.equal(typeof c.compareStat4RecordKey,'function');const k=key([integer(0)]);
 try{assert.equal(c.compareStat4RecordKey(padded([2,6]),2,k,info),0);assert.equal(k.errCode,0);assert.equal(k.eqSeen,true);
 k.eqSeen=false;assert.equal(c.compareStat4RecordKey(padded([2,31]),2,k,info),1);assert.equal(k.errCode,0);
 const m=new Mem();m.setText(new TextEncoder().encode('a'),'utf-8');const t=key([m]);try{assert.equal(c.compareStat4RecordKey(padded([2,31]),2,t,info),0);assert.equal(t.errCode,11)}finally{t.release()}
 }finally{k.release()}
});
test('header overflow returns error without eqSeen; check primary exception preserved',()=>{
 assert.equal(typeof c.compareStat4RecordKey,'function');const k=key([integer(1)]);try{
 assert.equal(c.compareStat4RecordKey(padded([9,9]),2,k,info),0);assert.equal(k.errCode,11);assert.equal(k.eqSeen,false);
 const e=new Error('work');assert.throws(()=>c.compareStat4RecordKey(padded([2,9]),2,k,info,()=>{throw e}),x=>x===e);
 }finally{k.release()}
});
test('NOCASE prefix, blob distinction, descending and BIGNULL source flags',()=>{
 const m=new Mem();m.setText(new TextEncoder().encode('a'),'utf-8');const k=key([m]);try{assert.equal(c.compareStat4RecordKey(padded([2,15,65]),3,k,info),0);assert.equal(k.eqSeen,true)}finally{k.release()}
 for(const desc of [false,true])for(const nullsLarge of [false,true]){
  const ki=new c.KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{desc,nullsLarge}]});const m=integer(1),k=new c.UnpackedRecordKey([m],0,'stat4',ki);
  try{assert.equal(c.compareStat4RecordKey(padded([2,0]),2,k,ki),(-1)*(desc?-1:1)*(nullsLarge?-1:1))}finally{k.release()}
 }
});
test('reserved types and zero header follow branch decisions, not blanket corruption',()=>{
 for(const [record,value,expected,eq] of [[[2,10],0,-1,false],[[2,11],0,1,false],[[0],0,-1,false]]){
 const k=key([integer(value)]);try{assert.equal(c.compareStat4RecordKey(padded(record),record.length,k,info),expected);assert.equal(k.errCode,0);assert.equal(k.eqSeen,eq)}finally{k.release()}
 }
});
test('strict ordinary comparison does not adopt permissive sample decoding',()=>{
 const k=new c.UnpackedRecordKey([integer(0),integer(0)],0,'record',info);
 try{assert.throws(()=>c.compareRecordKey(Uint8Array.from([2,6]),k,info),e=>e.reason==='corrupt')}finally{k.release()}
});
