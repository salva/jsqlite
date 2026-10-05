import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';
import {BtreeDatabase} from '../../src/internal/btree.ts';
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
// ON is always false, so downstream c may start only for ready RHS rowid=2.
for(const enc of Object.keys(corpus.fixtures))test(`R6 matched rejection positioning ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='right-inner');
 const original=BtreeDatabase.prototype.tableScanCursor;let downstream=0;
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=original.call(this,root);if(root===4){const first=cursor.first;cursor.first=function(){downstream++;return first.call(this)}}return cursor};
 const s=db.prepare(c.sql).statement;
 try{assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,1,'ready rejection precedes downstream positioning');s.reset();downstream=0;assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,1)}
 finally{s.finalize();BtreeDatabase.prototype.tableScanCursor=original}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
}));
for(const enc of Object.keys(corpus.fixtures))test(`R6 selected continuation first error cleanup ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='right-inner');
 const original=BtreeDatabase.prototype.tableScanCursor;let entered=0;
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=original.call(this,root);if(root===4)cursor.first=function(){entered++;throw new Error('R6 injected downstream positioning failure')};return cursor};
 const s=db.prepare(c.sql).statement;let first;
 try{await assert.rejects(s.step(),error=>{first=error;return true});assert.equal(entered,1);await assert.rejects(s.step(),error=>error===first);assert.equal(entered,1);assert.throws(()=>s.reset(),error=>error===first)}
 finally{BtreeDatabase.prototype.tableScanCursor=original;s.finalize()}
 const retry=db.prepare(c.sql).statement;try{assert.deepEqual(await rows(retry),c.native.first.rows)}finally{retry.finalize()}
}));
// Matched ON hits rejected by ready WHERE must not position c. Deferred
// correlations and LTORJ must keep their interior work; all counts include drains.
for(const enc of Object.keys(corpus.fixtures))for(const [id,count] of [['full-inner',1],['full-left',1],['scalar',4],['exists',6],['ltorj',7]])test(`R6 owning positioning ${enc}/${id}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id===id);
 const original=BtreeDatabase.prototype.tableScanCursor;let downstream=0;
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=original.call(this,root);if(root===4){const first=cursor.first;cursor.first=function(){downstream++;return first.call(this)}}return cursor};
 const s=db.prepare(c.sql).statement;
 try{for(let pass=0;pass<2;pass++){assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,count);s.reset();downstream=0;}}
 finally{s.finalize();BtreeDatabase.prototype.tableScanCursor=original}
}));
// LTORJ count7 = four normal a rows + two FULL synthetic b rows +
// one unmatched b drain invocation; suppression must not prune any at b.
for(const enc of Object.keys(corpus.fixtures))test(`R6 actual work cleanup ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='full-inner');
 const s=db.prepare(c.sql).statement;let saved;
 try{await assert.rejects(s.step({maxWorkUnits:20}),e=>{saved=e;return e.kind==='limit'});await assert.rejects(s.step(),e=>e===saved);assert.throws(()=>s.reset(),e=>e===saved)}finally{try{s.finalize()}catch(e){assert.equal(e,saved)}}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
}));
