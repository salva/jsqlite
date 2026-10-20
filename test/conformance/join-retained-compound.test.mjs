import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {open} from '../../src/index.ts';
import {suspendExecutionTask} from './suspend-execution-task.mjs';
import {SorterCursor} from '../../src/internal/private-state.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/join-retained-compound-native.json',import.meta.url)));
const manifest=JSON.parse(readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url)));
assert.equal(native.sourceId,manifest.sqliteSourceId);
for(const variant of native.encodings)test(`${variant.encoding}: joined and retained compound projected destinations`,async()=>{
 const bytes=Buffer.from(variant.base64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),variant.sha256);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(bytes);let db,st;
 try{
  db=await open('https://fixture.invalid/joined-compound');
  for(const item of variant.cases){
   st=db.prepare(item.sql).statement;
   assert.deepEqual(Array.from({length:st.columnCount},(_,i)=>st.columnMetadata(i)),item.metadata,item.sql);
   for(const run of item.runs){
    if(run.binding)run.binding.forEach((value,index)=>st.bind(index+1,BigInt(value)));
    const rows=[];
    while(await st.step()==='row')rows.push(Array.from({length:st.columnCount},(_,i)=>{const type=st.columnType(i),value=st.column(i);return type==='null'?{type}:type==='real'?{type,ieee754be:(()=>{const b=Buffer.alloc(8);b.writeDoubleBE(value);return b.toString('hex');})()}:type==='text'?{type,utf8Hex:Buffer.from(value).toString('hex')}:type==='blob'?{type,hex:Buffer.from(value).toString('hex')}:{type,value:value===null?null:String(value)};}));
    assert.equal(run.end,101);assert.deepEqual(rows,run.rows,item.sql);st.reset();
   }
   st.finalize();st=undefined;
  }
 }finally{st?.finalize();db?.close();globalThis.fetch=previous;}
});
test('joined compound active cancellation retains admission until cleanup',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async()=>new Response(Buffer.from(native.encodings[0].base64,'base64'));
 let db,st;const gate=suspendExecutionTask();
 try{
  db=await open('https://fixture.invalid/joined-active');
  const arm='SELECT t.x,u.x FROM t JOIN u ON u.x>0';
  st=db.prepare(Array.from({length:20},()=>arm).join(' UNION ALL ')).statement;
  const abort=new AbortController();
  const pending=(async()=>{while(await st.step({signal:abort.signal})==='row'){} })();
  await gate.suspended;
  assert.throws(()=>db.prepare('SELECT 1'),e=>e.kind==='misuse');
  await assert.rejects(st.step(),e=>e.kind==='misuse');
  abort.abort('joined-active-stop');gate.release();
  await assert.rejects(pending,e=>e.kind==='cancelled'&&e.cause==='joined-active-stop');
  assert.throws(()=>st.reset(),e=>e.kind==='cancelled');gate.restore();
  let count=0;while(await st.step()==='row')count++;
  assert.equal(count,180);st.finalize();st=undefined;
  const recovery=db.prepare('SELECT 1').statement;
  assert.equal(await recovery.step(),'row');recovery.finalize();
 }finally{gate.restore();gate.release();try{st?.finalize()}catch{}db?.closeDeferred();globalThis.fetch=previous;}
});
test('joined merge active deadline saves first error and releases admission',async()=>{
 const previous=globalThis.fetch,insert=SorterCursor.prototype.insert,now=Date.now;
 let active=false,db,st,first;
 globalThis.fetch=async()=>new Response(Buffer.from(native.encodings[0].base64,'base64'));
 SorterCursor.prototype.insert=async function(key,payload,control){active=true;await control.checkpoint(1);return insert.call(this,key,payload,control);};
 Date.now=()=>active?100:0;
 try{
  db=await open('https://fixture.invalid/joined-deadline');
  st=db.prepare('SELECT t.x,u.x FROM t JOIN u ON t.x=u.x UNION SELECT u.x,t.x FROM u JOIN t ON u.x=t.x ORDER BY 2,1').statement;
  await assert.rejects(st.step({timeoutMs:2}),e=>{first=e;return e.kind==='timeout';});
  assert.equal(active,true);assert.throws(()=>st.reset(),e=>e===first);
  st.finalize();st=undefined;
  Date.now=now;SorterCursor.prototype.insert=insert;
  const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');recovery.finalize();
 }finally{Date.now=now;SorterCursor.prototype.insert=insert;try{st?.finalize()}catch{}db?.closeDeferred();globalThis.fetch=previous;}
});
for(const mode of ['entries','bytes','work','abort','deadline'])test(`joined compound ${mode} first error and recovery`,async()=>{
 const variant=native.encodings[0],previous=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(variant.base64,'base64'));let db,st;
 try{
  const limits=mode==='entries'?{maxPrivateEntries:1}:mode==='bytes'?{maxPrivateBytes:1}:{};
  db=await open('https://fixture.invalid/joined-resource',{limits});
  st=db.prepare('SELECT t.x,u.x FROM t JOIN u ON t.x=u.x UNION SELECT u.x,t.x FROM u JOIN t ON u.x=t.x ORDER BY 2,1').statement;
  const abort=new AbortController();abort.abort('joined-stop');let first;
  const options=mode==='work'?{maxWorkUnits:1}:mode==='abort'?{signal:abort.signal}:mode==='deadline'?{timeoutMs:0}:{};
  await assert.rejects(st.step(options),e=>{first=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit');});
  assert.throws(()=>st.reset(),e=>e===first);st.finalize();st=undefined;
  const recovery=db.prepare('SELECT 1').statement;assert.equal(await recovery.step(),'row');recovery.finalize();
 }finally{st?.finalize();db?.close();globalThis.fetch=previous;}
});
