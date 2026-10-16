# Linked JSON production integration — card-m-f-k

Base production HEAD: `28484d04dfb4f3a01b62bd09f23b903259e433df`.
This is working-tree integration, not committed delivery or zero-gap acceptance.
Earlier experiment provenance and attempts: [[card:card-m-f-k]] status versions482/485.

## Diagnosis / source matrix

| Pinned owner | TS ownership / regression |
|---|---|
| select.c selectExpander / cannotBeFunction; json.c jsonEachConnect | resolve.ts genuine module union/enrollment, catalog precedence/hidden fields; module-enrollment and hidden-source tests |
| where.c whereLoopAddVirtualOne/whereLoopAddVirtual/whereLoopInsert; json.c jsonEachBestIndex | new where-json-loops.ts candidate/prerequisite masks; where-plan shared insertion; json-virtual-candidates test |
| wherecode.c selected VFilter/VNext; select.c selectInnerLoop | vdbe.ts compileInnerTableSelect register row production, positioned argv, LEFT replay and close |
| expr.c sqlite3CodeSubselect | compileWideSubquery linked plan/Once/destination/normalized LIMIT; correlated-json-exists and scalar-linked-context tests |
| select.c AggInfo and tag-select-0488 materialization | selected sourceRow captures eleven module slots; retained physical producer fills real ephemeral cursor before scan |

Integrated four source files and two test files from the existing typed-consumers experiment after exact production-before comparison. No new experimental clone. schema.ts unchanged. Remaining rootPage0 declarations describe recursive or actual retained physical ephemeral producers, not JSON modules. The retained mixed aggregate caller initially failed to fill its physical ephemeral owner; fixed in production, not by making the JSON declaration a B-tree. Candidate adapter does not implement IN/LIMIT virtual terms/orderByConsumed. No service/config changes.

## Commands and observed results

Process logs live under `work:///cards/card-m-f-k/processes/<id>/stdout.log` (stderr counterpart where returned).

- proc-c1952c760416: `npm run typecheck && node --experimental-strip-types --test` seven focused files (correlated-json-exists, json-virtual-candidates, json-table-plan, where-plan-foundation, without-rowid-primary, aggregate-group-lifecycle, json-aggregate-paths): clean tsc, exit0. Full log retained.
- proc-b76f35a1e7fb: explicit `--test-name-pattern='correlated JSON EXISTS retains' test/conformance/correlated-json-exists.test.mjs`: **3/3**, public Fetch, all encodings, metadata and reset.
- proc-4cdeaa144a52: `node --experimental-strip-types --test test/value/*.test.mjs test/conformance/*.test.mjs test/parser/*.test.mjs`: exit1,6526 tests,6012 pass,509 fail,5 skipped. Missing CHINOOK_DB and card-local native captures are observed among failures; this has NOT been established as the explanation for all509 failures. Full log requires triage; no full-suite green claim.
- proc-84a9f48101b2: existing common-checkpoint observer aborted on finalize rethrow after `page number outside database` in retained physical CTE + JSON aggregate. Disposed observer now catches finalize/close errors so it records all cases, not masks execution errors.
- proc-3de33ac5e4ba: observer completed; retained CTE failure reproduced across encodings. Source comparison found compileInnerTableSelect opening resolution-only physical rootPage0 without filling its producer.
- proc-d735d44adfdb: first repair tsc exit2 (nullable/string column collation not KeyInfo BuiltinCollation). Used existing transientResultCollations semantic owner; no type widening.
- proc-4b07cba60d01: clean tsc, observer exit0. Retained CTE + JSON aggregate now matches native typed values and full metadata across encodings/two resets. Common36 matrix:30 matches,3 truthful unsupported derived-window compositions,3 pragma_table_info lookup errors. Existing native capture reused unchanged; this is not the original18 matrix or new native execution.
- proc-f538bd0424e1: seven focused suites after actual-ephemeral repair and committed-file regression addition: **285/285**, exit0. New retained physical aggregate regression covers three encodings/two resets.

Artifacts: `work:///cards/card-m-f-k/nested-json-production-integration/` has exact before snapshots/diffs and `oracle/{native.json,probe.mjs,public.json}`. Original observer source is nested-json-current/trace-probe.mjs. No blanket staging/reset; preexisting staged/unstaged/deletions retained. No delivery commit yet. Remaining: full failure triage, original18/native/Once/resource matrix completion, complete accumulated delta review and coherent scoped commit. Passing focused reproducer establishes this workflow node's repair result only.

