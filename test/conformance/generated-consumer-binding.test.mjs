import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {open} from '../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(new URL('./generated-consumer-native.json',import.meta.url)));const cases=capture.cases;
for(const c of cases)test(`${c.path.split('/').at(-1)} ${c.sql}`,async()=>{
 const bytes=Buffer.from(capture.fixtures[c.path],'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),c.sha256);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,s;
 try{db=await open('https://fixture.invalid/generated');globalThis.fetch=old;s=db.prepare(c.sql).statement;assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata);
 for(let cycle=0;cycle<2;cycle++){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const value=s.column(i),type=s.columnType(i);return [type,type==='integer'?String(value):type==='blob'?Buffer.from(value).toString('hex'):value];}));assert.deepEqual(rows,c.rows);s.reset();}
 s.finalize();s=null;
 }finally{globalThis.fetch=old;s?.finalize();db?.close();}
});
for(const path of Object.keys(capture.fixtures))test(`${path}: generated group limit first error/cleanup`,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(capture.fixtures[path],'base64'));let db,s;
 try{db=await open('https://fixture.invalid/generated',{limits:{maxRows:100,maxResultBytes:1000,maxPrivateBytes:0}});globalThis.fetch=old;s=db.prepare('SELECT v,count(*) FROM t GROUP BY v ORDER BY v').statement;
 await assert.rejects(s.step(),e=>e.kind==='limit');assert.throws(()=>s.reset(),e=>e.kind==='limit');s.finalize();s=null;
 const next=db.prepare('SELECT 1').statement;assert.equal(await next.step(),'row');assert.equal(next.column(0),1n);next.finalize();
 }finally{globalThis.fetch=old;try{s?.finalize();}catch{}db?.close();}
});
