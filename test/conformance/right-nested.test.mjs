import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {observeDownstreamStart} from './downstream-start-observer.mjs';
const corpus=JSON.parse(fs.readFileSync(new URL('./cases/repeated-right-full.json',import.meta.url),'utf8'));
async function withDb(enc,fn,options){
 const fixture=corpus.fixtures[enc];const bytes=fs.readFileSync(new URL(`./fixtures/${fixture.path}`,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);await fn(db)}
 finally{db?.closeDeferred();await closeTestServer(server)}
}
function cell(s,i){const type=s.columnType(i),v=s.column(i);
 if(type==='null')return {type};if(type==='integer')return {type,value:String(v)};
 if(type==='real'){const b=Buffer.alloc(8);b.writeDoubleBE(v);return {type,ieee754be:b.toString('hex')}}
 if(type==='text')return {type,utf8Hex:Buffer.from(v).toString('hex')};
 return {type,hex:Buffer.from(v).toString('hex')};
}
function metadata(s){return Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declType:m.declaredType,database:m.database,table:m.table,origin:m.origin}})}
async function rows(s){const out=[];while(await s.step()==='row')out.push(Array.from({length:s.columnCount},(_,i)=>cell(s,i)));return out}
const residual=JSON.parse(fs.readFileSync(new URL('./cases/right-nested.json',import.meta.url),'utf8'));
for(const c of residual.cases)test(`R5 residual ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 // Correlated scalar IN now uses the shared packed SRT_Set producer and
 // membership lowering at the joined binding frontier. Pinned native rows,
 // not the superseded temporary rejection, own this represented case.
 const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows);s.reset();assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}
}));
// Sequential, finally-restored observation of actual physical positioning.
// ON is always false. Scan controls retain all three downstream starts.
// Unforced c_k equality seeks for b.k=1,3 only; b.k=NULL takes the
// pre-seek IsNull LEFT continuation (wherecode.c codeAllEqualityTerms).
// The later correlated scalar still waits for the downstream binding.
for(const enc of Object.keys(corpus.fixtures))for(const scan of [false,true])test(`R5 early drain positioning ${enc}/${scan?'scan':'unforced'}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='scalar-left');
 const sql=scan?c.sql.replace('c z ON','c z NOT INDEXED ON'):c.sql;
 const count=scan?3:2;
 let downstream=0;const restore=observeDownstreamStart(()=>{downstream++});
 const s=db.prepare(sql).statement;
 try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,count,'later correlation waits for downstream positioning');s.reset();downstream=0;assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,count)}
 finally{s.finalize();restore()}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
}));
for(const enc of Object.keys(corpus.fixtures))for(const scan of [false,true])test(`R5 selected drain first error cleanup ${enc}/${scan?'scan':'unforced'}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='scalar-left');
 const sql=scan?c.sql.replace('c z ON','c z NOT INDEXED ON'):c.sql;
 let entered=0;const restore=observeDownstreamStart(()=>{entered++;throw new Error('R5 injected downstream positioning failure')});
 const s=db.prepare(sql).statement;let first;
 try{await assert.rejects(s.step(),error=>{first=error;return true});assert.equal(entered,1);await assert.rejects(s.step(),error=>error===first);assert.equal(entered,1);assert.throws(()=>s.reset(),error=>error===first)}
 finally{restore();s.finalize()}
 const retry=db.prepare(c.sql).statement;try{assert.deepEqual(await rows(retry),c.native.first.rows)}finally{retry.finalize()}
}));

// Independent pinned capture uses the exact residual fixtures, not a TS oracle.
const inNative=JSON.parse(fs.readFileSync(new URL('../../docs/research/right-nested-in/native.json',import.meta.url)));
assert.equal(inNative.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const c of inNative.cases)test(`R5 packed IN native ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 assert.deepEqual(c.fixture,corpus.fixtures[c.encoding]);
 const s=db.prepare(c.sql).statement;
 try{assert.deepEqual(metadata(s),c.columns);for(const run of c.runs){assert.equal(run.done,101);assert.deepEqual(await rows(s),run.rows);s.reset()}}
 finally{s.finalize()}
}));
// Keep the original atomic capability-gate intent at a real adjacent boundary:
// ordered table compound RHS cannot be lowered by a terminal-arm table loop.
for(const enc of Object.keys(corpus.fixtures))test(`R5 packed IN adjacent unsafe compound ${enc}`,()=>withDb(enc,async db=>{
 const sql='SELECT a.k,b.k,z.k FROM a RIGHT JOIN b ON a.k=-1 LEFT JOIN c z ON z.k=b.k WHERE 3 IN(SELECT z.k FROM c UNION ALL SELECT k FROM c ORDER BY 1)';
 assert.throws(()=>db.prepare(sql),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary');
 const s=db.prepare(residual.cases.find(c=>c.encoding===enc&&c.id==='in-left').sql).statement;
 try{assert.deepEqual(await rows(s),residual.cases.find(c=>c.encoding===enc&&c.id==='in-left').native.first.rows)}finally{s.finalize()}
}));
