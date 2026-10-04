# Current physical-fixture LIKE count diagnosis

Executor [[card:card-p-b-c]], current HEAD `fea941baf247781e9b2de1d1e0a458fd1464afca`. Bounded owner investigation; **semantic divergence, not stale expected count**. No runtime, assertion, or fixture repair made. Existing dirty VDBE/index/research work is preserved.

## Fresh independent evidence

`node --experimental-strip-types --test test/conformance/run-ordinary-scalars-pattern-ts.mjs` exits 1: actual `3n` versus expected `2n` at line 106. Artifact `work:///cards/card-p-b-c/processes/proc-25cfc96406e5/stdout.log`.

C API capture against `/work/jsqlite2/.saivage/work/cards/card-p-a-a/oracle-build/build/libsqlite3-oracle.so` asserts `sqlite3_sourceid()` equals the project manifest's SQLite 3.53.4 ID. It opens each actual spec-selected physical users fixture, not a recreated database. All encodings give the same typed rows:

|id|name|name LIKE '%a%'|
|--|--|--|
|1|Alice|INTEGER 1|
|2|Bob|INTEGER 0|
|3|Cara|INTEGER 1|

Native `count(*)` = INTEGER 3; native filtered `count(*)` = INTEGER 2; native `sum(name LIKE '%a%')` = INTEGER 2. Artifact `work:///cards/card-p-b-c/processes/proc-c8a4dacab0c1/stdout.log` contains exact queries and results.

Public typed API on those same files has identical per-row projection results, total count 3, false-filter count 0 and id=1 count 1, but filtered pattern count and pattern sum both incorrectly return 3, in UTF-8/UTF-16LE/UTF-16BE. `count(name)` with infix LIKE also returns 3. Artifact `work:///cards/card-p-b-c/processes/proc-3c2b3b0f0696/stdout.log`.

Critical caller discriminator: explicit `like('%a%',name)` in filtered count and sum returns 2 in every encoding. Infix `name GLOB '*a*'` count returns 3 whereas explicit `glob('*a*',name)` returns the correct case-sensitive count 1. Artifact `work:///cards/card-p-b-c/processes/proc-f80ea7f836dc/stdout.log`.

## Owner path

Pinned `parse.y:1363–1383` constructs infix LIKE/GLOB/MATCH function arguments as RHS pattern, LHS value, optional escape. `expr.c` TK_FUNCTION consumes that function argument list; `func.c:likeFunc/patternCompare` consumes pattern first, value second. Ordinary direct public projections and explicit function calls match this ownership.

The current compiler's `bindResolvedExpression` (`vdbe.ts:1624`) maps call args against carrier children without infix reversal except in window-filter/window-source policies. Ordinary aggregate binding uses `ordinary-aggregate` (`compileAggregateSelect`/resultLocation) and therefore can rebind already-reversed expression args to syntax-order children. For the infix call, this replaces the column operand with the RHS literal: a constant self-match then reaches the correct Function and aggregate/filter opcodes. The contrast with explicit calls and per-row projection isolates semantic argument/carrier ownership, not patternCompare or aggregate arithmetic. The original compiler/resolved-carrier semantic owner should correct infix child ownership consistently across caller policies; this card does not add an evaluator or change the expected count.

A neighboring joined infix projection also fails at prepare: `resolved join column lost identity: u.name`; current `compileInnerTableSelect:resolveTree` maps call args using syntax operands, supporting the same ownership gap rather than a fixture count correction.

## Neighbors, scope, and unresolved results

Read `docs/research/card-s-e-c-integration-diagnosis.md` and original broad artifact `work:///cards/card-s-d-b/processes/proc-1f0a8bb19cdb/stdout.log`. Its exit 1 / 1539 of 1543 / four reds remain, not universally dispositioned. Native current fixtures establish the count independently; pre-equality chronology is not used to waive any finding.

A disposable diagnostic runner under `$SAIVAGE_CARD_WORK_ROOT/pattern-count` logs rather than asserts only the known count and joined-call failures, leaving all other assertions intact. This is **not** an acceptance test or committed weakening. It exercises all encodings: 5 native-case observations, 24 boundaries, 90 source discriminators, 9 successful compositions, 9 lifecycle cases, including limit/work/cancel/deadline and saved-error/reset/rebind. It reports the count and join divergences for each encoding. Artifact `work:///cards/card-p-b-c/processes/proc-e33d32100cb9/stdout.log`. First diagnostic attempt stopped at the joined-call error (`proc-61b543edb62e`), which is retained, not erased.

C4/REAL/formatter and Mem affected suite: `node --experimental-strip-types --test test/conformance/run-ordinary-scalars-format-ts.mjs test/select/real-column-affinity.test.mjs test/value/mem-core.test.mjs test/value/mem-numeric.test.mjs` PASS 20/20; `npm run typecheck` PASS. Artifact `work:///cards/card-p-b-c/processes/proc-59eb846e8f3a/stdout.log`.

No universal green claim, no broadened function scope, and no stopped s work resumed. This evidence report is the only owned project change.
