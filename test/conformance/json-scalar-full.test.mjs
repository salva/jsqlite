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
 assert.deepEqual(await query(db,`SELECT json_set('{}',NULL,1,'$.a',2,NULL,3),json_insert('{}',NULL,1,'$.a',2),json_replace('{"a":1}',NULL,8,'$.a',2),json_array_insert('[0]',NULL,8,'$[#]',1)`),['{"a":2}','{"a":2}','{"a":2}','[0,1]']);
 assert.deepEqual(await query(db,`SELECT json_set('{}',NULL,0,'$.a',1,NULL,2,'$.b',3),json_insert('{}',NULL,0,'$.a',1,NULL,2,'$.b',3),json_replace('{"a":0,"b":0}',NULL,0,'$.a',1,NULL,2,'$.b',3),json_array_insert('[0]',NULL,7,'$[#]',1,NULL,8,'$[#]',2)`),['{"a":1,"b":3}','{"a":1,"b":3}','{"a":1,"b":3}','[0,1,2]']);
 assert.deepEqual(await typed(db,`SELECT json_remove('[0,1]','$[0]',char(36),'not reached'),json_remove('[0,1]',char(36),'not reached'),json_remove('[0,1]',NULL,'not reached'),jsonb_remove(jsonb('[0,1]'),'$[0]',char(36),'not reached')`),[['null',null],['null',null],['null',null],['null',null]]);
 assert.deepEqual(await query(db,`SELECT json_set('[0,1,2]','$[#-0]',9),json_set('[0,1,2]','$[#-1]',9),json_set('[0,1,2]','$[#-3]',9),json_set('[0,1,2]','$[#-4]',9)`),['[0,1,2,9]','[0,1,9]','[9,1,2]','[0,1,2]']);
 assert.deepEqual(await query(db,`SELECT json_insert('[0,1,2]','$[#-0]',9),json_insert('[0,1,2]','$[#-1]',9),json_insert('[0,1,2]','$[#-3]',9),json_insert('[0,1,2]','$[#-4]',9)`),['[0,1,2,9]','[0,1,2]','[0,1,2]','[0,1,2]']);
 assert.deepEqual(await query(db,`SELECT json_replace('[0,1,2]','$[#-0]',9),json_replace('[0,1,2]','$[#-1]',9),json_replace('[0,1,2]','$[#-3]',9),json_replace('[0,1,2]','$[#-4]',9)`),['[0,1,2]','[0,1,9]','[9,1,2]','[0,1,2]']);
 assert.deepEqual(await query(db,`SELECT json_remove('[0,1,2]','$[#-0]'),json_remove('[0,1,2]','$[#-1]'),json_remove('[0,1,2]','$[#-3]'),json_remove('[0,1,2]','$[#-4]')`),['[0,1,2]','[0,1]','[1,2]','[0,1,2]']);
 assert.deepEqual(await query(db,`SELECT json_array_insert('[0,1,2]','$[#-0]',9),json_array_insert('[0,1,2]','$[#-1]',9),json_array_insert('[0,1,2]','$[#-3]',9),json_array_insert('[0,1,2]','$[#-4]',9)`),['[0,1,2,9]','[0,1,9,2]','[9,0,1,2]','[0,1,2]']);
 assert.deepEqual(await query(db,`SELECT hex(jsonb_set(jsonb('[0,1,2]'),'$[#-0]',9)),hex(jsonb_set(jsonb('[0,1,2]'),'$[#-1]',9)),hex(jsonb_set(jsonb('[0,1,2]'),'$[#-3]',9)),hex(jsonb_set(jsonb('[0,1,2]'),'$[#-4]',9))`),['8B1330133113321339','6B133013311339','6B133913311332','6B133013311332']);
 assert.deepEqual(await query(db,`SELECT hex(jsonb_insert(jsonb('[0,1,2]'),'$[#-0]',9)),hex(jsonb_insert(jsonb('[0,1,2]'),'$[#-1]',9)),hex(jsonb_insert(jsonb('[0,1,2]'),'$[#-3]',9)),hex(jsonb_insert(jsonb('[0,1,2]'),'$[#-4]',9))`),['8B1330133113321339','6B133013311332','6B133013311332','6B133013311332']);
 assert.deepEqual(await query(db,`SELECT hex(jsonb_replace(jsonb('[0,1,2]'),'$[#-0]',9)),hex(jsonb_replace(jsonb('[0,1,2]'),'$[#-1]',9)),hex(jsonb_replace(jsonb('[0,1,2]'),'$[#-3]',9)),hex(jsonb_replace(jsonb('[0,1,2]'),'$[#-4]',9))`),['6B133013311332','6B133013311339','6B133913311332','6B133013311332']);
 assert.deepEqual(await query(db,`SELECT hex(jsonb_remove(jsonb('[0,1,2]'),'$[#-0]')),hex(jsonb_remove(jsonb('[0,1,2]'),'$[#-1]')),hex(jsonb_remove(jsonb('[0,1,2]'),'$[#-3]')),hex(jsonb_remove(jsonb('[0,1,2]'),'$[#-4]'))`),['6B133013311332','4B13301331','4B13311332','6B133013311332']);
 assert.deepEqual(await query(db,`SELECT hex(jsonb_array_insert(jsonb('[0,1,2]'),'$[#-0]',9)),hex(jsonb_array_insert(jsonb('[0,1,2]'),'$[#-1]',9)),hex(jsonb_array_insert(jsonb('[0,1,2]'),'$[#-3]',9)),hex(jsonb_array_insert(jsonb('[0,1,2]'),'$[#-4]',9))`),['8B1330133113321339','8B1330133113391332','8B1339133013311332','6B133013311332']);
 assert.deepEqual(await typed(db,`SELECT jsonb_set(jsonb('{}'),NULL,0,'$.a',1,NULL,2,'$.b',3),jsonb_insert(jsonb('{}'),NULL,0,'$.a',1,NULL,2,'$.b',3),jsonb_replace(jsonb('{"a":0,"b":0}'),NULL,0,'$.a',1,NULL,2,'$.b',3),jsonb_array_insert(jsonb('[0]'),NULL,7,'$[#]',1,NULL,8,'$[#]',2)`),[['blob',new Uint8Array([140,26,97,19,49,26,98,19,51])],['blob',new Uint8Array([140,26,97,19,49,26,98,19,51])],['blob',new Uint8Array([140,23,97,19,49,23,98,19,51])],['blob',new Uint8Array([107,19,48,19,49,19,50])]]);
 assert.deepEqual(await query(db,`SELECT subtype(jsonb_set(jsonb('{}'),NULL,0,'$.a',1)),typeof(jsonb_set(jsonb('{}'),NULL,0,'$.a',1))`),[0n,'blob']);
 for(const fn of ['json_set','json_insert','json_replace','json_remove','json_array_insert']){const args=fn==='json_remove'?`'[0]','$[#--1]'`:`'[0]','$[#--1]',9`;const malformed=db.prepare(`SELECT ${fn}(${args})`).statement;await assert.rejects(malformed.step(),error=>error?.kind==='sqlite'&&error?.message===`bad JSON path: '$[#--1]'`);assert.throws(()=>malformed.finalize(),error=>error?.kind==='sqlite')}
 const blobs=await typed(db,`SELECT jsonb_array(1,json('{"x":2}')),jsonb_object('a',1),jsonb_set(jsonb('{"a":1}'),'$.b',2),jsonb_patch(jsonb('{"a":1}'),'{"b":2}'),jsonb_array_insert(jsonb('[0,2]'),'$[1]',1),jsonb_set(jsonb('{"a":1}'),'$."b"',2),jsonb_set(jsonb('{"a":1}'),'$."b\\\\n"',2)`);
 assert.deepEqual(blobs.map(x=>x[0]),['blob','blob','blob','blob','blob','blob','blob']);assert.ok(blobs.every(([,v])=>v instanceof Uint8Array));
 // Pinned 3.53.4 jsonArrayFunc/jsonObjectFunc/jsonSetFunc/jsonPatchFunc bytes:
 // these distinguish JSONB output from a merely typed or text-round-tripped result.
 assert.deepEqual(blobs.map(([,v])=>Buffer.from(v).toString('hex')),['7b13314c17781332','4c17611331','8c176113311a621332','8c1761133117621332','6b133013311332','8c176113311a621332','bc1761133149625c5c6e1332']);
 const pretty=db.prepare(`SELECT json_pretty('{}')`).statement;
 await assert.rejects(pretty.step(),error=>error?.kind==='unsupported'&&error?.unsupportedClassification==='temporary'&&error?.message==='json_pretty() is temporarily unsupported');
 assert.throws(()=>pretty.finalize(),error=>error?.kind==='unsupported'&&error?.unsupportedClassification==='temporary');
}finally{db?.closeDeferred();await close(bridge.server)}});