## Retained scalar aggregate enrollment correction

The no-FROM scalar caller's ungrouped and grouped aggregate branches now use
`resolveTransientArm` rather than bare catalog expansion. This restores pinned
select.c:selectExpander's derived/CTE metadata enrollment before resolution,
leaving the existing aggregate coroutine owner to execute the retained producer.
No alias/SQL-text exception, new evaluator, or change to Once is introduced.
The focused existing regression now checks its first five vectors (empty/nonempty
producer, HAVING, consumer LIMIT 0 and OFFSET 1) with typed rows and two resets.

proc-2f00f368f0fe reproduced prepare `no such table: d` (exit1).
proc-eb19ac3329d3 passed original focused test after repair (exit0).
proc-6135b6f2a2a8: typecheck clean; scalar-child plus correlated-json-exists and
json-virtual-candidates:278/281, three failures. Two are correlated aggregate
identity loss (`a`), one is a stale source-shape assertion expecting the old
inline nonaggregate scan call instead of compileWideSubquery; neither is
established fixed or attributable by this check. The former ORDER ordinal
prepare failure now passes. proc-f101c63b66a1 passes expanded five-vector focused
reproducer. This is working-tree evidence, not delivery or zero-gap closure.

## Immutable-view aggregate carrier repair

Accepted red v505 isolated `resolved correlated column lost identity: a`. The
aggregate immutable-view branch substituted SELECT reductions but forwarded the
pre-substitution linkedPlan. Unlike pinned select.c:substExpr/substSelect's column
owner substitution, binding then paired transformed trees with obsolete carriers.
The branch now resolves the substituted SELECT through resolveTransientArm and
retains all other enclosing VM/destination fields. No evaluator or SQL exception.
Existing public nested-view and full scalar destination matrix both pass (2/2,
proc-09ae81d990da), including typed results, names and two executions/reset.
Updated source-control tests verify shared wide producer delegation and explicit
post-substitution plan replacement, rather than deleting ownership checks.

proc-0c01e6dc9776: typecheck clean,280/281; remaining failure was the existing
view source-control assertion requiring unchanged parent forwarding—the exact
defect repaired. Updated it to require transformed plan plus retained parent.
Final affected verification is recorded in current card status. These observations
close the three v505 affected failures only; native original18/resources/commit
and wider regression attribution remain open.

## Recursive window scalar register binding

After accepted status514, existing `select-linked-scalar-preparation-owner.test.mjs`
reproduced recursive `first_value((SELECT q.a FROM t1 u LIMIT 1))` returning
NULL instead of INTEGER 1/3/5. Source comparison: pinned window.c
`selectWindowRewriteExprCb` moves producer columns into the ephemeral input;
`windowReturnOneRow` initializes NULL then reads the stored argument for the
frame. The consumer was not the divergence. TS window lowering already supplied
`groupedPayload + columnIndex` as a register location to scalar expression
binding, but `bindResolvedExpression`'s window-source/filter early return ignored
register locations and read the synthetic source cursor. It now preserves the
existing register/affinity/collation branch, keeping the cursor adaptation only
for non-register locations. No new evaluator, algorithm substitution or SQL gate.

Changed production: `src/internal/vdbe.ts`; current guide/map updated. Existing
regressions retained (no duplicate test). proc-515c57a8f400: isolated recursive
supported-preservation selection exits0, including original reproducer and
aggregate/empty/LIMIT/frame variants. proc-15f580b3ce23:
`npm run typecheck && node --experimental-strip-types --test` scalar-linked-context,
select-linked-correlated-owner, select-linked-scalar-preparation-owner,
select-destination-atomic, select-scalar-linked-owner, select-scalar-child:
clean typecheck, exit0,220/220. Two public executions/reset and typed values are
checked by the existing preservation test. Output:
`work:///cards/card-m-f-k/processes/proc-15f580b3ce23/stdout.log`.
Only implementation hypothesis was producer binding losing register ownership;
it converged directly. No fresh native oracle, full-suite attribution, all-encoding
expansion or committed delivery claimed. Original broader obligations remain open.


## Common36 baseline attribution after status547

