import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const original=JSON.parse(fs.readFileSync(new URL('./cases/row-width-wr-joined-native.json',import.meta.url)));
const native=JSON.parse(fs.readFileSync(new URL('./cases/without-rowid-joined-native.json',import.meta.url)));
test('joined WR native controls pair lookup plans with exact bindings and label post-runtime resources',()=>{
 for(const v of native.variants){
  for(const c of v.lookup){assert.deepEqual(c.eqpBindings,c.runs[0].bindings);assert.deepEqual(c.eqp,c.runs[0].eqp);assert.deepEqual(c.program,c.runs[0].program);for(const r of c.runs){assert.ok(r.eqp.some(row=>JSON.stringify(row).includes('wr_c')));assert.ok(r.program.length>0)}}
  for(const c of v.postRuntimeNativeControls){assert.equal(c.timing,'post-runtime');assert.equal(c.tsBudgetEquivalent,false);assert.equal(c.stepCode,c.kind==='progress-interrupt'?9:18);assert.equal(c.resetCode,c.stepCode);assert.equal(c.recoveryCode,101);assert.equal(c.finalizeCode,0);assert.ok(c.recoveryRows.length>0)}
 }
});
async function withBytes(bytes,run,options){
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`),options);await run(db)}finally{try{db?.closeDeferred()}finally{await new Promise(r=>server.close(r))}}
}
function typed(st){return Array.from({length:st.columnCount},(_,i)=>{const type=st.columnType(i),v=st.column(i);return type==='integer'?{type,value:String(v)}:type==='text'?{type,utf8Hex:Buffer.from(v).toString('hex')}:type==='null'?{type}:{type,hex:Buffer.from(v).toString('hex')}})}
async function rows(st){const out=[];while(await st.step()==='row')out.push(typed(st));return out}
for(let vi=0;vi<original.variants.length;vi++){
 const fixture=original.variants[vi],bytes=fs.readFileSync(fixture.fixture);
 test(`joined WR typed metadata/reset/rebind native ${fixture.encoding}`,async()=>withBytes(bytes,async db=>{
  for(const c of native.variants[vi].cases){const st=db.prepare(c.sql).statement;
   try{for(let i=0;i<3;i++){const m=c.metadata[i];assert.deepEqual(st.columnMetadata(i),{name:m.name,declaredType:m.decltype,database:m.database_name,table:m.table_name,origin:m.origin_name})}
    for(let ri=0;ri<c.runs.length;ri++){if(ri)st.reset();const run=c.runs[ri];run.bindings.forEach((v,i)=>st.bind(i+1,Uint8Array.from(Buffer.from(v.hex,'hex'))));assert.deepEqual(await rows(st),run.rows);if(run.bindings.length)assert.ok(privateAccounting(st).indexSeeks>0)}
   }finally{st.finalize()}
  }
 }));
 test(`joined WR selected corruption/off-path covering ${fixture.encoding}`,async()=>{
  const pageSize=bytes.readUInt16BE(16)||65536;
  // Fixture's catalog owns roots w=2, wc=3; mutate only the selected page tag.
  for(const [root,selected,offpath] of [[2,'sqlite_autoindex_w_1','wc'],[3,'wc','sqlite_autoindex_w_1']]){
   const bad=Buffer.from(bytes);bad[(root-1)*pageSize]=0;
   await withBytes(bad,async db=>{
    const sql=hint=>`SELECT x.a,y.b,hex(y.c) FROM w x INDEXED BY ${hint} CROSS JOIN w y INDEXED BY ${hint} WHERE y.a=x.a ORDER BY x.a,y.b`;
    const good=async()=>{const st=db.prepare(sql(offpath)).statement;try{assert.equal((await rows(st)).length,2)}finally{st.finalize()}};
    await good();const st=db.prepare(sql(selected)).statement;let error;
    try{await assert.rejects(rows(st),e=>{error=e;return e.kind==='sqlite'&&e.code===11});assert.throws(()=>st.finalize(),e=>e===error)}finally{if(!error)st.finalize()}
    await good();
   });
  }
 });
 test(`joined WR LEFT miss clears primary/secondary and limits latch ${fixture.encoding}`,async()=>{
  await withBytes(bytes,async db=>{
   const st=db.prepare("SELECT x.a,y.b FROM w x LEFT JOIN w y INDEXED BY wc ON y.c=x'ff' AND y.a=x.a ORDER BY x.a").statement;
   try{for(let i=0;i<2;i++){if(i)st.reset();const out=[];while(await st.step()==='row')out.push([st.column(0),st.column(1)]);assert.deepEqual(out,[['A',null],['é',1n]])}}finally{st.finalize()}
  });
  await withBytes(bytes,async db=>{const st=db.prepare(original.sql).statement;let error;await assert.rejects(st.step(),e=>{error=e;return e.kind==='limit'});await assert.rejects(st.step(),e=>e===error);assert.throws(()=>st.finalize(),e=>e===error)}, {limits:{maxWorkUnits:1}});
 });
}

for(const variant of native.variants)test(`joined WR required-primary movement ${variant.encoding}`,async()=>withBytes(fs.readFileSync(variant.lookupFixture),async db=>{
 for(const c of variant.lookup){const st=db.prepare(c.sql).statement;try{for(let i=0;i<c.runs.length;i++){if(i)st.reset();st.bind(1,c.runs[i].bindings[0]);assert.deepEqual(await rows(st),c.runs[i].rows);if(c.runs[i].rows.length)assert.ok(privateAccounting(st).indexSeeks>0)}}finally{st.finalize()}}
}));
