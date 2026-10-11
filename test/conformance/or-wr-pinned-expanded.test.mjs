import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
const path=new URL('../../docs/research/card-s-i/native-wherei-expanded.json',import.meta.url);
test('pinned whereI four additional exact execsql cases (not encoding multiples)',async()=>{
 const capture=JSON.parse(fs.readFileSync(path));
 const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
 assert.equal(capture.sourceId,manifest.sqliteSourceId);
 const upstream=fs.readFileSync('reference/sqlite/sqlite-src-3530400/test/whereI.test');
 assert.equal(createHash('sha256').update(upstream).digest('hex'),capture.upstreamSha256);
 assert.deepEqual(capture.cases.map(c=>c.id),['whereI-1.2','whereI-1.3','whereI-2.2','whereI-2.3']);
 const bytes=fs.readFileSync(capture.fixture.path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),capture.fixture.sha256);
 const server=http.createServer((_q,r)=>r.end(bytes));await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const c of capture.cases){
   assert.equal(c.classification,'exact execsql SQL/schema/data; setup whereI-1.0/2.0');
   const st=db.prepare(c.sql).statement;
   try{
    for(let pass=0;pass<2;pass++){
     const rows=[];while(await st.step()==='row')rows.push([{type:st.columnType(0),value:st.column(0)}]);
     assert.deepEqual(rows,c.rows.map(r=>r.map(v=>({type:v.type,value:v.type==='integer'?BigInt(v.value):v.value}))),c.id);
     st.reset();
    }
   }finally{st.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
