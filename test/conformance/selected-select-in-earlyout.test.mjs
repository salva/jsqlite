import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const directory=process.env.SELECT_IN_EARLYOUT_DIR;
assert.ok(directory,'SELECT_IN_EARLYOUT_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
assert.equal(capture.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
const expectedProbes={absent:1,present:3,null:0,empty:0,'null-rhs':0,joined:1,left:5,reverse:3};
for(const variant of capture.variants)test(`${variant.encoding}: selected IN prefix earlyout`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 assert.equal((await import('node:crypto')).createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const [name,oracle] of Object.entries(variant.cases)){
   if(name==='absent'){
    assert.ok(oracle.eqp.some(line=>line.includes('a=? AND b=?')));
    assert.ok(oracle.program.some(op=>op.opcode==='IfNoHope'));
    assert.ok(!oracle.program.some(op=>op.opcode==='SeekScan'));
   }
   const st=db.prepare(oracle.sql).statement;
   try{
    for(let run=0;run<2;run++){
     oracle.bindings.forEach((v,i)=>st.bind(i+1,v));
     const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     const expected=oracle.rows.map(row=>row.map(cell=>cell.type==='null'?null:BigInt(cell.value)));
     const sort=rows=>rows.map(row=>row.map(v=>v===null?'NULL':String(v)).join(',')).sort();
     assert.deepEqual(sort(rows),sort(expected),name);
     const accounting=privateAccounting(st);
     if(name in expectedProbes)assert.equal(accounting.inProbes,expectedProbes[name],name);
     else assert.ok(accounting.inProbes>0,name);
     st.reset();
    }
   }finally{st.finalize()}
  }
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
});
