import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {JSQLiteError} from '../../src/index.ts';

async function row(db,sql){const statement=db.prepare(sql).statement;try{assert.equal(await statement.step(),'row');return Array.from({length:statement.columnCount},(_,i)=>statement.column(i))}finally{statement.finalize()}}

test('public sum/avg/total follows pinned compensated SumCtx branches',async()=>{const bridge=await startFixtureServer(path.resolve('test/fixtures'));let db;try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`));
  assert.deepEqual(await row(db,`SELECT typeof(sum(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END)),sum(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END),avg(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END),total(CASE x WHEN 0 THEN 1e16 WHEN 1 THEN 1.0 WHEN 2 THEN -1e16 END) FROM t1 WHERE x<3`),['real',1,1/3,1],'Kahan-Babuska-Neumaier cancellation');
  assert.deepEqual(await row(db,`SELECT typeof(sum(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END)),sum(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END),avg(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END),total(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 WHEN 2 THEN 0.0 END) FROM t1 WHERE x<3`),['real',9223372036854776000,3074457345618258400,9223372036854776000],'integer overflow followed by REAL clears sum overflow and fixes final classes');
  assert.deepEqual(await row(db,`SELECT sum(CASE x WHEN 0 THEN 9007199254740993 WHEN 1 THEN -9007199254740992 WHEN 2 THEN 0.0 END),avg(CASE x WHEN 0 THEN 9007199254740993 WHEN 1 THEN -9007199254740992 WHEN 2 THEN 0.0 END),total(CASE x WHEN 0 THEN 9007199254740993 WHEN 1 THEN -9007199254740992 WHEN 2 THEN 0.0 END) FROM t1 WHERE x<3`),[1,1/3,1],'large signed int64 split retains low bits across REAL transition');
  const statement=db.prepare(`SELECT sum(CASE x WHEN 0 THEN 9223372036854775807 WHEN 1 THEN 1 END) FROM t1 WHERE x<2`).statement;try{await assert.rejects(statement.step(),e=>e instanceof JSQLiteError&&e.kind==='sqlite'&&e.message==='integer overflow')}finally{try{statement.finalize()}catch{}}
}finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}});
