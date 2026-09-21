import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);

async function closeServer(server){
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

// Pinned SQLite 3.53.4 test/json101.test json101-15.100. This public-path
// reproducer also establishes the eight visible json_each columns and their
// SQLite storage classes; json/root are hidden and therefore absent from *.
test('json_each exposes the upstream table-valued rowset through public Fetch SQL',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT * FROM json_each('{"a":1, "b":2}')`).statement;

    const rows=[];
    while(await statement.step()==='row'){
      rows.push(Array.from({length:statement.columnCount},(_,i)=>({
        type:statement.columnType(i),
        value:statement.column(i),
      })));
    }
    assert.deepEqual(rows,[
      [
        {type:'text',value:'a'}, {type:'integer',value:1n},
        {type:'text',value:'integer'}, {type:'integer',value:1n},
        {type:'integer',value:1n}, {type:'null',value:null},
        {type:'text',value:'$.a'}, {type:'text',value:'$'},
      ],
      [
        {type:'text',value:'b'}, {type:'integer',value:2n},
        {type:'text',value:'integer'}, {type:'integer',value:2n},
        {type:'integer',value:5n}, {type:'null',value:null},
        {type:'text',value:'$.b'}, {type:'text',value:'$'},
      ],
    ]);
  }finally{
    try{statement?.finalize()}catch{}
    db?.closeDeferred();
    await closeServer(bridge.server);
  }
});

// Pinned SQLite 3.53.4 test/json101.test json101-14.140. Unlike the narrow
// json_each literal route above, this requires the recursive built-in source to
// participate in ordinary named-column projection while retaining a scalar root.
test('json_tree exposes the upstream scalar-root fullkey through public Fetch SQL',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare("SELECT fullkey FROM json_tree('123')").statement;
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),'text');
    assert.equal(statement.columnText(0),'\u0024');
    assert.equal(await statement.step(),'done');
  }finally{
    try{statement?.finalize()}catch{}
    db?.closeDeferred();
    await closeServer(bridge.server);
  }
});

// Pinned SQLite 3.53.4 test/json101.test json101-13.100 uses the second
// table-function argument to select $.items. Keep this smaller public-path
// reproducer focused on xFilter root selection and recursive fullkey shaping.
test('json_tree accepts the upstream root argument through public Fetch SQL',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT fullkey FROM json_tree('{"items":[3,5]}', '$.items')`).statement;
    const fullkeys=[];
    while(await statement.step()==='row') fullkeys.push(statement.columnText(0));
    assert.deepEqual(fullkeys,['$.items','$.items[0]','$.items[1]']);
  }finally{
    try{statement?.finalize()}catch{}
    db?.closeDeferred();
    await closeServer(bridge.server);
  }
});

test('json table cursor evaluates parameters, visible expressions and WHERE at runtime',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT fullkey, atom+10 AS adjusted FROM json_tree(?1, ?2) WHERE atom >= 4`).statement;
    statement.bind(1,'{"items":[3,5]}'); statement.bind(2,'$.items');
    assert.equal(await statement.step(),'row');
    assert.deepEqual([statement.columnText(0),statement.columnInteger(1)],['$.items[1]',15n]);
    assert.equal(await statement.step(),'done');
    statement.reset(); statement.bind(1,'{"items":[7]}');
    assert.equal(await statement.step(),'row');
    assert.deepEqual([statement.columnText(0),statement.columnInteger(1)],['$.items[0]',17n]);
    assert.equal(await statement.step(),'done');
  }finally{try{statement?.finalize()}catch{} db?.closeDeferred();await closeServer(bridge.server);}
});

test('jsonb_tree exposes hidden inputs and binary container values',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT typeof(value), typeof(json), root FROM jsonb_tree(jsonb(?1), '$.items') WHERE type='array'`).statement;
    statement.bind(1,'{"items":[3,5]}');
    assert.equal(await statement.step(),'row');
    assert.deepEqual([statement.columnText(0),statement.columnText(1),statement.columnText(2)],['blob','blob','$.items']);
    assert.equal(await statement.step(),'done');
  }finally{try{statement?.finalize()}catch{} db?.closeDeferred();await closeServer(bridge.server);}
});

