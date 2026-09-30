import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/three-in-native.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
const encode=v=>v===null?{type:'null'}:typeof v==='bigint'?{type:'integer',value:String(v)}:typeof v==='number'?{type:'real',ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(v);return b.toString('hex')})()}:typeof v==='string'?{type:'text',utf8Hex:Buffer.from(v).toString('hex')}:{type:'blob',hex:Buffer.from(v).toString('hex')};
assert.equal(cap.sourceId,manifest.sqliteSourceId);
for(const variant of cap.variants){
 test(`pinned three-IN selected/scan and LEFT ${variant.encoding}`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),variant.sha256);
  assert.ok(variant.roots.m>0 && variant.roots.m_abc>0);
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   for(const [name,cases] of Object.entries(variant.cases)){
    const st=db.prepare(cap.sql[name]).statement;
    try{
    for(const c of cases){
     c.bindings.forEach((v,i)=>st.bind(i+1,v));
      const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>encode(st.column(i))));
      assert.deepEqual(rows,c.rows,`${name} native ordered typed rows ${JSON.stringify(c.bindings)}`);
      const work=privateAccounting(st);
      if(name==='single'||name.startsWith('left')){
       assert.ok(c.eqp.some(x=>x.includes('m_abc')),`${name} native selected index`);
       assert.ok(c.vdbe.filter(x=>x.opcode==='OpenEphemeral').length>=3,`${name} native per-IN RHS cursor`);
       assert.ok(c.vdbe.filter(x=>x.opcode==='Rewind').length>=3,`${name} native RHS rewind`);
       assert.ok(c.vdbe.some(x=>x.opcode==='SeekGE'),`${name} native composite seek`);
       assert.ok(work.indexSeeks>= (name==='single'?12:15),`${name} public selected probes`);
      }else assert.equal(work.indexSeeks,0,'scan control does not seek index');
      st.reset();
    }
    }finally{st.finalize()}
   }
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
  const broken=Buffer.from(bytes);
  const pageSize=bytes.readUInt16BE(16)||65536;
  broken[(variant.roots.m_abc-1)*pageSize]=0;
  const corruptServer=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':broken.length});r.end(broken)});
  await new Promise((resolve,reject)=>corruptServer.listen(0,'127.0.0.1',resolve).once('error',reject));
  let corruptDb;
  try{
   corruptDb=await openFixture(new Request(`http://127.0.0.1:${corruptServer.address().port}/corrupt`));
   const scan=corruptDb.prepare(cap.sql.scan).statement;
   try{
    variant.cases.scan[0].bindings.forEach((v,i)=>scan.bind(i+1,v));
    const rows=[];while(await scan.step()==='row')rows.push(Array.from({length:scan.columnCount},(_,i)=>encode(scan.column(i))));
    assert.deepEqual(rows,variant.cases.scan[0].rows,'off-path scan still returns typed rows');
    assert.equal(privateAccounting(scan).indexSeeks,0);
   }finally{scan.finalize()}
   const selected=corruptDb.prepare(cap.sql.single).statement;
   try{
    variant.cases.single[0].bindings.forEach((v,i)=>selected.bind(i+1,v));
    await assert.rejects(async()=>{while(await selected.step()==='row'){}},e=>e.kind==='sqlite'&&e.code===11);
   }finally{assert.throws(()=>selected.finalize(),e=>e.kind==='sqlite'&&e.code===11)}
  }finally{try{corruptDb?.closeDeferred()}catch{}await new Promise((resolve,reject)=>corruptServer.close(e=>e?reject(e):resolve()))}
 });
}
