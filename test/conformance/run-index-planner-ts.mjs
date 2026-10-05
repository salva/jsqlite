import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';import {openFixture,privateAccounting} from './public-api-adapter.mjs';
const capture=JSON.parse(fs.readFileSync(new URL('./cases/stage3-index-planner.json',import.meta.url),'utf8'));
async function rows(s){const r=[];while(await s.step()==='row')r.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));return r}
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));
const value=v=>v&&v.type==='blob'?Uint8Array.from(Buffer.from(v.hex,'hex')):typeof v==='number'&&Number.isInteger(v)?BigInt(v):v;
// LEFT where-safety charges ON once, then two base WHERE terms on the
// matched body and two after the next outer row's failed seek/NullRow re-entry.
// The hit recorded before WHERE prevents null-extension of the rejected match.
// Owners: wherecode.c:code_outer_join_constraints; where.c:sqlite3WhereEnd.
// Exact five is TS residual accounting, not native VM_STEP parity. Independent
// committed-runtime trace/native evidence: card-s-b-a-a-b-a-a-a status.md v135.
// All 69 public encoding/case attempts must match rows and the exact/min/max
// production-private accounting contract on every binding execution.
test('all encoding index-planner assertions receive row and private-counter credit',async()=>{
 const work=process.env.SAIVAGE_CARD_WORK_ROOT;assert.ok(work,"SAIVAGE_CARD_WORK_ROOT is required for public execution credit");const temp=path.join(work,'index-planner-public');fs.rmSync(temp,{recursive:true,force:true});const generation='g-index-planner',dir=path.join(temp,'generations',generation);fs.mkdirSync(path.join(dir,'generated'),{recursive:true});
 const fixtures=capture.variants.map(v=>{const source=path.resolve(v.fixture.path),name=path.basename(source);fs.copyFileSync(source,path.join(dir,'generated',name));return{id:`index-planner-${v.id}`,path:`generated/${name}`,bytes:fs.statSync(source).size}});
 fs.writeFileSync(path.join(temp,'CURRENT.json'),JSON.stringify({generationId:generation}));fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures}}));
 const bridge=await startFixtureServer(temp);let db,statement,attempts=0,completed=0;
 try{for(const variant of capture.variants){db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/index-planner-${variant.id}`));for(const c of variant.cases){attempts++;let prepared=false;try{statement=db.prepare(c.sql).statement;prepared=true;for(let run=0;run<c.nativeRuns.length;run++){if(run)statement.reset();statement.clearBindings();c.nativeRuns[run].bindings.forEach((v,i)=>statement.bind(i+1,value(v)));assert.deepEqual(await rows(statement),c.nativeRuns[run].rows.map(r=>r.map(decode)),`${variant.id}/${c.id}`);const a=privateAccounting(statement);for(const [name,bound] of Object.entries(c.privateExpected)){if(name==='freshEachRun')continue;const actual=a[name],label=`${variant.id}/${c.id}/${run}/${name}`;if(bound.exact!==undefined)assert.equal(actual,bound.exact,label);if(bound.min!==undefined)assert.ok(actual>=bound.min,`${label}: ${actual} < ${bound.min}`);if(bound.max!==undefined)assert.ok(actual<=bound.max,`${label}: ${actual} > ${bound.max}`)}}statement.finalize();statement=undefined;completed++}catch(error){throw error}}db.closeDeferred();db=undefined}assert.equal(attempts,capture.accounting.attemptedPublicTsAssertions);assert.equal(capture.accounting.tsCreditedCases,completed);console.log(`Public ordinary WHERE: ${completed}/${attempts} completed cases with exact rows/private bounds`)}finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
