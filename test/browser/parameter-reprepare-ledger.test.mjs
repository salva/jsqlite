import test from 'node:test';
import assert from 'node:assert/strict';
import {browserLedger} from './parameter-reprepare-ledger.mjs';
const encodings=['UTF-8','UTF-16le','UTF-16be'];
test('browser reprepare launch failure records all cases unattempted, not green',()=>{
 const ledger=browserLedger(encodings,[],{error:'launch failed'});
 assert.deepEqual([ledger.declared,ledger.attempted,ledger.passed,ledger.failed,ledger.unattempted],[3,0,0,0,3]);
 assert.deepEqual(ledger.cases.map(c=>c.status),['unattempted','unattempted','unattempted']);
 assert.equal(ledger.error,'launch failed');
 assert.equal(ledger.lane,'browser-public-internal-no-upstream-credit');
});
test('browser reprepare mid-case failure preserves passed prefix and unattempted suffix',()=>{
 const prefix={encoding:encodings[0],runs:[{count:900}]};
 const ledger=browserLedger(encodings,[prefix],{index:1,error:'assertion failed'});
 assert.deepEqual([ledger.declared,ledger.attempted,ledger.passed,ledger.failed,ledger.unattempted],[3,2,1,1,1]);
 assert.deepEqual(ledger.cases.map(c=>c.status),['passed','failed','unattempted']);
 assert.equal(ledger.cases[0].result,prefix);
 assert.equal(ledger.cases[1].error,'assertion failed');
});
test('browser reprepare complete success requires all settled cases',()=>{
 const ledger=browserLedger(encodings,encodings.map(encoding=>({encoding})));
 assert.deepEqual([ledger.attempted,ledger.passed,ledger.failed,ledger.unattempted],[3,3,0,0]);
 assert.ok(ledger.cases.every(c=>c.status==='passed'));
});
