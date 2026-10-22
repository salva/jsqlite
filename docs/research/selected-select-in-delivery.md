# Selected scalar SELECT-IN scoped delivery evidence

## Joined direct RHS residual ownership

Author correction of independent [[card:card-s-c-d-g]] finding (accepted status45),
starting from 6f036000/tree05773cf1. The g-authored capture/test matrix is promoted
with attribution; its original13 cases are retained. Two author-added native-first
companions preserve unrelated INNER WHERE and LEFT ON predicates, including
unmatched null rows. Frozen original native capture SHA256
3442064b9ef2c5d2e79ae390e59c76a796cd68b6f33297350586e6e6205d2892
and red process proc-6d8e3ff753a0 remain evidence, not current acceptance.

Owning repair: compileInnerTableSelect publishes exact enforced equality-slot
terms into invocation-owned residual state (not immutable planner state).
wherecode.c:disableTerm419–446 / codeINTerm841 require ready prerequisites and
allow LEFT-owned OuterON but not ordinary WHERE on that LEFT level. TS maps
ordinary owning terms by structural identity across analyses; owning ON uses
retained reduction identity. Virtual/derived terms are not published, so no
untested parent is disabled. RIGHT left-of-join fence remains. No alternate
algorithm or SQL-text special case is introduced.

Attempt evidence: proc-09fd64a61db2 failed tsc before tests because a nested
ordinal helper shadowed the source ordinal; explicit source ordinal fixed it.
proc-0e272d8dfac6 passed tsc and INNER but exposed previously unreached LEFT's
same membership tail; source OuterON comparison led to exact owning-ON coding,
not a blanket outer guard removal. Original13-case matrix then passed3/3 in
proc-4a68797f577f. Added unrelated residual controls initially tripped the test's
zero-residual assumption (proc-e1dc82aa437c); exact rows/no-allocation already
passed. Companion residuals now explicitly require positive residualTests, not
zero, preserving original assertions. proc-2e4794bbcafc matrix3/3 passed but
subsequent unit paths were incorrect and exit1; corrected paths below.

Final focused command proc-28d9cdd6c356: `npx tsc --noEmit &&
SELECT_IN_REUSE_DIR=.../direct-reuse-native
SELECT_IN_NATIVE_DIR=.../select-in-affinity-native
SELECT_IN_CORRUPTION_DIR=.../select-in-corruption-native
SELECT_IN_REUSE_MATRIX_DIR=.../direct-reuse-matrix-fixed
node --experimental-strip-types --test --test-concurrency=1
 test/conformance/selected-select-in-reuse-matrix.test.mjs
 test/conformance/selected-select-in-reuse.test.mjs
 test/conformance/selected-select-in-errors.test.mjs
 test/conformance/where-in-loop.test.mjs
 test/conformance/where-in-producer.test.mjs && git diff --check` exits0,
20/20 no skips. Paths are purpose-named children of the card work root.
Matrix generator uses pinned metadata-enabled libsqlite3-metadata.so, full native
EXPLAIN and typed/five-field metadata before TS;15 cases x3 encodings.
The complete matrix reaches LEFT and useful20k selected/NOT INDEXED controls;
actual delegated arena count is zero for reuse, positive for fallback, with
positive selected work and bounded index visits/tablefetch. Existing fallback
error/ledger controls remain fallback evidence, not persistent RHS fault proof.
Stable combined timeout/drift obligations, broader OR/lifecycle and independent
acceptance remain open. No shared root edits or installed-browser claim.

## Direct scalar physical RHS continuation (author repair)

Parent3831d1fa/tree29b86af returned INTEGER ids1,3 for the pinned UNIQUE RHS
reproducer but opened two private arenas; native full EXPLAIN had no
OpenEphemeral/SorterOpen. proc-01491f6f54dd returns identical ids with opens0,
tableNext0, residualTests0, indexSeeks2, inProbes2, sorterRows0. This is a
work/control repair, not a wrong-row example.

Pinned expr.c3072 isCandidateForInOpt and3245–3438 sqlite3FindInIndex own the
scalar ROWID/compatible UNIQUE ASC/DESC choice before fallback. The descriptor
retains TableNode/PhysicalIndex identity, KeyInfo and physical direction, not a
second SELECT plan. ROWID uses table endpoints/Rowid/movement; fallback remains
linked SELECT/UNIQUE SRT_Set. Ordinary TERM_CODED admission now checks the
complete owning clause and retains unrelated residuals. An id=3 companion
checks this distinction. No algorithm substitution is introduced.

