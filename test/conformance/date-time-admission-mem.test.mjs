import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {evaluateDateTime} from '../../src/internal/date-time.ts';
function encodeSqliteText(s,enc){if(enc==='utf-8')return new TextEncoder().encode(s);const b=Buffer.from(s,'utf16le');if(enc==='utf-16be')b.swap16();return new Uint8Array(b)}
// Private representation diagnostic: callback-default BLOBs are UTF-8;
// persisted/bound carriers are independently exercised by the public runner.
for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`date private callback/carried Mem ${encoding}`,()=>{
 const date=new Mem(),format=new Mem();
 date.setText(encodeSqliteText('2000-01-02\0junk',encoding),encoding);
 format.setBlob(new TextEncoder().encode('%Y\0%m'));
 const call=(name,args)=>evaluateDateTime(name,args,encoding,()=>{throw Error('unexpected clock')});
 assert.equal(call('strftime',[format,date]).valueText(),'2000');
 assert.equal(date.initialStorageClass,'text');assert.equal(date.valueText(),'2000-01-02\0junk');
 assert.equal(format.initialStorageClass,'blob');assert.deepEqual(format.blobValue(),new TextEncoder().encode('%Y\0%m'));
 const carried=new Mem();carried.setBlob(encodeSqliteText('2000-01-02',encoding),{encoding});
 assert.equal(call('date',[carried]).valueText(),'2000-01-02');assert.equal(carried.initialStorageClass,'blob');
 const real=new Mem();real.setDouble(1);assert.equal(call('strftime',[real,date]).valueText(),'1.0');assert.equal(real.initialStorageClass,'real');
 const extreme=new Mem();extreme.setDouble(1e300);
 assert.equal(call('timediff',[extreme,date]).initialStorageClass,'null');
 assert.equal(call('timediff',[date,extreme]).initialStorageClass,'null');
 const now=new Mem();now.setText(new TextEncoder().encode('now'),'utf-8');
 let providers=0,purity=0;
 const control={notPure(){purity++},maxResultBytes:1000,charge(){},check(){},checkSize(){}};
 const invoke=first=>evaluateDateTime('timediff',[first,now],encoding,()=>{providers++;return 0n},undefined,control);
 for(const first of [extreme,new Mem(),(()=>{const m=new Mem();m.setText(new TextEncoder().encode('1e300'),'utf-8');return m})()])assert.equal(invoke(first).initialStorageClass,'null');
 assert.equal(providers,0);assert.equal(purity,0);
 assert.equal(invoke(date).initialStorageClass,'text');assert.equal(providers,1);assert.equal(purity,1);
 const denied={...control,notPure(){throw Error('reached purity')}};
 assert.throws(()=>evaluateDateTime('timediff',[date,now],encoding,()=>{throw Error('provider must follow purity')},undefined,denied),/reached purity/);
});
