import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
const root=path.resolve(new URL('../fixtures',import.meta.url).pathname);
test('public single-source prepare consumes SourceList/name resolution for alias star and metadata',async()=>{
 const bridge=await startFixtureServer(root);let db,s;
 try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/compound-metadata`));s=db.prepare('SELECT l.* FROM left_meta AS l').statement;
 assert.equal(s.columnCount,1);assert.deepEqual(s.columnMetadata(0),{name:'a',declaredType:'INTEGER',database:'main',table:'left_meta',origin:'a'});
 const rows=[];while(await s.step()==='row')rows.push(s.column(0));assert.deepEqual(rows,[7n]);s.finalize();s=null;
 assert.throws(()=>db.prepare('SELECT a FROM left_meta INDEXED BY missing_index'),e=>e.kind==='sqlite'&&e.message==='no such index: missing_index');
 s=db.prepare('SELECT a FROM left_meta NOT INDEXED').statement;assert.equal(await s.step(),'row');assert.equal(s.column(0),7n);s.finalize();s=null;
 s=db.prepare('SELECT main.left_meta.a FROM main.left_meta').statement;assert.deepEqual(s.columnMetadata(0),{name:'a',declaredType:'INTEGER',database:'main',table:'left_meta',origin:'a'});assert.equal(await s.step(),'row');assert.equal(s.column(0),7n);s.finalize();s=null;
 assert.throws(()=>db.prepare('SELECT a FROM temp.left_meta'),e=>e.kind==='sqlite'&&e.message==='no such table: temp.left_meta');
 assert.throws(()=>db.prepare('SELECT left_meta.a FROM left_meta AS l'),e=>e.kind==='sqlite'&&e.message==='no such column: left_meta.a');
 assert.throws(()=>db.prepare('SELECT missing FROM left_meta JOIN right_meta'),e=>e.kind==='sqlite'&&e.message==='no such column: missing');
 assert.throws(()=>db.prepare('SELECT rowid FROM left_meta JOIN right_meta'),e=>e.kind==='sqlite'&&e.message==='ambiguous column name: rowid');
 assert.throws(()=>db.prepare('SELECT left_meta.a FROM left_meta JOIN right_meta'),e=>e.kind==='unsupported'&&e.unsupportedClassification==='temporary');
 s=db.prepare('SELECT (a) AS renamed FROM left_meta').statement;assert.deepEqual(s.columnMetadata(0),{name:'renamed',declaredType:'INTEGER',database:'main',table:'left_meta',origin:'a'});assert.equal(await s.step(),'row');assert.equal(s.column(0),7n);s.finalize();s=null;
 assert.throws(()=>db.prepare('SELECT a AS z,a+1 AS z FROM left_meta WHERE z=7'),e=>e.kind==='sqlite'&&e.message==='ambiguous column name: z');
 s=db.prepare('SELECT a AS x FROM left_meta WHERE x=7').statement;assert.equal(await s.step(),'row');assert.equal(s.column(0),7n);assert.equal(await s.step(),'done');s.finalize();s=null;
 s=db.prepare('SELECT a+1 AS a FROM left_meta WHERE a=7').statement;assert.equal(await s.step(),'row');assert.equal(s.column(0),8n);s.finalize();s=null;
 assert.throws(()=>db.prepare('SELECT a AS x FROM left_meta WHERE missing=7'),e=>e.kind==='sqlite'&&e.message==='no such column: missing');
 s=db.prepare('SELECT rowid, _rowid_, oid FROM left_meta').statement;assert.equal(await s.step(),'row');assert.deepEqual([s.column(0),s.column(1),s.column(2)],[1n,1n,1n]);assert.deepEqual(s.columnMetadata(0),{name:'rowid',declaredType:null,database:'main',table:'left_meta',origin:null});s.finalize();s=null;
 }finally{try{s?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((r,j)=>bridge.server.close(e=>e?j(e):r()))}
});