The remaining six nonmatches are **not one expression-lowering defect**. An
isolated `git archive HEAD src package.json` at
`28484d04dfb4f3a01b62bd09f23b903259e433df`, executed by the unchanged observer
and unchanged native capture, establishes:

| HEAD → current working tree | Cases (three encodings) |
|---|---:|
| typed/full-metadata match → match | 27 |
| honest derived JSON/window unsupported → same unsupported | 3 |
| metadata PRAGMA aggregate match → prepare lookup error | 3 |
| correlated JSON EXISTS lookup error → match | 3 |

Thus the derived-window boundary is baseline, but the pragma lookup error is an
actual accumulated-delta regression; it cannot be dismissed as fixture setup or
inferred to be an original expression-lowering omission. No owner scope exclusion
is asserted for table-valued PRAGMA at product level.

Source comparison: HEAD `compileAggregateSelect` retained a metadata-specific
AggInfo input adapter, a synthetic NameContext descriptor, and a
MetadataFilter/Next producer. The index deletes that adapter and narrows metadata
module handling; the working tree does not replace its aggregate enrollment.
Current aggregate resolution therefore reaches catalog lookup and fails before
Filter. Pinned `pragma.c:pragmaVtabConnect` declares the module schema and
`pragmaVtabFilter` clears cursor state before argument conversion/statement
execution; `select.c:selectExpander` establishes source ownership before aggregate
analysis. Simply changing the error, treating the module as a physical B-tree,
or replaying the removed descriptor adapter would not close that fidelity gap.
A coherent next repair is genuine metadata module enrollment with its existing
Filter/Next producer feeding shared AggInfo input, preserving catalog precedence,
argument dependencies, reset/close and public metadata. This must be reconciled
with the staged metadata removal before delivery, not restored wholesale.

Evidence: proc-4c811538b71b archive observer exit0;
proc-bd9d855cfda5 complete 36-item baseline/current classification comparison.
Both used the retained pin-checked native capture, not a fresh native execution.
Card-work `matrix-attribution/current/public.json` is **baseline** output (the
folder name is not source identity); current comparison input remains
`red-composition-evidence/public.json`. A separate index-only experiment
proc-172c6df87e83 failed to import absent unstaged `record-pack.ts`, before any
case ran; no index-only SQL result is claimed. This also shows that the index
alone is not a runnable delivery snapshot.

Fresh preservation check proc-ece7302c1a59: clean `npm run typecheck` and36/36
for select-entry-context, expression-subquery-composition and
or-correlated-in-lifecycle-review. Actual test exit status propagated. No runtime
repair, full-product green, original18 closure, committed-source check or coherent
MAIN commit is claimed by this attribution step. Existing reproducers preserved.

## Metadata aggregate declaration repair

Continuation after status550 repairs the attributed common36 metadata aggregate
regression, not baseline derived-window breadth. `pragmaVtabConnect` declares
visible columns then hidden arg/schema before SELECT aggregate analysis;
`pragmaVtabFilter` clears prior state before converting/executing arguments.
The working-tree deletion had removed the AggInfo input bridge without replacing
its declaration enrollment. Restoring a fake rootPage=0 table was rejected.

`resolve.ts` now enrolls a genuine `metadata-module` declaration for table_info /
table_xinfo, preserving real catalog/view precedence, hiddenness and allocated
empty hidden type strings. Physical narrowing in `where-plan.ts` excludes both
module families; metadata is not sent through JSON BestIndex. `vdbe.ts` feeds
existing MetadataFilter/Next payloads through the shared AggInfo input seam and
leaves WHERE initialization/residual evaluation with the producer. The bounded
bridge reuses the prior payload projection approach; it is not a second evaluator
or general vtab planner. Existing Filter/Next cleanup ordering is unchanged.

Commands/results (working tree, no commit):
- First `npm run typecheck` proc-f6d38a5df2fb failed because physical planner guards
  narrowed JSON only; proc-6bdeb8993cdf narrowed that to one union-narrowing error.
  Corrected physical guard; clean typecheck later included in proc-04e2604661ff.
- Initial observer proc-ef46c74b96e8 failed before SQL: missing output native.json.
  Copied unchanged retained capture (no new native execution), then ran
  `COMMON_CHECKPOINT_SOURCE="$PWD" COMMON_CHECKPOINT_OUTPUT="$SAIVAGE_CARD_WORK_ROOT/metadata-aggregate-repair" node --experimental-strip-types "$SAIVAGE_CARD_WORK_ROOT/red-composition-evidence/probe.mjs"`.
  proc-b75acf022d10 exit0; complete public.json independently counted36:
  **33 typed-row/full-metadata matches,3 baseline truthful derived-window unsupported**.
  All three pragma cases now match (previously lookup errors).
