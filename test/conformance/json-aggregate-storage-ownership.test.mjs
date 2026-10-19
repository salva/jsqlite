import assert from 'node:assert/strict';
import test from 'node:test';
import {jsonAggregateBlob,appendJsonAggregateBlob,withJsonAggregateLabel,jsonValid,parseJsonMem} from '../../src/internal/json.ts';
import {Mem} from '../../src/internal/mem.ts';

// jsonArray/ObjectCompute final transfers the retained allocation while xValue
// publishes a transient owning copy. Identity is an internal ownership witness,
// not a public API permission to mutate published values.
test('aggregate final storage can be adopted, then moved exactly once',()=>{
 const bytes=new Uint8Array([123,125]),a=new Mem(),b=new Mem();
 a.adoptText(bytes,'utf-8');
 assert.equal(a.textBytes(),bytes);
 a.setSubtype(74);b.moveFrom(a);
 assert.equal(a.initialStorageClass,'null');assert.equal(b.textBytes(),bytes);
 assert.equal(b.subtypeValue(),74);a.release();assert.equal(b.textValue(),'{}');
 b.release();b.release();
});
test('dynamic JSONB result adopts an arena and moves without copying',async()=>{
 let live=0;const control={reserve:n=>{live+=n},release:n=>{live-=n},charge:()=>{},check:()=>{},checkpoint:async()=>{}};
 const original=Mem.prototype.setBlob;
 // Conversion must use SQLITE_DYNAMIC ownership, not the copying setter.
 Mem.prototype.setBlob=function(){throw new Error('unexpected transient BLOB copy')};
 let out;
 try{out=await jsonAggregateBlob(new TextEncoder().encode('[1,2]'),control)}finally{Mem.prototype.setBlob=original}
 assert.equal(live,0);const bytes=out.blobValue(),moved=new Mem();
 moved.moveFrom(out);assert.equal(out.initialStorageClass,'null');assert.equal(moved.blobValue(),bytes);
 out.release();assert.deepEqual([...moved.blobValue()],[0x4b,0x13,0x31,0x13,0x32]);moved.release();moved.release();
 const input=new Uint8Array([1,2]),a=new Mem(),b=new Mem();a.adoptBlob(input);assert.equal(a.blobValue(),input);
 b.setBlob(input);assert.notEqual(b.blobValue(),input);a.release();b.release();
});

test('borrowed argument coercion preserves its source and avoids UTF8 duplication',()=>{
 const source=new Mem(),privateValue=new Mem();source.setText(new TextEncoder().encode('[1]'),'utf-8');source.setSubtype(74);
 privateValue.shallowCopyFrom(source);privateValue.changeEncoding('utf-8');assert.equal(privateValue.textBytes(),source.textBytes());assert.equal(source.recordConversionBytes(undefined,'utf-8'),0);
 privateValue.release();assert.equal(source.textValue(),'[1]');assert.equal(source.subtypeValue(),74);
 source.changeEncoding('utf-16le');const bytes=source.textBytes();assert.ok(source.recordConversionBytes(undefined,'utf-8')>=bytes.length);
 privateValue.shallowCopyFrom(source);privateValue.changeEncoding('utf-8');assert.notEqual(privateValue.textBytes(),bytes);assert.equal(privateValue.textValue(),'[1]');assert.equal(source.textBytes(),bytes);
 privateValue.release();source.release();
});

test('label coercion retains a borrowed prefix and refunds failures before admission',async()=>{
 const source=new Mem();source.setText(new TextEncoder().encode('raw\0ignored'),'utf-8');
 let live=0,probes=0,calls=0;const stop=new Error('stop label');
 const control={reserve:n=>{live+=n},release:n=>{live-=n},checkpoint:async()=>{probes++}};
 await withJsonAggregateLabel(source,control,async bytes=>{calls++;assert.equal(bytes.buffer,source.textBytes().buffer);assert.equal(new TextDecoder().decode(bytes),'raw');assert.equal(live,0)});
 assert.equal(calls,1);assert.equal(live,0);assert.equal(source.textValue(),'raw\0ignored');
 source.changeEncoding('utf-16be');
 await assert.rejects(withJsonAggregateLabel(source,control,async bytes=>{assert.ok(live>0);assert.equal(new TextDecoder().decode(bytes),'raw');throw stop}),e=>e===stop);
 assert.equal(live,0);assert.equal(source.diagnostic().encoding,'utf-16be');
 control.checkpoint=async()=>{throw stop};
 await assert.rejects(withJsonAggregateLabel(source,control,async()=>{calls++}),e=>e===stop);assert.equal(calls,1);assert.equal(live,0);
 source.setNull();await withJsonAggregateLabel(source,control,async bytes=>{assert.equal(bytes,null)});assert.ok(probes>0);source.release();
});

