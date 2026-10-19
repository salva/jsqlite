import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const oracle=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-r-a-numeric-native.json',import.meta.url),'utf8'));
assert.equal(oracle.identity.version,'3.53.4');
for(const enc of ['utf8','utf16le','utf16be'])test(`pinned numeric production and error positions ${enc}`,async()=>{
 const bridge=await startFixtureServer(new URL('../fixtures',import.meta.url).pathname);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  for(const c of oracle.cases){
   const s=db.prepare('SELECT json_error_position(?1) AS p,json_valid(?1) AS v,json_valid(?1,2) AS j').statement;
   try{s.bind(1,c.text);for(let pass=0;pass<2;pass++){
    assert.equal(await s.step(),'row');assert.deepEqual([0,1,2].map(i=>s.columnType(i)),['integer','integer','integer']);
    assert.deepEqual([0,1,2].map(i=>s.column(i)),[c.position,c.strict,c.json5].map(BigInt),c.text);
    if(pass===0)s.reset();
   }}finally{s.finalize()}
   const render=db.prepare('SELECT json(?1),hex(jsonb(?1))').statement;
   try{render.bind(1,c.text);if(c.position===0){assert.equal(await render.step(),'row');assert.equal(render.column(0),c.canonical,c.text);assert.equal(render.column(1),c.hex,c.text)}else{
    const bad=e=>e.kind==='sqlite'&&e.message==='malformed JSON';await assert.rejects(render.step(),bad);assert.throws(()=>render.reset(),bad);
   }}finally{render.finalize()}
  }
  const s=db.prepare('SELECT 1').statement;try{assert.equal(await s.step(),'row');assert.equal(s.column(0),1n)}finally{s.finalize()}
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
