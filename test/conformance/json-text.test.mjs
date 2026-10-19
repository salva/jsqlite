import assert from 'node:assert/strict';
import test from 'node:test';
import {encodingCases} from './json-native-encoding.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
for(const enc of ['utf8','utf16le','utf16be'])test(`TEXT fallback escape ownership ${enc}`,async()=>{
 const cases=encodingCases('json-text',new URL('./json-text-native.json',import.meta.url),enc,'SELECT json_valid(?1,1),json_valid(?1,2),json_valid(?1,4),json_valid(?1,8),json_valid(?1,15),json_error_position(?1)');
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
 const s=db.prepare('SELECT json_valid(?1,1),json_valid(?1,2),json_valid(?1,4),json_valid(?1,8),json_valid(?1,15),json_error_position(?1)').statement;
 try{for(const {hex,storage,expected} of cases){s.bind(1,storage==='text'?Buffer.from(hex,'hex').toString('utf8'):Uint8Array.from(Buffer.from(hex,'hex')));assert.equal(await s.step(),'row');assert.deepEqual(Array.from({length:6},(_,i)=>s.columnType(i)),Array(6).fill('integer'));assert.deepEqual(Array.from({length:6},(_,i)=>s.column(i).toString()),expected,hex.slice(0,70));s.reset();assert.equal(await s.step(),'row');assert.deepEqual(Array.from({length:6},(_,i)=>s.column(i).toString()),expected,`reset ${hex.slice(0,70)}`);s.reset();}}
 finally{s.finalize()}
 // The label producer must preserve raw spelling/tag, not just error offsets.
 const labels=db.prepare("SELECT json('{i\\u0061:0}'),hex(jsonb('{i\\u0061:0}')),json_extract('{i\\u0061:0}','$.ia')").statement;
 try{assert.equal(await labels.step(),'row');assert.deepEqual([0,1,2].map(i=>labels.column(i)),['{"i\\u0061":0}','AC78695C75303036311330',0n])}finally{labels.finalize()}
 const budget=db.prepare('SELECT json_error_position(?1)').statement;
 try{budget.bind(1,Uint8Array.from(Buffer.from('7b695c755a5a5a5a','hex')));await assert.rejects(budget.step({maxWorkUnits:0}),e=>e.kind==='limit');assert.throws(()=>budget.reset(),e=>e.kind==='limit');assert.equal(await budget.step(),'row');assert.equal(budget.column(0),BigInt(cases.find(c=>c.hex==='7b695c755a5a5a5a'&&c.storage!=='text').expected.at(-1)));budget.reset()}finally{budget.finalize()}
 const malformed=e=>e.kind==='sqlite'&&e.message==='malformed JSON';
 const bad=db.prepare('SELECT json(?1)').statement;
 try{bad.bind(1,Uint8Array.of(0x1b,0xff));await assert.rejects(bad.step(),malformed);assert.throws(()=>bad.reset(),malformed)}finally{bad.finalize()}
 const recovery=db.prepare('SELECT json_valid(NULL,8),json_error_position(NULL),json_error_position(1e2),json_valid(1e2,2)').statement;
 try{assert.equal(await recovery.step(),'row');assert.deepEqual([0,1,2,3].map(i=>recovery.columnType(i)),['null','null','integer','integer']);assert.deepEqual([0,1,2,3].map(i=>recovery.column(i)),[null,null,0n,1n])}finally{recovery.finalize()}
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
