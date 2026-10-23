# Shared packed/filter primitive repair — bounded author evidence

Base: integration-delivery `268c6e612efc782d66002d2846dbd52d07b2c6a3`, tree
`f0b0266d52eea76abf8e0217fa78080b33b7bb2d`. SQLite3.53.4 manifest source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
This is partial implementation for [[card:card-s-j-a]], not automatic/Bloom runtime
acceptance for [[card:card-s-j]]. Exact delivered identity belongs in the card status.

## Source comparison and consumer interface

Read actual pinned vdbe.c filterHash690, FilterAdd/Filter8950+, Seek*4826+
and Idx*6828+, vdbemem.c IntValue641+, private packed IndexMoveto and VM state
owner. Numeric flag precedence matters when Mem also caches rendered Str.
Unsigned addition is BigInt.asUintN(64); REAL uses existing realToI64 saturation
and truncation; Str4095, Blob4109, NULL0. No encoding/content hash is substituted.

`PrivateKeyVmCursor.seekBound(values, SeekGE|GT|LE|LT, control)` translates
native default_rc and adjacent Next/Previous correction rather than exact
membership res===0. `boundJump(values, IdxGT|GE|LT|LE, control)` compares a
charged snapshot of the key against the current packed payload. Existing
IndexSeekPrefix/IndexPrefixEnd dispatch checks the private cursor first. Native
Affinity is applied to key registers; prefix end uses both directional tests,
so reverse traversal and nonmatching nearest keys are rejected. Existing Found,
IN, persistent seeks, page-local comparison and insertion remain owners.
SeekScan on private state explicitly fails rather than silently claiming support.

`FilterInit(p1,bytes)` allocates execution-owned zeroed storage before publication;
`FilterAdd(p1,p3,p4)` and `Filter(p1,p2,p3,p4)` consume shared Mem register ranges.
Filter's jump means absent; collision falls through and is never a match.
FilterInit represents native Blob-zero allocation with a separate mutable private
owner, avoiding ordinary Mem-copy aliasing. This representation does not justify
substituting a host Set or hash join. One shared private byte budget charges
length+128 deterministic descriptor bytes (not JS heap size). Pre/post-allocation
control failures refund; normal VM cleanup closes filters and retains its first
error. FilterAdd/Filter check work before synchronous borrowed-register hashing.
Reset rebuilds filters. No public API option or SQL producer emits these opcodes.

## Commands and observations

- `node --experimental-strip-types --test test/value/private-bloom.test.mjs test/value/private-key-vm-bound.test.mjs` initially 4/5: test mistakenly called nonexistent setTextBytes. Corrected test to actual shared setText. No production workaround.
- Same focused tests and `npm run typecheck` then passed. Actual-amalgamation
  witness compiled with `cc -O2 -DSQLITE_AMALGAMATION_PATH=\"…/oracle-build/build/sqlite3.c\" docs/research/where-autoindex-hash.c -lm -ldl -lpthread` in card-owned `primitive-check`, then executed. SourceID and all twelve native witnesses agree with TS expectations, including signed wrap, IntReal, REAL saturation and text/blob flags. Exact output: `work:///cards/card-s-j-a/processes/proc-0f6743493423/stdout.log`.
- `node --experimental-strip-types --test test/value/private-bloom*.test.mjs test/value/private-key-vm*.test.mjs && npm run typecheck`: 46/46, zero skips, typecheck exit0. Output `work:///cards/card-s-j-a/processes/proc-833cca1c19a3/stdout.log`. Coverage includes existing exact membership/lifecycle tests; new all-encoding empty/before/after and duplicate numeric prefix edges, both VM traversal directions/reset, filter VM absent/collision/reset, allocation H−1/H/H+1 and interrupted allocation with independent surviving filter.
- Four unchanged native-first red receipts were replayed against current TS using `for case in absent collision empty-inner standalone; do node --experimental-strip-types docs/research/where-autoindex-baseline.mjs "$SAIVAGE_CARD_WORK_ROOT/red-$case/native.json" || exit; done`: exit0, typed row comparisons remain correct, but plan/work gap remains. Output `work:///cards/card-s-j-a/processes/proc-5383472031c0/stdout.log`. Native receipts and identities remain in accepted status v1. This command is not a new capture or runtime feature pass.

## Admission primitive extension

The follow-on change translates actual pinned `where.c:832–924,4060–4120`
into `where-plan.ts` exports `columnIsGoodAutomaticIndexCandidate`,
`termCanDriveAutomaticIndex`, and `automaticIndexCosts`. Declared index keys
own the stat1 >20 rejection; implicit covering/rowid suffixes do not. EQ/IS,
source identity, real notReady frontier, outer-ON owner/flags and shared
comparison/index-affinity gate precede column quality. EP_OuterON survives
commuted provenance; it is not reconstructed from origin alone. Native
estLog/LogEstAdd and ordinary +28 / ephemeral −25 setup tuning are retained.
These primitives are not descriptor production, loop insertion or enrollment.

Verification command: `node --experimental-strip-types --test test/conformance/where-plan-foundation.test.mjs test/value/private-bloom*.test.mjs test/value/private-key-vm*.test.mjs && npm run typecheck && git diff --check`, followed by unchanged four-receipt baseline replay, all chained on success. **51/51**, no failures/skips, typecheck/diff check and all four replays exit0. Output:
`work:///cards/card-s-j-a/processes/proc-b0266bba0991/stdout.log`.
Two intermediate test failures were incorrect expectations: LogEstAdd(0,43)
is44, not43; retained outerOn=true remains an ON carrier despite an origin
change. Tests were corrected to the source contracts, not production bypasses.
Baseline SQL work remains scans; no runtime feature pass is claimed.

