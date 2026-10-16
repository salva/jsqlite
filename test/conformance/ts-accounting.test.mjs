import assert from "node:assert/strict";
import { validateCaseData,validateResults } from "./ts-accounting.mjs";
const c=(id,credit="upstream")=>({id,credit,fixture:"empty",setup:[],operations:[{key:"open",op:"openFixture",fixture:"empty"},{key:"prepare",op:"prepare",sql:"SELECT 1"}],expected:{disposition:"unimplemented-temporary",attempted:{index:1,key:"prepare",op:"prepare"},error:{name:"JSQLiteError",kind:"unsupported",code:null,extendedCode:null,unsupportedClassification:"temporary"}}});
const r=(id,credit="upstream")=>({schema:"jsqlite-ts-result/1",caseId:id,caseCredit:credit,disposition:"unimplemented-temporary",credit:0,attempted:{index:1,key:"prepare",op:"prepare"},error:{name:"JSQLiteError",kind:"unsupported",code:null,extendedCode:null,unsupportedClassification:"temporary",message:"SQL preparation is not implemented"},notAttempted:[]});
assert.doesNotThrow(()=>validateCaseData({schema:"jsqlite-ts-cases/1",cases:[c("a"),c("b","no-credit-companion")]},["a","b"],["b"]));
for(const bad of [{schema:"jsqlite-ts-cases/1",cases:[c("a"),c("a")]},{schema:"jsqlite-ts-cases/1",cases:[c("a")]},{schema:"bad",cases:[c("a"),c("b")]},{schema:"jsqlite-ts-cases/1",cases:[c("b"),c("a")]},{schema:"jsqlite-ts-cases/1",cases:[{...c("a"),expected:{...c("a").expected,attempted:{index:0,key:"open",op:"openFixture"}}},c("b")]}]) assert.throws(()=>validateCaseData(bad,["a","b"]));
assert.doesNotThrow(()=>validateResults([c("a"),c("b","no-credit-companion")],[r("a"),r("b","no-credit-companion")]));
const malformed=[
 [{...r("a"),attempted:null}],
 [{...r("a"),attempted:{index:0,key:"open",op:"openFixture"},notAttempted:[{index:1,key:"prepare",op:"prepare"}]}],
 [r("a"),r("a")],
 [{...r("a"),schema:"bad"}],
 [{...r("a"),caseCredit:"no-credit-companion"}],
 [{...r("a"),error:{...r("a").error,code:1}}],
 [{...r("a"),notAttempted:[{index:99,key:"fabricated",op:"finalize"}]}],
];
for(const bad of malformed) assert.throws(()=>validateResults([c("a")],bad));
console.log("TS accounting requires real open success, exact prepare failure, identities, and unattempted suffixes");

// The generator must not erase the four allocated operation-phase assertions
// while retaining historical unsupported expectations for the other 43 lanes.
const { readFileSync } = await import('node:fs');
const manifest = JSON.parse(readFileSync(new URL('./cases/stage2-initial.json', import.meta.url)));
const generated = JSON.parse(readFileSync(new URL('./cases/stage2-ts.json', import.meta.url)));
const ids = [...manifest.upstreamCases, ...manifest.companionCases];
assert.doesNotThrow(() => validateCaseData(generated, ids, manifest.companionCases));
const allocated = generated.cases.filter(c => c.expected.disposition === 'completed');
assert.deepEqual(allocated.map(c => c.id), ['1.1', '1.4', '2.1', '2.2'].map(s => `capi3c.test:capi3c-${s}`));
assert.equal(generated.cases.length - allocated.length, 43);
// Current diagnostics must not silently promote the retained baseline. The four
// allocated prepare/tail lanes are the only exception, even when a current
// sequence is expected to complete without error.
assert.equal(generated.cases.filter(c => c.credit === 'upstream').length, 38);
assert.equal(generated.cases.filter(c => c.credit === 'no-credit-companion').length, 9);
for (const lane of generated.cases) {
  assert.ok(lane.diagnosticExpected, `missing diagnostic authority: ${lane.id}`);
  if (allocated.includes(lane)) continue;
  const index = lane.operations.findIndex(o => o.op === 'prepare');
  assert.deepEqual(lane.expected, {
    disposition: 'unimplemented-temporary',
    attempted: {index, key: lane.operations[index].key, op: 'prepare'},
    error: {name: 'JSQLiteError', kind: 'unsupported', code: null,
      extendedCode: null, unsupportedClassification: 'temporary'},
  });
}
assert.deepEqual(generated.cases.filter(c => c.diagnosticExpected.disposition === 'observed-error').map(c => c.id),
  ['close.test:close-1.4.3', 'capi3c.test:capi3c-1.5', 'capi3c.test:capi3c-2.3']);
for (const lane of allocated) {
  const prepare = lane.operations.find(o => o.op === 'prepare');
  assert.deepEqual(prepare.assertion, {
    phase: 'prepare', tail: lane.id.endsWith('1.4') || lane.id.endsWith('2.2') ? 'SELECT 10' : '',
    columnCount: 1,
    metadata: {name: 'name', declaredType: 'TEXT', database: 'main', table: 'sqlite_master', origin: 'name'},
  });
  assert.deepEqual(lane.operations.find(o => o.op === 'step').assertion,
    {phase: 'step', result: 'done', rowCount: 0});
}
for (const original of allocated) {
  const bad = structuredClone(generated);
  delete bad.cases.find(c => c.id === original.id).operations.find(o => o.op === 'step').assertion;
  assert.throws(() => validateCaseData(bad, ids, manifest.companionCases), /missing source assertions/);
}
console.log('Stage2 preserves 38+9 identities and four allocated prepare/empty-step assertion lanes');
