# Verification inventory

Pinned build profile matched manifest version/source identity and all encoding/metadata probes; development build succeeded. Native candidate is oracle-build/build/libsqlite3-oracle.so built with COLUMN_METADATA and MATH_FUNCTIONS, never runtime.

Commands are in the parent research document. Native capture exit 0; final active red TS suite exit 1 (69 tests, 24 pass, 45 fail); initial exit 1 (21 pass/48 fail). npx tsc --noEmit exit 0; node --experimental-strip-types --test test/conformance/where-plan-analysis.test.mjs test/conformance/where-plan-ordered-red.test.mjs exit 0, 33/33 pass. Empty typecheck.log reflects successful no-output typecheck, not missing evidence.

## Final fixture identities

- test/fixtures/or-rowid/utf8.db: 86016 bytes; SHA-256 `7ab050a57c647203f8c915cac00cc450b282851fe5eb39cf0ad7aa531cd3daf4`.
- test/fixtures/or-rowid/utf16le.db: 86016 bytes; SHA-256 `6be246f7e414ac90d46dc8319f993bd43d9829515b60139c89a1b33497016681`.
- test/fixtures/or-rowid/utf16be.db: 86016 bytes; SHA-256 `c02f44e25fe6ce0d0cc2e382e8a04a723d0dd8c3520399dc9027d5c25af1e163`.

[Initial TS failure](ts-initial.log), [final TS failure](ts-final.log), [existing focused tests](ordinary-focused.log), [typecheck](typecheck.log). Earlier exploratory missing guessed files and unavailable rg were tool discovery failures, not product test passes. No broader suites, internal RowSet native harness, limit/corruption or cancellation tests were executed.

## Consumer changed-input evidence — [[card:card-s-f-c]]

The preceding logs are preconsumer revision-bound history, not current execution
claims. Current detailed attempt provenance is in that card's status record.
The unchanged active suite progressed from72/27/45 to72/69/3 as shared-body
lowering landed. The final3 failures were a harness assumption that every
invocation must seek even when equality RHS is NULL: wherecode.c
codeAllEqualityTerms emits the whole-level NULL exit before affinity/seek.
Branch opens still execute, and are now asserted separately from seeks.

`capture-or-rowid.py ...libsqlite3-oracle.so --reuse-fixtures` recaptured all66
native cases with manifest source/version assertions, without rewriting fixture
bytes. Bindings now retain tagged INTEGER/REAL/NULL/TEXT representations and
independent native `typeof(?N)` results; REAL2.0 remains REAL. Inventory remains
0exact/21adapted/45supplemental. The earlier uppercase INT/metadata discrepancy
provenance is unchanged. Native rows/metadata/EQP/opcodes were freshly obtained;
this is not native runtime or C-cost parity.

`node --experimental-strip-types --test test/conformance/or-rowid-red.test.mjs`
now passes72/72 across three encodings, including all five rebind runs (added INTEGER2 versus REAL2.0 discriminator) and
clearBindings; full executed repeated-arm root sequence is oa/ob/oa, not a
Set-unique sequence. NULL/NULL runs assert zero seeks but two branch opens.
Shared builder budget reuse is checked across consecutive producer invocations.
The draft remains incomplete for recursive selected physical arms and represented
join callers, factored-AND exclusions and covering/common-index ownership.
Passing this bounded reproducer does not authorize broader runtime acceptance.
Native discriminator, prior failed checks, current command outputs and remaining
required core/browser/lifecycle gates are inventoried in the card status.

Fresh built browser current lane:37/37 passes in Chromium148.0.7778.96,
Playwright1.60.0; no alpha.4 reuse or OR-specific browser credit. Initial launch
failed for absent executable, then card-local browser installation succeeded.
Fresh supplementary advanced-index/analysis/foundation/OR-cost/selected-controls
suite:357 tests,334 passes,23 failures, zero skip/cancel. Failures include forced
partial-index p_live unusability and foundation identity; this is unresolved
regression evidence, not a core225 pass. First-select8/8 and ordinary planner69/69
passed independently. Full task remains incomplete despite focused reproducer
success. No full reviewed consumer commit/export or universal credit is claimed.

## Canonical-null consumer repair

Reopened [[card:card-s-f-c]] full-scope red diagnosis compared current and archived
`03ec5c14f079046fac64aafd15470aea274f01a7` baseline with
`node --experimental-strip-types --test test/conformance/run-advanced-index-ts.test.mjs test/conformance/where-plan-foundation.test.mjs`.
Both ran95/72/23 (exit1), with23 identical named failure sites; primary join732
error changed from unsupported expression to lost resolved identity. Evidence:
`work:///cards/card-s-f-c/processes/proc-10c74ffb89d8/stdout.log` and
`work:///cards/card-s-f-c/processes/proc-405daffcc534/stdout.log`; detailed site
inventory is card status26. Baseline attribution does not waive these failures.

Pinned parse.y1388–1444 removes literal NULL RHS and produces unary TK_NOTNULL;
expr.c5319 codes only pLeft; expr.c6847–6866 consumes TK_NOTNULL for implication.
`notNullTarget` had only recognized the original IS NOT syntax while analyzed
query terms were canonical unary nodes. Repair consumes canonical postfix forms,
normalizes exact structural NOTNULL identity for schema/analyzed residual proof,
and preserves generated NULL RHS without requesting a nonexistent resolved child
in both joined expression binders. This is not wider implication or permission
to omit different predicates. Synthetic foundation source now carries required
resolved join flags rather than weakening the production source contract.

First implication-only run proc-224426fc2315:95/83/12 exit1. Exact predicate
identity then restored covered partial residual omission (unnecessary base seeks
had accounted for eight failures). A multi-edit Python assertion aborted before
writing binder/fixture changes: proc-8f7321326dd5 ran95/91/4 exit1; typecheck in
its `&&` chain did not execute. After explicit binder/fixture writes,
proc-68b6f4725067 ran95/95/type0. Existing three-encoding admission, covered/
deferred access, counter/reset, selected/off-path corruption and LEFT provenance
checks now execute; they were previously short-circuited, not previously green.

Added canonical syntax/parentheses/opcode discrimination regression to
where-plan-analysis. Initial six-file combined proc-68a56cda446e failed the new
parenthesized NULL identity assertion; typecheck did not run. Owning NOTNULL
consumer now unwraps its original NULL RHS before identity comparison, matching
parse.y literal NULL production. Full rerun outcome is recorded in card status.
This repair does not complete recursive/represented joined OR continuations,
full source cleanup comparison, broader lifecycle acceptance or export/core gates.

Final current six-file command (analysis, foundation, advanced-index, public OR,
RowSet primitive/opcodes) proc-2b3cebae1a85 exit0: **427/427**, zero skip/cancel/
todo, followed by typecheck0 and diff-check0. Independently read totals from
`work:///cards/card-s-f-c/processes/proc-2b3cebae1a85/stdout.log`.
Failed preceding combined run was427/426/1, not acceptance. No new native
recapture, browser, core225, candidate export or reviewed commit is claimed.

## Nested selected arm continuation repair

