# Scoped OR caller and acceptance closure

Executor assessment, independent Reviewer approval pending. Five overlays compared against ede667f (OR execution/lifecycle traces, clause orientation/factoring, native clear command, RowSet forest/batch/clear tests, cost/arm immutable handoff). Assertions extend source-owned transitions and preserve original truth/typed captures; none waive failures. Native rowset.c clear retains iBatch while resetting chunks/list/forest/flags; test driver x calls native clear directly, not re-init. Same-batch invisibility, unordered labels and forest carries compared to native. Clause tests preserve original RHS/order and runtime subquery exclusions independently of costing. Internal tracing only.

Caller source repair includes enclosing scalar metadata resolution, derived/view transient provenance, bound rowid operands and reverse end ownership, PK secondary DeferredSeek and primary cleanup retention. Missing AggInfo aggregate WHERE diagnostic remains codegen-owned. Logical RowSet accounting boundary remains unchanged; no Set/eager union or public API expansion.

Scoped lineage base ede667f4af4075945cbb91a5f684caeee056604f, excludes unknown peer bitwiseBinary import/evaluator and watchdog tooling expansion. Focused native/public/overlays/parser/correlated487/487/type0/diff0 proc-542c349904a4. Original SQL reproducers retained. Native median capture unavailable (no such function), no parity credit. Revision-bound baseline derived LIMIT/filter and IN affinity failures are retained below; the bounded caller repair supersedes their current-failure status only after fresh verification. Final broader gates must use this lineage, not diagnostic482/07f identity. Detailed prior evidence retained in root verification.md and coherent-closure manifests.

## Joined rowid end ownership repair after independent d72 red

Exact8ee7dda failed outer OR/plain join with inner y.rowid<=2: missing second outer row; all3encodings6fail/3control pass. Native9captures retained in join-end-initial-native.json. Case3 wherecode.c1715–1818 emits owning addrBrk; where.c WhereEnd resolves addrCont then IN addrNxt then addrBrk, LEFT match/null and RIGHT Return. TS joined rowid end incorrectly used global SELECT exhaustion. It now joins loopEnds (formerly indexEnds): owning IN advance first, otherwise synthetic-null/RIGHT break or enclosing nextAt; only level0 exits normal scan. Residual jumps remain same-level next. No expectation or SQL-text workaround. Native18additional cases and public27controls cover reverse, correlated, IN, LEFT/RIGHT and empty branches. Capture source pinned, read-only ctypes; no native production runtime. Source evidence and initial red proc-cb5c0b07c1bb retained. Initial attempted source-slice script stopped at overload declaration/asserted before editing (proc-a312a4d6f7f7); stale tests remained6red, type chain not run; corrected owner edit then496green, later27controls green.


## Bounded baseline caller repair

Native `select.c:pushDownWhereTerms` restriction (3) refuses predicate transfer across a producer LIMIT. The retained derived lowering already records a post-producer predicate and owns producer accounting; the earlier direct single-table caller bypassed that state. Direct child admission now excludes retained post-producer predicates and children containing subqueries, routing those to the existing shared-builder destination path. No parallel evaluator or SQL-text test is added.

Native `expr.c:sqlite3CompareAffinity` combines resolved left/right expression affinity. The ordinary child InSet previously extracted RHS from an unbound parser reduction. It now consumes the resolved EList descriptor's affinity, falling back to expression affinity for non-column results. Native `resolve.c:resolveSelectStep` iterates pPrior with each arm's SrcList. Nested compound resolution now pairs final-arm EList with final-arm SrcList before attaching the original immutable child identity; independent per-arm plans remain unchanged. This fixes a pre-existing error exposed after the scalar destination loop advanced beyond its first baseline failure.

