// Diagnostic sequence matching is not upstream assertion/compatibility credit.
export function matchDiagnostic(c,failure){
 const expected=c.diagnosticExpected;
 if(!expected)return {matched:false,reason:'missing-diagnostic-expectation'};
 if(!failure)return {matched:expected.disposition==='completed',reason:'completion'};
 const e=expected.error;
 return {matched:expected.disposition==='observed-error'&&!!e
  &&failure.op===e.operation&&failure.error?.name==='JSQLiteError'
  &&['kind','code','extendedCode','message'].every(k=>failure.error?.[k]===e[k]),
  reason:'observed-error'};
}
