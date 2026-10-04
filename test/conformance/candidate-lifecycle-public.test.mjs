import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

// Frozen pinned native controls captured before this consuming test was authored.
// where.c candidate/path selection -> real SELECT/LEFT lowering -> vdbeapi.c
// bind/reset/clear and column metadata; no runtime native or diagnostic API.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/candidate-lifecycle-native.json',import.meta.url)));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,pin.sqliteSourceId);
const cell=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex');})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
const parameter=v=>v?.type==='blob'?new Uint8Array(Buffer.from(v.hex,'hex')):typeof v==='number'&&Number.isInteger(v)?BigInt(v):v;
for(const variant of capture.variants)test(`${variant.encoding}/${variant.state} competing candidates public lifecycle and LEFT provenance`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const [name,oracle] of Object.entries(variant.cases)){
   const st=db.prepare(capture.sql[name]).statement;
   try{
    assert.deepEqual(oracle.metadata.map((_,i)=>st.columnMetadata(i)),oracle.metadata,`${name} metadata`);
    const rows=async()=>{const result=[];while(await st.step()==='row')result.push(oracle.metadata.map((_,i)=>cell(st.column(i))));return result;};
    for(const run of oracle.runs){
     run.parameters.forEach((v,i)=>st.bind(i+1,parameter(v)));
     assert.deepEqual(await rows(),run.rows,`${name} bound rows`);
     const work=privateAccounting(st);
     if(run.parameters[0]!==null)assert.ok(work.indexSeeks>0,`${name} real selected access`);
     else assert.equal(work.indexSeeks,0,`${name} nullable equality exits before seek`);
     assert.ok(work.plannerCandidates>0,`${name} real candidates`);
     st.reset();assert.deepEqual(await rows(),run.resetRows,`${name} retained reset`);st.reset();
    }
    st.clearBindings();assert.deepEqual(await rows(),oracle.clearRows,`${name} clear bindings`);st.reset();
    assert.throws(()=>st.bind(5,null),e=>e.code===oracle.outOfRangeBind,`${name} range bind error`);
   }finally{st.finalize()}
  }
  assert.throws(()=>db.prepare('SELECT id FROM t INDEXED BY missing_index WHERE a=?1'),e=>e.code===variant.prepareError.code&&e.message===variant.prepareError.message,'missing index prepare error');
 }finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve));}
});
