import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {open,JSQLiteError} from '../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(new URL('./generated-scalar-busy-native.json',import.meta.url)));assert.equal(capture.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const c of capture.cases)test(`${c.encoding}/${c.label}: whole generating lifetime`,async()=>{
 const bytes=Buffer.from(c.image,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.invalid/generated-scalar-busy');globalThis.fetch=old;
 for(let attempt=0;attempt<2;attempt++){
  if(c.errors.length){let actual=null,unexpected;try{unexpected=db.prepare(c.sql).statement;}catch(e){actual=e;}finally{unexpected?.finalize();}assert.ok(actual instanceof JSQLiteError,'native failed prepare must yield typed error and no statement');assert.equal(actual.kind,'sqlite');assert.equal(actual.code,c.errors[attempt].code);assert.equal(actual.message,c.errors[attempt].message);}
  else{const s=db.prepare(c.sql).statement;try{for(let run=0;run<2;run++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const t=s.columnType(i);return [t,t==='integer'?String(s.column(i)):s.column(i)];}));assert.deepEqual(rows,c.rows);s.reset();}}finally{s.finalize();}}
  const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);assert.equal(await recovery.step(),'done');recovery.reset();recovery.finalize();
 }
 }finally{globalThis.fetch=old;db?.close();}
});
