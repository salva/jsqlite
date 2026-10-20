import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/retained-filter-native.json',import.meta.url)));
for(const variant of native.variants)test(`${variant.encoding}: retained membership precedes outer WHERE and ORDER`,async()=>{
 const bytes=Buffer.from(variant.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,st;
 try{
  db=await open('https://fixture.invalid/retained-filter');
  for(const item of variant.cases){
   if(item.prepare){assert.throws(()=>db.prepare(item.sql),e=>e.code===item.prepare&&e.message===item.message);continue;}
   st=db.prepare(item.sql).statement;
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.metadata,item.sql);
   for(const run of item.runs){
    if(item.sql.includes('?1'))st.bind(1,run.binding===null?null:BigInt(run.binding));
    const rows=[];
    if(run.end!==101){await assert.rejects(st.step(),e=>e.code===run.end&&e.message===run.message);assert.throws(()=>st.reset(),e=>e.code===run.end&&e.message===run.message);}
    else{while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>({type:st.columnType(i),value:st.column(i)===null?null:String(st.column(i))})));assert.deepEqual(rows,run.rows,item.sql);st.reset();}
   }
   st.finalize();st=undefined;
  }
 }finally{st?.finalize();db?.close();globalThis.fetch=previous;}
});
for(const variant of native.variants)for(const mode of ['bytes','entries','work','result','abort','deadline'])test(`${variant.encoding}: retained filter ${mode} cleanup and reset`,async()=>{
 const previous=globalThis.fetch,reserve=PrivateStateByteBudget.prototype.reserve,budgets=new Set();let db,st;
 globalThis.fetch=async()=>new Response(Buffer.from(variant.base64,'base64'));
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return reserve.apply(this,args);};
 try{
  const limits=mode==='bytes'?{maxPrivateBytes:4096}:mode==='entries'?{maxPrivateEntries:1}:mode==='result'?{maxResultBytes:8}:{};
  db=await open('https://fixture.invalid/retained-resource',{limits});
  st=db.prepare('SELECT d.payload FROM(SELECT x,?1 AS payload FROM t ORDER BY x DESC LIMIT ?2)d WHERE d.x>0 ORDER BY d.x').statement;
  st.bind(1,mode==='bytes'?'x'.repeat(10000):mode==='result'?'x'.repeat(100):'ok');st.bind(2,2n);
  const controller=new AbortController();controller.abort();let first;
  const options=mode==='work'?{maxWorkUnits:1}:mode==='abort'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:{};
  await assert.rejects(async()=>{while(await st.step(options)==='row'){}},e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit');});
  for(const budget of budgets)assert.equal(budget.usedBytes,0);
  assert.throws(()=>st.reset(),e=>e===first);
  st.bind(1,'ok');st.bind(2,mode==='entries'?0n:1n);
  for(let run=0;run<2;run++){if(mode!=='entries'){assert.equal(await st.step(),'row');assert.equal(st.column(0),'ok');}assert.equal(await st.step(),'done');for(const budget of budgets)assert.equal(budget.usedBytes,0);st.reset();}
  st.finalize();st=undefined;for(const budget of budgets)assert.equal(budget.usedBytes,0);
 }finally{st?.finalize();db?.close();globalThis.fetch=previous;PrivateStateByteBudget.prototype.reserve=reserve;}
});
