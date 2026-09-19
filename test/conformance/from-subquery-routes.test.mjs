import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';

const here=path.dirname(new URL(import.meta.url).pathname);
const capture=JSON.parse(fs.readFileSync(path.join(here,'cases/stage3-subquery-view.json'),'utf8'));
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');
const ids=['derived-limit-materialized'];

function value(v){
  if(v.type==='null')return null;
  if(v.type==='integer')return BigInt(v.value);
  if(v.type==='real')return Number(v.value);
  if(v.type==='text')return Buffer.from(v.utf8Hex,'hex').toString();
  if(v.type==='blob')return new Uint8Array(Buffer.from(v.hex,'hex'));
  throw Error(`unknown captured value ${v.type}`);
}
function metadata(statement){
  return Array.from({length:statement.columnCount},(_,index)=>{
    const column=statement.columnMetadata(index);
    return{name:column.name,declaredType:column.declaredType,database:column.database,table:column.table,origin:column.origin};
  });
}
async function serve(encoding){
  const body=fs.readFileSync(path.join(generated,`subquery-${encoding}.db`));
  const server=http.createServer((request,response)=>{response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':body.length});response.end(body)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return server;
}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} FROM-subquery routes match pinned SQLite 3.53.4`,async()=>{
  const server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    for(const id of ids){
      const expected=capture.cases.find(item=>item.id===id);assert.ok(expected,id);
      if(expected.native.prepare.kind==='error'){
        assert.throws(()=>db.prepare(expected.sql),error=>error.kind==='sqlite'&&error.code===expected.native.prepare.code&&error.message===expected.native.prepare.message,id);
        continue;
      }
      statement=db.prepare(expected.sql).statement;
      assert.deepEqual(metadata(statement),expected.native.columns,`${id} metadata`);
      const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
      const expectedRows=expected.native.first.rows.map(row=>row.map(value));
      assert.deepEqual(rows,expectedRows,`${id} rows`);
      // Each public step/Fetch row suspends the VDBE. Reset must clear Once and
      // rebuild the statement-owned ephemeral cursor rather than skip its fill.
      if(id==='derived-limit-materialized'){
        statement.reset();
        const rerun=[];while(await statement.step()==='row')rerun.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
        assert.deepEqual(rerun,expectedRows,`${id} reset refills materialization`);
      }
      statement.finalize();statement=undefined;
    }
    // tag-select-0486: both aliases retain the same immutable ViewNode identity.
    // The second independently scans OP_OpenDup of the first materialization.
    statement=db.prepare('SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1').statement;
    assert.deepEqual(metadata(statement),[
      {name:'a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'},
      {name:'a',declaredType:'INTEGER',database:'main',table:'t1',origin:'a'},
    ]);
    const repeated=[];while(await statement.step()==='row')repeated.push([statement.column(0),statement.column(1)]);
    assert.deepEqual(repeated,[[1n,1n],[3n,3n],[5n,5n]],'repeated immutable view rows');
    statement.finalize();statement=undefined;
  }finally{
    try{statement?.finalize()}catch{}
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

// Source-branch discriminator for select.c conditions 1a-c/2a-b/3-5. Unknown
// CTE/self-view facts deliberately select the conservative non-coroutine route.
import {compileTableSelect,fromClauseTermCanBeCoroutine,programOpcodeNames} from '../../src/internal/vdbe.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
const join=Object.freeze({inner:true,cross:false,natural:false,left:false,right:false,outer:false,error:false});
const facts=overrides=>({sourceCount:2,index:1,joinFromLeft:join,nextCross:false,leftOfRightJoin:false,updateFrom:false,coroutineOptimization:true,isCte:false,cteMaterialized:false,cteUseCount:1,cteNotMaterialized:false,earlierSubquery:false,selfJoinView:false,...overrides});
test('fromClauseTermCanBeCoroutine translates represented pinned conditions',()=>{
 assert.equal(fromClauseTermCanBeCoroutine(facts({sourceCount:1,index:0})),true,'1a');
 assert.equal(fromClauseTermCanBeCoroutine(facts({index:0,nextCross:true})),true,'1b');
 assert.equal(fromClauseTermCanBeCoroutine(facts({index:1})),true,'1c');
 assert.equal(fromClauseTermCanBeCoroutine(facts({isCte:true,cteMaterialized:true})),false,'2a');
 assert.equal(fromClauseTermCanBeCoroutine(facts({isCte:true,cteUseCount:2})),false,'2b');
 assert.equal(fromClauseTermCanBeCoroutine(facts({leftOfRightJoin:true})),false,'3');
 assert.equal(fromClauseTermCanBeCoroutine(facts({coroutineOptimization:false})),false,'4');
 assert.equal(fromClauseTermCanBeCoroutine(facts({selfJoinView:true})),false,'5');
 assert.equal(fromClauseTermCanBeCoroutine(facts({joinFromLeft:{...join,cross:true}})),false,'1c cross barrier');
 assert.equal(fromClauseTermCanBeCoroutine(facts({earlierSubquery:true})),false,'1c earlier subquery');
 assert.equal(fromClauseTermCanBeCoroutine(facts({isCte:null})),false,'unknown is conservative');
});


test('0486 repeated immutable view lowers one fill and an independent OpenDup',()=>{
 const parsed=parseSql('SELECT x.a,y.a FROM v_limited x JOIN v_limited y ON x.a=y.a ORDER BY 1');assert.equal(parsed.statement?.kind,'select');
 const storage=ImmutableStorage.open(fs.readFileSync(path.join(generated,'subquery-utf8.db'))),owner={[storageOwner]:storage};
 try {const names=programOpcodeNames(compileTableSelect(parsed.statement,loadSchemaGraph(owner),btreeFromStorage(storage),100));assert.equal(names.filter(name=>name==='OpenEphemeral').length,1);assert.equal(names.filter(name=>name==='Gosub').length,1);assert.equal(names.filter(name=>name==='OpenDup').length,1);}
 finally {storage.close();}
});

test('eligible 0482 route consumes yielded registers without materialization',()=>{
 const expected=capture.cases.find(item=>item.id==='derived-limit-materialized');assert.ok(expected);
 const parsed=parseSql(expected.sql);assert.equal(parsed.statement?.kind,'select');
 const storage=ImmutableStorage.open(fs.readFileSync(path.join(generated,'subquery-utf8.db'))),owner={[storageOwner]:storage};
 try {
  const names=programOpcodeNames(compileTableSelect(parsed.statement,loadSchemaGraph(owner),btreeFromStorage(storage),100));
  for(const name of ['InitCoroutine','Yield','EndCoroutine'])assert.ok(names.includes(name),name);
  for(const name of ['OpenEphemeral','IdxInsert','EphemeralRewind','EphemeralNext'])assert.ok(!names.includes(name),`${name} must not occur in 0482`);
 } finally { storage.close(); }
});

async function withPublicDb(encoding,options,body){
 const server=await serve(encoding);let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);return await body(db);}
 finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
}
async function scalarAdmission(db){const admitted=db.prepare('SELECT 1').statement;try{assert.equal(await admitted.step(),'row');assert.equal(admitted.column(0),1n);}finally{admitted.finalize();}}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} derived producer shares work counter and restores admission`,()=>withPublicDb(encoding,{},async db=>{
 const sql=capture.cases.find(item=>item.id==='derived-limit-materialized').sql;
 const statement=db.prepare(sql).statement;
 await assert.rejects(async()=>{while(await statement.step({maxWorkUnits:6})==='row'){}},error=>error.kind==='limit'&&error.message==='statement exceeds maxWorkUnits');
 assert.throws(()=>statement.finalize(),error=>error.kind==='limit'&&error.message==='statement exceeds maxWorkUnits','first error survives finalize');
 await scalarAdmission(db);
}));

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} materialized producer and outer sorter share private bytes`,()=>withPublicDb(encoding,{limits:{maxPrivateBytes:31}},async db=>{
 const statement=db.prepare('SELECT o.a,s.a FROM t1 o,(SELECT a FROM t1 ORDER BY a LIMIT 3) s ORDER BY 1,2').statement;
 await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error.kind==='limit'&&error.message==='sorter exceeds total byte limit');
 assert.throws(()=>statement.finalize(),error=>error.kind==='limit'&&error.message==='sorter exceeds total byte limit','first error survives cleanup');
 await scalarAdmission(db);
}));

test('coroutine suspension resumes producer state; reset restarts it and finalize restores admission',()=>withPublicDb('utf8',{},async db=>{
 const expected=capture.cases.find(item=>item.id==='derived-limit-materialized'),statement=db.prepare(expected.sql).statement;
 assert.equal(await statement.step(),'row');const first=[statement.column(0),statement.column(1)];
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(await statement.step(),'row');const second=[statement.column(0),statement.column(1)];
 assert.notDeepEqual(second,first,'resume must not restart producer');
 statement.reset();assert.equal(await statement.step(),'row');assert.deepEqual([statement.column(0),statement.column(1)],first,'reset restarts producer');
 statement.finalize();assert.throws(()=>statement.finalize(),error=>error.kind==='misuse');await scalarAdmission(db);
}));

test('coroutine cancellation and deadline preserve first error and restore admission',async()=>{
 for(const operation of [{signal:AbortSignal.abort('allocated cancellation')},{timeoutMs:0}])await withPublicDb('utf8',{},async db=>{
  const sql=capture.cases.find(item=>item.id==='derived-limit-materialized').sql,statement=db.prepare(sql).statement;
  const kind='signal' in operation?'cancelled':'timeout';
  await assert.rejects(statement.step(operation),error=>error.kind===kind);
  assert.throws(()=>statement.finalize(),error=>error.kind===kind,'finalize retains first control error');
  await scalarAdmission(db);
 });
});

test('completed window shape executes while unsafe unmatched derived shape rejects atomically',()=>withPublicDb('utf8',{},async db=>{
 const window=db.prepare('SELECT row_number() OVER () FROM t1').statement;
 try{assert.equal(await window.step(),'row');assert.equal(window.column(0),1n)}finally{window.finalize()}
 const sql='SELECT * FROM (SELECT a FROM t1 ORDER BY a LIMIT 2) WHERE a>1';
 assert.throws(()=>db.prepare(sql),error=>error.kind==='sqlite'||error.kind==='unsupported',sql);
 await scalarAdmission(db);
}));

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} compound-derived aggregate and aggregate-local sorter share private bytes`,()=>withPublicDb(encoding,{limits:{maxPrivateBytes:24}},async db=>{
 const ordered=capture.cases.find(item=>item.id==='aggregate30-group-concat-null-separator');assert.ok(ordered);
 // The same compound-derived producer and aggregate accumulator fit when no
 // aggregate-local ORDER BY queue is live. Adding that queue must charge the
 // statement's existing private-state owner rather than a fresh budget.
 const baseline=ordered.sql.replace('v,NULL ORDER BY n','v,NULL');
 let statement=db.prepare(baseline).statement;
 assert.equal(await statement.step(),'row');assert.equal(statement.column(0),'ba');assert.equal(await statement.step(),'done');statement.finalize();
 statement=db.prepare(ordered.sql).statement;
 await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error.kind==='limit'&&error.message==='sorter exceeds total byte limit');
 assert.throws(()=>statement.finalize(),error=>error.kind==='limit'&&error.message==='sorter exceeds total byte limit','aggregate-local sorter error survives cleanup');
 await scalarAdmission(db);
}));