capture-select-in-reuse.py captures full opcodes, sourceid, fixture hashes,
typed rows and native counters before public execution. Three encodings cover
ROWID, UNIQUE ASC/DESC, nonunique duplicates, WHERE/DISTINCT/LIMIT/aggregate
fallback, reset/repeat and delegated arena-open observation. proc-ddcfa6c99f0d
passes10/10 with linked producer controls. After sourceid/residual additions,
proc-82fe03e368c6 and proc-d4cd203bd01f pass3/3. Capture SHA256
808d8c48ca6f3c7d8b35b4fe7dbc94974e5052b11b087a552821ba221977f0ad.

Failed hypotheses: initial wiring left one arena (proc-02024c07e95e), traced to
redundant residual membership. First native capture used a filtered helper that
omitted OpenEphemeral (proc-7a848e222b13); full EXPLAIN corrected the discriminator,
not native behavior. proc-642b516bd796 rejected unsupported --work-root before
running tests. First affected run proc-af755b80a2d1 had four failures: three
used older FIRST capture missing later case keys; private movement injection
assumed a page acquire after seeks, now absent with redundant materialization
removed. Construction injection stays at actual page allocation; movement now
injects at real PrivateKeyVmCursor.next after positive seeks, retaining sticky
errors/reset/retry/finalize/zero-ledger checks. WHERE v IS NOT NULL forces the
same-row fallback. proc-2a470f256100 passes3/3. These failed runs are not current
passing evidence. proc-59eb17fde57a tsc/build/package/diff-check passes; package
SHA256 523b3fcc5fc2bd0377a39837231ec096e6abe66abf520821a1899afcf4597997,
55 modules112 files, isolated browser-global VM, not GUI.

Remaining: finite direct scalar/reset/source-gate evidence is not full typed
REAL/BLOB/metadata, affinity/collation mismatch, composition or persistent RHS
movement/error proof. Prior lifecycle/error controls exercise private fallback.
Representative native-aligned seek/visit/tablefetch measurements, independent
review and combined owner integration remain due. No scope, quotas, watchdog,
planner/cache/host-sort changes. Current checks/commit identity are in card status.

## Applicability correction and attributed peer coverage on a171d4ab

Independent [[card:card-s-c-d-g]] status41 found the sole failure in its actual
104-file run (103pass/1fail, no watchdog/not_run/drift): stale residual-only
subquery-IN-RHS applicability assertion. Original typed rows and native EQP
already selected t_abcd(a=?,b>?). Current fixture disposition is selected with
historicalDisposition residual; test requires positive indexSeeks/inProbes,
no table Next, native chosen EQP and unchanged typed rows. Other residual and
unsupported controls and archived review-v6 documents remain intact. No production
code changed. Fresh baseline proc-3b7758a9f053 failed1 as independently reported;
it is not retroactively passed.

Promoted unchanged peer-authored lifecycle, errors and corruption generator from
[[card:card-s-c-d-g]] after reading all three and reviewing real interception and
finally cleanup. Attribution is peer authorship plus delivery-owner review, not
independent acceptance of our own correction. Actual PrivateBlobkeyPages.open
allocates page1/root with catch-close on failure; tests delegate real arena/VM
operations, observe real budgets, restore hooks in finally and inject before
lease retention. Native corrupt-root capture independently obtains scan rows,
selected SQLITE_CORRUPT step/reset/retry/finalize. Boundary failures are deterministic
quota injection, not allocator equivalence or malformed private payload proof.
Measured ledger is retained private-state accounting, not JS heap. Existing typed
INTEGER rows are preserved; this is not a new REAL/BLOB/metadata matrix.

Fresh capture and focused applicability/errors/lifecycle proc-19ea70cd4779:
7/7,zero skips,5.596s,exit0; corruption capture SHA256
`8746ee4a968c8636b05dcc300503cdf53d1baaf838fba78f20f834d362f7259e`,
identical to peer capture. Source pin and original fixture identities unchanged.

