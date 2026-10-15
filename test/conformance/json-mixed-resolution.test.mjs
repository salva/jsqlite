import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-d-resolution-native.json',import.meta.url)));
for(const [index,entry] of capture.cases.entries())test(`resolved JSON source ${entry.encoding} ${index}`,async()=>{
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(Buffer.from(capture.fixtures[entry.encoding],'base64'));db=await open('https://fixture.invalid/collision');globalThis.fetch=old;
 assert.throws(()=>db.prepare(entry.sql),e=>e.kind==='sqlite'&&e.code===entry.code&&e.message===entry.message);
 const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');recovery.finalize();
 }finally{globalThis.fetch=old;await db?.close();}
});
