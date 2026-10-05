import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {closeTestServer} from './close-test-server.mjs';

// This separate pinned build enables SQLITE_ENABLE_STAT4: ANALYZE supplies real
// sample records; analyze.c:loadStat4 and where.c:whereRangeScanEst may use them.
// Like sqlite3AnalysisLoad without SQLITE_ENABLE_STAT4, JS retains the ordinary
// sample table and loads stat1, but does not consume optional optimizer samples.
// Equal row output does not establish sample-estimate/optimizer parity.
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stat4-enabled-boundary.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(capture.sourceId,manifest.sqliteSourceId);
assert.deepEqual(capture.variants.map(v=>v.encoding),['utf8','utf16le','utf16be']);
for(const variant of capture.variants){
 test(`${variant.encoding}: native STAT4-enabled ANALYZE samples with stat1-only admission`,async()=>{
  const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
  assert.equal(variant.kind,'stat4-analyze');
  assert.ok(Number(variant.samples.value)>0,'native ANALYZE generated nonempty samples');
  assert.ok(variant.cases.forced.eqp.some(line=>line.includes('INDEX t_a')));
  assert.deepEqual(variant.cases.forced.rows,variant.cases.unforced.rows,'native typed selected vs forced');
  assert.ok(variant.cases.forced.rows.length>0&&variant.cases.forced.rows.every(r=>r[0].type==='integer'));
  const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db,statement;
  try{
   db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
   const schema=loadSchemaGraph(db),table=schema.tables.get('t'),index=schema.indexes.get('t_a');
   assert.equal(loadSchemaGraph(db),schema,'one connection-owned catalog');
   for(const name of ['sqlite_stat1','sqlite_stat4']){
    const stats=schema.tables.get(name);
    assert.ok(stats.rootPage>0);
    assert.ok(Object.isFrozen(stats));
    assert.ok(schema.objects.includes(stats));
   }
   assert.deepEqual(schema.tables.get('sqlite_stat4').columns.map(c=>c.name),['tbl','idx','neq','nlt','ndlt','sample']);
   assert.equal(index.table,table);
   assert.equal(table.hasStat1,true);
   assert.equal(index.hasStat1,true);
   assert.ok(Object.isFrozen(index.rowLogEst));
   for(const [id,sql] of Object.entries(capture.sql)){
    statement=db.prepare(sql).statement;
    assert.equal(statement.columnMetadata(0).name,'id');
    for(let attempt=0;attempt<2;attempt++){
     const rows=[];
     while(await statement.step()==='row'){
      assert.equal(statement.columnType(0),'integer');
      rows.push([{type:'integer',value:String(statement.column(0))}]);
     }
     assert.deepEqual(rows,variant.cases[id].rows);
     statement.reset();
    }
    statement.finalize();statement=undefined;
   }
  }finally{try{statement?.finalize()}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}}
 });
}
