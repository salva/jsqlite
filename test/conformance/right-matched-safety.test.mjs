import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {openFixture, privateAccounting} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {ImmutableStorage, storageOwner} from '../../src/internal/storage.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {planWhere} from '../../src/internal/where-plan.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/right-matched-safety-native.json',import.meta.url)));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function rows(s){const result=[];while(await s.step()==='row')result.push(Array.from({length:s.columnCount},(_,i)=>s.columnType(i)==='null'?{type:'null'}:{type:s.columnType(i),value:String(s.column(i))}));return result;}
async function saved(s,error,finish){await assert.rejects(s.step(),e=>e===error);assert.throws(()=>s[finish](),e=>e===error);}
for(const variant of native.variants)test(`selected RIGHT/FULL safety ${variant.encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/'+variant.fixture,import.meta.url));assert.equal(sha(bytes),variant.sha256);
 assert.equal(bytes[variant.offset],variant.original);const corrupt=Buffer.from(bytes);corrupt[variant.offset]=0;assert.equal(sha(corrupt),variant.corruptSha256);
 const storage=ImmutableStorage.open(bytes);
 try{const schema=loadSchemaGraph({[storageOwner]:storage});for(const c of variant.cases.filter(c=>c.mode!=='capacity').filter(c=>c.mode!=='scan')){const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema),p=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[]});assert.ok(p.path);assert.deepEqual(p.path.loops.map(l=>l.sourceOrdinal),[0,1]);assert.equal(p.path.loops[1].capability.index?.name,'m_abc',c.sql);}}finally{storage.close();}
 const server=http.createServer((q,r)=>{const data=q.url==='/bad'?corrupt:bytes;r.writeHead(200,{'Content-Length':data.length});r.end(data);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const request=path=>new Request(`http://127.0.0.1:${server.address().port}/${path}`);
 const connections=[];const open=async(path,options)=>{const db=await openFixture(request(path),options);connections.push(db);return db;};
 // Observe the existing execution-owned budget, without adding production hooks.
 const budgets=new Set(),reserve=PrivateStateByteBudget.prototype.reserve;
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args);};
 const refunded=()=>{assert.ok(budgets.size>0);for(const b of budgets)assert.equal(b.usedBytes,0,'all observed private reservations released');};
 try{
  const bad=await open('bad');
  for(const c of variant.cases.filter(c=>c.mode!=='capacity')){const s=bad.prepare(c.sql).statement;for(let run=0;run<2;run++){
   if(c.rc===11){let error;try{await rows(s);}catch(e){error=e;}assert.equal(error?.kind,'sqlite',c.sql);assert.match(error.message,/malformed|corrupt|page/i);assert.ok(privateAccounting(s).indexSeeks>0,'required selected RHS read attempted');await saved(s,error,'reset');}
   else{assert.deepEqual(await rows(s),c.rows,c.sql);assert.equal(privateAccounting(s).indexSeeks,0,'off-path LIMIT or explicit scan never enters damaged index');s.reset();}
  }s.finalize();}
  // Finalize must return the same saved malformed-read error too.
  for(const c of variant.cases.filter(c=>c.mode==='required')){const s=bad.prepare(c.sql).statement;let error;try{await rows(s);}catch(e){error=e;}assert.equal(error?.kind,'sqlite');await saved(s,error,'finalize');}
  // Native successful scan control also proves the separate unmatched drain.
  const db=await open('good');
  for(const join of ['RIGHT JOIN','FULL JOIN'])for(const hint of ['', ' INDEXED BY m_abc']){
   const sql=`SELECT l.id,r.id FROM m l NOT INDEXED ${join} m r${hint} ON r.a=l.a AND r.b=1`;
   const control=db.prepare(sql).statement,expected=await rows(control);assert.ok(privateAccounting(control).indexSeeks>0);assert.ok(privateAccounting(control).tableNext>=5,JSON.stringify(privateAccounting(control)));assert.ok(expected.some(row=>row[0].type==='null'),'unmatched RHS drain emits preserved rows');control.finalize();refunded();
   for(const mode of ['cancel','deadline','work'])for(const finish of ['reset','finalize']){
    const s=db.prepare(sql).statement;assert.equal(await s.step(),'row');assert.ok(privateAccounting(s).indexSeeks>0);assert.ok([...budgets].some(b=>b.usedBytes>0),'matched identity owns bytes before interruption');
    const controller=new AbortController(),reason=new Error('selected RHS cancellation');controller.abort(reason);
    const now=Date.now;let tick=1000;if(mode==='deadline')Date.now=()=>tick++;
    let error;try{await s.step(mode==='cancel'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:1}:{maxWorkUnits:0});}catch(e){error=e;}finally{Date.now=now;}
    assert.equal(error?.kind,mode==='cancel'?'cancelled':mode==='deadline'?'timeout':'limit');if(mode==='cancel')assert.equal(error.cause,reason);
    refunded();await saved(s,error,finish);refunded();if(finish==='reset'){assert.deepEqual(await rows(s),expected);s.finalize();refunded();}
    const reuse=db.prepare(sql).statement;assert.deepEqual(await rows(reuse),expected);reuse.finalize();refunded();
   }
   const capacitySql=sql.replace('r.b=1','r.b>=1'),capacity=variant.cases.find(c=>c.mode==='capacity'&&c.sql===capacitySql);assert.ok(capacity);
   const intact=db.prepare(capacitySql).statement;assert.deepEqual(await rows(intact),capacity.rows);intact.finalize();
   for(const limits of [{maxPrivateEntries:1},{maxPrivateBytes:8}]){
    const limited=await open('good',{limits});const s=limited.prepare(capacitySql).statement;
    assert.equal(await s.step(),'row');assert.ok(privateAccounting(s).indexSeeks>0);assert.ok([...budgets].some(b=>b.usedBytes===8),'one exact rowid match admitted');
    let error;try{await rows(s);}catch(e){error=e;}assert.equal(error?.kind,'limit');assert.ok(privateAccounting(s).indexSeeks>0,'capacity failure followed selected RHS work');assert.match(error.message,/ephemeral.*(entry|byte) limit/);refunded();await saved(s,error,'reset');
    // Same statement retries reach the identical boundary without accumulated bytes.
    assert.equal(await s.step(),'row');let again;try{await rows(s);}catch(e){again=e;}assert.equal(again?.kind,'limit');refunded();await saved(s,again,'finalize');
    const small=limited.prepare(sql+' LIMIT 1').statement;assert.equal(await small.step(),'row');assert.equal(await small.step(),'done');small.finalize();refunded();
   }
  }
 }finally{PrivateStateByteBudget.prototype.reserve=reserve;for(const db of connections)db.closeDeferred();await closeTestServer(server);}
});
