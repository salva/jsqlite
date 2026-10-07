import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {openBtreeDatabase} from '../../src/internal/btree.ts';import {KeyInfo} from '../../src/internal/comparison.ts';import {Mem} from '../../src/internal/mem.ts';
const root=new URL('../../docs/research/card-s-g/primitive-companions/',import.meta.url),native=JSON.parse(fs.readFileSync(new URL('native.json',root),'utf8'));
const cell=n=>{const m=new Mem();m.setInt64(n);return m;};
for(const v of native.variants.filter(v=>v.tail==='18'))test(`source SeekScan state ${v.encoding}`,()=>{
 const db=openBtreeDatabase(new Uint8Array(fs.readFileSync(new URL(v.fixture,root)))),info=new KeyInfo({encoding:db.encoding,totalFieldCount:3,keyFieldCount:2,terms:[{},{},{}]}),page=Number(v.roots.find(r=>Buffer.from(r[0].utf8Hex,'hex').toString()==='ab')[1].value),cursor=db.indexCursor(page);
 cursor.clearPosition();let m=cell(1n);assert.equal(cursor.seekScan([m],info,1,false),'seek');assert.equal(m.diagnostic().manifest,'null');
 assert.ok(cursor.seekKey([cell(1n)],info,'ge'));
 const generation=cursor.generation;assert.equal(cursor.seekScan([cell(100000n)],info,0,false),'seek');assert.equal(cursor.generation,generation,'budget checked after comparison before any Next');
 assert.equal(cursor.seekScan([cell(1n)],info,1,false),'found');
 assert.equal(cursor.seekScan([cell(0n)],info,1,false),'exhausted');assert.ok(cursor.valid,'greater current entry is retained');
 assert.equal(cursor.seekScan([cell(0n)],info,1,true),'found','range mode accepts overshoot');
 assert.equal(cursor.seekScan([cell(100000n)],info,1,false),'seek','step budget exhaustion retains position for fallback');assert.ok(cursor.valid);
 assert.ok(cursor.last());assert.equal(cursor.seekScan([cell(100000n)],info,1,true),'exhausted');assert.equal(cursor.valid,false,'Next DONE invalidates before seek-exit');
 assert.ok(cursor.first());const original=cursor.payload.bind(cursor),failure=new Error('payload failure');cursor.payload=()=>{throw failure;};m=cell(1n);assert.throws(()=>cursor.seekScan([m],info,1,false),e=>e===failure);assert.equal(m.diagnostic().manifest,'null');cursor.payload=original;db.close();
});
