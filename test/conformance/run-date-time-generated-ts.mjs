// Zero-credit native-fixture diagnostic regression. Generate with
// docs/research/card-q-a-a-generated-probe.py pinned-library output.db.
import assert from 'node:assert/strict';
import fs from 'node:fs';import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';
import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
const bytes=fs.readFileSync(process.argv[2]);
const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let clocks=0;
const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{[dateTimeEnvironmentOption]:{nowUnixMilliseconds(){clocks++;return 946684800000n},localFieldsAtUnixSecond(){throw Error('unexpected provider')}}});
try{
 for(const sql of ['SELECT g FROM t','SELECT t.g FROM t JOIN literal ON 1','SELECT g FROM (SELECT g FROM t)']){
  const {statement:s}=db.prepare(sql);
  try{
   let first;await assert.rejects(s.step(),e=>{first=e;return e.code===1&&e.message==='non-deterministic use of datetime() in a generated column'});
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
   assert.equal(clocks,0);
  }finally{try{s.reset()}catch{}s.finalize()}
 }
 for(const sql of ['SELECT g FROM literal','SELECT literal.g FROM literal JOIN t ON 1',"SELECT CASE WHEN 1 THEN 'ok' ELSE g END FROM t"]){
  const {statement:s}=db.prepare(sql);try{assert.equal(await s.step(),'row');assert.equal(s.columnType(0),'text');assert.equal(s.column(0),sql.includes('CASE')?'ok':'2000-01-01 00:00:00');assert.equal(await s.step(),'done')}finally{s.finalize()}
 }
 assert.equal(clocks,0);
}finally{db.close();await new Promise(resolve=>server.close(resolve))}
console.log('generated date purity: 3 error/saved-error and 3 literal/unreached controls; zero corpus credit');
