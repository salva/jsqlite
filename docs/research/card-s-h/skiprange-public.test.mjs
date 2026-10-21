import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import test from 'node:test';import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../../test/conformance/close-test-server.mjs';
const root=new URL('./skiprange-useful/',import.meta.url),cap=JSON.parse(fs.readFileSync(new URL('skiprange-native.json',root))),pub=JSON.parse(fs.readFileSync(new URL('public-native.json',root)));
const canonical=r=>r.map(x=>JSON.stringify(x)).sort();
async function drain(st){const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{const type=st.columnType(i),value=st.column(i);if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(value);return {type,ieee754be:b.toString('hex')}}return type==='text'?{type,utf8Hex:Buffer.from(value).toString('hex')}:{type,hex:Buffer.from(value).toString('hex')}}));return rows}
for(const v of cap.variants)test(`${v.encoding}: useful range metadata errors rebind reset counters`,async()=>{
 const bytes=fs.readFileSync(new URL(v.fixture,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,primary;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/f`));const e=pub.find(x=>x.encoding===v.encoding),st=db.prepare(e.sql).statement;
  try{
   assert.equal(st.columnCount,e.metadata.length);e.metadata.forEach((m,i)=>assert.deepEqual(st.columnMetadata(i),{name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name}));
   for(const run of e.bindings){st.reset();st.bind(1,run.value===null?null:BigInt(run.value));assert.deepEqual(canonical(await drain(st)),canonical(run.rows));const before=privateAccounting(st);st.reset();assert.deepEqual(canonical(await drain(st)),canonical(run.rows));assert.deepEqual(privateAccounting(st),before,'reset must not accumulate actual cursor work')}
  }finally{st.finalize()}
  assert.throws(()=>db.prepare('SELECT missing FROM t'),e2=>e2.code===e.invalidPrepareRc);
 }catch(e){primary=e;throw e}finally{const failures=[];try{db?.closeDeferred()}catch(e){failures.push(e)}try{await closeTestServer(server)}catch(e){failures.push(e)}if(failures.length){if(primary)console.error('secondary cleanup',failures);else throw new AggregateError(failures)}}
});
