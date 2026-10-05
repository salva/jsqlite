# Selected rowid multi-index OR: preconsumer handoff

## Final bounded report

**Conclusion: supported as a preconsumer decision/evidence delivery only.** Accepted
exploration (status v4) and assessment (status v7) for [[card:card-s-f-a]] support
handing this proposal to the Planner/Reviewer of [[card:card-s-f]]. They do not
approve its technical decisions or establish selected TS runtime fidelity, parent
acceptance, or compatibility credit. Evidence artifacts are in commit `7e38a7e`;
this final report incorporates the accepted assessment without rerunning tests or
starting implementation.

### Evidence

The assessment checked capture source identity against the pinned manifest,
fixture sizes/SHA-256 values in all three encodings, case counts, and native
MULTI-INDEX OR/RowSetTest presence for every selected binding run. The inventory
contains 66 case/encoding records: 0 exact, 21 adapted, 45 supplemental. Each
encoding includes 24 successful binding executions plus one expected prepare
error; case counts and execution counts are distinct. Retained revision-bound
results are native capture exit 0, active TS suite exit 1 (24 pass/45 fail),
existing focused WHERE tests 33/33, and typecheck exit 0. The original 21-pass/
48-fail run remains retained, including the declaration-metadata discrepancy.
Source comparison confirms exact ordered cost-slot behavior, including the pinned
full-slot smallest-rRun branch and minimum-nOut retention.

### Inference

The tested TS revision lacks selected OR production: three handoff assertions
observe table-scan rather than multi-or; 42 selected public tests reach missing
physical branch work after first-run rows/types/metadata compare successfully.
The clause-owned analysis, shared-budget cost collector, shared-builder Case5
continuation and translated RowSet proposal is therefore an actionable bounded
implementation handoff, not proof that deeper execution assertions already hold.
Native selected paths provide an independent target, not a substitute runtime.

### Limitations and uncertainty

- Deeper root/batch/dedup/sorter assertions and later selected rebind/clear runs
  short-circuit on missing selection. Their presence in test code is not coverage.
- Native Python binds `2.0` as REAL, whereas JSON numeric bindings erase that
  distinction and the TS test converts integral numbers to BigInt. That later
  rebind run is not a same-storage-class oracle comparison. Native typed result
  cells and observed first-run missing-selection failures remain valid.
- The root trace assertion deduplicates with Set: it proves unique roots and
  first-occurrence order, not the full repeated-arm branch-open sequence.
- Uppercase INT fixture adaptation avoids the recorded lowercase declaration
  metadata mismatch; it neither repairs nor disproves the underlying discrepancy.
- Internal native RowSet harness, exact cost/budget unit branches, middle batches,
  `IS ?`, lifecycle/limits/cancel/deadline/yield/error cleanup, selected/offpath
  corruption, cross-page movement, rowid affinity and borrowed-value liveness
  remain outstanding. Join/WR public controls do not prove every provenance-based
  selection refusal. Historical cost-only seam reconciliation remains unresolved.
- Private representation/counter names, P4 shape, bounded recursion and selection-
  only deferrals are proposals. No exceptional substitution is justified or sought.

### Recommendations and delegated obligations

Planner/Reviewer should decide the tagged clause/union continuation and RowSet
ownership before consumers, and allocate the implementation/acceptance matrix
below. Preserve previously admitted scan semantics for deferred WR and unsafe
nullable-join selection, RIGHT/FULL fallback, distinct OR-IN ownership, and the
shared construction budget. Before claiming parameter equivalence, tag native/TS
binding storage classes and add a storage-class-sensitive REAL-integral versus
INTEGER discriminator. Before claiming branch-sequence fidelity, retain the full
executed root sequence and assert repeated-arm order/counts. Review private field
names together with the chosen handoff rather than exposing public diagnostics.

All exhaustive safety/physical/control obligations listed below remain delegated
implementation-stage work, not waived gates or claimed executed coverage. No
runtime implementation or evidence promotion occurs in this report; approval and
parent/project acceptance remain with their respective owners. Detailed source,
case, command, hash and log inventories are linked below rather than duplicated.

Decision proposal for [[card:card-s-f]], authored by [[card:card-s-f-a]]. This is
**preimplementation evidence**, not repair of accepted ordinary WHERE/index
[[card:card-s-b]] or ordered insertion [[card:card-s-d]], and not goal acceptance.
Planner/Reviewer approval is requested for the bounded handoff below. No runtime,
public API, native runtime dependency, or optimizer-wide gate is added.

## Authority, provenance and current comparison