- `npm run typecheck && node --experimental-strip-types --test test/conformance/expression-subquery-composition.test.mjs test/conformance/or-correlated-in-lifecycle-review.test.mjs test/conformance/select-entry-context.test.mjs`
  proc-04e2604661ff exit0: clean tsc,39/39. Added all-encoding correlated
  metadata grouped aggregate typed rows/full metadata/two resets and recovery.
  The final unsupported-error-class change in where-plan is separately rechecked
  below; neither this focused green nor common36 is whole-product acceptance.

Changed in this continuation: resolve.ts, where-plan.ts, vdbe.ts, existing
composition regression, current guide/source map and this evidence document.
No index manipulation, commit, deletion restoration, or experiment promotion.
Original packaging/attribution/independent-review obligations remain open.

Final current-source checks after catalog-precedence admission guard:
proc-6d8f3d0d8a77 exit0, clean typecheck and39/39 (complete summary read from
its stdout artifact). proc-436770c5da57 exit0 reran the same observer and
independently read full JSON:33 matches/3 baseline unsupported; each pragma
case has rowsMatch=true, metadataMatch=true and2 runs. Artifacts remain under
card-work `metadata-aggregate-repair/`. No fresh native execution is claimed.


## Scoped committed-input delivery candidate (following accepted v559)

The delivery gap is addressed through a separate Git index initialized from HEAD,
not by committing the mixed main index. The candidate contains eleven production
inputs (including both actual JSON planner modules), focused current guide/map
sections and existing regression files. `schema.ts` contributes only hidden-column
identity, not the unrelated STAT4 sample conversion delta; the unrelated
select-compiler extended-error-code delta is excluded. The existing pragma module
implementation is required by current resolve/vdbe imports; its bounded metadata
surface and index.ts removal of the superseded database-list bridge travel together.
No module rootPage descriptor, second evaluator, placeholder dispatch or experiment
clone enters the candidate. The bounded planner source comment is now labeled
bounded rather than experimental; missing virtual IN/LIMIT/orderByConsumed support
remains an explicit boundary. Baseline retained physical rootPage=0 declarations
are not module declarations and still require real producer materialization.

Candidate export is a `git archive` tree under card-work
`scoped-delivery-candidate/source`; it contains HEAD plus only selected blobs,
not the mixed index or unstaged source. Independent checks against this export:

- proc-e6191d3a390a: `npm run typecheck`, exit0.
- proc-ccc7e05d3d06: eight composition/entry/scalar/JSON candidate/CTE owner-resource
  suites, **347/347**, exit0.
- proc-9d92a6c0a229: thirteen linked scalar/destination/RIGHT-FULL/aggregate/JSON
  cleanup suites, **430/430**, exit0.
- proc-025a53be6d4c: existing `subquery-view-foundation.test.mjs`, **184/184**,
  exit0. This executes the original eighteen scalar/EXISTS/IN/error/reset vectors
  beginning `scalar-constant` through `reset-rebind-correlated`, using retained
  native typed cells and full column metadata across all three encodings. It also
  executes the explicit uncorrelated Once versus correlated no-Once opcode control,
  frozen cleanup/rebind/sorter controls and further admitted derived/view cases.
  This is a fresh public replay of retained native evidence, not a fresh native run.
- proc-5b024ae77b14: derived aggregate, retained group and ordered JSON resource
  suites with their declared COMMON_CHECKPOINT_OUTPUT=common-red and
  RETAINED_GROUP_EXTENDED=group-extended inputs, **108/108**, exit0. Saved first
  error/refund/reset/rebind and live scheduler abort/deadline controls included.
- proc-b10e3257a91c: unchanged common36 observer/native capture against the export,
  **33 typed/full-metadata matches, 3 baseline unsupported derived-window cases**;
  no other mismatch. No new native execution. Full JSON retained at card-work
  `scoped-delivery-candidate/oracle/public.json`.