## Candidate/descriptor extension

Pinned constructAutomaticIndex's clause-order ready key expansion, column-bit
deduplication, covering field layout and KeyInfo are represented by immutable
`automaticIndexDescriptor`, independent of persistent IndexNode. Candidate gates
and native costs are exposed by `automaticIndexCandidates` with explicit internal
context; `automaticIndexPathEligible` checks prereqs and LogEst outerRows>=3.
Neither function inserts executable loops. The later predicate extension below
supersedes the initial omission of partial-build predicates; residual disabling
remains separate from safe build filtering.

Independent `standaloneBloomDescriptors` follows selected persistent paths,
stat1-prefix break, producer-owned SELFCULL, EQ/IS and repeated-search
threshold; it retains table-cursor requirement and native bounded allocation size.
`outputAdjust` now publishes immutable selfCulling on the candidate itself;
`standaloneBloomDescriptors(path,enabled)` no longer accepts caller-invented
proofs. No SQL caller enables descriptors. Native WO_EQ|WO_IS,
not just WO_EQ, is the flag producer relevant to the standalone test.

Checked command: `node --experimental-strip-types --test test/conformance/where-plan-foundation.test.mjs test/value/private-bloom*.test.mjs test/value/private-key-vm*.test.mjs && npm run typecheck && git diff --check`, followed by the four unchanged receipt replays, chained on success. **56/56**, no failures/skips; typecheck/diff check and all four replays exit0. Full output:
`work:///cards/card-s-j-a/processes/proc-88107b1a3140/stdout.log`.
The native receipts are reused, not recaptured. Typed SQL results remain correct
but automatic absent/collision still execute8256 tableNext and zero index seeks.
No runtime feature credit follows from this descriptor test pass.

## Single-table build predicate extension

`automaticIndexBuildPredicate` translates expr.c's single-table constraint
restrictions and eCode=3 walker: LEFT requires target-owned OuterON, other
OuterON and left-of-RIGHT targets reject; earlier left-of-RIGHT ON owners reject.
The walker follows resolved aliases, exact column source/depth (including merged
uses), rejects SELECTs, aggregate/window/RAISE and volatile/unknown calls, and
accepts registered constant or slow-changing calls as resolve.c EP_ConstFunc does.
Descriptor `buildPredicates` is frozen and populated only with its matching
resolved source owner. No expression evaluation or disableTerm credit occurs.
The native bAllowSubq=0 branch rejects even uncorrelated SELECTs, independently
of dependency masks or variableSelect. Tests use actual parsed/resolved SQL in
all encodings and verify descriptor publication separately from residual ownership.

Initial test failed because RIGHT ON terms require analyzeWhere(includeRightTerms=true),
not the default fallback clause. After correcting that fixture, focused test
passed but typecheck found selectDepth belongs to ResolvedColumnUse, not merged
ResolvedColumnRef. The fix checks depth on the producer and source on its refs;
no cast or weakened gate was used. Failed evidence: proc-1799f34bb733,
proc-a1c7ed728b3d and proc-d00c8c93eee5 under this card's process evidence.
Final checked chain runs `node --experimental-strip-types --test test/conformance/where-plan-analysis.test.mjs test/conformance/where-plan-foundation.test.mjs test/value/private-bloom*.test.mjs test/value/private-key-vm*.test.mjs && npm run typecheck && git diff --check` then the four-receipt replay loop: **324/324, zero failures/skips**, typecheck/diff check/replays exit0. Exact output:
`work:///cards/card-s-j-a/processes/proc-29efad98474c/stdout.log`.
No fresh native capture or SQL runtime feature pass is claimed.

## Ordinary candidate/solver integration

`CandidateOptions.automaticIndex` is an internal lowering-capability opt-in;
no SQL producer supplies it. `btreeLoops` inserts native-cost automatic loops
before its zero-setup table/index alternatives and consumes the shared planning
budget for each attempted insertion. OR cost-only builders and forced/NOT INDEXED
paths cannot inherit it. Loops retain their seed candidate, not a fake IndexNode.
`whereLoopFindLesser` comparison now includes native declared equality preference:
a compatible declared EQ/IS index replaces auto before cost dominance, but not
IS NULL or skip-scan. This preserves SETUP-INVARIANT instead of appending auto
after scans. The actual `wherePathSolver` rejects automatic loops when the
current path's nRow<3 LogEst, even if all prerequisites are ready. The descriptor
is still expanded only at a chosen readiness frontier, by the later consumer.

Foundation tests exercise production order/cost/terms, disabled SQL defaults,
actual solver threshold2/3, single-source smallouter rejection, native declared
index replacement independent of cost and its IS NULL/skip exceptions, forced
and NOT INDEXED controls with matching source identity, and budget exhaustion.
Pinned where.c branches read:4096–4115 automatic production,2745–2803 lesser
comparison,5950 smallouter. This supplies the missing source-order integration,
not runtime execution acceptance.

