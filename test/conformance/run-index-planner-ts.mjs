import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';

const capture=JSON.parse(fs.readFileSync(new URL('./cases/stage3-index-planner.json',import.meta.url),'utf8'));
const fixturePath=path.resolve('test/conformance/fixtures/index-planner.db');
async function rows(statement){const result=[];while(await statement.step()==='row')result.push(Array.from({length:statement.columnCount},(_,i)=>statement.column(i)));return result}
const decode=c=>c.type==='null'?null:c.type==='integer'?BigInt(c.value):c.type==='real'?Buffer.from(c.ieee754be,'hex').readDoubleBE():c.type==='text'?Buffer.from(c.utf8Hex,'hex').toString():Uint8Array.from(Buffer.from(c.hex,'hex'));

// Attempt every public assertion while granting no planner credit. A temporary
// prepare rejection is the expected pre-W2 result. Once a query prepares, it must
// satisfy every pinned binding run; this test never masks a wrong partial plan.
test('all persistent-index public assertions are attempted without planner credit',async()=>{
 const work=process.env.SAIVAGE_CARD_WORK_ROOT;if(!work)return;
 const temp=path.join(work,'index-planner-public');fs.rmSync(temp,{recursive:true,force:true});
 const generation='g-index-planner', dir=path.join(temp,'generations',generation);
 fs.mkdirSync(path.join(dir,'generated'),{recursive:true});fs.copyFileSync(fixturePath,path.join(dir,'generated/index-planner.db'));
 fs.writeFileSync(path.join(temp,'CURRENT.json'),JSON.stringify({generationId:generation}));
 fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures:[{id:'index-planner',path:'generated/index-planner.db',bytes:fs.statSync(fixturePath).size}]}}));
 const bridge=await startFixtureServer(temp);let db,statement;const outcomes=[];
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/index-planner`));
  for(const c of capture.cases){
   let prepared=false;
   try{
    statement=db.prepare(c.sql).statement;prepared=true;
    for(let run=0;run<c.nativeRuns.length;run++){
     if(run)statement.reset();
     statement.clearBindings();c.nativeRuns[run].bindings.forEach((value,i)=>statement.bind(i+1,typeof value==='number'&&Number.isInteger(value)?BigInt(value):value));
     assert.deepEqual(await rows(statement),c.nativeRuns[run].rows.map(r=>r.map(decode)),c.id);
    }
    outcomes.push({id:c.id,outcome:'matched'});statement.finalize();statement=undefined;
   }catch(error){
    if(prepared)throw error;
    assert.match(String(error?.message??error),/index|unsupported|temporary/i,c.id);
    outcomes.push({id:c.id,outcome:'temporary-unsupported'});
   }
  }
  assert.equal(outcomes.length,capture.accounting.attemptedPublicTsAssertions);
 }finally{try{statement?.finalize()}catch{}try{db?.closeDeferred()}catch{}await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()))}
});
