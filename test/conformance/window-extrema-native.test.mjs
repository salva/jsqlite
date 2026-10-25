import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import {open} from '../../src/index.ts';
import {privateAccounting} from './public-api-adapter.mjs';
const oracleSets=[
 ['packed extrema',JSON.parse(fs.readFileSync('test/conformance/cases/window-extrema-native.json')),60],
 ['late sliding/following/EXCLUDE drains',JSON.parse(fs.readFileSync('test/conformance/cases/window-late-drains-native.json')),3]
];
function cell(stmt,i){
 const type=stmt.columnType(i),value=stmt.column(i);
 if(type==='null')return {type};
 if(type==='integer')return {type,value:String(value)};
 if(type==='real'){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return {type,ieee754be:bytes.toString('hex')}}
 return type==='blob'?{type,hex:Buffer.from(value).toString('hex')}:{type,value};
}
for(const [label,oracle,count] of oracleSets)for(const fixture of ['typed','typed-utf-16le','typed-utf-16be'])test(`${label} full typed metadata/native results ${fixture}`,async()=>{
 const bytes=fs.readFileSync(`test/fixtures/aggregate-window/${fixture}.db`);
 const cases=oracle.variants.filter(v=>v.fixture===fixture);
 assert.equal(cases.length,count);
 const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Length':bytes.length});res.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{
  db=await open(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const c of cases){
   assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),c.fixtureSha256);
   const stmt=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:stmt.columnCount},(_,i)=>stmt.columnMetadata(i)),c.columns,c.sql);
    for(const expected of c.runs){const rows=[];while(await stmt.step()==='row')rows.push(Array.from({length:stmt.columnCount},(_,i)=>cell(stmt,i)));
     assert.deepEqual(rows,expected,c.sql);assert.equal(privateAccounting(stmt).ownedBytes,0);stmt.reset();
    }
   }finally{stmt.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
