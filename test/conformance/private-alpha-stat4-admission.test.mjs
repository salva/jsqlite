import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';

// Private-alpha admission requirement, not STAT4 plan/sample-estimate parity.
// Pinned analyze.c sqlite3AnalysisLoad ignores sqlite_stat4 in a non-STAT4
// build; optional optimizer machinery must not make ordinary SELECT unusable.
// The independent STAT4-enabled native capture owns typed ordered rows. Keep
// stat4-enabled-boundary.test.mjs as historical rejection coverage until its
// semantic owner repairs admission; do not change either test's expectations
// to turn this candidate gate green without the owning implementation repair.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stat4-enabled-boundary.json',import.meta.url)));
const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,pin.sqliteSourceId);
assert.deepEqual(capture.variants.map(v=>v.encoding),['utf8','utf16le','utf16be']);

for(const variant of capture.variants){
  test(`private alpha: query a common STAT4 database ${variant.encoding}`,async()=>{
    const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
    assert.ok(Number(variant.samples.value)>0,'real native ANALYZE sample table');
    const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
    await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
    let db,statement,primary;
    try{
      db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
      for(const [id,sql] of Object.entries(capture.sql)){
        statement=db.prepare(sql).statement;
        assert.equal(statement.columnCount,1);
        assert.equal(statement.columnName(0),'id');
        const drain=async()=>{
          const rows=[];
          while(await statement.step()==='row'){
            assert.equal(statement.columnType(0),'integer');
            const value=statement.column(0);
            assert.equal(typeof value,'bigint');
            rows.push([{type:'integer',value:String(value)}]);
          }
          return rows;
        };
        assert.deepEqual(await drain(),variant.cases[id].rows,`${id}: pinned ordered typed rows`);
        statement.reset();
        assert.deepEqual(await drain(),variant.cases[id].rows,`${id}: reset retains usable schema`);
        statement.finalize();statement=undefined;
      }
      db.close();db=undefined;
    }catch(e){primary=e;throw e}finally{
      // Attempt every cleanup. A cleanup-only failure fails the test; when an
      // operation already failed retain it as primary and print secondaries.
      const cleanup=[];
      try{statement?.finalize()}catch(e){cleanup.push(e)}
      try{db?.closeDeferred()}catch(e){cleanup.push(e)}
      try{await closeTestServer(server)}catch(e){cleanup.push(e)}
      if(cleanup.length){
        if(primary)console.error('STAT4 gate secondary cleanup errors:',cleanup);
        else throw new AggregateError(cleanup,'STAT4 gate cleanup failed');
      }
    }
  });
}
