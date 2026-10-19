import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
function fixtureRoot(){
 const work=process.env.SAIVAGE_CARD_WORK_ROOT,fixtures=process.env.MULTI_OUTPUT_FIXTURES;assert.ok(work&&fixtures,'set MULTI_OUTPUT_FIXTURES to capture.py output');
 const root=path.join(work,'multi-output-public'),generation=path.join(root,'generations','g');fs.mkdirSync(generation,{recursive:true});
 const catalog=native.encodings.map(e=>{const bytes=fs.readFileSync(path.join(fixtures,path.basename(e.file))),name=e.encoding+'.db';fs.writeFileSync(path.join(generation,name),bytes);return {id:e.encoding,path:name,bytes:bytes.length};});
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:'g'}));fs.writeFileSync(path.join(generation,'catalog.json'),JSON.stringify({semantic:{fixtures:catalog}}));return root;
}
test('wide scan full-row sets, expanded star, parameters and empty merge',async()=>{
 const root=fixtureRoot();const bridge=await startFixtureServer(root);let db,s;
 const rows=async()=>{const r=[];while(await s.step()==='row')r.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));return r;};
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/UTF-8`));
  for(const [sql,expected] of [
   ['SELECT DISTINCT a,b FROM t WHERE a=1 UNION ALL SELECT a,b FROM u WHERE NULL ORDER BY 2,1',[[1n,'a'],[1n,'z']]],
   ['SELECT a,b FROM t WHERE a=1 EXCEPT SELECT a,b FROM u WHERE a=1',[[1n,'z']]],
   ['SELECT a,b FROM t WHERE a=1 INTERSECT SELECT a,b FROM u WHERE a=1',[[1n,'a']]],
   ['SELECT * FROM t WHERE 0 UNION ALL SELECT * FROM u WHERE a=3 ORDER BY 2,1',[[3n,'c',new Uint8Array([3])]]],
  ]){s=db.prepare(sql).statement;assert.deepEqual(await rows(),expected,sql);s.reset();assert.deepEqual(await rows(),expected,sql);s.finalize();s=undefined;}
  s=db.prepare('SELECT a+?,b FROM t WHERE a=? UNION ALL SELECT a+?,b FROM u WHERE a=? ORDER BY 2,1 LIMIT ? OFFSET ?').statement;
  [10n,1n,20n,3n,2n,1n].forEach((v,i)=>s.bind(i+1,v));assert.deepEqual(await rows(),[[11n,'a'],[23n,'c']]);s.reset();assert.deepEqual(await rows(),[[11n,'a'],[23n,'c']]);s.finalize();s=undefined;
  for(const op of ['EXCEPT','INTERSECT']){s=db.prepare(`SELECT a,b FROM t WHERE 0 ${op} SELECT abs(-9223372036854775808),b FROM u ORDER BY 2,1`).statement;assert.deepEqual(await rows(),[]);s.reset();assert.deepEqual(await rows(),[]);s.finalize();s=undefined;}
  for(const sql of ['SELECT a,b FROM t UNION SELECT a FROM u','SELECT a,b FROM t UNION SELECT a,missing FROM u','SELECT a,b FROM t UNION SELECT a,b FROM u ORDER BY 3','SELECT a,b FROM t UNION SELECT a,b FROM u ORDER BY a+b'])assert.throws(()=>db.prepare(sql),e=>e.kind==='sqlite');
 }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});

const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/multi-output-compound-native.json',import.meta.url),'utf8'));
const cell=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex')})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
test('ordinary full-row compounds match independently captured native rows and five-field metadata twice/reset, all encodings',async()=>{
 const bridge=await startFixtureServer(fixtureRoot());let db,s;let attempts=0;
 try{for(const e of native.encodings){db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${e.encoding}`));for(const c of e.cases){attempts++;s=db.prepare(c.sql).statement;assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata,c.sql);for(const run of c.runs){const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>cell(s.column(i))));assert.deepEqual(rows,run.rows,c.sql);s.reset();}s.finalize();s=undefined;}db.closeDeferred();db=undefined;}assert.equal(attempts,72);}
 finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeTestServer(bridge.server)}
});
