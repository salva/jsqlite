export function validateCaseData(doc, expectedIds, companionIds = []) {
  if (doc?.schema !== "jsqlite-ts-cases/1" || !Array.isArray(doc.cases)) throw new Error("malformed case document");
  const ids = doc.cases.map(c => c?.id);
  if (ids.some(id => typeof id !== "string") || new Set(ids).size !== ids.length) throw new Error("duplicate/malformed case identity");
  if (ids.length !== expectedIds.length || ids.some((id,index) => id !== expectedIds[index])) throw new Error("missing/extra/reordered case identity");
  for (const c of doc.cases) {
    const credit = companionIds.includes(c.id) ? "no-credit-companion" : "upstream";
    if (c.credit !== credit || !Array.isArray(c.setup) || c.setup.length !== 0) throw new Error(`malformed classification/setup: ${c.id}`);
    if (!Array.isArray(c.operations) || c.operations.length === 0 || c.operations[0].op !== "openFixture" || c.operations[0].fixture !== c.fixture) throw new Error(`malformed operations: ${c.id}`);
    const keys=c.operations.map(o=>o?.key);
    if (keys.some(k=>typeof k!=="string") || new Set(keys).size!==keys.length || c.operations.some(o=>typeof o?.op!=="string")) throw new Error(`malformed operation identity: ${c.id}`);
    const e=c.expected?.error, a=c.expected?.attempted;
    if (c.expected?.disposition !== "unimplemented-temporary" || !Number.isInteger(a?.index) || a.index < 1 || c.operations[a.index]?.key !== a.key || c.operations[a.index]?.op !== a.op || a.op !== "prepare" || e?.name!=="JSQLiteError" || e?.kind!=="unsupported" || e?.code!==null || e?.extendedCode!==null || e?.unsupportedClassification!=="temporary") throw new Error(`malformed expectation: ${c.id}`);
  }
}
export function validateResults(cases, results) {
  if (!Array.isArray(results) || results.length!==cases.length) throw new Error("missing/extra results");
  const byId = new Set();
  for (let i=0;i<results.length;i++) {
    const c=cases[i], r=results[i];
    if (!r || r.schema!=="jsqlite-ts-result/1" || r.caseId!==c.id || byId.has(r.caseId)) throw new Error("duplicate/malformed/reordered result");
    byId.add(r.caseId);
    const attemptedIndex=r?.attempted?.index;
    const attemptedOperation=Number.isInteger(attemptedIndex) && attemptedIndex>=0 ? c.operations[attemptedIndex] : null;
    const expectedSuffix=attemptedOperation ? c.operations.slice(attemptedIndex+1).map((o,index)=>({index:index+attemptedIndex+1,key:o.key,op:o.op})) : null;
    if (r.caseCredit!==c.credit || r.disposition!==c.expected.disposition || r.credit!==0 || !attemptedOperation || attemptedIndex!==c.expected.attempted.index || r.attempted.key!==c.expected.attempted.key || r.attempted.op!==c.expected.attempted.op || r.attempted.key!==attemptedOperation.key || r.attempted.op!==attemptedOperation.op || r.error?.name!==c.expected.error.name || r.error?.kind!==c.expected.error.kind || r.error?.code!==null || r.error?.extendedCode!==null || r.error?.unsupportedClassification!==c.expected.error.unsupportedClassification || typeof r.error?.message!=="string" || JSON.stringify(r.notAttempted)!==JSON.stringify(expectedSuffix)) throw new Error(`unattempted/malformed result: ${c.id}`);
  }
}
