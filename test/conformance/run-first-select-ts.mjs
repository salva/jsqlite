import fs from "node:fs";
import path from "node:path";
import { startFixtureServer } from "./fixture-server.mjs";
import { openFixture } from "./public-api-adapter.mjs";

const root=path.resolve(new URL("../..",import.meta.url).pathname);
const manifest=JSON.parse(fs.readFileSync(path.join(root,"test/conformance/cases/stage3-first-select.json")));
const bridge=await startFixtureServer(path.join(root,"test/fixtures"));
const results=[];
function typed(s,i){const type=s.columnType(i),value=s.column(i);return type==="integer"?{type,value:String(value)}:{type};}
try {
  for(const c of manifest.cases){
    const operations=[]; let db=null,s=null;
    const record=async(op,fn)=>{try{await fn();operations.push({op,outcome:"pass"});}catch(error){operations.push({op,outcome:"fail",error:{name:error?.name,message:error?.message}});throw error;}};
    try {
      await record("openFixture",async()=>{db=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${c.fixture}`));});
      await record("prepare",async()=>{s=db.prepare(c.sql).statement;if(!s)throw new Error("expected statement");});
      if(c.operations.includes("metadata")) await record("metadata",async()=>{const names=Array.from({length:s.columnCount},(_,i)=>s.columnMetadata(i).name);if(JSON.stringify(names)!==JSON.stringify(c.native.columns))throw new Error(`column mismatch: ${JSON.stringify(names)}`);});
      if(c.operations.includes("stepAll")) await record("stepAll",async()=>{const rows=[];while(await s.step()==="row")rows.push(Array.from({length:s.columnCount},(_,i)=>typed(s,i)));if(JSON.stringify(rows)!==JSON.stringify(c.native.rows))throw new Error(`row mismatch: ${JSON.stringify(rows)}`);});
      else {
        await record("step",async()=>{if(await s.step()!=="row")throw new Error("expected ROW");});
        await record("readRow",async()=>{const row=Array.from({length:s.columnCount},(_,i)=>typed(s,i));if(JSON.stringify([row])!==JSON.stringify(c.native.rows))throw new Error(`row mismatch: ${JSON.stringify(row)}`);});
        await record("step",async()=>{if(await s.step()!=="done")throw new Error("expected DONE");});
      }
      await record("finalize",async()=>s.finalize()); db.close();
      const result={schema:"jsqlite-first-select-ts-result/1",caseId:c.ref,credit:1,operations};results.push(result);console.log(JSON.stringify(result));
    } finally { if(s&&!operations.some(x=>x.op==="finalize"&&x.outcome==="pass")){try{s.finalize();}catch{}} if(db){try{db.closeDeferred();}catch{}} }
  }
  if(results.length!==manifest.cases.length||results.some((r,i)=>r.caseId!==manifest.cases[i].ref||r.credit!==1||r.operations.some(o=>o.outcome!=="pass")))throw new Error("incomplete per-case accounting");
  console.log(JSON.stringify({summary:{declared:manifest.cases.length,attempted:results.length,passed:results.length,failed:0,unattempted:0,credit:results.length}}));
} finally { await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve())); }
