import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from '../public-api-adapter.mjs';
const native=JSON.parse(fs.readFileSync(new URL('./packed-membership-native.json',import.meta.url)));
function typed(st,i){const type=st.columnType(i),value=st.column(i);if(type==='integer')return{type,value:String(value)};if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(value);return{type,ieee754be:b.toString('hex')}}if(type==='text')return{type,utf8Hex:Buffer.from(value).toString('hex')};if(type==='blob')return{type,hex:Buffer.from(value).toString('hex')};return{type:'null'}}
for(const [encoding,cases] of Object.entries(native.encodings))test(`packed membership pinned-native public metadata and reset ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
 for(const c of cases){const st=db.prepare(c.sql).statement;try{
 const metadata=Array.from({length:st.columnCount},(_,i)=>{const m=st.columnMetadata(i);return Object.fromEntries(['name','declaredType','database','table','origin'].map(key=>[key,m[key]??null]))});
 assert.deepEqual(metadata,c.columns,c.sql);
 for(const expected of c.runs){const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>typed(st,i)));assert.deepEqual(rows,expected,c.sql);st.reset();}
 }finally{st.finalize()}}
 }finally{await db?.close();await new Promise(resolve=>server.close(resolve))}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`packed membership control error identity and admission ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
 for(const operation of [{signal:AbortSignal.abort('packed membership')},{timeoutMs:0}]){
  const st=db.prepare('SELECT p.id,(p.a,p.b) NOT IN (SELECT q.a,q.b FROM pairs q WHERE q.id<p.id) AS hit FROM pairs p ORDER BY p.id').statement;
  let first;try{await st.step(operation);assert.fail('control must fail')}catch(error){first=error;assert.equal(error.kind,'signal' in operation?'cancelled':'timeout')}
  await assert.rejects(st.step(),error=>error===first);
  assert.throws(()=>st.finalize(),error=>error===first);
  const recovery=db.prepare('SELECT 1 IN (VALUES(1)) AS hit').statement;
  try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);assert.equal(await recovery.step(),'done')}finally{recovery.finalize()}
 }
 const suspended=db.prepare('SELECT p.id,(p.a,p.b) IN (SELECT q.a,q.b FROM pairs q WHERE q.id<p.id) FROM pairs p').statement;
 assert.equal(await suspended.step(),'row');db.closeDeferred();suspended.finalize();assert.throws(()=>suspended.finalize(),error=>error.kind==='misuse');db=undefined;
 }finally{await db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`packed MakeRecord in-flight cancellation ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  const st=db.prepare('SELECT (1,?1) IN ((1,?1),(2,NULL)) AS hit').statement;st.bind(1,'x'.repeat(20000));
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort('in-flight packed record'),0);let first;
  try{await st.step({signal:controller.signal});assert.fail('must yield and observe abort')}catch(error){first=error;assert.equal(error.kind,'cancelled')}finally{clearTimeout(timer)}
  assert.throws(()=>st.finalize(),error=>error===first);
  const recovery=db.prepare('SELECT 1 IN (VALUES(1))').statement;try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n)}finally{recovery.finalize()}
 }finally{await db?.close();await new Promise(resolve=>server.close(resolve))}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`correlated LEFT ON packed membership lifecycle ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 const sql='SELECT p.id,r.id FROM pairs p LEFT JOIN pairs r ON p.a=r.a AND r.b IN (SELECT q.b FROM pairs q WHERE q.a=p.a) ORDER BY p.id,r.id';
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const operation of [{signal:AbortSignal.abort('ON membership')},{timeoutMs:0}]){
   const st=db.prepare(sql).statement;let first;
   try{await st.step(operation);assert.fail('control must fail')}catch(error){first=error;assert.equal(error.kind,'signal' in operation?'cancelled':'timeout')}
   await assert.rejects(st.step(),error=>error===first);assert.throws(()=>st.reset(),error=>error===first);st.reset();st.finalize();
   const recovery=db.prepare(sql).statement;try{assert.equal(await recovery.step(),'row');assert.equal(recovery.column(0),1n);assert.equal(recovery.column(1),1n)}finally{recovery.finalize()}
  }
  const suspended=db.prepare(sql).statement;
  assert.equal(await suspended.step(),'row');suspended.reset();assert.equal(await suspended.step(),'row');
  db.closeDeferred();suspended.finalize();db=undefined;
 }finally{await db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