Commands use `node --experimental-strip-types --test` with the filenames above;
exact invocations and process results are also in the card status. Logs and the
candidate tree/index/inventory are retained in `scoped-delivery-candidate/`.
Historical full-suite 509 failures remain revision-bound, not current attributed
regressions. These focused current checks improve changed-owner attribution but
are not a completed full-suite audit. Independent accumulated-delta review is
still required after delivery. Do not infer product-wide compatibility or a
zero-gap guarantee from these checks or expand the baseline unsupported windows.

## Reviewer repair integration

Owner integration on aa8d484c050e9edfa9c89660bb1523facf8dac84 preserves the mixed main index. Reviewer [[card:card-m-f-d]] status541 supplies authorship; this is not independent approval of those fixes. Runtime inventory is exactly five vdbe hunks (2248 COLLATE,2261 physical IPK/rowid,4050 compound Exists,4074 no-source Exists,6399 independent module rowid caller). Runtime SHA256 cdb1d08a60b7c3a612fef7c586d9e10e2c08d88eb0b2499f212a9d0d495c9500. Source comparison: select.c SRT_Exists stores integer presence and exits via LIMIT, unlike Mem projection; current branches suppress EList while retaining prepare validation, WHERE before OFFSET, initialized result/Once, zero guard and source-order compound counters. Physical metadata negative index consults IPK before implicit rowid; module rowid is separately supplied. No algorithm substitution.

Included actual workspace bytes: vdbe, expression-subquery-composition, json-mixed-ordered, json-producer-close, json-table-functions, stage2-diagnostic-runner. Deleted-in-index/untracked replacements are read as actual files, not deletions. Companion SHA256 17412253c1522c4268c31f8187aacb7adb3226bcc28ad0ae28cb296feec6d564. Accounting's generator/cases/ts-accounting ONLY come from f9668ad7f32eb2b7fda4e5470e0dd0cb74f401f8 (tree d8e518ee5ceaebdaf6a28c5078ed9f63bad68f34). Guide/map/audit contain scoped owning integration additions on HEAD, excluding unrelated peer rewrites. API unchanged: no public contract expansion. JSON planner modules are existing production dependencies, not placeholders; no experiment files enter this patch. All other main-index changes/deletions, unrelated API/docs changes, schema STAT4 and select-compiler edits excluded. Main-index byte comparison required after CAS delivery.

Fresh isolated HEAD export plus precisely selected files: proc-f88e188641de exit0 under set-eu, npm run typecheck; node --experimental-strip-types --test expression-subquery-composition, json-mixed-ordered, json-producer-close, json-table-functions, stage2-diagnostic-runner, stage2-assertions, diagnostic-match, ts-accounting:230/230, no skips. npm run test:conformance:accounting passes including deterministic generation and first-select38+9 preservation. Logs under card-work reviewer-integration/{typecheck,focused,accounting}.log. This executes the original all-encoding failing reproducer and its later WHERE/LIMIT/OFFSET/compound/validation/scalar controls. No fresh native run. Implementation hypothesis converged by integrating the named reviewer repairs, not inventing another evaluator.

Historical broad result remains6810=6792/13/5, not rerun or green. Inspected complete failing tail of work:///cards/card-m-f-d/verify-metadata/full.out (573000 onward) and owning consumer initializers. Exact thirteen attribution: aggregate-group-chinook-regressions, aggregate-where-chinook, cte-chinook-lead require CHINOOK_DB; canonical-c1-c6-checkpoint reads undefined CHINOOK_DB (fixture initialization). derived-aggregate-resources and derived-order-limit-aggregate require COMMON_CHECKPOINT_OUTPUT; retained-group-native-public and retained-group-resources require RETAINED_GROUP_EXTENDED. where-operand-admission-public occurs twice (direct and skipscan import), both missing d/r1-native/capture.json; where-order-consumption-public missing d/r2-native/capture.json. Skipscan after-hook GE assertion follows the missing imported capture before SQL runs, thus unexercised control, not established runtime divergence. Those12 are external fixture/setup failures in that invocation, not evidence of baseline semantic parity or of absence of regressions. The13th is stage2-diagnostic-runner obsolete default expectation assertion, in-scope and now replaced/passing. No scope expansion to manufacture fixtures. Prior no-index --check exit1 without whitespace diagnostics remains a diff-status qualification, not a successful overall command. Independent source/caller, cleanup-budget and whole-brief acceptance remain separately assigned; selected checks do not certify all lowering or planner behavior.
