import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {open} from '../../src/index.ts';import {closeTestServer} from './close-test-server.mjs';
test('public prepare schema work/cancellation/deadline failures permit same-open retry',async()=>{
 const bytes=fs.readFileSync(new URL('../../docs/research/card-s-h/UTF-8.db',import.meta.url));const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{for(const [options,kind] of [[{maxWorkUnits:30},'limit'],[{signal:AbortSignal.abort(new Error('primary abort'))},'cancelled'],[{timeoutMs:0},'timeout']]){
 const db=await open(`http://127.0.0.1:${server.address().port}/fixture`);
 try{assert.throws(()=>{const result=db.prepare('SELECT * FROM t',options);result.statement?.finalize()},e=>e.kind===kind);
 const {statement}=db.prepare('SELECT * FROM t');assert.ok(statement);statement.finalize();
 }finally{db.close()}
 }}finally{await closeTestServer(server)}
});
