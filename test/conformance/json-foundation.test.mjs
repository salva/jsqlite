import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
async function withDb(run){const bridge=await startFixtureServer(root);let db;try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));await run(db)}finally{try{db?.closeDeferred()}catch{}await new Promise((r,j)=>bridge.server.close(e=>e?j(e):r()))}}
async function row(db,sql,options){const s=db.prepare(sql).statement;try{assert.equal(await s.step(options),'row');return Array.from({length:s.columnCount},(_,i)=>s.column(i))}finally{s.finalize()}}
test('JSON foundation matches pinned 3.53.4 canonical, JSON5, subtype, NULL and JSONB cases',async()=>withDb(async db=>{
 assert.deepEqual(await row(db,`SELECT json('{a:1,a:2}'),json('0x10'),json('+1'),json('.5'),json('Infinity'),json('NaN')`),['{"a":1,"a":2}','16','1','0.5','9e999','null']);
 assert.deepEqual(await row(db,`SELECT json_valid('{a:1}'),json_valid('{a:1}',2),json_valid(NULL),json(NULL),jsonb(NULL),subtype(json('{}')),subtype(jsonb('{}'))`),[0n,1n,null,null,null,74n,0n]);
 assert.deepEqual(await row(db,`SELECT hex(jsonb('0x10')),hex(jsonb('+1')),hex(jsonb('.5')),hex(jsonb('Infinity')),hex(jsonb('NaN')),hex(jsonb('{a:1,a:2}'))`),['4430783130','1331','262E35','553965393939','00','8C1761133117611332']);
 assert.deepEqual(await row(db,`SELECT json(x'CB021331'),hex(jsonb(x'CB021331')),json_valid(x'CB021331',4),json_valid(x'CB021331',8),json_valid(x'CB031331',8),json_valid(x'CB0213',8)`),['[1]','CB021331',1n,1n,0n,0n]);
}));
test('JSON malformed, depth, work and output failures are typed and lifecycle-safe',async()=>withDb(async db=>{
 for(const sql of [`SELECT json('{')`,`SELECT json(x'CB0213')`]){const s=db.prepare(sql).statement;await assert.rejects(s.step(),e=>e.kind==='sqlite'&&e.message==='malformed JSON');assert.throws(()=>s.reset(),e=>e.kind==='sqlite');}
 const deep='['.repeat(1001)+'0'+']'.repeat(1001);assert.deepEqual(await row(db,`SELECT json_valid('${deep}')`),[0n]);
 {const s=db.prepare(`SELECT json('[1,2,3]')`).statement;await assert.rejects(s.step({maxWorkUnits:0}),e=>e.kind==='limit');assert.throws(()=>s.finalize(),e=>e.kind==='limit')}
 const bridge2=await startFixtureServer(root);let limited;try{limited=await openFixture(new Request(`http://127.0.0.1:${bridge2.port}/fixture/${bridge2.token}/empty`),{limits:{maxResultBytes:2}});const s=limited.prepare(`SELECT json('[123]')`).statement;await assert.rejects(s.step(),e=>e.kind==='limit'&&e.message==='string or blob too big');assert.throws(()=>s.finalize(),e=>e.kind==='limit')}finally{try{limited?.closeDeferred()}catch{}await new Promise((r,j)=>bridge2.server.close(e=>e?j(e):r()))}
 assert.deepEqual(await row(db,'SELECT 1'),[1n]);
}));
