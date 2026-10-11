import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {EphemeralIndexCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const control={async checkpoint(){}};
const cell=n=>{const m=new Mem();m.setInt64(BigInt(n));return m;};
function cursor(){const budget=new PrivateStateByteBudget(1000);return {budget,c:new EphemeralIndexCursor(new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:0,terms:[]}),{maxEntries:20,maxKeyBytes:100,maxBytes:1000},budget,true)};}
// btree.c sqlite3BtreeDelete(SAVEPOSITION) and restoreCursorPosition:
// other handles retain identity; Next from the deleted identity finds successor.
test('shared saved-position deletion preserves before/on/after cursors and refunds once',async()=>{
 const {c,budget}=cursor();for(const n of [10,20,30])await c.insert([cell(n)],control);
 const before=c.duplicate(),on=c.duplicate(),after=c.duplicate();
 await before.seekRowid(1n,control);await on.seekRowid(2n,control);await after.seekRowid(3n,control);await c.seekRowid(2n,control);
 await c.deleteCurrent(control);
 assert.throws(()=>c.data(),/not positioned/);assert.throws(()=>on.rowid(),/not positioned/);
 assert.equal(budget.usedBytes,16);assert.equal(before.rowid(),1n);assert.equal(after.rowid(),3n);
 assert.equal(on.next(),true);assert.equal(on.rowid(),3n);assert.equal(c.next(),true);assert.equal(c.rowid(),3n);
 c.close();before.close();on.close();after.close();assert.equal(budget.usedBytes,0);
});
test('deleted tail does not reuse rowid and new tail remains seekable',async()=>{
 const {c,budget}=cursor();for(const n of [10,20,30])await c.insert([cell(n)],control);
 await c.seekRowid(3n,control);await c.deleteCurrent(control);assert.equal(c.newRowid(),4n);
 await c.insert([cell(40)],control);assert.equal(c.next(),true);assert.equal(c.rowid(),4n);
 assert.equal(await c.seekRowid(3n,control),false);assert.equal(await c.seekRowid(4n,control),true);
 c.clear();assert.equal(c.newRowid(),1n);assert.equal(c.first(),false);c.close();assert.equal(budget.usedBytes,0);
});
test('delete checkpoint failure leaves shared identity and accounting unchanged',async()=>{
 const {c,budget}=cursor();await c.insert([cell(7)],control);c.first();const saved=new Error('cancel delete');
 await assert.rejects(c.deleteCurrent({async checkpoint(){throw saved;}}),e=>e===saved);
 assert.equal(c.rowid(),1n);assert.equal(budget.usedBytes,8);c.close();assert.equal(budget.usedBytes,0);
});
test('failed tail publication does not consume rowid or move duplicate position',async()=>{
 const {c,budget}=cursor();await c.insert([cell(7)],control);const dup=c.duplicate();dup.first();
 const saved=new Error('deadline publication');let checks=0;
 await assert.rejects(c.insert([cell(8)],{async checkpoint(){if(++checks===3)throw saved;}}),e=>e===saved);
 assert.equal(c.newRowid(),2n);assert.equal(dup.rowid(),1n);assert.equal(budget.usedBytes,8);
 await c.insert([cell(9)],control);assert.equal(dup.next(),true);assert.equal(dup.rowid(),2n);dup.close();c.close();assert.equal(budget.usedBytes,0);
});
