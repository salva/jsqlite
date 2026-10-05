import {prettyCases} from './json-pretty-cases.mjs';
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
for(const encoding of ['utf8','utf16le','utf16be'])test(`json_pretty public Fetch regression ${encoding}`,async()=>{
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
  for(const [sql,expected] of prettyCases){const s=db.prepare(sql).statement;
   assert.equal(s.columnMetadata(0).name,sql.slice(7));
   assert.equal(await s.step(),'row',sql);assert.equal(s.column(0),expected,sql);
   assert.equal(s.columnType(0),expected===null?'null':typeof expected==='bigint'?'integer':'text');
   assert.equal(await s.step(),'done');s.reset();assert.equal(await s.step(),'row');assert.equal(s.column(0),expected);s.finalize();
  }
  const s=db.prepare(`SELECT json_pretty('{bad')`).statement;
  await assert.rejects(s.step(),e=>e.kind==='sqlite'&&e.message==='malformed JSON');
  assert.throws(()=>s.reset(),e=>e.kind==='sqlite');s.finalize();
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
test('pretty append controls and malformed/depth failures retain first error and reset',async()=>{
 const bridge=await startFixtureServer(root);let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`),{limits:{maxResultBytes:1024}});
  for(const [input,options,kind] of [
   ['[1]',{maxWorkUnits:0},'limit'],
   ['[1]',{timeoutMs:0},'timeout'],
   ['['+'1,'.repeat(600)+'1]',{},'limit'],
   ['['.repeat(1001)+'0'+']'.repeat(1001),{},'sqlite'],
  ]){
   const s=db.prepare('SELECT json_pretty(?1)').statement;s.bind(1,input);
   const first=await s.step(options).then(()=>null,e=>e);assert.equal(first?.kind,kind);
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
   s.bind(1,'{}');assert.equal(await s.step(),'row');assert.equal(s.column(0),'{}');s.finalize();
  }
  const abort=new AbortController();abort.abort('pretty abort');const s=db.prepare('SELECT json_pretty(?1)').statement;s.bind(1,'[1]');
  await assert.rejects(s.step({signal:abort.signal}),e=>e.kind==='cancelled');assert.throws(()=>s.finalize(),e=>e.kind==='cancelled');
 }finally{db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
});
