import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {open} from '../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(new URL('./generated-consumer-diagnostics-native.json',import.meta.url)));assert.equal(capture.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const c of capture.cases)test(`${c.encoding}/${c.label}: diagnostic repeat and subsequent admission`,async()=>{
 const bytes=Buffer.from(c.image,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.invalid/generated-diagnostic');globalThis.fetch=old;
 for(const expected of c.errors){let actual=null;let unexpected;try{unexpected=db.prepare(c.sql).statement;}catch(e){actual=e;}finally{unexpected?.finalize();}assert.ok(actual,'native prepare error must not publish a statement');assert.equal(actual.kind,'sqlite');assert.equal(actual.code,expected.code);assert.equal(actual.message,expected.message);const s=db.prepare('SELECT 1').statement;assert.equal(await s.step(),'row');assert.equal(s.column(0),1n);assert.equal(await s.step(),'done');s.reset();s.finalize();}
 }finally{globalThis.fetch=old;db?.close();}
});
