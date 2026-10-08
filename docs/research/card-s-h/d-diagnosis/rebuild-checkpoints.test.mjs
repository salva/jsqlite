import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ImmutableStorage,storageOwner} from '../../../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../../../src/internal/schema.ts';
import {parseSql} from '../../../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../../../src/internal/resolve.ts';
import {planWhere,ROWID_NEEDED,resolvedWhereOrder} from '../../../../src/internal/where-plan.ts';
// where.c whole-loop HIGHTRUTH reconstruction + vdbemem.c ProbeFree:
// sweep actual cooperative callback boundaries, including the rebuild.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: every hot reconstruction progress boundary releases probe ownership and retries`,()=>{
 const owner=ImmutableStorage.open(fs.readFileSync(new URL(`../${encoding}.db`,import.meta.url)));
 try{
  const schema=loadSchemaGraph({[storageOwner]:owner});const permanent=owner.schemaBytes;
  const resolved=expandAndResolveSelect(parseSql('SELECT id,r,b FROM t WHERE a=0 ORDER BY id').statement,schema);
  const run=(fail=-1)=>{
   let calls=0,allocations=0;const primary=new Error(`progress/${fail}`);
   const budget={remaining:20000n,reserveProbe:n=>{allocations++;return owner.reserveSchemaTemporary(n);},progressCheck:()=>{if(calls++===fail)throw primary;}};
   if(fail>=0){assert.throws(()=>planWhere(resolved,{neededColumns:[new Set([...resolved.sources[0].table.columns,ROWID_NEEDED])],orderBy:resolvedWhereOrder(resolved),planBudget:budget}),e=>e===primary);assert.equal(calls,fail+1);}
   else{const result=planWhere(resolved,{neededColumns:[new Set([...resolved.sources[0].table.columns,ROWID_NEEDED])],orderBy:resolvedWhereOrder(resolved),planBudget:budget});assert.ok(budget.truth.secondPass);assert.equal(result.path.loops[0].kind,'table-scan');}
   assert.equal(owner.schemaTemporaryBytes,0);assert.equal(owner.schemaBytes,permanent);
   return {calls,allocations};
  };
  const baseline=run();assert.ok(baseline.calls>1);assert.ok(baseline.allocations>1);
  for(let fail=0;fail<baseline.calls;fail++){run(fail);assert.deepEqual(run(),baseline,'same-owner full reconstruction must remain deterministic');}
 }finally{owner.close();}
 assert.equal(owner.schemaBytes,0);assert.equal(owner.schemaTemporaryBytes,0);
});
