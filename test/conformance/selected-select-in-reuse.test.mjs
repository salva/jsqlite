import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
const directory=process.env.SELECT_IN_REUSE_DIR;
assert.ok(directory,'SELECT_IN_REUSE_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
assert.equal(capture.sourceid,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const variant of capture.variants)test(`${variant.encoding}: persistent scalar LOOP reuse and source-gated fallback`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const original=PrivateBlobkeyPages.open;let opens=0,db,st;
 PrivateBlobkeyPages.open=async function(...args){opens++;return original.apply(this,args)};
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const c of variant.cases){
   assert.equal(c.ops.some(op=>op.opcode==='OpenEphemeral'),!c.reuse,c.name);
   st=db.prepare(c.sql).statement;
   for(let run=0;run<2;run++){
    opens=0;const rows=[];while(await st.step()==='row')rows.push([{type:'integer',value:st.column(0).toString()}]);
    assert.deepEqual(rows,c.rows,c.name);
    const work=privateAccounting(st);
    assert.ok(work.indexSeeks>0,c.name);assert.equal(work.sorterRows,0,c.name);
    if(c.reuse){assert.equal(opens,0,c.name);if(!c.residual)assert.equal(work.residualTests,0,c.name);assert.ok(work.inProbes>0,c.name);}
    else assert.ok(opens>0,c.name);
    await st.reset();
   }
   await st.finalize();st=undefined;
  }
 }finally{PrivateBlobkeyPages.open=original;try{await st?.finalize()}finally{db?.closeDeferred();await new Promise(r=>server.close(r))}}
});
