import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {JSQLiteError} from '../../src/index.ts';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
async function close(s){await new Promise((r,j)=>s.close(e=>e?j(e):r()))}
async function row(db,sql){const s=db.prepare(sql).statement;try{assert.equal(await s.step(),'row');return Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i),s.columnMetadata(i)])}finally{s.finalize()}}
// Pinned SQLite 3.53.4 source ID bf7c7f30031888f... src/json.c
// jsonArgIsJsonb/jsonParseFuncArg tag-20240123-a public Fetch comparison.
test('non-JSONB BLOB document falls through to text while recognized JSONB remains binary',async()=>{const bridge=await startFixtureServer(root);let db;try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
 const got=await row(db,`SELECT json(x'7B2261223A317D'),json_valid(x'7B2261223A317D'),json_valid(x'7B2261223A317D',2),json_valid(x'7B2261223A317D',4),json_extract(x'7B2261223A317D','$.a'),json_set(x'7B2261223A317D','$.b',2),json(x'33343536'),json_valid(x'33343536',4),json(NULL)`);
 assert.deepEqual(got.map(x=>x.slice(0,2)),[['text','{"a":1}'],['integer',1n],['integer',1n],['integer',0n],['integer',1n],['text','{"a":1,"b":2}'],['text','456'],['integer',1n],['null',null]]);
 assert.deepEqual(got.map(x=>x[2]),Array.from({length:9},(_,i)=>({name:`${['json(x\'7B2261223A317D\')','json_valid(x\'7B2261223A317D\')','json_valid(x\'7B2261223A317D\',2)','json_valid(x\'7B2261223A317D\',4)','json_extract(x\'7B2261223A317D\',\'$.a\')','json_set(x\'7B2261223A317D\',\'$.b\',2)','json(x\'33343536\')','json_valid(x\'33343536\',4)','json(NULL)'][i]}`,declaredType:null,database:null,table:null,origin:null})));
 const malformed=db.prepare(`SELECT json(x'7B')`).statement;await assert.rejects(malformed.step(),e=>e instanceof JSQLiteError&&e.kind==='sqlite'&&e.message==='malformed JSON');assert.throws(()=>malformed.reset(),e=>e.kind==='sqlite');assert.doesNotThrow(()=>malformed.finalize());
 assert.deepEqual((await row(db,`SELECT json_valid(x'7B'),json_valid(x'7B',4),json_valid(x'80'),json(x'CB021331')`)).map(x=>x.slice(0,2)),[['integer',0n],['integer',0n],['integer',0n],['text','[1]']]);
 const classification=await row(db,`SELECT json_valid(x'7B2261223A317D',1),json_valid(x'7B2261223A317D',8),json_valid(x'7B2261223A317D',15),x'7B2261223A317D'->'$.a',x'7B2261223A317D'->>'$.a',typeof(jsonb_set(x'7B2261223A317D','$.b',2)),subtype(jsonb_set(x'7B2261223A317D','$.b',2)),hex(jsonb_set(x'7B2261223A317D','$.b',2)),json(x'5B305D'),json(x'7B7D'),json_valid(x'CB021331',1),json_valid(x'CB021331',4),json_valid(x'CB021331',8),typeof(jsonb(x'CB021331')),subtype(jsonb(x'CB021331')),hex(jsonb(x'CB021331'))`);
 assert.deepEqual(classification.map(x=>x.slice(0,2)),[['integer',1n],['integer',0n],['integer',1n],['text','1'],['integer',1n],['text','blob'],['integer',0n],['text','8C176113311A621332'],['text','[0]'],['text','{}'],['integer',0n],['integer',1n],['integer',1n],['text','blob'],['integer',0n],['text','CB021331']]);
 const each=db.prepare(`SELECT key,value FROM json_each(x'7B2261223A317D')`).statement;try{assert.equal(await each.step(),'row');assert.equal(each.columnText(0),'a');assert.equal(each.columnInteger(1),1n);assert.equal(await each.step(),'done')}finally{each.finalize()}
 const tree=db.prepare(`SELECT fullkey FROM json_tree(x'7B2261223A317D') WHERE atom IS NOT NULL`).statement;try{assert.equal(await tree.step(),'row');assert.equal(tree.columnText(0),'$.a');assert.equal(await tree.step(),'done')}finally{tree.finalize()}

 await assert.rejects(row(db,`SELECT json_array(x'7B2261223A317D')`),e=>e instanceof JSQLiteError&&e.message==='JSON cannot hold BLOB values');
 for(const sql of [`SELECT json_object('a',x'7B7D')`,`SELECT json_set('{}','$.a',x'7B7D')`,`SELECT json_group_array(x'7B7D')`])await assert.rejects(row(db,sql),e=>e instanceof JSQLiteError&&e.message==='JSON cannot hold BLOB values');
 for(const fixture of ['encoding-utf8','encoding-utf16le','encoding-utf16be']){const encoded=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${fixture}`));try{assert.deepEqual((await row(encoded,`SELECT json(x'7B2261223A317D'),json_extract(x'7B2261223A317D','$.a'),json_valid(x'7B2261223A317D'),typeof(jsonb(x'CB021331'))`)).map(x=>x.slice(0,2)),[['text','{"a":1}'],['integer',1n],['integer',1n],['text','blob']])}finally{encoded.closeDeferred()}}
}finally{try{db?.closeDeferred()}catch{}await close(bridge.server)}});
