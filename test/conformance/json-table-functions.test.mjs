import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);

async function closeServer(server){
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

const metadata=statement=>Array.from({length:statement.columnCount},(_,index)=>statement.columnMetadata(index));

for(const encoding of ['utf8','utf16le','utf16be'])test(`JSON table resolved-column metadata matches pinned short-name rules in ${encoding}`,async()=>{
  const bridge=await startFixtureServer(fixtureRoot);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/encoding-${encoding}`));
    statement=db.prepare(`SELECT je.key,je.value,je.type,je.atom,je.id,je.parent,je.fullkey,je.path,je.value AS renamed,je.value,je.value+0, je.value /* kept */ + 0 FROM json_each('[1]') AS je`).statement;
    assert.deepEqual(metadata(statement).map(column=>column.name),['key','value','type','atom','id','parent','fullkey','path','renamed','value','je.value+0','je.value /* kept */ + 0']);
    assert.deepEqual(metadata(statement).slice(0,10).map(column=>[column.declaredType,column.database,column.table,column.origin]),[
      ...['key','value','type','atom','id','parent','fullkey','path'].map(name=>[null,'main','json_each',name]),
      [null,'main','json_each','value'],[null,'main','json_each','value'],
    ]);
    assert.deepEqual(metadata(statement).slice(10).map(column=>[column.declaredType,column.database,column.table,column.origin]),[[null,null,null,null],[null,null,null,null]]);
    assert.equal(await statement.step(),'row');assert.equal(await statement.step(),'done');statement.reset();assert.equal(await statement.step(),'row');statement.finalize();statement=undefined;
    statement=db.prepare(`SELECT * FROM json_tree('[1]')`).statement;assert.deepEqual(metadata(statement).map(column=>column.name),['key','value','type','atom','id','parent','fullkey','path']);assert.equal(await statement.step(),'row');statement.finalize();statement=undefined;
    statement=db.prepare(`SELECT je.value COLLATE NOCASE, je.value+0 AS computed FROM json_each('[1]') AS je`).statement;assert.deepEqual(metadata(statement).map(column=>[column.name,column.database,column.table,column.origin]),[['value','main','json_each','value'],['computed',null,null,null]]);statement.finalize();statement=undefined;
    statement=db.prepare(`SELECT leftj.value, rightj.value AS child FROM json_each('[[1]]') AS leftj, json_each(leftj.value) AS rightj`).statement;assert.deepEqual(metadata(statement).map(column=>[column.name,column.table,column.origin]),[['value','json_each','value'],['child','json_each','value']]);statement.finalize();statement=undefined;
    for(const name of ['json_each','json_tree','jsonb_each','jsonb_tree']){const input=name.startsWith('jsonb_')?`jsonb('[1]')`:`'[1]'`;statement=db.prepare(`SELECT j.key,j.value,j.type,j.atom,j.id,j.parent,j.fullkey,j.path,j.json,j.root FROM ${name}(${input}) AS j`).statement;assert.deepEqual(metadata(statement).map(column=>[column.name,column.declaredType,column.database,column.table,column.origin]),[...['key','value','type','atom','id','parent','fullkey','path'].map(column=>[column,null,'main',name,column]),['json','','main',name,'json'],['root','','main',name,'root']]);statement.finalize();statement=undefined;}
  }finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});

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
  try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/select4-t1`));statement=db.prepare(`SELECT t1.n, j.atom FROM t1 JOIN json_each('[1,' || t1.n || ']') AS j ON j.atom=t1.n`).statement;assert.deepEqual(metadata(statement),[{name:'n',declaredType:'INT',database:'main',table:'t1',origin:'n'},{name:'atom',declaredType:null,database:'main',table:'json_each',origin:'atom'}]);const rows=[];while(await statement.step()==='row')rows.push([statement.columnInteger(0),statement.columnInteger(1)]);assert.ok(rows.length>0);assert.ok(rows.every(([left,right])=>left===right));}finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});

