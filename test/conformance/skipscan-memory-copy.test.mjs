import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {SorterCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {IndexCursor} from '../../src/internal/btree.ts';

test('selected skip scan sorter memory failure/reset and connection recovery', {skip:process.env.SKIPSCAN_COPY_PROOF!=='1'&&process.env.SKIPSCAN_DEFAULT_PROOF!=='1'},async()=>{
 const root=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'skipscan-memory-public'),generation='recovery',dir=path.join(root,'generations',generation),evidence=process.env.SKIPSCAN_NATIVE_ROOT;
 const capture=JSON.parse(fs.readFileSync(path.join(evidence,'order-native.json'),'utf8'));
 const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));assert.equal(capture.sourceId,pin.sqliteSourceId);
 const variants=capture.variants.filter(v=>v.control==='18');assert.equal(variants.length,3);
 fs.mkdirSync(dir,{recursive:true});const fixtures=[];
 for(const [i,v] of variants.entries()){
  const bytes=fs.readFileSync(path.join(evidence,v.fixture));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
  const id=`good-${i}`;fs.writeFileSync(path.join(dir,`${id}.db`),bytes);fixtures.push({id,path:`${id}.db`,bytes:bytes.length});
 }
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:generation}));fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures}}));
 const bridge=await startFixtureServer(root),original=IndexCursor.prototype.seekKey;let calls=[],abortAtRestart=null;
 IndexCursor.prototype.seekKey=function(values,info,direction){calls.push([direction,values.length]);const result=original.call(this,values,info,direction);if(abortAtRestart&&direction==='gt'&&values.length===1){abortAtRestart.abort();abortAtRestart=null;}return result;};
 const reserveOriginal=PrivateStateByteBudget.prototype.reserve;let activeBudget=null;
 PrivateStateByteBudget.prototype.reserve=function(bytes,message){activeBudget=this;return reserveOriginal.call(this,bytes,message);};
 const insertOriginal=SorterCursor.prototype.insert;let inject=null,rollbacks=0;
 SorterCursor.prototype.insert=async function(key,payload,control){
  if(!inject)return insertOriginal.call(this,key,payload,control);
  const controller=inject;inject=null;let checks=0;
  try{return await insertOriginal.call(this,key,payload,{checkpoint:async units=>{checks++;if(checks===3){assert.equal(this.first(),true,'growth reached actual cursor');assert.ok(activeBudget.usedBytes>0,'actual shared bytes reserved before abort');controller.abort();}await control.checkpoint(units);}});}
  catch(e){assert.equal(checks,3);assert.equal(this.first(),false,'failed growth removed before VDBE halt');assert.equal(activeBudget.usedBytes,0,'rollback releases shared reservation before halt');rollbacks++;throw e;}
 };
 const timerOriginal=globalThis.setTimeout;let deadlineInject=false,insideDeadlineSort=false,delayedYields=0;
 globalThis.setTimeout=function(fn,ms,...args){if(insideDeadlineSort&&deadlineInject){deadlineInject=false;delayedYields++;return timerOriginal(fn,1100,...args);}return timerOriginal(fn,ms,...args);};
 const sortOriginal=SorterCursor.prototype.sort;let mergeInject=null,mergeFailures=0;
 SorterCursor.prototype.sort=async function(control){
  if(deadlineInject){insideDeadlineSort=true;try{return await sortOriginal.call(this,control);}finally{insideDeadlineSort=false;}}
  if(!mergeInject)return sortOriginal.call(this,control);
  const controller=mergeInject;mergeInject=null;let charges=0;const reserved=activeBudget.usedBytes;assert.ok(reserved>0);
  try{return await sortOriginal.call(this,{checkpoint:async units=>{charges++;if(charges===5)controller.abort();await control.checkpoint(units);}});}
  catch(e){assert.equal(charges,5);assert.equal(activeBudget.usedBytes,reserved,'merge retains ownership until halt');mergeFailures++;throw e;}
 };
 const request=id=>new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${id}`);
 const cell=x=>x===null?{type:'null'}:typeof x==='bigint'?{type:'integer',value:String(x)}:typeof x==='string'?{type:'text',utf8Hex:Buffer.from(x).toString('hex')}:null;
 try{for(const [i,v] of variants.entries()){
  const good=await openFixture(request(`good-${i}`));const c=v.cases.find(c=>c.sql.includes('COLLATE NOCASE'));const statement=good.prepare(c.sql).statement;
  try{for(let run=0;run<2;run++){const controller=new AbortController();inject=controller;calls=[];await assert.rejects(statement.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.ok(calls.some(([d,n])=>d==='ge'&&n===2));assert.throws(()=>statement.reset(),e=>e.kind==='cancelled');const rows=[];while(await statement.step()==='row')rows.push([cell(statement.columnInteger(0)),cell(statement.columnInteger(1))]);assert.deepEqual(rows,c.rows);assert.ok(statement.privateAccounting().sorterRows>0);statement.reset();}}finally{statement.finalize();good.close();}
 }assert.equal(rollbacks,6);
 for(const [i,v] of variants.entries()){
  const good=await openFixture(request(`good-${i}`)),c=v.cases.find(c=>c.sql.includes('COLLATE NOCASE')),statement=good.prepare(c.sql).statement;
  try{for(let run=0;run<2;run++){const controller=new AbortController();mergeInject=controller;calls=[];await assert.rejects(statement.step({signal:controller.signal}),e=>e.kind==='cancelled');assert.ok(calls.some(([d,n])=>d==='gt'&&n===1));assert.equal(activeBudget.usedBytes,0,'halt releases retained merge entries');assert.throws(()=>statement.reset(),e=>e.kind==='cancelled');const rows=[];while(await statement.step()==='row')rows.push([cell(statement.columnInteger(0)),cell(statement.columnInteger(1))]);assert.deepEqual(rows,c.rows);assert.ok(statement.privateAccounting().sorterRows>0);statement.reset();}}finally{statement.finalize();good.close();}
 }assert.equal(mergeFailures,6);
 for(const [i,v] of variants.entries()){const good=await openFixture(request(`good-${i}`)),c=v.cases.find(c=>c.sql.includes('COLLATE NOCASE')),statement=good.prepare(c.sql).statement;try{deadlineInject=true;calls=[];await assert.rejects(statement.step({timeoutMs:1000}),e=>e.kind==='timeout');assert.equal(deadlineInject,false,'real production merge timer yield delayed');assert.ok(calls.some(([d,n])=>d==='gt'&&n===1));assert.equal(activeBudget.usedBytes,0);assert.throws(()=>statement.reset(),e=>e.kind==='timeout');const rows=[];while(await statement.step()==='row')rows.push([cell(statement.columnInteger(0)),cell(statement.columnInteger(1))]);assert.deepEqual(rows,c.rows);}finally{statement.finalize();good.close();}}assert.equal(delayedYields,3);
 for(const [i,v] of variants.entries())for(const limits of [{maxPrivateBytes:128},{maxPrivateEntries:1},{maxPrivateKeyBytes:1}]){
  const good=await openFixture(request(`good-${i}`),{limits});
  const c=v.cases.find(c=>c.sql.includes('COLLATE NOCASE'));assert.ok(c);
  const statement=good.prepare(c.sql).statement;
  try{
   for(let run=0;run<2;run++){
    calls=[];await assert.rejects(async()=>{while(await statement.step()==='row'){}},e=>e.kind==='limit');
    assert.ok(calls.some(([d,n])=>d==='ge'&&n===2),'failure after selected suffix cursor');
    assert.throws(()=>statement.reset(),e=>e.kind==='limit');
   }
  }finally{statement.finalize();}
  // A no-sorter selected program on the same connection must recover exact rows.
  const plain=v.cases.find(c=>c.sql==='SELECT a,b FROM t INDEXED BY ab WHERE b=7 ORDER BY a');assert.ok(plain);
  const recovered=good.prepare(plain.sql).statement;
  try{calls=[];const rows=[];while(await recovered.step()==='row')rows.push([cell(recovered.columnInteger(0)),cell(recovered.columnInteger(1))]);assert.deepEqual(rows,plain.rows);assert.ok(calls.some(([d,n])=>d==='gt'&&n===1));}finally{recovered.finalize();good.close();}
 }}finally{globalThis.setTimeout=timerOriginal;SorterCursor.prototype.sort=sortOriginal;PrivateStateByteBudget.prototype.reserve=reserveOriginal;SorterCursor.prototype.insert=insertOriginal;IndexCursor.prototype.seekKey=original;await new Promise(resolve=>bridge.server.close(resolve));}
});
