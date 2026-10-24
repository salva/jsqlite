# Review27 resource-fixture reconciliation

Input: `7834751cf4bd5c2e6af6236f6b6a360e2e5146cf`, SQLite 3.53.4,
source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Author evidence, not independent acceptance. Accepted red evidence and exact
parent attribution: [status368](record:///status.md?card=card-o-c-b&v=368).

## Owning contracts, not allocation exemptions

Pinned `func.c:minmaxStep` keeps pArg and independently copied pBest;
`minMaxValueFinalize` publishes pBest before final release. The ordinary TS
`extremaDefinition` likewise keeps one best, ignores NULL, compares using the
aggregate collation, replaces only on improvement, and finalizes through
`AggregateContext`/OP_AggFinal. Its retained `new Mem()` has **no register budget
callback**; `state.bytes` is reserved manually exactly once. In contrast the
argument, expression temporaries and published/copy result registers are
budget-backed Mem. Their `copyFrom` creates independent byte backing, and
`#ownBytes` admits before replacing old backing. Thus charging retained aggregate
payload does not duplicate its charge as a register Mem. Halt/reset releases both
owners. Removing live-Mem accounting or changing the accumulator algorithm would
be the wrong correction to this regression fixture.

The old 3/6-byte test only covered the retained best. Read-only tracing of
PrivateStateByteBudget.reserve callers on the unchanged input (restored process-
local prototype, no production seam) established the following **whole-statement**
peaks. They are representation/query-specific, not native allocation minima:

| Existing witness | old payload-only cap | actual peak | live ownership at decisive admission |
|---|---:|---:|---|
| min(a) TEXT |3|9|three independent 3-byte published/input/copy register backings at output; retained best was independently charged during stepping|
| max(CASE short then longer) |6|31|final/result copies add 6 at used13, then at19 and25; expression/input registers remain live|
| min(CASE longer then short) |6|19|first input and CASE backing12 + retained best6, next 1-byte replacement admitted before old backing release|
| max(CAST(a AS BLOB)) |3|12|cast destination admits3 at used9 while old destination/input/retained best coexist|

Tests retain original SQL, typed results and reset replay, add peak−1 rejection
for every witness, exact peak success, yielded live ownership, done-time zero
ownership and cumulative charged==refunded. Error reset must preserve the same
error object; admission after cleanup remains exercised. The historical cap2
negative remains, but accepts the owning live-Mem total-byte-limit diagnostic
rather than wrongly insisting the aggregate reserve is the first failure.

Trace evidence: proc-47381229d88d (all reserve callers and used-before values);
summary proc-30480b240135 and raw snapshots proc-32a078cc699c. Output URLs are
retained in the current card status. These are author diagnostics, not native
allocator parity or all-composition fidelity claims.

## Selected INNER automatic storage

The first CROSS JOIN query still streams with all three private caps zero. The
second query in the same test selects an automatic covering index. TS
`compileInnerTableSelect` emits Once/OpenAutoindex/build and optional Bloom;
VM opens PrivateBlobkeyPages, which reserves real scratch before publication.
Pinned `where.c:constructAutomaticIndex` emits OP_OpenAutoindex (line1180),
KeyInfo, optional Bloom, scan, MakeRecord/IdxInsert. This is used storage, not
an unused window snapshot/open. A zero cap must reject that selected path with
cleanup, not silently substitute a different scan to meet a stale fixture.
The test now keeps the zero-budget rejection and separately executes the
selected path under normal capacity, requiring actual build and full refund.

Fresh pinned-shell `sqlite_source_id`, EQP and public SQL on the fixture selected
by CURRENT.json (proc-adb77d538a58) show SCAN b, Bloom a(y), AUTOMATIC COVERING
INDEX a(y), rows `(3,1),(13,1)`. The formerly unreachable expected `(23,1)` was
obsolete for this selected access order. No ORDER BY guarantee is added; the
fixture follows this source-selected path, not arbitrary SQL ordering. No runtime
planner/cursor algorithm or cap changed.

## Chinook accounting

Typed rows, metadata and selected access counters were already correct. Test
asserts its original intended counter subset, plus done-time Mem/scratch/page/
owned release and positive, balanced charges. Replay verifies the same selected
counters and balanced release, not equality of execution/owner identity or a
closed diagnostic object schema. No accounting field is removed from production.

## Applicability

These are bounded prior-regression **test-owner** reconciliations. Both resource
failures reproduce on exact ea41e61f parent; no blanket WHERE/Mem/aggregate
refactor is justified by them. Initial author rerun39/40 uncovered the previously
masked stale INNER rows; the pinned comparison above resolved that assertion.
Fixture-dependent checks, final command results and commit identity are recorded
in current status, not implied by this source comparison. Review27's216/502
passes and earlier package/browser receipts retain their stated scope. No whole
matrix, beta5 or independent acceptance is claimed.
