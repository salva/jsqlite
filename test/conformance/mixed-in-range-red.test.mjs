import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,ROWID_NEEDED} from '../../src/internal/where-plan.ts';
import {openFixture} from './public-api-adapter.mjs';

async function withFixture(bytes, run) {
  const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});res.end(bytes)});
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
  let db;
  try {db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await run(db)}
  finally {try {db?.closeDeferred()} catch {} await new Promise(resolve=>server.close(resolve))}
}
async function rows(db,sql) {const statement=db.prepare(sql).statement;try {const out=[];while(await statement.step()==='row')out.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return out}finally{statement.finalize()}}

// Pinned sqlite3 3.53.4 readonly capture (capture-index-planner.py:query)
// on the advanced-index fixture m(id INTEGER PRIMARY KEY,a,b,c), m_abc(a,b,c).
test('forced IN-prefix with open/closed second-slot boundaries and unconstrained forced traversal',async()=>{
 for(const encoding of ['utf8','utf16le','utf16be'])await withFixture(fs.readFileSync(new URL(`./fixtures/advanced-index-${encoding}.db`,import.meta.url)),async db=>{
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE a IN (1,2) AND a>=1 AND a<3 AND b>=2 AND b<3 AND c>1 ORDER BY id'),[[2n],[4n]],encoding+'/competing first-slot range and later residual');
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE a IN (NULL,2) AND a>=1 AND a<3 AND b>=2 AND b<3 ORDER BY id'),[[4n]],encoding+'/null IN arm');
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE a IN (1,2) AND b>=2 AND b<3 ORDER BY a DESC,b DESC'),[[4n],[2n]],encoding+'/reverse closed lower');
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE a IN (1,2) AND b>1 AND b<=3 ORDER BY a DESC,b DESC'),[[4n],[3n],[2n]],encoding+'/reverse closed upper');
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE a IN (1,2) AND b>2 AND b<3 ORDER BY a DESC,b DESC'),[],encoding+'/empty range');
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE a IN (1,2) AND b>=2 AND b<3 ORDER BY id'),[[2n],[4n]],encoding+'/closed lower');
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE a IN (1,2) AND b>2 AND b<=3 ORDER BY id'),[[3n]],encoding+'/closed upper');
  assert.deepEqual(await rows(db,'SELECT id FROM m INDEXED BY m_abc WHERE c=3 ORDER BY id'),[[3n]],encoding+'/forced full traversal');
  const q='SELECT x.id,y.id,z.id FROM m AS x JOIN m AS y INDEXED BY m_abc ON y.a IN (x.a,z.a) AND y.b>=z.b AND y.b<3 JOIN m AS z ON z.id=2 WHERE x.id=1 ORDER BY y.id';
  const resolved=expandAndResolveSelect(parseSql(q).statement,loadSchemaGraph(db));
  const selected=planWhere(resolved,{neededColumns:resolved.sources.map(source=>new Set([...source.table.columns,ROWID_NEEDED])),orderBy:[]});
  assert.deepEqual(selected.path.loops.map(loop=>loop.sourceOrdinal),[0,2,1],encoding+'/selected dependency order');
  assert.ok(selected.path.loops.find(loop=>loop.sourceOrdinal===1)?.prereq & 4n,encoding+'/future RHS admitted prerequisite');
  assert.deepEqual(await rows(db,q),[[1n,2n,2n]],encoding+'/future RHS prerequisite');
  assert.deepEqual(await rows(db,'SELECT x.id,y.id FROM m AS x INDEXED BY m_abc LEFT JOIN m AS y ON x.a=y.a AND x.b>=y.b AND x.b<3 WHERE x.id=2 ORDER BY y.id'),[[2n,1n],[2n,2n]],encoding+'/preserved-side ON');
  assert.deepEqual(await rows(db,'SELECT x.id,y.id FROM m AS x LEFT JOIN m AS y INDEXED BY m_abc ON y.a IN (x.a,2) AND y.b>=x.b AND y.b<3 WHERE x.id=2 ORDER BY y.id'),[[2n,2n],[2n,4n]],encoding+'/right-side ON');
 });
});
