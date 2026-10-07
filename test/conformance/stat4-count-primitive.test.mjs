import test from 'node:test';
import assert from 'node:assert/strict';
import * as schema from '../../src/internal/schema.ts';
const requireOwner=(module,name)=>{assert.equal(typeof module[name],'function');return module[name]};

test('decodeIntArray C NUL termination, nondigit and duplicate-row destination reuse',()=>{
 const decode=requireOwner(schema,'decodeStat4Counts');
 assert.deepEqual(decode('3\0 99',3),[3n,0n,0n]);
 assert.deepEqual(decode('x 4',3),[0n,0n,0n],'nondigit without a space does not advance');
 assert.deepEqual(decode('7 ',3),[7n,0n,0n]);
 const previous=[11n,22n,33n];
 assert.equal(decode('5',3,previous),previous,'analysisLoader reuses aiRowEst storage');
 assert.deepEqual(previous,[5n,22n,33n],'short duplicate row preserves untouched slots');
 assert.equal(decode(null,3,previous),previous);
 assert.deepEqual(previous,[5n,22n,33n]);
 assert.deepEqual(decode('18446744073709551615 36893488147419103231',2),[(1n<<64n)-1n,(1n<<64n)-1n]);
});
