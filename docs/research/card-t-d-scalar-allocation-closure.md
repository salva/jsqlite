# Scalar allocation assertion closure

Root authorized only existing t scalar assertion/contract correction and minimal
proof. Base315b4471f68494d9510878c897649b2645695f08. No production patch needed:
HEAD joined producer vdbe.ts3405 already uses enclosing builder.range(Math.max(1,
expanded.result.length)). SelectProgramBuilder.range requires positive count,
returns previous nMem+1 and increments exactly count. Pinned select.c1177–1195
selectInnerLoop reserves result columns through owning pParse.nMem/iSdst/nSdst;
TS positive carrier reservation is retained adaptation, not a new public empty
SELECT guarantee. VM register/cursor/work/lifecycle controls are unchanged.

Preserved original test and changed only stale allocation regex at471 (previously
staged t-attributed hunk), with live production-path proof appended. Prototype
observer delegates to real range, captures count/start/end/builder identity and
joined stack; scan and ordered child SQL each exercise scalar/EXISTS/IN on ONE
builder, positive contiguous ranges, INTEGER4/0/1, DONE/reset/reexecution/finalize.
No allocation ceiling relaxed; source regex remains an additional guard. This
is not zero-column public support or universal planner allocation certification.

RED exact HEAD source assertion0/1pass exit1; staged regex current22/22. Added
proof working23/23 unchanged30s, proc-11ee05424f26. Fresh pinned sourceid-checked
native two SQL probes (scan/order), prepare0 INTEGER4/0/1 DONE101/finalize/close0,
proc-dba3776e848e. Artifact work:///cards/card-t-d/scalar-allocation-closure/
contains native.py/native.json, attributed-staged.patch/owning.patch and logs.
Native capture is post-test-change, no engine change or private nMem native parity
claim. RED source comparison/logs retained scalar-allocation-red/.

Only test plus this contract/evidence document allocated for commit. Unrelated
staged JSON/API/docs/vdbe deletion/reversions excluded; no minimal source dependency
needed because exact HEAD contains builder behavior. Isolated index builds scoped
commit; unrelated real index entries and all working source remain preserved.
Exact committed export verification/commit hashes are recorded in card status,
not a circular hash in this document. Original v238=227completed/10fail/1timeout
remains NONPASS; this closure alone certifies neither that corpus nor alpha.