Existing associative recursive fixture flattened, so it did not prove nested
selected consumption. New existing-fixture AND/OR arm reproducer failed public
prepare in all encodings (proc-9b4ec5a86c63:3/0/3): ordinary-only filtering after
owned arm replan discarded its actual multi-or path, leaving solver empty.
Pinned wherecode.c Case5 recursively invokes WhereBegin/End with per-level
RowSet/safe return register and common body. Current single-table consumer now
recursively emits that selected plan using shared registers/cursors/bindings/
construction budget. Each recursive body retains full arm truth and returns to
its own saved Gosub PC; outer RowSet dedup is distinct from child dedup. No eager
rowid materialization, SQL rediscovery or scan waiver. Parent truth and sorter
remain. Focused repair proc-5ee9a32a7733:3/3/type0.

Fresh pinned recapture proc-8533ac049647 via existing shared oracle library and
`--reuse-fixtures` asserts source/version;69 records now0exact/21adapted/48supplemental
(previous66 inventory remains historical). Added nested-arm native SQL rows,
metadata and opcodes, not only inferred expected rows. Fixture bytes/hashes
unchanged (all86,016). Public harness adds full ordered oa/ob/oc execution roots,
per-level distinct RowSet batch0/-1 and return-register checks; captured run also
executes normal typed rows/metadata/reset/clear/counter/sorter assertions.
Represented inner callers, factoring/covering/untested and broader lifecycle/core/
export/review remain incomplete. Final affected run is recorded in card status.

## Represented inner OR continuation repair

Three-encoding public reproducer selected sourceOrdinal1 multi-or and returned
correct rows but opened no arms: proc-2a6354906913:3/0/3. Multi-table caller selected
the immutable null-capability parent, then only consumed ordinary physical slots.
Pinned Case5 calls per-arm WhereBegin/End and RowSetTest/Gosub with common body.
The represented caller now emits a level-owned arm emitter, independent nested
RowSets/return registers, actual physical seek/deferred positioning, and Return
at the ordinary downstream continuation. Exhaustion reaches outer continue;
NULL RowSet/safe return initialization executes per outer row. All parent/arm
truth stays; table payload avoids covering mismatch. Shared builder construction
budget now covers multi-table original selection and arm replans. No scan-as-
selected or eager rowid union. This is bounded caller execution, not full
covering/untested/factoring or all join fidelity. Unsafe nullable joins keep
existing admission/fallback.

Initial typecheck proc-8c694a20ccb9 failed TS2367 on a mistaken Expression kind;
corrected null RHS at owning WhereTerm operator. Focused proc-ce60d00a7593:
type0/3/3. Fresh pinned capture75 records0exact/21adapted/54supplemental adds
inner-or and two-outer-row inner-or-reset; fixtures unchanged. First affected
run proc-b9583b056025:442/439/3; all failures at blanket tableNext0 for reset
case's ordinary outer rowid range. Native/public rows had passed; corrected
accounting to exactly two outer moves and complete oa/ob/oa/ob ordered roots,
not a selected-inner scan waiver. Typecheck did not execute in that failed chain.
Final affected command/results retained in card status. Broader lifecycle/
physical/core/browser/export/review remains pending.

## Correlated arm ready-mask repair

The represented caller forgot positioned outer sources during isolated arm
selection: correct rows but only ob/ob execution roots, rather than oa/ob/oa/ob.
proc-05b094fda388 focused3/0/3. Pinned wherecode.c2286–2324 builds recursive
SrcList from OR source and remaining notReady sources, excluding already
positioned sources; Case5 then invokes recursive WhereBegin. Our retained
original source ordinals therefore require an initialReady mask in the solver
rather than reconstructed source identities or cleared prerequisites.
`wherePathSolver` now defaults that mask to0 for ordinary callers and retains
it in every path, rejecting unready and already-positioned loop candidates
unchanged. Joined recursive emitter supplies exactly the actual loop-prefix
mask, including recursive levels; no candidate prereq mutation or scan waiver.
Tests assert oa selection/ready3 with outer1, plus cold-path exclusion when outer
not positioned. Public three-encoding typed native rows and full repeated roots
cover two outer iterations. proc-6b8a817c5e14 focused3/3/type0. Fresh pinned
capture adds correlated-or,78 records0exact/21adapted/57supplemental, fixtures
unchanged. Final affected totals in card status. IN/factoring/covering/lifecycle/
physical/core/browser/export/review remain uncompleted, not implied by this fix.

## Selected joined IN-list arm repair

Initial proc-d5c940b1dbe3 public prepare3/0/3: admitted IN arm fed scalar-only
rhs lowering (`joined OR bound lost expression`); rows/counters not executed.
Owning joined arm lowering now uses existing InListValue owned register/value
sets with comparison affinity/collation/direction; per invocation Integer reset,
NULL/duplicate suppression, physical prefix seek and full arm residual precede
RowSetTest. Pinned wherecode.c codeEqualityTerm/codeAllEqualityTerms and
where.c sqlite3WhereEnd aInLoop resolve scan/end/range-NULL to next probe,
inside-out iterator exhaustion to outer advance, scalar equality-NULL to arm
exit. This is the ordinary internal bounded IN-list representation, not eager
OR union. Empty/missing/null values still reach next branch; common-body Returns
retain selected arm continuation. Composite two-IN prefixes use nested restart.
Focused proc-1b2f0bbfb50d3/3/type0. Independently pinned fresh capture87 records
0exact/21adapted/66supplemental adds inner-in/inner-in-empty/inner-in-composite;
fixtures unchanged. First affected chain proc-b044a9e33a0b failed due harness
classification accidentally assigning two-outer-move/repeated-root expectations
to single-outer IN cases; corrected to zero tableNext and oa/ob. Subsequent proc-972f6352b4fb460/457/3
exposed erroneous harness oac name (fixture composite is oa(a DESC,c));
corrected loaded identity to oa, not an access waiver.
That failure does not count later typecheck acceptance. Final totals in status.
Broader subquery-IN, factoring/covering/untested/lifecycle/physical/core/browser/
export/commit/review coverage not implied.

## Runtime factored constraint exclusion repair

Pinned wherecode.c2350–2405 Case5 constructs xN AND w: original indexable
terms only, excluding TERM_VIRTUAL/CODED/SLICE and EP_Subquery, with nullable
LEFT ON boundary. Existing runtime reused cost orArmClause/pOuter and admitted
c=(SELECT5) into oa second equality for analyzed (a=1 OR b='beta') AND c=(SELECT5).
Focused handoff proc-42936882c1f4 prefix2 vs1,3/0/3. This SQL does not select
multi-or: earlier reproducer attempts asserting selection/cost candidate failed
and were corrected, not physical public failure credit. No native row mismatch
was claimed.

orRuntimeArmClause now owns separate immutable eligible enclosing scope without
unsafe pOuter links for both direct and AND arms. Both ordinary SELECT OR emitters
consume this scope; cost exploration remains unchanged. Original arm/RHS identity
and full parent truth remain. EP_Subquery is found structurally in reductions,
not token matching. Represented terms have no coded/slice state; row-value slices
are not admitted, not grounds to pretend those source branches implemented.
All represented original usable scalar terms are safe to recheck in common body;
no residual omission/covering optimization is introduced by this repair.

Focused proc-2f64d0b4c5353/3/type0. Expanded tests retain AND-arm terms, usable
factored ranges, no unsafe scope chain, virtual exclusion and synthetic outerOn
exclusion. Six-file affected proc-a893ee794f07463/463/type0/diff0; complete totals
extracted proc-32c57cf7545f. Native87 inputs unchanged and reused, no new capture.
Broader covering/common-index/untested ownership, lifecycle/physical/core/browser/
export/commit/review delivery still pending. Tests of synthetic LEFT ON exclusion
are internal ownership controls, not new public join acceptance.

