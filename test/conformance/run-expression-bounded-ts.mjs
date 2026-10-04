import assert from "node:assert/strict";
import path from "node:path";
import { startFixtureServer } from "./fixture-server.mjs";
import { open } from "../../src/index.ts";

const root=path.resolve(new URL("../..",import.meta.url).pathname);
const bridge=await startFixtureServer(path.join(root,"test/fixtures"));
const request=name=>new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${name}`);
const text="x".repeat(1024);
const errorShape=e=>({kind:e.kind,code:e.code,extendedCode:e.extendedCode,message:e.message});
try {
  const db=await open(request("empty"),{limits:{maxWorkUnits:100000,maxResultBytes:1000000}});
  // Current shared SELECT routing: 7 executed ops to ROW (3 Gotos,
  // Variable, Function, Copy, ResultRow) + input4 + hex scan4 + copy8 =23.
  // f1a5b3b had 4 ops /20 units; 48bf18c8 added setup/body routing.
  // vdbe.c counts Goto too. Do not exempt routing or increase connection limits.
  const boundary=db.prepare("SELECT hex(?1)").statement;assert.ok(boundary);
  boundary.bind(1,text);
  let workError;
  try{await boundary.step({maxWorkUnits:22})}catch(e){workError=e}
  assert.deepEqual(errorShape(workError),{kind:"limit",code:null,extendedCode:null,message:"statement exceeds maxWorkUnits"});
  await assert.rejects(()=>boundary.step(),e=>e===workError);
  assert.throws(()=>boundary.reset(),e=>e===workError);
  boundary.bind(1,text);
  assert.equal(await boundary.step({maxWorkUnits:23}),"row");
  assert.equal(boundary.columnType(0),"text");
  assert.equal(boundary.columnText(0),"78".repeat(1024));
  boundary.finalize();

  // Abort is observed at a yielded internal input checkpoint, not only pre-step.
  const abort=new AbortController(),long="z".repeat(256*1024),s=db.prepare("SELECT hex(?1)").statement;assert.ok(s);s.bind(1,long);
  const reason=new Error("injected abort");setTimeout(()=>abort.abort(reason),0);
  let abortError;try{await s.step({signal:abort.signal})}catch(e){abortError=e}
  assert.deepEqual(errorShape(abortError),{kind:"cancelled",code:null,extendedCode:null,message:"statement execution was cancelled"});assert.equal(abortError.cause,reason);
  await assert.rejects(()=>s.step(),e=>e===abortError); // first saved identity
  assert.throws(()=>s.reset(),e=>e===abortError); // reset reports then restores reusability
  s.bind(1,"ok");assert.equal(await s.step(),"row");assert.equal(s.columnText(0),"6F6B");s.finalize();

  // Deterministically injected clock advances at internal checkpoints.
  const realNow=Date.now;let ticks=0;Date.now=()=>ticks++<10?1000:1002;
  const timed=db.prepare("SELECT hex(?1)").statement;assert.ok(timed);timed.bind(1,long);let timeoutError;
  try{await timed.step({timeoutMs:2})}catch(e){timeoutError=e}finally{Date.now=realNow}
  assert.deepEqual(errorShape(timeoutError),{kind:"timeout",code:null,extendedCode:null,message:"statement execution timed out"});
  assert.throws(()=>timed.finalize(),e=>e===timeoutError); // finalized while preserving first identity
  db.close();

  // SQLITE_LIMIT_LENGTH-shaped preflight prevents replace allocation growth.
  const limited=await open(request("empty"),{limits:{maxResultBytes:32,maxWorkUnits:10000}});
  const replace=limited.prepare("SELECT replace(?1,'x','0123456789')").statement;assert.ok(replace);replace.bind(1,"x".repeat(16));let sizeError;
  try{await replace.step()}catch(e){sizeError=e}
  assert.deepEqual(errorShape(sizeError),{kind:"limit",code:null,extendedCode:null,message:"string or blob too big"});
  assert.throws(()=>replace.reset(),e=>e===sizeError);replace.bind(1,"xx");assert.equal(await replace.step(),"row");assert.equal(replace.columnText(0),"01234567890123456789");replace.finalize();limited.close();

  // Column-origin output uses the same limit at the public VDBE path.
  // Pin rowid-table order: these checks intentionally make the first/second
  // fixture rows small/large. Unordered SQL may legally use a covering index,
  // which would test planner order rather than output-size cleanup.
  const columns=await open(request("storage-p4096"),{limits:{maxResultBytes:128,maxWorkUnits:100000}});
  const column=columns.prepare("SELECT hex(t) FROM storage_values NOT INDEXED").statement;assert.ok(column);assert.equal(await column.step(),"row");let columnError;try{await column.step()}catch(e){columnError=e}
  assert.deepEqual(errorShape(columnError),{kind:"limit",code:null,extendedCode:null,message:"string or blob too big"});assert.throws(()=>column.finalize(),e=>e===columnError);columns.close();

  // A real column-fed growing replace preflights identically for every supported
  // on-disk encoding. Finalization reports the saved object, then the connection
  // remains reusable, proving failure cleanup did not poison admission/state.
  for(const fixture of ["storage-p4096","storage-p4096-utf16le","storage-p4096-utf16be"]){
    const encoded=await open(request(fixture),{limits:{maxResultBytes:128,maxWorkUnits:100000}});
    const growing=encoded.prepare("SELECT replace(t,'0','00') FROM storage_values NOT INDEXED").statement;assert.ok(growing);
    assert.equal(await growing.step(),"row");assert.equal(growing.columnText(0),"");
    let growingError;try{await growing.step()}catch(e){growingError=e}
    assert.deepEqual(errorShape(growingError),{kind:"limit",code:null,extendedCode:null,message:"string or blob too big"});
    assert.throws(()=>growing.finalize(),e=>e===growingError);
    const reusable=encoded.prepare("SELECT k FROM storage_values NOT INDEXED").statement;assert.ok(reusable);assert.equal(await reusable.step(),"row");assert.equal(reusable.columnText(0),"min");reusable.finalize();encoded.close();
  }
  console.log(JSON.stringify({schema:"jsqlite-expression-bounded-ts/1",outcome:"pass",checks:["exact-work-22-23-and-reset-reuse","abort-checkpoint-and-reuse","deadline-checkpoint-and-finalize","replace-preflight-and-reuse","column-output-limit","column-replace-all-encodings-and-connection-reuse"]}));
} finally {await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve()));}
