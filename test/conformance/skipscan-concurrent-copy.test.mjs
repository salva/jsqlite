import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {startFixtureServer} from './fixture-server.mjs';
import {openFixture} from './public-api-adapter.mjs';
import {SorterCursor,PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {IndexCursor} from '../../src/internal/btree.ts';

// Bounded browser adaptation: separate connections may progress while one is
// suspended at an async checkpoint. This is not native NOMEM/interruption parity.
test('selected skip scan concurrent connections isolate sorter ownership and saved errors', {skip:process.env.SKIPSCAN_DEFAULT_PROOF!=='1'},async()=>{
 const evidence=process.env.SKIPSCAN_NATIVE_ROOT;
 const capture=JSON.parse(fs.readFileSync(path.join(evidence,'order-native.json'),'utf8'));
 const pin=JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url),'utf8'));
 assert.equal(capture.sourceId,pin.sqliteSourceId);
 const variants=capture.variants.filter(v=>v.control==='18');assert.equal(variants.length,3);
 const root=path.join(process.env.SAIVAGE_CARD_WORK_ROOT,'skipscan-concurrent-public'),generation='concurrent',dir=path.join(root,'generations',generation);
 fs.mkdirSync(dir,{recursive:true});const fixtures=[];
 for(const [i,v] of variants.entries()){
  const bytes=fs.readFileSync(path.join(evidence,v.fixture));assert.equal(createHash('sha256').update(bytes).digest('hex'),v.sha256);
  fs.writeFileSync(path.join(dir,`${i}.db`),bytes);fixtures.push({id:String(i),path:`${i}.db`,bytes:bytes.length});
 }
 fs.writeFileSync(path.join(root,'CURRENT.json'),JSON.stringify({generationId:generation}));fs.writeFileSync(path.join(dir,'catalog.json'),JSON.stringify({semantic:{fixtures}}));
 const bridge=await startFixtureServer(root);
 const reserve=PrivateStateByteBudget.prototype.reserve,sort=SorterCursor.prototype.sort,seek=IndexCursor.prototype.seekKey;
 let currentBudget=null,gate=null,calls=[];
 PrivateStateByteBudget.prototype.reserve=function(bytes,message){currentBudget=this;return reserve.call(this,bytes,message);};
 IndexCursor.prototype.seekKey=function(values,info,direction){calls.push([direction,values.length]);return seek.call(this,values,info,direction);};
 SorterCursor.prototype.sort=async function(control){
  if(gate){const owned=gate;gate=null;owned.budget=currentBudget;owned.arrive();await owned.pause;}
  return sort.call(this,control);
 };
 const cells=statement=>Array.from({length:statement.columnCount},(_,i)=>{const value=statement.columnInteger(i);return value===null?{type:'null'}:{type:'integer',value:String(value)};});
 const consume=async(statement,rows=[])=>{while(await statement.step()==='row')rows.push(cells(statement));return rows;};
 const prepareGate=()=>{let arrive,release;const ready=new Promise(resolve=>{arrive=resolve;});const pause=new Promise(resolve=>{release=resolve;});return {arrive,release,ready,pause,budget:null};};
 try{for(const [i,v] of variants.entries())for(const mode of ['cancelled','timeout','limit']){
  const request=()=>new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${i}`);
  const a=await openFixture(request()),b=await openFixture(request(),mode==='limit'?{limits:{maxPrivateBytes:128}}:undefined);
  const c=v.cases.find(c=>c.sql.includes('COLLATE NOCASE'));assert.ok(c);
  const plain=v.cases.find(c=>c.sql==='SELECT a,b FROM t INDEXED BY ab WHERE b=7 ORDER BY a');assert.ok(plain);
  const sa=a.prepare(c.sql).statement,sb=b.prepare(c.sql).statement;
  const controller=new AbortController(),held=prepareGate();gate=held;calls=[];
  const pending=sa.step(mode==='timeout'?{timeoutMs:1000}:{signal:controller.signal});
  // Observe errors immediately while deliberately delaying the first step.
  const observed=pending.then(value=>({value}),error=>({error}));
  try{
   await held.ready;assert.ok(held.budget.usedBytes>0,'first connection owns sorter reservations at suspension');
   assert.ok(calls.some(([d,n])=>d==='gt'&&n===1),'first production cursor restarted skipped prefixes');
   const retained=held.budget.usedBytes;calls=[];
   if(mode==='limit'){
    await assert.rejects(sb.step(),e=>e.kind==='limit');assert.throws(()=>sb.reset(),e=>e.kind==='limit');
   }else{
    assert.deepEqual(await consume(sb),c.rows);sb.reset();
   }
   assert.equal(held.budget.usedBytes,retained,'other connection halt/reset cannot release suspended owner');
   assert.ok(calls.some(([d,n])=>d==='ge'&&n===2),'second uses actual selected suffix cursor');
   if(mode==='cancelled')controller.abort();
   if(mode==='timeout')await new Promise(resolve=>setTimeout(resolve,1100));
   held.release();const result=await observed;
   if(mode==='limit'){
    assert.equal(result.value,'row');assert.deepEqual(await consume(sa,[cells(sa)]),c.rows);
   }else{
    assert.equal(result.error?.kind,mode);assert.equal(held.budget.usedBytes,0,'failed owner releases its own reservations on halt');
    assert.throws(()=>sa.reset(),e=>e.kind===mode);assert.deepEqual(await consume(sa),c.rows);
   }
   sa.reset();assert.equal(held.budget.usedBytes,0,'successful reset frees retained entries');
   const recovery=b.prepare(plain.sql).statement;
   try{assert.deepEqual(await consume(recovery),plain.rows);}finally{recovery.finalize();}
  }finally{held.release();await observed;sa.finalize();sb.finalize();a.close();b.close();}
 }}finally{SorterCursor.prototype.sort=sort;PrivateStateByteBudget.prototype.reserve=reserve;IndexCursor.prototype.seekKey=seek;await new Promise(resolve=>bridge.server.close(resolve));}
});