Checked command: `node --experimental-strip-types --test test/conformance/where-plan-analysis.test.mjs test/conformance/where-plan-foundation.test.mjs test/value/private-bloom*.test.mjs test/value/private-key-vm*.test.mjs && npm run typecheck && git diff --check`, then four unchanged native-first receipt replays, all chained on success: **325/325**, zero failures/skips, typecheck/diff check/replays exit0. Output:
`work:///cards/card-s-j-a/processes/proc-a3cb75695184/stdout.log`.
Two additional IS and extra-prerequisite pruning assertions were added after
that test process started; changed foundation tests reran **11/11** exit0:
`work:///cards/card-s-j-a/processes/proc-17b5ebd85c82/stdout.log`.
Production inputs are unchanged between these checks. No failed check occurred
in this attempt; no fresh native capture or SQL feature credit is claimed.

## Packed collation/multipage verification

The next hypothesis was that duplicate-prefix positioning might diverge when
collations make different spellings equal across packed page boundaries. Direct
comparison of vdbe.c Seek*4990ff and Idx*6828ff with PrivateKeyVmCursor found the
existing biased default_rc, adjacent movement, empty/Eof and bound polarity
matched these tested paths. No production repair was justified by this evidence.

Added `private-key-vm-collation.test.mjs`: 120 packed records with180-byte payload,
asserted pageCount>4,40 equal prefixes, all encodings/BINARY/NOCASE/RTRIM, ASC/DESC
KeyInfo, four seek bounds, all four bound predicates, bidirectional traversal,
beyond-edge null publication, clear/reuse and empty seeks, full budget refund.
Added `private-key-vm-collation-dispatch.test.mjs`: all encodings/collations and
forward/reverse VM prefix dispatch, MakeRecord/IdxInsert construction,40 ordered
suffix results and reset/rebuild twice. No SQL consumer selection is exercised.

Independent ctypes public-API witness loaded the actual card-built amalgamation,
created the same collation-equivalent keys, and checked forward/reverse complete
prefix results plus four SQL boundary queries for all9 encoding/collation pairs.
SourceID printed and matches pinned3530400; exit0:
`work:///cards/card-s-j-a/processes/proc-802993558f2a/stdout.log`.
This witness confirms row-level bounds, not private cursor state/error parity or
DESC native index coverage (DESC is direct source-derived cursor testing).

Initial fixture failures were test API misuse, not packed behavior defects:
setText needs encoded Uint8Array, KeyTerm uses desc, and Mem null inspection uses
initialStorageClass, not isNull/storageClass. Failed outputs proc-797a958d0760,
proc-6b7e468071c6 and proc-35621e4b1d3a remain retained under this card's processes;
the last already passed all18 VM dispatch cases but failed18 direct tests on the
nonexistent null accessor. No failed test was erased by a later command success.
Final checked chain: `node --experimental-strip-types --test test/conformance/where-plan-analysis.test.mjs test/conformance/where-plan-foundation.test.mjs test/value/private-bloom*.test.mjs test/value/private-key-vm*.test.mjs && npm run typecheck && git diff --check`, followed by four unchanged receipt replays: **361/361, zero failures/skips**, typecheck/diff check/replays exit0. Output:
`work:///cards/card-s-j-a/processes/proc-082166cce6de/stdout.log`.
SQL execution-work gap remains unchanged; no SQL runtime feature credit.

## SELFCULL producer/consumer repair

Native `whereLoopOutputAdjust`3039–3080 sets WHERE_SELFCULL at the same
unused-term proof point as output reduction. TS previously discarded this state
and accepted a separately caller-supplied proof set at standalone admission.
That was a missing semantic producer/consumer relationship, not a platform
adaptation. `outputAdjust` now returns cardinality plus selfCulling; ordinary
insertion publishes both on the immutable candidate. It uses existing used-term
and parent/virtual/prerequisite checks, then requires exact maskSelf ownership
and WO_IN/EQ/LT/LE/GT/GE (native0x3f) or a non-LEFT/non-left-of-RIGHT target.
IS/IS NULL do not establish outer-target culling. Standalone admission consumes
only this candidate field, removing the independent proof-set argument.
Automatic loops retain separate native production and do not gain this flag.

Foundation tests exercise actual btreeLoops producer, used/virtual/nonlocal
rejection, LEFT/left-of-RIGHT null rules, all six native operator bits, nonouter
scalar residual, stat1 prefix break, strict/accumulated search threshold and
10000/1048576/10000000 allocation sizes. Integrated automatic context gates now
check disabled/OR/right-drain/OR-subclause/correlated/recursive production and
unready selected-frontier seed rejection. No SQL caller enables either consumer.

Initial tests exposed invalid controls, not production failures: the residual
was initially usable as an index range, so correctly did not mark SELFCULL
(proc-570aa4953b3d); after retaining it as residual, LEFT correctly rejected an
unowned WHERE driving seed (proc-46107f202f44). Test seed now has target-owned ON
provenance. Both failures and corrected11/11 focused runs are retained in card
process evidence. SQL execution-work reproducer still requires absent consumers;
this repair alone makes no runtime claim.
Final checked command reused the361-test primitive/planner command above,
`&& npm run typecheck && git diff --check` and all four unchanged native SQL
receipt replays: exit0,361/361 zero failures/skips. Evidence:
`work:///cards/card-s-j-a/processes/proc-e9d5f48b5abe/stdout.log`.

## Composed affinity/hash/seek seam

