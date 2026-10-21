import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {openFixture} from './public-api-adapter.mjs';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {analyzeWhere} from '../../src/internal/where-plan.ts';
import {SelectProgramBuilder} from '../../src/internal/select-program.ts';
import {compileSelectedInRhs,VdbeStatement,DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
import {beginInLoop,finishInLoops} from '../../src/internal/where-in-loop.ts';
const directory=process.env.SELECT_IN_NATIVE_DIR;
assert.ok(directory,'SELECT_IN_NATIVE_DIR required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
for(const variant of capture.variants)test(`${variant.encoding}: original linked table SELECT produces LOOP set without membership tail`,async()=>{
 const bytes=fs.readFileSync(path.join(directory,variant.fixture));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  const database=btreeFromConnection(db),schema=loadSchemaGraph(db);
  const plan=expandAndResolveSelect(parseSql(variant.cases.useful.sql).statement,schema);
  const rhs=analyzeWhere(plan).clause.terms.find(term=>term.inSelectRhs).inSelectRhs;
  const builder=new SelectProgramBuilder();
  builder.reserveCursorsThrough(30);
  const parameters={maximum:0,names:[],named:new Map(),positions:new Map()};
  const set=compileSelectedInRhs(rhs,plan,builder,parameters,{schema,database,maxRows:10000,maxWorkUnits:100000,maxResultBytes:100000,privateStateLimits:DEFAULT_PRIVATE_STATE_LIMITS});
  const output=builder.register();
  const loop=beginInLoop(builder.ops,set.cursor,output,false);
  builder.emit({code:'ResultRow',p1:output,p2:1});
  finishInLoops(builder.ops,[loop],builder.ops.length+1);
  builder.emit({code:'Halt'});
  assert.equal(builder.ops.filter(op=>op.code==='InSet').length,0);
  assert.equal(builder.ops.filter(op=>op.code==='OpenEphemeral').length,1);
  assert.equal(builder.ops.filter(op=>op.code==='IdxInsert').length,1);
  statement=new VdbeStatement({encoding:database.encoding,database,registers:builder.registers,parameters:[],columns:[{name:'key'}],maxWorkUnits:100000,maxResultBytes:100000,privateStateLimits:DEFAULT_PRIVATE_STATE_LIMITS,ops:builder.finish()},()=>{},()=>()=>{},()=>{});
  for(let run=0;run<2;run++){
   const values=[];while(await statement.step()==='row')values.push(statement.column(0));
   // Fixture source keys after numeric affinity/UNIQUE and NULL skipping.
   // affinity merges numeric text/REAL keys; this does not discard nonmatching
   // text/BLOB keys just because the outer table contains only numeric keys.
   assert.deepEqual(values,[1n,2n,'A','A ','a',new Uint8Array([50])]);
   await statement.reset();
  }
 }finally{try{await statement?.finalize()}finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}}
});
