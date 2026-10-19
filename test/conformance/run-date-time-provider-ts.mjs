// Zero-credit source-control regression: vdbe.c execution-entry time and
// date.c:setDateTimeToCurrent UTC provenance. Oracle: provider-probe.c.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';
import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
for(const encoding of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(new URL(`../fixtures/expression-cursor/users-${encoding}.db`,import.meta.url));
 const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let calls=0,local=0;
 const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{[dateTimeEnvironmentOption]:{
  nowUnixMilliseconds(){return 946684800000n+BigInt(calls++)*10000n},
  localFieldsAtUnixSecond(){local++;throw Error('UTC must bypass local provider')}
 }});
 try{
  // strftimeFunc format coercion/NULL return precedes isDate, even with
  // now/subsec/localtime arguments. No provider or eligibility effects.
  for(const sql of ["SELECT strftime(NULL,'now')","SELECT strftime(NULL,'subsec')","SELECT strftime(NULL,'2000-01-01','localtime')","SELECT strftime(NULL,'now','utc')"]){
   const {statement:f}=db.prepare(sql);try{const before=calls,beforeLocal=local;for(let execution=0;execution<2;execution++){assert.equal(await f.step(),'row');assert.equal(f.columnType(0),'null');assert.equal(f.column(0),null);assert.equal(await f.step(),'done');assert.equal(calls,before);assert.equal(local,beforeLocal);f.reset()}}finally{f.finalize()}
  }
  const {statement:bad}=db.prepare("SELECT strftime('%Y','2000-01-01','localtime')");
  try{let error;try{await bad.step()}catch(e){error=e}assert.equal(error?.message,'local time unavailable');await assert.rejects(()=>bad.step(),e=>e===error);assert.throws(()=>bad.reset(),e=>e===error)}finally{bad.finalize()}
  const {statement:s}=db.prepare("WITH RECURSIVE x(n) AS (VALUES(0) UNION ALL SELECT n+1 FROM x WHERE n<2) SELECT datetime('now',printf('+%d seconds',n)),datetime('now') FROM x");
  try{
   assert.equal(calls,0);
   for(let execution=0;execution<2;execution++){
    const base=calls;
    for(let n=0;n<3;n++){
     assert.equal(await s.step(),'row');
     assert.equal(s.columnCount,2);
     assert.equal(s.columnType(0),'text');assert.equal(s.columnType(1),'text');
     const format=seconds=>`2000-01-01 00:${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
     assert.equal(s.column(0),format((base+n)*10+n));
     assert.equal(s.column(1),format(base*10));assert.equal(calls,base+n+1);
    }
    assert.equal(await s.step(),'done');assert.equal(await s.step(),'done');assert.equal(calls,base+3);
    s.reset();
   }
  }finally{s.finalize()}
  const {statement:u}=db.prepare("SELECT datetime('now','utc'),datetime('subsec','utc'),datetime(),CURRENT_TIMESTAMP");
  try{const before=calls;assert.equal(await u.step(),'row');assert.equal(calls,before+1);assert.equal(local,1);for(let i=0;i<4;i++)assert.equal(u.columnType(i),'text');assert.equal(await u.step(),'done')}finally{u.finalize()}
 }finally{db.close();await new Promise(resolve=>server.close(resolve))}
}
console.log('provider clock regression: 3 encodings, 2 executions each; zero corpus credit');
