// Native-first expr.c constant walker observations from card-q-a-b-once-probe.c.
import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
const args=["CASE WHEN 1 THEN 'now' ELSE 'x' END","CASE 1 WHEN 1 THEN 'now' END","iif(1,'now','x')","CASE WHEN 1 BETWEEN 0 AND 2 THEN 'now' END","CASE WHEN 1 IN (1,2) THEN 'now' END","CASE WHEN random() IS NOT NULL THEN 'now' END","(SELECT 'now')"];
for(const encoding of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(new URL(`../fixtures/expression-cursor/users-${encoding}.db`,import.meta.url));const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let calls=0;
 const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{[dateTimeEnvironmentOption]:{nowUnixMilliseconds(){return 946684800000n+BigInt(calls++)*10000n},localFieldsAtUnixSecond(){throw Error('unexpected local')}}});
 try{for(let i=0;i<args.length;i++){
  const {statement:s}=db.prepare(`WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<2) SELECT datetime(${args[i]}) AS d FROM x`);try{
   for(let execution=0;execution<2;execution++){calls=0;for(let n=0;n<3;n++){assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'text');assert.equal(s.column(0),`2000-01-01 00:00:${i<5?'00':String(n*10).padStart(2,'0')}`);assert.equal(calls,i<5?1:n+1)}assert.equal(await s.step(),'done');s.reset()}
  }finally{s.finalize()}
 }}finally{db.close();await new Promise(r=>server.close(r))}
}
console.log('Once walker 21 native/public cases x2 executions / 3 encodings; zero credit');
