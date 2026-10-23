# Bounded RIGHT/FULL matched persistent access

Author repair on parent f6ae8c3dfc9963b1a8f0aa02c60b8dee7784734d; current delivery and final checks are recorded in [[card:card-s-c-d-e]] status. This is not nonauthor or whole-product acceptance.

## Source owners and boundary

Pinned `where.c:constraintCompatibleWithOuterJoin` (823ff) admits only ON terms owned by the accessed outer-join RHS; WHERE cannot restrict matched access before null extension. `whereUsablePartialIndex` (3703ff) rejects LTORJ and requires outer ON for FULL RHS implication. `whereLoopAddAll` (4940–5023) carries mPrereq/mPrior across LTORJ/RIGHT barriers. The bounded two-source rowid route retains physical source order, stamps RIGHT ON as outer ON (including derived term ownership), disables WHERE drive and LHS drive, and preserves original prerequisite masks. Existing partial proofs now require owned outer ON on RIGHT as on LEFT. No non-null WHERE simplification or wider reordering is claimed.

Pinned `where.c:7394ff` allocates exact pRJ identity, and `wherecode.c:2740ff` extracts physical RHS rowid/full PK before Found/IdxInsert and downstream WHERE. The selected rowid caller uses its physical index rowid-tail field, not an unfetched deferred primary cursor's cached Rowid. It retains ON-before-match and match-before-WHERE. RHS expressions still use the primary reader, with existing DeferredSeek and the separate unmatched drain. No new evaluator, match algorithm or whole-plan abstraction. Complete WR/module identity and repeated barrier execution remain unchanged fallback, not selected credit. Two tables/no USING is a bounded implementation slice, not a browser necessity or scope exclusion.

## Evidence

`right-matched-capture.py` independently loads the pinned native library and verifies manifest SourceID. `right-matched-native.json` binds SourceID, library SHA and exact fixture SHA. Initial successful 81-case capture preceded runtime edits (proc-163e7d70323f); extended 108-case capture added overflow controls (proc-df5e47135e23), before their test consumption, using the same authenticated library rather than a new build. Each encoding has INNER/RIGHT/FULL × no WHERE / RHS rejection / LHS NULL / required overflow × unforced/forced/NOT INDEXED, five metadata fields, typed rows and two executions/reset. These fixtures contain integer payloads; this is not REAL/BLOB/collation breadth evidence.

`right-matched-index.test.mjs` verifies actual planner source order and RHS m_abc selection for forced **and unforced** RIGHT/FULL. Public rows retain native sequence (not sorted), types, metadata and reset; required overflow preserves step and reset errors. Work counters repeat exactly on reset. Terms are not admitted on the preserved LHS; unsafe WHERE-only forced partial
index proofs reject atomically at prepare for both RIGHT and FULL, after which
valid queries on the same connection still run. Unforced RIGHT/FULL each execute 5 indexSeeks,3 indexNext,3 primary tableSeeks,10 tableNext versus NOT INDEXED 0 indexSeeks,0 tableSeeks,35 tableNext. The unchanged outer scan and unmatched drain account for the selected 10 tableNext; drain has no index seek, so its scans do not earn matched-selection credit. Initial public run found an extra unmatched row: the new Column instruction used wrong operand positions. Corrected the owning physical-identity read to Column(field,key,cursor); no expected native rows changed.

Focused passing invocation: `node --experimental-strip-types --test test/conformance/right-matched-index.test.mjs && npx tsc --noEmit && git diff --check` (proc-9b248c3fac63). Earlier broader run proc-77dbba01c7cc had 435 passes/1 setup failure: covered-deferred lacked COVERED_DEFERRED_DIR, despite trailing shell success. Explicit environment rerun proc-622f7267235c passed new three tests plus covered-deferred six. Exact final frozen checks and attributable commit are in status, not inferred from these earlier inputs.

Final six-file frozen production/test run proc-0ce8f6d87c4d passed **536/536,0skip**:
new matched test, right-residual, repeated-right-full, where-plan-analysis,
covered-deferred with its explicit native directory, run-advanced-index-ts;
chained typecheck and diff check also passed. Source/test inputs were unchanged
thereafter; only current documentation was consolidated before commit.

Remaining: broader unsafe forced shapes, mixed typed/collation/range/IN/partial interaction breadth, nonauthor entire-delta review and ROOT/W full/package/browser acceptance. Existing repeated-right, residual, planner and deferred regression gates are retained; their finite successes do not prove arbitrary composition.

## G73-1 representative selected-composition safety controls

`right-matched-safety-capture.py` binds each original fixture SHA and exact mutated
m_abc root-page type byte (original byte and offset, corrupted SHA). Pinned native
capture precedes public consumption: 48 cases across three encodings, RIGHT/FULL,
forced/unforced RHS, required corrupt read (SQLITE_CORRUPT/reset11), LIMIT0 off-path
success and explicit NOT INDEXED success, plus intact multi-match capacity rows;
each executes twice/reset. The preserved LHS is explicitly NOT INDEXED so the
corrupt physical index belongs only to the selected RHS route. Reused authenticated
library/SourceID remain bound in `right-matched-safety-native.json`.

`right-matched-safety.test.mjs` asserts actual forced/unforced planner RHS selection,
required-read index seeks and off-path zero seeks, native typed rows and reset.
It checks saved malformed errors through subsequent step/reset/finalize. Execution
controls cancel/expire/exhaust work only after a returned selected matched row and
live match-owned bytes. Both reset and finalize preserve exact first-error identity;
reset/reuse reproduce intact rows. One-entry/eight-byte match limits admit one
rowid then reject a distinct second match, retry without accumulation, and permit
an exact one-row control afterward. A test-local wrapper observes existing
PrivateStateByteBudget owners and asserts usedBytes zero after failure/cleanup;
no production accounting API or injected failure is added. Date.now supplies a
deterministic post-selected deadline; cancellation here is at the next public step,
not a claim of mid-opcode host interruption. Browser work/deadline/private capacity
are existing bounded adaptations, not native budget equivalence. Native pRJ match
identity/Found/IdxInsert and vdbe.c check_for_interrupt/abort error ordering remain
unchanged; no runtime defect or source correction was warranted by these controls.

Initial safety hypothesis used b=1 for capacity, but native scan rows show all
three matches share r.id=1: one distinct match correctly fits. Native-first b>=1
controls establish the second distinct key before that test is consumed. An initial
unmatched-drain counter assertion assumed >5 tableNext even for forced full-index
scan; corrected to the physical scan bound plus actual unmatched RHS rows, without
changing production or native outcomes. Exact commands/results and delivery identity
are in [[card:card-s-c-d-e]] status. This closes finite author coverage, not independent
entire-delta approval or exhaustive malformed/resource composition.
