# Retained ORDER/LIMIT → outer WHERE consumer

## Source and bounded design

Pinned SQLite identity is `reference/sqlite/manifest.json`. `select.c:4343–4350`
rejects flattening LIMIT into join/aggregate or outer WHERE (8/9/19); competing
ORDER owners also prevent flattening (11). Tags0482/0488 choose coroutine versus
materialized producer; selectInnerLoop SRT_EphemTab inserts the completed child
rows before parent WHERE positioning. `wherecode.c` owns join match/null-extension
and parent predicates, not the child.

`vdbe.ts:compileRetainedFilter` binds transient source tables with existing
`transientSourceTable`/resolution metadata, allocates shared-builder private
cursors, emits `compileTableSelect` behind a coroutine or materialization entry,
and delegates parent execution to `compileInnerTableSelect` with producer entries,
retainedCursors/cursorFor and register-backed column locations.
That prevents an OpenRead of the transient descriptor, preserves resolver cursor
identity, and reuses existing FULL match/second-pass and ORDER/LIMIT owners.
No AST evaluator or SQL spelling test is introduced. Eligibility is bounded to
all-derived noncompound single-table ORDER/LIMIT children and nonaggregate,
nonwindow, non-DISTINCT parents with WHERE; other shapes keep existing paths.

Producer bodies now follow pinned InitCoroutine or callable Once/Return
materialization. The ordinary WHERE owner initializes parent LIMIT/OFFSET before
invoking them, reads coroutine columns from registers, and invokes retained fills
at scan entry. FULL replay retains its physical cursor and ensures RHS fill even
when the left input was empty. Child ORDER/top-N can still block before first
Yield, as native later-child-error controls show. The rejected9f21 eager fill
is not an accepted adaptation; [F5 decision and evidence](retained-filter-demand.md)
records the correction and remaining finite-coverage boundary.

## Native and author evidence

Accepted red: [[card:card-m-f-k]] status683, original current8b8cb451/treee3ea4cd4.
`tools/oracle/capture-retained-filter.py` loads the pinned library and independently
prepares/steps/resets/finalizes the SQL, recording all five metadata fields and
INTEGER/REAL/TEXT/NULL separately. Input images are the existing w leads native
receipt, SHA-authenticated and embedded for portable tests. Native capture
proc-505dfca3b925 exit0 uses library43f3f6090f1876601a26aa0bae0ac55ca303f9b3c201193e7102f2bfec43f793,
sourceId `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
Queries and retained outputs: `retained-filter-{queries,native}.json`.

Fourteen queries × three encodings include exact original derived-filter and
repeated retained FULL, representative LIMIT5, bound/rebound/null/exhausted OFFSET
and LIMIT, empty/NULL/duplicate rows, nocase, nested scalar projection/predicate,
unmatched FULL null-extension, invalid-column prepare error and malformed-JSON
step error. Every successful prepare has two executions per binding.
Public test compares metadata, typed rows and errors through Fetch.

proc-882509bea560 passes3/3 native/public groups; expanded resource controls
proc-a5822a06707f pass21/21. Byte/entry/work/result limit, pre-abort and zero-deadline
controls preserve first error through reset, refund observed byte budgets and
rebind/reexecute twice. Entry exhaustion recovers with LIMIT0 under the unchanged
cap; this does not claim a positive one-row fit for that cap. Live mid-fill
interruption schedules are not exhaustively verified.

proc-df7e6cc226a1 passes154/154 (no skip/fail/cancel) plus chained typecheck:
retained-filter, grouped-scalar-destination, select-scalar-child,
metadata-scalar-bind, metadata-scalar-invocation, aggregate-group-lifecycle,
json-child-readiness, recursive-cte-repeated, recursive-cte-left,
derived-values-registers. This is author mutable-workspace evidence, not
independent acceptance or root integrated replay. Output:
`work:///cards/card-m-f-k/processes/proc-df7e6cc226a1/stdout.log`.

Exact-export verification proc-5b35559bc945 passes153/153 (zero failures,
skips or cancellations) plus chained tsc using the same ten-suite command.
The mutable workspace's extra rowid test is not in that exact parent; its154
count is not the candidate's153. Separate-index assembly includes only this
repair's runtime insertion/call and guide/map paragraphs; peer runtime edits,
staged deletions and other work are excluded without alteration.
`work:///cards/card-m-f-k/processes/proc-5b35559bc945/stdout.log` retains output.

First retained-cursor implementation passed the focused native comparison;
no rejected semantic repair hypothesis. An apply_patch invocation reported no
changes and was verified not to have applied before the edit tool was used.
Earlier logging probe proc-d658e94b23d1 also shows the originals' expected rows
and passes tsc but is not itself an asserting test. Unrelated index/workspace
changes are excluded from scoped delivery, not discarded.
