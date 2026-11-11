import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {open} from '../../src/index.ts';
import {limitCases} from './limit-offset-adjudication-cases.mjs';

for(const fixture of ['storage-p4096','storage-p4096-utf16le','storage-p4096-utf16be']){
 test(`LIMIT zero short-circuits OFFSET; lifecycle/coercion/composition ${fixture}`,async()=>{
  const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,s;
  try{
   db=await open(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${fixture}`));
   for(const c of limitCases){
    s=db.prepare(c.sql).statement;assert.ok(s,c.sql);
    c.bindings?.forEach((v,i)=>s.bind(i+1,typeof v==='number'?BigInt(v):v));
    const metadata=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i));
    for(const column of metadata)assert.deepEqual(Object.keys(column).sort(),['database','declaredType','name','origin','table']);
    const expected=c.rows?.map(row=>row.map(v=>typeof v==='number'?BigInt(v):v));
    const execute=async()=>{const rows=[];while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));return rows};
    const mismatch=e=>e.kind==='sqlite'&&e.code===c.error&&e.message===(c.error===1?'malformed JSON':'datatype mismatch');if(c.error){await assert.rejects(execute,mismatch,c.sql);assert.throws(()=>s.reset(),mismatch);await assert.rejects(execute,mismatch,c.sql);assert.throws(()=>s.finalize(),mismatch)}
    else{assert.deepEqual(await execute(),expected,c.sql);s.reset();assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),metadata);assert.deepEqual(await execute(),expected,c.sql);s.finalize()}
    s=undefined;
   }
  }finally{try{s?.finalize()}catch{}db?.closeDeferred();await new Promise(r=>bridge.server.close(r))}
 });
}
