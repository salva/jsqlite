import test from 'node:test';
import assert from 'node:assert/strict';
import {transientColumnNames} from '../../src/internal/resolve.ts';
test('select.c unique transient names share resolver and producer owner',()=>{
 const input=['x:','x:','X:','x:1','x:'];
 assert.deepEqual(transientColumnNames(input),['x:','x:1','X:2','x:3','x:4']);
 assert.deepEqual(input,['x:','x:','X:','x:1','x:']);
 assert.ok(Object.isFrozen(transientColumnNames(input)));
 assert.deepEqual(transientColumnNames(['x:9','x:9']),['x:9','x:1']);
});
