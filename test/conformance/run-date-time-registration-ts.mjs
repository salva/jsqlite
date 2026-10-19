// Zero-credit native-corrupted-schema registration controls.
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import path from 'node:path';
import {openFixture} from './public-api-adapter.mjs';
let bytes;const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try{for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])for(let i=0;i<5;i++){
 bytes=fs.readFileSync(path.join(process.argv[2],`${encoding}-${i}.db`));
 const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/${encoding}-${i}.db`));
 try{
  if(i<4)assert.throws(()=>db.prepare('SELECT g FROM t'),e=>e.code===11&&e.message==='malformed database schema (t) - non-deterministic functions prohibited in generated columns');
  else{const {statement:s}=db.prepare('SELECT g FROM t');try{assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'text');assert.equal(s.column(0),'2000-01-01 00:00:00');assert.equal(await s.step(),'done')}finally{s.finalize()}}
 }finally{db.close()}
}}finally{await new Promise(resolve=>server.close(resolve))}
console.log('registration purity: 15 native/public schema checks / 3 encodings; zero corpus credit');
