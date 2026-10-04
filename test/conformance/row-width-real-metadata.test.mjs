import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import http from 'node:http';import {createHash} from 'node:crypto';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,resolvedWhereOrder,logEstAdd} from '../../src/internal/where-plan.ts';
import {compileSelect} from '../../src/internal/select-compiler.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-real-metadata-native.json',import.meta.url)));
assert.equal(cap.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const v of cap.variants)test(`REAL noncover origin metadata lifecycle ${v.encoding}`,async()=>{
 const bytes=fs.readFileSync(v.fixture);assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));
  const schema=loadSchemaGraph(db),table=schema.tables.get('t'),index=schema.indexes.get('tc');
  const resolved=expandAndResolveSelect(parseSql(v.sql).statement,schema);
  const chosen=planWhere(resolved,{neededColumns:[new Set(table.columns)],orderBy:resolvedWhereOrder(resolved)}).path.loops[0];
  assert.equal(chosen.capability.index,index);
  assert.equal(chosen.capability.physicalIndex,index.physical);
  assert.equal(chosen.capability.covering,false);
  assert.equal(chosen.capability.needsTableLookup,true);
  assert.equal(chosen.setupCost,0n);
  // where.c3552/4050: one range bound, clamp10, physical work precedes
  // residual output adjustment. Source-derived costs, not native introspection.
  const total=BigInt(index.rowLogEst[0]);
  const ranged=total-20n<10n?10n:total-20n;
  const rows=ranged<total-1n?ranged:total-1n;
  const seek=total<=10n?0n:BigInt(sqliteLogEst(total)-33);
  const ratio=15n*BigInt(index.szIdxRow)/BigInt(table.szTabRow);
  const step=rows+1n+ratio;
  const expectedRun=logEstAdd(logEstAdd(seek,step),rows+16n);
  assert.equal(chosen.runCost,expectedRun);
  assert.equal(chosen.outputRows,rows);
  assert.ok(expectedRun>logEstAdd(seek,step),'noncover table lookup costs physical work');
  const program=compileSelect(parseSql(v.sql).statement,schema,btreeFromConnection(db),schema.encoding,10000,10000000,10000000,DEFAULT_PRIVATE_STATE_LIMITS,false);
  assert.ok(program.ops.some(op=>op.code==='OpenIndex'&&op.p1===index.rootPage));
  const st=db.prepare(v.sql).statement;try{
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),v.metadata);
   for(const run of v.runs){st.reset();st.clearBindings();st.bind(1,run.binding);
    for(let retained=0;retained<2;retained++){
     if(retained)st.reset();const rows=[];
     while(await st.step()==='row'){assert.equal(st.columnType(0),'integer');assert.equal(st.columnType(1),'real');rows.push([String(st.column(0)),st.column(1),st.column(2)]);}
     assert.deepEqual(rows,run.rows);if(rows.length)assert.ok(privateAccounting(st).indexSeeks>0);
     assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),v.metadata);
     assert.equal(loadSchemaGraph(db),schema);
     assert.equal(index.physical.fields,index.layout.fields);
    }
   }
   st.reset();st.clearBindings();assert.equal(await st.step(),'done');
  }finally{st.finalize()}
 }finally{db?.closeDeferred();await new Promise(r=>server.close(r))}
});
