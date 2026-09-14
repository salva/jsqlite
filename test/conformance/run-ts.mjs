import fs from "node:fs"; import path from "node:path";
import { startFixtureServer } from "./fixture-server.mjs";
import { openFixture } from "./public-api-adapter.mjs";
import { validateCaseData,validateResults } from "./ts-accounting.mjs";
const root=path.resolve(new URL("../..",import.meta.url).pathname), manifest=JSON.parse(fs.readFileSync(path.join(root,"test/conformance/cases/stage2-initial.json"))), data=JSON.parse(fs.readFileSync(path.join(root,"test/conformance/cases/stage2-ts.json")));
validateCaseData(data,[...manifest.upstreamCases,...manifest.companionCases]); const bridge=await startFixtureServer(path.join(root,"test/fixtures")); const results=[];
try { for(const c of data.cases) { let failure,attempted;
  for(let index=0;index<c.operations.length;index++){ const op=c.operations[index]; attempted={index,key:op.key,op:op.op}; try { if(op.op==="openFixture") await openFixture(new Request(`http://127.0.0.1:${bridge.port}/fixture/${bridge.token}/${encodeURIComponent(op.fixture)}`)); else throw new Error(`operation unexpectedly reached: ${op.op}`); } catch(e){ failure=e; break; } }
  if(!failure||failure.name!=="JSQLiteError"||failure.kind!=="unsupported"||failure.unsupportedClassification!=="temporary") throw failure??new Error(`${c.id}: unexpectedly completed`);
  const error={name:failure.name,kind:failure.kind,code:failure.code??null,extendedCode:failure.extendedCode??null,unsupportedClassification:failure.unsupportedClassification,message:failure.message};
  const result={schema:"jsqlite-ts-result/1",caseId:c.id,caseCredit:c.credit,disposition:"unimplemented-temporary",credit:0,attempted,error,notAttempted:c.operations.slice(1).map((op,index)=>({index:index+1,key:op.key,op:op.op}))}; results.push(result); console.log(JSON.stringify(result)); }
 validateResults(data.cases,results); console.log(JSON.stringify({summary:{attempted:47,upstream:38,companions:9,passed:0,credit:0,disposition:"unimplemented-temporary"}}));
} finally { await new Promise((resolve,reject)=>bridge.server.close(e=>e?reject(e):resolve())); } process.exitCode=1;
