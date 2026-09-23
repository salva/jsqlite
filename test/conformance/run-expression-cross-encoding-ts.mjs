import assert from "node:assert/strict";
import path from "node:path";
import { startFixtureServer } from "./fixture-server.mjs";
import { openFixture } from "./public-api-adapter.mjs";

const root=path.resolve(new URL("../..",import.meta.url).pathname);
const bridge=await startFixtureServer(path.join(root,"test/fixtures"));
const fixtures=["storage-p4096","storage-p4096-utf16le","storage-p4096-utf16be"];
const encodings=["utf-8","utf-16le","utf-16be"];
const text="A\0😀é";
const results=[];
try {
  for(let i=0;i<fixtures.length;i++){
    const db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${fixtures[i]}`));
    let read,bind;
    try {
      // This encoding check requires the fixture's rowid-table scan order; a
      // covering-index choice is semantically legal for unordered SQL but would
      // turn the assertion into an accidental planner-order test.
      read=db.prepare("SELECT k FROM storage_values NOT INDEXED").statement; assert.ok(read);
      assert.equal(await read.step(),"row"); assert.equal(read.columnText(0),"min"); read.finalize(); read=null;
      bind=db.prepare("SELECT ?1").statement; assert.ok(bind); bind.bind(1,text);
      assert.equal(await bind.step(),"row"); assert.equal(bind.columnType(0),"text"); assert.equal(bind.columnText(0),text);
      assert.equal(Buffer.from(bind.columnBlob(0)).toString("hex"),"4100f09f9880c3a9");
      assert.equal(await bind.step(),"done");
      results.push({fixture:fixtures[i],encoding:encodings[i],outcome:"pass"});
    } finally { try{read?.finalize()}catch{} try{bind?.finalize()}catch{} try{db.closeDeferred()}catch{} }
  }
  console.log(JSON.stringify({schema:"jsqlite-expression-cross-encoding-ts/1",declared:3,passed:3,boundTextUtf8Hex:"4100f09f9880c3a9",results}));
} finally { await new Promise((resolve,reject)=>bridge.server.close(error=>error?reject(error):resolve())); }
