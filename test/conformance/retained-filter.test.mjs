import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/retained-filter-native.json',import.meta.url)));
assert.equal(native.variants.length,3);
for(const variant of native.variants){
 assert.equal(variant.cases.length,60,'original membership and F5 cases plus F6 demand and validation controls must remain captured');
  const witnesses=variant.cases.filter(item=>item.sql.startsWith("SELECT d.x FROM(SELECT x,json_extract('bad',")&&(item.sql.endsWith(')d WHERE d.x>0')||item.sql.endsWith(')d WHERE d.x>0 LIMIT 1'))&&item.sql.includes('ORDER BY x LIMIT 2'));
 assert.equal(witnesses.length,2,'both exact F6 witnesses retained');
 assert.deepEqual(witnesses.map(item=>item.runs[0].rows.map(row=>row[0].value)),[['1','2'],['1']]);
 assert.ok(witnesses.every(item=>item.prepare===0&&item.runs.every(run=>run.end===101)));
 for(const fragment of ["json_extract('bad',",'LIMIT abs(-9223372036854775808)']){
  const witness=variant.cases.find(item=>item.sql.includes(fragment)&&item.sql.endsWith('LIMIT 0'));
  assert.ok(witness,'exact F5 witness retained');assert.equal(witness.prepare,0);
  assert.ok(witness.runs.every(run=>run.end===101&&run.rows.length===0));
 }
}
for(const variant of native.variants)test(`${variant.encoding}: retained membership precedes outer WHERE and ORDER`,async()=>{
 const bytes=Buffer.from(variant.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,st;
 try{
  db=await open('https://fixture.invalid/retained-filter');
  for(const item of variant.cases){
   // This native control exercises an existing admission boundary, not parity.
   if(item.sql.includes('JOIN json_each(?)')){assert.throws(()=>db.prepare(item.sql),e=>e.kind==='unsupported'&&e.message==='this derived mixed-module source is not implemented');continue;}
   if(item.sql.startsWith('WITH c(x)')){assert.throws(()=>db.prepare(item.sql),e=>e.kind==='unsupported'&&e.message==='this derived CTE composition is not implemented');continue;}
   if(item.prepare){assert.throws(()=>db.prepare(item.sql),e=>e.code===item.prepare&&e.message===item.message);continue;}
   st=db.prepare(item.sql).statement;
   if(item.parameterCount!==undefined){
    assert.equal(st.parameterCount,item.parameterCount,item.sql);
    assert.deepEqual(Array.from({length:st.parameterCount},(_,i)=>st.parameterName(i+1)),item.parameterNames,item.sql);
   }
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.metadata,item.sql);
   for(const run of item.runs){
    if(Array.isArray(run.binding))run.binding.forEach((value,i)=>st.bind(i+1,value===null?null:BigInt(value)));
    else if(item.sql.includes('?1'))st.bind(1,run.binding===null?null:BigInt(run.binding));
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
