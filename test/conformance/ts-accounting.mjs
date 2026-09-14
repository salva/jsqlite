export function validateCaseData(doc, expectedIds) {
  if (doc?.schema !== "jsqlite-ts-cases/1" || !Array.isArray(doc.cases)) throw new Error("malformed case document");
  const ids=doc.cases.map(c=>c?.id);
  if(ids.some(id=>typeof id!=="string")||new Set(ids).size!==ids.length) throw new Error("duplicate/malformed case identity");
  if(ids.length!==expectedIds.length||ids.some((id,i)=>id!==expectedIds[i])) throw new Error("missing/extra/reordered case identity");
  for(const c of doc.cases) if(!Array.isArray(c.operations)||!c.operations.length||c.operations[0].op!=="openFixture"||c.operations[0].fixture!==c.fixture||c.expected?.disposition!=="unimplemented-temporary") throw new Error(`malformed operations/expectation: ${c.id}`);
}
export function validateResults(cases,results) {
  if(!Array.isArray(results)||results.length!==cases.length) throw new Error("missing/extra results");
  const seen=new Set();
  for(let i=0;i<results.length;i++) { const c=cases[i],r=results[i];
    if(!r||r.schema!=="jsqlite-ts-result/1"||r.caseId!==c.id||seen.has(r.caseId)) throw new Error("duplicate/malformed/reordered result"); seen.add(r.caseId);
    if(r.disposition!=="unimplemented-temporary"||r.credit!==0||r.attempted?.index!==0||r.attempted?.key!==c.operations[0].key||r.attempted?.op!=="openFixture"||r.error?.name!=="JSQLiteError"||r.error?.kind!=="unsupported"||r.error?.unsupportedClassification!=="temporary"||!Array.isArray(r.notAttempted)||r.notAttempted.length!==c.operations.length-1) throw new Error(`unattempted/malformed result: ${c.id}`);
  }
}
