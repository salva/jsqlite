import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {startFixtureServer} from './fixture-server.mjs';

const fixtureRoot=path.resolve(new URL('../fixtures',import.meta.url).pathname);

async function closeServer(server){
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
}

// Pinned SQLite 3.53.4 test/json103.test json103-100/102/200/202: an
// aggregate over an empty input still returns the canonical empty container.
test('JSON text and JSONB aggregates return empty containers through the public path',async()=>{
  const bridge=await startFixtureServer(fixtureRoot);
  let db,statement;
  try{
    db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/expr-where`));
    statement=db.prepare(`
      SELECT json_group_array(a), hex(jsonb_group_array(a)),
             json_group_object(a,a), hex(jsonb_group_object(a,a))
        FROM t WHERE 0
    `).statement;
    assert.equal(await statement.step(),'row');
    assert.deepEqual(
      Array.from({length:statement.columnCount},(_,i)=>statement.column(i)),
      ['[]','0B','{}','0C'],
    );
    assert.equal(await statement.step(),'done');
  }finally{
    try{statement?.finalize()}catch{}
    db?.closeDeferred();
    await closeServer(bridge.server);
  }
});
