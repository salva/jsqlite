import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';
// Separate value witness: do not weaken/adopt the metadata companion's origin-g exclusion.
const root=new URL('../../docs/research/card-k-c-declared-type/',import.meta.url);
const native=JSON.parse(fs.readFileSync(new URL('native.json',root)));
for(const v of native.variants)test(`generated REAL typed value and metadata ${v.encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`fixtures/${v.fixture}`,root));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  for(const c of v.cases.filter(c=>c.metadata.some(m=>m.origin==='g'))){
   s=db.prepare(c.sql).statement;
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata);
   for(let replay=0;replay<2;replay++){
    const rows=[];
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
     const type=s.columnType(i),value=s.column(i);
     // Copied public access must not alter initial storage-class reporting.
     s.columnText(i);s.column(i);assert.equal(s.columnType(i),type);
     return type==='null'?{type}:{type,value:type==='integer'?String(value):value};
    }));
    assert.deepEqual(rows,c.rows,c.sql);s.reset();
   }
   s.finalize();s=undefined;
  }
  db.close();db=undefined;
 }finally{try{s?.finalize()}catch{}db?.closeDeferred();await new Promise(r=>server.close(r));}
});
for(const v of JSON.parse(fs.readFileSync(new URL('../../docs/research/card-t-generated-real/native.json',import.meta.url))).variants)test(`generated affinity branches ${v.encoding}`,async()=>{
 const body=fs.readFileSync(new URL(`../card-t-generated-real/fixtures/${v.fixture}`,root));
 const server=http.createServer((_q,r)=>r.end(body));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  for(const c of v.cases){
   s=db.prepare(c.sql).statement;
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata,c.sql);
   for(let replay=0;replay<2;replay++){
    const rows=[];
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
     const type=s.columnType(i),value=s.column(i);
     // Copied public access must not alter initial storage-class reporting.
     s.columnText(i);s.column(i);assert.equal(s.columnType(i),type);
     return type==='null'?{type}:{type,value:type==='integer'?String(value):value};
    }));
    assert.deepEqual(rows,c.rows,c.sql);s.reset();
   }
   s.finalize();s=undefined;
  }
  db.close();db=undefined;
 }finally{try{s?.finalize()}catch{}db?.closeDeferred();await new Promise(r=>server.close(r));}
});
