import assert from "node:assert/strict";
import { FunctionContext } from "../../src/internal/vdbe.ts";
import { Mem } from "../../src/internal/mem.ts";

function integer(value) { const mem=new Mem(); mem.setInt64(value); return mem; }

{
  const events=[];
  const context=new FunctionContext();
  context.setResult(integer(1n),()=>events.push("cleanup-1"));
  context.setResult(integer(2n),()=>events.push("cleanup-2"));
  const result=context.takeResult();
  assert.equal(result.integerValue(),2n);
  assert.deepEqual(events,["cleanup-1","cleanup-2"]);
  result.release();
}
{
  const primary=new Error("primary");
  const secondary=new Error("secondary cleanup");
  const context=new FunctionContext();
  context.setResult(integer(1n),()=>{throw secondary});
  context.setError(primary);
  assert.throws(()=>context.takeResult(), error=>error===primary);
  assert.equal(context.firstError,primary);
}
{
  const secondary=new Error("cleanup only");
  const context=new FunctionContext();
  context.setResult(integer(1n),()=>{throw secondary});
  assert.throws(()=>context.takeResult(), error=>error===secondary);
}
{
  const events=[];
  const primary=new Error("primary aux");
  const secondary=new Error("aux cleanup");
  const context=new FunctionContext();
  context.setAuxData(0,"old",()=>events.push("aux-old"));
  context.setAuxData(0,"new",()=>{events.push("aux-new");throw secondary});
  context.setAuxData(1,"other",()=>events.push("aux-other"));
  assert.equal(context.getAuxData(0),"new");
  context.setError(primary);
  assert.throws(()=>context.takeResult(),error=>error===primary);
  assert.deepEqual(events,["aux-old","aux-new","aux-other"]);
}
console.log(JSON.stringify({schema:"jsqlite-function-cleanup-ts/1",credit:1,outcome:"pass",checks:["replacement-cleanup-order","first-error-identity","cleanup-error","aux-replacement-cleanup","aux-first-error-identity"]}));
