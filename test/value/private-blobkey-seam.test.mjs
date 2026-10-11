import test from 'node:test';
import assert from 'node:assert/strict';
import {KeyInfo} from '../../src/internal/comparison.ts';
import {Mem} from '../../src/internal/mem.ts';
import * as sibling from '../../src/internal/private-state.ts';
import * as pages from '../../src/internal/private-blobkey-pages.ts';
const info=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{}]});
const control={async checkpoint(){}};
// Preserve accepted red probe, now also checking the introduced separate owner.
// This explicitly red acceptance gate must not be mistaken for page-foundation credit.
test('existing sibling empty membership is boolean false, not signed IndexMoveto',async()=>{
 const cursor=new sibling.EphemeralIndexCursor(info,{maxEntries:8,maxKeyBytes:64,maxBytes:65536}),key=new Mem();key.setInt64(1n);
 try{assert.equal(await cursor.found([key],control),false);assert.equal(typeof cursor.indexMoveto,'undefined')}
 finally{key.release();cursor.close()}
});
test('separate private page cursor must provide typed IndexMoveto',()=>{
 const candidates=[...Object.values(sibling),...Object.values(pages)].filter(value=>typeof value==='function'&&typeof value.prototype?.indexMoveto==='function');
 assert.ok(candidates.length>0,'private page cursor IndexMoveto missing: boolean found cannot express empty res=-1, interior position, defaultRc/eqSeen or child-acquire restoration');
});
