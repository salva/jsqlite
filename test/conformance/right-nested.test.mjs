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
const residual=JSON.parse(fs.readFileSync(new URL('./cases/right-nested.json',import.meta.url),'utf8'));
for(const c of residual.cases)test(`R5 residual ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 if(c.id==='in-left'){assert.throws(()=>db.prepare(c.sql),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary');const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row')}finally{reuse.finalize()}return;}
 const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows);s.reset();assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}
}));
// Sequential, finally-restored observation of actual physical positioning.
// ON is always false: all three unmatched RHS rows must position downstream
// before the correlated scalar can reject any of them.
for(const enc of Object.keys(corpus.fixtures))test(`R5 early drain positioning ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='scalar-left');
 const original=BtreeDatabase.prototype.tableScanCursor;let downstream=0;
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=original.call(this,root);if(root===4){const first=cursor.first;cursor.first=function(){downstream++;return first.call(this)}}return cursor};
 const s=db.prepare(c.sql).statement;
 try{assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,3,'later correlation waits for downstream positioning');s.reset();downstream=0;assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,3)}
 finally{s.finalize();BtreeDatabase.prototype.tableScanCursor=original}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
}));
for(const enc of Object.keys(corpus.fixtures))test(`R5 selected drain first error cleanup ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='scalar-left');
 const original=BtreeDatabase.prototype.tableScanCursor;let entered=0;
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=original.call(this,root);if(root===4)cursor.first=function(){entered++;throw new Error('R5 injected downstream positioning failure')};return cursor};
 const s=db.prepare(c.sql).statement;let first;
 try{await assert.rejects(s.step(),error=>{first=error;return true});assert.equal(entered,1);await assert.rejects(s.step(),error=>error===first);assert.equal(entered,1);assert.throws(()=>s.reset(),error=>error===first)}
 finally{BtreeDatabase.prototype.tableScanCursor=original;s.finalize()}
 const retry=db.prepare(c.sql).statement;try{assert.deepEqual(await rows(retry),c.native.first.rows)}finally{retry.finalize()}
}));
