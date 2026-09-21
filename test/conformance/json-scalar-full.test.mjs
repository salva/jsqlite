import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
async function close(s){await new Promise((r,j)=>s.close(e=>e?j(e):r()))}
async function query(db,sql){const s=db.prepare(sql).statement;try{assert.equal(await s.step(),'row');return Array.from({length:s.columnCount},(_,i)=>s.column(i))}finally{s.finalize()}}
async function typed(db,sql){const s=db.prepare(sql).statement;try{assert.equal(await s.step(),'row');return Array.from({length:s.columnCount},(_,i)=>[s.columnType(i),s.column(i)])}finally{s.finalize()}}
test('JSON scalar constructors, inspection, mutation and patch use public VDBE path',async()=>{const bridge=await startFixtureServer(root);let db;try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
 assert.deepEqual(await query(db,String.raw`SELECT json_type('{"a":[1,2]}','$.a'),json_array_length('{"a":[1,2]}','$.a'),json_error_position('{bad'),json_error_position('"abc'),json_error_position('"a\u12"')`),['array',2n,5n,5n,4n]);
 assert.deepEqual(await query(db,`SELECT json_quote('x'),json_array(1,json('{"x":2}')),json_object('a',1,'a',2)`),['"x"','[1,{"x":2}]','{"a":1,"a":2}']);
 assert.deepEqual(await query(db,`SELECT json_insert('{"a":1}','$.b',2),json_replace('{"a":1}','$.a',3),json_set('[1]','$[#]',2),json_remove('{"a":1,"b":2}','$.a')`),['{"a":1,"b":2}','{"a":3}','[1,2]','{"b":2}']);
 assert.deepEqual(await query(db,`SELECT json_patch('{"a":1,"b":2}','{"a":null,"c":3}')`),['{"b":2,"c":3}']);
 assert.deepEqual(await query(db,`SELECT '{"a":[1,2]}' -> 'a','{"a":[1,2]}' ->> '$.a[1]'`),['[1,2]',2n]);
 assert.deepEqual(await query(db,`SELECT json_extract('{"a":1,"a":2}','$.a'),json_set('{"a":{}}','$.a.b',1,'$.a.c',2),json_replace('1','$',2),json_remove('[0,1,2]','$[1]')`),[1n,'{"a":{"b":1,"c":2}}','2','[0,2]']);
 assert.deepEqual(await query(db,`SELECT json_array_insert('[0,2]','$[1]',1),json_array_insert('[0]','$[#]',1)`),['[0,1,2]','[0,1]']);
 const blobs=await typed(db,`SELECT jsonb_array(1,json('{"x":2}')),jsonb_object('a',1),jsonb_set(jsonb('{"a":1}'),'$.b',2),jsonb_patch(jsonb('{"a":1}'),'{"b":2}'),jsonb_array_insert(jsonb('[0,2]'),'$[1]',1)`);
 assert.deepEqual(blobs.map(x=>x[0]),['blob','blob','blob','blob','blob']);assert.ok(blobs.every(([,v])=>v instanceof Uint8Array));
 // Pinned 3.53.4 jsonArrayFunc/jsonObjectFunc/jsonSetFunc/jsonPatchFunc bytes:
 // these distinguish JSONB output from a merely typed or text-round-tripped result.
 assert.deepEqual(blobs.map(([,v])=>Buffer.from(v).toString('hex')),['7b13314c17781332','4c17611331','8c176113311a621332','8c1761133117621332','6b133013311332']);
 const pretty=db.prepare(`SELECT json_pretty('{}')`).statement;
 await assert.rejects(pretty.step(),error=>error?.kind==='unsupported'&&error?.unsupportedClassification==='temporary'&&error?.message==='json_pretty() is temporarily unsupported');
 assert.throws(()=>pretty.finalize(),error=>error?.kind==='unsupported'&&error?.unsupportedClassification==='temporary');
}finally{db?.closeDeferred();await close(bridge.server)}});
