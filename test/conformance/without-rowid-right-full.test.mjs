import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {open} from '../../src/index.ts';
const capture=JSON.parse(fs.readFileSync(new URL('../../docs/research/recursive-join/wr-right-full-native.json',import.meta.url)));
for(const variant of ['width','mixed'])for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`WR RIGHT/FULL complete PK ${variant} ${encoding}`,async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(variant==='width'?`./fixtures/row-width-wr-duplicate-${encoding}.db`:`./fixtures/wr-right-full-${encoding}.db`,import.meta.url)));
 let db;
 try{
  db=await open('https://fixture.invalid/wr-right');
  for(const c of capture.cases.filter(c=>c.encoding===encoding&&c.variant===variant)){
   const s=db.prepare(c.sql).statement;
   try{
    assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i)),c.metadata,c.sql);
    for(let pass=0;pass<2;pass++){
     const rows=[];
     while(await s.step()==='row')rows.push(Array.from({length:s.columnCount},(_,i)=>{const v=s.column(i);return v===null?{type:'null'}:v instanceof Uint8Array?{type:'blob',value:Buffer.from(v).toString('hex')}:{type:typeof v==='bigint'?'integer':typeof v,value:String(v)};}));
     assert.deepEqual(rows,c.rows,c.sql);s.reset();
    }
   }finally{s.finalize();}
  }
 }finally{db?.closeDeferred();globalThis.fetch=old;}
});

for(const encoding of ['utf-8','utf-16le','utf-16be'])test(`WR tracking/drain failure reset ${encoding}`,async()=>{
 const old=globalThis.fetch;
 globalThis.fetch=async()=>new Response(fs.readFileSync(new URL(`./fixtures/wr-right-full-${encoding}.db`,import.meta.url)));
 try{
  for(const limits of [{maxPrivateEntries:0},{maxPrivateBytes:32}]){
   const db=await open('https://fixture.invalid/wr-budget',{limits});
   try{
    const s=db.prepare('SELECT a.c,b.c FROM r a RIGHT JOIN w b ON a.a=b.a').statement;
    await assert.rejects(s.step(),e=>e.kind==='limit');
    assert.throws(()=>s.finalize(),e=>e.kind==='limit');
    const recovery=db.prepare('SELECT 1').statement;
    assert.equal(await recovery.step(),'row');recovery.finalize();
   }finally{db.closeDeferred();}
  }
  const db=await open('https://fixture.invalid/wr-lifecycle');
  try{
   for(const on of ['a.a=b.a','0']){
    const sql=`SELECT a.c,b.c FROM r a FULL JOIN w b ON ${on}`;
    for(const options of [{maxWorkUnits:0},{timeoutMs:0}]){
     const s=db.prepare(sql).statement;
     await assert.rejects(s.step(options),e=>e.kind==='limit'||e.kind==='timeout');
     assert.throws(()=>s.finalize());
    }
    const s=db.prepare(sql).statement;
    // ON 0 emits unmatched-left rows first; advance to the unmatched RHS drain.
    let drain=false;
    while(await s.step()==='row'){if(s.column(0)===null){drain=true;break;}}
    assert.ok(drain);
    const abort=new AbortController();abort.abort();
    await assert.rejects(s.step({signal:abort.signal}),e=>e.kind==='cancelled');
    assert.throws(()=>s.finalize(),e=>e.kind==='cancelled');
   }
   const s=db.prepare('SELECT a.c,b.c FROM r a RIGHT JOIN w b ON a.a=b.a AND b.c>?1 ORDER BY b.c,a.c').statement;
   try{
    for(const value of [0n,3n,0n]){
     s.bind(1,value);let count=0;while(await s.step()==='row')count++;
     assert.ok(count>=6);s.reset();
    }
   }finally{s.finalize();}
  }finally{db.closeDeferred();}
 }finally{globalThis.fetch=old;}
});