## Common-index covering Column repair

Pinned wherecode.c2510–2575 pCov/iCovCur producer compares actual recursive
loop indexes; where.c7753–7835 consumes it at WhereEnd to rewrite covered Column
reads (uncovered reads remain table reads). Original source-first selected
same-index test proc-c2207a99134b3/0/3: same loaded oa and cursor retained, no
common-body covering Column read. Prior proc-13d8a731ff44 used nonexistent
IndexColumn opcode; corrected test before repair, not independent failure credit.

Single-table emitOr now retains actual PhysicalIndex identity across all selected
arms, invalidating nested/nonindex/different arms permanently for that level.
Continuation publishes it; WhereEnd rewrites only common-body source0 Column
storage positions to loaded index fields (including IPK alias tail), preserving
child cursor ownership, RealAffinity and all residual tests. No SQL rediscovery,
parent capability mutation or universal index-only assumption. Table positioning
remains for full arm truth/dedup and uncovered fields. Rowid opcode rewriting,
inner caller covering publication and untested residual omission remain incomplete
native branches; no performance parity claimed by this bounded Column repair.

Fresh pinned common-cover adds3 captures:90 records0exact/21adapted/69supplemental,
unchanged fixtures. proc-3e0cdaccc28b native→six-file affected→type→diff exit0,
469/469/type0/diff0 (totals extracted proc-77d03bde300c). Explicit selected
same-index/mixed-index invalidation and residual controls pass. Public typed
rows/metadata/reset/clear/sorter and no tableNext pass all3 encodings. Additional
exact repeated oa/oa root assertion rerun is recorded in status. Broader original
lifecycle/physical/core/browser/export/commit/review delivery remains unfinished.

## Common-index Rowid consumer repair

The preceding Column-only repair's Rowid limitation is now superseded for the
single-table caller. Pinned where.c7856–7860 rewrites OP_Rowid to OP_IdxRowid on
Case5's published index cursor. The existing VM cursor Rowid representation reads
#recordRowids; #loadIndexRecord populates it from the decoded integer index tail
on each physical positioning, deleting it for a noninteger/absent tail. Thus the
owning WhereEnd consumer now rewrites common-body source0 Rowid cursor to retained
index cursor alongside Column; no parallel rowid evaluator or extra cursor movement.
Pinned vdbe.c6709ff IdxRowid restores its Btree cursor and extracts the integer
tail; our immutable read-only position/load path already decodes/caches that tail.
This is representation reuse, not a new index algorithm. Corrupt-tail/public
lifecycle coverage remains part of the original unfinished delivery.

Source-first proc-2ab5cfb13f6f red3/0/3 preserved in status; focused repaired plus
mixed-index table-Rowid retention control proc-2b847421d8513/3/type0/diff0.
Fresh pinned capture adds common-rowid3 supplemental records: **93 native records,
31 cases×3 encodings,0exact/21adapted/72supplemental**, not a TS or compatibility
denominator. Prior90 inventory provenance remains above. Unchanged fixture hashes.
Command: `python3 test/conformance/capture-or-rowid.py .saivage/work/cards/card-e-h/oracle-build/build/libsqlite3-oracle.so --reuse-fixtures`
then six-file affected/type/diff chain, proc-00bca78285d4 exit0 **475/475/type0/diff0**,
zero skipped/cancelled/todo; totals extracted proc-b834652b6d00. Public common-rowid
all encodings executes typed rows/all metadata/reset/clear/sorter, exact oa/oa
executed roots and zero tableNext. Detailed process logs/status retain provenance;
inner covering/residual/lifecycle/physical/core/browser/export/commit review remain
incomplete, not waived by focused green.

## Represented-inner common covering relationship repair

Pinned Case5 wherecode.c2510–2548 requires shared iCovCur and publishes common
physical index; WhereEnd where.c7758ff/7856ff rewrites covered Column/Rowid on that
level. Source-first red proc-234d6470e0b3 three encodings failed shared arm cursor
34vs35; later body assertions were short-circuited, not independent red evidence.
Joined emitter now owns one cursor per selected OR level, preserves identity only
across agreeing ordinary arms, invalidates nested/nonindex/different arms and
publishes identity/cursor to level continuation. WhereEnd consumes only source
cursor reads within that common-body interval; other source/child cursors remain
untouched. Full truth/table positioning/ready masks/reset-per-outer-row persist.
This does not disable parent terms or establish full Begin/End cleanup parity.

Initial internal repaired3/3/type0 proc-7b2c5c7cddb4 was only opcode evidence.
Fresh native inner-cover3 supplemental:96 records32×3,0exact/21adapted/75supplemental,
unchanged fixtures. proc-804c34be554c native succeeded but public inner-cover hung;
terminated after143s, affected/type/diff NOT accepted. proc-b19730f56b0b focused
public likewise terminated96s. Bounded work repro proc-27711ef774cf exit1 hit
100000 limit, not a performance waiver. Temporary internal opcode dump
proc-d6ae2d488ff7 (removed) exposed IndexRangeEnd p2=0 and wrong Integer bound p2=27:
end jump was recorded before key(end.term) emitted producer instructions. Pinned
Case4 end comparison emits bound before actual comparison/addrNxt. Corrected
owning joined OR primitive to compile endKey first then record comparison PC.
Independent new control asserts end op targets actual branch continuation; this
range termination defect existed in this newly exercised selected path, not
caused by cache or covering cursor rewrite. Shared-cursor hypothesis alone did
not satisfy public execution; actual branch ordering was repaired, not test waived.

proc-de3d62deb86c focused public+internal6/6/type0/diff0, including mixed-index
invalidation, exact oa/oa roots, typed rows/all metadata/reset/clear/sorter and
zero tableNext. inner-cover execution retains100000 work guard to bound this
regression (other existing cases unchanged). Final six-file result in status;
residual/lifecycle/physical/core/browser/export/commit review remain outstanding.

## Not-ready arm residual ownership red

Next original-assignment slice, after inner-covering refactor: pinned
wherecode.c2500–2505 propagates OR_SUBCLAUSE untestedTerms for AND terms from a
notReady table;2614–2632 skips prereqAll intersecting notReady;2564 disables parent
OR only if no untested terms. Current emitJoinedOr consume instead compiles full
original arm truth before Gosub, regardless of prerequisite readiness. Ordinary
caller has codedWhere/ready-level residual ownership, but cannot make that early
arm read safe retroactively.

Native-first case unready-residual uses i CROSS JOIN later, later.id=1 and
((i.a=1 AND later.c=4) OR (i.b='beta' AND later.c=5)), ordered ids. Pinned fresh
capture proc-1898023f9b16 exit0:99 records33×3,0exact/21adapted/78supplemental,
fixtures unchanged; previous96 provenance remains above. New focused command
`node --experimental-strip-types --test --test-name-pattern='selected OR unready residual ownership' test/conformance/or-rowid-red.test.mjs`
proc-8ef97beb62e9 exit1,3 tests0pass3fail: selected outer multi-or and two Gosub
assertions pass; forbidden later-cursor Column before downstream body fails all
encodings. Public rows comparison after that assertion short-circuited; no
wrong-row/native mismatch or lifetime/corruption claim. No product repair yet.
Required next owning fix is recursive readiness-aware arm residual production
and downstream parent truth ownership together, not SQL-specific bypass or dropping
arm predicates. Lifecycle/physical/core/browser/export/review remain outstanding.

