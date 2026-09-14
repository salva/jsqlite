import fs from "node:fs";
import path from "node:path";
import { startFixtureServer } from "./fixture-server.mjs";
import { openFixture } from "./public-api-adapter.mjs";
import { validateCaseData, validateResults } from "./ts-accounting.mjs";
const root=path.resolve(new URL("../..",import.meta.url).pathname);
const manifest=JSON.parse(fs.readFileSync(path.join(root,"test/conformance/cases/stage2-initial.json")));
const data=JSON.parse(fs.readFileSync(path.join(root,"test/conformance/cases/stage2-ts.json")));
const expected=[...manifest.upstreamCases,...manifest.companionCases]; validateCaseData(data,expected,manifest.companionCases);
const bridge=await startFixtureServer(path.join(root,"test/fixtures")); const results=[];
function statementOf(state) { if(!state.statement) throw new Error("adapter invariant: statement operation without a statement"); return state.statement; }
async function execute(op,state) {
 switch(op.op) {
  case "openFixture": state.connection=await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${encodeURIComponent(op.fixture)}`)); return;
  case "prepare": { const p=state.connection.prepare(op.sql); state.statement=p?.statement??p; return; }
  case "closeDeferred": state.connection.closeDeferred(); return;
  case "bind": statementOf(state).bind(op.index??op.name, decodeValue(op.value)); return;
  case "step": await statementOf(state).step(); return;
  case "reset": statementOf(state).reset(); return;
  case "clearBindings": statementOf(state).clearBindings(); return;
  case "finalize": statementOf(state).finalize(); return;
  case "column": statementOf(state).column(op.column); return;
  case "columnType": statementOf(state).columnType(op.column); return;
  case "columnInteger": statementOf(state).columnInteger(op.column); return;
  case "columnReal": statementOf(state).columnReal(op.column); return;
  case "columnText": statementOf(state).columnText(op.column); return;
  case "columnBlob": statementOf(state).columnBlob(op.column); return;
  case "columnMetadata": statementOf(state).columnMetadata(op.column); return;
  case "columnCount": statementOf(state).columnCount; return;
  case "parameterCount": statementOf(state).parameterCount; return;
  case "parameterName": statementOf(state).parameterName(op.index); return;
  case "parameterIndex": statementOf(state).parameterIndex(op.name); return;
  case "statementMetadata": { const s=statementOf(state); for(let i=0;i<s.columnCount;i++) s.columnMetadata(i); return; }
  default: throw new Error(`unknown public adapter operation: ${op.op}`);
 }
}
function decodeValue(v) {
 if(v?.js==="null") return null;
 if(v?.js==="bigint") return BigInt(v.decimal);
 if(v?.js==="string") return v.value;
 if(v?.js==="uint8array") return Uint8Array.from(Buffer.from(v.hex,"hex"));
 if(v?.js==="number") { const b=Buffer.from(v.ieee754be,"hex"); return b.readDoubleBE(); }
 throw new Error("malformed generated bind literal");
}
try {
 for (const c of data.cases) {
  const state={connection:null,statement:null}; let failure=null; let attempted=null;
  for (let index=0;index<c.operations.length;index++) {
   const op=c.operations[index]; attempted={index,key:op.key,op:op.op};
   try { await execute(op,state); } catch(e) { failure=e; break; }
  }
  if (!failure) throw new Error(`${c.id}: unexpectedly completed the mapped sequence`);
  if (failure?.name !== "JSQLiteError" || failure?.kind !== "unsupported" || failure?.unsupportedClassification !== "temporary") throw failure;
  const error={name:failure.name,kind:failure.kind,code:failure.code??null,extendedCode:failure.extendedCode??null,unsupportedClassification:failure.unsupportedClassification??null,message:failure.message};
  const result={schema:"jsqlite-ts-result/1",caseId:c.id,caseCredit:c.credit,disposition:"unimplemented-temporary",credit:0,attempted,error,notAttempted:c.operations.slice(attempted.index+1).map((op,index)=>({index:index+attempted.index+1,key:op.key,op:op.op}))};
  results.push(result); console.log(JSON.stringify(result));
 }
 validateResults(data.cases,results);
 const upstream=results.filter(r=>r.caseCredit==="upstream").length, companions=results.length-upstream;
 console.log(JSON.stringify({summary:{attempted:results.length,upstream,companions,passed:0,credit:0,disposition:"unimplemented-temporary"}}));
} finally { await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve())); }
process.exitCode=1;
