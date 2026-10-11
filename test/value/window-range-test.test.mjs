import test from 'node:test';
import assert from 'node:assert/strict';
import {Mem} from '../../src/internal/mem.ts';
import {windowRangeTest} from '../../src/internal/vdbe-primitives.ts';
const cell=v=>{const m=new Mem();if(v===null)m.setNull();else if(typeof v==='bigint')m.setInt64(v);else if(typeof v==='number')m.setReal(v);else m.setText(new TextEncoder().encode(v),'utf-8');return m;};
// window.c2101-2217 arithmetic applies to csr1 only; compare maintains INTEGER
// precision, nonnumeric storage rank, collation and BIGNULL before DESC.
test('range test int64 thresholds do not round neighboring integers',()=>{
 const base=9007199254740992n;
 assert.equal(windowRangeTest(cell(base+2n),cell(base),cell(1n),'end-following',false,'binary'),false);
 assert.equal(windowRangeTest(cell(base+1n),cell(base),cell(1n),'end-following',false,'binary'),true);
 assert.equal(windowRangeTest(cell(base),cell(base+2n),cell(1n),'start-preceding',false,'binary'),true);
 assert.equal(windowRangeTest(cell(base+1n),cell(base+2n),cell(1n),'start-preceding',false,'binary'),false);
 assert.equal(windowRangeTest(cell(base),cell(base+2n),cell(1n),'end-following',true,'binary'),false);
});
test('range test mixed storage ordering and collation are not inequality peer tests',()=>{
 assert.equal(windowRangeTest(cell(7n),cell('a'),cell(1n),'start-preceding',false,'binary'),true);
 assert.equal(windowRangeTest(cell('z'),cell('a'),cell(1n),'start-preceding',false,'binary'),false);
 assert.equal(windowRangeTest(cell('A'),cell('a'),cell(1n),'end-following',false,'nocase'),true);
 assert.equal(windowRangeTest(cell('z'),cell('a'),cell(1n),'end-following',false,'binary'),false);
 assert.equal(windowRangeTest(cell('a'),cell('z'),cell(1n),'end-following',false,'binary'),true);
});
test('range test BIGNULL precedes independent DESC inversion',()=>{
 for(const desc of [false,true])for(const big of [false,true]){
  const direction=(big?1:-1)*(desc?-1:1);
  assert.equal(windowRangeTest(cell(null),cell(1n),cell(1n),'end-following',desc,'binary',big),direction<=0);
  assert.equal(windowRangeTest(cell(null),cell(null),cell(1n),'end-following',desc,'binary',big),true);
  assert.equal(windowRangeTest(cell(null),cell(null),cell(1n),'start-preceding',desc,'binary',big),false);
 }
});
