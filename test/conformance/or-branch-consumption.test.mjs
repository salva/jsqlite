import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {parseSql} from '../../src/internal/parse.ts';import {btreeFromConnection} from '../../src/internal/btree.ts';import {compileTableSelect} from '../../src/internal/vdbe.ts';import {loadSchemaGraph} from '../../src/internal/schema.ts';import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/branch-consumption-native.json',import.meta.url)));
for(const v of capture.variants)test(`${v.id}: branch constraint operand/overflow/reset ownership`,async()=>{
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
 for(const c of v.cases){
  const program=compileTableSelect(parseSql(c.sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const calls=program.ops.filter(op=>op.code==='Gosub');assert.ok(calls.length>=2);const body=calls[0].p2;if(c.id!=='unready')assert.ok(calls.every(op=>op.p2===body));
  const name=c.id==='volatile'?'random':'abs';const functions=program.ops.filter(op=>op.code==='Function'&&op.name===name);
  assert.equal(functions.length,c.id==='unready'?2:1,'one function owner per arm, no repeated ordinary parent');
  if(c.id!=='unready')assert.ok(functions.every(op=>program.ops.indexOf(op)<body),'no volatile/error predicate in common downstream body');
  const nativeFunctions=c.program.filter(row=>row[1].type==='text'&&Buffer.from(row[1].utf8Hex,'hex').toString()==='Function');
  assert.equal(nativeFunctions.length,c.id==='unready'?3:1,'pinned operand sites including retained unready parent/downstream access');
  const st=db.prepare(c.sql).statement;
  try{for(const run of c.runs){if(c.id!=='volatile')st.bind(1,run.binding===null?null:BigInt(run.binding));const rows=[];let error;
   try{while(await st.step()==='row')rows.push(Array.from({length:(['joined','unready'].includes(c.id)?2:1)},(_,i)=>st.column(i)).map(value=>value===null?{type:'null'}:{type:'integer',value:String(value)}));}catch(e){error=e;}
   const accounting=privateAccounting(st);
   if(!run.code&&['direct','volatile','and','nested'].includes(c.id)){
    const roots=program.ops.filter(op=>op.code==='OpenIndex'&&op.orBranch).map(op=>op.p1);
    assert.deepEqual(accounting.orBranchRoots,roots,'complete executed arm root order before reset');
    assert.ok(accounting.indexSeeks>0,'actual physical positioning executed');
    if(['direct','volatile'].includes(c.id))assert.equal(accounting.residualTests,0,'no per-row replay of consumed operand');
   }
   assert.deepEqual(rows,run.rows);if(run.code){assert.equal(error?.code,run.code);assert.match(error.message,/integer overflow/);assert.throws(()=>st.reset(),/integer overflow/);}else{assert.equal(error,undefined);st.reset();}
   assert.equal(privateAccounting(st).orBranchStarts,0,'reset clears invocation accounting');
  }}finally{st.finalize();}
 }
 }finally{db?.close();await new Promise(r=>server.close(r));}
});

test('R1 actual branch consumers receive invocation-local consumed terms',()=>{
 const s=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
 const start=s.indexOf('const emitArm=(tested=false)');const arm=s.slice(start,start+2400);
 assert.ok(!arm.includes('resolveExpression(arm.expression)'),'R1 whole-arm replay after selected positioning');
 assert.ok(arm.includes('consumed.has(term)'));
 assert.ok(s.includes('term.virtual||consumed.has(term)||(term.prereqAll&~ready)!==0n'));
});
