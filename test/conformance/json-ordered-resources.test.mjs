import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {PrivateStateByteBudget,SorterCursor} from '../../src/internal/private-state.ts';
import {open} from '../../src/index.ts';
const generation=JSON.parse(fs.readFileSync(new URL('../fixtures/CURRENT.json',import.meta.url))).generationId;
// Exercise both producer-to-sorter insertion and suspended sorted-drain cleanup.
// Native value/metadata expectations are independently captured in the companion
// ordered integration suite; these controls assert this implementation's limits.
for(const encoding of ['utf8','utf16le','utf16be'])for(const module of ['json_each','json_tree','jsonb_each','jsonb_tree']){
 const bytes=fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/encoding-${encoding}.db`,import.meta.url));
 async function connect(options={}){const old=globalThis.fetch;try{globalThis.fetch=async()=>new Response(bytes);return await open('https://fixture.invalid/ordered-resources',options)}finally{globalThis.fetch=old}}
 const sql=`SELECT DISTINCT t.rowid,j.atom FROM t1 t LEFT JOIN ${module}(?1) j ON 1 ORDER BY j.key DESC,t.rowid LIMIT 5 OFFSET 1`;
 for(const mode of ['work','private','abort','deadline'])test(`ordered resource ${encoding} ${module} producer ${mode}`,async()=>{
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.replace;
  // Four INTEGER children fit as owning input in every encoding, but retained
  // JSON traversal plus the first sorted record exceeds the same 512-byte cap.
  // Eight children provide the negative control: parse expansion fails first.
  const insert=SorterCursor.prototype.insert,reserve=PrivateStateByteBudget.prototype.reserve;
  let insertion,parseAdmission;
  PrivateStateByteBudget.prototype.replace=function(oldBytes,newBytes,...rest){
   budgets.add(this);
   try{return original.call(this,oldBytes,newBytes,...rest)}catch(error){parseAdmission={oldBytes,newBytes,snapshot:this.snapshot()};throw error}
  };
  PrivateStateByteBudget.prototype.reserve=function(bytes,message){
   try{return reserve.call(this,bytes,message)}catch(error){if(message==='sorter exceeds total byte limit')insertion={bytes,snapshot:this.snapshot()};throw error}
  };
  let inserts=0;
  SorterCursor.prototype.insert=async function(...args){inserts++;return insert.apply(this,args)};
  const db=await connect(mode==='private'?{limits:{maxPrivateBytes:512}}:{});let s;
  try{
   const privateSql=sql.replace(' ORDER BY'," WHERE j.key IS NOT NULL ORDER BY");
   s=db.prepare(mode==='private'?privateSql:sql).statement;s.bind(1,mode==='private'?'[0,1,2,3]':JSON.stringify(Array.from({length:256},(_,i)=>i)));
   const controller=new AbortController();controller.abort('ordered producer');
   const options=mode==='work'?{maxWorkUnits:64}:mode==='abort'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:{};
   let first;await assert.rejects(s.step(options),e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit')});
   if(mode==='private'){
    assert.equal(first.message,'sorter exceeds total byte limit');
    assert.equal(parseAdmission,undefined,'parse/traversal admission succeeds');
    assert.equal(inserts,1,'producer reaches first sorter insertion');
    assert.ok(insertion,'rejection is sorter admission, not Variable or prepare');
    const b=insertion.snapshot,mem=encoding==='utf8'?9:18;
    assert.equal(insertion.bytes,32);assert.equal(b.memBytes,mem);
    assert.equal(b.ownedBytes,encoding==='utf8'?484:502);
    assert.equal(b.ownedBytes,b.chargedBytes-b.refundedBytes);
    assert.equal(b.highwaterEntries,1);assert.equal(b.highwaterKeyBytes,16);
    for(const category of ['scratchBytes','recordBytes','payloadScratchBytes','packedPages'])assert.equal(b[category],0,category);
    assert.ok(b.ownedBytes+insertion.bytes>512,'actual producer and sorted row overlap exceeds cap');
   }
   for(const b of budgets)assert.equal(b.usedBytes,0,'error refunds private state');
   await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);
   if(mode!=='private'){s.bind(1,'[]');assert.equal(await s.step(),'done');s.reset();}
   else {
    // Retain the original input as an explicit earlier-admission control.
    inserts=0;insertion=undefined;parseAdmission=undefined;
    s.bind(1,JSON.stringify(Array.from({length:256},(_,i)=>i)));let variableError;
    await assert.rejects(s.step(),e=>{variableError=e;return e.kind==='limit'&&e.message==='private state exceeds total byte limit'});
    assert.equal(inserts,0);assert.equal(parseAdmission,undefined);assert.equal(insertion,undefined);
    assert.throws(()=>s.reset(),e=>e===variableError);
    // Same plan, cap and integer layout: smaller input completes; larger input
    // fails in the producer parser without reaching sorter admission.
    s.bind(1,'[0,1]');assert.equal(await s.step(),'row');assert.equal(s.column(0),1n);assert.equal(s.column(1),0n);
    assert.equal(await s.step(),'done');s.reset();
    inserts=0;insertion=undefined;parseAdmission=undefined;
    s.bind(1,'[0,1,2,3,4,5,6,7]');let parseError;
    await assert.rejects(s.step(),e=>{parseError=e;return e.kind==='limit'&&e.message==='JSON table cursor exceeds private-state byte limit'});
    assert.equal(inserts,0);assert.equal(insertion,undefined);assert.ok(parseAdmission);
    assert.equal(parseAdmission.newBytes-parseAdmission.oldBytes,64);
    assert.equal(parseAdmission.snapshot.memBytes,encoding==='utf8'?17:34);
    assert.ok(parseAdmission.snapshot.ownedBytes-parseAdmission.oldBytes+parseAdmission.newBytes>512);
    await assert.rejects(s.step(),e=>e===parseError);assert.throws(()=>s.reset(),e=>e===parseError);
    for(const b of budgets)assert.equal(b.usedBytes,0,'parser control refunds each owner');
   }
   // Reset must release failed execution. A tiny independent statement checks
   // admission and private ownership even when this connection has a low cap.
   s.finalize();s=undefined;const probe=db.prepare('SELECT 1').statement;try{assert.equal(await probe.step(),'row');assert.equal(probe.column(0),1n)}finally{probe.finalize()}
  }catch(error){try{s?.reset()}catch{}throw error;}finally{try{s?.finalize();}finally{db.close();PrivateStateByteBudget.prototype.replace=original;PrivateStateByteBudget.prototype.reserve=reserve;SorterCursor.prototype.insert=insert;}}
 });
 test(`ordered resource ${encoding} ${module} suspended drain reset/rebind/abort/deadline`,async()=>{
  const budgets=new Set(),original=PrivateStateByteBudget.prototype.reserve;
  PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);return original.apply(this,args)};
  const db=await connect();let s;
  try{
   s=db.prepare(sql).statement;
   // Independently checked with pinned 3.53.4 on these fixture files. Excluding
   // the tree container root makes all four modules produce identical integers.
   const positive=db.prepare(sql.replace(' ORDER BY',' WHERE j.key IS NOT NULL ORDER BY')).statement;
   try{positive.bind(1,'[0,1,2,3]');const rows=[];while(await positive.step()==='row'){
    assert.equal(positive.columnType(0),'integer');assert.equal(positive.columnType(1),'integer');
    rows.push([positive.column(0),positive.column(1)]);
   }assert.deepEqual(rows,[[1n,2n],[1n,1n],[1n,0n]]);}finally{positive.finalize()}
   for(const mode of ['reset','abort','deadline','work']){
    s.bind(1,'[3,2,1,0]');assert.equal(await s.step(),'row');
    if(mode!=='reset'){
     const controller=new AbortController();controller.abort('ordered drain');
     let first;const options=mode==='abort'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:{maxWorkUnits:1};
     await assert.rejects(s.step(options),e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit')});
     assert.throws(()=>s.reset(),e=>e===first);
    }else s.reset();
    for(const b of budgets)assert.equal(b.usedBytes,0,'reset refunds retained sorter');
    s.bind(1,'[]');assert.equal(await s.step(),'done');s.reset();
   }
   // Finalize while sorter output is suspended, then admit another statement.
   s.bind(1,'[3,2,1,0]');assert.equal(await s.step(),'row');s.finalize();s=undefined;
   assert.ok(budgets.size>0,'observed private reservations');for(const b of budgets)assert.equal(b.usedBytes,0,'finalize refunds retained sorter');
   const probe=db.prepare('SELECT 1').statement;try{assert.equal(await probe.step(),'row')}finally{probe.finalize()}
  }finally{s?.finalize();db.close();PrivateStateByteBudget.prototype.reserve=original;}
 });
}
