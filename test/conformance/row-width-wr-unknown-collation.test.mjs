import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {openFixture} from './public-api-adapter.mjs';import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
const capture=JSON.parse(fs.readFileSync(new URL('./cases/row-width-wr-unknown-collation.json',import.meta.url)));
const native=JSON.parse(fs.readFileSync(new URL('./cases/row-width-wr-unknown-native.json',import.meta.url)));
for(const v of capture.variants)test(`${v.encoding}: WR unavailable CollSeq retains exact structural PK ownership`,async()=>{const bytes=fs.readFileSync(new URL(`../../${v.fixture}`,import.meta.url)),server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));const graph=loadSchemaGraph(db),q=graph.tables.get('q'),pk=q.indexes.find(i=>i.origin==='primary-key'),same=graph.indexes.get('same'),different=graph.indexes.get('different');
for(const ix of [pk,same,different]){assert.equal(ix.physical,null);assert.ok(Object.isFrozen(ix.layout));assert.ok(Object.isFrozen(ix.layout.fields));assert.equal(ix.layout.rowidField,-1)}
assert.deepEqual(pk.layout.fields.map(f=>[f.column.name,f.collation,f.descending]),[['a','custom',true],['b','binary',false],['c','binary',false]]);
assert.deepEqual(same.layout.fields.map(f=>[f.column.name,f.collation,f.descending]),[['a','custom',false],['b','binary',false]]);assert.deepEqual(same.layout.primaryKeyFields,[0,1]);
assert.deepEqual(different.layout.fields.map(f=>[f.column.name,f.collation,f.descending]),[['a','binary',false],['a','custom',true],['b','binary',false]]);assert.deepEqual(different.layout.primaryKeyFields,[1,2]);
assert.equal(pk.szIdxRow,sqliteLogEst(132n));assert.equal(same.szIdxRow,sqliteLogEst(108n));assert.equal(different.szIdxRow,sqliteLogEst(212n));assert.equal(loadSchemaGraph(db),graph);const oracle=native.variants.find(n=>n.encoding===v.encoding);
for(const [i,ix] of [pk,same,different].entries())assert.deepEqual(ix.layout.fields.map(f=>[f.column.name,f.descending?'1':'0',f.collation]),oracle.cases[i].rows.map(r=>[r[2],r[3],r[4].toLowerCase()]));
for(let attempt=0;attempt<3;attempt++)for(const c of oracle.cases.slice(3)){assert.equal(c.prepare,1);assert.throws(()=>db.prepare(c.sql),e=>e.kind==="sqlite"&&e.code===c.prepare&&e.extendedCode===c.prepare&&e.unsupportedClassification===null&&e.message===c.message);}

assert.equal(loadSchemaGraph(db),graph);db.close();db=null;
}finally{try{db?.closeDeferred()}finally{await new Promise(r=>server.close(r))}}});
