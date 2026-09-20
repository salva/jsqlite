import fs from "node:fs";
import path from "node:path";
import { startFixtureServer } from "./fixture-server.mjs";
import { openFixture } from "./public-api-adapter.mjs";
import { validateCaseData } from "./ts-accounting.mjs";
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
const expectedObservedErrors=new Map([
 ["close.test:close-1.4.3",{kind:"misuse",operation:"prepare"}],
 ["capi3c.test:capi3c-1.1",{kind:"sqlite",operation:"prepare"}],
 ["capi3c.test:capi3c-1.4",{kind:"sqlite",operation:"prepare"}],
 ["capi3c.test:capi3c-1.5",{kind:"sqlite",operation:"prepare"}],
 ["capi3c.test:capi3c-2.1",{kind:"sqlite",operation:"prepare"}],
 ["capi3c.test:capi3c-2.2",{kind:"sqlite",operation:"prepare"}],
 ["capi3c.test:capi3c-2.3",{kind:"sqlite",operation:"prepare"}],
]);
try {
 for (const c of data.cases) {
  const state={connection:null,statement:null}; let failure=null;
  for (let index=0;index<c.operations.length;index++) {
   const op=c.operations[index];
   try { await execute(op,state); } catch(e) { failure={error:e,index,key:op.key,op:op.op}; break; }
  }
  // This is the historical Stage 2 sequence runner. Most mapped operations are
  // now implemented, so completion is success rather than an obsolete expected
  // "temporary unsupported" failure. Retain real observed failures without
  // converting them into compatibility credit.
  const expectedError=expectedObservedErrors.get(c.id);
  if(failure){
   if(!expectedError||failure.op!==expectedError.operation||failure.error?.name!=="JSQLiteError"||failure.error?.kind!==expectedError.kind)throw failure.error;
  }else if(expectedError)throw new Error(`${c.id}: expected ${expectedError.kind} at ${expectedError.operation}`);
  const result=failure
   ? {schema:"jsqlite-ts-result/2",caseId:c.id,caseCredit:c.credit,disposition:"observed-error",credit:0,attempted:{index:failure.index,key:failure.key,op:failure.op},error:{name:failure.error?.name??"Error",kind:failure.error?.kind??null,code:failure.error?.code??null,extendedCode:failure.error?.extendedCode??null,unsupportedClassification:failure.error?.unsupportedClassification??null,message:String(failure.error?.message??failure.error)},notAttempted:c.operations.slice(failure.index+1).map((op,index)=>({index:index+failure.index+1,key:op.key,op:op.op}))}
   : {schema:"jsqlite-ts-result/2",caseId:c.id,caseCredit:c.credit,disposition:"completed",credit:0,attempted:null,error:null,notAttempted:[]};
  results.push(result); console.log(JSON.stringify(result));
 }
 if(results.length!==data.cases.length)throw new Error("missing Stage 2 results");
 if(results.filter(r=>r.disposition==="observed-error").length!==expectedObservedErrors.size)throw new Error("missing/extra expected Stage 2 errors");
 const upstream=results.filter(r=>r.caseCredit==="upstream"),companions=results.filter(r=>r.caseCredit!=="upstream"),completed=results.filter(r=>r.disposition==="completed").length;
 console.log(JSON.stringify({summary:{attempted:results.length,upstream:upstream.length,companions:companions.length,completed,observedErrors:results.length-completed,credit:0,disposition:"diagnostic-no-credit"}}));
} finally { await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve())); }
