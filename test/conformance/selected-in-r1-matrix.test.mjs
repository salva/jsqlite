import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const directory=process.env.SELECT_IN_R1_MATRIX_DIR;
assert.ok(directory,'SELECT_IN_R1_MATRIX_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceid,pin.sqliteSourceId);assert.equal(capture.version,pin.version);
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString('utf8'):c.type==='blob'?new Uint8Array(Buffer.from(c.hex,'hex')):assert.fail(c.type);
for(const variant of capture.variants)test(`${variant.encoding}: R1 correlated typed composition and unmatched LEFT`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const c of variant.cases){
   st=db.prepare(c.sql).statement;
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),c.metadata,c.name+' metadata');
   for(const run of c.runs??[{rows:c.rows},{rows:c.rows}]){
    if(run.bindings){st.clearBindings();run.bindings.forEach((v,i)=>st.bind(i+1,v));}
    const rows=[],types=[];
    while(await st.step()==='row'){
     rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
     types.push(Array.from({length:st.columnCount},(_,i)=>st.columnType(i)));
    }
    assert.deepEqual(rows,run.rows.map(row=>row.map(decode)),c.name+' rows');
    assert.deepEqual(types,run.rows.map(row=>row.map(cell=>cell.type)),c.name+' storage classes');
    const work=privateAccounting(st);
    if(c.name==='empty'||run.bindings?.includes(null))assert.equal(work.indexSeeks,0,c.name);
    else assert.ok(work.indexSeeks>0&&work.inProbes>0,c.name+JSON.stringify(work));
    if(c.name==='left-on')assert.equal(rows.filter(row=>row[1]===null).length,2,'NULL-key and empty RHS must each null-extend');
    if(c.name==='left-where')assert.equal(rows.filter(row=>row[1]===null).length,0,'WHERE removes unmatched rows after extension');
    if(c.name==='or')assert.ok(work.orBranchStarts>=2,'real selected OR caller');
    await st.reset();
   }
   await st.finalize();st=undefined;
  }
 }finally{await st?.finalize();db?.closeDeferred();await new Promise(r=>server.close(r));}
});
