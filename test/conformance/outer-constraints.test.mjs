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
const residual=JSON.parse(fs.readFileSync(new URL('./cases/outer-constraints.json',import.meta.url),'utf8'));
for(const c of residual.cases)test(`R6 residual ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows);s.reset();assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}
}));
// Sequential, finally-restored observation of actual physical positioning.
// Ready b.rowid=2 rejection precedes c on both matched and drain paths.
for(const enc of Object.keys(corpus.fixtures))test(`R6 matched rejection positioning ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='right-inner');
 let downstream=0;const restore=observeDownstreamStart(()=>{downstream++});
 const s=db.prepare(c.sql).statement;
 try{assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,1,'ready rejection precedes downstream positioning');s.reset();downstream=0;assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,1)}
 finally{s.finalize();restore()}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
}));
for(const enc of Object.keys(corpus.fixtures))for(const scan of [false,true])test(`R6 selected continuation first error cleanup ${enc}/${scan?'scan':'unforced'}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='right-inner');
 const sql=scan?c.sql.replace('c z ON','c z NOT INDEXED ON'):c.sql;
 let entered=0;const restore=observeDownstreamStart(()=>{entered++;throw new Error('R6 injected downstream positioning failure')});
 const s=db.prepare(sql).statement;let first;
 try{await assert.rejects(s.step(),error=>{first=error;return true});assert.equal(entered,1);await assert.rejects(s.step(),error=>error===first);assert.equal(entered,1);assert.throws(()=>s.reset(),error=>error===first)}
 finally{restore();s.finalize()}
 const retry=db.prepare(c.sql).statement;try{assert.deepEqual(await rows(retry),c.native.first.rows)}finally{retry.finalize()}
}));
// ON ownership is retained. Scan controls keep the original physical counts.
// Selected c_k equality has an IsNull guard before SeekGE: scalar has b keys
// 1,1,3,NULL (three seeks); FULL EXISTS adds two synthetic NULL b rows
// (still three seeks). No c seek is needed for those NULL continuations.
// Native typed rows/metadata remain identical; all counts include drains.
for(const enc of Object.keys(corpus.fixtures))for(const scan of [false,true])for(const [id,scanCount,selectedCount] of [['full-inner',1,1],['full-left',1,1],['scalar',4,3],['exists',6,3],['ltorj',7,7]])test(`R6 owning positioning ${enc}/${id}/${scan?'scan':'unforced'}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id===id);
 const count=scan?scanCount:selectedCount;
 const sql=scan?c.sql.replace('c z ON','c z NOT INDEXED ON'):c.sql;
 let downstream=0;const restore=observeDownstreamStart(()=>{downstream++});
 const s=db.prepare(sql).statement;
 try{for(let pass=0;pass<2;pass++){assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,count);s.reset();downstream=0;}}
 finally{s.finalize();restore()}
}));
// LTORJ count7 = four normal a rows + two FULL synthetic b rows +
// one unmatched b drain invocation; suppression must not prune any at b.
for(const enc of Object.keys(corpus.fixtures))test(`R6 actual work cleanup ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='full-inner');
 const s=db.prepare(c.sql).statement;let saved;
 try{await assert.rejects(s.step({maxWorkUnits:20}),e=>{saved=e;return e.kind==='limit'});await assert.rejects(s.step(),e=>e===saved);assert.throws(()=>s.reset(),e=>e===saved)}finally{try{s.finalize()}catch(e){assert.equal(e,saved)}}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
}));