Existing scalar-child cases preserve original LIMIT/filter assertions and subsequent compound/nested controls. `baseline-caller-native.json` adds 24 independently executed pinned read-only steps (2 cases × 4 binding states × 3 encodings), including reset/rebind/clear and native datatype mismatch for cleared LIMIT. New public tests compare typed rows and retain primary error through finalize. Capture authored after source repair, before new public tests; no preimplementation native-pass claim. Existing IN-affinity capture remains unchanged.

Attempts: proc-3936f1420879 exit1 improved 4 failures to1 but exposed direct nested IN unsupported; proc-15f00d025c48 exit1 then exposed compound EList/SrcList mismatch. proc-3debec5256b4 exit0 original204/204 and type0. Native initial proc-e32a4040fb9c exit1 expected cleared LIMIT produced SQLITE_MISMATCH, subsequently captured as an error, not waived. proc-96a1af19c44d exit1 six new harness URL mistakes; fixed server address. proc-b12ac899c8ef killed after three finalize-primary propagation failures/hanging server cleanup; fixed test cleanup to assert retained primary while always closing server. proc-60f21083f9fe exit0:210/210, type0, diff0. Root peer index/files/cache unchanged; candidate-only explicit paths. Fresh225/browser/package outcomes recorded in per-card status rather than inferred from this focused pass.

## REAL joined projection repair (uncommitted continuation)

Independent d93 native-first nested-caller capture/test is retained unchanged.
The direct/coalesced joined projection shortcut missed the logical extraction
step: expr.c `sqlite3ExprCodeGetColumnOfTable` calls update.c
`sqlite3ColumnDefault`, which emits RealAffinity after ordinary Column; rowid
is a separate branch. vdbe.c RealAffinity converts compact integer payloads,
not text/NULL/blob. where.c WhereEnd changes Column cursor/field for covering
but leaves the following affinity instruction intact. Existing TS expression
and single-table producers already perform this expansion; the joined shortcut
now shares a logical result-column emitter before Copy/NotNull. No raw Column,
Mem, index-key affinity or rowid representation change.

Fresh proc-9123711dbaae: original supplemental reproducer still 0/3, but all
three now pass complete typed native rows after cancellation/reset and executed
OR root sequence, then fail the previously unexecuted `tableNext===0` assertion
(actual2). Deadline iteration remains short-circuited. Do not classify this as
green or rewrite native expectations. SQL has an ordinary outer rowid range
`x.id<=2`; VM Next counts every table movement, including enclosing movement.
Next investigation must establish cursor ownership and native outer-loop
continuation before deciding whether this is a runtime defect or an overly
broad trace assertion. Independent d review required for any harness correction.

Fresh proc-e3a11aed1bb1: OR-rowid, join-end-bound, scalar-child, subquery-view
408/408; typecheck0/diff-check0. No exact225/browser/package rerun or new commit
credit; prior delivery remains8eb5579. Root/index untouched. The three d authored
native/test files remain untracked in candidate pending coherent acceptance.

### Enclosing movement ownership resolved

proc-feb4cbee8602 compiled the actual SQL: the only table Next is PC122,
cursor0, targeting PC3; inner selected owner uses RowSetTest/Gosub/Return
(PC51/52,67/68,121). Outer rowid upper-bound PC4 breaks at123.
proc-a7f75ea003b3 independently queried pinned read-only native EXPLAIN with
sourceId asserted: outer `SEARCH x USING INTEGER PRIMARY KEY (rowid<?)` and
`Next p1=0 p2=5`; inner MULTI-INDEX OR uses index Next and ephemeral RHS
Next/Prev, not an inner table scan. Native and TS both advance the enclosing
rowid cursor after each of its two rows, then break at the upper bound.
TS VM Next counts every executed table movement, so global zero was never a
valid prohibition on an inner scan for this SQL. This is trace attribution,
not permission to replace selected accesses or change typed expectations.

The test now checks the compiled caller has exactly one table movement owned
by the outer OpenRead cursor and checks runtime tableNext2, retaining exact
four executed OR roots and original native typed rows. The original zero
assertion and its newly reached failures are preserved above and in status319;
native capture and capture driver unchanged. Independent d approval of the
harness correction remains pending (not claimed obtained).