test('json table cursor composes with LIMIT and OFFSET',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT fullkey FROM json_tree(?1, '$.items') LIMIT 1 OFFSET 1`).statement;
    statement.bind(1,'{"items":[3,5]}');
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnText(0),'$.items[0]');
    assert.equal(await statement.step(),'done');
  }finally{try{statement?.finalize()}catch{} db?.closeDeferred();await closeServer(bridge.server);}
});

test('json table cursor composes with ORDER BY expressions',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT atom AS n, fullkey FROM json_tree(?1, '$.items') WHERE atom IS NOT NULL ORDER BY n DESC LIMIT 2`).statement;
    statement.bind(1,'{"items":[3,7,5]}');
    const rows=[]; while(await statement.step()==='row') rows.push([statement.columnInteger(0),statement.columnText(1)]);
    assert.deepEqual(rows,[[7n,'$.items[1]'],[5n,'$.items[2]']]);
  }finally{try{statement?.finalize()}catch{} db?.closeDeferred();await closeServer(bridge.server);}
});

test('JSON table sources correlate left-to-right in ordinary composition',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT outer.fullkey, inner.atom FROM json_each(?1) AS outer, json_each(outer.value) AS inner WHERE inner.atom > 3`).statement;
    statement.bind(1,'[[1,4],[5]]');
    const rows=[];while(await statement.step()==='row')rows.push([statement.columnText(0),statement.columnInteger(1)]);
    assert.deepEqual(rows,[['$[0]',4n],['$[1]',5n]]);
  }finally{try{statement?.finalize()}catch{} db?.closeDeferred();await closeServer(bridge.server);}
});

test('JSON table scan feeds ordinary aggregate consumers',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT count(*), sum(atom), group_concat(key, ':') FROM json_each(?1) WHERE atom >= 2`).statement;
    statement.bind(1,'{"a":1,"b":2,"c":4}');
    assert.equal(await statement.step(),'row');
    assert.deepEqual([statement.columnInteger(0),statement.columnInteger(1),statement.columnText(2)],[2n,6n,'b:c']);
    assert.equal(await statement.step(),'done');
  }finally{try{statement?.finalize()}catch{} db?.closeDeferred();await closeServer(bridge.server);}
});

test('JSON table scan feeds grouped aggregate consumers',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);let db,statement;
  try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));statement=db.prepare(`SELECT type, count(*), sum(atom) FROM json_each(?1) GROUP BY type`).statement;statement.bind(1,'[1,2,"x",4]');const rows=[];while(await statement.step()==='row')rows.push([statement.columnText(0),statement.columnInteger(1),statement.column(2)]);assert.deepEqual(rows,[['integer',3n,7n],['string',1n,0n]]);}finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});

test('physical rows correlate into JSON table arguments',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);let db,statement;
  try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select4-t1`));statement=db.prepare(`SELECT t1.n, j.atom FROM t1 JOIN json_each('[1,' || t1.n || ']') AS j ON j.atom=t1.n`).statement;const rows=[];while(await statement.step()==='row')rows.push([statement.columnInteger(0),statement.columnInteger(1)]);assert.ok(rows.length>0);assert.ok(rows.every(([left,right])=>left===right));}finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});

test('grouped JSON table aggregates apply HAVING after finalization',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);let db,statement;
  try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));statement=db.prepare(`SELECT type, count(*) AS n FROM json_each(?1) GROUP BY type HAVING count(*) > 1`).statement;statement.bind(1,'[1,2,"x",4]');assert.equal(await statement.step(),'row');assert.deepEqual([statement.columnText(0),statement.columnInteger(1)],['integer',3n]);assert.equal(await statement.step(),'done');}finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});