Combined affected-family verification proc-5843dcba80df ran the same explicit
104-file inventory as g41 via tools/test/integration.py, with explicit pinned
oracle and three fixture directories. Manifest at
`$SAIVAGE_CARD_WORK_ROOT/applicability-combined-gates/integration-run/manifest.json`:
104 completed0, no watchdog/not_run/input_drift; serial1/batch80/file60/batch600.
Batches289.351s/35.667s, slowest OR-WR-right45.633s (historical58.302s risk
remains revision-bound, not relaxed). All original assertions/workloads retained
apart from the justified stale negative corrected above. This is the affected
family, not the whole default corpus. proc-b4344c640f9f typecheck/build/package/
diff-check exit0; package SHA25610ab3e704732af3935eb127f10544d402c9a4af6c2cf98ed1d5d082cb254a836,
VM browser-global smoke, not GUI. Later changes only add these evidence words;
production and test inputs remain identical. Independent adjudication still due.

## List-IN prefix earlyout repair on 892b4ff3 parent

The accepted native-FIRST red (status54, proc-c98eac536ba3) has identical empty
rows but three TS probes instead of the one implied by native SeekHit/IfNoHope.
All three selected caller paths now emit the same physical prefix carrier after
InListValue; emitInAdvance checks it before advancing that slot. NULL list items
are already removed by the fused producer, so no branch may check uncoerced NULL;
LEFT null-extension bypasses check and movement. SeekScan and leading slots do
not acquire prefix checks. Existing list production/reset, affinity and dedup
are unchanged. This repairs missing native continuation machinery, not the
separate ordered-register list-set adaptation: upstream uses an ephemeral Btree,
TS uses bounded ordered insertion (quadratic construction), with existing limits.
There is no browser necessity claim for that retained algorithm; replacing it is
outside this continuation repair and remains a fidelity limitation.

Expanded capture20 ×3 encodings SHA256
`13ec94e7fdf3f44da5cdfaec4bb21d5082fb1dd2d00b5890fdc854ae62e84a14`,
includes original literal-list reproducer, present/duplicates/NULL, empty, NULL
prefix/LEFT, INNER/LEFT, reverse, two-slot and mixed SELECT/list. Tests retain
native typed rows, reset/repeat and exact probe bounds (absent1, present3,
NULL/empty0, joined1, LEFT5); native program rather than direct native counters
justifies work assertions. `proc-f2b044f1daf9` capture + focused3/3 pass.
Same durable test/capture on archived892b4ff3 fails0/3, actual3 vs1
(`proc-0343a71c90e0`). Initial18-case capture/typecheck/focused3/3 passed
(`proc-2282bea3b0aa`); final20-case capture adds empty and LEFT NULL controls.
No source hypothesis failed; apply_patch refused an edit and exact edit was used.
These checks are author evidence, not independent acceptance or full serial gates.
Final affected run `proc-c66a5e4db305`:311/311,zero skips,41.180s, followed by
chained typecheck/build/package/diff-check exit0. Package SHA256
`10ab3e704732af3935eb127f10544d402c9a4af6c2cf98ed1d5d082cb254a836`;
browser check is isolated browser-global VM, not GUI. Peer g lifecycle test
included without promotion/authorship claim; full80-file gates remain outstanding.

## Prefix earlyout repair on c6bc5e2d parent

Pinned wherecode.c:codeINTerm clamps seekHit to iEq only for non-SeekScan
non-leading slots; where.c:WhereEnd emits IfNoHope before movement, retargeting
NULL past the check and LEFT bypass past check plus movement. vdbe.c:SeekHit,
IfNoHope/NotFound and successful equality-prefix positioning own hit depth and
prefix-existence testing. TS physical IndexCursor retains hit depth; the selected
ordinary/join/recursive-OR callers carry original preceding registers/affinities
and KeyInfo into the shared movement emission. The prefix lookup uses existing
partial UnpackedRecordKey(default_rc0) B-tree descent, releasing cells and
invalidating position after the test, not a scan/evaluator substitution. A found
prefix raises hit depth; full equality-prefix success raises it to nEq. List-IN
register earlyout remains unimplemented; no direct RHS-index reuse expansion.

