import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {JSQLiteError} from '../../src/index.ts';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/stage3-order-limit-contract.json',import.meta.url),'utf8'));
const byId=new Map(capture.cases.map(c=>[c.id,c]));
const decodeCell=cell=>cell.type==='null'?null:cell.type==='integer'?BigInt(cell.value):cell.type==='real'?Buffer.from(cell.ieee754be,'hex').readDoubleBE():cell.type==='text'?Buffer.from(cell.utf8Hex,'hex').toString('utf8'):Uint8Array.from(Buffer.from(cell.hex,'hex'));
const expectedRows=id=>byId.get(id).native.terminal.rows.map(row=>row.map(decodeCell));
const temporary=error=>error instanceof JSQLiteError&&error.kind==='unsupported'&&error.unsupportedClassification==='temporary';

async function rows(statement){const result=[];while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return result}

// These assertions use the public Statement surface, but remain outside the existing
// 18-case relational denominator until each succeeds and is explicitly promoted.
test('ORDER/LIMIT admitted public slice preserves duplicate metadata and resolver precedence',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  statement=db.prepare('SELECT x, x FROM t1 ORDER BY x LIMIT 1').statement;
  assert.deepEqual([statement.columnMetadata(0),statement.columnMetadata(1)],[
   {name:'x',declaredType:'INT',database:'main',table:'t1',origin:'x'},
   {name:'x',declaredType:'INT',database:'main',table:'t1',origin:'x'},
  ]);
  assert.deepEqual(await rows(statement),[[0n,0n]]);statement.finalize();statement=undefined;
  for(const [sql,expected] of [
   ['SELECT x AS z FROM t1 ORDER BY z LIMIT 2',[[0n],[1n]]],
   ['SELECT x FROM t1 ORDER BY 1 DESC LIMIT 2',[[31n],[30n]]],
   ['SELECT x,y FROM t1 ORDER BY y ASC,x ASC LIMIT 12',expectedRows('fixture-multi-term-gap')],
   // Every resolver identity must survive in its own KeyInfo term. These rows
   // distinguish the secondary key and catch the historical one-term lowering.
   ['SELECT x AS a,y AS b FROM t1 ORDER BY y ASC,a DESC LIMIT 4',[[22n,0n],[12n,0n],[2n,0n],[23n,1n]]],
   ['SELECT x AS a,y AS b FROM t1 ORDER BY 2 ASC,1 DESC LIMIT 4',[[22n,0n],[12n,0n],[2n,0n],[23n,1n]]],
   ['SELECT x AS y,y AS x FROM t1 ORDER BY x ASC,y DESC LIMIT 4',[[22n,0n],[12n,0n],[2n,0n],[23n,1n]]],
  ]){statement=db.prepare(sql).statement;assert.deepEqual(await rows(statement),expected);statement.finalize();statement=undefined}
  assert.throws(()=>db.prepare('SELECT x FROM t1 ORDER BY 2'),error=>error instanceof JSQLiteError&&error.kind==='sqlite'&&error.message==='1st ORDER BY term out of range - should be between 1 and 1');
  assert.throws(()=>db.prepare('SELECT x,y FROM t1 ORDER BY y,3'),error=>error instanceof JSQLiteError&&error.kind==='sqlite'&&error.message==='2nd ORDER BY term out of range - should be between 1 and 2');
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('ORDER expressions, explicit collation/NULL placement, and LIMIT coercion follow pinned behavior',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  for(const [sql,expected] of [
   ['SELECT x,y FROM t1 ORDER BY y+1,x LIMIT 4',[[2n,0n],[12n,0n],[22n,0n],[3n,1n]]],
   ['SELECT a FROM t2 ORDER BY a NULLS LAST',[ [1n],[345n],[67890n],[null],[null] ]],
   ['SELECT a FROM t2 ORDER BY a DESC NULLS FIRST',[[null],[null],[67890n],[345n],[1n]]],
  ]){statement=db.prepare(sql).statement;assert.deepEqual(await rows(statement),expected,sql);statement.finalize();statement=undefined}
  for(const id of ['limit-real-integral','limit-text-integral']){const c=byId.get(id);statement=db.prepare(c.sql).statement;assert.deepEqual(await rows(statement),expectedRows(id),id);statement.finalize();statement=undefined}
  for(const [sql,expected] of [['SELECT x FROM t1 ORDER BY x LIMIT 0',[]],['SELECT x FROM t1 ORDER BY x LIMIT -1 OFFSET 2',Array.from({length:30},(_,i)=>[BigInt(i+2)])],['SELECT x FROM t1 ORDER BY x LIMIT 2 OFFSET -3',[[0n],[1n]]]]){statement=db.prepare(sql).statement;assert.deepEqual(await rows(statement),expected,sql);statement.finalize();statement=undefined}
  // select.c:computeLimitRegisters runs before scalar result production. The
  // pinned native case proves LIMIT 0 bypasses this observable overflow. Reset
  // must preserve that branch and finalize must remain clean.
  {const c=byId.get('limit-zero-skips-result-error');statement=db.prepare(c.sql).statement;assert.deepEqual(await rows(statement),expectedRows(c.id),c.id);statement.reset();assert.equal(await statement.step(),'done');statement.finalize();statement=undefined}
  for(const [sql,label] of [["SELECT 1 LIMIT 0 OFFSET 'x'",'zero LIMIT still coerces invalid OFFSET'],['SELECT 1 LIMIT 0 OFFSET NULL','zero LIMIT still rejects NULL OFFSET']]){statement=db.prepare(sql).statement;await assert.rejects(()=>statement.step(),error=>error instanceof JSQLiteError&&error.kind==='sqlite'&&error.code===20,label);try{statement.finalize()}catch(error){assert.equal(error.code,20,label)}statement=undefined}
  for(const id of ['limit-null-error','limit-fraction-error','limit-text-error','limit-overflow-error']){const c=byId.get(id);statement=db.prepare(c.sql).statement;await assert.rejects(()=>statement.step(),error=>error instanceof JSQLiteError&&error.kind==='sqlite'&&error.code===20,id);try{statement.finalize()}catch(error){assert.equal(error.code,20)}statement=undefined}
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('public ORDER matrix preserves NULL, numeric, TEXT, and BLOB storage classes',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  const expression="CASE y WHEN 0 THEN NULL WHEN 1 THEN -1 WHEN 2 THEN 1 WHEN 3 THEN 1.0 WHEN 4 THEN '1' ELSE x'31' END";
  statement=db.prepare(`SELECT x,${expression} AS k FROM t1 ORDER BY k,x`).statement;
  const actual=await rows(statement);statement.finalize();statement=undefined;
  const groups=[
   {kind:'null',xs:[2n,12n,22n]},
   {kind:'number',xs:[3n,13n,23n,4n,5n,14n,15n,24n,25n]},
   {kind:'text',xs:[6n,16n,26n]},
   {kind:'blob',xs:[0n,1n,7n,8n,9n,10n,11n,17n,18n,19n,20n,21n,27n,28n,29n,30n,31n]},
  ];
  let at=0;
  for(const group of groups){const slice=actual.slice(at,at+group.xs.length);assert.deepEqual(slice.map(r=>r[0]),group.xs,group.kind);for(const [,value] of slice){if(group.kind==='null')assert.equal(value,null);else if(group.kind==='number')assert.ok(typeof value==='bigint'||typeof value==='number');else if(group.kind==='text')assert.equal(typeof value,'string');else assert.ok(value instanceof Uint8Array)}at+=slice.length}
  assert.equal(at,actual.length);
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('public ORDER collations distinguish declared NOCASE, explicit BINARY, RTRIM, and NUL length rules',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-where`));
  const cases=[
   ['declared NOCASE','public-declared-nocase'],
   ['explicit BINARY','public-explicit-binary'],
   ['explicit RTRIM','public-explicit-rtrim'],
   // main.c:nocaseCollatingFunc/sqlite3StrNICmp stop at NUL, then compare
   // full byte lengths. Equal-length a\0b/a\0c therefore tie on NOCASE and b
   // DESC decides their order; the shorter a\0 remains first.
   ['NOCASE embedded NUL','public-nocase-embedded-nul'],
  ];
  for(const [label,id] of cases){const contract=byId.get(id);statement=db.prepare(contract.sql).statement;assert.deepEqual([statement.columnMetadata(0),statement.columnMetadata(1)],[{name:'b',declaredType:'INTEGER',database:'main',table:'t',origin:'b'},label==='declared NOCASE'||label==='explicit BINARY'?{name:'a',declaredType:'TEXT',database:'main',table:'t',origin:'a'}:{name:'k',declaredType:null,database:null,table:null,origin:null}],label);assert.deepEqual(await rows(statement),expectedRows(id),label);statement.finalize();statement=undefined}
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('ORDER result aliases resolve through explicit COLLATE while retaining that collation',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db,statement;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-where`));
  // RTRIM makes the two alias values equal, so b ASC is the observable
  // secondary key. BINARY instead orders 'a' before 'a ' and would reverse
  // the first two rows. Every asserted complete key is distinct; tie stability
  // is not part of this check.
  statement=db.prepare("SELECT b, CASE b WHEN 1 THEN 'a ' WHEN 2 THEN 'a' ELSE 'z' END AS k FROM t ORDER BY k COLLATE RTRIM, b ASC").statement;
  assert.deepEqual(await rows(statement),[[1n,'a '],[2n,'a'],[3n,'z']]);
  statement.finalize();statement=undefined;
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('ORDER/LIMIT structural compounds and subqueries remain typed unsupported',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  const observed=[];
  for(const sql of [
   'SELECT x FROM t1 UNION ALL SELECT x FROM t1 ORDER BY 1 LIMIT 1',
   'SELECT x FROM (SELECT x FROM t1) ORDER BY x LIMIT 1',
   'SELECT (SELECT x FROM t1 LIMIT 1) AS x ORDER BY x LIMIT 1',
  ]){
   let statement;
   try{statement=db.prepare(sql).statement;observed.push({sql,outcome:'accepted'})}
   catch(error){observed.push({sql,outcome:temporary(error)?'temporary-unsupported':String(error)})}
   finally{try{statement?.finalize()}catch{}}
  }
  assert.deepEqual(observed,[
   {sql:'SELECT x FROM t1 UNION ALL SELECT x FROM t1 ORDER BY 1 LIMIT 1',outcome:'temporary-unsupported'},
   {sql:'SELECT x FROM (SELECT x FROM t1) ORDER BY x LIMIT 1',outcome:'temporary-unsupported'},
   {sql:'SELECT (SELECT x FROM t1 LIMIT 1) AS x ORDER BY x LIMIT 1',outcome:'temporary-unsupported'},
  ]);
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('captured pinned expectations retain typed storage order, multi-term order, and explicit error phase',()=>{
 const typed=expectedRows('order-storage-asc').map(row=>row[1]);
 assert.deepEqual(typed,[null,-1n,1n,1,2n,'1',Uint8Array.of(0x31)]);
 assert.deepEqual(expectedRows('fixture-multi-term-gap'),[
  [2n,0n],[12n,0n],[22n,0n],
  [3n,1n],[13n,1n],[23n,1n],
  [4n,2n],[14n,2n],[24n,2n],
  [5n,3n],[15n,3n],[25n,3n],
 ]);
 for(const id of ['limit-null-error','limit-fraction-error','limit-text-error','limit-overflow-error']){
  const terminal=byId.get(id).native.terminal;
  assert.equal(terminal.kind,'error');assert.equal(terminal.firstError.operation,'stepAll');assert.equal(terminal.firstError.primaryCode,20);
 }
});
