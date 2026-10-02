import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {JSQLiteError} from '../../src/index.ts';
import {SorterCursor} from '../../src/internal/private-state.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {compileTableSelect,programOpcodeNames} from '../../src/internal/vdbe.ts';
import {ImmutableStorage,storageOwner} from '../../src/internal/storage.ts';
import {btreeFromStorage} from '../../src/internal/btree.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';

const here=path.dirname(new URL(import.meta.url).pathname);
const capture=JSON.parse(fs.readFileSync(path.join(here,'cases/stage3-subquery-view.json'),'utf8'));
const companions=JSON.parse(fs.readFileSync(path.join(here,'cases/stage3-subquery-view-companions.spec.json'),'utf8'));
const current=JSON.parse(fs.readFileSync(path.join(here,'../fixtures/CURRENT.json'),'utf8'));
const generated=path.join(here,'../fixtures/generations',current.generationId,'generated');
const expressionCursorFixtures=path.join(here,'../fixtures/expression-cursor');
const ids=[
  'derived-basic','derived-nested','derived-limit-materialized','derived-join','derived-group-order','derived-compound',
  'view-basic','view-nested','view-correlated','view-metadata','view-explicit-columns','view-inferred-columns',
  'view-duplicate-inferred','view-explicit-width-error','view-inherited-collation',
  'aggregate30-sum-real-promotion','aggregate30-sum-int64-overflow','aggregate30-total-no-overflow',
  'aggregate30-group-concat-null-separator',
  'scalar-constant','scalar-first-row','scalar-empty-null','scalar-correlated','exists-correlated','not-exists','in-select','in-null-hit','in-null-miss','in-empty','in-affinity','lexical-shadow','correlated-two-level','error-ambiguous','error-missing','error-width-scalar','error-width-in','reset-rebind-correlated',
];