Source comparison: `where.c:1214` GenerateIndexKey/MakeRecord precedes
FilterAdd; `wherecode.c:2024` codeApplyAffinity precedes Filter then Seek/Idx.
VM Filter hashes borrowed live registers without coercion, while
IndexSeekPrefix applies affinity to a private snapshot. Therefore omitting the
explicit live Affinity before Filter can falsely reject numeric text even though
a subsequent authoritative seek would match. This is a concrete lowering
obligation, not a defect in the native hash algorithm. No current SQL producer
emits this sequence, so no production patch or feature credit is justified.

`private-bloom-affinity.test.mjs` composes MakeRecord→FilterAdd→IdxInsert and
live Affinity→Filter→IndexSeekPrefix→IndexPrefixEnd, with reset/rebuild twice.
54 all-encoding controls distinguish absent bit, present-but-authoritatively-
rejected collision and matching prefix. Numeric exponent/text, REAL fractions,
IntReal/six-byte boundary, TEXT spellings, NOCASE/RTRIM/BINARY, BLOB and NULL/IS
are covered. A deliberately missing-prefilter-affinity control produces the
false negative, preventing the fixture from hiding this caller obligation.
Initial51-control run passed (`proc-6641f454c3f4`); no fixture failure this attempt.
These tests deliberately isolate primitives; TEXT-only auto Bloom enablement
and SQL EQ null skipping remain descriptor/lowering responsibilities.

Fresh native captures used actual pinned library, SourceID unchanged, for
`affinity`, `affinity-reverse`, `types`, `representations`, `is`, each3 encodings,
automatic on/off and TS reset replay (60 executions). Command:
`PYTHONDONTWRITEBYTECODE=1 python3 docs/research/where-autoindex-capture.py --library
"$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" --output
"$SAIVAGE_CARD_WORK_ROOT/affinity-seam-$case" --case "$case"`, then baseline.mjs.
Capture/comparison exit0: `work:///cards/card-s-j-a/processes/proc-f3331d3c6ea0/stdout.log`.
Native op/EQP extraction and receipt hashes:
`work:///cards/card-s-j-a/processes/proc-792c32f47cab/stdout.log`.
Affinity native uses numeric Affinity before Filter/Seek; reverse direction uses
only payload key with no Bloom, not an unsafe TEXT k key. Typed rows and metadata
agree, but TS still scans without the native runtime feature. Exact retained
receipts are under the purpose-named affinity-seam-* work children, not product
fixtures. These captures are not a fresh original-workload acceptance.
Final415/415 tests, zero failures/skips, typecheck/diffcheck and four unchanged
absent/collision/empty-inner/standalone receipt replays passed in the checked
chain: `work:///cards/card-s-j-a/processes/proc-ae98bdbae158/stdout.log`.

## Filter replacement ownership repair

The informed lifetime attempt exposed a real divergence: FilterInit allocated a
replacement before closing the old filter, demanding two simultaneous charges.
A10000-byte replacement at the exact10128-byte limit failed (`work:///cards/card-s-j-a/processes/proc-2823a12c8d6f/stdout.log`). Native
`vdbe.c:OP_Blob`1556ff calls out2Prerelease then SetZeroBlob/ExpandBlob;
`vdbemem.c:sqlite3VdbeMemSetZeroBlob`1009ff releases old storage first. TS now
closes/deletes the old owner before allocation/admission; allocation failure is
an execution failure, not a rollback requiring retention of old bits. No new
mechanism or capacity fallback was added. Two attempted apply_patch invocations
made no changes; exact scoped edit applied the correction.

`private-bloom-lifetime.test.mjs` proves exact-limit replacement clears bits and
rebuilds after reset; oversized replacement preserves saved first-error identity
through repeat step/reset; a separately paused filter retains its bit and resumes;
replacement work exhaustion and FilterAdd/Filter key-work exhaustion clean up and
permit repeat reset/rebuild. Six controls pass (`work:///cards/card-s-j-a/processes/proc-e18f040675fd/stdout.log`). Work exhaustion is not an AbortSignal/deadline
witness; no claim of real-consumer resource accounting, packed-survivor fault
coverage or SQL runtime enrollment follows. Existing primitive budget/refund
tests remain complementary, not direct observation of every VM allocation.
Final checked planner/shared-primitive chain:421/421, zero failures/skips,
typecheck/diffcheck and all four unchanged focused SQL receipt replays exit0:
`work:///cards/card-s-j-a/processes/proc-e80356c817a3/stdout.log`. SQL execution-work
remains red because consumers are absent; no fresh native capture this attempt.

## Cancellation with independent packed ownership

Follow-up to replacement ordering: compared shared checkControl/privateControl,
step's saved-error/halt/reset/finalize flow and native vdbe.c interrupt checks
(902/1092 and abort_due_to_interrupt) with filter allocation. No new divergence
was demonstrated, so no speculative production change. Added
`private-bloom-cancel.test.mjs`: real timer AbortController cancellation and
elapsed1ms deadline on a1000000-byte replacement checkpoint path, two reset
cycles with saved error identity, plus a separately paused packed cursor with80
NOCASE-equivalent prefixes/180-byte payloads. After victim failure/reset/finalize,
survivor continues every suffix without skip/duplicate and rebuilds after reset.
No scheduler mocking/fault-injection architecture was added. Timer abort proves
host-task delivery while allocation work yields; the exact pre/post-yield deadline
check location is not asserted. These are internal VM controls, not SQL autoindex
runtime enrollment, native timing equivalence or exact memory high-water proof.