test('BLOB producer streams into admission and stops on consumer error',async()=>{
 const value=new Mem();value.setBlob(new Uint8Array([0x4b,0x17,0xff,0x13,0x31]));
 const parts=[];await appendJsonAggregateBlob(value,async bytes=>{parts.push(...bytes)},async()=>{},()=>{parts.pop()});
 assert.deepEqual(parts,[91,34,255,34,44,49,93]);value.release();
 // Long INT5 has no output until its hexadecimal scan completes. It must
 // nevertheless probe cancellation; no temporary joined TEXT is required.
 const payload=new TextEncoder().encode('0x'+'a'.repeat(2000));
 const b=new Uint8Array(payload.length+3);b.set([0xd4,payload.length>>8,payload.length&255]);b.set(payload,3);value.setBlob(b);
 const stop=new Error('cancel conversion');let outputs=0,probes=0;
 await assert.rejects(appendJsonAggregateBlob(value,async()=>{outputs++},async()=>{if(++probes===2)throw stop},()=>{}),e=>e===stop);
 assert.equal(outputs,0);assert.equal(probes,2);
 value.setBlob(new Uint8Array([0x27,97,98]));
 await assert.rejects(appendJsonAggregateBlob(value,async()=>{throw stop},async()=>{},()=>{}),e=>e===stop);value.release();
});

test('BLOB containers admit trailing separators before trim and close',async()=>{
 for(const [blob,expected,events] of [
  [[0x2b,0x13,0x31],'[1]',['[','1',',','trim',']']],
  [[0x4c,0x17,97,0x13,0x31],'{"a":1}',['{','"','a','"',':','1',',','trim','}']],
  [[0x0b],'[]',['[',']']],
 ]){
  const value=new Mem();value.setBlob(new Uint8Array(blob));let out='';const actual=[];
  await appendJsonAggregateBlob(value,async bytes=>{const s=new TextDecoder().decode(bytes);actual.push(s);out+=s},async()=>{},()=>{actual.push('trim');out=out.slice(0,-1)});
  assert.equal(out,expected);assert.deepEqual(actual,events);value.release();
 }
 // The otherwise redundant trailing comma must still pass append admission.
 const value=new Mem();value.setBlob(new Uint8Array([0x2b,0x13,0x31]));const stop=new Error('separator admission');let trimmed=false;
 await assert.rejects(appendJsonAggregateBlob(value,async bytes=>{if(bytes[0]===44)throw stop},async()=>{},()=>{trimmed=true}),e=>e===stop);
 assert.equal(trimmed,false);value.release();
});

test('BLOB malformed children latch error, stop siblings, suppress trim and unwind containers',async()=>{
 for(const [blob,expected] of [
  [[0x2b,0x03,0x00],['[',',',']']],
  [[0x3b,0x2b,0x03,0x00],['[','[',',',']',',',']']],
  [[0x1c,0x00],['{','null',':','}']],
  [[0x1b,0x0f],['[',',',']']],
 ]){
  const value=new Mem();value.setBlob(new Uint8Array(blob));const events=[];
  await assert.rejects(appendJsonAggregateBlob(value,async bytes=>{events.push(new TextDecoder().decode(bytes))},async()=>{},()=>{events.push('trim')}),/malformed JSON/);
  assert.deepEqual(events,expected);value.release();
 }
 const value=new Mem();value.setBlob(new Uint8Array([0x2b,0x03,0x00]));const stop=new Error('unwind admission');
 await assert.rejects(appendJsonAggregateBlob(value,async bytes=>{if(bytes[0]===44)throw stop},async()=>{},()=>{}),e=>e===stop);value.release();
});

