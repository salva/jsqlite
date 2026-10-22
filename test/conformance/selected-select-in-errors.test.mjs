import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import test from 'node:test';
import {openFixture,privateAccounting} from './public-api-adapter.mjs';
import {PrivateBlobkeyPages} from '../../src/internal/private-blobkey-pages.ts';
import {PrivateStateLimitError} from '../../src/internal/private-state.ts';

const directory=process.env.SELECT_IN_NATIVE_DIR,brokenDirectory=process.env.SELECT_IN_CORRUPTION_DIR;
assert.ok(directory&&brokenDirectory,'explicit native fixture inputs required');
const capture=JSON.parse(fs.readFileSync(path.join(directory,'native.json')));
const corrupt=JSON.parse(fs.readFileSync(path.join(brokenDirectory,'native.json')));
assert.equal(capture.sourceId,JSON.parse(fs.readFileSync(new URL('../../reference/sqlite/manifest.json',import.meta.url))).sqliteSourceId);
assert.equal(corrupt.sourceId,capture.sourceId);
const ids=rows=>rows.map(r=>BigInt(r[0].value)).sort((a,b)=>a<b?-1:a>b?1:0);
async function drain(st){const rows=[];while(await st.step()==='row')rows.push(st.column(0));return rows.sort((a,b)=>a<b?-1:a>b?1:0)}
async function failure(st){try{await drain(st)}catch(error){return error}assert.fail('expected execution failure')}
for(const variant of capture.variants)test(`${variant.encoding}: SELECT-IN page errors and final private ledger`,async()=>{
 let bytes=fs.readFileSync(path.join(directory,variant.fixture));
 const server=http.createServer((_q,r)=>r.writeHead(200,{'Content-Length':bytes.length}).end(bytes));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const request=()=>new Request(`http://127.0.0.1:${server.address().port}/fixture`);
 const original=PrivateBlobkeyPages.open;
 const budgets=new Set();let db,st;
 try{
  db=await openFixture(request());
  // Interpose at the actual arena boundary, retaining its aggregate budget;
  // delegate the original page/cursor algorithm, never a synthetic ledger.
  for(const mode of ['construction','movement']){
   let armed=true,injected=false;
   const cause=new PrivateStateLimitError(`test private-page ${mode} admission failure`);
   PrivateBlobkeyPages.open=async function(budget,control,hook,limits){
    budgets.add(budget);
    return original.call(this,budget,control,(event,pgno,data)=>{
     hook?.(event,pgno,data);
     if(armed&&((mode==='construction'&&event==='allocate'&&pgno===2)||
       (mode==='movement'&&event==='acquire'&&privateAccounting(st).indexSeeks>0))){
      assert.ok(budget.usedBytes>0,'failure follows real private ownership');
      injected=true;armed=false;throw cause;
     }
    },limits);
   };
   st=db.prepare('SELECT id FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs)').statement;
   const error=await failure(st);
   assert.ok(injected);assert.equal(error.kind,'limit');assert.equal(error.cause,cause);
   assert.equal(await failure(st),error);
   assert.throws(()=>st.reset(),e=>e===error);
   assert.ok(budgets.size>0);for(const budget of budgets)assert.equal(budget.usedBytes,0,'reset releases failed execution ledger');
   assert.deepEqual(await drain(st),ids(variant.cases.useful.rows));
   assert.ok(privateAccounting(st).indexSeeks>0);assert.ok(privateAccounting(st).inProbes>0);
   st.finalize();st=undefined;
   for(const budget of budgets)assert.equal(budget.usedBytes,0,'finalize releases retry ledger');
   // A second failed execution takes finalize directly, without reset masking
   // the failure or providing the only cleanup path.
   armed=true;injected=false;
   st=db.prepare('SELECT id FROM t INDEXED BY t_ab WHERE a IN(SELECT v FROM rhs)').statement;
   const finalError=await failure(st);assert.ok(injected);assert.equal(finalError.cause,cause);
   assert.throws(()=>st.finalize(),e=>e===finalError);st=undefined;
   for(const budget of budgets)assert.equal(budget.usedBytes,0,'finalize releases failed execution ledger');
   PrivateBlobkeyPages.open=original;
  }
  db.closeDeferred();db=undefined;
  const broken=corrupt.variants.find(v=>v.encoding===variant.encoding);
  bytes=fs.readFileSync(path.join(brokenDirectory,broken.fixture));
  PrivateBlobkeyPages.open=async function(budget,...args){budgets.add(budget);return original.call(this,budget,...args)};
  db=await openFixture(request());
  st=db.prepare(broken.scanSql).statement;
  assert.deepEqual(await drain(st),ids(broken.rows));assert.equal(privateAccounting(st).indexSeeks,0);
  st.finalize();st=db.prepare(broken.selectedSql).statement;
  const error=await failure(st);assert.equal(error.kind,'sqlite');assert.equal(error.code,broken.code);
  assert.equal(await failure(st),error);assert.throws(()=>st.reset(),e=>e===error);
  const retry=await failure(st);assert.equal(retry.code,11);
  assert.throws(()=>st.finalize(),e=>e===retry);st=undefined;
  for(const budget of budgets)assert.equal(budget.usedBytes,0,'corrupt selected execution releases private ledger');
 }finally{
  PrivateBlobkeyPages.open=original;
  try{st?.finalize()}catch{}try{db?.closeDeferred()}catch{}
  await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
 }
});
