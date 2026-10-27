import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {open} from '../../src/index.ts';
import {PrivateStateByteBudget} from '../../src/internal/private-state.ts';
import {loadSchemaGraph} from '../../src/internal/schema.ts';
import {btreeFromConnection} from '../../src/internal/btree.ts';
import {parseSql} from '../../src/internal/parse.ts';
import {compileTableSelect} from '../../src/internal/vdbe.ts';
const native=JSON.parse(readFileSync(new URL('../../docs/research/retained-filter-native.json',import.meta.url)));
// wherecode.c viaCoroutine: InitCoroutine, Yield(addrBrk); WhereEnd Goto
// returns to that Yield, not a physical Next. This is compileRetainedFilter's
// sourceProducers -> WhereLevel caller, not an aggregate input coroutine.
for(const variant of native.variants)for(const mode of ['abort','deadline','result'])
test(`${variant.encoding}: retained WhereLevel coroutine post-row ${mode} and early stop`,async()=>{
 const previous=globalThis.fetch,reserve=PrivateStateByteBudget.prototype.reserve;
 const budgets=new Set();let peak=0,db,st;
 globalThis.fetch=async()=>new Response(Buffer.from(variant.base64,'base64'));
 PrivateStateByteBudget.prototype.reserve=function(...args){budgets.add(this);const result=reserve.apply(this,args);peak=Math.max(peak,this.usedBytes);return result;};
 const refunded=()=>{assert.ok(peak>0,'real child sorter reservation');for(const budget of budgets)assert.equal(budget.usedBytes,0);};
 const sql="SELECT CASE WHEN d.x=1 THEN 'ok' ELSE ?1 END FROM (SELECT x FROM t ORDER BY x LIMIT ?2)d WHERE d.x>0";
 try{
  db=await open('https://fixture.invalid/retained-level',{limits:{maxResultBytes:8}});
  const program=compileTableSelect(parseSql(sql).statement,loadSchemaGraph(db),btreeFromConnection(db),100);
  const restart=program.ops.find(op=>op.code==='InitCoroutine'&&op.p2===0);
  assert.ok(restart,'WHERE level initializes retained source');
  const yieldAt=program.ops.findIndex(op=>op.code==='Yield'&&op.p1===restart.p1&&op.p2>0);
  assert.ok(yieldAt>=0,'source Yield owns patched EOF break');
  assert.ok(program.ops.some(op=>op.code==='Goto'&&op.p2===yieldAt),'WhereEnd resumes the same source Yield');
  st=db.prepare(sql).statement;st.bind(1,'x'.repeat(100));st.bind(2,5n);
  assert.equal(await st.step(),'row');assert.equal(st.column(0),'ok');
  assert.ok(peak>0,'progress through actual retained producer');
  const controller=new AbortController();controller.abort('after retained row');let primary;
  await assert.rejects(st.step(mode==='abort'?{signal:controller.signal}:mode==='deadline'?{timeoutMs:0}:{}),e=>{primary=e;return e.kind===(mode==='abort'?'cancelled':mode==='deadline'?'timeout':'limit');});
  refunded();await assert.rejects(st.step(),e=>e===primary);
  assert.throws(()=>st.reset(),e=>e===primary);
  st.bind(1,'z');st.bind(2,3n);
  for(let run=0;run<2;run++){
   const rows=[];while(await st.step()==='row')rows.push(st.column(0));
   assert.deepEqual(rows,['ok','z','z'],'reset/rebind rebuilds Yield continuation');refunded();st.reset();
  }
  st.finalize();st=undefined;refunded();
  // Parent LIMIT ends before a second-row throwing projection. LIMIT0 must
  // not enter either source or projection at all.
  for(const limit of [0,1]){
   st=db.prepare(`SELECT CASE WHEN d.x=1 THEN 'ok' ELSE json('malformed') END FROM (SELECT x FROM t ORDER BY x LIMIT 5)d WHERE d.x>0 LIMIT ${limit}`).statement;
   for(let run=0;run<2;run++){
    if(limit){assert.equal(await st.step(),'row');assert.equal(st.column(0),'ok');}
    assert.equal(await st.step(),'done');refunded();st.reset();
   }
   st.finalize();st=undefined;
  }
 }finally{try{st?.finalize();db?.close();}finally{globalThis.fetch=previous;PrivateStateByteBudget.prototype.reserve=reserve;}}
});
