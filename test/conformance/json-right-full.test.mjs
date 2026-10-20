import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {open} from '../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/recursive-join/json-right-full-native.json',import.meta.url)));
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`mixed JSON RIGHT FULL native ${encoding}`,async()=>{
 const bytes=fs.readFileSync(new URL(`./fixtures/row-width-ipk-${encoding.toLowerCase()}.db`,import.meta.url));
 const old=globalThis.fetch;let db;
 try{globalThis.fetch=async()=>new Response(bytes);db=await open('https://fixture.invalid/join');globalThis.fetch=old;
 for(const entry of capture.cases.filter(entry=>entry.encoding===encoding)){
  const s=db.prepare(entry.sql).statement;
  try{
   assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),entry.metadata,entry.sql+' metadata');
   for(let pass=0;pass<2;pass++){
    const rows=[];
    while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{
     const type=s.columnType(i),value=s.column(i);
     return type==='null'?{type}:type==='integer'?{type,value:String(value)}:type==='blob'?{type,value:Buffer.from(value).toString('hex')}:{type:type==='text'?'string':type==='real'?'number':type,value:type==='real'?String(value):value};
    }));
    // No ORDER BY: preserve typed duplicates, not a particular scan order.
    const sorted=rows=>rows.map(row=>JSON.stringify(row)).sort();
    if(/\bORDER BY\b/i.test(entry.sql))assert.deepEqual(rows,entry.rows,entry.sql);
    else assert.deepEqual(sorted(rows),sorted(entry.rows),entry.sql);
    assert.equal(await s.step(),'done');s.reset();
   }
  }finally{s.finalize();}
 }
 }finally{globalThis.fetch=old;db?.close();}
});
test('RIGHT FULL linked table-function forward references reject at prepare',async()=>{
 const old=globalThis.fetch;
 try{for(const encoding of ['utf-8','utf-16le','utf-16be']){
  const bytes=fs.readFileSync(new URL(`./fixtures/row-width-ipk-${encoding}.db`,import.meta.url));
  globalThis.fetch=async()=>new Response(bytes);const db=await open('https://fixture.invalid/dependencies');
  try{for(const join of ['RIGHT','FULL'])for(const argument of ['k.value','(SELECT k.value)','(SELECT 1 UNION ALL SELECT k.value)']){
   const sql=`SELECT t.id,j.value FROM t ${join} JOIN json_each(${argument}) j ON 1 JOIN json_each('[7]') k ON 1`;
   assert.throws(()=>db.prepare(sql),e=>e.kind==='sqlite'&&e.message==='table-function argument references tables to its right',sql);
  }}finally{db.close();}
 }}finally{globalThis.fetch=old;}
});
test('RIGHT FULL native error phases and cleanup',async()=>{
 const old=globalThis.fetch;
 try{for(const encoding of ['UTF-8','UTF-16le','UTF-16be']){
  globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`./fixtures/row-width-ipk-${encoding.toLowerCase()}.db`,import.meta.url)));
  const db=await open('https://fixture.invalid/errors');
  try{for(const entry of capture.errors.filter(e=>e.encoding===encoding)){
   if(entry.prepare){assert.equal(entry.prepare,1);assert.throws(()=>db.prepare(entry.sql),e=>e.kind==='sqlite'&&e.message===entry.message);continue;}
   assert.equal(entry.step,1);assert.equal(entry.reset,1);assert.equal(entry.finalize,0);
   const s=db.prepare(entry.sql).statement;
   await assert.rejects(s.step(),e=>e.kind==='sqlite'&&e.message===entry.message);
   // Public reset reports the saved execution error after cleanup, like C rc.
   assert.throws(()=>s.reset(),e=>e.kind==='sqlite'&&e.message===entry.message);s.finalize();
   const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');recovery.finalize();
  }}finally{db.close();}
 }}finally{globalThis.fetch=old;}
});
test('mixed JSON RIGHT FULL resource boundaries and rebind',async()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/row-width-ipk-utf-8.db',import.meta.url)),old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(bytes);
 try{
  for(const limits of [{maxPrivateEntries:0},{maxPrivateBytes:32}]){
   const db=await open('https://fixture.invalid/budget',{limits});
   try{const s=db.prepare("SELECT t.id,j.value FROM t RIGHT JOIN json_each('[7,7,9]') j ON t.id=j.value").statement;
    await assert.rejects(s.step(),e=>e.kind==='limit');assert.throws(()=>s.finalize(),e=>e.kind==='limit');
    const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');recovery.finalize();
   }finally{db.closeDeferred();}
  }
  const db=await open('https://fixture.invalid/control');
  try{
   for(const options of [{maxWorkUnits:0},{timeoutMs:0}]){
    const s=db.prepare("SELECT t.id,j.value FROM t FULL JOIN json_each('[7,7,9]') j ON 0").statement;
    await assert.rejects(s.step(options),e=>e.kind==='limit'||e.kind==='timeout');assert.throws(()=>s.finalize());
   }
   const s=db.prepare('SELECT t.id,j.value FROM t FULL JOIN json_each(?1) j ON t.id=j.value').statement;
   try{for(const value of ['[7,7,9]','[]','[7,7,9]']){s.bind(1,value);let n=0;while(await s.step()==='row')n++;assert.equal(n,value==='[]'?1:3);s.reset();}}finally{s.finalize();}
   const c=db.prepare("SELECT t.id,j.value FROM t FULL JOIN json_each('[7,7,9]') j ON 0").statement;
   while(await c.step()==='row'){if(c.column(0)===null)break;}
   const abort=new AbortController();abort.abort();await assert.rejects(c.step({signal:abort.signal}),e=>e.kind==='cancelled');assert.throws(()=>c.finalize(),e=>e.kind==='cancelled');
  }finally{db.closeDeferred();}
 }finally{globalThis.fetch=old;}
});
