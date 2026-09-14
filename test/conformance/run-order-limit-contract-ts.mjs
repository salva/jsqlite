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
  ]){statement=db.prepare(sql).statement;assert.deepEqual(await rows(statement),expected);statement.finalize();statement=undefined}
  assert.throws(()=>db.prepare('SELECT x FROM t1 ORDER BY 2'),error=>error instanceof JSQLiteError&&error.kind==='sqlite'&&error.message==='1st ORDER BY term out of range - should be between 1 and 1');
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('ORDER expression, multi-term, explicit collation/NULL placement, and broad LIMIT remain honest unsupported gaps',async()=>{
 const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  for(const sql of [
   'SELECT x FROM t1 ORDER BY x+1 LIMIT 2',
   'SELECT x,y FROM t1 ORDER BY y ASC,x ASC LIMIT 12',
   'SELECT x FROM t1 ORDER BY x COLLATE NOCASE LIMIT 2',
   'SELECT a FROM t2 ORDER BY a NULLS LAST',
  ]) assert.throws(()=>db.prepare(sql),temporary,sql);
  for(const sql of ['SELECT 1 LIMIT 0','SELECT 1 LIMIT -1','SELECT 1 LIMIT 2.0','SELECT 1 LIMIT \'2\'','SELECT 1 LIMIT NULL','SELECT 1 LIMIT 1.5','SELECT 1 LIMIT \'x\''])
   assert.throws(()=>db.prepare(sql),temporary,sql);
 }finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});

test('captured pinned expectations retain typed storage order and explicit error phase',()=>{
 const typed=expectedRows('order-storage-asc').map(row=>row[1]);
 assert.deepEqual(typed,[null,-1n,1n,1,2n,'1',Uint8Array.of(0x31)]);
 for(const id of ['limit-null-error','limit-fraction-error','limit-text-error','limit-overflow-error']){
  const terminal=byId.get(id).native.terminal;
  assert.equal(terminal.kind,'error');assert.equal(terminal.firstError.operation,'stepAll');assert.equal(terminal.firstError.primaryCode,20);
 }
});
