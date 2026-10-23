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
stat1-prefix break, caller-owned SELFCULL proof, EQ/IS and repeated-search
threshold; it retains table-cursor requirement and native bounded allocation size.
No SQL caller supplies these proofs/enables descriptors. Native WO_EQ|WO_IS,
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

## Remaining acceptance work

Immutable proposals and independent standalone descriptors are available, but
native automatic-first loop insertion/pruning and actual smallouter solver
integration and runtime enrollment are not delivered. Continue complete source-derived NOT INDEXED/forced,
affinity/unready/outer/covering gates and collation/multipage packed boundary
regressions. Current new prefix fixtures use numeric keys, not collation tests.
Filter VM diagnostics/counters and measured runtime faults/cancel/deadline,
full cleanup/reprepare and original workload acceptance are still pending.
Primitive unit controls do not prove those runtime obligations. No original
400×400 WR/FULL/file60/batch600/batch80 obligations are waived.
