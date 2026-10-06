import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {parseSql} from '../../src/internal/parse.ts';import {loadSchemaGraph} from '../../src/internal/schema.ts';import {btreeFromConnection} from '../../src/internal/btree.ts';import {compileTableSelect} from '../../src/internal/vdbe.ts';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/real-projection-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
for(const v of capture.variants)for(const c of v.cases)test(`${v.encoding}: logical REAL ${c.id} native rows metadata reset liveness`,async()=>{
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db,st;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));st=db.prepare(c.sql).statement;
  assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>{const m=st.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,database:m.database,table:m.table,origin:m.origin}}),c.metadata);
  const program=compileTableSelect(parseSql(c.sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  assert.ok(program.ops.some(op=>op.code==='RealAffinity'),'logical REAL producer present');
  if(c.id==='single-covering')assert.ok(program.ops.some(op=>op.code==='Column'&&op.p3!==undefined&&program.ops.some(open=>open.code==='OpenIndex'&&open.p2===op.p3)),'physical index Column plus logical affinity');
  for(const run of c.runs){st.reset();st.clearBindings();if(run.binding.type!=='null')st.bind(1,run.binding.type==='integer'?BigInt(run.binding.value):run.binding.value);
   const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>st.column(i)));
   assert.deepEqual(rows,run.rows.map(r=>r.map(decode)),`typed ${run.binding.type} ${run.binding.value}`);
   const copy=rows.map(r=>r.slice());st.reset();assert.deepEqual(rows,copy,'returned values remain live across reset');
   if(c.id==='index-or-covering')assert.ok(privateAccounting(st).orBranchStarts===0,'reset clears invocation counters');
  }
  st.finalize();st=null;
 }finally{if(st)try{st.finalize()}catch{}db?.closeDeferred();await new Promise(r=>server.close(r))}
});
