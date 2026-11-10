# CF02 direct recursive consumer — bounded author evidence

Input: eee2c7837058a2a5ee83c99a406fbf230a559f46, tree
b037b565b023f524b1e12778fb50cdb1f1be6778. Candidate lives in task-owned
`/work/jsqlite2/cf02-candidate`; mutable parent checkout/index is not input.
SQLite oracle: 3.53.4, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`, library SHA256
b8ba542c98b52a3b7a8644f44d1dc0f9eb69488165c482f574753537b9543dea.

## Owner comparison and correction

Pinned resolve.c lookupName checks schema/table/alias identity before searching
columns (418–440); sqlite3Select prepares before generateWithRecursiveQuery.
The direct TS consumer instead discarded qualifiers in its spelling binder.
The correction reuses prepareRecursiveSource's transient declaration and linked
resolver, then bindResolvedExpression maps resolved source/column identities to
Current registers. Producer-only callers retain enclosing-owner resolution;
multiple-producer callers pass the schema through their child compilation.
The outer spelling binder is removed. Recursive setup/step spelling binding is
unchanged (CF04 outside this slice). No queue, history, priority, WHERE planner,
private-state or body/outer LIMIT algorithm changed.

First regression run failed all three encodings on wrong.n (proc-7232bd60ca10).
Linked resolution fixed that but exposed schema-less Current matching main.c.n
(proc-8e7dd0ad8496); direct() now excludes recursiveCurrentTables from schema
matches, reflecting pTab->pSchema == NULL. EXISTS negative initially returned
temporary unsupported before resolution (proc-9f6c26d50453); moving linked
consumer preparation before consumer-shape admission preserved the native error.
An initial typecheck found exactOptionalPropertyTypes on forwarded optional
schema; conditional forwarding corrected it. Final checks below supersede those
failures, not the separate historical composition gaps.

## Reproduction and verification

`node --experimental-strip-types --test test/conformance/recursive-cte-resolution.test.mjs`
passes all three encodings. Public Fetch companions assert valid/wrong qualifiers,
alias hiding, schema, ambiguity, output-alias scope, LIMIT0, EXISTS and competing
errors; INTEGER rows/full five-field metadata/two reset cycles; rebind; cancelled,
timeout and maxWorkUnits controls followed by reset/reuse/finalize.

Reviewer R0/R2 scripts retained under card work cf02-green, with only candidate
root changed: `NODE_DISABLE_COMPILE_CACHE=1 timeout 100 node --experimental-strip-types "$SAIVAGE_CARD_WORK_ROOT/cf02-green/probe.mjs" R0,R2` and
`timeout 100 python3 "$SAIVAGE_CARD_WORK_ROOT/cf02-green/native.py" R0,R2`.
Capture proc-1352aabb187e: R0 matches INTEGER1,2,3/metadata/two runs;
R2 matches prepare code1 `no such column: wrong.n` in all encodings.

Expanded matrix uses the same prefix and SELECT tails as the regression test:
plain/qualified/aliased valid projections, wrong/hidden/schema names, output-alias,
LIMIT0, competing errors, repeated-reader ambiguity and nested EXISTS error.
`matrix.mjs` / `matrix-native.py` capture proc-5e0a6cc6d499. Explicit JSON field
comparison proc-6f8d122a1fbc confirms **33/33**: nine successful typed/fullmetadata/
two-run records and24 prepare diagnostics across three encodings. Runtime-control
companions are not native comparisons or additional upstream credit.

Final serial eight-file command:
```
timeout 80 node --experimental-strip-types --test --test-concurrency=1 test/conformance/recursive-cte-{resolution,aggregate,compound,join,left,repeated,right-full}.test.mjs test/conformance/select-recursive-builder.test.mjs
timeout 100 node /work/jsqlite2/node_modules/typescript/bin/tsc --noEmit
git diff --check
```
Chained with &&, proc-da65d45c85f9 exits0: **33/33**, typecheck, scoped diff check.
No dependency installation. No full suite/package/GUI-browser or independent
source/caller acceptance. Existing upstream assertion credit unchanged; CF04 and
other composition findings remain outside this candidate.
