// Native-first zero-credit reached purity/metadata/storage matrix.
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
const root=process.argv[2],native=JSON.parse(fs.readFileSync(path.join(root,'native.json')));let bytes;
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let count=0;
try{for(const encoding of ['UTF-8','UTF-16le','UTF-16be']){
 bytes=fs.readFileSync(path.join(root,`${encoding}.db`));let calls=0;
 const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encoding}`),{[dateTimeEnvironmentOption]:{nowUnixMilliseconds(){calls++;return 946684800000n},localFieldsAtUnixSecond(){calls++;throw Error('purity must precede provider')}}});
 try{for(const c of native.cases.filter(c=>c.encoding===encoding)){
  const {statement:s}=db.prepare(c.sql);try{
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,databaseName:m.database,tableName:m.table,originName:m.origin}}),c.metadata,c.sql);
   for(let execution=0;execution<2;execution++){
    for(const row of c.rows){assert.equal(await s.step(),'row',c.sql);for(let i=0;i<row.length;i++){assert.equal(s.columnType(i),row[i].type===5?'null':'text');assert.equal(s.column(i),row[i].value)}}
    if(c.rc===101){assert.equal(await s.step(),'done');assert.equal(await s.step(),'done');s.reset()}
    else{let first;await assert.rejects(s.step(),e=>{first=e;return e.code===c.rc&&e.message===c.error});await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first)}
   }
   count++;assert.equal(calls,0,c.sql);
  }finally{try{s.reset()}catch{}s.finalize()}
 }}finally{db.close()}
}}finally{await new Promise(r=>server.close(r))}
console.log(`generated matrix ${count}/${native.observations} native/public observations x2 executions, full metadata/3 encodings; zero credit`);