function value(v){
  if(v.type==='null')return null;
  if(v.type==='integer')return BigInt(v.value);
  if(v.type==='real'){
    if(v.ieee754be){const bytes=Buffer.from(v.ieee754be,'hex');return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getFloat64(0,false);}
    return Number(v.value);
  }
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
  const empty=fs.readFileSync(path.join(generated,'empty.db'));
  const server=http.createServer((request,response)=>{const selected=request.url==='/empty'?empty:body;response.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':selected.length});response.end(selected)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  return server;
}

test('frozen companion tranche has complete executable accounting and direct mappings',()=>{
  assert.deepEqual(companions.accounting,{declared:15,tsAttempted:15,tsCredited:15});
  assert.equal(companions.cases.length,15);
  assert.deepEqual(new Set(companions.cases.map(item=>item.id)),new Set([
    'nesting-prepare-atomic','coroutine-suspend-resume','coroutine-cancel-inner','coroutine-deadline-inner','coroutine-work-inner',
    'materialized-private-growth','in-set-private-growth','overlap-private-budget','reset-before-first-step','reset-after-suspension',
    'rebind-correlated','finalize-suspended','first-error-cleanup','deferred-close-suspended','error-restores-admission',
  ]));
});

for(const encoding of ['utf8','utf16le','utf16be'])for(const id of ids)test(`public ${encoding} ${id} matches pinned SQLite 3.53.4`,async()=>{
  const server=await serve(encoding);let db,emptyDb,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    const expected=capture.cases.find(item=>item.id===id);assert.ok(expected,id);
    const target=expected.fixture==='empty'?(emptyDb=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/empty`))):db;
    if(expected.native.prepare.kind==='error'){
      assert.throws(()=>target.prepare(expected.sql),error=>error.kind==='sqlite'&&error.code===expected.native.prepare.code&&error.message===expected.native.prepare.message,id);
      return;
    }
    statement=target.prepare(expected.sql).statement;
    if(id==='reset-rebind-correlated')statement.bind(1,1n);
    assert.deepEqual(metadata(statement),expected.native.columns,`${id} metadata`);
    const rows=[];
    if(expected.native.first.kind==='error'){
      await assert.rejects(async()=>{while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));},error=>error.kind==='sqlite'&&error.code===expected.native.first.error.code&&error.message===expected.native.first.error.message,id);
      assert.deepEqual(rows,expected.native.first.partialRows.map(row=>row.map(value)),`${id} partial rows`);
    }else{
      while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
      assert.deepEqual(rows,expected.native.first.rows.map(row=>row.map(value)),`${id} rows`);
    }
    if(id==='reset-rebind-correlated'){
      statement.reset();statement.bind(1,3n);const rebound=[];
      while(await statement.step()==='row')rebound.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
      assert.deepEqual(rebound,expected.native.afterResetRebind.rows.map(row=>row.map(value)),`${id} reset/rebind rows`);
    }
    if(expected.native.finalizeCode===0){statement.finalize();statement=undefined;}
    else{assert.throws(()=>statement.finalize(),error=>error.kind==='sqlite'&&error.code===expected.native.finalizeCode,`${id} finalize code`);statement=undefined;}
  }finally{
    try{statement?.finalize()}catch{}
    try{emptyDb?.closeDeferred()}catch{}
    try{db?.closeDeferred()}catch{}
    await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} correlated IN and NOT IN rerun per outer row`,async()=>{
  const server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    statement=db.prepare('SELECT a,a IN (SELECT x FROM t2 WHERE x<=t1.a),a NOT IN (SELECT x FROM t2 WHERE x<=t1.a) FROM t1 ORDER BY a').statement;
    const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1),statement.column(2)]);
    assert.deepEqual(rows,[[1n,1n,0n],[3n,1n,0n],[5n,0n,1n],[7n,0n,1n]]);
    statement.reset();const rerun=[];while(await statement.step()==='row')rerun.push([statement.column(0),statement.column(1),statement.column(2)]);
    assert.deepEqual(rerun,rows,'reset reruns correlated RHS sets');
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} nested IN read cursor preserves the outer row`,async()=>{
  const body=fs.readFileSync(path.join(expressionCursorFixtures,`users-${encoding}.db`));
  const server=http.createServer((_request,response)=>{response.writeHead(200,{'Content-Length':body.length});response.end(body);});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
  let db,statement;
  const rows=async sql=>{
    statement=db.prepare(sql).statement;const result=[];
    while(await statement.step()==='row')result.push(statement.column(0));
    statement.reset();const rerun=[];while(await statement.step()==='row')rerun.push(statement.column(0));
    assert.deepEqual(rerun,result,'reset preserves independently owned read cursors');
    statement.finalize();statement=undefined;return result;
  };
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/users.db`));
    assert.deepEqual(await rows('SELECT name FROM users WHERE id IN (SELECT user_id FROM orders WHERE amount > 30.0) ORDER BY name'),['Alice','Cara']);
    assert.deepEqual(await rows('SELECT name FROM users WHERE id IN (SELECT user_id FROM orders) ORDER BY name'),['Alice','Bob','Cara']);
    assert.deepEqual(await rows('SELECT name FROM users WHERE id IN (SELECT user_id FROM orders WHERE 0) ORDER BY name'),[]);
    assert.deepEqual(await rows("SELECT name FROM users WHERE id NOT IN (SELECT CASE WHEN note IS NULL THEN NULL ELSE user_id END FROM orders) ORDER BY name"),[]);
    assert.deepEqual(await rows('SELECT name FROM users WHERE id IN (SELECT CASE user_id WHEN 1 THEN user_id WHEN 3 THEN user_id ELSE NULL END FROM orders) ORDER BY name'),['Alice','Cara']);
    assert.deepEqual(await rows('SELECT name FROM users WHERE id IN (SELECT CASE WHEN note IS NULL THEN user_id ELSE NULL END FROM orders) ORDER BY name'),['Bob']);
    assert.throws(()=>db.prepare('SELECT name FROM users WHERE id IN (SELECT CASE WHEN missing IS NULL THEN user_id ELSE NULL END FROM orders) ORDER BY name'),error=>error.kind==='sqlite'&&error.code===1&&error.message==='no such column: missing');
    await rows('SELECT name FROM users ORDER BY name');
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('expression subquery control uses Once only for uncorrelated plans',()=>{
  const storage=ImmutableStorage.open(fs.readFileSync(path.join(generated,'subquery-utf8.db'))),owner={[storageOwner]:storage};
  try{
    const schema=loadSchemaGraph(owner),database=btreeFromStorage(storage);
    const opcodes=sql=>{const parsed=parseSql(sql);assert.equal(parsed.statement?.kind,'select');return programOpcodeNames(compileTableSelect(parsed.statement,schema,database,100));};
    assert.ok(opcodes('SELECT a,a IN (SELECT x FROM t2) FROM t1').includes('Once'),'uncorrelated RHS is built once');
    assert.ok(!opcodes('SELECT a,a IN (SELECT x FROM t2 WHERE x<=t1.a) FROM t1').includes('Once'),'correlated RHS is rebuilt per outer row');
  }finally{storage.close();}
});