## Not-ready arm residual ownership repair

Owning joined Case5 consume now decomposes owned AND clause terms (not arbitrary
SQL/OR text), skips virtual/notReady terms using prereqAll against actual positioned
outer mask plus selected source bit, and compiles each ready original predicate
before RowSetTest/Gosub. Non-AND OR atoms remain indivisible until ready; recursive
selected levels use their actual ready mask. Every tested predicate's failure
continues the physical branch. Existing ordinary codeOuterConstraints retains
parent OR until its prereqAll is positioned and patches failure to correct level
continuation; immutable analyzed terms are never marked globally coded. No new
TERM_CODED/disableTerm implementation or predicate-omission credit. The extra full
parent recheck is retained (performance tradeoff, not a browser necessity claim).
This fixes semantic production/caller relationship, not one SQL example.

Accepted red proc-8ef97beb62e9 remains historical3/0/3 early-read assertion; later
public rows had short-circuited. First repaired focused proc-7f25947336d5 now6/6,
type0/diff0: public native rows/all metadata/reset/clear and internal no early
later cursor reads. Strengthened tests require ready arm residuals before dedup
AND full parent Binary OR in downstream body. Enabled selectedRequired for this
independently captured case and exact oa/ob roots/zero tableNext counters.
Inventory remains99 records33×3,0exact/21adapted/78supplemental; prior96 provenance
above. Final affected results recorded in status. This is not lifecycle/physical,
core/browser/export/commit acceptance; those original delivery gates remain.

## Public selected OR control and primary cleanup acceptance

Next safety slice, source-first review: VM RowSetTest creates statement-private
RowSet with current step control, updates that closure each call; #halt clears
cursors/deferred rows/record caches and destroys register-owned RowSets before
reset/finalize propagate saved primary error. Pinned vdbe.c RowSetTest and
rowset.c Clear/Delete retain owning register destructor relationship. TS
#privateControl adds bounded async work checkpoints; these checks do not establish
all traversal or timer-during-yield behavior. No product edits in this slice.

New all3encoding public tests use selected a=1 OR b='beta' with unsorted streaming
output: first row/first branch counter proves actual arm entered; next step
cancellation, timeoutMs0, and maxWorkUnits1 each preserve identical saved primary
error through step/reset, then same statement reruns all3ids; a repeated error
survives finalize, releasing statement so a second ordinary statement succeeds.
Separate connection maxPrivateBytes64 forces RowSet allocation failure after
selected first branch open; step/reset/finalize primary identity and retry remain
coherent. Tests do not infer released-byte measurements from second statement
success, and do not waive allocation-bound representation limits.

First command proc-7eaea5efd0e5 failed test-module syntax (extra parenthesis), not
product red. Corrected harness; focused lifecycle/private command with type/diff
proc-e0da510f8a61 exit0,6/6/type0/diff0, no skips/cancel/todo. Native99 unchanged,
not recaptured; these are control/error contract tests rather than new oracle
rows. Remaining original timer-during-yield, selected/offpath corruption,
page-local movement, borrowed-value/REAL liveness, full core/browser/export and
reviewed scoped commits are not established by these bounded checks.

## Selected OR REAL, rowid affinity and owned BLOB liveness acceptance

Source-read actual VM SeekRowid copies key then numeric-affinities it (does not
mutate original binding); selected secondary arm uses OpenIndex accounting, while
rowid arm uses table seek, not that counter. Actual #loadIndexRecord/#loadTableSeekRecord
invalidate borrowed backing before decoding; public columnBlob returns owned
bytes. Pinned vdbe.c RealAffinity2134ff realifies integer-packed REAL fields.
Added all3encoding selected-stream REAL/BLOB tests for ids1/2/3: storage type real,
values1/2.25/3, BLOB00ff/empty/0102 retained through arm movement/reset/finalize.
This exercises borrowed internal input through owned public output, not a public
borrowed-value API guarantee or arbitrary page-movement coverage.

Added independent pinned-oracle rowid-affinity case with text1/text1.5/REAL1.0/
INTEGER1/NULL tagged bindings, ORDER sorter and public rows/all metadata/rebind/
clear across3encodings. Native capture proc-40ce55181e4e succeeded:102records34×3,
0exact/21adapted/81supplemental, fixtures unchanged. Prior99 provenance retained.
Additional unsorted internal plan control requires RowSetTest and SeekRowid;
public counters require one actual secondary-index open rather than two.

Initial proc-73729b17ead1 tests3pass/3fail: wrong test assumption that rowid
SeekRowid increments orBranchStarts; source shows only OpenIndex increments it.
Corrected assertions, proc-f90ec5d94bc8 six tests/type/diff passed. Native harness
extension exposed the same pre-existing blanket persistent-seeks>=2 assertion,
proc-40ce55181e4e9/6/3; correction then exposed branchStarts>=2 assertion,
proc-31ae904db2529/6/3. These were harness failures, not product defects; later
runs short-circuited at physical assertions in those failed public cases.
Final proc-1ab30b801d739/9/type0/diff0 executes all binding runs and clear checks.
No product changes made. Selected/offpath corruption/page-local movement,
timer-during-yield and fresh core/browser/export/reviewed delivery remain open.

## Selected/offpath physical corruption and host-yield control acceptance

Added actual selected public all3encoding controls, no product edits. Host timer
aborts while a selected streaming common-body scalar charges/consumes a 1MiB
zeroblob/hex input. Timer fired and first selected index branch had entered before
cancelled primary; repeat step/reset preserve error identity. Positive20ms deadline
and100work-unit ceiling independently stop after selected branch entry. Source
VM instruction loop/private/scalar control yields every256 charged work units.
This establishes host suspension/cancel/deadline in the selected common body,
not a claim that every possible RowSet forest transition was separately suspended.
proc-bd61a2b5a403 focused3/3/type0/diff0.

Fixture helper now supports in-memory byte mutation after checking original hash;
no database fixture files written. With schema/other pages intact, oc offpath header
byte0 corrupt succeeds and exact selected oa/ob roots/rows prove no offpath traversal.
ob selected header corruption fails SQLITE_CORRUPT11 after both selected opens;
saved primary repeat-step/reset/retry identity tested, then finalize. TS Btree page
allowed type check read against pinned btree.c decodeFlags2028ff/initPage2234ff.
These checks establish path-local failure, not native corruption-message equality.
Final combined proc-a90188b3a4c4 exit0 six/six/type0/diff0, no skips/cancel/todo.
Native102 unchanged/reused, no new row oracle cases. A discovery command referenced
nonexistent index-cursor/btree-page test paths (proc-66249d9f675f exit2); no validation
credit taken for that command. Page-local multi-page movement and fresh full
core/browser/export/scoped review/commits remain open, not waived by these tests.

## Multi-page selected OR public mismatch red

