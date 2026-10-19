import assert from 'node:assert/strict';
import test from 'node:test';
import {Mem,BorrowLifetime,memFromPublic,memFromRawRecord} from '../../src/internal/mem.ts';
import {decodeRecord} from '../../src/internal/record.ts';

// OP_Blob/OP_Column own source encoding; sqlite3_value_text's valueToText
// adds MEM_Str then changes encoding. bindText resets BLOB enc to database enc.
for(const [encoding,expected] of [['utf-8','610062'],['utf-16be','e68480'],['utf-16le','61']]) {
 test(`BLOB source encoding survives copy until private SQL text conversion: ${encoding}`,()=>{
  const original=new Mem();original.setBlob(Uint8Array.of(0x61,0,0x62),{encoding});original.setSubtype(74);
  const copy=new Mem();copy.copyFrom(original);copy.cast('text','utf-8');
  assert.equal(Buffer.from(copy.textBytes()).toString('hex'),expected);
  assert.equal(Buffer.from(original.blobValue()).toString('hex'),'610062');assert.equal(original.initialStorageClass,'blob');
  assert.equal(copy.subtypeValue(),74);
  const input=Uint8Array.of(0x61,0,0x62),bound=memFromPublic(input,encoding);input[0]=0xff;
  assert.equal(Buffer.from(bound.blobValue()).toString('hex'),'610062');
  const boundCopy=new Mem();boundCopy.copyFrom(bound);boundCopy.cast('text','utf-8');assert.equal(Buffer.from(boundCopy.textBytes()).toString('hex'),expected);
  assert.equal(Buffer.from(bound.blobValue()).toString('hex'),'610062');bound.cast('text','utf-8');assert.equal(Buffer.from(bound.textBytes()).toString('hex'),expected);boundCopy.release();
  const lifetime=new BorrowLifetime();const raw=decodeRecord(Uint8Array.of(2,18,0x61,0,0x62),encoding).values[0];
  const column=memFromRawRecord(raw,lifetime);column.cast('text','utf-8');assert.deepEqual(column.textBytes(),copy.textBytes());
  original.setNull();original.setBlob(Uint8Array.of(0xff));original.cast('text','utf-8');assert.equal(Buffer.from(original.textBytes()).toString('hex'),'ff');
  lifetime.invalidate();copy.release();column.release();original.release();bound.release();
 });
}
