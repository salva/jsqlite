import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';

// Independent source-ID checked native-before captures: card-t-b
// json-window-entry-repair/json-native-before.log. Preserve types and names.
test('shared JSON producer binding, typed drains, metadata, reset and atomic admission', async () => {
 const g=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${g}/generated/empty.db`,import.meta.url));
 const original=globalThis.fetch;let db;
 try {globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/empty');} finally {globalThis.fetch=original;}
 try {
  for(const [sql,input,names,want] of [
   ['SELECT atom FROM json_each(?1) ORDER BY atom DESC LIMIT 2','[1,2,4]',['atom'],[[['integer',4n]],[['integer',2n]]]],
   ['SELECT count(*), sum(atom) FROM json_each(?1)','[1,2,4]',['count(*)','sum(atom)'],[[['integer',3n],['integer',7n]]]],
   ['SELECT o.fullkey,i.atom FROM json_each(?1) o,json_each(o.value) i WHERE i.atom>3','[[1,5],[7]]',['fullkey','atom'],[[['text','$[0]'],['integer',5n]],[['text','$[1]'],['integer',7n]]]],
  ]) {
   const s=db.prepare(sql).statement;
   try {assert.deepEqual(names.map((_,i)=>s.columnMetadata(i).name),names);s.bind(1,input);
    for(let pass=0;pass<2;pass++){const rows=[];while(await s.step()==='row')rows.push(names.map((_,i)=>[s.columnType(i),s.column(i)]));assert.deepEqual(rows,want);assert.equal(await s.step(),'done');if(!pass)s.reset();}
   } finally {s.finalize();}
  }
  assert.throws(()=>db.prepare('SELECT DISTINCT atom FROM json_each(?1)'),e=>e.kind==='unsupported');
  const s=db.prepare('SELECT atom FROM json_each(?1) LIMIT 0').statement;try{s.bind(1,'[1,2]');assert.equal(await s.step(),'done');s.reset();assert.equal(await s.step(),'done');}finally{s.finalize();}
 } finally {db.close();}
});
