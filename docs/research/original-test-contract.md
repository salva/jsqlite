# Original retained-filter test contract adjudication

On parent `1c18fb560cf3514acb002160210a219f66453acb`, the original query
`SELECT * FROM (SELECT a FROM t1 ORDER BY a LIMIT 2) WHERE a>1` is admitted.
Pinned `select.c:4350` restriction19 forbids **flattening**, not execution;
`select.c:8054–8125` tags0482/0488 implement coroutine/materialization.
Current `compileRetainedFilter` preserves child ORDER/LIMIT before outer WHERE.
This corrects the original test contract, not runtime admission or budgets.

## Native-first evidence

`test/conformance/cases/retained-filter-original.json` records fresh C API output
for the exact original `subquery-{utf8,utf16le,utf16be}.db` fixture images, identified
by SHA256. SQLite3.53.4 sourceId and native library hash are in that receipt.
Capture used `tools/oracle/capture-retained-filter.py` unchanged except replacing
its `queries=` input in a disposable in-memory copy with the single exact SQL;
image specifications came from `test/fixtures/CURRENT.json`'s generation and the
three original files (not substituted retained-filter x fixtures). The existing
capture authenticates sourceId and image hashes, opens read-only, collects five
metadata fields and typed rows, and steps/resets twice. The receipt omits only
redundant image base64; public tests authenticate the fixture hashes before use.

Author capture proc-888e92cb1978 and decoded summary proc-69ddd6d268a4 establish
prepare0, metadata a/INTEGER/main/t1/a, INTEGER3, DONE101 on both runs in all three
encodings. Exact primary output is
`work:///cards/card-m-f-k/processes/proc-888e92cb1978/stdout.log`.
Public correction preserves the preceding window check, compares metadata and
typed rows twice with reset, and preserves an actual adjacent unsupported boundary:
adding `json_each('[1]')` as a mixed module source rejects atomically at prepare
with the existing precise unsupported message, followed by successful SELECT1.
No runtime error is relabeled as prepare failure.

## Cross-owner proposed patch — not applied

`select-derived-table-compound-owner.test.mjs` has no established original-card
ownership here. Planner/ROOT [[card:card-j]] must adjudicate/apply this bounded
proposal; that original file is unchanged by this delivery. Its overly broad
concatenated range includes later `compileRetainedFilter`, whose FULL replay
legitimately emits OpenEphemeral. The merge owner itself recursively composes
coroutine ranges and CompareJump; no SET materialization exception is proposed.

```diff
--- a/test/conformance/select-derived-table-compound-owner.test.mjs
+++ b/test/conformance/select-derived-table-compound-owner.test.mjs
@@ -257,7 +257,12 @@
  const source=fs.readFileSync(new URL('../../src/internal/vdbe.ts',import.meta.url),'utf8');
  const start=source.indexOf('  }else if(setProducer||mixedProducer||ordered){');
  assert.ok(start>=0);
- const branch=source.slice(start,source.indexOf('  }else if(unionProducer||groupedAllProducer)',start))+source.slice(source.indexOf('function emitScalarCompoundMerge('),source.indexOf('function compileDerivedProducer('));
+ // Scan only the merge owner, not subsequent retained-filter helpers.
+ const mergeStart=source.indexOf('function emitScalarCompoundMerge(');
+ const mergeEnd=source.indexOf('\nfunction ',mergeStart+1);
+ assert.ok(mergeStart>=0&&mergeEnd>mergeStart);
+ const merge=source.slice(mergeStart,mergeEnd);
+ const branch=source.slice(start,source.indexOf('  }else if(unionProducer||groupedAllProducer)',start))+merge;
@@ -270,1 +275,1 @@
- assert.doesNotMatch(branch,/OpenEphemeral|SetDelete|SetRetainIntersection|child\.ops/);
+ assert.doesNotMatch(branch,/OpenEphemeral|SetDelete|SetRetainIntersection|child\.ops|relocateControlTargets/);
```

All positive BalancedMerge assertions stay unchanged. The five negative controls
are OpenEphemeral, SetDelete, SetRetainIntersection, child.ops and
relocateControlTargets; the last is reinforced explicitly rather than merely
in surrounding gates. The immediate next top-level function boundary avoids
pulling independent pruning/retained producer ownership into the merge body.
This does not authorize new helper delegation or a new set-materialization route.

## Verification and remaining gates

- Original focused command proc-523a4697648b: two failures, retained rejection
  assertion and over-broad ownership scan (accepted red status722).
- Corrected owned test proc-35504553e740: three encoding cases pass.
- First disposable proposal run proc-4bd4b3c202e9:29/30, missing resolve.ts in the
  disposable copy; chained public tests/typecheck did not execute. This was a
  harness input omission, not a product failure or acceptance.
- After copying the unchanged resolver, proc-a342eb982412: proposal-only full
  owner file30/30; actual owned from-subquery-routes plus retained-filter41/41;
  chained typecheck exit0. Complete output summary read at
  `work:///cards/card-m-f-k/processes/proc-a342eb982412/stdout.log`.

The original cousin gate remains red until its owner applies an adjudicated
patch. Additional author checks: proc-9cd7be720e0f passed20 affected compound
owner/public cases but its wide-native case failed solely for missing
WIDE_COMPOUND_FIXTURES; mutation loop after that command did not run. With the
receipt's actual fixture directory explicitly supplied, proc-40e8a1e58180 passed
the wide-native case (96 queries, all encodings, typed metadata/rows twice/reset).
Proc-6a15bf4a55b9 independently injected each of the five forbidden tokens into
the disposable merge body; all five caused the proposed assertion to fail,
then the original disposable source was restored. No production source mutation.
No combined full-beta pass is claimed. Public compound executable callers,
negative mutation sensitivity, exact candidate tree checks and required affected
regressions are recorded in this card's current status as performed; unchanged
prior F5–F7 evidence stays revision-bound. Independent [[card:card-m-f-l]] must
assess the same corrected input; ROOT [[card:card-w]] owns later full replay.
