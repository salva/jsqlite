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
