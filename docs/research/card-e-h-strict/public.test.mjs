import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../../src/index.ts';
import {loadSchemaGraph} from '../../../src/internal/schema.ts';
const receipt=JSON.parse(fs.readFileSync(new URL('./native.json',import.meta.url)));
const pin=JSON.parse(fs.readFileSync(new URL('../../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(receipt.sourceId,pin.sqliteSourceId);
for(const v of receipt.variants)test(`${v.encoding}: STRICT ANY generated retains text and REAL read`,async()=>{
 const bytes=fs.readFileSync(v.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,statement;
 try{
 db=await open('https://fixture.test/strict');
 const table=loadSchemaGraph(db).tables.get('t');
 assert.equal(table.strict,true);assert.equal(table.columns[0].notNull,true);
 assert.equal(table.columns[1].affinity,'blob','STRICT ANY must not gain NUMERIC affinity');
 statement=(await db.prepare(v.sql)).statement;
 assert.equal(await statement.step(),'row');
 assert.deepEqual(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)),['000123','000123','000123',7]);
 assert.deepEqual(Array.from({length:4},(_,i)=>statement.columnType(i)),['text','text','text','real']);
 assert.equal(await statement.step(),'done');
 const pk=loadSchemaGraph(db).tables.get('pk');assert.equal(pk.columns[0].notNull,false);
 for(const [sql,expected] of [
  ["SELECT a,g,s,r FROM t WHERE a='000123' COLLATE NOCASE",[['000123','000123','000123',7]]],
  ["SELECT v FROM pk ORDER BY i",[[new Uint8Array([0,255])],[9223372036854775807n],[null]]],
  ["SELECT a FROM ordinary",[[123n]]]]){
  const query=db.prepare(sql).statement;try{const rows=[];while(await query.step()==='row')rows.push(Array.from({length:query.columnCount},(_,i)=>query.column(i)));assert.deepEqual(rows,expected);}finally{query.finalize();}
 }
statement.reset();assert.equal(await statement.step(),'row');
 }finally{await statement?.finalize();await db?.close();globalThis.fetch=previous;}
});
for(const v of receipt.errors)test(`${v.encoding}/${v.kind}: pinned corruption and ordered type error`,async()=>{
 const bytes=fs.readFileSync(v.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db;
 try{db=await open('https://fixture.test/strict');assert.throws(()=>db.prepare('SELECT * FROM t'),error=>{
 assert.equal(error.code,11);assert.equal(error.kind,'sqlite');
 assert.ok(error.message.includes(v.message.split(' - ')[1]));return true;
 });}finally{await db?.close();globalThis.fetch=previous;}
});
