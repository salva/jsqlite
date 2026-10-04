import test from 'node:test';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {loadSchemaGraph,sqliteLogEst} from '../../src/internal/schema.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {expandAndResolveSelect} from '../../src/internal/resolve.ts';
import {planWhere,logEstAdd} from '../../src/internal/where-plan.ts';
import {compileSelect} from '../../src/internal/select-compiler.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {DEFAULT_PRIVATE_STATE_LIMITS} from '../../src/internal/vdbe.ts';
const cap=JSON.parse(fs.readFileSync(new URL('./cases/row-width-native.json',import.meta.url)));
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
async function fixture(v,fn){
 const bytes=fs.readFileSync(new URL(`../../${v.fixture}`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/`));await fn(db)}finally{db?.closeDeferred();await new Promise(resolve=>server.close(resolve))}
}

// Source-owned branch discriminators. Independent readonly native capture precedes
// these assertions; existing row-width acceptance is retained unchanged.
const oracle=JSON.parse(fs.readFileSync(new URL('./cases/row-width-cost-branches.json',import.meta.url)));
assert.equal(oracle.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
for(const v of cap.variants.filter(v=>v.state==='before'))test(`row-width cost branches ${v.encoding}`,async()=>fixture(v,async db=>{
 const schema=loadSchemaGraph(db),table=schema.tables.get('t'),ix=schema.indexes.get('ta');
 const size=BigInt(ix.rowLogEst[0]),ratio=15n*BigInt(ix.szIdxRow)/BigInt(table.szTabRow);
 const logSize=size<=10n?0n:BigInt(sqliteLogEst(size))-33n;
 const cases=oracle.cases.filter(c=>c.encoding===v.encoding);
 for(const [i,c] of cases.entries()){
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL(`../../${c.fixture.path}`,import.meta.url))).digest('hex'),c.fixture.sha256);
  const resolved=expandAndResolveSelect(parseSql(c.sql).statement,schema);
  const selected=planWhere(resolved,{neededColumns:[new Set([table.columns.find(col=>col.name==='tag')])],orderBy:[]});
  const l=selected.path.loops[0];
  const expectedRows=i===2?BigInt(ix.rowLogEst[1])+10n:i===3?BigInt(table.nRowLogEst)-60n:size;
  const expectedRun=i<2?logEstAdd(size+1n+ratio,size+16n-(i===0?1n:0n)):
   i===2?logEstAdd(logEstAdd(logSize,expectedRows+1n+ratio),expectedRows+16n):logEstAdd(logSize,expectedRows+16n);
  // where.c3037 adjusts residual output after run costing; native rows unchanged.
  assert.equal(l.outputRows,i<2?expectedRows-BigInt(i+1):expectedRows);assert.equal(l.runCost,expectedRun);
  assert.equal(l.setupCost,0n);
  if(i===3){assert.equal(l.kind,'rowid');assert.equal(l.indexRowSize,3n)}else assert.equal(l.capability.index,ix);
  const st=db.prepare(c.sql).statement;
  try{for(let run=0;run<2;run++){
   const rows=[];while(await st.step()==='row')rows.push(st.column(0));
   const expected=c.rows.map(x=>x===null?null:i<2?x:BigInt(x));
   assert.deepEqual(rows,expected);st.reset();
  }}finally{st.finalize()}
 }
}));