Initial controls reached cleanup but failed because fixture finalized twice;
finalize is correctly non-idempotent (`work:///cards/card-s-j-a/processes/proc-ac901ce878ff/stdout.log`). Fixed fixture ownership with one-finalize guard,
not product behavior. Corrected2/2 run passed; detailed checked chain follows
below:423/423 zero failures/skips, typecheck/diffcheck and four unchanged
focused SQL receipt replays exit0 (`work:///cards/card-s-j-a/processes/proc-72bd9be86b9b/stdout.log`). Corrected focused check/typecheck:
`work:///cards/card-s-j-a/processes/proc-98e2b19cd266/stdout.log`.
Native source and existing budget/work-error controls remain complementary;
this does not establish every partial packed allocation failure or same-connection
public API concurrency behavior.

## Packed prefix interruption checkpoints

`private-key-vm-prefix-failure.test.mjs` enumerates actual checkpoint calls for
each SeekGE/GT/LE/LT over120 packed duplicate-prefix records, then rejects each
checkpoint on a fresh owner. It verifies original error identity, cache/deferred
flags, explicit fresh SeekGE followed by all120 suffixes, and cumulative zero
budget after cursor/arena disposal. Compared native Seek default_rc, BtreeMoveto
error-before-adjacent-movement branch and TS seekBound/indexMoveto snapshot/finally.
No exercised production divergence found; this is not a promise to continue a
failed VM without halt/reset. No SQL runtime consumer is enrolled.

Three initial4/4 failures came from an invalid immediate-byte-equality assertion:
first a64-byte path/lease delta, then896 bytes even on successful repeated seeks.
Inspection of #acquire/#moveto shows retained charged page metadata/path capacity
may change during search, so equality is not a valid transient-scratch witness.
The test now checks complete disposal refunds, not an invented constant high-water
contract. Evidence: `work:///cards/card-s-j-a/processes/proc-f0130bc5564c/stdout.log`,
`work:///cards/card-s-j-a/processes/proc-29f0768d8bf4/stdout.log`,
`work:///cards/card-s-j-a/processes/proc-355eb07c4087/stdout.log`.
Corrected4/4/typecheck/diffcheck: `work:///cards/card-s-j-a/processes/proc-1b3bcdd0ca16/stdout.log`.
This does not measure exact transient high water or interrupt insertion/balancing.

## Packed insertion/root-expansion interruption

`private-key-vm-split-failure.test.mjs` discovers the first page-count growth,
reconstructs the pre-expansion tree per attempt, and rejects each actual async
checkpoint of that insertion. Each rejected insert preserves its primary error,
stales the VM cache, and disposes with cumulative zero budget; another arena's
row remains readable. Successful control proves actual growth, not merely an
insertion on a multipage tree. Native `btree.c:sqlite3BtreeInsert` balances only
after successful insert/overflow and invalidates after balance even on error;
TS #writeIndex releases path/snapshot in finally and faults an interrupted
mutation owner. These controls do not assert victim rollback or continued use
of a faulted arena, native interrupt timing, exact transient high water, or
same-connection public concurrency. No production divergence demonstrated.

Initial test failed before enumeration: `pageCount>1` mistook the already allocated
arena pages for expansion. Corrected discovery compares against initial count,
without changing product semantics. Failure evidence:
`work:///cards/card-s-j-a/processes/proc-400c29df9aba/stdout.log`.
Corrected focused test/typecheck/diffcheck exit0:
`work:///cards/card-s-j-a/processes/proc-d1053516a5b4/stdout.log`.
The exhaustive fresh-tree reconstruction takes about69 seconds in isolation;
this is bounded source-derived coverage, not a runtime benchmark.

## Large borrowed-key synchronous snapshot interruption

`private-key-vm-snapshot-failure.test.mjs` independently encodes6000-byte BLOB
and UTF-8 TEXT records and borrows their decoded Mem bytes. Each encoding rejects
all12 synchronous insertion snapshot checkpoints and all4 prefix-seek snapshot
checkpoints on fresh owners, preserving primary error and input ownership and
requiring zero cumulative budget on disposal. Successful controls insert overflow
records and match them through packed prefix seek. Failed seek permits explicit
reseek; failed mutating insertion is disposed, never automatically retried.

