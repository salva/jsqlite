import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture,privateAccounting} from '../../../test/conformance/public-api-adapter.mjs';
import {closeTestServer} from '../../../test/conformance/close-test-server.mjs';
const root=new URL('./',import.meta.url),first=JSON.parse(fs.readFileSync(new URL('first-native.json',root))),extra=JSON.parse(fs.readFileSync(new URL('public-native.json',root))),edges=JSON.parse(fs.readFileSync(new URL('edge-native.json',root)));
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
for(const v of first.variants){
 const publicEvidence=extra.find(e=>e.encoding===v.encoding);
 for(const c of v.stat4){
  test(`${v.encoding}/${c.id}: public typed rows metadata reset`,()=>fixture(v,async db=>{
   const st=db.prepare(c.sql).statement;try{
    const meta=publicEvidence.cases.find(e=>e.id===c.id).metadata;
    assert.equal(st.columnCount,meta.length);
    for(let i=0;i<meta.length;i++){const m=meta[i];assert.deepEqual(st.columnMetadata(i),{name:m.name,declaredType:m.declaredType,database:m.databaseName,table:m.tableName,origin:m.originName});}
    assert.deepEqual(await drain(st),c.rows);st.reset();assert.deepEqual(await drain(st),c.rows);
   }finally{st.finalize()}
  }));
  test(`${v.encoding}/${c.id}: selected-plan private actual cursor work`,()=>fixture(v,async db=>{
   const st=db.prepare(c.sql).statement;try{
    assert.deepEqual(await drain(st),c.rows);const a=privateAccounting(st);
    // EQP determines qualitative path, not fixture-tuned costs or native VM counts.
    if(c.eqp[0]==='SCAN t'){assert.equal(a.indexSeeks,0,'native selects table scan, not STAT1 index candidate');assert.ok(a.tableNext>0)}
    else{assert.ok(a.indexSeeks>0,'native selected persistent index');
     if(c.eqp[0].includes('COVERING'))assert.equal(a.tableSeeks,0,'covering REAL has no table lookup');else assert.ok(a.tableSeeks>0,'noncovering candidate must seek table');
    }
    assert.equal(a.sorterRows>0,c.eqp.some(p=>p.includes('TEMP B-TREE')),'actual ORDER path');
    st.reset();assert.deepEqual(await drain(st),c.rows);assert.deepEqual(privateAccounting(st),a,'reset counters do not accumulate');
   }finally{st.finalize()}
  }));
 }
 test(`${v.encoding}: parameter same prepare/reset/rebind and error`,()=>fixture(v,async db=>{
  const st=db.prepare(publicEvidence.parameterSql).statement;try{
   for(const run of publicEvidence.bindingRuns){st.reset();st.bind(1,run.binding===null?null:BigInt(run.binding));assert.deepEqual(await drain(st),run.rows)}
  }finally{st.finalize()}
  assert.throws(()=>db.prepare('SELECT missing FROM t'),e=>e.code===publicEvidence.invalidSqlPrepareRc);
 }));
}
for(const v of edges.variants)test(`${v.encoding}/${v.name}: native malformed/control outcomes are success not blanket CORRUPT`,()=>fixture(v,async db=>{
 for(const c of v.stat4){const st=db.prepare(c.sql).statement;try{assert.deepEqual(await drain(st),c.rows);st.reset();assert.deepEqual(await drain(st),c.rows)}finally{st.finalize()}}
}));
