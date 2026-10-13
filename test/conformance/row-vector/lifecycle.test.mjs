import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from '../public-api-adapter.mjs';

for(const encoding of ['utf8','utf16le','utf16be'])test(`vector independent slice lifecycle ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':body.length});r.end(body)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  const st=db.prepare('SELECT (?1,?2) = (?3,?4) AS eq, (?1,?2) < (?3,?4) AS lt').statement;
  try{
   for(const [values,expected] of [ [[1n,null,1n,2n],[null,null]], [[1n,null,2n,2n],[0n,1n]], [['a',2n,'a',2n],[1n,0n]], [[new Uint8Array([0]),2n,new Uint8Array([1]),2n],[0n,1n]] ]){
    values.forEach((v,i)=>st.bind(i+1,v));assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1)],expected);assert.equal(await st.step(),'done');st.reset();
   }
  }finally{st.finalize();}
  for(const [sql,expected] of [
   ['SELECT (1,2) IN (VALUES(1,2),(3,4))',1n],
   ['SELECT (1,2) IN (SELECT a,b FROM pairs WHERE 0)',0n],
  ]){
   const st=db.prepare(sql).statement;try{assert.equal(await st.step(),'row');assert.equal(st.column(0),expected);assert.equal(await st.step(),'done');st.reset();assert.equal(await st.step(),'row');assert.equal(st.column(0),expected)}finally{st.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT (SELECT 1,2)'),e=>e.kind==='sqlite'&&e.code===1&&e.message==='sub-select returns 2 columns - expected 1');
  const member=db.prepare('SELECT (?1,?2) IN ((1,NULL),(2,3),(2,3)) AS hit').statement;
  try{
   for(const [values,expected] of [[[1n,9n],null],[[2n,3n],1n],[[4n,null],0n]]){
    values.forEach((v,i)=>member.bind(i+1,v));assert.equal(await member.step(),'row');assert.equal(member.column(0),expected);assert.equal(await member.step(),'done');member.reset();
   }
   const abort=new AbortController();abort.abort();await assert.rejects(member.step({signal:abort.signal}),e=>e.kind==='cancelled');
   try{member.reset()}catch{};
  }finally{member.finalize();}
  for(const options of [{maxWorkUnits:1},{timeoutMs:0}]){
   const bounded=db.prepare('SELECT (1,2) IN ((1,2),(3,4))').statement;
   try{await assert.rejects(bounded.step(options),e=>e.kind==='limit'||e.kind==='timeout');let saved;try{await bounded.step()}catch(e){saved=e}assert.ok(saved);try{bounded.reset()}catch(e){assert.equal(e,saved)}}finally{bounded.finalize()}
  }
  const limited=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:{maxPrivateEntries:1}});
  try{const st=limited.prepare('SELECT (1,2) IN ((1,2),(3,4))').statement;try{await assert.rejects(st.step(),e=>e.kind==='limit');try{st.reset()}catch{}}finally{st.finalize()}}finally{limited.closeDeferred()}
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`vector live controls and scalar widths ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':body.length});r.end(body)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  // Growing fields guarantee real host yields, not just pre-step interruption.
  const sql='SELECT (hex(?1),2) = (hex(?1),2) AS eq';
  for(const mode of ['cancel','deadline']){
   const st=db.prepare(sql).statement;st.bind(1,'x'.repeat(256*1024));
   const abort=new AbortController(),reason=new Error('vector yielded cancel');
   const realNow=Date.now;let ticks=0;
   if(mode==='cancel')setTimeout(()=>abort.abort(reason),0);
   else Date.now=()=>ticks++<10?1000:1002;
   let saved;
   try{await st.step(mode==='cancel'?{signal:abort.signal}:{timeoutMs:2})}catch(e){saved=e}finally{Date.now=realNow}
   assert.ok(saved);assert.equal(saved.kind,mode==='cancel'?'cancelled':'timeout');
   if(mode==='cancel')assert.equal(saved.cause,reason);
   await assert.rejects(st.step(),e=>e===saved);
   assert.throws(()=>st.finalize(),e=>e===saved);
   const reusable=db.prepare('SELECT (SELECT 7), (1,2) = (SELECT 1,2), (1,2) IS (SELECT 1,2 WHERE 0)').statement;
   assert.equal(await reusable.step(),'row');assert.deepEqual([reusable.column(0),reusable.column(1),reusable.column(2)],[7n,1n,0n]);reusable.finalize();
  }
  // First-row multi-column destination; reprepare, names and no-row NULL fields.
  for(let i=0;i<2;i++){
   const st=db.prepare('SELECT (1,2) = (SELECT 1,2 UNION ALL SELECT 9,9) AS first, (NULL,NULL) IS (SELECT 1,2 WHERE 0) AS empty').statement;
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i).name),['first','empty']);
   assert.equal(await st.step(),'row');assert.deepEqual([st.column(0),st.column(1)],[1n,1n]);st.finalize();
  }
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`vector private bytes and held-yield admission ${encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`),{limits:{maxPrivateBytes:1}});
  const st=db.prepare('SELECT (1,2) IN ((1,2),(3,4))').statement;let saved;
  try{await st.step()}catch(e){saved=e}assert.equal(saved?.kind,'limit');
  await assert.rejects(st.step(),e=>e===saved);assert.throws(()=>st.reset(),e=>e===saved);st.finalize();
  const ok=db.prepare('SELECT (1,2)=(1,2)').statement;assert.equal(await ok.step(),'row');ok.finalize();db.closeDeferred();
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  const held=db.prepare('SELECT (hex(?1),2)=(hex(?1),2)').statement;held.bind(1,'x'.repeat(1024*1024));
  const sibling=db.prepare('SELECT 1').statement,abort=new AbortController();
  const pending=held.step({signal:abort.signal});
  await new Promise(resolve=>setTimeout(resolve,0));
  await assert.rejects(sibling.step(),e=>e.kind==='misuse');
  abort.abort();let first;try{await pending}catch(e){first=e}assert.equal(first?.kind,'cancelled');
  assert.throws(()=>held.reset(),e=>e===first);held.finalize();
  assert.equal(await sibling.step(),'row');assert.equal(sibling.column(0),1n);sibling.finalize();
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r));}
});