SQLite **3.53.4**, source ID `2026-07-24 19:02:57
bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`, archive/hash
in [manifest](../../reference/sqlite/manifest.json). Inputs read: AGENTS,
SPEC/PLAN, TRANSLATION core/shared representations/lifecycle/WHERE, API current
admission, source-map WHERE, mutable fidelity audit baseline and W1/W2 revision.
Audit's scan-only W1/W2 prediction is historical, not current ordinary-index fact.
Guide/map row-width and repeated-join pending labels are stale against the
accepted-parent provenance supplied by Planner; this decision does not reopen
those outcomes or use those labels as gaps.

Current production comparison (initial workspace HEAD
`1ddaa7b6f45202d662e922e72a6da9086050c4c3` plus unrelated staged/dirty work):

- `where-plan.ts:analyzeWhere` splits AND, analyzes simple comparisons and virtual
  commutations; an OR expression remains a full residual with null operator.
  `WhereOperator` has no OR/AND semantic variants; `WhereLoop.kind` is only
  table-scan/rowid/index. `planWhere` has shared 20000+1000/source construction
  budget and a statement-wide RIGHT/FULL fallback. No reachable multi-OR owner.
- `compileTableSelectProducer` calls `planWhere`, retains selected physical
  admissions, emits seeks/ranges/deferred positioning, then residual/projection
  and `sqlite3WhereEnd`; `FullScanPlan.loopStart` includes positioning. Joined
  `compileInnerTableSelect` has its own selected-level emission using the same
  shared `SelectProgramBuilder` and physical capability contract. Both callers
  must consume the new union level, not independently rediscover OR syntax.
- A source-map/research cost-only seam is not execution credit. A repository
  source search found no `WhereOrSet`/`whereOrInsert` in current production
  where-plan sources; any historical cost helper must be reconciled before reuse.
  This deliverable neither asserts an existing reachable cost seam nor invents one.

## Pinned source ownership and exact branches

Paths relative to `reference/sqlite/sqlite-src-3530400/`:

| Source | Producer/consumer relationship to translate |
| --- | --- |
| `src/whereexpr.c:559–967` `whereCombineDisjuncts`, full `exprAnalyzeOrTerm` | Attach OR clause even if not indexable; recursively analyze split disjuncts; single comparison/commuted/copy controls versus AND-owned clause; intersect per-arm cursor masks, union within AND. Two-disjunct inequality combination creates a virtual necessary conjunct, not a replacement for full truth. Same-column equalities may create a virtual IN child with affinity checks and transferred join markings. |
| `src/whereInt.h:179–193,370–386,426,624–625` | `WhereOrInfo` owns nested clause/indexable mask; `WhereAndInfo` owns nested clause; `WO_OR`/`WO_AND` differ from index admissions; `WhereOrCost={prereq,rRun,nOut}`, `N_OR_COST=3`; builder `pOrSet` switches candidate insertion to cost collection. |
| `src/where.c:196–239,whereLoopInsert:2840ff,4811–5035` | Ordered OR cost insertion/move, builder cost-only mode, recursive/direct/AND exploration, accumulated cost products, ordinary insertion and shared construction-limit/cleanup. |
| `src/wherecode.c:2229–2566` Case5 | Separate recursive sub-WHERE scans call one shared body through Gosub/Return; RowSetTest excludes earlier-arm duplicates before body; deferred seeks, untested terms, covering identity and factored conjunct ownership survive the recursive handoff. |
| `src/where.c:sqlite3WhereEnd` (including 7680–7785) | Reverse loop unwind, LEFT unmatched continuation through Gosub, common-index reopening/null-row and column rewriting, RIGHT drain ownership. |
| `src/vdbe.c:1119–1165,7402–7453`; `src/rowset.c` (full file) | Exact PC return semantics; lazy RowSet creation; first/middle/final batches; linked list sort/merge, forest promotion/search and destruction. |

**Do not use generic Pareto pruning.** `whereOrInsert` scans existing slots in
stored order. New cost <= old and new prereq subset replaces the **first** matching
slot; otherwise old cost <= new and old prereq subset discards immediately.
Append initializes nOut while fewer than three slots exist. On full capacity the
literal pinned loop starts at slot zero and replaces its pointer when current
rRun **>** examined rRun, selecting the smallest encountered rRun, not an assumed
"worst" maximum. It then discards if chosen rRun <= new. Preserve this arguably
surprising exact branch rather than correcting it from the prose comment.
Replacement writes prereq/rRun and retains min(old nOut,new nOut), including on
full-slot replacement. Move copies active slots and n exactly, not sorted order.
Test ties, differing prerequisites, first-match replacement, full-slot discard,
append and min-nOut independently of final SQL rows.

