import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';
import {ImmutableStorage,storageOwner} from '../../../../src/internal/storage.ts';import {loadSchemaGraph} from '../../../../src/internal/schema.ts';import {open} from '../../../../src/index.ts';
for(const enc of ['UTF-8','UTF-16le','UTF-16be']){
 const bytes=fs.readFileSync(new URL(`./${enc}.db`,import.meta.url));
 test(`${enc} real loader column_bytes before blob source bytes/counts and retry`,()=>{
  const owner=ImmutableStorage.open(bytes),carrier={[storageOwner]:owner};let groups=0,loads=0;const primary=new Error('copy primary');
  try{
   const capacityPrimary=new Error('capacity copy primary');let copies=0;
   assert.throws(()=>loadSchemaGraph(carrier,{check:phase=>{if(phase==='copy'&&++copies===2)throw capacityPrimary}}),e=>e===capacityPrimary);
   assert.equal(owner.schemaBytes,0);assert.equal(owner.schemaTemporaryBytes,0);
   assert.throws(()=>loadSchemaGraph(carrier,{check:(phase)=>{if(phase==='count')groups++;if(groups>0&&phase==='load'&&++loads===2)throw primary}}),e=>e===primary);
   assert.equal(owner.schemaBytes,0);assert.equal(owner.schemaTemporaryBytes,0);
   const schema=loadSchemaGraph(carrier);const samples=schema.indexes.get('ab').stat4.samples;
   assert.deepEqual(samples.map(s=>Buffer.from(s.p.subarray(0,s.n)).toString('hex')),['313233','312e3235','c3a9','0208','']);
   for(const s of samples){assert.deepEqual(s.anEq,[1n,1n,1n]);assert.deepEqual(s.anLt,[0n,0n,0n]);}
   assert.ok(groups>0);assert.equal(loads,2);
  }finally{owner.close();assert.equal(owner.schemaBytes,0)}
 });
 test(`${enc} public prepare typed rows despite malformed numeric sample records`,async()=>{
  const server=http.createServer((q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
  try{db=await open(`http://127.0.0.1:${server.address().port}/db`);const {statement}=db.prepare('SELECT a,b FROM t ORDER BY a');try{const rows=[];while((await statement.step())==='row')rows.push([statement.column(0),statement.column(1)]);assert.deepEqual(rows,[[1n,'x'],[2n,'y']]);}finally{statement.finalize()}}
  finally{db?.close();await new Promise(r=>server.close(r))}
 });
}
