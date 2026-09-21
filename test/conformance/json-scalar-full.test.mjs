import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
async function close(s){await new Promise((r,j)=>s.close(e=>e?j(e):r()))}
async function query(db,sql){const s=db.prepare(sql).statement;try{assert.equal(await s.step(),'row');return Array.from({length:s.columnCount},(_,i)=>s.column(i))}finally{s.finalize()}}
test('JSON scalar constructors, inspection, mutation and patch use public VDBE path',async()=>{const bridge=await startFixtureServer(root);let db;try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
 assert.deepEqual(await query(db,`SELECT json_type('{"a":[1,2]}','$.a'),json_array_length('{"a":[1,2]}','$.a'),json_error_position('{bad')`),['array',2n,1n]);
 assert.deepEqual(await query(db,`SELECT json_quote('x'),json_array(1,json('{"x":2}')),json_object('a',1,'a',2)`),['"x"','[1,{"x":2}]','{"a":1,"a":2}']);
 assert.deepEqual(await query(db,`SELECT json_insert('{"a":1}','$.b',2),json_replace('{"a":1}','$.a',3),json_set('[1]','$[#]',2),json_remove('{"a":1,"b":2}','$.a')`),['{"a":1,"b":2}','{"a":3}','[1,2]','{"b":2}']);
 assert.deepEqual(await query(db,`SELECT json_patch('{"a":1,"b":2}','{"a":null,"c":3}')`),['{"b":2,"c":3}']);
 assert.deepEqual(await query(db,`SELECT '{"a":[1,2]}' -> 'a','{"a":[1,2]}' ->> '$.a[1]'`),['[1,2]',2n]);
}finally{db?.closeDeferred();await close(bridge.server)}});
