import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {packRecord,recordSize} from '../../src/internal/record-pack.ts';
import {decodeRecord} from '../../src/internal/record.ts';
// vdbe.c MakeRecord: IntReal that needs eight bytes switches to serial7.
test('MakeRecord IntReal serial boundary preserves source mutation',()=>{
  for(const [n,type] of [[140737488355327n,5],[140737488355328n,7],[-140737488355328n,5],[-140737488355329n,7]]){
    const value=new Mem();value.setIntReal(n);
    try{const bytes=packRecord([value],'utf-8');assert.equal(bytes[1],type);assert.equal(bytes.length,recordSize([value]));assert.equal(value.diagnostic().numeric,type===7?'real':'int-real')}finally{value.release()}
  }
});
test('MakeRecord integer widths, header fixed point and encoding/zero blob payload',()=>{
  for(const n of [0n,1n,-128n,128n,-32769n,8388608n,2147483648n,140737488355328n,-9223372036854775808n]){
    const value=new Mem();value.setInt64(n);try{assert.equal(decodeRecord(packRecord([value],'utf-8'),'utf-8').values[0].value,n)}finally{value.release()}
  }
  const values=Array.from({length:127},()=>new Mem());
  try{const packed=packRecord(values,'utf-8');assert.deepEqual(Array.from(packed.slice(0,2)),[129,1]);assert.equal(recordSize(values),129)}finally{for(const value of values)value.release()}
  for(const encoding of ['utf-8','utf-16le','utf-16be']){
    const text=new Mem(),blob=new Mem();text.setText(encoding==='utf-8'?new Uint8Array([65]):encoding==='utf-16le'?new Uint8Array([65,0]):new Uint8Array([0,65]),encoding);blob.setBlob(new Uint8Array([255]),{zeroTail:3});
    try{const bytes=packRecord([text,blob],encoding);assert.equal(bytes.length,recordSize([text,blob]));const decoded=decodeRecord(bytes,encoding);assert.equal(decoded.values[0].storageClass,'text');assert.deepEqual(Array.from(decoded.values[1].bytes),[255,0,0,0])}finally{text.release();blob.release()}
  }
});

test('MakeRecord conversion allowance is admitted through packing and refunded on failure',async()=>{
 const {VdbeStatement}=await import('../../src/internal/vdbe.ts');
 for(const encoding of ['utf-16le','utf-16be'])for(const maxBytes of [147,148]){
  const st=new VdbeStatement({encoding,registers:2,parameters:[],columns:[],maxWorkUnits:10000,maxResultBytes:1000,privateStateLimits:{maxEntries:4,maxKeyBytes:1000,maxBytes},ops:[{code:'String',p1:'abc',p2:1},{code:'MakeRecord',p1:1,p2:1,p3:2},{code:'Halt'}]},()=>{},()=>()=>{},()=>{});
  if(maxBytes===147){let first;try{await st.step();assert.fail('overlap allowance must reject')}catch(error){first=error;assert.equal(error.kind,'limit')};assert.throws(()=>st.finalize(),error=>error===first)}
  else{assert.equal(await st.step(),'done');st.finalize()}
 }
});
