import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';import {analyzeWhere,btreeLoops} from '../../src/internal/where-plan.ts';
test('build.c WR duplicate PK compaction versus different-collation append owns skip ordinals',()=>{
 const root=new URL('../../docs/research/card-s-g/',import.meta.url),capture=JSON.parse(fs.readFileSync(new URL('wr-layout-native.json',root),'utf8'));
 for(const v of capture.variants){const bytes=fs.readFileSync(new URL(v.fixture,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);const owner=ImmutableStorage.open(new Uint8Array(bytes));try{
  const schema=loadSchemaGraph({[storageOwner]:owner});
  assert.equal(schema.indexes.get('sqlite_autoindex_w_1').physical.declaredFieldCount,2,'duplicate primary key compacted');
  for(const [name,count,fields,skips,bound]of [['same',2,['c','a','b'],1,2],['different',2,['c','a','a','b'],1,3],['redundant',3,['c','c','a','b'],2,3]]){
   const index=schema.indexes.get(name);assert.equal(index.physical.declaredFieldCount,count);assert.deepEqual(index.physical.fields.map(f=>f.column.name),fields);
   for(const c of v.cases.filter(c=>c.sql.includes(`BY ${name} `))){const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema),analysis=analyzeWhere(resolved),source=resolved.sources[0];const loops=btreeLoops(source,0,analysis.clause,{forcedIndex:index,resolved,neededColumns:new Set(source.table.columns),orderBy:[]});assert.ok(loops.some(l=>l.capability?.nSkip===skips&&l.capability.lower?.fieldOrdinal===bound));}
  }
 }finally{owner.close();}}
});
