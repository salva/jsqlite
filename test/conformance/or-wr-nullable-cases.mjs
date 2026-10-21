import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {openFixture} from './public-api-adapter.mjs';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere} from '../../src/internal/where-plan.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native.json',import.meta.url)));
const manifest=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
async function withDb(v,run,options){
 const bytes=fs.readFileSync(v.fixture.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.fixture.sha256);
 const server=http.createServer((_q,r)=>r.end(bytes)); await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`),options);await run(db)}finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
}
// Separate processes retain every assertion, encoding and reset without raising
// the file watchdog. The case body is unchanged from or-wr-boundary.
export function registerNullableComposition(join){
 assert.ok(join==='RIGHT'||join==='FULL');
test(`WR ${join} nullable composition matches pinned execution`,async()=>{
 const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-s-i/native-right-full.json',import.meta.url)));
 assert.equal(native.sourceId,manifest.sqliteSourceId);
 for(const v of capture.variants)await withDb(v,async db=>{
  const sql=`SELECT u.x,w.n FROM u ${join} JOIN w ON (w.a=1 OR w.b=2) AND w.n=u.x`;
  const c=native.cases.find(c=>c.encoding===v.encoding&&c.sql===sql);assert.ok(c);
  assert.equal(c.fixtureSha256,v.fixture.sha256);
  const resolved=expandAndResolveSelect(parseSql(sql).statement,loadSchemaGraph(db));
  const plan=planWhere(resolved,{neededColumns:resolved.sources.map(s=>new Set(s.table.columns)),orderBy:[]});
  assert.ok(plan.path===null||plan.path.loops.every(loop=>loop.kind!=='multi-or'),'nullable OR retains non-Case5 execution');
  const s=db.prepare(sql).statement;
  try{
   const metadata=()=>Array.from({length:s.columnCount},(_,i)=>{const m=s.columnMetadata(i);return {name:m.name,declaredType:m.declaredType,database:m.database,table:m.table,origin:m.origin}});
   const bag=rows=>rows.map(row=>JSON.stringify(row)).sort();
   for(let pass=0;pass<2;pass++){
    assert.deepEqual(metadata(),c.metadata);
    const rows=[];
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
     const type=s.columnType(i);assert.ok(type==='integer'||type==='null');
     return type==='null'?{type}:{type,value:String(s.column(i))};
    }));
    assert.deepEqual(bag(rows),bag(c.rows),`${v.encoding} ${join} pass${pass}`);
    assert.equal(await s.step(),'done');s.reset();
   }
  }finally{s.finalize()}
 });
});
}
