import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops} from '../../src/internal/where-plan.ts';
const root=new URL('../../docs/research/card-s-g/stat1-companions/',import.meta.url),capture=JSON.parse(fs.readFileSync(new URL('native.json',root),'utf8'));
test('malformed stat1 is decoded before actual nullable-slot producer admission',()=>{
 for(const v of capture.variants){
  const bytes=fs.readFileSync(new URL(v.fixture.split('/').at(-1),root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
  const owner=ImmutableStorage.open(new Uint8Array(bytes)),schema=loadSchemaGraph({[storageOwner]:owner});
  try{
   const index=schema.indexes.get('ab');assert.ok(index.hasStat1);assert.equal(index.noSkipScan,v.control==='tail-noskip');assert.equal(index.unordered,v.control==='tail-unordered');
   if(v.control==='overflow')assert.equal(index.rowLogEst[1],sqliteLogEst(18n),'uint64 wrapped count, not JS double');
   for(const c of v.cases){
    const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema),analysis=analyzeWhere(resolved);
    const loops=btreeLoops(resolved.sources[0],0,analysis.clause,{forcedIndex:index,neededColumns:new Set([schema.tables.get('t').columns[1]]),orderBy:[],resolved});
    assert.equal(loops.some(l=>l.capability?.nSkip===1),c.nSkip===1,`${v.encoding}/${v.control}`);
   }
  }finally{owner.close();}
 }
});
