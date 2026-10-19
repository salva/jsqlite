# Provider R1/R2 correction evidence

Follow-up to [original delivery](card-q-a-b-provider-repair.md), independent [[card:card-q-a-c]] status42. Original implementation8c6d059996fc7d18f57fa2ad51102230cb860713/doc45cbcbef813a3399aec4d03b6cffc94c6f5c6818 selected green checks did not cover these branches. Pinned source SQLite3.53.4 source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.

## R1 owning branch correction

Read date.c:strftimeFunc1415–1435 alongside evaluateDateTime. Native obtains argv[0] text and returns on NULL before isDate; TS had parsed now/modifiers and reached notPure before format conversion. Move format coercion/NULL return before date parsing; reuse converted format in formatting. No generated SQL special case, provider exemption or VM argument-evaluation suppression.

Native-first expanded generated matrix adds NULL now/subsec/localtime and nonNULL localtime neighbors. Generator constructs development-only catalog witnesses, reopens them, and captures full typed rows/metadata/error/DONE from pinned library; public runner matches54/54 observations x2 executions/three encodings. All12 added observations zero-credit. Ordinary provider runner adds NULL-format now/subsec/localtime/utc with counts0/reset/two executions and nonNULL saved-error control. Failure runner adds thrown clock/cancellation short-circuit controls, repeated successful NULL runs and nonNULL exact cancellation/error identity (108 checks versus87). JS private provider failure cases are representation-boundary tests, not native struct-tm parity.

## R2 actual costs, not waived charges

Unchanged old bounded runner fails on exact candidate (`proc-41c95d41c6c6`); base passes per independent proc-4c3c21d62a28. Disposable candidate instrumentation `proc-fd7dec473ff8` logs executed opcode work positions: Goto1, Goto2, Once3, Variable4, Function5, Goto14, Copy15; work23 then blocks ResultRow. Instrumentation restored immediately; shell exit0 there is restoration success, **not** passing test (inner test exits1).

For hex(?1) on1024 ASCII chars: eight executed ops to ROW (three Gotos, Once, Variable, Function, Copy, ResultRow), input4 + hex scan4 + copy8 =24. Base had seven ops/23. Source expr.c constant-function factoring legitimately adds Once; vdbe.c counts Once and Goto normally. No runtime accounting change needed or made. Boundary updated from22-fail/23-row to23-fail/24-row; retains exact saved-error identity, reset/rebind/reuse, cancellation/deadline, output/preflight and all-encoding column controls. This is a finite implementation-cost test, not a guarantee that arbitrary SQL retains its old opcode count.

## Commands/results

`proc-09732147d24f` guarded exit0:
- `python3 docs/research/card-q-a-b-generated-matrix.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" "$SAIVAGE_CARD_WORK_ROOT/provider-nullfmt-fixed"` prints pinned source identity and54 observations.
- isolated candidate (prior archive plus exact scoped changed source/tests) `npm run typecheck`, `node --experimental-strip-types test/conformance/run-expression-bounded-ts.mjs`, generated-matrix runner with above directory, provider runner: all pass.

`proc-0a545dcb2785` guarded exit0 on same isolated inputs: failure108, package boundary, manifest29/29/public date120/3, math22/66, Once21, real-task entry, registration15, node47/47 sum/REAL/FROM-/expression-subquery/seams and IN63/63 credit0. Output `work:///cards/card-q-a-b/processes/proc-0a545dcb2785/stdout.log` retains full results. Focused tests are author evidence, not independent acceptance. Broader schema/function/constant-walker equivalence, host tzdata parity and release acceptance remain unclaimed. Shared peer edits/ref/index preserved. Existing corpus29/29 and120 observations unchanged.