`whereLoopInsert` checks/decrements the builder construction budget before the
pOrSet branch; exhaustion clears that set and returns DONE. Only constrained
(nLTerm>0) loops contribute cost-only alternatives. Cost-only proposals do not
enter the ordinary candidate list. `whereLoopAddOr` rejects JT_RIGHT, copies
builder with pOrSet, resets sCur for each actual arm, explores Btree then recursive
OR, and abandons a union if any processed arm has zero alternatives. First arm
moves to sum; later arm products union prereqs and use LogEstAdd for run/output,
then bounded insertion. Final union has one parent OR term, setup=0, sort identity
0, cleared Btree union state, run=sum+1. Ordinary insertion remains the accepted
owner. AddAll preserves source increments, later-source continuation after DONE,
and final template cleanup. The TS budget must remain one mutable builder-owned
reference across copied recursive contexts, not be reset per arm.

## Proposed immutable representation before consumers

1. Extend the clause/term semantic graph (not `IndexConstraintAdmission`) with
   tagged OR/AND info. `OrInfo={parentTerm,clause,indexable}`; `AndInfo={clause}`.
   Retain expression, original ON/WHERE provenance, outer clause link, base/virtual
   boundary, commuted/copy/parent-child identity and dependency masks. Clause-local
   IDs alone are not globally unique; carry owning clause or stable term references.
   Single-index admissions keep their existing precise operator type; OR is not
   fabricated into an equality admission. No SQL-string recognizer.
2. Add builder-local mutable three-slot `WhereOrSet` cost state and source-mapped
   insertion/move. Published terms/loops remain immutable. Nested proposal
   iterators are closed on DONE/error; no eager arm capability inventory bypasses
   the accepted construction budget. Cost sets do not pretend to select physical
   branches: Case5 replans each arm in its branch context.
3. Add `WhereLoop.kind='multi-or'`, `orInfo`, parent term, prereq/run/output,
   setup=0/sortIdentity=0. Add a lowering-owned `OrLevel` with shared source cursor,
   branch index cursor, RowSet register, rowid register, return register, common
   body/continue/break labels, branch sublevels and untested-term aggregation.
   Ordinary capability is null on union, not a fake index capability. Physical
   identity/admissions come from each branch's subplan.
4. Add a statement-private RowSet owner (suggest `src/internal/rowset.ts`) used by
   VM Mem/private-state. Entry nodes contain BigInt rowid and left/right links;
   owned allocation chunks, pending entry/last, forest, flags and batch follow C.
   Translate linked mergesort buckets, list↔balanced-tree transitions and forest
   search. Accounting may use logical entry/chunk byte sizes rather than JS heap
   exact bytes; declare and test the charged bound. No JS Set substitution is
   proposed: it loses batch invisibility and source state/control relationships.
5. Case5 emits into **the enclosing SelectProgramBuilder**, sharing registers,
   labels, parameter builder, destinations, LIMIT stops and cursor allocator.
   Translate body calls/continuation, no materialized rowid union iterator or
   parallel SELECT evaluator. Current scan return object must become a tagged
   ordinary/OR continuation owner so End emits Return for union, not Next.

### Bounded admission decisions

First selected tranche: represented immutable **rowid tables**, existing ordinary
persistent-index and rowid branch capabilities, direct and AND arms, nested OR
when each recursive branch is admitted and construction succeeds. Recursion uses
existing expression/depth safety admission and shared proposal budget; hitting
selection/construction bounds declines this optimization and preserves the
previously admitted semantic scan. It must not become a new SQL prepare rejection.
No arbitrary smaller depth limit justified as a browser necessity.

OR-to-IN is a distinct path. Retain the original residual and virtual child/join
markings. Translate analysis/affinity proof; do not select IN child unless the
existing IN semantic/lowering contract applies. Otherwise decline the optimization
without rejecting formerly admitted OR. Same-column equality controls are not
credited as selected multi-index OR. Two-way virtual range combines similarly
retain full OR truth.

WR ephemeral composite-PK union is deferred **selection**, not rejection of
ordinary admitted WR OR filtering. Preserve `NOT INDEXED` primary-layout control.
For this first tranche conservatively decline selected OR on LEFT ON/nullable
provenance until its return/null-row/factoring proof is implemented; also preserve
statement-wide RIGHT/FULL fallback, strictly including pinned JT_RIGHT exclusion.
LEFT ordinary scan semantics remain admitted. No index obligation may be silently
ignored for INDEXED BY; preserve existing forced-index validation/error contract.