Compared #writeIndex/#moveto and Mem.copyFromSnapshot publication/finally branches
with pinned btree.c fillInCell/Insert overflow handling: native synchronous payload
borrowing needs no await-time copy; TS's bounded snapshots are an ownership
adaptation. Initial2/2 failure incorrectly assumed all synchronous checkpoints
precede mutation. Insert has later snapshots and may fault its arena, so recovery
is not promised; corrected control preserves that boundary rather than retrying.
No exercised production divergence found. Initial evidence:
`work:///cards/card-s-j-a/processes/proc-87d3cee0427e/stdout.log`;
corrected2/2/typecheck/diffcheck:
`work:///cards/card-s-j-a/processes/proc-55ba8e4d2444/stdout.log`.
These checks do not prove exact transient high water or SQL runtime feature credit.
The async extension enumerates10 insertion and5 overflow-seek checkpoints per
type, and requires a rejected insert to have grown the page count before failure.
This witnesses partial overflow allocation followed by primary-error disposal;
it is not only pre-mutation rejection. Source comparison follows fillInCell's
previous-link publication before unref, and TS pending/previous lease unwind.
No reproduced production divergence. Focused2/2/typecheck/diffcheck evidence:
`work:///cards/card-s-j-a/processes/proc-484be64a7387/stdout.log`.
Injected async errors exercise shared checkpoint propagation, not host timer
cancellation or allocation-hook failure. Faulted mutations are never retried.
The capacity control uses the real PrivateStateByteBudget.reserve rejection,
observed by a test-only subclass without changing admission. A118-point sweep
from40000 to99904 bytes in512-byte steps yields5 rejected insertions, all after
page-count growth, and113 successes. It checks primary PrivateStateLimitError
identity, no budget excess at rejection/return, and cumulative zero on disposal.
This is sampled capacity-boundary evidence, not exact peak/minimum admission or
native malloc parity. No exercised production divergence or repair.
Focused3/3/typecheck/diffcheck evidence:
`work:///cards/card-s-j-a/processes/proc-286b35498e39/stdout.log`.
An additional exact-boundary control observes reserve **and replace** through the
unchanged aggregate primitive on fresh owners. For this6003-byte packed BLOB,
accounted baseline8704, post-insert retained17280, peak42427 bytes/pages4:
a fresh42427-byte cap reproduces identical accounting, while42426 rejects with
the original PrivateStateLimitError. All owners dispose to zero. Peak exceeds
retained by25147 bytes; this separates aggregate transient charges from retained
state, not a page-vs-Mem attribution or actual JS heap measurement. This proves
the accounted admission boundary only for this input/operation, not all private
allocations or SQL execution. Focused4/4/typecheck/diffcheck:
`work:///cards/card-s-j-a/processes/proc-50441330b48b/stdout.log`.
Borrowed overflow-prefix boundJump now has an independent exact incremental
admission control:12515 bytes additional accounted headroom accepts IdxGT equal
prefix (no jump);12514 rejects the original limit error. Test-owned budget pressure
is removed before explicit primitive reseek/column read/recomparison, which verify
the original BLOB and borrowed input ownership. Every arena disposes to zero.
Native vdbe.c IdxGT builds a borrowed UnpackedRecord and calls IdxKeyCompare;
TS copies across async payload comparison and releases copies/scratch in finally.
This validates that adaptation for one large BLOB, not general cache coherence,
VM continuation after halt, native allocation timing or SQL enrollment.
Focused5/5/typecheck/diffcheck evidence:
`work:///cards/card-s-j-a/processes/proc-9ee990abd6f5/stdout.log`.
Mixed-state seam control (`private-bloom-mixed-state.test.mjs`) composes actual
shared filter/packed owners for cached Str plus INTEGER/IntReal/REAL, all three
encodings. Numeric hash priority preserves bit1, including REAL truncation
collisions; authoritative packed seeks reject unequal colliding values. Real
aggregate capacity rejection in boundJump leaves filter bits and numeric Mem
hash unchanged; explicit post-pressure reseek/bound and disposal succeed.
Native filterHash/FilterAdd/Filter and TS VM checkpoint-before-register-borrow
branches were compared. These9 controls call primitives directly, not a VM
register injection or fresh oracle capture: VM mixed-state failure ordering is
not established by them. No production divergence/repair. Focused9/9:
`work:///cards/card-s-j-a/processes/proc-0bceb0af8133/stdout.log`.
VM text-consumption follow-up (`private-bloom-text-consumption.test.mjs`) uses
existing Binary concatenation, FilterAdd/Filter and packed prefix dispatch, with
INTEGER/REAL in three encodings. Shared work rejection at the post-result
execution boundary retains the first error; reset rebuilds filter/tree and two
complete runs return the original numeric value. Six controls pass. Source
comparison rejects the proposed cached-live-Str hypothesis for this path:
native OP_Concat restores numeric input flags after formatting; TS formats a
private Mem copy. Thus these are VM numeric-ownership/failure/reset controls,
not proof of mixed cached-Str VM registers or failure *inside* Filter borrowing.
No register injection or production divergence/repair. Focused6/6/typecheck:
`work:///cards/card-s-j-a/processes/proc-e0a565f6ab89/stdout.log`.
Admission follow-up compares where.c termCanDriveIndex and both
constructAutomaticIndex clause loops: readiness precedes idxCols deduplication,
first eligible clause term owns key provenance. Production analyzer controls
in `where-plan-analysis.test.mjs` use both operand orientations, three encodings,
and v-not-ready/all-ready frontiers on o/u/v duplicate-column equalities.
Both seed candidates survive enumeration, unready seed expansion rejects,
ready expansion keeps one key with first eligible provenance, affinity and
prerequisite union. Focused1/1 (12 orientation/encoding/frontier combinations):
`work:///cards/card-s-j-a/processes/proc-ef5269a60ea4/stdout.log`.
No exercised admission divergence or production repair; these do not establish
all multi-column/collation combinations or SQL enrollment.
Conflicting-collation follow-up uses explicit RTRIM on the initially unready
v equality, NOCASE on the ready o equality, both operand orientations and
three encodings. Expansion chooses NOCASE with v unready and RTRIM with all
sources ready, in both descriptor key and KeyInfo. Native
sqlite3ExprCompareCollSeq/BinaryCompareCollSeq and TS original-expression
collation retention across virtual commutation were compared. Focused1/1
(12 combinations): process proc-a80a8eb02a8e, exit0. No exercised divergence;
this is admission-only evidence, not residual omission or runtime enrollment.
Composite WITHOUT ROWID coverage follow-up compares native extraCols PK
inclusion/table-order covering fields/HasRowid tail with descriptor layout.
Three encoding controls cover a PK ordered [c,b], automatic key b overlapping
identity, optional payload and both identity columns as automatic keys.
Fields are [b,c] or [b,c,payload], without duplicates or invented rowid;
KeyInfo field counts and binary covering terms match. Unlike declared
secondary physicalIndex PK tails, automatic coverage is table order and binary
for added fields, not PK collation/direction order. Focused3/3:
`work:///cards/card-s-j-a/processes/proc-4040b887a492/stdout.log`.
No exercised divergence or runtime credit. High-column mask aliasing and
production schema resolution are not established by these synthetic fixtures.

