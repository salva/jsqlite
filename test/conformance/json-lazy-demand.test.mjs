import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
const oracle=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-lazy-demand-native.json',import.meta.url)));
assert.equal(oracle.sourceId,'2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc');
for(const enc of ['utf8','utf16le','utf16be'])test(`JSONB reached versus unvisited payload ${enc}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  const failures=[];
  const cases=oracle.encodings[enc];
  for(const row of cases){
   let s;
   try{
    s=db.prepare(row.sql).statement;
    if(row.bind)s.bind(1,Uint8Array.from(Buffer.from(row.bind,'hex')));
    assert.equal(s.columnCount,1);
    for(const r of row.runs){
     let primary;
     try{
      let step;try{step=await s.step()}catch(e){primary=e}
      if(r.rc!==100){assert.equal(primary?.kind,'sqlite');assert.equal(primary?.code,r.rc);assert.equal(primary?.message,r.error)}
      else{
       assert.equal(primary?.message,undefined);assert.equal(step,'row');assert.equal(s.columnType(0),r.type);
       const v=s.column(0);assert.equal(r.type==='integer'?String(v):v,r.value);
       assert.equal(r.done,101);assert.equal(await s.step(),'done');
      }
     }catch(e){failures.push({sql:row.sql,error:e.message})}
     let reset;try{s.reset()}catch(e){reset=e}
     if(primary)assert.equal(reset,primary);else assert.equal(reset,undefined);
    }
   }catch(e){failures.push({sql:row.sql,error:e.message})}
   finally{try{s?.finalize()}catch(e){failures.push({sql:row.sql,finalize:e.message})}}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
