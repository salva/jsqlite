import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {closeTestServer} from './close-test-server.mjs';

// Pinned STAT4 native: rare 99/98 SEARCH ab + sorter; hot 0 SCAN t.
// Same handle bind/step/reset/rebind must replace the program, not only rows.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: parameter-sensitive STAT4 reprepare selects hot/rare access`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../docs/research/card-s-h/${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  st=db.prepare('SELECT id,r,b FROM t WHERE a=? ORDER BY id').statement;
  for(const value of [99n,0n,98n]){
   st.bind(1,value);let rows=0;
   while(await st.step()==='row'){assert.equal(st.columnType(0),'integer');rows++;}
   assert.equal(rows,value===0n?900:1);
   const actual=privateAccounting(st);
   if(value===0n){assert.equal(actual.indexSeeks,0,'hot parameter must reprepare to SCAN t');assert.ok(actual.tableNext>0);}
   else{assert.ok(actual.indexSeeks>0,'rare parameter must reprepare to SEARCH ab');assert.ok(actual.sorterRows>0);}
   st.reset();
  }
 }finally{try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}}
});

const native=JSON.parse(fs.readFileSync(new URL('../../docs/research/card-h-b-reprepare/native.json',import.meta.url)));
function bound(value){return typeof value==='number'&&Number.isInteger(value)?BigInt(value):value?.type==='blob'?Uint8Array.from(Buffer.from(value.hex,'hex')):value;}
async function typedRows(st){const rows=[];while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{
 const type=st.columnType(i),value=st.column(i);
 if(type==='null')return {type};if(type==='integer')return {type,value:String(value)};
 if(type==='real'){const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return {type,ieee754be:bytes.toString('hex')};}
 return type==='blob'?{type,hex:Buffer.from(value).toString('hex')}:{type,utf8Hex:Buffer.from(value).toString('hex')};
}));return rows;}
for(const variant of native.variants)test(`${variant.encoding}: native typed/collation bindings and clear on same handle`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../${variant.fixture}`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  for(const c of variant.cases){
   st=db.prepare(c.sql).statement;const metadata=Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i));
   for(const run of c.runs){
    // Native JSON distinguishes 99.0 via source capture, this occurrence is REAL.
    const value=c.runs.indexOf(run)===3?99:bound(run.binding);
    st.bind(1,value);assert.deepEqual(await typedRows(st),run.rows);
    assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),metadata);
    const a=privateAccounting(st);
    if(run.eqp.some(p=>p==='SCAN t'))assert.equal(a.indexSeeks,0);
    if(run.rows.length&&run.eqp.some(p=>p.includes('USING INDEX')))assert.ok(a.indexSeeks>0);
    st.reset();
   }
   st.clearBindings();assert.deepEqual(await typedRows(st),[]);st.finalize();st=undefined;
  }
  for(const c of variant.masks){
   st=db.prepare(c.sql).statement;
   for(const run of c.runs){st.bind(run.slot,BigInt(run.value));await typedRows(st);const a=privateAccounting(st);
    if(run.slot!==34&&run.value===0)assert.equal(a.indexSeeks,0,'hot high-slot binding must SCAN');
    if(run.slot!==34&&run.value===99)assert.ok(a.indexSeeks>0,'rare high-slot binding must SEARCH');
    st.reset();
   }
   st.finalize();st=undefined;
  }
 }finally{try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}}
});

import {parseSql} from '../../src/internal/parse.ts';
import {compileScalarSelect,VdbeStatement} from '../../src/internal/vdbe.ts';
import {ReprepareContext} from '../../src/internal/reprepare.ts';
import {memFromPublic,memToPublicInitial} from '../../src/internal/mem.ts';
import {stat4ValueFromExpr} from '../../src/internal/stat4-probe.ts';
import {JSQLiteError} from '../../src/index.ts';
test('source bit31 mask, saved typed binding copies, expiration and failed replacement are atomic',async()=>{
 for(const slot of [1,31,32,33]){
  const parsed=parseSql(`SELECT ?34,?${slot}`).statement;
  const context=new ReprepareContext(parsed);
  const expression=parsed.result[1].reduction;
  assert.equal(stat4ValueFromExpr(expression,'blob','utf-8',()=>{},()=>{},context),null);
  assert.equal(context.mask,slot>=32?0x80000000:2**(slot-1));
  const base=compileScalarSelect(parsed,'utf-8',1000);
  let calls=0,fail=false;
  const primary=new JSQLiteError('limit','replacement construction failure');
  const st=new VdbeStatement({...base,expmask:context.mask},()=>{},()=>()=>{},()=>{},(bindings)=>{
   calls++;if(fail)throw primary;
   const copyContext=new ReprepareContext(parsed,bindings);
   const value=stat4ValueFromExpr(expression,'numeric','utf-8',()=>{},()=>{},copyContext);
   assert.ok(value);value.release();
   return {...base,expmask:context.mask};
  });
  try{
   st.bind(slot,'99');assert.equal(await st.step(),'row');assert.equal(st.column(1),'99');assert.equal(calls,1);st.reset();
   st.bind(34,8n);assert.equal(await st.step(),'row');assert.equal(calls,slot>=32?2:1);st.reset();
   st.clearBindings();assert.equal(await st.step(),'row');assert.equal(st.column(1),null);const afterClear=calls;st.reset();
   st.bind(slot,'retained');fail=true;
   await assert.rejects(st.step(),e=>e===primary);assert.throws(()=>st.column(1),e=>e.kind==='misuse');
   assert.throws(()=>st.reset(),e=>e===primary);fail=false;
   assert.equal(await st.step(),'row');assert.equal(st.column(1),'retained');assert.equal(calls,afterClear+2);
  }finally{st.finalize();}
 }
 const source=memFromPublic('99','utf-16le'),bindings=[source];
 try{const parsed=parseSql('SELECT ?1').statement,context=new ReprepareContext(parsed,bindings);
  const copy=stat4ValueFromExpr(parsed.result[0].reduction,'numeric','utf-16le',()=>{},()=>{},context);
  try{assert.equal(memToPublicInitial(copy),99n);assert.equal(memToPublicInitial(source),'99');}finally{copy.release();}
 }finally{source.release();}
});

test('zero mask never recompiles projection parameters; failed compile retains finalization error',async()=>{
 const parsed=parseSql('SELECT ?').statement,base=compileScalarSelect(parsed,'utf-8',1000);
 let calls=0;const st=new VdbeStatement(base,()=>{},()=>()=>{},()=>{},()=>{calls++;throw new Error('unexpected compile');});
 try{for(const value of [1n,99,'text',null,Uint8Array.of(1)]){st.bind(1,value);assert.equal(await st.step(),'row');assert.deepEqual(st.column(0),value);st.reset();}st.clearBindings();assert.equal(await st.step(),'row');assert.equal(calls,0);}finally{st.finalize();}
 const primary=new JSQLiteError('sqlite','compiler error',{code:1});let finalized=0;
 const failing=new VdbeStatement({...base,expmask:1},()=>{},()=>()=>{},()=>{finalized++;},()=>{throw primary});
 failing.bind(1,9n);await assert.rejects(failing.step(),e=>e===primary);assert.throws(()=>failing.finalize(),e=>e===primary);assert.equal(finalized,1);
});

// prepare.c sqlite3Reprepare transfers bindings into the original handle;
// vdbeapi reset reports the saved error after cleanup. Exercise the public
// saved-SQL closure, not a stubbed compiler, including zombie connection use.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: public failed reprepare retains handle, tail and bindings through deferred close`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../docs/research/card-s-h/${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  const prefix='SELECT id,r,b FROM t WHERE a=:value ORDER BY id;';
  const prepared=db.prepare(prefix+' SELECT 77;');st=prepared.statement;
  assert.equal(prepared.tail,' SELECT 77;');assert.equal(prepared.tailOffset,new TextEncoder().encode(prefix).length);
  const metadata=Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i));
  assert.equal(st.parameterCount,1);assert.equal(st.parameterIndex(':value'),1);assert.equal(st.parameterName(1),':value');
  st.bind(':value',99n);const rare=await typedRows(st);assert.equal(rare.length,1);assert.ok(privateAccounting(st).indexSeeks>0);st.reset();
  st.bind(':value',0n);let primary;
  // A zero budget fails at the replacement construction checkpoint, before
  // dispatch. Later calls must preserve the first error, not recompile again.
  await assert.rejects(st.step({maxWorkUnits:0}),e=>{primary=e;return e.kind==='limit'});
  assert.throws(()=>st.column(0),e=>e.kind==='misuse');await assert.rejects(st.step(),e=>e===primary);
  // Admission has been released while the failed statement is still alive.
  const sibling=db.prepare('SELECT 7').statement;
  try{assert.equal(await sibling.step(),'row');assert.equal(sibling.column(0),7n)}finally{sibling.finalize()}
  assert.throws(()=>st.reset(),e=>e===primary);
  db.closeDeferred();assert.throws(()=>db.prepare('SELECT 8'),e=>e.kind==='misuse');
  const hot=await typedRows(st);assert.equal(hot.length,900);assert.equal(privateAccounting(st).indexSeeks,0);
  assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),metadata);
  assert.equal(st.parameterIndex(':value'),1);assert.equal(prepared.tail,' SELECT 77;');
  st.reset();st.bind(':value',99n);assert.deepEqual(await typedRows(st),rare);assert.ok(privateAccounting(st).indexSeeks>0);
  st.reset();st.clearBindings();assert.deepEqual(await typedRows(st),[]);
  st.finalize();assert.throws(()=>st.bind(1,0n),e=>e.kind==='misuse');st=undefined;db=undefined;
 }finally{try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}}
});