### Lowering and runtime lifecycle controls

- Initialize RowSet Mem to NULL once per union invocation (including each outer
  row), and return address to safe fall-through before any branch. First batch 0
  inserts without test; middle tests prior batches then inserts; final -1 tests
  without insert. Pending inserts within the same batch are **not visible** to
  tests. Each branch already enumerates each rowid at most once. New-batch
  promotion sorts only when needed, merges forest carry slots and preserves
  ownership. NULL cleanup destroys RowSet and releases charges once.
- Gosub stores its own PC; Return resumes after call, leaves register unchanged;
  P2 is formatting only, P3 conditional behavior remains respected. Async yield
  must retain branch cursor, forest, return PC and current row lifetimes.
- Finish each sublevel before next branch; duplicates jump to branch continuation
  not union exit. Empty branch must not skip later branches. Transfer deferred
  seek requirement; invalidate base row caches on every new target. Projection
  cannot retain borrowed page/index values across repositioning; copy when needed.
- Full residual stays unless every branch tests it at the proper readiness phase.
  Case5's factored conjuncts exclude virtual/coded/slice and subquery expressions;
  never hoist nullable ON truth into WHERE. Branch-local subquery/index references
  must not leak to a different physical index. Union index-only covering is only
  possible if every branch agrees on the same physical index/cursor and needed
  fields; distinct-index fixture requires safe base-table reads.
- No physical ORDER proof from OR, even if every branch is individually ordered;
  existing typed sorter/ORDER/LIMIT owns final result order.
- Growth admission, test/promote/sort/merge/search and branch-control work are
  charged/checkpointed through existing work/private-limit/cancel/deadline/yield
  owners. Partial allocation failure must preserve the primary execution error,
  destroy union/sublevels once, invalidate current row, and let reset clean then
  rethrow saved error. Reset preserves bindings, clears union state/counters;
  clearBindings replaces keys; finalize/connection close destroys children.

## Executable native-first evidence and denominators

[Capture](card-s-f-or/native.json),
[producer](../../test/conformance/capture-or-rowid.py),
[active intentionally red TS acceptance](../../test/conformance/or-rowid-red.test.mjs).
Three fixture DBs under `test/fixtures/or-rowid`, independently created by pinned
native SQLite then reopened READONLY for queries. Source/version checked before
setup. Each case captures typed cells (integer strings, REAL IEEE-754 bits, text
UTF-8 hex, blobs, NULL), result metadata, prepare error, full EQP/opcode program
including RowSetTest P4, and native fullscan/sort/VM counters. Rebind uses the same
native statement with reset/clear each run; TS likewise. All three database
encodings are exercised. Development oracle only, not shipped runtime.

22 logical cases × 3 encodings = **66 native captures**; **0 exact**, **21 adapted**
(7 logical), **45 supplemental** (15 logical). Exact is zero because upstream
Tcl/status orchestration is not reproduced verbatim. where7-1.2/1.3/1.5/1.6/1.7
use literal upstream SQL/setup with table rename; where9-1.2.1 uses its original
99-row NULL/index data with table rename; select1-8.1 uses isolated two-row setup
and uppercase declared INT for canonical native/TS metadata. These are adapted
read-only cases, not a claim to run whole where7/where9/select suites.
Supplemental IDs/sql/selection requirements/runs are fully enumerated in capture.
69 active TS tests = 66 public assertions + 3 production handoff assertions.
No new conformance allocation or TS credit is requested.

**Results:** native captures all succeed (including expected missing-column
prepare error). 14 selected logical cases have verified native MULTI-INDEX OR and
RowSetTest in every encoding (42 captures). Unselected cases retain controls.
Final TS run: **24 pass, 45 fail**, exit 1: 42 selected public assertions fail
at distinct branch index seek requirement after rows/types/metadata pass; 3
production handoffs fail because selected kind is table-scan, not multi-or.
This is the expected missing execution, not passing compatibility evidence.
Initial run was 21 pass/48 fail: select1 metadata also differed (`int` vs `INT`).
Fixture declaration was changed to uppercase INT and recaptured, not normalized
away in assertions or patched in runtime. Both run outputs retained below.
Rebind selected assertions currently stop on first missing work assertion, so
later TS bindings/clear are **not yet exercised** on that selected test. Native
captures include all runs. Do not infer covered TS lifecycle from test text.

