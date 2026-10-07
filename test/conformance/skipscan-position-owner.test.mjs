import test from 'node:test';
import assert from 'node:assert/strict';
import {emitPrefixSeek,beginPrefixLoop,finishPrefixLoop} from '../../src/internal/where-prefix.ts';
import {KeyInfo} from '../../src/internal/comparison.ts';
// wherecode.c aStartOp: zero constraints select Rewind/Last, not Seek*.
test('shared positioning owns zero-constraint forward/reverse transitions',()=>{
 for(const reverse of [false,true]){
  const ops=[];
  const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:1,keyFieldCount:1,terms:[{collation:'binary',descending:false}]});
  const loop=emitPrefixSeek(ops,{restart:null,empty:null},2,[],[],keyInfo,reverse,false);
  assert.equal(loop.seek,0);
  assert.deepEqual(ops,[{code:reverse?'IndexLast':'IndexRewind',p1:2,p2:0}]);
 }
});
test('source skipped-prefix-only start preserves positioned cursor without re-seek',()=>{
 const ops=[];
 const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{collation:'binary',descending:false},{collation:'binary',descending:false}]});
 const loop=emitPrefixSeek(ops,{restart:9,empty:2,nSkip:1},2,[4],['blob'],keyInfo,true,false);
 assert.deepEqual(ops,[{code:'Goto',p2:1}]);
 assert.equal(loop.keys[0],4);
});

test('no-reseek entry preserves first/restart columns and final exhaustion labels',()=>{
 const ops=[];
 const keyInfo=new KeyInfo({encoding:'utf-8',totalFieldCount:2,keyFieldCount:2,terms:[{collation:'binary',descending:false},{collation:'binary',descending:false}]});
 const entry=beginPrefixLoop(ops,2,[4],['blob'],keyInfo,true,1);
 const loop=emitPrefixSeek(ops,entry,2,[4],['blob'],keyInfo,true,false);
 const positioned=loop.seek;
 finishPrefixLoop(ops,loop,ops.length+1);
 assert.equal(ops.filter(op=>op.code==='IndexSeekPrefix').length,1,'only strict restart seeks');
 assert.equal(ops[entry.restart].strict,true);
 assert.equal(ops[entry.empty].code,'IndexLast');
 assert.deepEqual(ops[positioned],{code:'Goto',p2:positioned+1});
 assert.equal(ops[entry.restart].p2,ops.length);
 assert.equal(ops[entry.empty].p2,ops.length);
});