Native-first separate movement fixture capture adds3 supplemental records (not
added to native102 denominator): movement-native.json1case×3encodings. Pinned
capture proc-3acaa6397eb2 exit0 created3000row o with oa DESC(a,c), ob DESC(b,c)
and oc; fixtures200704/212992/212992bytes, hashes in capture. Original fixtures
remain unchanged. Movement query SELECT id,r,p FROM o WHERE a>=2 AND a<=4 OR
b='b3' ORDER BY id. Oracle1629 typed rows each encoding.

Actual internal seam checks both oa/ob roots are interior pages, wraps database.page
read counting without changing returned pages, then public selected execution.
Focused proc-f17e9211d43f exit1 **3/0/3**: typed rows differ all3encodings. This is
an actual runtime defect, not test-counter assumptions. Diagnostic-only rerun
proc-1f09869beec3 exit1 showed utf8 actual1582 vs1629, utf16le1512 vs1629; missing
first ids4,8,11,13,18,...; utf8 exact selected roots3/4, indexSeeks2/indexNext1824,
tableSeeks1824/tableNext0/sorter1582/dedup242. Temporary diagnostic removed after
capture. Later page-count bound/reset assertions short-circuited, not credited.
Source-read btree.c btreeNext6350ff: index interior keys are real entries and
parent/child transitions return them; compared TS indexMove interior/ancestor
transitions257ff and VM selected index movement. Owning cause not yet isolated:
physical seek/move, deferred positioning or union truth must be compared before
repair, not scan fallback or predicate deletion. Type/diff separately passed
proc-f68aa93b3a99; does not erase runtime red. No product repair/staging begun.
Fresh core/browser/export/scoped reviewed delivery deferred until this owning
runtime mismatch is resolved; no whole-card acceptance.

## Multi-page prefix seek boundary repair

The shared physical seek, not RowSet or OR truth, owned the defect. Temporary
ordinary-arm diagnostic proc-8c93f75fde9d exit1 showed range1258vs1287 and equality
566vs600 utf8/446vs600 utf16: each independently skipped initial prefix matches.
Removed diagnostics afterward. Branch comparison: pinned vdbe.c4938–4952 sets
SeekGE default_rc+1 and SeekLE-1 so equal unpacked-prefix comparison continues
IndexMoveto descent; TS returned immediately at equal interior separator. This
mistook equality of prefix for unique full-key equality. Corrected `indexSeek` to
lower/upper-bound equal prefixes with GE/LE bias through every page, retaining
exactness at leaf/parent fallback; no movement/RowSet/SQL shortcut changes.

First repaired run proc-b3960a11f9e3 exit1 now passed full native typed rows and
selected work but failed page-count test seam: btreeFromConnection creates a
separate database instance from prepared VM. Corrected internal instrumentation
to prototype with finally restoration (test file serial execution), not a product
repair. No credit for its later reset checks. Final focused proc-6d5569424556
exit0 **3/3/type0/diff0**: all1629 rows each encoding, exact roots, >1000 index
moves/>10 pages/proportional read bound, reset rerun now executed. Native movement3
supplemental reused unchanged; native102 separate unchanged.

Six affected suites proc-de100d7e40c1 exit0 **511/511/type0/diff0**, no skips/cancel/
todo. Partial stdout totals read53500 from returned work URL. This fresh targeted
regression is not fresh core225/browser/export or whole-card delivery. Source,
test, affected concise guide/map/audit and evidence updated; no staging/commits.

## Isolated delivery candidate and browser movement

The selected movement browser lane is now an explicit capture-backed case for
utf8/utf16le/utf16be: 1629 typed rows and reset through the existing public runner.
Actual Chromium 148.0.7778.96 (Playwright 1.60.0) passed 3/3 with the movement
filter; the previous 37-case lane is not movement credit. Trace/page-local
assertions remain Node-only. Detailed identities, commands, failures and output
references are retained in [[card:card-s-f-c]] status (v153 and subsequent).

Current runtime/test delivery attribution is commit
`53d47fcce1165b44cac7be76f5d257ad118aa467`, tree
`3b3f288076f5154ae32c221a58bdc242deac4dac`, on the separate
`card-s-f-c-delivery` branch; final export inventory, commands, hashes and failed
setup provenance are retained in [[card:card-s-f-c]] status v159 (and v153–156
for earlier assembly). Alternate indexes excluded staged JSON/bitwise/peer guide
hunks; shared root HEAD and dirty peer index were not integrated or rewritten.
Earlier runtime object56220bcb and acceptance tree01f607 are historical assembly
inputs, not the current delivery identity.

Executor final archived six suites passed 511/511 and typecheck; unchanged
production/test inputs also passed build/package, expanded affected core858 and
unfiltered browser40 (including movement3). Independent [[card:card-s-f-d]]
review reports 511/915/browser40, native102 (0 exact/21 adapted/81 supplemental),
separate movement3 and fixture verification; source audit continues. These are
finite executed inventories, not all-optimizer compatibility or C-cost parity.
Pinned `rowset.c` is an explicit additional native test dependency (not runtime).
First archives missing that dependency and the attributed export's omitted
evidence overlay failed; successful reruns do not erase those revision-bound
findings. This doc-only correction changes no runtime/test inputs; independent
goal acceptance and shared-root integration remain separate steps.


## Tested-parent OR omission repair

Pinned wherecode.c Case5 tests arm truth before RowSetTest/Gosub and disables
its owned parent term only when recursive WhereBegin has no untested terms.
The delivered full common-parent residual repeated volatile calls: native-first
controlled nondeterministic random override produced four calls, versus seven
TS calls for the same three INTEGER rows and selected roots16/17. See
[retained probe](omission-probe.json) and [[card:card-s-f-c]] status v174 plus
current repair evidence. The native override is not built-in PRNG output parity.

The owning lowerer now omits fully tested parent terms, retains independent
enclosing conjuncts, and retains joined parents with later-source untested arm
terms. Nested selected arms do not re-evaluate truth already supplied by their
child continuation. No SQL-text exception, public hook or parallel evaluator.
Three-encoding public regression counts four RNG calls and typed rows on two
reset runs, with selected branch/dedup assertions. Broader coded/factored term
omission and error multiplicity are not established by this finite repair.

## Prepared scalar selected OR caller repair

Accepted red v183 identified scalarPrepared discarding selection, but its zero-FROM
query also exposed an older independent scan emitter. Merely removing the guard
left the reproducer red (proc-a3c989198d5b); traced RowSet insert was also zero
(proc-555a810eb9d5). Root private counters were not the cause: the zero-FROM
producer did not call the selected lowerer. Simple persistent rowid children now
route into the existing shared lowerer with normalized scalar limit/destination.
Prepared constraints bind their full original reduction before extracting the
operand, rather than trying to bind an unowned RHS. Initial correlated regression
failed with outer_o.a identity loss (proc-ad95b03ce42c): double-binding an already
bound RHS removed; final focused proc-3b58aff97776 passes3/3. Initial test
registration referenced nonexistent native variable (proc-07ceb79bf069), corrected.

`scalar-native.json` holds independently queried pinned read-only results/EQP
for4 queries ×3encodings, using unchanged native build and fixture hashes from
`native.json`; source ID checked. Not a native-production import. Tests compare
INTEGER/NULL typed rows, selected branch/seeks, sorter and two reset runs.
Existing reproducer preserved card-locally. Nine-suite run proc-2aa0703b64ec
passes540/540 but following typecheck failed exactOptionalPropertyTypes on
optional child limiter; fixed conditional field construction, no runtime change.
Original225/browser/package/overlay closure and interrupted VM mutation/flags
proof remain outside this reproduced caller repair, not claimed complete.