Commands (workspace; disposable build/intermediates in card work root):

```sh
sh tools/oracle/build.sh > "$SAIVAGE_CARD_WORK_ROOT/or-build.log" 2>&1
python3 test/conformance/capture-or-rowid.py "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
node --experimental-strip-types --test test/conformance/or-rowid-red.test.mjs
```

Exact fixtures/hash inventory and run output are in
[verification](card-s-f-or/verification.md). Scope-preserving source typecheck and
existing focused insertion/analysis tests are recorded there separately. Intentional
red suite is not added to ordinary package scripts before implementation.

## Implementation versus acceptance handoff (approval requested)

No all-optimizer gate. Existing tests and accepted ordinary routes must remain
intact. Suggested bounded ownership/tasks:

| Owner/task | Source-faithful implementation obligations | Acceptance test location and required discriminators |
| --- | --- | --- |
| WHERE producer/cost owner | tagged nested analysis, OR-IN/range virtual children, exact 3-slot costs, recursive shared budget, JT_RIGHT exclusion, unselected fallback | Extend `where-plan-analysis.test.mjs` / `where-plan-ordered-red.test.mjs` or new `where-or-plan.test.mjs`: copied/commuted masks, nested AND/OR, nBase/parents, ties and min-nOut, full-slot odd branch, budget exhaustion closes later-index access and continues next source. No native plan identity claim for every query. |
| RowSet/VM owner | chunk/list/forest/batch algorithms, lazy Mem owner, opcode semantics, charges/error cleanup | New `rowset.test.mjs`: signed int64 extremes, unsorted/equal insertions, same-batch duplicate invisibility, empty promotion, multiple forest carries, final no insert, clear/reset destruction and allocation failure. Native C harness against pinned rowset.c remains to obtain for these internal unit observables. |
| Ordinary/shared lowering owner | Case5 subplans/shared body labels, Return continuation, deferred value liveness, full residual, sorter, no selected WR or unsafe join provenance | `or-rowid-red.test.mjs` has public typed/metadata/error/control tests, active selected handoff and proposed private counters `orBranchStarts`/`orDuplicateSkips`/`orBranchRoots`. Active red tests require **distinct loaded oa/ob roots** and executed private branch-root sequence, first/final P4 and patched duplicate targets. Extend these with admission KeyInfo and middle-batch proof; no public diagnostic API. Same-index OR and rowid branches need separate tests. |
| Execution safety/acceptance owner | all new work/growth checkpoints and private ownership wired to existing engine lifecycle | New `or-rowid-lifecycle.test.mjs` leveraging `relational-private-lifecycle.test.mjs`/advanced-index fixture helpers: limits during each batch promotion/merge and body, preabort and asynchronous midbranch cancel/deadline/yield, result/row limit, primary-error ordering, reset rethrow then reuse, finalize/close while suspended and zero leaked private charges. Native VM counts are evidence not exact TS checkpoint parity. |
| Storage/physical branch acceptance | preserve page-local cursor invariants and typed seek owners | Extend advanced-index/corruption tests with selected branch-root or payload damage (CORRUPT11) vs offpath damaged unrelated index (query succeeds), empty seek/next boundaries, cross-leaf range movement, DESC/composite prefix, noncovering DeferredSeek cache invalidation, REAL integral storage tag and rowid-affinity REAL/text keys, borrowed BLOB/text snapshots across branch/yield/reset. |

The last columns are **outstanding implementation-stage obligations**, not executed
coverage in this preconsumer tranche. Small capture fixtures do not prove
cross-page movement, internal allocation/work limits, borrowed-value liveness,
same-batch RowSet behavior or cancellation. New tests intentionally name private
handoff/counter fields that must be reviewed and implemented, not public contract
expansion. Native LEFT/RIGHT/FULL controls and WR NOT INDEXED filter already have
passing public semantic comparisons; they do not prove every selected fallback
provenance branch is refused. Strengthen these with plan absence assertions before
selected consumption lands. NULL IS NULL is captured; `IS ?`, unlike `= ?`, is a
separate remaining selected test. OR-IN and recursive cost behavior require unit
branch proofs beyond these public examples. Index affinity/collation controls here
are bounded, not full compatibility for all expression/partial index branches.

Required assessment: approve tagged clause/union continuation and RowSet default,
review selection-only deferrals/recursive shared-budget behavior, and allocate the
precise follow-on tests above. Missing native machinery is an implementation gap,
not a browser reason to replace the algorithm. No exceptional substitution is
requested, and no owner-scope change is proposed.
