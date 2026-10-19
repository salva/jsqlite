import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {closeTestServer} from './close-test-server.mjs';
const original=JSON.parse(readFileSync(new URL('../../docs/research/card-r-b-numeric-native.json',import.meta.url)));
const bytes=readFileSync(new URL('../../docs/research/card-r-b-numeric-encodings-native.json',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'a6328d0ca838cedb5c98bd976efe147d19277691450eb814f76e27f564bded77');
const oracle=JSON.parse(bytes);
assert.equal(oracle.sourceId,original.sourceId);
assert.equal(original.cases.length,506);
assert.deepEqual(oracle.variants.map(v=>v.encoding),['UTF-8','UTF-16le','UTF-16be']);
const ieee754be=value=>{const b=Buffer.alloc(8);b.writeDoubleBE(value);return b.toString('hex')};
for(const [index,enc] of ['utf8','utf16le','utf16be'].entries())test(`source-owned numeric header semantics ${enc}`,async()=>{
 const cases=oracle.variants[index].cases;
 assert.deepEqual(cases.map(c=>c.sql),original.cases.map(c=>c.sql));
 assert.deepEqual(cases.map(c=>c.old),original.cases);
 const bridge=await startFixtureServer(path.resolve(new URL('../fixtures',import.meta.url).pathname));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${enc}`));
  const failures=[];
  for(const expected of cases){let s;
   const record=(phase,e)=>failures.push({sql:expected.sql,phase,error:e.stack??String(e)});
   const checkError=(e,run)=>{assert.equal(e?.kind,'sqlite');assert.equal(e.code,run.rc);assert.equal(e.extendedCode,run.rc);assert.equal(e.message,run.error)};
   try{
    s=db.prepare(expected.sql).statement;
    assert.equal(s.columnCount,expected.metadata.length);
    for(let i=0;i<s.columnCount;i++)assert.deepEqual(s.columnMetadata(i),expected.metadata[i]);
    assert.equal(expected.runs.length,2);
    for(const [index,run] of expected.runs.entries()){
     try{
      if(run.rc!==100){let error;try{await s.step()}catch(e){error=e}checkError(error,run)}
      else{
       assert.equal(await s.step(),'row');
       for(const [i,v] of run.values.entries()){
        assert.equal(s.columnType(i),v.type);const value=s.column(i);
        if(v.type==='real'){assert.equal(typeof value,'number');assert.equal(ieee754be(value),v.ieee754be)}
        else if(v.type==='integer'){assert.equal(typeof value,'bigint');assert.equal(String(value),v.value)}
        else if(v.type==='blob'){assert.ok(value instanceof Uint8Array);assert.equal(Buffer.from(value).toString('hex').toUpperCase(),v.value)}
        else if(v.type==='null')assert.equal(value,null);
        else assert.equal(value,v.value);
       }
       assert.equal(await s.step(),'done');
      }
     }catch(e){record(`step ${index}`,e)}
     try{let error;try{s.reset()}catch(e){error=e}if(run.rc!==100)checkError(error,run);else assert.equal(error,undefined)}catch(e){record(`reset ${index}`,e)}
    }
   }catch(e){record('prepare/metadata',e)}
   finally{try{s?.finalize()}catch(e){record('finalize',e)}}
  }
  assert.deepEqual(failures,[]);
 }finally{db?.closeDeferred();await closeTestServer(bridge.server)}
});
