import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {SelectProgramBuilder,emitSelectDestination} from '../../src/internal/select-program.ts';
const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
function load(){
 const start=source.indexOf('function createSelectDelivery(');
 assert.ok(start>=0,'SELECT delivery has a semantic-phase owner distinct from WHERE movement');
 const end=source.indexOf('\nfunction compileInnerTableSelect(',start);
 return Function('emitSelectDestination',`${stripTypeScriptTypes(source.slice(start,end))};return createSelectDelivery`)(emitSelectDestination);
}
function setup(extra={}){
 const builder=new SelectProgramBuilder();
 const delivery=load()(builder,{first:1,count:2,destination:{kind:'output'},...extra});
 return {builder,delivery};
}
test('inline DISTINCT -> offset -> destination -> limit; duplicate continuation belongs to WHERE',()=>{
 const {builder,delivery}=setup({distinctCursor:3,limit:{count:5,offset:6,capacity:7}});
 delivery.innerLoop();
 const next=builder.ops.length;builder.emit({code:'Next',p1:0,p2:0});
 delivery.continueAt(next);const end=delivery.finish();const ops=builder.finish();
 assert.deepEqual(ops.map(op=>op.code),['Found','IdxInsert','IfPos','ResultRow','DecrJumpZero','Next']);
 assert.equal(ops[0].jump,next);assert.equal(ops[2].p2,next);assert.equal(ops[4].p2,end);
 assert.deepEqual([...delivery.producerStops],[4]);
});
test('sort insertion does not publish, drain owns offset and scalar stop, not RIGHT interior permission',()=>{
 const {builder,delivery}=setup({destination:{kind:'mem',register:9,width:2},limit:{count:5,offset:6,capacity:7},sort:{cursor:4,keyCount:1,emitKeys:()=>{builder.emit({code:'Integer',p1:1n,p2:8});return 8;}}});
 delivery.innerLoop();assert.deepEqual(builder.ops.map(op=>op.code),['Integer','SorterInsert']);
 assert.equal(builder.ops[1].topN,7);
 builder.emit({code:'Return',p1:11});delivery.sortTail();const end=delivery.finish();const ops=builder.finish();
 assert.deepEqual(ops.map(op=>op.code),['Integer','SorterInsert','Return','SorterSort','SorterData','IfPos','Copy','Copy','DecrJumpZero','Goto','SorterNext']);
 assert.equal(ops[3].emptyJump,end);assert.equal(ops[5].p2,10);assert.equal(ops[8].p2,end);assert.equal(ops[9].p2,end);assert.equal(ops[10].p2,4);
 assert.deepEqual([...delivery.producerStops],[],'sort-tail stops must not license RIGHT interior escapes');
});
test('enclosing compound retains unresolved stop operands; inline callback precedes decrement and Exists exit',()=>{
 const stops=[],seen=[];
 const {builder,delivery}=setup({destination:{kind:'exists',register:9},limit:{count:5,capacity:7},compoundStops:stops,emitPositionedRow:()=>{seen.push('row');builder.emit({code:'Integer',p1:1n,p2:9});}});
 delivery.innerLoop();delivery.sortTail();const end=delivery.finish();const ops=builder.finish();
 assert.deepEqual(seen,['row']);assert.deepEqual(stops,[1]);
 assert.deepEqual(ops.map(op=>op.code),['Integer','DecrJumpZero','Goto']);
 assert.equal(ops[1].p2,0,'compound owner, not this producer, resolves limit');assert.equal(ops[2].p2,end);
 assert.deepEqual([...delivery.producerStops],[2]);
});
test('empty sorter and projection errors preserve boundary and original failure',()=>{
 const {builder,delivery}=setup({sort:{cursor:4,keyCount:1,emitKeys:()=>1}});
 delivery.sortTail();const end=delivery.finish();assert.equal(builder.finish()[0].emptyJump,end);
 const error=new Error('projection');const state=setup({emitPositionedRow:()=>{throw error;}});
 assert.throws(()=>state.delivery.innerLoop(),e=>e===error);assert.deepEqual([...state.delivery.producerStops],[]);
});
test('production caller delegates both SELECT phases without moving WHERE or cleanup ownership',()=>{
 const start=source.indexOf('):Program|NonNullable<Program["whereAccounting"]> {',source.indexOf('function compileInnerTableSelect('));
 const body=source.slice(start,source.indexOf('\nfunction sqlName(',start));
 assert.match(body,/createSelectDelivery\(builder,/);assert.match(body,/delivery.innerLoop\(\)/);assert.match(body,/delivery.sortTail\(\)/);assert.match(body,/delivery.continueAt\(nextAt.at\(-1\)!\)/);
 assert.doesNotMatch(body,/owner.compoundLimit.stops.push\(ops.length\)/);
 assert.ok(body.indexOf('delivery.innerLoop()')<body.indexOf('const joinedBodyEnd=ops.length'));
 assert.ok(body.indexOf('delivery.sortTail()')>body.indexOf('const joinedBodyEnd=ops.length'));
 assert.ok(body.indexOf('delivery.finish()')<body.indexOf("code:source.table.kind==='metadata-module'?'MetadataClose'"));
});
