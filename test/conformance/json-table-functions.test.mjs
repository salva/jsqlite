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