Second type attempt also failed (proc-1b06ac02e94d, proc-bb01a7111e6a): scalar limiter lacked combined/capacity. Corrected by translating the existing prepared scalar normalization, count1 default, offset, combined and capacity registers; not casting away the contract. Final production nine suites proc-27fdd21c1571 **540/540/type0/diff0**. Then explicit columnType assertions added: original preserved reproducer plus focused3/type0/diff0 proc-86689d3635c8. Final traces first-row executes only first branch/root16 as expected (LIMIT stops further arms). No broad counters/optimizer parity credit.

## RowSet cleanup collision repair

Node-local repair for [[card:card-s-f-c]] accepted red status v192. The preserved
card-local `rowset-cleanup-red/cleanup.mjs` failed reset identity (secondary
instead of primary), proc-0db9368eb54c exit1. It invokes the real RowSet delete
before injecting a secondary exception after a primary partial-sort checkpoint
failure. This is synthetic TS exception adaptation; native xDel does not throw.
Pinned `vdbemem.c:vdbeMemClearExternAndSetNull`, `rowset.c:sqlite3RowSetDelete`,
and `vdbeaux.c:sqlite3VdbeReset/Finalize` own destructor/nulling and saved-error
reporting after halt/cleanup. Mem now detaches and clears dynamic state before
callbacks, preventing repeated destruction. Reset/finalize collect release
errors, finish state transitions (and finalize notification), then report the
saved primary or first cleanup error. No change to RowSet algorithms/accounting,
public API, bindings contract or SQL admission.

Regression in `rowset-opcodes.test.mjs` preserves checkpoint4 interruption,
primary identity, zero logical budget, exactly-once destruction; tests reset
reexecution twice and terminal finalize, plus cleanup-only reset/finalize and
Mem overwrite/aggregate exception ownership. It does not assert recovery from a
destructor that throws *before* performing its resource release.

Commands in workspace: preserved probe proc-25be34b39d46 exit0; RowSet suites
plus `npm run typecheck`, proc-b1d7e439e94c exit0,14/14/type0. Broader ten-suite
attempt proc-11f71009a527 exit1,244 total/147 pass/97 fail, then type/diff
unexecuted:96 OR capture metadata TypeErrors at line70 and aggregate predicate
scalar ORDER/LIMIT expected1 but actual0. A disposable current-input copy with
only the two product files restored to pre-repair snapshots reproduces the
same failures, proc-0760be434b65 exit1,181/84/97 (96 metadata,1 aggregate).
These existing root defects were not repaired or credited as green. Both full
logs remain at their returned work URLs; summaries independently extracted by
proc-830c74a725a1/proc-691805f9ece2.

Eight directly affected Mem/private/RowSet/relational/aggregate-window/candidate
lifecycle suites, proc-9f4bf8c0e8ed exit0,63/63/type0/diff0. No skips/cancel/todo.
This excludes the two known-failing suites above, not a replacement for exact
core225, browser/package or coherent original OR delivery acceptance. No fresh
native capture/build or public OR compatibility credit. The apply_patch attempt
reported no file changes; exact scripted replacements then performed the repair.
Peer index was byte-equal to the pre-edit capture, proc-0fef7b3b7b43; scoped
working changes and no blanket staging preserve peer overlays. Full node-local
hashes/deltas and final checks belong to the card status/work evidence.

## Rowid primary-index positioning repair

Accepted red summary/status v201 preserves `aggregate-group-lifecycle.test.mjs:41`:
`SELECT count(*) FROM t1 WHERE a=(SELECT a FROM t1 ORDER BY a LIMIT 1)`
returned INTEGER0 rather than INTEGER1. Fresh red proc-71ccce3dbf38 exit1.
The selected ordinary scalar continuation opened and advanced the declared
PRIMARY KEY index but read Column from an unpositioned table cursor. Internal
diagnostic program dump proc-f73cc12e554f showed IndexRewind/IndexNext and table
Column without DeferredSeek. Temporary constructor logging was removed.
Initial JSON trace attempt proc-220bad6ed2c3 failed on circular physical metadata;
it is diagnostic failure, not execution evidence.

Pinned wherecode.c Case4 lines2170–2188 branches first on omitTable, then
HasRowid(pIdx->pTable), then distinct WITHOUT ROWID cursors. The prior TS condition
excluded every `origin==='primary-key'`, conflating rowid secondary primary-key
indexes with WITHOUT ROWID table storage. The fix preserves the existing
rowid-table deferred-positioning convention and excludes only the WITHOUT ROWID
primary table; no scalar-specific evaluator, SQL admission, API, cost, RowSet,
ordering, or cleanup change. This is the owning ordinary index continuation,
not an expr.c Once/LIMIT repair. The previous red-stage Once reorder and second
RHS-binding attempts did not repair this reproducer and remain recorded there.

Native capture `primary-index-native.json` obtained independently via unchanged
pinned libsqlite3-oracle.so, read-only current-generation fixtures; source ID and
fixture hashes retained in capture. Command `python3
"$SAIVAGE_CARD_WORK_ROOT/scalar-order-repair/native.py"`, proc-2838e5fc2740 exit0:
5 queries ×3 encodings, typed rows/EQP/schema, including both scalar directions,
empty scalar, ordinary ordered key+uncovered payload. Native code is not used at
production runtime. Public regression compares complete typed rows twice with
reset, retains original reproducer unchanged.

Focused first green proc-8637a99a4d8f exit0 (complete tail in its durable output):
original scalar predicate test passes across all three encodings/reset/empty;
typecheck passes. Expanded attempt proc-de06b02a5180 exit1: aggregate suite11/11
passes, ORDER-consumption public suite fails missing card-local r2-native capture;
chained type/diff not executed. `expression-subquery.test.mjs` was not a matching
suite path, so it receives no credit. Corrected affected run proc-d94f3d16c216
exit0: aggregate lifecycle, RowSet opcodes, where-plan analysis **272/272/type0/diff0**.
`expression-subquery-composition.test.mjs` proc-892a1cdff54f **6/6**, independently
correlated/aggregate caller tests. Nonmatching select-conformance path receives
no credit. These are working-input focused checks, not committed candidate,
225/browser/package or original whole-card closure. No broad OR harness credit;
its existing line70 metadata TypeErrors remain separately diagnosed.

Scoped runtime delta is one condition plus source note. Preserved diagnostic
snapshot/delta at `$SAIVAGE_CARD_WORK_ROOT/scalar-order-repair`; no root index,
ref or commit changes. Other dirty/staged edits (including earlier cleanup) remain
intact. Current full index hash recorded proc-3ae3a001f682 is
4ea4364cf91329bd88ebfab47735a825dcc12f3c7486d2dea1c0a408b0960644.

## Correlated rowid bound caller repair

Accepted closure red isolated a shared scalar/compound/aggregate caller defect,
not an OR RowSet defect: selected rowid equality/end terms were bound with the
owning reduction then their extracted operands were resolved again without that
carrier. The second pass lost outer `t.a` identity. Pinned wherecode.c Cases2/3
code the owned RHS directly; Case3 swaps pStart/pEnd for reverse traversal and
uses the direction-specific end comparison. Removing re-resolution alone exposed
wrong empty descending results: the upper boundary was still treated as a forward
end and terminated the descending scan on its first high row. Correct end ownership
now uses the lower boundary on reverse scans and the upper boundary on forward
scans. Existing residuals retain truth when no end exists; no SQL special case,
metadata change, new seek datatype path, or sorter proof is introduced.