import {BtreeDatabase} from '../../src/internal/btree.ts';
// Observe/inject at the production schema-envelope seam only. Parsing, planner
// candidate/OR-arm construction and the saved-SQL compiler remain real.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: public STAT4 OR reprepare unwinds every observed reservation failure and retains bindings`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../docs/research/card-s-h/${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,st;
 const original=BtreeDatabase.prototype.reserveSchemaTemporary;
 let armed=false,calls=0,failAt=Infinity,live=0,peak=0;
 let primary;
 BtreeDatabase.prototype.reserveSchemaTemporary=function(size){
  if(!armed)return original.call(this,size);
  if(++calls===failAt){
   // Force the real connection-owned allowance check, not a synthetic error.
   try{original.call(this,Number.MAX_SAFE_INTEGER)}catch(error){primary=error;throw error}
   assert.fail('oversized reservation must reject');
  }
  const release=original.call(this,size);live+=size;peak=Math.max(peak,live);let active=true;
  return ()=>{assert.equal(active,true,'reservation released exactly once');active=false;live-=size;release()};
 };
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  armed=true;failAt=1;let initialError;
  assert.throws(()=>db.prepare('SELECT id FROM t WHERE a=:left OR a=:right'),e=>{initialError=e;return e.kind==='limit'&&e.cause===primary});
  armed=false;assert.equal(live,0);assert.ok(initialError);calls=0;failAt=Infinity;
  st=db.prepare('SELECT id FROM t WHERE a=:left OR a=:right').statement;
  st.bind(':left',99n);st.bind(':right',98n);
  armed=true;const expected=await typedRows(st);armed=false;
  assert.equal(expected.length,2);assert.equal(live,0);assert.ok(peak>0);const frontiers=calls;assert.ok(frontiers>0);
  st.reset();
  for(let frontier=1;frontier<=frontiers;frontier++){
   // Both same-value binds expire the consulted sample slots again.
   st.bind(':left',99n);st.bind(':right',98n);calls=0;failAt=frontier;armed=true;let saved;
   await assert.rejects(st.step(),e=>{saved=e;return e.kind==='limit'&&e.cause===primary});
   armed=false;assert.equal(calls,frontier);assert.equal(live,0,'failed whole compiler must release all probe reservations');
   await assert.rejects(st.step(),e=>e===saved);assert.throws(()=>st.reset(),e=>e===saved);
   // A sibling must execute after failed reconstruction: no admission leak.
   const sibling=db.prepare('SELECT :value').statement;
   try{sibling.bind(':value',123n);assert.deepEqual(await typedRows(sibling),[[{type:'integer',value:'123'}]])}finally{sibling.finalize()}
   assert.equal(st.parameterCount,2);assert.equal(st.parameterIndex(':right'),2);
   failAt=Infinity;calls=0;armed=true;assert.deepEqual(await typedRows(st),expected);armed=false;
   assert.equal(live,0);assert.ok(calls>0);st.reset();
  }
  // Finalize directly from failed reconstruction, without reset swallowing
  // the saved error. Destruction must precede rethrow; reuse is misuse.
  st.bind(':left',99n);calls=0;failAt=1;armed=true;let finalError;
  await assert.rejects(st.step(),e=>{finalError=e;return e.kind==='limit'&&e.cause===primary});
  armed=false;assert.equal(live,0);
  assert.throws(()=>st.finalize(),e=>e===finalError);
  assert.throws(()=>st.bind(':left',99n),e=>e.kind==='misuse');
  assert.throws(()=>st.columnType(0),e=>e.kind==='misuse');
  assert.throws(()=>st.finalize(),e=>e.kind==='misuse');st=undefined;
  const survivor=db.prepare('SELECT 7').statement;
  try{assert.deepEqual(await typedRows(survivor),[[{type:'integer',value:'7'}]])}finally{survivor.finalize()}
  console.log(`public OR reprepare observed reservation frontiers=${frontiers}, logical peak=${peak}`);
 }finally{armed=false;BtreeDatabase.prototype.reserveSchemaTemporary=original;try{try{st?.finalize()}catch(error){if(error!==primary)throw error}}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}}
});

