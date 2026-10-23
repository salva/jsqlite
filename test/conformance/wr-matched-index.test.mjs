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
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/wr-matched-native.json',import.meta.url)));
for(const enc of ['utf8','utf16le','utf16be'])test(`WR selected matched complete PK ${enc}`,async()=>{
 const bytes=fs.readFileSync(new URL(`./fixtures/advanced-index-${enc}.db`,import.meta.url));
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.invalid/wr-matched');
  for(const c of native.cases.filter(c=>c.encoding===enc)){
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.fixtureSha256);
   const storage=ImmutableStorage.open(bytes);
   try{const schema=loadSchemaGraph({[storageOwner]:storage}),r=expandAndResolveSelect(parseSql(c.sql).statement,schema),p=planWhere(r,{neededColumns:r.sources.map(s=>new Set(s.table.columns)),orderBy:[]});assert.ok(p.path,c.sql);const rhs=p.path.loops.find(l=>l.sourceOrdinal===1);if(c.name.endsWith('-scan')||c.name.endsWith('-not-indexed'))assert.notEqual(rhs.capability.index?.name,'wr_c');else if(!c.name.endsWith('-no-match'))assert.equal(rhs.capability.index?.name,'wr_c',c.sql);}finally{storage.close();}
   const s=db.prepare(c.sql).statement;
   try{for(let pass=0;pass<2;pass++){
    const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const t=s.columnType(i),v=s.column(i);return t==='null'?{type:'null'}:t==='text'?{type:t,utf8Hex:Buffer.from(v).toString('hex')}:{type:t,value:String(v)};}));
    assert.deepEqual(rows,c.rows,c.sql);
    const work=privateAccounting(s);
    if(c.name.endsWith('-scan')||c.name.endsWith('-not-indexed'))assert.equal(work.indexSeeks,0,c.sql);
    else if(!c.name.endsWith('-no-match'))assert.ok(work.indexSeeks>0,c.sql);
    s.reset();
   }}finally{s.finalize();}
  }
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});
