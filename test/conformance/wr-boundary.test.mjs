import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {open} from '../../src/index.ts';
import {privateAccounting} from './public-api-adapter.mjs';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere} from '../../src/internal/where-plan.ts';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/wr-boundary-native.json',import.meta.url)));
function cell(s,i){const type=s.columnType(i),v=s.column(i);if(type==='null')return {type};if(type==='blob')return {type,hex:Buffer.from(v).toString('hex')};if(type==='text')return {type,utf8Hex:Buffer.from(v).toString('hex')};if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')};}return {type,value:String(v)};}
async function rows(s){const out=[];while(await s.step()==='row')out.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));return out;}
for(const variant of native.variants)test(`selected WR boundary ${variant.encoding} empty=${variant.empty}`,async()=>{
 const bytes=Buffer.from(variant.fixtureBase64,'base64');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),variant.fixtureSha256);assert.equal(variant.nullPkRc,19);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.invalid/wr-boundary');
  for(const c of variant.cases){
   const storage=ImmutableStorage.open(bytes);try{const schema=loadSchemaGraph({[storageOwner]:storage}),r=expandAndResolveSelect(parseSql(c.sql).statement,schema),p=planWhere(r,{neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[]});assert.ok(p.path);const rhs=p.path.loops.find(l=>l.sourceOrdinal===1);assert.equal(rhs.capability.index?.name,'wr_c');const physical=rhs.capability.physicalIndex;assert.equal(physical.primaryKeyFields.length,2);assert.deepEqual(physical.primaryKeyFields.map(i=>physical.fields[i].column.name),['a','b']);}finally{storage.close();}
   const s=db.prepare(c.sql).statement;try{assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,database:m.database,table:m.table,origin:m.origin}}),c.columns);for(let pass=0;pass<2;pass++){assert.deepEqual(await rows(s),c.rows,c.sql);if(variant.empty)assert.equal(privateAccounting(s).indexSeeks,0);else assert.ok(privateAccounting(s).indexSeeks>0);s.reset();}}finally{s.finalize();}
  }
  if(variant.stalePrimary){db.closeDeferred();const stale=Buffer.from(variant.stalePrimary.fixtureBase64,'base64');globalThis.fetch=async()=>new Response(stale);db=await open('https://fixture.invalid/wr-stale-primary');for(const c of variant.stalePrimary.cases){const s=db.prepare(c.sql).statement;try{for(let pass=0;pass<2;pass++){assert.deepEqual(await rows(s).catch(e=>{e.message+=' SQL: '+c.sql;throw e;}),c.rows,c.sql);s.reset();}}finally{s.finalize();}}}
  if(variant.corruption){db.closeDeferred();const bad=Buffer.from(variant.corruption.fixtureBase64,'base64');globalThis.fetch=async()=>new Response(bad);db=await open('https://fixture.invalid/wr-boundary-bad');for(const c of variant.corruption.cases){
   const s=db.prepare(c.sql).statement;try{for(let pass=0;pass<2;pass++){if(c.rc===11){let error;try{await rows(s);}catch(e){error=e;}assert.equal(error?.kind,'sqlite');assert.match(error.message,/malformed|corrupt|page/i);await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s.reset(),e=>e===error);}else{assert.deepEqual(await rows(s),c.rows);assert.equal(privateAccounting(s).indexSeeks,0);s.reset();}}}finally{s.finalize();}
  }}
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
