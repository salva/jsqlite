import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops} from '../../src/internal/where-plan.ts';
const root=new URL('../../docs/research/card-s-g/',import.meta.url),capture=JSON.parse(fs.readFileSync(new URL('lowmul-native.json',root),'utf8'));
test('source low-multiplier SeekScan production and explicit-disabled residual alternatives',()=>{
 for(const v of capture.variants){
  const bytes=fs.readFileSync(new URL(v.fixture,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
  const owner=ImmutableStorage.open(new Uint8Array(bytes)),schema=loadSchemaGraph({[storageOwner]:owner});
  try{for(const c of v.cases){assert.ok(c.rows.length>0);if(c===v.cases[0])assert.ok(c.opcodes.some(op=>op.opcode==='SeekScan'));
   const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema),analysis=analyzeWhere(resolved),source=resolved.sources[0],index=schema.indexes.get('sa');
   const loops=btreeLoops(source,0,analysis.clause,{forcedIndex:index,neededColumns:new Set(source.table.columns.slice(0,4)),orderBy:[],resolved,skipScan:true,inSeekScan:false});
   assert.ok(loops.length>0,'valid prefix/residual alternative');
   assert.ok(!loops.some(loop=>loop.capability?.equalitySlots.some(slot=>slot?.operator==='in')),'explicit-disabled optimization cannot publish ordinary-IN impostor');
   const sourceLoops=btreeLoops(source,0,analysis.clause,{forcedIndex:index,neededColumns:new Set(source.table.columns.slice(0,4)),orderBy:[],resolved});
   const selected=sourceLoops.find(loop=>loop.capability?.inSeekScan);
   assert.ok(selected,'source low-multiplier unfavorable branch owns flag');
   assert.equal(selected.capability.nSkip,0);
   assert.equal(selected.capability.nEq,3);
   if(c.sql.includes('id>0'))assert.equal(selected.capability.lower?.fieldOrdinal,3,'default recursion consumes native physical rowid bound');
   assert.equal(selected.capability.equalitySlots[2].inSeekScan,true);
   assert.equal(selected.capability.equalitySlots[0].inSeekScan,undefined,'flag lives on owning IN, not sibling equality');
   const prefixOnly=btreeLoops(source,0,analysis.clause,{forcedIndex:index,neededColumns:new Set(source.table.columns.slice(0,4)),orderBy:[],resolved,skipScan:true,inSeekScan:true,planBudget:{remaining:2n}});
   assert.ok(prefixOnly.every(loop=>!loop.capability?.inSeekScan),'parent insertion frontier has no child flag');

  }
  }finally{owner.close();}
 }
});