Native-FIRST generator `capture-select-in-earlyout.py` checks pinned source/version
and captures 9 cases × 3 encodings without ANALYZE (avoids SeekScan). Capture SHA256
`a5d680022c0e53edabf79f628117eda89125f190942c6a5a949ffc6eb2075d2e`.
Public earlyout test compares native rows, selected two-field native program,
positive probes, absent-prefix probe1, successful-prefix probe3, NULL/empty0,
LEFT and joined, reverse and two-slot reset/repeat. Native program justifies
probe bounds; native probe counts are not directly instrumented. Same durable
regression on archived c6bc5e2d fails3/3 (`proc-38d01bf638be`, actual3 vs expected1).
Author repair passes3/3 (`proc-a27d4f455ae9`). Original red fixture/query also passes
with probe1 and two index seeks (full seek + no-hope prefix lookup), after typecheck
(`proc-7b61cc00da7c`). Initial typechecks caught broadened dispatch union and wrong
Mem accessor; corrected types/accessor, no runtime hypothesis suppressed.

Final affected suite `proc-aa1291010077` passes311/311, zero skips,16.695s,
followed by chained typecheck, build, package smoke and scoped diff-check exit0.
Package SHA256 `57173a6493c4962b60875b728e092911cbd72ba22f283e9125f08af044dd7f4a`;
browser smoke is isolated browser-global VM, not GUI. This includes helper
continuation alignment and found-prefix hit-depth correction.
Full serial80/file60/batch600 gates and independent review
are not established by focused checks.

Author integration against mapped beta3 `494ace2f5a48b3ebee160b9d3b1712e65bea03b9`.
Immutable historical `14d15a3f1d6d69ea9ed88d7a44a01ca412acbd96` evidence was not
run on that mapping. Integration retained mapped Expression/JSON, aggregate,
RIGHT and scheduler machinery; only selected caller/producer/private foundations
were transplanted. No raw native captures are published.

Pinned SQLite 3.53.4 Fossil
`bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc` supplies
wherecode.c codeINTerm, where.c equality/IN estimates and sqlite3WhereEnd,
expr.c RHS Set and select.c SRT_Set production. Scalar SELECT keeps linked
semantic production and parameter identity. Private TS page/cursor objects adapt
representation, not set sorting or iteration algorithms. Payload copies use
bounded indexed reads rather than retaining lease subviews; callback snapshots
remain charged and finally released. Private cursor tests check retention.

Native FIRST capture: 19 cases × UTF8/16le/16be, independently obtained through
pinned native API, generated by `capture-selected-select-in.py`. JSON SHA256
`3ecc0067d3fc708b472a4f774230db1f1079fdb1fe6ec7612867e69eed6b166b`.
Artifacts stay in card work storage. Frozen in-range-stat-native.json unchanged.
Public selected-select-in-red.test.mjs compares typed rows/five-field metadata,
actual seeks/probes, reset, parameter clear/rebind, work-limit error/reset/retry
and between-row cancellation/reset/retry. Native fixtures are required via
SELECT_IN_NATIVE_DIR; tests do not silently skip absent fixtures.

Mapped integration public focused run: 3/3, zero skips, exit0, 4.718s
(`proc-9e202ba46931`); typecheck exit0 (`proc-141b4eaa07d5`). Initial transfer
command used the wrong cwd and failed with missing helpers, then was corrected;
its typecheck exit2 is not acceptance (`proc-ef5d68dbf337`). Expanded 11-file
serial run initially 141/142 (`proc-7503c2f6f704`): helper expectation omitted
intentional inProbe:true instrumentation. Corrected test expectation, not
production or oracle; public rows/work passed in that run.

Corrected serial 11-file run: 142/142, zero skips, 15.914s; followed by
`npm run build && npm run test:package`, all exit0 (`proc-57186ea7735a`).
Package test PASS: 55 runtime modules /112 files; tar SHA256
`eda2a521ed795a65933675b754802ca1d610045c3c5f5bdd6026400da26e7ed9`.
Browser evidence is isolated browser-global VM smoke, not GUI-browser execution.
Full output: `work:///cards/card-s-c-d-e/processes/proc-57186ea7735a/stdout.log`.

Current branch boundary: FIRST uses a fresh ASC ephemeral UNIQUE RHS, a native
choice; physical DESC RHS requires the remaining direct-index reuse branch, not
an ORDER BY fixture or helper-only reversal claim. Selected LHS direction remains
independent. Suspended movement cancellation/deadline and zero-private admission
pass in the peer-authored lifecycle test (workspace-only, not this delivery).
Recursive joined OR now has the finite selected affinity witness below; other
LEFT transitions, selected malformed/private-page failure and measured final
ledger cleanup still need targeted SQL evidence.
Vectors/correlation/direct RHS-index reuse remain implementation gaps, not scope
exclusions. Historical root planner262/263 is not reproduced on the candidate
(g38:302/302); 58.302s near-timeout risk and original full serial gates remain.
Original nonauthor acceptance remains necessary.