test('grouped JSON table aggregates apply HAVING after finalization',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);let db,statement;
  try{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));statement=db.prepare(`SELECT type, count(*) AS n FROM json_each(?1) GROUP BY type HAVING count(*) > 1`).statement;statement.bind(1,'[1,2,"x",4]');assert.equal(await statement.step(),'row');assert.deepEqual([statement.columnText(0),statement.columnInteger(1)],['integer',3n]);assert.equal(await statement.step(),'done');}finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});

test('JSON table cursor preserves nonminimal JSONB offsets and LIMIT is incremental',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    // CC 06 object payload; C7 01 'a' is a valid nonminimal label header;
    // C3 01 '1' is a valid nonminimal integer header. SQLite IDs use label offsets.
    statement=db.prepare(`SELECT key,id,parent FROM jsonb_tree(?1)`).statement;
    statement.bind(1,Uint8Array.from([0xcc,6,0xc7,1,0x61,0xc3,1,0x31]));
    assert.equal(await statement.step(),'row');assert.deepEqual([statement.column(0),statement.column(1),statement.column(2)],[null,0n,null]);
    assert.equal(await statement.step(),'row');assert.deepEqual([statement.column(0),statement.column(1),statement.column(2)],['a',2n,0n]);assert.equal(await statement.step(),'done');statement.finalize();
    // Nested object values start after their labels, but native row IDs and
    // recursive parent IDs remain label offsets. Root selection must retain
    // both positions, and jsonb_* container values preserve source bytes.
    const nested=Uint8Array.from([0xcc,11,0xc7,1,0x61,0xcc,6,0xc7,1,0x62,0xc3,1,0x31]);
    statement=db.prepare(`SELECT id,parent,typeof(value),value FROM jsonb_tree(?1,'$.a')`).statement;statement.bind(1,nested);
    assert.equal(await statement.step(),'row');assert.deepEqual([statement.columnInteger(0),statement.column(1),statement.columnText(2),statement.columnBlob(3)],[2n,null,'blob',nested.slice(5)]);
    assert.equal(await statement.step(),'row');assert.deepEqual([statement.columnInteger(0),statement.columnInteger(1)],[7n,2n]);assert.equal(await statement.step(),'done');statement.finalize();
    statement=db.prepare(`SELECT id,typeof(value),value FROM jsonb_each(?1)`).statement;statement.bind(1,nested);
    assert.equal(await statement.step(),'row');assert.deepEqual([statement.columnInteger(0),statement.columnText(1),statement.columnBlob(2)],[2n,'blob',nested.slice(5)]);assert.equal(await statement.step(),'done');statement.finalize();
    statement=db.prepare(`SELECT id FROM jsonb_tree(?1)`).statement;statement.bind(1,nested.slice(0,-1));await assert.rejects(statement.step(),error=>error?.message==='malformed JSON');assert.throws(()=>statement.finalize(),error=>error?.message==='malformed JSON');statement=undefined;
    const wide='['+Array.from({length:2000},(_,i)=>i).join(',')+']';
    statement=db.prepare(`SELECT atom FROM json_tree(?1) LIMIT 1`).statement;statement.bind(1,wide);
    // Parsing plus the first row fits; eager row construction/traversal did not.
    assert.equal(await statement.step({maxWorkUnits:2100}),'row');assert.equal(statement.columnType(0),'null');statement.finalize();
  }finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});

test('JSON table cursor budgets retained state and preserves first control error',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`),{limits:{maxPrivateBytes:64}});
    statement=db.prepare(`SELECT atom FROM json_tree(?1)`).statement;statement.bind(1,'[1,2,3]');const first=await statement.step().then(()=>null,error=>error);const second=await statement.step().then(()=>null,error=>error);assert.equal(second,first);assert.throws(()=>statement.finalize(),error=>error===first);statement=undefined;
  }finally{try{statement?.finalize()}catch{}db?.closeDeferred();await closeServer(bridge.server);}
});
