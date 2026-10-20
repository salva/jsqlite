import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget,SorterCursor} from '../../src/internal/private-state.ts';
import {TableScanCursor} from '../../src/internal/btree.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/join-retained-compound-native.json',import.meta.url)));
const linkedNative=JSON.parse(readFileSync(new URL('../../docs/research/join-retained-compound-contracts-native.json',import.meta.url)));
for(let index=0;index<native.encodings.length;index++)test(`${native.encodings[index].encoding}: pinned linked-consumer error phase and typed rows`,async()=>{
 const v=native.encodings[index],oracle=linkedNative.encodings[index];assert.equal(oracle.fixtureSha256,v.sha256);assert.equal(linkedNative.sourceId,native.sourceId);
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(v.base64,'base64'));let db;
 try{db=await open('https://fixture.invalid/linked-native');for(const item of oracle.cases){
  if(item.prepare!==0){assert.throws(()=>db.prepare(item.sql),e=>e.kind==='sqlite'&&e.message===item.error);continue;}
  const s=db.prepare(item.sql).statement;try{for(const run of item.runs){
   if(run.end!==101){let error;await assert.rejects(s.step(),e=>(error=e,e.kind==='sqlite'&&e.message===run.error));assert.throws(()=>s.reset(),e=>e===error);}
   else{const actual=await rows(s);assert.deepEqual(actual,run.rows.map(row=>row.map(c=>{assert.equal(c.type,'integer');return BigInt(c.value);})),item.sql);s.reset();}
  }}finally{s.finalize();}
 }}finally{db?.closeDeferred();globalThis.fetch=previous;}
});
const arm='SELECT t.x,u.x FROM t JOIN u ON t.x=u.x';
const joined=arm+' UNION '+arm+' ORDER BY 2,1';
test('retained child ORDER LIMIT barrier survives parent predicates and reset',async()=>fixture({},async db=>{
 // Child keeps x=3 before the parent excludes it: x=2 must never leak through.
 const leaf='SELECT d.x,u.x FROM (SELECT x FROM t ORDER BY x DESC LIMIT 1) d JOIN u ON d.x=u.x WHERE d.x<3';
 const s=db.prepare(leaf+' UNION ALL '+leaf).statement;try{for(let i=0;i<2;i++){assert.deepEqual(await rows(s),[]);s.reset();}}finally{s.finalize();}
}));
test('retained joined installed merge keeps live keys and refunds deferred-close cursors',async()=>fixture({},async db=>{
 const leaf='SELECT d.x,u.x FROM (SELECT x FROM t ORDER BY x DESC LIMIT 2) d JOIN u ON d.x=u.x';
 const sql=leaf+' UNION '+arm+' ORDER BY 2,1';
 const reserve=PrivateStateByteBudget.prototype.reserve,budgets=new Set();
 PrivateStateByteBudget.prototype.reserve=function(...args){const value=reserve.apply(this,args);budgets.add(this);return value;};
 let s;
 try{
  s=db.prepare(sql).statement;
  for(let i=0;i<2;i++){assert.equal(await s.step(),'row');assert.deepEqual([s.column(0),s.column(1)],[2n,2n]);assert.ok([...budgets].some(b=>b.usedBytes>0));s.reset();for(const b of budgets)assert.equal(b.usedBytes,0);}
  assert.deepEqual(await rows(s),[[2n,2n],[3n,3n]]);s.reset();
  assert.equal(await s.step(),'row');db.closeDeferred();s.finalize();s=undefined;for(const b of budgets)assert.equal(b.usedBytes,0);
 }finally{try{s?.finalize()}catch{}PrivateStateByteBudget.prototype.reserve=reserve;}
}));
test('linked joined invocation counts distinguish Once, correlated replay and reset',async()=>fixture({},async db=>{
 const first=TableScanCursor.prototype.first;let starts=0;
 TableScanCursor.prototype.first=function(){starts++;return first.call(this);};
 try{for(const [sql,expected,count] of [
  [`SELECT EXISTS(${arm} UNION ALL ${arm}) FROM t a`,[[1n],[1n],[1n]],4],
  [`SELECT (2,2) IN (${arm} UNION ALL ${arm}) FROM t a`,[[1n],[1n],[1n]],9],
  ['SELECT EXISTS(SELECT t.x,u.x FROM t JOIN u ON t.x=u.x WHERE t.x=a.x UNION ALL SELECT t.x,u.x FROM t JOIN u ON t.x=u.x WHERE t.x=a.x) FROM t a',[[0n],[1n],[1n]],16],
 ]){const s=db.prepare(sql).statement;try{for(let i=0;i<2;i++){starts=0;assert.deepEqual(await rows(s),expected);assert.equal(starts,count,sql);s.reset();}}finally{s.finalize();}}}finally{TableScanCursor.prototype.first=first;}
}));
test('actual joined sorter reservation rollback and cleanup refund owned bytes',async()=>fixture({},async db=>{
 const reserve=PrivateStateByteBudget.prototype.reserve,release=PrivateStateByteBudget.prototype.release,insert=SorterCursor.prototype.insert;
 const budgets=new Set();let peak=0,injected=false;
 PrivateStateByteBudget.prototype.reserve=function(...args){const value=reserve.apply(this,args);budgets.add(this);peak=Math.max(peak,this.usedBytes);return value;};
 PrivateStateByteBudget.prototype.release=function(...args){return release.apply(this,args);};
 const stop=new Error('post-growth probe');
 SorterCursor.prototype.insert=async function(key,payload,control){let zero=0;return insert.call(this,key,payload,{checkpoint:async units=>{await control.checkpoint(units);if(units===0&&++zero===2&&!injected){injected=true;throw stop;}}});};
 let s;
 try{
  s=db.prepare(joined).statement;await assert.rejects(s.step());assert.equal(injected,true);assert.equal(peak,32);assert.ok(budgets.size>0);for(const b of budgets)assert.equal(b.usedBytes,0);
  assert.throws(()=>s.reset());s.finalize();s=undefined;
  SorterCursor.prototype.insert=insert;peak=0;
  s=db.prepare(joined).statement;assert.deepEqual(await rows(s),[[2n,2n],[3n,3n]]);assert.equal(peak,128);s.reset();for(const b of budgets)assert.equal(b.usedBytes,0);
 }finally{try{s?.finalize()}catch{}SorterCursor.prototype.insert=insert;PrivateStateByteBudget.prototype.reserve=reserve;PrivateStateByteBudget.prototype.release=release;}
}));
async function fixture(limits,body){const prior=globalThis.fetch;globalThis.fetch=async()=>new Response(Buffer.from(native.encodings[0].base64,'base64'));let db;try{db=await open('https://fixture.invalid/joined-contracts',{limits});await body(db);}finally{try{db?.closeDeferred();}catch(e){assert.equal(e.kind,'misuse');assert.equal(e.message,'connection is closed');}globalThis.fetch=prior;}}
async function rows(s){const result=[];while(await s.step()==='row')result.push(Array.from({length:s.columnCount},(_,i)=>s.column(i)));return result;}
test('joined full-key merge exact entry/key/shared-byte thresholds and reset refund',async()=>{
 for(const [limits,pass] of [
  [{maxPrivateEntries:2,maxPrivateKeyBytes:16,maxPrivateBytes:128},true],
  [{maxPrivateEntries:1,maxPrivateKeyBytes:16,maxPrivateBytes:128},false],
  [{maxPrivateEntries:2,maxPrivateKeyBytes:15,maxPrivateBytes:128},false],
  [{maxPrivateEntries:2,maxPrivateKeyBytes:16,maxPrivateBytes:127},false],
 ])await fixture(limits,async db=>{const s=db.prepare(joined).statement;try{for(let i=0;i<2;i++){if(pass){assert.deepEqual(await rows(s),[[2n,2n],[3n,3n]]);s.reset();}else{let first;await assert.rejects(s.step(),e=>(first=e,e.kind==='limit'));await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);}}}finally{s.finalize();}const recovery=db.prepare('SELECT 1').statement;assert.deepEqual(await rows(recovery),[[1n]]);recovery.finalize();});
});
test('linked joined arity validates atomically; vector IN and Exists retain destination semantics',async()=>fixture({},async db=>{
 for(const sql of [`SELECT (${arm} UNION ALL ${arm})`,`SELECT 2 IN (${arm} UNION ALL ${arm})`])assert.throws(()=>db.prepare(sql),e=>e.kind==='sqlite'&&e.message==='sub-select returns 2 columns - expected 1');
 for(const [sql,expected] of [[`SELECT (2,2) IN (${arm} UNION ALL ${arm})`,[[1n]]],[`SELECT EXISTS(${arm} UNION ALL ${arm})`,[[1n]]],[`SELECT EXISTS(${arm} UNION ALL ${arm} LIMIT 0)`,[[0n]]]]){const s=db.prepare(sql).statement;try{for(let i=0;i<2;i++){assert.deepEqual(await rows(s),expected);s.reset();}}finally{s.finalize();}}
}));
test('joined throwing projections: prepare errors precede execution; step error is saved and reset',async()=>fixture({},async db=>{
 const throwing="SELECT abs(-9223372036854775808),u.x FROM t JOIN u ON t.x=u.x";
 assert.throws(()=>db.prepare(throwing+' UNION SELECT missing,u.x FROM t JOIN u ON t.x=u.x'),e=>e.kind==='sqlite'&&/no such column/.test(e.message));
 const s=db.prepare(throwing+' UNION ALL '+arm).statement;
 try{for(let i=0;i<2;i++){let first;await assert.rejects(s.step(),e=>(first=e,e.kind==='sqlite'&&/integer overflow/.test(e.message)));await assert.rejects(s.step(),e=>e===first);assert.throws(()=>s.reset(),e=>e===first);}}finally{s.finalize();}
 const good=db.prepare(joined).statement;assert.deepEqual(await rows(good),[[2n,2n],[3n,3n]]);good.finalize();
}));
