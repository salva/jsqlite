// Zero-credit private-representation admission tests. Native failure/retry
// ownership is independently captured by card-q-a-b-clock-failure-probe.c.
import assert from 'node:assert/strict';
import fs from 'node:fs';import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';
import {JSQLiteError} from '../../src/index.ts';
import {dateTimeEnvironmentOption} from '../../src/internal/date-time.ts';
let cases=0;
for(const encoding of ['utf8','utf16le','utf16be']){
 const bytes=fs.readFileSync(new URL(`../fixtures/expression-cursor/users-${encoding}.db`,import.meta.url));
 const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let clock=()=>946684800000n,local=()=>({year:2000,month:1,day:1,hour:0,minute:0,second:0});
 const db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{[dateTimeEnvironmentOption]:{nowUnixMilliseconds:()=>clock(),localFieldsAtUnixSecond:()=>local()}});
 async function check(sql,expected,error){
  const {statement:s}=db.prepare(sql);
  try{
   if(error){let first;await assert.rejects(s.step(),e=>{first=e;return error(e)});await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);}
   else{assert.equal(await s.step(),'row');assert.equal(s.columnCount,expected.length);for(let i=0;i<expected.length;i++){assert.equal(s.columnType(i),expected[i]===null?'null':'text');assert.equal(s.column(i),expected[i]);}assert.equal(await s.step(),'done');assert.equal(await s.step(),'done');s.reset();}
   cases++;
  }finally{try{s.reset()}catch{}s.finalize()}
 }
 try{
  const sql="SELECT datetime('now'),datetime('now'),datetime('now')";
  let calls=0;clock=()=>{if(++calls===1)throw Error('VFS unavailable');return 946684800000n};
  await check(sql,[null,'2000-01-01 00:00:00','2000-01-01 00:00:00']);assert.equal(calls,2);
  for(const invalid of [null,undefined,0,NaN,Infinity,1.5,-210866760000000n,-210866760000001n,253402300800000n]){
   clock=()=>invalid;await check(sql,[null,null,null]);
  }
  const cancellation=new JSQLiteError('cancelled','provider cancellation');clock=()=>{throw cancellation};
  await check(sql,null,e=>e===cancellation);
  let nullCalls=0;clock=()=>{nullCalls++;throw cancellation};local=()=>{nullCalls++;throw cancellation};
  for(const expression of ["strftime(NULL,'now')","strftime(NULL,'subsec')","strftime(NULL,'now','localtime')"]){await check(`SELECT ${expression}`,[null]);await check(`SELECT ${expression}`,[null]);}
  assert.equal(nullCalls,0);
  await check("SELECT strftime('%Y','now')",null,e=>e===cancellation);assert.equal(nullCalls,1);
  clock=()=>946684800000n;
  const valid={year:2000,month:1,day:1,hour:0,minute:0,second:0};
  const invalidTuples=[null,{}, {...valid,year:Number.MAX_SAFE_INTEGER+1}, {...valid,year:NaN}, {...valid,month:0},{...valid,month:13},{...valid,day:0},{...valid,month:2,day:30},{...valid,year:2001,month:2,day:29},{...valid,hour:24},{...valid,minute:60},{...valid,second:60},{...valid,second:.5},{...valid,second:Infinity}];
  for(const tuple of invalidTuples){local=()=>tuple;await check("SELECT datetime('2000-01-01','localtime')",null,e=>e.code===1&&e.message==='local time unavailable');}
  local=()=>{throw Error('host localtime failure')};await check("SELECT datetime('2000-01-01','localtime')",null,e=>e.code===1&&e.message==='local time unavailable');
  local=()=>{throw cancellation};await check("SELECT datetime('2000-01-01','localtime')",null,e=>e===cancellation);
  local=()=>({...valid,month:2,day:29});await check("SELECT datetime('2000-01-01','localtime')",['2000-02-29 00:00:00']);
  let localCalls=0;local=()=>{localCalls++;throw Error('must bypass')};await check("SELECT datetime('now','utc')",['2000-01-01 00:00:00']);assert.equal(localCalls,0);
 }finally{db.close();await new Promise(resolve=>server.close(resolve))}
}
console.log(`provider failure admission: ${cases} public checks / 3 encodings; zero corpus credit`);
