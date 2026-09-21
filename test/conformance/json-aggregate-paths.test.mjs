import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';
import {open,JSQLiteError} from '../../src/index.ts';

const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);
async function closeServer(server){await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
async function connect(bridge,options){const request=new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-relational`);return options?open(request,options):openFixture(request)}
async function rows(db,sql){const statement=db.prepare(sql).statement,out=[];try{while(await statement.step()==='row')out.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return out}finally{statement.finalize()}}

// Pinned SQLite 3.53.4 test/json103.test json103-100/102/200/202.
test('all four JSON aggregates return canonical empty containers',async()=>{const bridge=await startFixtureServer(fixtureRoot);let db;try{db=await connect(bridge);assert.deepEqual(await rows(db,`SELECT json_group_array(x),hex(jsonb_group_array(x)),json_group_object(x,x),hex(jsonb_group_object(x,x)) FROM t1 WHERE 0`),[['[]','0B','{}','0C']])}finally{db?.closeDeferred();await closeServer(bridge.server)}});

// json103-110/120/210/220 plus json103-300. CASE supplies the same typed
// classes through Fetch without mutating the immutable fixture database.
test('typed inputs, JSON subtype, duplicate labels and grouped order match pinned behavior',async()=>{const bridge=await startFixtureServer(fixtureRoot);let db;try{db=await connect(bridge);
 assert.deepEqual(await rows(db,`SELECT json_group_array(CASE x WHEN 0 THEN NULL WHEN 1 THEN 9223372036854775807 WHEN 2 THEN 32.5 WHEN 3 THEN 'orange' END ORDER BY x),typeof(sum(CASE x WHEN 0 THEN 1.0 ELSE 0 END)) FROM t1 WHERE x<4`),[['[null,9223372036854775807,32.5,"orange"]','real']]);
 assert.deepEqual(await rows(db,`SELECT json_group_array(json_object('x',x) ORDER BY x),json_group_object('same',x ORDER BY x) FROM t1 WHERE x<3`),[['[{"x":0},{"x":1},{"x":2}]','{"same":0,"same":1,"same":2}']]);
 assert.deepEqual(await rows(db,`SELECT y,json_group_array(x),json(jsonb_group_array(json_object('x',x))),json(jsonb_group_object('k',x)) FROM t1 WHERE x<6 GROUP BY y ORDER BY y`),[[0n,'[2]', '[{"x":2}]','{"k":2}'],[1n,'[3]','[{"x":3}]','{"k":3}'],[2n,'[4]','[{"x":4}]','{"k":4}'],[3n,'[5]','[{"x":5}]','{"k":5}'],[8n,'[0]','[{"x":0}]','{"k":0}'],[9n,'[1]','[{"x":1}]','{"k":1}']]);
}finally{db?.closeDeferred();await closeServer(bridge.server)}});

test('ordinary BLOBs reject while JSONB subtype values embed structurally',async()=>{const bridge=await startFixtureServer(fixtureRoot);let db;try{db=await connect(bridge);await assert.rejects(rows(db,`SELECT json_group_array(x'303132') FROM t1 WHERE x=0`),e=>e instanceof JSQLiteError&&e.kind==='sqlite'&&e.message==='JSON cannot hold BLOB values');assert.deepEqual(await rows(db,`SELECT json_group_array(jsonb(json_object('x',x))),json(jsonb_group_array(jsonb(json_array(x)))) FROM t1 WHERE x<2`),[['[{"x":1},{"x":0}]','[[1],[0]]']])}finally{db?.closeDeferred();await closeServer(bridge.server)}});

// json103-400/410 exercises xStep, xValue and jsonGroupInverse.
test('represented sliding windows preserve value snapshots and inverse order',async()=>{const bridge=await startFixtureServer(fixtureRoot);let db;try{db=await connect(bridge);assert.deepEqual(await rows(db,`SELECT x,json_group_array(x) OVER (ORDER BY x ROWS 2 PRECEDING),json_group_object(x,x) OVER (ORDER BY x ROWS 2 PRECEDING) FROM t1 WHERE x<5 ORDER BY x`),[[0n,'[0]','{"0":0}'],[1n,'[0,1]','{"0":0,"1":1}'],[2n,'[0,1,2]','{"0":0,"1":1,"2":2}'],[3n,'[1,2,3]','{"1":1,"2":2,"3":3}'],[4n,'[2,3,4]','{"2":2,"3":3,"4":4}']]);assert.deepEqual((await rows(db,`SELECT jsonb_group_array(x) OVER (ORDER BY x ROWS 2 PRECEDING) FROM t1 WHERE x<5 ORDER BY x`)).map(([v])=>Buffer.from(v).toString('hex').toUpperCase()),['2B1330','4B13301331','6B133013311332','6B133113321333','6B133213331334'])}finally{db?.closeDeferred();await closeServer(bridge.server)}});

test('JSON aggregate limits, reset/finalize and admission cleanup are shared',async()=>{const bridge=await startFixtureServer(fixtureRoot);try{let db=await connect(bridge,{limits:{maxRows:100,maxResultBytes:1000,maxPrivateBytes:2}}),statement=db.prepare(`SELECT json_group_array(x) FROM t1 WHERE x<4`).statement;await assert.rejects(statement.step(),e=>e instanceof JSQLiteError&&e.kind==='limit');assert.throws(()=>statement.reset(),e=>e.kind==='limit');statement.finalize();statement=undefined;const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize();db.close();db=await connect(bridge);statement=db.prepare(`SELECT json_group_array(x ORDER BY x) FROM t1 WHERE x<3`).statement;assert.equal(await statement.step(),'row');assert.equal(statement.column(0),'[0,1,2]');statement.reset();assert.equal(await statement.step(),'row');assert.equal(statement.column(0),'[0,1,2]');statement.finalize();statement=undefined;db.close()}finally{await closeServer(bridge.server)}});

test('JSON aggregate execution observes bounded work and releases statement admission',async()=>{const bridge=await startFixtureServer(fixtureRoot);let db,statement;try{db=await connect(bridge);statement=db.prepare(`SELECT json_group_array(x) FROM t1`).statement;await assert.rejects(statement.step({maxWorkUnits:0}),e=>e instanceof JSQLiteError&&e.kind==='limit');assert.throws(()=>statement.finalize(),e=>e.kind==='limit');statement=undefined;const admitted=db.prepare('SELECT 1').statement;assert.equal(await admitted.step(),'row');admitted.finalize()}finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await closeServer(bridge.server)}});
