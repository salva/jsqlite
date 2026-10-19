import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
const oracle=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-quoted-publication-native.json',import.meta.url)));
for(const enc of ['utf8','utf16le','utf16be'])test(`source-owned quoted path ${enc}`,async()=>{
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  const failures=[];
  for(const expected of oracle.encodings[enc].quoted){let s;
   try{
    s=db.prepare(expected.sql).statement;
    assert.equal(s.columnCount,1);
    assert.equal(s.columnMetadata(0).declaredType,null);
    for(let run=0;run<2;run++){
     let error;
     try{
      assert.equal(await s.step(),'row');
      const type=s.columnType(0),value=s.column(0);
      assert.equal(type,expected.type);
      assert.equal(value===null?null:String(value),expected.value);
      assert.equal(await s.step(),'done');
     }catch(e){error=e;}
     if(expected.error){assert.equal(error?.kind,'sqlite');assert.equal(error?.code,1);assert.equal(error?.extendedCode,1);assert.equal(error?.message,expected.error);}
     else if(error)throw error;
     try{s.reset()}catch(e){if(!expected.error||e.message!==expected.error)throw e}
    }
   }catch(e){failures.push({sql:expected.sql,error:e.message})}
   finally{try{s?.finalize()}catch{/* Step assertions above retain each mismatch, including unexpected internal errors. */}}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