Attempt evidence: proc-2d154bb67d66 removed re-resolution only:207 tests/201pass/
6fail (wrong empty rows, no identity crashes); chained typecheck unexecuted.
proc-0e28637f84f9 added directional start seeks and end swap:207/207/type0/diff0.
Start seeking was unnecessary for this owning end-test repair and widened existing
non-INTEGER seek behavior; removed before final delivery. proc-3df9e1db2cae tests
207/207/type0/diff0 on final end-only repair. Independent read-only pinned source-ID
checked captures proc-3522ea2b3402:4 queries×3encodings in
[correlated-bound-native.json](correlated-bound-native.json), current fixture paths
and hashes retained. New public regressions compare complete typed rows twice
with reset for correlated equality, ascending/descending strict ends, and inclusive
paired bounds; original9-case reproducer unchanged. Status record contains final
expanded verification and root index preservation. Broader metadata, synthetic
planner-source and integration timeout findings remain unresolved; this repair is
not exact225 acceptance or coherent original-delivery closure.

## Scalar metadata caller ownership

Current root focused repair (working tree, not coherent delivery commit):
`compileScalarSelect` obtains the enclosing resolved result descriptors and uses
those for public type/origin. Existing `resolve.ts:resolvedExpressionMetadata`
already translates select.c:columnTypeImpl TK_SELECT2035–2051 recursively through
the first linked child expression; the consumer instead depended on an incidental
`subqueryColumns` runtime branch map. Shared physical child lowering did not always
populate that map. Keep representation adaptation and branches unchanged; no
SQL-text exception, runtime evaluator or metadata inferred from rows. Convert
NameResolutionError to the public SQLite error at this new caller, before emission.

Red provenance remains status219 and proc-e8d18902382c230/214/16fail. First repair
proc-ba1a2545642d fixed metadata but revealed raw NameResolutionError at previously
short-circuited derived compound missing-column assertion; three IN-affinity
failures also remained. Typecheck chained after failures did not run. Caller error
conversion repaired that ordering/contract. Proc-16c9e8b4cf47189/186/3fail now has
only all3encoding IN-affinity failures; ORDER scalar and derived-window parent
metadata/error tests passed. No IN row credit claimed.

Focused seven-suite command (ORDER contract, derived-window parent, correlated
scalar destination, aggregate source owner, linked scalar preparation, aggregate
lifecycle, RowSet opcodes): proc-091997f627d0239/239/type0/diff0. Extend the existing
chosen scalar metadata regression with reset/second execution without removing
any reproducer. Final same command proc-05a7c63640f6 exit0 **239/239/type0/diff0**;
complete tail consumed proc-b8005a49287e, diff0 repeated after guide/map/audit edits.
Full NUL stage index equals before at final comparison; no staging/ref changes.
Native expectations remain the independently captured pinned ORDER and subquery
foundation records used by these tests, not a new capture or full delivery gate.
VM before/delta retained in card work metadata-closure-repair. Changed files: VM,
one appended reset assertion in derived-window test, guide/source map/audit and
this evidence. Remaining independent planner-source, derived LIMIT/filter and
IN-affinity findings and exact225/browser/package/native/public/type coherent
closure are not waived or satisfied by focused metadata repair.

### Nested derived source metadata handoff repair

Exact VM-only attribution in status [[card:card-s-f-c]] v228 established that enclosing metadata resolution newly rejected the first constant-derived aggregate query as `no such table: d`; pre-metadata VM instead reached the later pre-existing LIMIT/filter row mismatch. `resolveNested` constructed transient source columns only for compound producers. Pinned select.c:sqlite3ExpandSubquery5885–5915 constructs a transient Table for every retained subquery; walking pPrior changes the naming expression list, not admission. sqlite3ColumnsFromExprList2227ff owns names, and the existing TS transient helpers retain affinity/collation/producer relationships.

Repair extends the existing single-source transient binding construction to ordinary producers using one plan, preserving the compound path and caller error conversion. No SQL matching, resolution-error swallowing, separate evaluator or runtime ordering change. Original full reproducer retained. An independent first-case test exercises typed scalar/EXISTS/IN rows and reset twice, so later failures cannot mask this branch. No new native capture claimed: expectations are the existing case, not a new oracle run.

- proc-9f44dd0de763: full original scalar-child test exit1, `d` now resolved but later schema view `v1` lacks nested expansion; no credit for short-circuited cases, including later LIMIT/filter.
- proc-bcb531475bcd: independent constant-derived test1/1, typecheck0, diff0.
- proc-9441ca2050ef: existing seven affected metadata/correlated/lifecycle/RowSet suites239/239, typecheck0, diff0; complete terminal tail proc-62bd2bf3bf41.

Separate nested view source expansion remains an unresolved caller relationship introduced by enclosing resolution; no claim that full scalar-child suite or coherent delivery is green. IN-affinity and producer LIMIT/filter findings remain separate. Before-image and index evidence are under purpose-named work `nested-derived-repair`; no staging or commits.

### Nested schema-view metadata handoff repair

Following the recorded `v1` prepare failure, `ResolutionSchema` now accepts the existing optional immutable views map. Source binding consults it only after explicit transient and persistent tables; resolved stored view output builds transient visible columns and binds its producer plan for underlying provenance. No native SQL reparsing/VM bypass/view evaluator. build.c:viewGetColumnNames3100ff resolves a copy, rejects circular expansion and validates explicit width; select.c:selectExpander6050ff installs view columns before consumers. TS uses synchronous in-progress ViewNode identity state cleared in finally rather than mutating immutable schema nCol; linked producer supplies names/type/affinity/collation and origin. No schema mutation or view result cache introduced.

- proc-c179335664b7: independent derived case passes; full original scalar-child case still fails, now on the exact pre-existing derived LIMIT/filter row mismatch instead of `v1` prepare rejection. Command used semicolon typecheck; exit0 is typecheck only, **not test acceptance** (2tests1pass1fail).
- proc-e1edfaaff938: independent derived plus all existing v1/v_inferred cases reset twice,2/2/type0/diff0.
- proc-fedf7d8cc359: final three independent tests3/3/type0/diff0, including circular expansion retry, width error, subsequent valid expansion.
- proc-44ee5cca3cea: source-resolution, compound names and prior seven affected suites243/243/type0/diff0, complete tail proc-4150a679c767.

Original full reproducer remains unchanged; later short-circuited assertions are uncredited. No new native capture, broader exact225/browser/package credit or scope change. Prior status v228 isolated baseline establishes LIMIT/filter mismatch independently; it is not waived by these checks. View source relationship repair is focused completion only.

### Executed OR run storage-class carrier repair

Fresh root proc-00888d82074e reproduced171tests75pass96fail: repeated binding/run execution dereferenced obsolete case `c.result[0]` before downstream assertions. The native capture's actual executed `run.rows` already owns typed rows per binding/rebind. Changed only the repeated-run columnType assertion to that carrier; separate scalar fixed-result loop retains its legitimate `c.result[0]`. No native expectation, binding discriminator, production code, count/order/reset/trace assertion or SQL behavior altered. Exact focused delta retained under purpose-named work or-run-carrier-repair/repair.diff. Initial exact-text tool edit refused multiple matches with no mutation; subsequent context-bounded replacement selected only run-owned loop.