## Slot-order early NULL repair

Pinned wherecode.c codeAllEqualityTerms (949–990) produces each equality slot
and immediately emits its NULL break before codeEqualityTerm for later slots.
All three selected caller paths now do likewise, instead of hoisting all IN
construction before ordinary equality expressions. Existing level break and LEFT
nullPass continuation targets remain unchanged. No opcode/algorithm substitution.
Seek-affinity reconciliation identified in status45 is handled separately below,
not by ordering.

Native FIRST extension: 21 cases x3 encodings, JSON SHA256
`f5b9a01399776522a609143317f045aab256e06a5e2745b30822e2f92221be72`.
New null-prefix and left-null-prefix companions compare native typed rows,
native IsNull-before-OpenEphemeral ordering and repeated execution at
maxPrivateBytes0; no RHS construction can be hidden by a passing row comparison.
Generator/library/source checks remain the same. Raw artifacts remain disposable.
Baseline16be1d49 extracted with git archive into card work storage fails3/3
(`proc-036dd01e8f24`), private admission before equality bypass; repaired input
passes3/3 plus tsc (`proc-a226f20edabb`). The initial LEFT witness using outer
WHERE x.v IS NULL failed3/3 (`proc-5db4d517f4ff`); logging isolated the failure to
LEFT (`proc-b81ca0e5fcf4`). That query also evaluates non-NULL outer rows before
the outer WHERE residual, so zero capacity was not an isolated bypass witness.
Use a constant NULL parameter in the ON equality to isolate the transition; the
original native left composition remains in the preserved public reproducer.
This does not settle general outer-WHERE pushdown/LEFT ordering.

Affected serial nine-file run including public red/lifecycle/null-prefix,
loop/producer/linked/VM, selected-index controls and planner analysis:
305/305, zero skips,33.982s, exit0 (`proc-8129c12dc1ea`). Full output:
`work:///cards/card-s-c-d-e/processes/proc-8129c12dc1ea/stdout.log`.
This is author affected-path verification, not full gates or independent approval.
Earlier source rationale/commands/hypotheses remain in accepted per-card status42/45.

## SELECT-IN affinity ownership repair

Pinned wherecode.c:968–976 sets SELECT-IN equality-slot zAff to BLOB: the RHS
producer has already applied comparison affinity. TS compileSelectedInRhs computes
that affinity from original semantic fields and emitSelectedInRhs hands it to
SRT_Set. select-program.ts emitSelectDestination applies Affinity before
MakeRecord/IdxInsert. Previously all three caller affinity vectors reapplied the
comparison affinity at IndexSeekPrefix and IndexPrefixEnd; now SELECT-IN slots
use BLOB in both consumers. Ordinary equality/range/list-IN affinities remain
unchanged. No producer coercion, KeyInfo or record-order algorithm is replaced.

Native FIRST extension24 cases x3 encodings SHA256
`0cf5011e956601da198390ea9146b701ba4f4eec103637e42c41da2744a147bb`.
New forced ordinary, joined and recursive joined-OR SQL companions compare native
typed row multisets (SQL specifies no ordering) and repeat after reset. They
observe real seek/end Mem.applyAffinity calls without replacing execution. Both
consumers must execute; ordinary/join SELECT-IN calls must all be BLOB, OR must
include BLOB alongside ordinary numeric-affinity branch calls. Positive inProbes
prevents scan-equivalent credit. Fixed source-derived frame discovery excludes
the one-line prefix-end consumer when locating seek, and fails closed if owning
calls move structurally. Temporary prototype observation is restored in finally.

Parent e9b73154 git-archive baseline with same test/artifact fails0/3 (`proc-e5a2ab739e57`)
on observed INTEGER duplicate affinity. Repaired focused3/3 (`proc-c8806a5ac75b`).
Initial test-frame discovery matched two lines and failed before execution
(`proc-ca3187c54ad8`); corrected observation boundary only. Initial forced OR on
one index produced scan access (inProbes0), correctly rejected3/3
(`proc-bdc811cbfcdd`). Use unforced multi-index a-IN OR b=3 to exercise the actual
recursive caller, not relax the selected-access assertion. Native artifacts were
recaptured before TS verification. No raw capture or production instrumentation.
