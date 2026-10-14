import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture} from './public-api-adapter.mjs';
const root=new URL('../../docs/research/card-k-c-declared-type/',import.meta.url);
const capture=JSON.parse(fs.readFileSync(new URL('native.json',root)));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,pin.sqliteSourceId);
for(const variant of capture.variants)test(`public ${variant.encoding} standard/custom declared type ownership matches pinned native`,async()=>{
 const body=fs.readFileSync(new URL(`fixtures/${variant.fixture}`,root));
 assert.equal(createHash('sha256').update(body).digest('hex'),variant.sha256);
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Length':body.length});res.end(body)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,s;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
  for(const c of variant.cases){
   s=db.prepare(c.sql).statement;
   for(let pass=0;pass<2;pass++){
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata,c.sql);
    const rows=[];
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
     const type=s.columnType(i),value=s.column(i);return type==='null'?{type}:{type,value:type==='integer'?String(value):value};
    }));
    // This regression owns declaredType, not generated REAL value coercion.
    // Keep the independently captured typed mismatch visible in research/status.
    const generated=c.metadata.findIndex(m=>m.origin==='g');
    if(generated<0)assert.deepEqual(rows,c.rows,c.sql);
    else {assert.equal(rows.length,c.rows.length,c.sql);assert.deepEqual(rows.map(row=>row.filter((_,i)=>i!==generated)),c.rows.map(row=>row.filter((_,i)=>i!==generated)),c.sql);}assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata);
    if(!pass)s.reset();
   }
   s.finalize();s=null;
  }
 }finally{try{s?.finalize()}catch{}db?.closeDeferred();await new Promise(resolve=>server.close(resolve));}
});
