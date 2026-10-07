import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {IndexCursor} from '../../src/internal/btree.ts';

test('selected skip scan native corruption and operation recovery', {skip:process.env.SKIPSCAN_COPY_PROOF!=='1'&&process.env.SKIPSCAN_DEFAULT_PROOF!=='1'},async()=>{
 const root=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'skipscan-recovery-public'),generation='recovery',dir=path.join(root,'generations',generation),evidence=process.env.SKIPSCAN_NATIVE_ROOT;
 const capture=JSON.parse(fs.readFileSync(path.join(evidence,'native.json'),'utf8'));
 const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));assert.equal(capture.source.sqliteSourceId,pin.sqliteSourceId);
 const variants=capture.variants.filter(v=>v.control==='stat1');
 fs.mkdirSync(dir,{recursive:true});const fixtures=[];
 for(const [i,v] of variants.entries())for(const [name,file,hash] of [['good',v.fixture.path,v.fixture.sha256],['bad',v.malformedSelectedRoot.fixture,v.malformedSelectedRoot.sha256]]){
  const bytes=fs.readFileSync(path.join(evidence,'fixtures',file));assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  const id=`${name}-${i}`;fs.writeFileSync(path.join(dir,`${id}.db`),bytes);fixtures.push({id,path:`${id}.db`,bytes:bytes.length});
 }
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:generation}));fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures}}));
 const bridge=await startFixtureServer(root),original=IndexCursor.prototype.seekKey;let calls=[],abortAtRestart=null;
 IndexCursor.prototype.seekKey=function(values,info,direction){calls.push([direction,values.length]);const result=original.call(this,values,info,direction);if(abortAtRestart&&direction==='gt'&&values.length===1){abortAtRestart.abort();abortAtRestart=null;}return result;};
 const request=id=>new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${id}`);
 try{for(const [i,v] of variants.entries()){
  const sql=v.malformedSelectedRoot.capture.sql;
  const bad=await openFixture(request(`bad-${i}`)),s=bad.prepare(sql).statement;
  try{for(let run=0;run<2;run++){
   assert.equal(v.malformedSelectedRoot.capture.runs[run].stepRc,11);
   await assert.rejects(s.step(),e=>e.code===11);
   assert.throws(()=>s.reset(),e=>e.code===11);
  }}finally{s.finalize();bad.close();}
  const good=await openFixture(request(`good-${i}`)),statement=good.prepare(sql).statement;
  try{
   const baseline=[];while(await statement.step()==='row')baseline.push(statement.columnInteger(0));statement.reset();assert.ok(baseline.length>0);
   const controller=new AbortController();abortAtRestart=controller;calls=[];
   await assert.rejects(async()=>{while(await statement.step({signal:controller.signal})==='row'){}},e=>e.kind==='cancelled');
   assert.ok(calls.some(([d,n])=>d==='gt'&&n===1));assert.throws(()=>statement.reset());
   // These browser operation errors are not native SQLITE_INTERRUPT/OOM equivalents.
   for(const [options,kind] of [[{maxWorkUnits:1},'limit'],[{timeoutMs:0},'timeout'],[{signal:AbortSignal.abort()},'cancelled']]){
    await assert.rejects(statement.step(options),e=>e.kind===kind);
    assert.throws(()=>statement.reset(),e=>e.kind===kind); // consumes saved failure and restores READY
    calls=[];const rows=[];while(await statement.step()==='row')rows.push(statement.columnInteger(0));
    assert.deepEqual(rows,baseline);assert.ok(calls.some(([d,n])=>d==='gt'&&n===1));
    statement.reset();
   }
  }finally{statement.finalize();good.close();}
 }}finally{IndexCursor.prototype.seekKey=original;await new Promise(resolve=>bridge.server.close(resolve));}
});
