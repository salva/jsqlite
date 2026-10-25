# SELECT delivery phase (bounded candidate)

Base: integration-beta5 `54d1fc045b2116c6a81d1336378a8cff5eb6a409`, tree
`388fe065b90ebe0c8ef8d2b45ce5575b3522b0d5`. This is an uncommitted author
candidate, not independent acceptance. Detailed command outcomes and failed
attempts are in [[card:card-t-c]] current status and accepted v422 RED evidence.

## Source and current boundary

Pinned SQLite 3.53.4 `select.c:selectInnerLoop` (1140ff) owns DISTINCT,
sorter insertion or direct destination, OFFSET and LIMIT break;
`sqlite3Select` (8325–8358) invokes it before `sqlite3WhereEnd`, then calls
`generateSortTail` (8926). `where.c:sqlite3WhereEnd` (7520ff) owns reverse
level termination and the RIGHT interior Return before movement.

`vdbe.ts:createSelectDelivery` now owns those delivery phases for the ordinary
`compileInnerTableSelect` path. This is local compiler policy, not VM dispatch
and not a second SQL evaluator. Both production phases consume it directly.
Its input is row register range/destination, limit registers, optional DISTINCT
cursor, sorter key producer and optional positioned-row publication callback.
It neither receives nor resolves a source, WHERE loop, constraint or database.

Builder owns all registers/cursors, instruction storage and label identity.
The helper creates its producer exit and offset/drain labels using that same
builder. It allocates no runtime storage or independent program. The caller
retains expression generation, source snapshots, REAL affinity, physical cursor
position, ON/WHERE timing, selected-IN/Bloom, LEFT null pass, RIGHT Return/drain
and module cleanup. Existing single-module fast path is unchanged. The source
snapshot callback retains complete AggInfo defaults and Window's modules-only
policy; sorted publication intentionally does not invoke that callback.

One stop policy serves direct and sorted output: enclosing compound stops
remain unresolved in the caller's list, producer LIMIT/Mem/Exists exits resolve
locally. Only inline producer stops are exposed to RIGHT validation. Sort-tail
stops do not expand interior escape permission. DISTINCT receives the final
WHERE continuation address after WHERE lowering, not a guessed Next address.
Exit resolves before module close; delayed validation and finish remain in the
caller. Error propagation is unchanged: callback failure aborts compilation,
not a published partial program. Source row/source binding identity never moves.

## Decision and tradeoff

A local owner is smaller than a new module importing the large instruction
union or a generic adapter; its callback dependencies are key production and
positioned row publication, not an opaque compiler context. Merely factoring
two stop strings would leave DISTINCT/sorter/direct/drain policy entangled with
WHERE termination. Moving WHERE start/advance would instead cross the shared
WHERE owner with substantially larger state. No algorithm is substituted and
no public API, scope, quota or ordering guarantee changes. EList projection and
the remaining WHERE switch-shaped branches are intentionally unchanged; native
complexity alone does not justify splitting their semantic owners. This is a
bounded phase separation, not a claim the entire hotspot is repaired.

## Evidence boundary

New `select-delivery-phase.test.mjs` executes the actual private helper body
with the real builder/destination primitive. Five controls cover DISTINCT /
OFFSET / LIMIT order, sort insertion vs publication, empty sorter, scalar stops,
compound ownership, callback error identity, and production consumption/cleanup
ordering. Before implementation all five fail for absent owner/caller. The
existing scalar-child observer now follows the real phase owner and asserts
shared builder ops plus both phase calls; it retains the reservation, caller,
no-copy and all runtime/negative controls.

Author checks: typecheck; focused36/36; multisource RIGHT4, JSON RIGHT6,
recursive RIGHT3, visitor3, selected-IN integration1; special Window42,
aggregate Window1, mixed CTE/JSON/Window6 and CTE execution9 all pass with
zero skips. Fixtures are reused, including focused aggregate destination typed
rows/full metadata across UTF-8/UTF-16le/UTF-16be and reset. This is not fresh
native recapture or broad compatibility acceptance for those earlier checks.
The later existing integration-runner invocation freshly authenticated the
pinned oracle and generated selected-IN inputs: 17 files / 51 tests pass,
zero skips/failures, including derived/grouped/retained-limit selected-IN and
selected affinity/error/lifecycle/NULL-prefix/vector/reuse/correlated controls
across all three encodings. Typed rows, metadata, reset and negative/lifetime
assertions are unchanged. Manifest:
`work:///cards/card-t-c/select-phase-selected/integration-run/manifest.json`
(SHA256 `193c3457e06c786dd3b10c44ea06247027fddf0e59539f9955e749882b545919`).
All 13 prerequisites exit0; 55 generated inputs and source inputs have no drift.
This closes the bounded missing-input coverage gap. The earlier direct launch
still failed for absent DERIVED_SELECTED_IN_DIR before SQL execution; its
queued tail did not execute and receives no retroactive credit.

Same-config ESLint9.39.1/typescript-eslint8.48.1 scans of all57 src files:
compileInnerTableSelect455→432, total diagnostics310→310, zero errors.
The extracted owner has no complexity warning (>20). This modest hotspot
reduction is not a whole-file complexity claim. Reports: `before-eslint.json`
and `after-eslint.json` in the workstorage directory below. First baseline
launch exited2 because its external input was outside config base; placing an
identical config at the archived baseline root corrected it without changing
rules. No source was excluded. Raw reports, not warning counts, retain detail.

Additional joined-order boundary / RIGHT residual / selected-index controls
pass252/252, zero skips, including selected-IN interruption/private-byte cleanup
in all encodings. These earlier controls did not themselves close the missing
input launch; the fresh generated-input invocation above does.

Raw logs, tests-first failure, typecheck and before/after same-config ESLint
JSON reside in `work:///cards/card-t-c/select-phase/`. Current status carries
exact completed results and candidate hashes. The original analyzer owner's
[accepted a28 report](record:///status.md?card=card-t-a&v=28) supplies complete
same-config jscpd4.0.5 before/after reports for this candidate at
`work:///cards/card-t-a/select-phase-analyzers/` (`summary.json`, `inputs.json`
and both `jscpd-report.json` reports). Both report 0 clones across 54 eligible
sources from 57-file inventories; the same three unchanged short inputs remain
below min-lines10. This is evidence completion, not duplication improvement or
exhaustive semantic/subthreshold coverage. Reused ESLint records compiler
complexity455→432, function799→795, parameters8 unchanged and warnings310→310:
no broad hotspot elimination. New scans221.418+236.632=458.050s; historical
669.934s remains noncompliant as one600s batch, and cumulative1127.984s plus
incompletely measured failed attempts is neither reset nor waived. Independent
nonauthor review of the entire delta and root combined/package/browser
acceptance remain outstanding. No commit or self-approval is supplied.
