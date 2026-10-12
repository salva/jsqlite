import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(`${process.env.SAIVAGE_CARD_WORK_ROOT}/schema-functional/identifiers/identifier-capture.json`));
const pin=JSON.parse(fs.readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,pin.sqliteSourceId);
for(const c of capture.cases)for(const query of c.queries)test(`${c.encoding}/${c.storage}: ${query.sql}`,async()=>{
 const bytes=fs.readFileSync(c.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,st;
 try{
  db=await open('https://fixture.test/identifiers');st=db.prepare(query.sql).statement;
  for(let run=0;run<2;run++){
   const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{
    const type=st.columnType(i),value=st.column(i);
    return type==='null'?{type}:type==='integer'?{type,value:String(value)}:{type,utf8Hex:Buffer.from(value).toString('hex')};
   }));assert.deepEqual(rows,query.rows);st.reset();
  }
 }finally{if(st)st.finalize();if(db)db.close();globalThis.fetch=old;}
});
