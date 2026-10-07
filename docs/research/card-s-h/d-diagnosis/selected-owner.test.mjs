import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../../../src/internal/schema.ts';
import {parseSql} from '../../../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../../../src/internal/resolve.ts';
import {planWhere,ROWID_NEEDED,resolvedWhereOrder} from '../../../../src/internal/where-plan.ts';
const root=new URL('../',import.meta.url);
const native=JSON.parse(fs.readFileSync(new URL('first-native.json',root)));
// Verify the chosen physical owner, not just the generic kind 'index'. Native
// EQP is qualitative evidence; no exact cost constants/VM-count calibration.
for(const variant of native.variants)test(`${variant.encoding}: native-selected ab owner survives hot/cold/prefix/range/IN alternation`,()=>{
 const bytes=fs.readFileSync(new URL(variant.fixture,root));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const owner=ImmutableStorage.open(bytes);
 try{
  const schema=loadSchemaGraph({[storageOwner]:owner});
  assert.ok(schema.indexes.size>1,'real competing indexes');
  for(const id of ['hot','rare','prefix','hot','range','literal-in','null','rare']){
   const evidence=variant.stat4.find(c=>c.id===id);
   const resolved=expandAndResolveSelect(parseSql(evidence.sql).statement,schema);
   const budget={remaining:20000n,reserveProbe:n=>owner.reserveSchemaTemporary(n)};
   const result=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set([...s.table.columns,ROWID_NEEDED])),orderBy:resolvedWhereOrder(resolved),planBudget:budget});
   const loop=result.path.loops[0];
   if(evidence.eqp[0]==='SCAN t'){
    assert.equal(loop.kind,'table-scan');assert.equal(loop.capability?.index??null,null);assert.ok(budget.truth.secondPass);
   }else{
    const name=/USING (?:COVERING )?INDEX (\S+)/.exec(evidence.eqp[0])[1];
    assert.equal(loop.kind,'index');assert.equal(loop.capability.index,schema.indexes.get(name),'selected exact schema owner');
    assert.equal(loop.capability.physicalIndex,loop.capability.index.physical,'selected exact physical descriptor');
   }
   assert.equal(owner.schemaTemporaryBytes,0);
  }
 }finally{owner.close();}
});