`node --experimental-strip-types --test test/conformance/or-rowid-red.test.mjs && npm run typecheck && git diff --check`, proc-e62c7cc37ef5 exit0: **171/171/type0/diff0**, no skipped/cancelled; complete final summary consumed in proc-dbeeefbcb358. This newly executes the formerly short-circuited nonempty repeated-run row/type/metadata/selected trace assertions on current root. Earlier96failed tests gain no historical credit. Full index before/after byte-equal; no staging/commits/ref/cache edits. No new native recapture or reviewed coherent candidate/current225/browser/package claim.

### Planner synthetic source carrier repair

Integration dependency: row-width-output-adjust synthetic source only supplied table/cursorId, omitting required SourceItem join flags that parser and ResolvedSource contract always carry. The two admitted rowid tests crashed at where-plan:leftTargetCompatible before assertions. Source now spreads `parseSql('SELECT 1 FROM t').statement.from.items[0]` before synthetic table/cursorId overrides; this uses the owning parser's ordinary first-source flags and source fields, not a production nullable guard or manually duplicated flags. All existing output/work/parent/virtual tests retained, no expectation changes.

proc-547b1f6da8d3: `node --experimental-strip-types --test test/conformance/row-width-output-adjust.test.mjs test/conformance/where-or-cost.test.mjs test/conformance/where-plan-analysis.test.mjs && npm run typecheck && git diff --check`, exit0. Complete tail consumed separately; full index byte-equal before/after. Narrow synthetic fixture dependency only; no LIMIT/filter/IN-affinity fix, native recapture, final225 or independent overlay review claim.

### Aggregate WHERE error phase ownership

Fresh225 exposed unchanged scalar preparation assertion expecting `misuse of aggregate: count()` but enclosing resolver prematurely emitted `misuse of aggregate function count()`. Native proc-eb3c1563c0a4 sourceid bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc prepared exact SELECT nested aggregate with WHERE count(*)=1: code1, no statement, expected original wording. resolve.c aggregate classification retains NC_AllowAgg for result aggregate/GROUP; nonaggregate clears it. TS unconditionally cleared for WHERE. Now owning resolver retains it on classified aggregate queries, allowing existing expr/codegen unbound AggInfo check (expr.c5340) to report original error; no wording rewrite/SQL special case/test expectation change.

proc-71fb484feba7 existing no-FROM preparation reproducer1/1/type0/diff0. proc-b382ec72181a four affected aggregate/source/preparation suites all green/type0/diff0, exact summary consumed separately. Index byte-equal. Native capture at purpose-named aggregate-error-carrier/native.json; resolve before-image retained there. LIMIT/filter/IN-affinity and225 watchdogs not repaired or credited.

### Explicit watchdog carrier

Runner previously hard-coded30s and reported concurrency separately; serial diagnostics showed two genuine file runtimes above30s. Added development-only positive `--watchdog-seconds` (default30 unchanged), wired actual component bound and manifest together. Timeout/fail remain noncredit; explicit90s serial run does not overwrite prior225219/2/4 or authorize final acceptance policy. proc-61d459cf42e7 four original watchdog files completed0 with manifest90s/concurrency1/input_drift=[]; durable watchdog-carrier-verification.json. proc-ee2acb48950f checks component completed0/fail7/timeout-15 and CLI zero rejection plus type0/diff0. No test/production semantic changes; exact original file inventory/assertions preserved. Full stage index byte-equal.

### Resolver-phase fixture and correlated export closure

Parser-only median/json aggregate WHERE fixtures incorrectly expected resolution to emit codegen-phase missing AggInfo errors even when result classifies aggregate. Retained exact original SQL as doesNotThrow at resolver boundary; added nonaggregate-result counterparts preserving function-misuse rejection. Existing public scalar codegen error reproducer unchanged. resolve.c NC_AllowAgg/expr.c TK_AGG_FUNCTION comparison retained. Native pinned json_group_array exact pair independently confirms code1/no statement, aggregate-result `misuse of aggregate: ...`, nonaggregate `misuse of aggregate function ...`. Native median capture reports no such function (oracle configuration lacks percentile extension); no native median parity credit, TS registered median uses same resolver classification.

First proc-217e4343bea9 failed at second stale JSON fixture; trailing typecheck not executed. Final proc-f21636d99e4f parser/correlated42/42, public preparation1/1/type0/diff0 (summary consumed separately). Candidate now includes existing correlated-bound-native.json, omitted in prior isolated export; no capture rewrite/expected-row change. No225 retrospective credit. Detailed native captures/before-image under resolver-phase-fixture.

### Committed candidate identity and current gates

Isolated scoped closure commit07f844a7cbd4e9a01c105e1639b625766482ab9e/tree8e041a53f500c341b5f4e487dea316f6a48cef03 atop diagnostic4820078. Explicit13paths; peer root index preserved byte-equal. This is candidate identity, not independent review/delivery approval. Five original overlay independent reviews remain pending. Fresh proc-7316724e1bd8 exact225 serial1/default30/native180:223completed/2fail/0timeout, drift[], native prerequisites0 (92.671/.265/.616s). Baseline LIMIT/filter and all3encoding IN-affinity remain unwaived; prior221/4 and prerequisite failures retained. Proc-499ff9412c34 type/build/package/current Chromium gates exit0; package33modules/68files, SHA256be69957733c1cb280a12b4f13d48301390ec03a0ba146cab86e761372e0d4cda. Exact identity/manifests/browser/package evidence linked in coherent-closure/candidate-identity.json and candidate-07f844a-* files. Scope is current browser lane, not whole browser catalog. No root incorporation, independent review fabricated, or baseline gate waiver.

### Scoped lineage repair (not diagnostic export)

Candidate0b9dd98f641d4981af9b4e2ff1441503a885c2e1/treefa7e2b19557ffeccabd7c4ec0a134148945ea759 descends existing dedicated ede667f chain rooted03ec5c1. Explicit17paths; unknown peer bitwiseBinary import/evaluator and watchdog expansion excluded. Five overlays Executor assessed via before/diffs in overlay-source-review; independent Reviewer approval still pending. Focused native/public/parser487/487/type0/diff0 proc-542c349904a4. Fresh exact225 serial1/default30/native180 proc-75dbc695c366 exit1:223completed/2fail/0timeout/drift0; native prerequisites0 (91.932/.265/.565s). Baseline LIMIT/filter and IN-affinity remain failures.

Build attempts proc-35d3b5d9cd3b and proc-4918251970b6 failed missing candidate-local TypeScript package; first copy put package contents at node_modules root (absent destination), corrected package-directory copy. These failures are input closure, not product errors. Final proc-094e2535443a type/build/package/browser chain0 (preceding diagnostic ls error retained); package33modules/68files SHA256384e88727e68b74e963f0578c7485483fb4c088ac8932e3706ac4b2381d94acf; current Chromium40/40. Root stage index byte-equal. Exact scoped-0b9dd98-* identity/gates linked under coherent-closure. No root incorporation/independent approval or baseline waiver claimed.
