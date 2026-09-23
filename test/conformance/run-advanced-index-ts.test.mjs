import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/stage3-advanced-index.json',import.meta.url),'utf8'));
const specification=JSON.parse(fs.readFileSync(new URL('./cases/stage3-advanced-index.spec.json',import.meta.url),'utf8'));
const privateContracts=new Map(specification.cases.map(c=>[c.id,c.futurePrivateExpected]));
// Partial/expression-index planner admissibility belongs to card-s-c-c. Keep
// exercising pinned public rows, but award no selected-access credit here.
const siblingPlannerCases=new Set(['partial-implied','partial-not-implied','expression-identical','expression-mismatch']);
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
const value=v=>v&&v.type==='blob'?Uint8Array.from(Buffer.from(v.hex,'hex')):typeof v==='number'&&Number.isInteger(v)?BigInt(v):v;
const expectedRows=rows=>rows.map(row=>row.map(decode));
async function rows(statement){const result=[];while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return result}
async function withBytes(bytes,run){
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Type':'application/vnd.sqlite3','Content-Length':bytes.length});r.end(bytes)});
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));let db;
 try{db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/db`));await run(db)}finally{try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()))}
}
async function execute(db,sql,bindings=[]){const statement=db.prepare(sql).statement;try{bindings.forEach((v,i)=>statement.bind(i+1,value(v)));return await rows(statement)}finally{statement.finalize()}}
function assertAccounting(actual,expected,label){
 for(const [name,bound] of Object.entries(expected.counters)){const value=actual[name];assert.equal(typeof value,'number',`${label}/${name}/present`);if(bound.exact!==undefined)assert.equal(value,bound.exact,`${label}/${name}`);if(bound.min!==undefined)assert.ok(value>=bound.min,`${label}/${name}: ${value} < ${bound.min}`);if(bound.max!==undefined)assert.ok(value<=bound.max,`${label}/${name}: ${value} > ${bound.max}`)}
}

test('all 30 pinned advanced-index cases execute through the public TS API',async()=>{
 let attempts=0;
 for(const variant of capture.variants){const bytes=fs.readFileSync(path.resolve(variant.fixture.path));await withBytes(bytes,async db=>{
  for(const c of variant.cases){attempts++;assert.deepEqual(await execute(db,c.sql,c.bindings),expectedRows(c.rows),`${variant.id}/${c.id}`)}
 })}
 assert.equal(attempts,30);
});

test('pinned advanced-index cases satisfy selected-access counters freshly after reset',async()=>{
 let attempts=0;
 for(const variant of capture.variants)await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  for(const c of variant.cases){if(siblingPlannerCases.has(c.id))continue;const expected=privateContracts.get(c.id);assert.ok(expected,`${c.id}/contract`);const statement=db.prepare(c.sql).statement;
   try{for(let run=0;run<2;run++){if(run)statement.reset();statement.clearBindings();c.bindings.forEach((v,i)=>statement.bind(i+1,value(v)));assert.deepEqual(await rows(statement),expectedRows(c.rows),`${variant.id}/${c.id}/${run}/rows`);assertAccounting(privateAccounting(statement),expected,`${variant.id}/${c.id}/${run}`);attempts++}}
   finally{statement.finalize()}
  }
 });
 assert.equal(attempts,36);
});

test('advanced-index lifecycle reset/rebind/finalize matches pinned rows in every encoding',async()=>{
 for(const variant of capture.variants){await withBytes(fs.readFileSync(path.resolve(variant.fixture.path)),async db=>{
  const c=variant.cases.find(c=>c.id==='wr-primary-exact'),statement=db.prepare(c.sql).statement;
  c.bindings.forEach((v,i)=>statement.bind(i+1,value(v)));assert.deepEqual(await rows(statement),expectedRows(variant.lifecycle.firstRows));
  statement.reset();statement.clearBindings();['beta',1].forEach((v,i)=>statement.bind(i+1,value(v)));assert.deepEqual(await rows(statement),expectedRows(variant.lifecycle.secondRows));
  statement.finalize();assert.throws(()=>statement.reset(),/final/i);
 })}
});

test('selected advanced-index corruption fails while off-path primary access remains isolated',async()=>{
 for(const variant of capture.variants)for(const corruption of variant.corruptions){await withBytes(fs.readFileSync(path.resolve(corruption.fixture.path)),async db=>{
  const overflow=corruption.pageKind==='overflow';
  const offPathSql=overflow?'SELECT b FROM p WHERE id=4':"SELECT payload FROM wr WHERE a='Alpha' AND b=1";
  const offPathBindings=[];
  assert.deepEqual(await execute(db,offPathSql,offPathBindings),expectedRows(corruption.offPathRows),`${variant.id}/${corruption.id}/off-path`);
  const selectedSql=overflow?"SELECT payload FROM ov INDEXED BY ov_k_payload WHERE k='needle'":"SELECT a,b FROM wr INDEXED BY wr_c WHERE c>=2.5";
  const statement=db.prepare(selectedSql).statement;let failure;try{await rows(statement)}catch(error){failure=error}finally{try{statement.finalize()}catch{}}
  assert.equal(failure?.kind,'sqlite',`${variant.id}/${corruption.id}/selected`);
  assert.deepEqual(await execute(db,offPathSql,offPathBindings),expectedRows(corruption.reuseRows),`${variant.id}/${corruption.id}/reuse`);
 })}
});
