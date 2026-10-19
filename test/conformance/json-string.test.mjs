import assert from 'node:assert/strict';
import test from 'node:test';
import {encodingCases} from './json-native-encoding.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
for(const enc of ['utf8','utf16le','utf16be'])test(`Quoted string production ${enc}`,async()=>{
 const cases=encodingCases('json-string',new URL('./json-string-native.json',import.meta.url),enc,'SELECT json_valid(?1,1),json_valid(?1,2),json_valid(?1,15),json_error_position(?1)');
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
 const s=db.prepare('SELECT json_valid(?1,1),json_valid(?1,2),json_valid(?1,15),json_error_position(?1)').statement;
 try{for(const {hex,storage,expected,render} of cases){s.bind(1,storage==='text'?Buffer.from(hex,'hex').toString('utf8'):Uint8Array.from(Buffer.from(hex,'hex')));assert.equal(await s.step(),'row');assert.deepEqual(Array.from({length:4},(_,i)=>s.columnType(i)),Array(4).fill('integer'));assert.deepEqual(Array.from({length:4},(_,i)=>s.column(i).toString()),expected,hex.slice(0,70));s.reset();assert.equal(await s.step(),'row');assert.deepEqual(Array.from({length:4},(_,i)=>s.column(i).toString()),expected,`reset ${hex.slice(0,70)}`);s.reset();if(render){const t=db.prepare('SELECT hex(json(?1)),hex(jsonb(?1))').statement;try{t.bind(1,storage==='text'?Buffer.from(hex,'hex').toString('utf8'):Uint8Array.from(Buffer.from(hex,'hex')));assert.equal(await t.step(),'row');assert.deepEqual([t.columnType(0),t.columnType(1)],['text','text']);assert.deepEqual([t.column(0),t.column(1)],render,hex)}finally{t.finalize()}}}}
 finally{s.finalize()}
 const budget=db.prepare('SELECT json_error_position(?1)').statement;
 try{budget.bind(1,'"a\tb"');await assert.rejects(budget.step({maxWorkUnits:0}),e=>e.kind==='limit');assert.throws(()=>budget.reset(),e=>e.kind==='limit');assert.equal(await budget.step(),'row');assert.equal(budget.column(0),0n);budget.reset()}finally{budget.finalize()}
 const malformed=e=>e.kind==='sqlite'&&e.message==='malformed JSON';
 const bad=db.prepare('SELECT json(?1)').statement;
 try{bad.bind(1,Uint8Array.of(0x1b,0xff));await assert.rejects(bad.step(),malformed);assert.throws(()=>bad.reset(),malformed)}finally{bad.finalize()}
 const recovery=db.prepare('SELECT json_valid(NULL,8),json_error_position(NULL),json_error_position(1e2),json_valid(1e2,2)').statement;
 try{assert.equal(await recovery.step(),'row');assert.deepEqual([0,1,2,3].map(i=>recovery.columnType(i)),['null','null','integer','integer']);assert.deepEqual([0,1,2,3].map(i=>recovery.column(i)),[null,null,0n,1n])}finally{recovery.finalize()}
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
