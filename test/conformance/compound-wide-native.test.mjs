import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
function fixtureRoot(){
 const work=process.env.SAIVAGE_CARD_WORK_ROOT,fixtures=process.env.WIDE_COMPOUND_FIXTURES;assert.ok(work&&fixtures,'set WIDE_COMPOUND_FIXTURES to capture.py output');
 const root=path.join(work,'wide-compound-public'),generation=path.join(root,'generations','g');fs.mkdirSync(generation,{recursive:true});
 const catalog=native.encodings.map(e=>{const bytes=fs.readFileSync(path.join(fixtures,path.basename(e.file))),name=e.encoding+'.db';fs.writeFileSync(path.join(generation,name),bytes);return {id:e.encoding,path:name,bytes:bytes.length};});
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:'g'}));fs.writeFileSync(path.join(generation,'catalog.json'),JSON.stringify({semantic:{fixtures:catalog}}));return root;
}
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/compound-wide-native.json',import.meta.url),'utf8'));
const cell=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex')})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
test('wide adversarial full-row compounds match independently captured native rows and five-field metadata twice/reset, all encodings',async()=>{
 const bridge=await startFixtureServer(fixtureRoot());let db,s;let attempts=0;
 try{for(const e of native.encodings){db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${e.encoding}`));for(const c of e.cases){attempts++;s=db.prepare(c.sql).statement;assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata,c.sql);for(const run of c.runs){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s.column(i))));assert.deepEqual(rows,run.rows,c.sql);s.reset();}s.finalize();s=undefined;}db.closeDeferred();db=undefined;}assert.equal(attempts,96);}
 finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});
