import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { JSQLiteError, open } from "../../src/index.ts";
import { parseSql } from "../../src/internal/parse.ts";
import { compileScalarSelect, VdbeStatement } from "../../src/internal/vdbe.ts";

const generation = JSON.parse(fs.readFileSync(new URL("../fixtures/CURRENT.json", import.meta.url))).generationId;
const fixture = name => fs.readFileSync(new URL(`../fixtures/generations/${generation}/generated/${name}.db`, import.meta.url));

async function openBytes(name, options = {}) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(fixture(name));
  try { return await open(`https://fixture.invalid/${name}`, options); }
  finally { globalThis.fetch = original; }
}

function isError(kind) { return error => error instanceof JSQLiteError && error.kind === kind; }

test("compiled scalar program preserves ordered columns, parameters, values and tails", async () => {
  const db = await openBytes("empty");
  assert.deepEqual(db.prepare(" -- only a comment\n"), { statement: null, tailOffset: 19, tail: "" });
  const prepared = db.prepare("SELECT -10 AS x,+10 AS x,~10,NOT 10,?5,:named,?5,:named,?; SELECT 22");
  const s = prepared.statement;
  assert.ok(s);
  assert.equal(prepared.tail, " SELECT 22");
  assert.equal(new TextEncoder().encode("SELECT -10 AS x,+10 AS x,~10,NOT 10,?5,:named,?5,:named,?;").byteLength, prepared.tailOffset);
  assert.equal(s.parameterCount, 7);
  assert.deepEqual(Array.from({length: 7}, (_, i) => s.parameterName(i + 1)), [null,null,null,null,"?5",":named",null]);
  assert.equal(s.parameterIndex(":named"), 6);
  const blob = Uint8Array.of(0,255,128);
  s.bind(5, -(1n << 63n)); s.bind(":named", Infinity); s.bind(7, blob); blob[0] = 9;
  assert.equal(await s.step(), "row");
  assert.deepEqual(Array.from({length:s.columnCount},(_,i)=>s.columnType(i)), ["integer","integer","integer","integer","integer","real","integer","real","blob"]);
  assert.deepEqual([s.columnInteger(0),s.columnInteger(1),s.columnInteger(2),s.columnInteger(3)],[-10n,10n,-11n,0n]);
  assert.deepEqual(s.columnBlob(8), Uint8Array.of(0,255,128));
  assert.equal(await s.step(), "done");
  assert.throws(() => s.column(0), isError("misuse"));
  s.reset(); assert.equal(await s.step(), "row"); assert.equal(s.columnInteger(4), -(1n << 63n));
  s.reset(); s.clearBindings(); assert.equal(await s.step(), "row"); assert.equal(s.columnType(4), "null");
  s.finalize(); db.close();
});

test("table scan uses shared record Mem and publishes fresh exact metadata", async () => {
  for (const name of ["storage-p4096", "storage-p4096-utf16le", "storage-p4096-utf16be"]) {
    const db=await openBytes(name); const s=db.prepare("SELECT k,i,k FROM storage_values WHERE i=-9223372036854775808").statement;
    assert.ok(s); assert.equal(await s.step(), "row");
    assert.deepEqual([s.column(0),s.column(1),s.column(2)],["min",-(1n<<63n),"min"]);
    assert.deepEqual([s.columnType(0),s.columnType(1),s.columnType(2)],["text","integer","text"]);
    const m1=s.columnMetadata(0),m2=s.columnMetadata(0);
    assert.deepEqual(m1,{name:"k",declaredType:"TEXT",database:"main",table:"storage_values",origin:"k"});
    assert.notEqual(m1,m2); assert.ok(Object.isFrozen(m1));
    assert.equal(await s.step(),"done"); s.finalize(); db.close();
  }
  const affinityDb=await openBytes("meta");
  const affinity=affinityDb.prepare("SELECT a FROM t1 WHERE c=3").statement;
  assert.equal(await affinity.step(),"row"); assert.equal(affinity.column(0),1n);
  assert.equal(await affinity.step(),"done"); affinity.finalize(); affinityDb.close();
});

test("step control failures are saved, cleaned by reset/finalize, and connection bounds cannot be relaxed", async () => {
  const db=await openBytes("empty");
  for (const [options,kind] of [[{maxWorkUnits:0},"limit"],[{timeoutMs:0},"timeout"]]) {
    const s=db.prepare("SELECT 1").statement; await assert.rejects(s.step(options),isError(kind));
    assert.throws(()=>s.reset(),isError(kind));
    assert.equal(await s.step(),"row"); s.finalize();
  }
  const controller=new AbortController(); controller.abort("stop");
  const cancelled=db.prepare("SELECT 1").statement; await assert.rejects(cancelled.step({signal:controller.signal}),isError("cancelled"));
  assert.throws(()=>cancelled.finalize(),isError("cancelled"));
  db.close();

  const parsed=parseSql("SELECT 1").statement;
  assert.ok(parsed?.kind === "select");
  const s=new VdbeStatement(compileScalarSelect(parsed,1),()=>{});
  await assert.rejects(s.step({maxWorkUnits:999}),isError("limit"));
  assert.throws(()=>s.finalize(),isError("limit"));
});

test("long table scan yields and observes cancellation after execution begins", async () => {
  const db=await openBytes("storage-p4096");
  const s=db.prepare("SELECT k FROM storage_values WHERE i=999999").statement;
  const controller=new AbortController();
  setTimeout(()=>controller.abort("mid-scan"),0);
  await assert.rejects(s.step({signal:controller.signal}),error=>isError("cancelled")(error)&&error.cause==="mid-scan");
  assert.throws(()=>s.finalize(),isError("cancelled"));
  db.close();
});

test("live statement close is BUSY, deferred close keeps VM alive, and breadth is explicit", async () => {
  const db=await openBytes("empty"); const s=db.prepare("SELECT 1").statement;
  assert.throws(()=>db.close(), error=>isError("sqlite")(error)&&error.code===5);
  assert.equal(await s.step(),"row"); s.reset(); db.closeDeferred();
  assert.throws(()=>db.prepare("SELECT 2"),isError("misuse"));
  assert.equal(await s.step(),"row"); s.finalize();
  const db2=await openBytes("empty");
  for (const sql of ["SELECT count(*)", "SELECT 1 ORDER BY 1", "SELECT DISTINCT 1", "SELECT 1 GROUP BY 1", "SELECT 1 LIMIT 1", "SELECT * FROM missing JOIN other"])
    assert.throws(()=>db2.prepare(sql), error=>isError("unsupported")(error)&&error.unsupportedClassification==="temporary");
  db2.close();
});
