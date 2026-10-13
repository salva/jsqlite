import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture} from '../public-api-adapter.mjs';
// Pinned native-carrier.log in card-t-c/bounded-owner-handoff: full metadata,
// correlated NULL reset and uncorrelated random() Once (not exact random bytes).
for(const encoding of ['utf8','utf16le','utf16be'])test(`linked carrier metadata and Once ${encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../fixtures/row-vector/pairs-${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>r.end(bytes));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  st=db.prepare('SELECT p.id,(SELECT a FROM pairs r WHERE r.id=p.id) AS sample,EXISTS(SELECT * FROM pairs r WHERE r.id=p.id) AS present FROM pairs p').statement;
  assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),[
   {name:'id',declaredType:'INTEGER',database:'main',table:'pairs',origin:'id'},
   {name:'sample',declaredType:'NUMERIC',database:'main',table:'pairs',origin:'a'},
   {name:'present',declaredType:null,database:null,table:null,origin:null},
  ]);
  for(let run=0;run<2;run++){
   const rows=[];while(await st.step()==='row')rows.push([st.column(0),st.column(1),st.column(2)]);
   assert.deepEqual(rows,[[1n,1n,1n],[2n,2n,1n],[3n,null,1n],[4n,1n,1n]]);st.reset();
  }
  st.finalize();st=undefined;
  st=db.prepare('SELECT id,(SELECT random()) AS sample FROM pairs').statement;
  for(let run=0;run<2;run++){
   const samples=[];while(await st.step()==='row'){assert.equal(st.columnType(1),'integer');samples.push(st.column(1));}
   assert.equal(samples.length,4);assert.equal(new Set(samples).size,1);st.reset();
  }
  st.finalize();st=undefined;db.close();db=undefined;
 }finally{try{st?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.close(r));}}
});