High-column follow-up found and repaired a descriptor divergence: caller
`needed` can be empty while the driving expression itself sets native colUsed
bit63. Before repair fields were [c63,c65] for WR instead of native
[c63,c63,c64,c65]. `resolve.c:sqlite3ExprColUsed` owns this bit independently
of output coverage. Descriptor now derives the bit from analyzed target-column
terms as well as explicit needed columns. Six rowid/WR × encoding controls
retain intentional duplicate payload and correct KeyInfo sizes4/5.
Red3/3 evidence: `work:///cards/card-s-j-a/processes/proc-3cbe1052f2b5/stdout.log`
(the sequential inspection command exited0 despite failed tests). Green6/6:
`work:///cards/card-s-j-a/processes/proc-83cbec67ba1c/stdout.log`.
Fresh pinned-amalgamation public EXPLAIN witness:
`work:///cards/card-s-j-a/processes/proc-2c581f20eeac/stdout.log` verifies SourceID
and 66 INTEGER column tables, query `SELECT count(*) FROM t o CROSS JOIN t u
ON u.c63=o.c0`, WR PK(c65) and ordinary rowid cases. OpenAutoindex/MakeRecord
sizes are4 WR/5 rowid; WR physical table offsets reflect PK-first storage,
not logical column ordinals. Empty-table count returns typed INTEGER0; this
witness proves layout, not build/probe runtime parity. Initial witness harness
mistook query's (rows,counters) tuple for rows and failed with TypeError
(proc-ae2b4117ffa8); corrected without production changes. The follow-up native implicit-high-PK witness
`work:///cards/card-s-j-a/processes/proc-8ec1a6b9d82f/stdout.log` resolves this
boundary: same pinned66-column WR schema, low c1 driving key, no high reference
produces MakeRecord1 although OpenAutoindex P2=2; with `abs(u.c64)>0` it
produces MakeRecord4 and P2=5. This is pinned colUsed-versus-extraCols control
flow, not permission to invent identity payload. Descriptor now omits implicit
high PK payload unless colUsed is high. Matching resolved columnUses supplies
nested residual/RHS coverage, not merely direct analyzed LHS fields.
Twelve encoding/orientation/source-identity analysis controls test no high use,
`abs(u.c64)>0`, `0<abs(u.c64)`, and non-target `abs(o.c64)>0`. Source identity
prevents borrowing another source's high bit. A controlled omission of resolved
uses reproduced failure for nested u.c64 (proc-9671dfa61741); restoring resolved
ownership passes. This is descriptor coverage evidence, not populated auto
runtime execution. Generated-column follow-up now translates
`resolve.c:sqlite3ExprColUsed` ALLBITS expansion: any referenced generated column,
stored or virtual, requests all table columns rather than only dependencies.
Descriptor collects target references from needed/analyzed/resolved merged owners,
then expands low payload and high bit. Matching source identity remains required.
36 controls (encoding × storage ×4/66 columns × target/other/no generated use)
verify exact fields/counts. Constant-expression carriers are schema fixtures,
not public DDL execution. Initial fixture used `results` instead of `result`
and failed TypeError (proc-a9fa3a99de3d); corrected, no product workaround.
Disabling only ALLBITS expansion yields failing stored4 target control
`work:///cards/card-s-j-a/processes/proc-009cd9fd2159/stdout.log`.
Fresh pinned public DDL/EXPLAIN witness for12 corresponding storage/width/use
cases: `work:///cards/card-s-j-a/processes/proc-61253f2aeef5/stdout.log`.
Native MakeRecord sizes are2/1 without target generated use (4/66 columns),
4/66 with target generated use; other-source use does not expand target.
Empty tables return typed INTEGER0. This proves descriptor layout rather than
populated SQL automatic execution; SQL enrollment remains disabled.

Generated-key follow-up:24 storage/encoding/low-or-high/orientation descriptor
controls in where-plan-analysis match8 fresh native EXPLAIN cases:
`work:///cards/card-s-j-a/processes/proc-422706831684/stdout.log`.
All native MakeRecord sizes67, with RTRIM/NOCASE key order reflecting clause
order; no FilterAdd for all-TEXT keys. High bit aliases c63/c64; reversed
orientation appends virtual commuted term after direct c64, so c64 wins the
high key and RTRIM c63 does not become a second key. Initial test incorrectly
expected operand-orientation-invariant key order (proc-db864ee07f49); pinned
where.c clause walk and native witness disprove that expectation. Corrected
source-based expectations pass (proc-836d646b5f3a). No production divergence or
speculative patch. These are descriptor/EXPLAIN controls, not generated-key
packed execution, build expression lifetime or populated SQL parity.

