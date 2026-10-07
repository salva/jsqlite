import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {parseSql} from '../../src/internal/parse.ts';import {btreeFromConnection} from '../../src/internal/btree.ts';import {compileTableSelect} from '../../src/internal/vdbe.ts';import {loadSchemaGraph} from '../../src/internal/schema.ts';import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/tested-parent-native.json',import.meta.url)));
// Preserves e21's disconnected ordinary consumer reproducer, then tests actual
// lowered continuation. No SQL-text dispatch or public diagnostic seam.
test('ordinary joined residual consumes tested OR identity',()=>{
 const s=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 assert.ok(!s.includes('for(const term of whereTerms)if(!codedWhere.has(term.id)){'),'ordinary final residual must consume tested identities');
});
for(const v of capture.variants)test(`${v.id}: tested ordinary parent volatile/error ownership`,async()=>{
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
 for(const c of v.cases){
  const program=compileTableSelect(parseSql(c.sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const calls=program.ops.filter(op=>op.code==='Gosub');assert.ok(calls.length>=2);const body=calls[0].p2;assert.ok(calls.every(op=>op.p2===body));
  const name=c.id==='volatile'?'random':'abs';const functions=program.ops.filter(op=>op.code==='Function'&&op.name===name);
  assert.equal(functions.length,2,'one function owner per arm, no repeated ordinary parent');
  assert.ok(functions.every(op=>program.ops.indexOf(op)<body),'no volatile/error predicate in common downstream body');
  const nativeFunctions=c.program.filter(row=>row[1].type==='text'&&Buffer.from(row[1].utf8Hex,'hex').toString()==='Function');
  assert.equal(nativeFunctions.length,2,'pinned Case5 two arm function sites');
  const st=db.prepare(c.sql).statement;
  try{for(const run of c.runs){if(c.id==='error')st.bind(1,run.binding===null?null:BigInt(run.binding));const rows=[];let error;
   try{while(await st.step()==='row')rows.push([st.column(0),st.column(1)].map(value=>value===null?{type:'null'}:{type:'integer',value:String(value)}));}catch(e){error=e;}
   assert.deepEqual(rows,run.rows);if(run.code){assert.equal(error?.code,run.code);assert.match(error.message,/integer overflow/);assert.throws(()=>st.reset(),/integer overflow/);}else{assert.equal(error,undefined);st.reset();}
   assert.equal(privateAccounting(st).orBranchStarts,0);
  }}finally{st.finalize();}
 }
 }finally{db?.close();await new Promise(r=>server.close(r));}
});
