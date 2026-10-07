import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {parseSql} from '../../src/internal/parse.ts';import {btreeFromConnection} from '../../src/internal/btree.ts';import {compileTableSelect} from '../../src/internal/vdbe.ts';import {loadSchemaGraph} from '../../src/internal/schema.ts';import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere,btreeLoops,wherePathSolver,orRuntimeArmClause,branchConsumedTerms} from '../../src/internal/where-plan.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-f-or/commuted-child-native.json',import.meta.url)));
for(const v of capture.variants)test(`${v.id}: commuted-child selected consumption`,async()=>{
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
 for(const c of v.cases){
  const resolved=expandAndResolveSelect(parseSql(c.sql).statement,loadSchemaGraph(db));
  const outer=analyzeWhere(resolved).clause;
  const parent=outer.terms.find(term=>term.info?.kind==='or');
  if(c.id==='ready'){
   const owned=parent.info.clause;
   for(const arm of owned.terms.filter(term=>!term.virtual)){
    const clause=orRuntimeArmClause(arm,1,outer,owned);
    const branch=wherePathSolver([btreeLoops(resolved.sources[1],1,clause,{forcedIndex:null,neededColumns:new Set(resolved.sources[1].table.columns),orderBy:[],resolved})],1,undefined,0,1,null,1n).loops[0];
    const admission=branch.capability.equalitySlots[0];
    assert.ok(admission.term.virtual,'actual selected commuted virtual child');
    assert.equal(admission.term.parentId,arm.id);
    assert.ok(branchConsumedTerms(branch,clause,3n).has(arm),'ready child propagates to original parent');
    assert.equal(branchConsumedTerms(branch,clause,2n).size,0,'unready earlier source prevents child and parent coding');
   }
  }
  if(c.id==='outer')for(const term of outer.terms.filter(term=>term.outerOn))assert.equal(term.outerJoinSafe.mayOmitResidual,false,'nullable LEFT ON not blanket-enabled');
  const program=compileTableSelect(parseSql(c.sql).statement,loadSchemaGraph(db),btreeFromConnection(db),Number.MAX_SAFE_INTEGER);
  const roots=program.ops.filter(op=>op.code==='OpenIndex'&&op.orBranch).map(op=>op.p1);
  if(c.id==='ready'){
   assert.equal(roots.length,2,'actual selected physical arms');
   const first=program.ops.findIndex(op=>op.code==='Gosub');
   assert.equal(program.ops.slice(0,first).filter(op=>op.code==='IfNot').length,0,'selected commuted child consumes original arm before Gosub');
  }
  const st=db.prepare(c.sql).statement;
  try{for(const run of c.runs){const rows=[];let error;
   try{while(await st.step()==='row')rows.push(Array.from({length:2},(_,i)=>st.column(i)).map(value=>value===null?{type:'null'}:{type:'integer',value:String(value)}));}catch(e){error=e;}
   const accounting=privateAccounting(st);
   if(c.id==='ready'){
    assert.deepEqual(accounting.orBranchRoots,Array.from({length:2},()=>roots).flat(),'full repeated enclosing-row branch order');
    assert.ok(accounting.indexSeeks>=4);
   }
   if(c.id==='ready')assert.equal(accounting.residualTests,4,'independent outer bound remains tested; no branch-parent replay');
   assert.deepEqual(rows,run.rows);if(run.code){assert.equal(error?.code,run.code);assert.match(error.message,/integer overflow/);assert.throws(()=>st.reset(),/integer overflow/);}else{assert.equal(error,undefined);st.reset();}
   assert.equal(privateAccounting(st).orBranchStarts,0,'reset clears invocation accounting');
  }}finally{st.finalize();}
 }
 }finally{db?.close();await new Promise(r=>server.close(r));}
});