Merged-USING follow-up:12 encoding/join controls resolve generated c2 ownership
as left for INNER/LEFT, right for RIGHT, and both for FULL, following pinned
resolve.c lookupName's pFJMatch/coalesce branches. `automaticIndexBuildPredicate`
accepts abs(c2)>0 only for its single semantic owner; FULL merged use is never
single-table constant. This tests source identity and build safety, not runtime
RIGHT/FULL auto admission. Initial fixture omitted includeRightTerms and got
empty RIGHT terms (proc-58b5ac70455b/proc-bf9a2d887a78); corrected explicit
analysis seam passes (proc-3573035b4102), no product change or runtime opt-in.
These controls do not independently establish exact merged descriptor field
layout or native populated parity.

Rowid/IPK follow-up found a descriptor defect with explicit caller needed IPK:
[b,id,rowid] rather than native [b,rowid]. resolve.c lookupName maps IPK names
to iColumn=-1 and rowidUsed, not colUsed; descriptor now normalizes caller
needed IPK out of payload, retaining exactly one separately appended tail.
24 controls (encoding × id/rowid/_rowid_/oid × explicit/empty needed) reproduce
old failure proc-5cec6c01ce2c. Fresh SourceID-checked native EXPLAIN4 aliases
confirms OpenAutoindex/MakeRecord2: proc-a989c1cf9993. No populated execution
or SQL enrollment claimed; ordinary non-IPK fields and WR ownership unchanged.

IPK/generated interaction:24 encoding/storage/width/reference controls confirm
ALLBITS still emits physical IPK payload plus the separate identity tail.
Caller-needed IPK normalization must not remove generated ALLBITS payload.
Fresh8-case pinned SourceID-checked DDL/EXPLAIN agrees: records2 without target
generated reference versus5/67 for4/66-column tables with it, stored and virtual.
Focused test and witness: `work:///cards/card-s-j-a/processes/proc-6d50258132d1/stdout.log`.
No production divergence found; no patch justified. These are exact descriptor
layout/EXPLAIN controls, not populated packed-record or public runtime proof.

Rowid key admission follow-up:144 combinations (3 encodings ×4 aliases ×2
orientations ×3 hints ×2 ordinary-term states) verify negative-column terms
never drive auto keys; a competing b equality alone owns the sole descriptor
key, while NOT INDEXED/forced i_ab prohibit automatic proposals. Pinned
where.c termCanDriveIndex leftCol<0 branch matches TS; no product patch.
Focused author evidence proc-0109255a541d. These are candidate/descriptor tests,
not selected-plan equivalence: native can prefer the existing rowid lookup.

Descriptor/packed composition: generated IPK ALLBITS descriptor KeyInfo feeds
PrivateBlobkeyPages/Cursor/PrivateKeyVmCursor directly,12 fresh executions
(encoding × storage ×2 owner rebuilds),120 five-field records, three prefix
groups. GE/GT/LE/LT edge identities and100 duplicate-prefix steps read matching
IPK payload/identity tail; IdxGT exits the group and disposal refunds budget.
Focused proc-f8b910700624 passes without production change. Record bytes are
synthetic integer serial-type1; generated values are supplied, not evaluated.
Owner rebuild is primitive lifecycle coverage, not public statement reset.
Existing native layout witness proc-6d50258132d1 applies; no fresh populated
oracle, encoding-sensitive TEXT, VM lowering or runtime feature credit.

TEXT descriptor composition follow-up:12 executions (3 encodings ×NOCASE/RTRIM
×2 fresh owners) use descriptor-owned KeyInfo, memFromPublic encoding and
packRecord, non-ASCII é/É/Ω/ω, space/tab distinctions. Prefix GE/LE/IdxGT
returns identities [1,3,6] NOCASE and [1,2,3] RTRIM with disposal refund.
Fresh SourceID-checked pinned populated SELECT across6 encoding/collation
cases independently confirms those typed INTEGER identities (proc-c8c837b016bb).
main.c collation comparison confirms ASCII-only NOCASE and space-only RTRIM.
Focused proc-9230f3bdd728 passes, no production divergence. These all-TEXT
keys explicitly disable Bloom; forcing a Filter/affinity path here would violate
native selection. Mixed numeric Filter affinity remains separate prior evidence.
No automatic SQL lowering, public reset or runtime feature credit.

Mixed descriptor composition:3 encodings use descriptor [a NOCASE,b REAL,rowid],
live per-key affinity, shared Bloom and packed seek/IdxGT. Numeric text '01',
'1.5' and '1' returns identities1/2/3; missing TEXT hashes positive yet packed
comparison rejects; absent numeric9 rejects. Deliberately omitting affinity for
'01' yields a false negative, confirming consumer ordering. NULL build record
is present, not proof of SQL NULL-probe semantics. Focused proc-6c8a94e6b65c
passes without production changes. Fresh pinned SourceID-checked15 public
queries (proc-651c367fc25b) agree on identities and show REAL1/1.5 distinctly;
TS test asserts identities, not public REAL metadata. All resources refund.
This primitive composition does not emit SQL consumers or prove public reset.

## Remaining acceptance work

Automatic candidate insertion/pruning and actual smallouter solver integration
are available behind internal opt-in; SQL runtime enrollment remains absent.
Continue complete source-derived NOT INDEXED/forced,
affinity/unready/outer/covering gates. Packed collation/multipage coverage is
now present as described below; this does not prove runtime consumer admission.
Filter VM diagnostics/counters and measured runtime faults/cancel/deadline,
full cleanup/reprepare and original workload acceptance are still pending.
Primitive unit controls do not prove those runtime obligations. No original
400×400 WR/FULL/file60/batch600/batch80 obligations are waived.