// prepare.c swap/transfer/reset owns the same handle. Exercise installation
// after a partially consumed old cursor/sorter, not only after old DONE.
for(const encoding of ['UTF-8','UTF-16le','UTF-16be'])test(`${encoding}: replacement after partial ROW restarts cursor/sorter and clears stale result state`,async()=>{
 const bytes=fs.readFileSync(new URL(`../../docs/research/card-s-h/${encoding}.db`,import.meta.url));
 const server=http.createServer((_q,r)=>{r.writeHead(200,{'Content-Length':bytes.length});r.end(bytes)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let db,st;
 try{
  db=await openFixture(new Request(`http://127.0.0.1:${server.address().port}/fixture`));
  st=db.prepare('SELECT id,id,r,b FROM t WHERE a=:value ORDER BY id').statement;
  const metadata=[st.columnMetadata(0),st.columnMetadata(1)];
  for(const value of [0n,99n,0n,98n]){
   st.bind(':value',value);assert.equal(await st.step(),'row');
   const first=st.columnInteger(0);assert.equal(st.columnInteger(1),first);
   assert.deepEqual([st.columnMetadata(0),st.columnMetadata(1)],metadata);
   st.reset();assert.throws(()=>st.columnType(0),e=>e.kind==='misuse');
   // Recompile again on the same value while the prior program never hit DONE.
   st.bind(':value',value);const rows=await typedRows(st);
   assert.equal(rows.length,value===0n?900:1);
   assert.equal(rows[0][0].value,String(first));
   for(let i=0;i<rows.length;i++){
    assert.deepEqual(rows[i][0],rows[i][1]);
    if(i)assert.ok(BigInt(rows[i-1][0].value)<BigInt(rows[i][0].value));
   }
   const accounting=privateAccounting(st);
   if(value===0n){assert.equal(accounting.indexSeeks,0);assert.ok(accounting.tableNext>0)}
   else{assert.ok(accounting.indexSeeks>0);assert.ok(accounting.sorterRows>0)}
   assert.equal(await st.step(),'done');assert.throws(()=>st.columnType(0),e=>e.kind==='misuse');st.reset();
  }
  st.clearBindings();assert.equal(await st.step(),'done');st.reset();
  st.bind(':value',99n);assert.equal((await typedRows(st)).length,1);
 }finally{try{st?.finalize()}finally{try{db?.closeDeferred()}finally{await closeTestServer(server)}}}
});