test('BLOB INT5 and TEXT5 finish local emission after malformed scans',async()=>{
 const encoder=new TextEncoder();
 for(const [type,payload,expected] of [
  [4,'0x1z',['1']],[4,'-0xfg',['-','15']],
  [4,'0x'+'f'.repeat(17)+'g',['9.0e999']],
  [9,'abc\\',['"','a','b','c','"']],
  [9,'\\x1',['"','"']],
  [9,new Uint8Array([92,226]),['"','"']],
 ]){
  const p=typeof payload==='string'?encoder.encode(payload):payload,header=p.length<12?new Uint8Array([(p.length<<4)|type]):new Uint8Array([0xc0|type,p.length]);
  // Container admission is superficial; malformed scalar roots may instead
  // take jsonArgIsJsonb's text ambiguity path before this producer is reached.
  const child=new Uint8Array(header.length+p.length);child.set(header);child.set(p,header.length);
  const outer=new Uint8Array([0xcb,child.length]);
  const blob=new Uint8Array(outer.length+child.length);blob.set(outer);blob.set(child,outer.length);
  const value=new Mem();value.setBlob(blob);const events=[];
  await assert.rejects(appendJsonAggregateBlob(value,async bytes=>{events.push(new TextDecoder().decode(bytes))},async()=>{},()=>{}),/malformed JSON/);
  assert.deepEqual(events,['[',...expected,',',']']);value.release();
 }
 const value=new Mem();value.setBlob(new Uint8Array([0x4b,0x39,92,120,49]));let calls=0;const stop=new Error('closing quote admission');
 await assert.rejects(appendJsonAggregateBlob(value,async()=>{if(++calls===3)throw stop},async()=>{},()=>{}),e=>e===stop);
 assert.equal(calls,3);value.release();
});

test('aggregate BLOB zero-tail expansion admits storage before allocation and refunds every exit',async()=>{
 const value=new Mem();value.setBlob(new Uint8Array([0xcb,0x04,0x33]),{zeroTail:3});
 // Array containing INT with three zero payload bytes: raw emission, not numeric validation.
 let held=0,peak=0,probes=0;const events=[];
 const storage={reserve:n=>{held+=n;peak=Math.max(peak,held)},release:n=>{held-=n}};
 await appendJsonAggregateBlob(value,async b=>events.push([...b]),async()=>{probes++},()=>events.push('trim'),storage);
 assert.equal(peak,6);assert.equal(held,0);assert.ok(probes>=3);assert.equal(value.diagnostic().zeroTail,3);
 const failure=new Error('expansion admission');let appended=false;
 await assert.rejects(appendJsonAggregateBlob(value,async()=>{appended=true},async()=>{},()=>{}, {reserve:()=>{throw failure},release:()=>assert.fail('unreserved release')}),e=>e===failure);
 assert.equal(appended,false);
 const cancel=new Error('cancel expanded copy');let steps=0;
 await assert.rejects(appendJsonAggregateBlob(value,async()=>{},async()=>{if(++steps===3)throw cancel},()=>{},storage),e=>e===cancel);
 assert.equal(held,0);
 await assert.rejects(appendJsonAggregateBlob(value,async()=>{throw failure},async()=>{},()=>{},storage),e=>e===failure);
 assert.equal(held,0);value.release();
 const ordinary=new Mem();const bytes=new Uint8Array([0x0b]);ordinary.setBlob(bytes);
 ordinary.blobValue=()=>{throw new Error('eager materialization')};
 await appendJsonAggregateBlob(ordinary,async()=>{},async()=>{},()=>{}, {reserve:()=>assert.fail('ordinary borrowed bytes'),release:()=>assert.fail('ordinary release')});ordinary.release();
});

test('shared BLOB fallback validation uses the same Mem text coercion as document parsing',()=>{
 const text='["é😀"]';
 for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const carrier=new Mem();carrier.setText(new TextEncoder().encode(text),'utf-8');carrier.changeEncoding(encoding);
  const bytes=carrier.textBytes();const blob=new Mem();blob.setBlob(bytes,{encoding});
  assert.equal(jsonValid(blob,1),true);assert.equal(jsonValid(blob,2),true);
  assert.equal(parseJsonMem(blob).kind,'array');assert.equal(jsonValid(blob,4),false);
  assert.equal(blob.initialStorageClass,'blob');blob.release();carrier.release();
 }
});

test('transient value publication remains copied and independent',()=>{
 const bytes=new Uint8Array([91,93]),a=new Mem();a.setText(bytes,'utf-8');
 assert.notEqual(a.textBytes(),bytes);bytes[0]=123;
 assert.equal(a.textValue(),'[]');a.release();
});
