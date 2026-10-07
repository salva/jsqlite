import assert from 'node:assert/strict';
import {after} from 'node:test';
import {IndexCursor} from '../../src/internal/btree.ts';

// Run independently captured native/public ordinary operand matrix through the
// actual VDBE handler. This assertion distinguishes primitive integration from
// output equality with an unconsumed helper. Public API remains unchanged.
const original=IndexCursor.prototype.seekKey;
const directions=new Map();
IndexCursor.prototype.seekKey=function(values,keyInfo,direction){
 directions.set(direction,(directions.get(direction)??0)+1);
 return original.call(this,values,keyInfo,direction);
};
after(()=>{
 IndexCursor.prototype.seekKey=original;
 assert.ok(directions.get('ge')>0,'production IndexSeekPrefix consumed GE through shared owner');
 console.log('production seek directions',Object.fromEntries(directions));
});
await import('./where-operand-admission-public.test.mjs');
