import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadSchemaGraph} from '../../../src/internal/schema.ts';
import {open} from '../../../src/index.ts';
// Independent manifest-pinned attach.c/walker.c error order capture, not a
// predicted error derived from the TypeScript grammar traversal.
const root=`${process.env.SAIVAGE_CARD_WORK_ROOT}/trigger-walker-red`;
const evidence=JSON.parse(fs.readFileSync(`${root}/capture.json`));
const pin=JSON.parse(fs.readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(evidence.sourceId,pin.sqliteSourceId);
for(const item of evidence.cases)test(`${item.encoding}/${item.label??"order-filter"}: native Window fixation order`,async()=>{
 const bytes=fs.readFileSync(item.path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{
  db=await open('https://fixture.test/walker');
  // Failed construction must not publish a partially fixed graph: repeat the
  // same read on the existing owner and require the identical native error.
  for(let i=0;i<2;i++){
   if(item.code===0){const prepared=db.prepare('SELECT a FROM t');prepared.statement.finalize();
    const graph=loadSchemaGraph(db),trigger=graph.triggers.get('log');
    assert.ok(Object.isFrozen(trigger.initializedSteps));
    if(['frame-nonconstant','frame-id','frame-function','frame-deep'].includes(item.label)){
     assert.ok(JSON.stringify(trigger.declaration.steps).includes('bounddb')||JSON.stringify(trigger.declaration.steps).includes('startdb'),'parsed original retained');
     assert.ok(JSON.stringify(trigger.initializedSteps).includes('windowOffsetNormalized'),'semantic bound normalized');
     const originalNodes=new Set(),originalPending=trigger.declaration.steps.map(step=>step.select);
     while(originalPending.length){const value=originalPending.pop();if(!value||originalNodes.has(value))continue;originalNodes.add(value);if(value.kind==='reduction')originalPending.push(...value.children);}
     const pending=trigger.initializedSteps.map(step=>step.select);let normalized=0;
     while(pending.length){const value=pending.pop();if(!value||value.kind==='terminal')continue;
      if(value.semantic?.windowOffsetNormalized){normalized++;assert.ok(Object.isFrozen(value));
       if(value.signature==='term ::= NULL|FLOAT|BLOB'){
        const terminal=value.children[0];
        assert.ok(Object.isFrozen(value.children));
        assert.ok(Object.isFrozen(terminal),'synthetic NULL terminal is immutable');
        assert.ok(Object.isFrozen(terminal.value));
        assert.throws(()=>{terminal.tokenId=999;},TypeError);
        assert.throws(()=>{terminal.value.text='changed';},TypeError);
        assert.equal(terminal.value.text,'NULL');
        assert.ok(!originalNodes.has(value),'normalized NULL does not replace parsed original');
        assert.ok(!originalNodes.has(terminal),'synthetic terminal is not shared with parsed original');
       }
      }
      for(const child of value.children)pending.push(child);
      if(value.signature.startsWith('frame_bound ::='))assert.ok(!JSON.stringify(value.children).includes('dbnm ::= DOT nm'),'semantic bound omits subqueries');
     }
     assert.ok(normalized>0);
    }}
   else assert.throws(()=>db.prepare('SELECT a FROM t'),error=>error.code===item.code&&error.message===item.message);
  }
 }finally{db?.close();globalThis.fetch=old;}
});
