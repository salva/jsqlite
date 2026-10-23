import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,ROWID_NEEDED} from '../../src/internal/where-plan.ts';
const receipt=JSON.parse(fs.readFileSync(new URL('./three-source-native.json',import.meta.url)));
for(const c of receipt.cases){
 const storage=ImmutableStorage.open(c.fixtureBase64?Buffer.from(c.fixtureBase64,'base64'):fs.readFileSync(new URL('../../test/conformance/fixtures/advanced-index-'+c.encoding+'.db',import.meta.url)));
 try{
  const schema=loadSchemaGraph({[storageOwner]:storage});
  const r=expandAndResolveSelect(parseSql(c.sql).statement,schema);
  const p=planWhere(r,{neededColumns:r.sources.map(s=>new Set([...s.table.columns,ROWID_NEEDED])),orderBy:[]});
  // Outer-join lowering consumes loops by original ordinal, not solver order.
  // Every selected probe must therefore be ready in that actual prefix too.
  let available=0n;for(const loop of p.path?.loops??[]){assert.equal(loop.prereq&~available,0n,c.sql);available|=1n<<BigInt(loop.sourceOrdinal);}
  for(const loop of p.path?.loops??[]){const prefix=(1n<<BigInt(loop.sourceOrdinal))-1n;assert.equal(loop.prereq&~prefix,0n,'source-order caller availability: '+c.sql);}
  for(const sql of [
   'SELECT l.id FROM m l RIGHT JOIN m r ON l.id=r.id RIGHT JOIN m z ON r.id=z.id',
   'SELECT l.id FROM m l RIGHT JOIN m r ON l.id=r.id CROSS JOIN m z CROSS JOIN m q',
   'SELECT id FROM m l RIGHT JOIN m r USING(id)',
   'SELECT l.a FROM wr l RIGHT JOIN wr r ON l.a=r.a',
  ]){
   const unsupported=expandAndResolveSelect(parseSql(sql).statement,schema);
   assert.equal(planWhere(unsupported,{neededColumns:unsupported.sources.map(s=>new Set(s.table.columns)),orderBy:[]}).path,null,'named selected-layout boundary: '+sql);
  }
  const loops=p.path?.loops.map(l=>({source:l.sourceOrdinal,kind:l.kind,index:l.capability.index?.name}));
  console.log(JSON.stringify({encoding:c.encoding,name:c.name,nativeRows:c.rows.length,nativeEqp:c.eqp,path:loops??null,candidates:p.plannerCandidates,paths:p.plannerPaths}));
  if(c.name==='right'&&!process.argv.includes('--selected')){assert.equal(p.path,null);assert.equal(p.plannerCandidates,0);}
  else {assert.ok(p.path);const rhs=c.name==='right-last'?2:1;if(c.name.endsWith('-scan')||c.name==='wrong-alias'||c.name==='partial-unproven')assert.equal(p.path.loops.find(l=>l.sourceOrdinal===rhs).capability.index,null);else assert.equal(p.path.loops.find(l=>l.sourceOrdinal===rhs).capability.index?.name,c.name==='expression'?'e_expr':c.name==='partial'?'p_live':'m_abc');}
 }finally{storage.close();}
}
console.log(process.argv.includes('--selected')?'SELECTED: three-source RIGHT and CROSS-only control select RHS m_abc':'RED CONFIRMED: three-source RIGHT has no selected candidates; CROSS-only control selects RHS m_abc');
