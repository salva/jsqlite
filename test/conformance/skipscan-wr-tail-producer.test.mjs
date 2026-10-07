import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops} from '../../src/internal/where-plan.ts';
const root=new URL('../../docs/research/card-s-g/',import.meta.url),capture=JSON.parse(fs.readFileSync(new URL('wr-tail-native.json',root),'utf8'));
test('source recursion consumes physical WR PK suffix after skipped declared keys',()=>{
 for(const v of capture.variants){
  const bytes=fs.readFileSync(new URL(v.fixture,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
  const owner=ImmutableStorage.open(new Uint8Array(bytes)),schema=loadSchemaGraph({[storageOwner]:owner});
  try{const c=v.cases[0];assert.ok(c.eqp.some(line=>line.includes('ANY(c)')&&line.includes('a=? AND a=? AND b>?')));
   const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema),analysis=analyzeWhere(resolved),source=resolved.sources[0],index=schema.indexes.get('wc');
   const loops=btreeLoops(source,0,analysis.clause,{forcedIndex:index,neededColumns:new Set(source.table.columns.slice(0,4)),orderBy:[],resolved,skipScan:true});
   assert.ok(c.rows.length>0,'nonempty native suffix baseline');
   assert.ok(loops.some(loop=>loop.capability?.nSkip===1&&loop.capability.nEq===3&&loop.capability.lower?.fieldOrdinal===3),'native-selected lower bound on physical PK suffix missing');
   const gapResolved=expandAndResolveSelect(parseSql(v.cases[1].sql).statement,schema),gap=analyzeWhere(gapResolved),gapLoops=btreeLoops(gapResolved.sources[0],0,gap.clause,{forcedIndex:index,neededColumns:new Set(source.table.columns.slice(0,3)),orderBy:[],resolved:gapResolved,skipScan:true});
   assert.equal(gapLoops.some(loop=>loop.capability?.nSkip===1&&loop.capability.lower?.fieldOrdinal===3),false,'post-equality physical gap remains residual, not fabricated skip');
  }finally{owner.close();}
 }
});
