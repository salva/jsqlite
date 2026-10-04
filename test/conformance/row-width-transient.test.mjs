import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';import {loadSchemaGraph} from '../../src/internal/schema.ts';import {parseSql} from '../../src/internal/parse.ts';import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-real-metadata-native.json',import.meta.url)));
for(const v of cap.variants)test(`SELECT transient width ownership ${v.encoding}`,async()=>{
 const bytes=fs.readFileSync(v.fixture),server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));const schema=loadSchemaGraph(db);
 for(const sql of ['SELECT (SELECT c FROM (SELECT c FROM t UNION ALL SELECT c FROM t) AS d LIMIT 1)']){
  const resolved=expandAndResolveSelect(parseSql(sql).statement,schema),table=resolved.nested[0].sources[0].table;
  assert.equal(table.szTabRow,1);assert.deepEqual(table.columns.map(c=>c.szEst),[0]);assert.equal(table.rootPage,0);assert.deepEqual(table.indexes,[]);assert.equal(table.integerPrimaryKey,null);
 }
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