proc-cc0c4b205c7a: all3/3 pass, including both cancel and previously
short-circuited deadline iterations and complete reset/replay after each;
typecheck0/diff0. No fresh broad gates or commits yet. Remaining acceptance
work is native-first selected/offpath/covering/coalesced metadata and binding
controls, affected mapping/audit consolidation, exact225/browser/package,
coherent scoped commit and independent acceptance. Focused green is not full
card delivery approval.

### Expanded logical-column controls

`capture-real-projection.py` is read-only pinned-source-ID native capture,
60 binding executions: five caller controls × four tagged INTEGER/REAL/rebind/
clear states × three encodings. Public `real-projection-caller.test.mjs` checks
all native metadata fields and typed rows, rowid INTEGER separately, NULL,
fractional/integral REAL, text return liveness/reset and shared physical-index
Column plus RealAffinity in the single covering control. Joined ordinary,
forced index OR-expression and FULL USING coalesced controls retain raw keys.
Joined forced-index controls are **not** credited selected multi-or or actual
joined covering: native may choose OR-IN; current TS has no OR branch starts
there and the attempted joined physical-Column assertion failed. Actual selected
joined REAL/correlated caller coverage remains the separate nested-caller test
with exact repeated roots; this bounded control inventory is not all-lowerer
coverage. Labels `index-or-covering`/`ordinary-covering` describe forced native
index queries, not an assertion of TS joined covering.

Chronology: proc-ad8aeb7266c2 initial native48; proc-9e6dd4b71232 9/12
(native chose OR-IN, not MULTI-INDEX OR). Changed control to distinct ranges,
recaptured before public check: proc-71cb4ada6585 still9/12 due TS ordinary
admission counter0, not rows. proc-c5f61c5568d1 corrected attribution15/15
including nested3/type0/diff0; trailing missing tools/release listing exit2 is
not a check failure. proc-d4734e2c1f91 attempted joined covering assertion failed;
added existing single-table covering control rather than changing admission.
proc-1485e739d650 native60 and public15/15. Native supplemental inventory stays
separate from earlier102 and movement3. No preimplementation pass claimed for
these expanded controls. Independent review remains after delivery ref.

### Committed candidate gates and native correction of stale expectations

First scoped commit0c5d290 (tree52f6bd5) kept all product changes isolated.
Fresh exact225 proc-f35c8b3dc48a completed with two failures: LEFT wildcard
expected INTEGER2n for declared REAL n; advanced-index nullable joined control
expected INTEGER1n for REAL p.c. Pinned independent read-only native sourceId
and existing fixtures confirm REAL2/REAL1 (all three encodings and forward/
reversed/LEFT controls). Capture now retains these ten legacy controls alongside
60 expanded binding runs. Only those two stale manual INTEGER expectations
changed, with unchanged rowid/NULL/partial-index expectations; proc-3131d3f21871
99/99. Original failures retained, not erased by later success. Inputs changed
during first gate so its drift is not a committed-green claim; fresh final
exact225 required. No raw-affinity rollback to make stale tests pass.

proc-157532980191 focused426/426/type0/diff0 before legacy expectation fixes.
proc-e89f1f44db42 build/package passed33 runtime modules/68 files, tarball
SHA2562c1ea2f0e8fb6e58c464e47e90a0fb435f94bfe5a6f1329438e419f4ed93b1d7.
Actual browser initially proc-b127fb7dff26 failed missing Playwright tooling;
proc-54e410b8e4e3 installed development-only tooling in card work child and
passed40/40 Chromium148.0.7778.96/Playwright1.60.0. This run omitted optional
Chinook (not41 claim). proc-9ca4f3c41bfa fresh-built pinned library recaptures
REAL60/nested3 byte-identical, package boundary0; later legacy capture rerun
must be compared again at final inputs.
