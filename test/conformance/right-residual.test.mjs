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
// Predicate branch context differs from value-producing Boolean evaluation.
const badJson="json_extract('bad','$')=1";
for(const enc of Object.keys(corpus.fixtures))for(const join of ['INNER','LEFT','RIGHT','FULL'])
for(const [predicate,matched,error] of [
 [`((NULL AND ${badJson}) OR 0)`,false,false],
 [`NOT (1 OR ${badJson})`,false,false],
 [`(0 OR (NULL AND ${badJson}))`,false,false],
 [`NOT (NULL AND ${badJson})`,false,true],
 [`NOT (0 AND ${badJson})`,true,false],
 [`(1 OR (NULL AND ${badJson}))`,true,false],
 [`((NULL AND 1) OR 1)`,true,false],
 [`((NULL OR 0) AND 1)`,false,false],
 [`(${badJson} AND 0)`,false,true],
 [`(${badJson} OR NULL)`,false,true],
 [`((SELECT ${badJson} WHERE a.k IS a.k) AND NULL)`,false,false],
 [`(NULL AND (SELECT ${badJson} WHERE a.k IS a.k))`,false,false],
 [`((SELECT ${badJson}) AND NULL)`,false,join!=='INNER'],
 [`(NULL AND (SELECT ${badJson}))`,false,false],
 [`((SELECT 1) AND NULL)`,false,false],
 [`(NULL AND (SELECT 1))`,false,false],
])
test(`nested predicate rejection ${enc}/${join}/${predicate}`,()=>withDb(enc,async db=>{
 const s=db.prepare(`SELECT a.rowid,b.rowid FROM a ${join} JOIN b ON ${predicate}`).statement;
 const n=value=>({type:'integer',value:String(value)}),nil={type:'null'};
 const expected=[...(['LEFT','FULL'].includes(join)?[1,2,3,4].map(i=>[n(i),nil]):[]),...(['RIGHT','FULL'].includes(join)?[1,2,3].map(i=>[nil,n(i)]):[])];
 try{
  if(error){
   let first;await assert.rejects(rows(s),e=>{first=e;return e.code===1&&e.message==='malformed JSON'});
   assert.throws(()=>s.reset(),e=>e===first);
   await assert.rejects(rows(s),e=>e.code===1&&e.message==='malformed JSON');
  }else{
   const want=matched?[1,2,3,4].flatMap(a=>[1,2,3].map(b=>[n(a),n(b)])):expected;
   assert.deepEqual(await rows(s),want);s.reset();assert.deepEqual(await rows(s),want);
  }
 }finally{try{s.finalize()}catch(e){if(!error)throw e;assert.equal(e.code,1)}}
}));
const residual=JSON.parse(fs.readFileSync(new URL('./cases/right-residual.json',import.meta.url),'utf8'));
for(const enc of Object.keys(corpus.fixtures))for(const join of ['LEFT','RIGHT','FULL'])for(const guard of ['0','NULL'])
test(`predicate AND rejects before RHS ${enc}/${join}/${guard}`,()=>withDb(enc,async db=>{
 const s=db.prepare(`SELECT a.rowid,b.rowid FROM a ${join} JOIN b ON (${guard} AND json_extract('bad','$')=1)`).statement;
 try{const first=await rows(s);assert.equal(first.length,join==='LEFT'?4:join==='RIGHT'?3:7);assert.ok(first.every(row=>row.some(c=>c.type==='null')));s.reset();assert.deepEqual(await rows(s),first)}finally{s.finalize()}
}));
for(const c of residual.cases)test(`R4 residual ${c.encoding}/${c.id}`,()=>withDb(c.encoding,async db=>{
 const s=db.prepare(c.sql).statement;try{assert.deepEqual(metadata(s),c.native.columns);assert.deepEqual(await rows(s),c.native.first.rows);s.reset();assert.deepEqual(await rows(s),c.native.first.rows)}finally{s.finalize()}
}));
// Sequential, finally-restored observation of actual physical positioning.
// ON is always false, so downstream c may start only for ready RHS rowid=2.
for(const enc of Object.keys(corpus.fixtures))test(`R4 early drain positioning ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='early-control');
 const original=BtreeDatabase.prototype.tableScanCursor,indexOriginal=BtreeDatabase.prototype.indexCursor;let downstream=0;
 const observe=cursor=>{const first=cursor.first;cursor.first=function(){downstream++;return first.call(this)};return cursor};
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=original.call(this,root);return root===4?observe(cursor):cursor};
 // The selected matched pass scans c's covering index (root7), whereas
 // fallback/drain may use its table (root4). Count the actual positioning
 // owner on either route; neither may begin before the ready RHS test.
 BtreeDatabase.prototype.indexCursor=function(root){const cursor=indexOriginal.call(this,root);return root===7?observe(cursor):cursor};
 const s=db.prepare(c.sql).statement;
 try{assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,1,'ready rejection precedes downstream positioning');s.reset();downstream=0;assert.deepEqual(await rows(s),c.native.first.rows);assert.equal(downstream,1)}
 finally{s.finalize();BtreeDatabase.prototype.tableScanCursor=original;BtreeDatabase.prototype.indexCursor=indexOriginal}
 const reuse=db.prepare('SELECT 1').statement;try{assert.equal(await reuse.step(),'row');assert.equal(reuse.column(0),1n)}finally{reuse.finalize()}
}));
for(const enc of Object.keys(corpus.fixtures))test(`R4 selected drain first error cleanup ${enc}`,()=>withDb(enc,async db=>{
 const c=residual.cases.find(c=>c.encoding===enc&&c.id==='early-control');
 const original=BtreeDatabase.prototype.tableScanCursor,indexOriginal=BtreeDatabase.prototype.indexCursor;let entered=0;
 const inject=cursor=>{cursor.first=function(){entered++;throw new Error('R4 injected downstream positioning failure')};return cursor};
 BtreeDatabase.prototype.tableScanCursor=function(root){const cursor=original.call(this,root);return root===4?inject(cursor):cursor};
 BtreeDatabase.prototype.indexCursor=function(root){const cursor=indexOriginal.call(this,root);return root===7?inject(cursor):cursor};
 const s=db.prepare(c.sql).statement;let first;
 try{await assert.rejects(s.step(),error=>{first=error;return true});assert.equal(entered,1);await assert.rejects(s.step(),error=>error===first);assert.equal(entered,1);assert.throws(()=>s.reset(),error=>error===first)}
 finally{BtreeDatabase.prototype.tableScanCursor=original;BtreeDatabase.prototype.indexCursor=indexOriginal;s.finalize()}
 const retry=db.prepare(c.sql).statement;try{assert.deepEqual(await rows(retry),c.native.first.rows)}finally{retry.finalize()}
}));
