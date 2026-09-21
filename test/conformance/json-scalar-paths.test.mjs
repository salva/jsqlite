import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);

async function closeServer(server){
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

// Pinned SQLite 3.53.4 test/json102.test json102-260, exercised through the
// public prepared-statement path rather than an internal JSON helper.
test('json_extract resolves an object path through the public execution path',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/empty`));
    statement=db.prepare(`SELECT json_extract('{"a":2,"c":[4,5,{"f":7}]}', '$.c')`).statement;
    assert.equal(await statement.step(),'row');
    assert.equal(statement.columnType(0),'text');
    assert.equal(statement.columnText(0),'[4,5,{"f":7}]');
    assert.equal(await statement.step(),'done');
  }finally{
    try{statement?.finalize()}catch{}
    db?.closeDeferred();
    await closeServer(bridge.server);
  }
});
