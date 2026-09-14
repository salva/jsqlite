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
console.log(JSON.stringify({schema:"jsqlite-function-cleanup-ts/1",credit:1,outcome:"pass",checks:["replacement-cleanup-order","first-error-identity","cleanup-error"]}));
