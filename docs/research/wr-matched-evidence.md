# WR selected matched access — implementation decision and evidence

Input: integration2c5937a0; native-first red evidence [E166](record:///status.md?card=card-s-c-d-e&v=166). Scope: exactly two physical sources, rowid LHS and WITHOUT ROWID RHS, one RIGHT/FULL barrier without USING/NATURAL. Existing up-to-three rowid admission is unchanged. Wider/WR-LHS/repeated/module cases remain implementation backlog, not product exclusions.

## Source-to-caller decision (before consumer implementation)

Pinned SQLite3.53.4 bf7c7f3 `where.c:7393–7418` allocates per-level pRJ and complete primary-KeyInfo match set; `wherecode.c:2170–2186` disables covering omission under WHERE_RIGHT_JOIN, extracts secondary PK slots in primary-key order and positions primary with NotFound to addrCont. `2190–2198` excludes pRJ from partial-index residual elimination; `2740–2772` stores complete PK with Found/IdxInsert before post-match WHERE. The primary reader remains the shared interior reader; `sqlite3WhereRightJoinLoop` independently positions the unmatched scan and calls the same continuation. Existing exact membership (without optional Bloom prefilter) remains the semantic owner, not a new set/evaluator.

Current TS already has PhysicalIndex.primaryKeyFields, primary-reader layout, per-level complete-PK KeyInfo sets and fresh drain positioning. The missing contract is admission plus the selected RHS caller: it currently emits DeferredIndexSeek (which uses >= and throws for absent seek) instead of the pinned immediate exact NotFound/continue path. For this slice use existing emitWrPrimaryPosition, preserving miss-to-current-level-continue, and read the complete selected physical PK in primary order into existing match registers. Keep logical REAL expansion on identity reads, existing collation/encoding/sort KeyInfo and no residual omission. No fake rowid/hash/parallel evaluator or exceptional substitution is proposed. Ordinary WR INNER/LEFT lowering is not changed here.

Source inspection and branch comparison: conversation proc-e6ad296e0831, proc-248562e634f7, proc-7c2ac52dabd4 and proc-b38439535885. Actual selected caller uses original source ordinals; two-source barrier prerequisites force that order. RHS columnAccess already disables selected covering substitution, so ON/result/shared drain stay bound to primary. Complete-PK semantic support is retained, not retrospectively credited as selected execution.

Shared ownership: current [[card:card-t]] status28 says no conflicting active implementation and no overlapping work will be initiated during the routed repair; its affirmative edit permission specifically concerned ordinary-derived integration, not blanket WR approval. This change stays within E's WHERE selected-access caller ownership: immediate primary positioning, physical identity extraction and continuation patching, with no resolver/import/transient-producer refactor. Integration HEAD/index checked clean on these paths; unrelated peer/cache work preserved.

## Verification

Author validation: native-first capture proc-5d2d9bbd5b0d (42 typed cases across three encodings, pin/library hash/fixture hashes/EQP retained in wr-matched-native.json); initial public expanded regression proc-822b2effa622 exposed a primary-index descriptor with no secondary-tail mapping. Corrected descriptor check to require secondary mapping only for secondary access; existing primary helper already returns no positioning operation. Subsequent proc-d763c29186be passed3/3. Source comparison also caught distinct jump vs p2 patching: exact NotFound continuation now has its own typed jump patch list, not generic p2 jumps.

Focused commands use `node --experimental-strip-types --test --test-concurrency=1` and `npx tsc --noEmit && git diff --check`. Proc-2fe23f74f3d6 passed47/47 (WR semantic width/mixed, rowid2/3, current real STAT4 file23/23, new WR selected/lifecycle), tsc/diff passed. Proc-34aff646f213 passed315/315 (planner analysis, rowid selected safety, residuals, new WR selected/lifecycle), tsc/diff passed; these checks overlap, not additive coverage. After exact miss continuation fix and selected corruption/LIMIT0 controls, proc-968e8ad1fbe4 passed6/6 plus tsc/diff. New public tests run42 cases twice/reset, assert actual selected wr_c RHS and positive indexSeeks for forced/unforced cases, scan controls zero seeks, typed native rows; selected lifecycle tests cover abort/deadline/work saved-error identity/reset/finalize, recovery, zero-entry capacity and observed private-budget refunds. Damaged wr_c root3 (verified pinned sqlite_schema) errors on required selected access; LIMIT0 avoids the damaged page.

Native NOT INDEXED still selects wr_c; TS chooses its primary scan. It is semantic-only comparison, not optimizer parity. The unary-plus control independently removes the equality search in native EQP and TS (zero indexSeeks). The earlier mixed/empty/native-corruption evidence gaps are superseded by the boundary follow-up below, not by semantic-only tests. No full compatibility, independent review or full/package/browser gate claim. Shared edit coordination record is limited as stated above; no fresh T response was obtained.

### Final follow-up author gates

On the final drain-covering guard input, proc-fa58b2facb57 passed60/60 plus tsc/diff: rowid selected/safety/residual, WR joined and all new boundary/lifecycle tests. Two requested paths in that invocation (`where-analysis.test.mjs`, `where-stat4.test.mjs`) do not exist; Node silently did not run them. Correct real paths were then run separately: proc-c5b52104f5c3 passed302/302 plus tsc/diff, including `where-plan-analysis.test.mjs`, `stat4-keystats.test.mjs` and new WR tests. Counts overlap, not additive. Proc-001a58aae814 additionally passed198/198 (repeated/nested RIGHT/FULL and WR joined/collation) plus tsc/diff. Supplemental nullable-OR gate did not pass: proc-c181064232b9 was interrupted after ~83s in or-wr-right, with four earlier passes and later files cancelled; proc-f33a22b16ab6 hit the original60s test timeout and required termination of its lingering server. No increased ceiling or passing claim. A bounded same-SQL public reproduction with maxWorkUnits10000 fails limit on changed input (proc-7119e7b5c406) and on a disposable git-archive of unchanged3bbbe684 (proc-f14da05e4922). This establishes a pre-existing work failure at that bound, not the timeout's exact cause or its resolution. Nullable-OR fallback remains a qualification for entire-delta review.

### Consolidated-candidate validation

The original missing-fixture diagnosis is resolved through existing
`SKIPSCAN_NATIVE_ROOT`, not checked-in generated databases or a production bypass.
Existing pinned capture.py, capture-primitive-companions.py and
capture-corruption-companions.py produced disposable base/primitive/corruption
fixtures; each producer checks source identity. Initial partial wiring exposed
four additional missing prerequisites (not semantic failures). Once complete,
proc-44b997bf3cc8 passed42/42 and chained typecheck/diff checks. The unchanged
serial broad selection proc-5bd7c50a0a53 passed1155/1155,151546.792604ms with
file60s/batch600s. The old error injection still intercepted generic seek rather
than exact primary membership; it now patches seekExact, with the same error
identity, cleanup-once, reset/finalize assertions. Proc-097e75375ec0 passed91/91
plus typecheck/diff. The broad run precedes that test-only correction; it is not
post-commit evidence. Exact commands/logs and remaining acceptance are in
[[card:card-s-c-d-e]] status. Postcommit proc-aa67fc7a4110 passed1161/1161
plus typecheck/diff/index and all18 owned hashes on981967ea. Supplemental
proc-d86bede1ac80 passed64/64,33181.813495ms, plus typecheck/diff after wiring
the declared fixture environments. These overlapping selections add no upstream
credits. Full stable-delta independent acceptance remains required.

### Finite family-ledger reconciliation

The located historical whole-brief finite ledger is
[G60](record:///status.md?card=card-s-c-d-g&v=60), accepted on70d045af,
not981967ea. It is qualitative, not a numerical SQLite family denominator;
`card-s-g/COVERAGE.md` is a separate skip-scan artifact. No credit or denominator
is changed here.

- Prerequisite/dominance and invocation-owned residuals: planner/resolver owners
  are unchanged in981967ea. Historical source adjudication stays attributed to
  G60, while current where-in-loop tests exercise the changed NULL target owner.
- Scalar/vector direction, NULL/empty, first/next/restart and range termination:
  LEFT initial IfNotOpen versus EARLYOUT IfNoHope continuation changed. Current
  direction/vector target matrix and public three-slot/LEFT cases cover that
  correction. The64-test supplemental gate adds affinity, earlyout, correlated
  rebuild, persistent reuse and selected/offpath corruption in all encodings.
- Nested substitution/shadow, retained star, GROUP/HAVING/aggregate and both
  retained destinations: producer/lowering owners are unchanged. Supplemental
  derived/grouped/retained-limit wrappers exercise affected primitive consumers;
  this is not re-review of every aggregate or retained-source branch.
- Native/error/lifecycle foundations: comparison, payload demand, movement
  invalidation and register borrowing changed. G60's unchanged-owner reuse cannot
  certify them. The1161-test gate provides current representative malformed,
  local-overflow/cache/work/capacity/refund, WR/OR/rowid2/3/partial/qualified/STAT4
  evidence;64 supplemental tests add selected RHS movement/error/lifecycle
  consumers. Direct C terminal-header adjudication and EOF's source-owner guard
  are not fresh damaged-page native or dynamic EOF oracles respectively.
- Documentation/delivery: affected guide/map/API/audit/conformance and18-path
  commit are delivered. Ordered-register-list quadratic tradeoff and unsupported
  compositions remain disclosed. G60's historical118+8/package evidence does not
  certify the current candidate or installed-browser behavior.

This reconciles the finite ledger with changed owners and author regression
coverage; independent entire-delta approval remains outstanding. Universal error
timing/plan identity and whole-product/browser compatibility are not claimed.

## Persistent primitive consolidation — author decisions

Retain probe-only payload parsing: pinned IndexMoveto parses binary-search probes,
not every unvisited payload. Page/pointer/descent/depth/cycle checks remain at
acquisition. Unvisited corrupt payload need not fail early; selected/off-path tests
own that boundary. Retain cursor-owned initialized Page/ancestor paths, not global
FIFO or cross-cursor positions; immutable bytes are database-owned, movement checks
open/current cell identity and clear/close discards positions. Retain default_rc0
exact leaf/interior exit for membership only; a miss GE position is not success,
and the caller branches before record publication. Rightmost restart requires a
strictly smaller first key: this boundary API lacks native nearest-cell+pRes
adjustment, so equal-prefix seeks restart at root. This conservative shortcut
restriction costs descent, is not platform necessity or full IndexMoveto parity.

Retain RawRecordReader serial/offset advance and direct INTEGER/TEXT paths:
RecordCompareWithSkip advances offsets without constructing each Mem. Short varint,
small serial and signed <=32-bit Number-to-BigInt branches preserve exact bounds;
wider integers retain BigInt assembly. Mixed/REAL/NULL/BLOB paths retain Mem fallback,
DESC/defaultRc/eqSeen and budgets. Per-call packed subarrays do not escape their
owned payload; overflow reconstruction remains. No local-page copy intervention
has useful wall evidence and none lands. Retain private per-call text conversion,
not RHS mutation/cache; utf.c's UTF16 surrogate formula, dropped odd tail and
2*n+1 allocation keep terminator outside counted view. Other encoding conversions
retain temporary Mem. Retain synchronous Found/NotFound register slice borrowing
(vdbe.c5365–5405 r.aMem), no await; finally releases descriptor only, while other
keys retain owning release semantics.

CursorRecord remains OP_Column's demanded serial-prefix cache, not generic unpacking.
Terminal payload/header consumption checks precede publication. Source comparison
with vdbe.c next_tail found Next/Prev and IndexNext/IndexPrev left stale records on
EOF: now record/rowid invalidation precedes movement, including DONE. NullRow and
reset clear maps/positions; success replaces records. A source-owner EOF guard and
public join/reset controls cover affected owners, not exhaustive cache parity.

Continuation broad run proc-1942b485622e reached1118 tests,1108pass/10fail,
144878.588941ms across a source edit; it remains nonpassing, unstable-input
 evidence. Delivered miss/error interventions now target seekExact; missing native
companions were generated through their declared contract. Source/baseline
adjudication repaired LEFT NULL continuation and derived private capacity
expectations from removed iterator/subview capabilities, not a leak. Final1161/1161
verification applies to the stable committed input, not that run. Detailed failed
hypotheses/source comparisons remain in E193/E197/E198 status; no family credit
increases from these local/source primitive tests.

## Selected boundary follow-up

`wr-boundary-capture.py` uses the same independently built pinned library, validates manifest SourceID and records actual library hash in `wr-boundary-native.json`. Six embedded fixture identities cover three encodings and physical empty/nonempty rowid LHS. WR primary has two no-affinity fields, first DESC/NOCASE; data crosses INTEGER/REAL/text/BLOB, NULL search/payload and NULL-extended outputs. Native explicitly rejects NULL PK (constraint19); NULL is not a legal WR PK identity. Eight queries per fixture cover RIGHT/FULL forced/unforced and ON/WHERE, with actual native wr_c search EQP, typed storage classes, column metadata and twice/reset equality. Selected physical descriptors assert PK order a,b before comparison. These are representative boundaries, not arbitrary-layout coverage.

Native-first damaged wr_c root controls save rc11/message/reset rc before public assertions; LIMIT0 and an independent rowid-table-only scan return DONE. That off-path control intentionally proves the damaged index is not consumed, not a NOT INDEXED spelling claim. Same-size Alpha→Alphz edit solely in the secondary leaf makes one stale PK. Native forced/unforced matched/drain queries complete without error; the primary row still exists and appears only through its own valid drain identity. The public stale-secondary regression originally failed on forced RIGHT in all encodings (proc-f7bfc614bbc4; focused proc-1deace7f5272): fresh drain cleared jointype and consequently selected DeferredIndexSeek, which threw instead of continuing.

Branch comparison with wherecode.c2170–2186 and2914–2920: copied drain source has jointype0 but sqlite3WhereBegin carries WHERE_RIGHT_JOIN, preserving primary-reader/exact NotFound behavior. TS previously retained only jointype, losing that control input. `rightJoinDrain` now carries it through the existing recursive caller; both matched and drain use the same existing exact primitive/current-level miss list and no covering substitution. No runtime seek algorithm replacement or unrelated INNER/LEFT rewrite. Scope remains the owned selected WHERE caller; no peer resolver/producer edits.

Capacity now admits one matched identity before rejecting another (`maxPrivateEntries:1`), checks positive selected work/live reservation, saved error on repeated step/reset/finalize, reset retry with a new saved error and full observed refunds. Original zero-entry/interruption controls remain. Initial new mixed/empty/corruption six tests passed proc-cc3de18bdfc6; adding stale PK exposed3 failures above. After source repair proc-b110264ff5d6 passed12/12 plus tsc/diff (before final drain covering guard); final combined gates recorded in current card status. Native captures proc-81007ce56e64 and proc-f70a7eec9770 exited0 before respective public tests. Results are author evidence, not independent acceptance.