function companion(id){const found=companions.cases.find(item=>item.id===id);assert.ok(found,id);return found;}
async function scalarAdmission(db){
  const admitted=db.prepare('SELECT 1').statement;
  try{assert.equal(await admitted.step(),'row');assert.equal(admitted.column(0),1n);assert.equal(await admitted.step(),'done');}
  finally{admitted.finalize();}
}

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} nested expression limit is prepare-atomic and restores admission`,async()=>{
  const contract=companion('nesting-prepare-atomic'),server=await serve(encoding);let db;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:contract.limits});
    assert.throws(()=>db.prepare(contract.sql),error=>error.kind===contract.expect.errorKind&&error.message==='SQL expression exceeds maxExpressionDepth');
    await scalarAdmission(db);
  }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} frozen materialized growth fails during step and releases private owners`,async()=>{
  const contract=companion('materialized-private-growth'),server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:contract.limits});
    statement=db.prepare(contract.sql).statement;
    await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error.kind===contract.expect.errorKind,'derived materialization and outer ORDER share one private budget at step');
    assert.throws(()=>statement.finalize(),error=>error.kind===contract.expect.errorKind,'first growth failure survives private-owner cleanup');statement=undefined;
    await scalarAdmission(db);
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} frozen IN error finalize restores admission`,async()=>{
  const contract=companion('error-restores-admission'),server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:contract.limits});statement=db.prepare(contract.sql).statement;
    await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error.kind==='limit','exact IN route reaches its configured private-byte limit during step');
    assert.throws(()=>statement.finalize(),error=>error.kind==='limit','finalize preserves the execution error while releasing state');statement=undefined;
    await scalarAdmission(db);
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} IN-set growth preserves first error and restores admission`,async()=>{
  const contract=companion('in-set-private-growth'),server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:contract.limits});
    statement=db.prepare(contract.sql).statement;
    await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error.kind===contract.expect.errorKind&&error.message==='ephemeral index exceeds total byte limit');
    assert.throws(()=>statement.finalize(),error=>error.kind===contract.expect.errorKind&&error.message==='ephemeral index exceeds total byte limit','finalize preserves the execution error after private-state cleanup');
    statement=undefined;
    await scalarAdmission(db);
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} expression-subquery reset and deferred close release suspended state`,async()=>{
  const server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    statement=db.prepare('SELECT a,a IN (SELECT x FROM t2) FROM t1 ORDER BY a').statement;
    assert.equal(await statement.step(),'row');assert.deepEqual([statement.column(0),statement.column(1)],[1n,1n]);
    statement.reset();
    assert.equal(await statement.step(),'row');assert.deepEqual([statement.column(0),statement.column(1)],[1n,1n],'reset rebuilds the Once-owned IN set');
    db.closeDeferred();
    assert.throws(()=>db.prepare('SELECT 1'),error=>error.kind==='misuse'&&error.message==='connection is closed');
    statement.finalize();statement=undefined;
    assert.throws(()=>db.prepare('SELECT 1'),error=>error.kind==='misuse'&&error.message==='connection is closed');
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} frozen coroutine inner control and work share parent execution`,async()=>{
  const contracts=['coroutine-cancel-inner','coroutine-deadline-inner','coroutine-work-inner'].map(companion),server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    for(const contract of contracts){
      statement=db.prepare(contract.sql).statement;
      // Tighten this producer's operation, not the next admission probe. Work
      // is implementation-defined; SELECT 1 need not fit its six-unit budget.
      const operation=contract.id==='coroutine-cancel-inner'?{signal:AbortSignal.abort('inner cancellation')}:contract.id==='coroutine-deadline-inner'?{timeoutMs:0}:contract.limits;
      await assert.rejects(async()=>{while(await statement.step(operation)==='row'){}},error=>error.kind===contract.expect.errorKind,`${contract.id} is observed inside the shared child execution`);
      assert.throws(()=>statement.column(0),error=>error.kind==='misuse','failed child execution invalidates any exposed row');
      assert.throws(()=>statement.finalize(),error=>error.kind===contract.expect.errorKind,'finalize preserves the first inner control/work error');statement=undefined;
      await scalarAdmission(db);
    }
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} frozen coroutine producer resumes without restart`,async()=>{
  const contract=companion('coroutine-suspend-resume'),server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    statement=db.prepare(contract.sql).statement;
    const rows=[];
    assert.equal(await statement.step(),'row');rows.push([statement.column(0)]);
    await new Promise(resolve=>setTimeout(resolve,0));
    while(await statement.step()==='row')rows.push([statement.column(0)]);
    assert.deepEqual(rows,[[1n],[3n],[5n]],'host suspension resumes the child coroutine rather than restarting it');
    statement.finalize();statement=undefined;
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} frozen correlated reset applies rebound value per rerun`,async()=>{
  const contract=companion('rebind-correlated'),server=await serve(encoding);let db,statement;
  const drain=async()=>{const rows=[];while(await statement.step()==='row')rows.push([statement.column(0),statement.column(1)]);return rows;};
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));statement=db.prepare(contract.sql).statement;
    statement.bind(1,1n);
    assert.deepEqual(await drain(),[[3n,33n],[5n,null],[7n,null]],'first run applies integer:1 to outer and every correlated inner rerun');
    statement.reset();statement.bind(1,4n);
    assert.deepEqual(await drain(),[[5n,null],[7n,null]],'reset discards execution state and applies integer:4 to every correlated rerun');
    statement.finalize();statement=undefined;await scalarAdmission(db);
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} subquery producer reset/finalize lifecycle matches frozen companions`,async()=>{
  const before=companion('reset-before-first-step'),after=companion('reset-after-suspension'),finalized=companion('finalize-suspended');
  const server=await serve(encoding);let db,statement;
  const rows=async target=>{const result=[];while(await target.step()==='row')result.push([target.column(0)]);return result;};
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    statement=db.prepare(before.sql).statement;statement.reset();
    assert.deepEqual(await rows(statement),[[1n],[3n]],'reset before execution starts the producer once from its initial PC');
    statement.finalize();statement=undefined;
    statement=db.prepare(after.sql).statement;
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);statement.reset();
    assert.deepEqual(await rows(statement),[[1n],[3n]],'reset after suspension discards and restarts producer state');
    statement.finalize();statement=undefined;
    statement=db.prepare(finalized.sql).statement;
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);statement.finalize();
    assert.throws(()=>statement.finalize(),error=>error.kind===finalized.expect.errorKind&&error.message==='statement is finalized','second finalize is misuse after exactly-once cleanup');
    statement=undefined;await scalarAdmission(db);
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

test('public frozen first-error cleanup retains injected inner limit over cleanup failure',async()=>{
  const contract=companion('first-error-cleanup'),originalSort=SorterCursor.prototype.sort,originalClose=SorterCursor.prototype.close;
  const primary=new JSQLiteError('limit','injected inner limit'),cleanup=new Error('injected cleanup failure');let failSort=true,closeCalls=0;
  SorterCursor.prototype.sort=async function(control){if(failSort){failSort=false;throw primary}return originalSort.call(this,control)};
  SorterCursor.prototype.close=function(){closeCalls++;originalClose.call(this);throw cleanup};
  const server=await serve('utf8');let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));statement=db.prepare(contract.sql).statement;
    await assert.rejects(statement.step(),error=>error===primary&&error.kind===contract.expect.errorKind,'cleanup failure must not replace first inner limit');
    assert.throws(()=>statement.finalize(),error=>error===primary,'finalize preserves the first error after exhaustive cleanup');statement=undefined;
    assert.equal(closeCalls,1,'private sorter owner is released exactly once');
    await scalarAdmission(db);
  }finally{SorterCursor.prototype.sort=originalSort;SorterCursor.prototype.close=originalClose;try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} frozen overlap route shares one private-state budget`,async()=>{
  const contract=companion('overlap-private-budget'),server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),{limits:contract.limits});
    statement=db.prepare(contract.sql).statement;
    await assert.rejects(async()=>{while(await statement.step()==='row'){}},error=>error.kind===contract.expect.errorKind,'materialization, IN set, grouping, and ordering must charge one private budget');
    assert.throws(()=>statement.finalize(),error=>error.kind===contract.expect.errorKind,'first private-budget error survives complete owner cleanup');statement=undefined;
    await scalarAdmission(db);
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} frozen deferred close releases suspended coroutine exactly once`,async()=>{
  const contract=companion('deferred-close-suspended'),server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
    statement=db.prepare(contract.sql).statement;
    assert.equal(await statement.step(),'row');assert.equal(statement.column(0),1n);
    db.closeDeferred();
    assert.throws(()=>db.prepare('SELECT 1'),error=>error.kind==='misuse'&&error.message==='connection is closed','deferred close immediately stops admission');
    statement.finalize();
    assert.throws(()=>statement.column(0),error=>error.kind==='misuse','suspended row is invalid after finalize');
    assert.throws(()=>statement.finalize(),error=>error.kind==='misuse'&&error.message==='statement is finalized','coroutine private owners are released exactly once');
    statement=undefined;
    assert.throws(()=>db.prepare('SELECT 1'),error=>error.kind==='misuse'&&error.message==='connection is closed','close remains complete after final statement release');
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});

for(const encoding of ['utf8','utf16le','utf16be'])test(`public ${encoding} expression-subquery cancellation and deadline preserve first error and restore admission`,async()=>{
  for(const operation of [{signal:AbortSignal.abort('expression subquery cancellation')},{timeoutMs:0}]){
    const server=await serve(encoding);let db,statement;
    try{
      db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));
      statement=db.prepare('SELECT a FROM t1 WHERE a IN (SELECT y FROM t2) ORDER BY a').statement;
      const kind='signal' in operation?'cancelled':'timeout';
      await assert.rejects(statement.step(operation),error=>error.kind===kind);
      assert.throws(()=>statement.finalize(),error=>error.kind===kind,'finalize preserves first control error');statement=undefined;
      await scalarAdmission(db);
    }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  }
});

const expressionCompositions=[
  {
    name:'join/order/limit with correlated aggregate scalar',
    sql:'SELECT t1.a,(SELECT max(y) FROM t2 WHERE x=t1.a) AS m FROM t1 JOIN t2 AS j ON j.x=t1.a ORDER BY t1.a,j.y LIMIT 2',
    rows:[[1n,12n],[1n,12n]],
  },
  {
    name:'group/having/order/limit with uncorrelated scalar',
    sql:'SELECT c,count(*),(SELECT max(y) FROM t2) AS m FROM t1 GROUP BY c HAVING count(*)>0 ORDER BY c LIMIT 3',
    rows:[[null,1n,33n],['Alpha',2n,33n],['z',1n,33n]],
  },
  {
    name:'distinct/order/limit with nested correlated EXISTS',
    sql:'SELECT DISTINCT c,(SELECT EXISTS(SELECT 1 FROM t2 WHERE x=t1.a)) AS hit FROM t1 ORDER BY c COLLATE NOCASE,hit LIMIT 3',
    rows:[[null,0n],['Alpha',1n],['z',0n]],
  },
  {
    name:'bounded compound with scalar subqueries in both arms',
    sql:'SELECT (SELECT y FROM t2 WHERE x=1 ORDER BY y DESC) AS v UNION ALL SELECT (SELECT y FROM t2 WHERE x=3) ORDER BY v LIMIT 2',
    rows:[[12n],[33n]],
  },
  {
    name:'compound structural ORDER identity across parentheses and collation',
    sql:'SELECT 2+1 UNION ALL SELECT 1+1 ORDER BY ((2 + 1)) COLLATE BINARY',
    rows:[[2n],[3n]],
  },
  {
    name:'compound resolved alias ownership across quoted equivalent spelling and collation',
    sql:'SELECT 2+1 AS "MiXeD" UNION ALL SELECT 1+1 ORDER BY mixed COLLATE BINARY',
    rows:[[2n],[3n]],
  },
];
for(const encoding of ['utf8','utf16le','utf16be'])for(const composition of expressionCompositions)test(`public ${encoding} expression subquery composes with ${composition.name}`,async()=>{
  const server=await serve(encoding);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));statement=db.prepare(composition.sql).statement;
    const rows=[];while(await statement.step()==='row')rows.push(Array.from({length:statement.columnCount},(_,index)=>statement.column(index)));
    assert.deepEqual(rows,composition.rows);
  }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
});
