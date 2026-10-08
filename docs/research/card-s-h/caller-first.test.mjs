import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../../test/conformance/close-test-server.mjs';
const root=new URL('./',import.meta.url), evidence=JSON.parse(fs.readFileSync(new URL('caller-native.json',root)));
async function fixture(v,fn){
 const bytes=fs.readFileSync(new URL(v.fixture,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db,primary;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));await fn(db)}catch(e){primary=e;throw e}finally{
  const failures=[];try{db?.closeDeferred()}catch(e){failures.push(e)}try{await closeTestServer(server)}catch(e){failures.push(e)}
  if(failures.length){if(primary)console.error('secondary cleanup',failures);else throw new AggregateError(failures)}
 }
}
async function drain(st){const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{
 const type=st.columnType(i),value=st.column(i);
 if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};
 if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(value);return {type,ieee754be:b.toString('hex')}}
 return type==='text'?{type,utf8Hex:Buffer.from(value).toString('hex')}:{type,hex:Buffer.from(value).toString('hex')};
}));return rows}
for(const v of evidence.variants)for(const c of v.cases){
 test(`${v.encoding}/${c.id}: independent public caller rows metadata reset and actual plan work`,()=>fixture(v,async db=>{
  const st=db.prepare(c.sql).statement;
  try{
   assert.equal(st.columnCount,c.metadata.length);c.metadata.forEach((m,i)=>assert.deepEqual(st.columnMetadata(i),{name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName}));
   assert.deepEqual(await drain(st),c.rows);const a=privateAccounting(st);
   if(c.eqp.some(p=>p==='SCAN t')){assert.equal(a.indexSeeks,0,'native table scan');assert.ok(a.tableNext>0);}
   if(c.eqp.some(p=>p.includes('USING INDEX'))&&c.rows.length)assert.ok(a.indexSeeks>0,'native persistent search');
   assert.equal(a.sorterRows>0,c.eqp.some(p=>p.includes('TEMP B-TREE'))&&c.rows.length>0,'actual ORDER path');
   st.reset();assert.deepEqual(await drain(st),c.rows);assert.deepEqual(privateAccounting(st),a);
  }finally{st.finalize();}
 }));
}
