# Provider repair — partial author evidence

Source SQLite3.53.4: `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.

The original architecture assessment is [provider-admission](card-q-a-a-provider-admission.md).
Current repair extends `resolve.c:1239` Expr.op2 self-reference context via
ResolvedExpressionCarrier into call expressions; the single-table binding path
retains its generated expansion context too. Shared lowering emits PureFunc with
P5 generated context. FunctionContext owns sqlite3NotPureFunc-style rejection;
date.c430/437/810/837/1118 reached branches invoke it, not a blanket name ban.
Removed date modifier catch-all, which would otherwise swallow the new VM error
(and cancellation); provider exception handling remains at the local adapter.
No stored-column recomputation, new backend or public callback.

Native-first command in `proc-cb7a39a63f12`:
`python3 docs/research/card-q-a-a-generated-probe.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" "$SAIVAGE_CARD_WORK_ROOT/provider-repair/generated.db"`.
Native literal succeeds, dependent now errors exactly `non-deterministic use of datetime() in a generated column`. Public diagnostic before reached checks returned a row and clock1; after correction (`proc-2dee8f97997d`) exact error and clock0. This is zero-credit diagnostic evidence, not a conformance denominator change.

`proc-8336dcb0ebd9` guarded chain exit0: `npm run typecheck`; new `run-date-time-generated-ts.mjs fixture.db` (3 saved-error/reset error paths including join and child, 3 literal/unreached controls); provider runner (three encodings/two executions); seams4/4. Earlier strip-only parameter-property syntax failure and exactOptionalPropertyTypes failure were fixed before this run. Date runner120/3 passed in `proc-2dee8f97997d`. Inputs are shared dirty workspace; no clean candidate or independent acceptance claim.

## Additional failure ownership and registration evidence

Native-first `proc-b6829553349e`: compiled `card-q-a-b-clock-failure-probe.c`
against the already pinned static oracle. First VFS acquisition errors; native
returns NULL, then TEXT/TEXT in the same row with two acquisitions. This exposed
a further owning-primitive defect: TS cached the failure sentinel. VDBE now caches
only successful acquisition; Once still owns each constant call result. Shared
invalidDateTimeClock names the private sentinel, not a second clock.

Native `proc-b0b8b025f20c` rejects CURRENT_TIMESTAMP/sqlite_version/random even in
an unreachable CASE branch, but accepts literal datetime. `resolve.c:1222-1240`
registration flags own this distinction. Generated carrier construction now checks
the builtin constant flag recursively, retaining reached PureFunc checks for date.
Two initial TypeScript terminal-representation mistakes failed typecheck
(`proc-65259ce28279`, `proc-da7ccdce80b4`); actual Lemon terminal.value fixed them.
No broad schema/name ban or stored recomputation was added.

`proc-b5b0483014a2`: native-first `card-q-a-b-registration-fixtures.py` creates
15 fixtures (5 expressions x3 encodings) and confirms exact corrupted-schema code11
and message for4 cases, literal success for1 per encoding. `proc-98cc739d505f`
public runner matches. `proc-c8a43ad39d04`:87 public private-boundary checks/3
encodings pass clock null/nonbigint/range/failure retry, malformed civil tuples,
safe year, local failure, propagated exact cancellation/saved-error identity,
valid leap day and UTC bypass. These are zero corpus credit; malformed JS tuples
have no native struct-tm equivalence claim.

Final guarded chain `proc-3c9f382c9506` exit0: typecheck, package-boundary,
date manifest29/29/date120 over3, math22/66, failure87, registration15;
47/47 node tests covering sum, REAL, FROM-/expression-subquery and seams4;
IN runner completed successfully (full output retained at
`work:///cards/card-q-a-b/processes/proc-3c9f382c9506/stdout.log`). This is shared
dirty input evidence, not exact isolated candidate or independent acceptance.

## Constant walker and reached-generated follow-up

Native-first `proc-7508465d9279`: `card-q-a-b-generated-matrix.py` uses pinned
library to produce42 observations/three encodings with full column metadata,
single/join/derived/scalar-child/compound error destinations, nested generated
columns, omitted/subsec/utc, literal/unreached/empty controls and physically STORED
columns whose changed expression must not be evaluated. `proc-e6d622c16efe`
public runner matches42/42 with two executions/reset per case, exact saved errors,
clock/local provider0. Fixture/native receipt is card-work `provider-matrix/native.json`,
reproducible from the generator; no corpus credit or public write support.

Native-first `proc-fce9e4b33538`: `card-q-a-b-once-probe.c` shows CASE, simple CASE,
iif, BETWEEN and IN arguments factor into Once, but volatile CASE and scalar
subquery do not. Source expr.c:exprNodeIsConstant defaults to child traversal;
TS helper had omitted CASE/BETWEEN/IN/vector and thus incorrectly resampled now
on successive rows. Shared emitter now walks those admitted children and retains
column/register/subquery/volatile exclusions. Native probe rerun with exact recursive
CTE in final chain agrees. `proc-ed2da508cf68` first public runner hit an unrelated
retained VALUES-derived destination temporary unsupported prepare; changed fixture
shape to the already admitted recursive CTE rather than expand schema/execution
scope. `proc-3d402f5eae37`21 cases x2 executions/3 encodings pass.

`proc-7e419ae6f836` new entry runner delegates original real task completion and
asserts at least one task after the initial clock sample, one acquisition for
multiple Function calls/subquery within that entry, reset refresh and independent
statements across three encodings. It does not assert portable timer fairness.
Final guarded `proc-82244946e57c` exit0 repeats native Once, type/package,
date29/29+120/3, math22/66, generated42, Once21, entry controls, provider/failure87,
47/47 sum/REAL/subquery/seam tests and IN63/63 (credit0).
Full output `work:///cards/card-q-a-b/processes/proc-82244946e57c/stdout.log`.

## R1/R2 follow-up

Independent review found NULL-format ordering and an unadjusted finite-work
boundary on this delivery. Both are corrected with native/public regressions;
see [current correction evidence](card-q-a-b-provider-r1-r2.md). Earlier selected
passing results below are revision-bound, not evidence those gaps were absent.

## Scoped delivery and verification

Unreferenced implementation commit `8c6d059996fc7d18f57fa2ad51102230cb860713`,
parent `a379c686f8057ad1354379c22460b64865df2637`, contains21 scoped files.
`work:///cards/card-q-a-b/provider-delivery/manifest.json` records included file
SHA256s, selected original hunk offsets, base/tree/commit, patch SHA256 and shared
index SHA256. All unrelated JSON/aggregate/planner removals and other peer guide
edits were excluded. Shared HEAD/ref/index were not promoted or overwritten.

Exact git-archive candidate checks `proc-8e0d61a2f92d` pass type/package/provider,
generated42/42, Once21, real-task entry and failure87 diagnostics. Exact archive
`proc-1163db0a4363` passes date29/29 with120 observations, math22/66,
node47/47 sum/REAL/FROM/expression-subquery/seams, IN63/63 credit0. Scoped
commit diff check passes. These are author evidence, not independent acceptance;
shared workspace remains dirty. No wider schema/function/constant-expression
exhaustive equivalence claim. Selected corpus denominator29/29 and120 observations
are unchanged, all new diagnostics zero-credit. Independent review is still needed.
