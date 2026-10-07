import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops} from '../../src/internal/where-plan.ts';
const root=new URL('../../docs/research/card-s-g/',import.meta.url),capture=JSON.parse(fs.readFileSync(new URL('tail-native.json',root),'utf8'));
test('source recursion consumes physical rowid suffix after skipped declared keys',()=>{
 for(const v of capture.variants){
  const bytes=fs.readFileSync(new URL(v.fixture,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
  const owner=ImmutableStorage.open(new Uint8Array(bytes)),schema=loadSchemaGraph({[storageOwner]:owner});
  try{const c=v.cases[0];assert.ok(c.eqp.some(line=>line.includes('ANY(a)')&&line.includes('rowid>?')));
   const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema),analysis=analyzeWhere(resolved),source=resolved.sources[0],index=schema.indexes.get('sa');
   const loops=btreeLoops(source,0,analysis.clause,{forcedIndex:index,neededColumns:new Set(source.table.columns.slice(0,4)),orderBy:[],resolved,skipScan:true});
   assert.ok(loops.some(loop=>loop.capability?.nSkip===1&&loop.capability.nEq===3&&loop.capability.lower?.fieldOrdinal===3),'native-selected lower bound on physical rowid tail missing');
  }finally{owner.close();}
 }
});
