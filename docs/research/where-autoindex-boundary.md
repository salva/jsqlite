# Runtime autoindex executable boundary (author evidence)

Candidate baseline c875487f3607be620ed0057caf2b375103af050f / tree
36ff963cb0a047bb74e1c5b16db219cad3e390af. This extends the adjacent
[decision](where-autoindex-admission.md), not persistent schema-autoindex tests.
No runtime implementation, public API change, or feature credit.

## Run and evidence

Build pinned metadata-enabled oracle with `sh tools/oracle/build.sh`. For each
case below run `PYTHONDONTWRITEBYTECODE=1 python3 docs/research/where-autoindex-capture.py
--library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
--output "$SAIVAGE_CARD_WORK_ROOT/boundary/CASE" --case CASE` before running
`node --experimental-strip-types docs/research/where-autoindex-baseline.mjs
"$SAIVAGE_CARD_WORK_ROOT/boundary/CASE/native.json"`.
Output directories must not exist. Each contains image hashes, native source/library
identity, full EXPLAIN/EQP, five metadata fields, typed rows and two reset runs.
The companion compares both unforced SQL and real NOT INDEXED SQL to native rows
and metadata, never substitutes TS-generated expectations.

Cases: original, absent, collision, inner, on, where, is, empty-inner,
empty-outer, types, nocase, rtrim, binary. All use repeated physical unindexed
rowid joins; collation cases add a second key and embedded-NUL strings.
Types includes INTEGER-affinity numeric text, nonintegral REAL, TEXT, BLOB,
negative integers, NULL and absent keys. Integer-affinity 1.0 becomes INTEGER:
this is intentional native affinity, not a REAL storage assertion.

Native source controls: `where.c:constructAutomaticIndex` allocates Once,
covering KeyInfo fields, numeric-capable Bloom eligibility and 10000-byte blob;
`vdbe.c:filterHash/FilterAdd/Filter` adds native integer/IntReal or IntValue REAL,
Str/Blob flags plus4093, NULL zero, modulo uint64 then80000 bits. Our integer-only
negative controls avoid inventing hash flags: all63 non-NULL probes become17
(absent bit), or80001 (same bit as present1). The enabled native capture asserts
respectively63 absent jumps/0 present, or0 absent/63 present; both return64 LEFT
rows with NULL RHS. A collision is not a match: native seek/residual rejects it.
FilterHit means absent jump, FilterMiss means present fallthrough. ON/OFF rows
must match. IS is not assumed to emit the same NULL-rejecting Bloom route.
Raw primitive witness `where-autoindex-hash.c` now includes the **actual pinned
amalgamation**, calling static filterHash with native Mem flags and IntValue; it
does not copy the hash or define a host hash. Compile with cc -O0,
-DSQLITE_THREADSAFE=0 and -DSQLITE_AMALGAMATION_PATH='"/absolute/oracle-build/build/sqlite3.c"',
link -lm -ldl, then run. Keep binary in card work storage. This is a development
source witness, never a runtime backend. Native successful receipt:
`work:///cards/card-s-a-c/processes/proc-099f56cdce9c/stdout.log`.
It asserts negative uint64 addition/wrap, IntReal, positive/negative REAL
truncation and saturation, equal INTEGER/REAL bits, Str/Blob flag contributions
and NULL zero. Actual flags: Int4, IntReal32, Real8, Str2, Blob16, Null1.
Equal1 Int/Real both hash/bit1; −1 hashes UINT64_MAX; −1+2 wraps to1.
This raw witness complements, not replaces, native affinity and SQL-level
no-false-negative ON/OFF cases. Detailed filter-pulldown remains required.

Native-first capture commands completed exit0 in
`work:///cards/card-s-a-c/processes/proc-c752e7250f09/stdout.log` (first10 cases)
and `work:///cards/card-s-a-c/processes/proc-8937c5dff754/stdout.log` (collations).
Receipts live under `work:///cards/card-s-a-c/boundary/CASE/native.json`.
Earlier diagnose receipt remains independent evidence, not overwritten.

## Work observation and pending safety contracts

Current work observation is implemented by the actual production VM and asserted
in `where-autoindex-baseline.mjs` for absent/collision/empty consumers. Builds are
successful completion at the Once build-exit, not mere OpenAutoindex entry;
empty builds do not dispatch FilterAdd although it remains emitted. Actual
private prefix seeks now contribute to indexSeeks. Covered source-table cursor
accesses are observed only after build completion. Positive-access and failed-build
VM controls prevent constant-zero/entry-only claims. Detailed revision evidence
is in [[card:card-s-j-c]] status; this does not establish finite safety acceptance.
The remainder of this section describes pending exhaustive lifetime/capacity/interruption
controls. Current production release fields count distinct cursor slots, active
Once and live Bloom byte storage. `AUTO_REAL_SURVIVOR=1` exercises actual paused
SQL survivor isolation at done/reset/finalize and post-row cancel/timeout, including
saved first-error identity and native row continuation. `AUTO_REAL_CAPACITY=1`
measures whole-execution maxBytes highwater then exercises H−1/H/H+1 with other
limits nonbinding and survivor excluded. The limiting owner may be auto packed
build/probe scratch or sorter; public limit message is caller-owned per fixture,
with PrivateStateLimitError cause. Other dimensions/internal phase schedules
remain pending. Historical no-runtime statements below apply to that baseline
revision, not current work/release observation.

`where-autoindex-contract.mjs` exports executable assertions, exercised by
`node --test docs/research/where-autoindex-contract.test.mjs`. Synthetic contract
self-tests are NOT runtime tests. Explicitly skipped feature cases mark missing
implementation; skipped tests never count as runtime passing. The work snapshot
now comes from production; finite safety adapters remain pending and must capture
actual execution rather than infer work from SQL or alias unrelated counters.

Version1 snapshot fields: `version=1`; `planKind` chosen retained loop kind;
`executedOps` unique actually-dispatched opcode names (not emitted-only ops);
`builds` successful completion of the Once-controlled automatic build per execution/frame; `insertedRecords` successful
IdxInsert calls (128 here, NOT native statement-status127); `probes` Filter calls
excluding EQ NULL bypass; `filterAbsent` taken absent branches; `filterPresent`
fallthrough; `indexSeeks` actual automatic-cursor SeekGE calls; `collisionRejects`
present-filter probes whose authoritative prefix search finds no equal key;
`coveringTableLookups` original RHS seeks/record loads after build (zero).
Counters reset per execution; read snapshots must be immutable copies.
`where-autoindex-pending-controls.mjs` supplies adapter-driven executable
work/lifetime, capacity and interruption assertions; no adapter exists yet.
Its limit result uses existing PrivateStateLimitError, not a new public code.
`workAndLifetime` requires four distinct caller-owned expectation objects
(rows, columns, work) for first/reset/bind17/reprepare; all runs assert complete
results, metadata, no error and work, including replacement. Reprepare returns
old-owner release and paused-survivor snapshots for release validation.
`interrupted` requires caller-owned exact error name/message per cause, complete
retry expectation and survivor rows. Only build has page/record/filter allocation
faults; cancel/deadline target both phases. Adapter-reported expected errors are
not an oracle. Negative self-tests in the lifetime/fault contract test files
exercise wrong errors, stale rows, missing builds/refunds and damaged survivors.
These use synthetic data only: real native fixtures, production adapter and
actual public error selections remain pending.
ExecutionId changes on reset/rebind/reprepare execution; planIdentity remains
stable across reset/rebind without reprepare. Reprepare must instead publish a
new immutable plan after releasing the old execution (not covered by assertFresh).

Release snapshot: `ownerId` is a positive stable execution-owner integer, distinct
from the independently paused survivor owner. `chargedBytes` and `refundedBytes`
are cumulative successful charges/refunds for that same owner, never reset by
cleanup; charged−refunded must equal ownedBytes, and the fixture must have charged
positive bytes. Survivor snapshots require a positive ownedBytes and ownerId;
undefined/empty snapshots cannot establish independence. After interrupted-owner
cleanup, resume the survivor and assert progress and complete native-expected rows.
`ownedBytes` is charged bytes attributable to this execution,
`openCursors` live execution-owned cursors, `onceActive` reusable Once state,
`filterBytes` owned Bloom bytes. All zero/false after release. Independent
statement snapshots must be byte-for-byte unchanged by another owner's cleanup.
Use existing limits/work/scheduler/abort/deadline, no new public options. Future
private deterministic pause/fault controls must identify execution, phase
(build/probe), successful allocations and requested bytes; fail before allocation
publication, preserve the original error, and never replay work automatically.
Capacity tests measure successful high-water H separately for maxBytes,
maxEntries and maxKeyBytes, including every private consumer of the same execution
but excluding separately owned survivor resources. Vary only that dimension with
others nonbinding, then exercise H−1/H/H+1 on identical input; below-boundary
build admission must publish no result rows, never fallback, preserve limit error,
and release resources. At/above boundary require complete expected results and
actual work. The capacity contract self-test mutates these branches; actual
high-water observation/allocation adapter remains pending. Also require partial
page/record/filter allocation faults. Cancel/deadline must fire
after confirmed work in each phase, and reset/retry/finalize/close must verify
release plus independent statement survival. These are required pending controls,
not executed safety guarantees. Empty skip bodies are inventory, not coverage.

Native parameterized lifetime case (`--case lifetime`) now reuses the same
statement for bindings1 twice and17 twice, finalizes then prepares anew for80001
twice. All encodings and automatic_index ON/OFF record full plans, typed rows,
five metadata fields and per-run work. Native first pair returns512 matched rows;
subsequent pairs64 NULL-extended rows. A RHS-only parameter predicate is pushed
into native partial build:17 and80001 both build an empty filter, so both have
64 absent jumps, not the original fixture's collision behavior. The initial
incorrect collision expectation failed (`proc-afe3a086111a`); corrected receipt
`work:///cards/card-s-a-c/lifetime-native-corrected/native.json` SHA256
31306a4059579967867b54d3284ae5f65a4d9e5d5fc5a9bbce9da653db80a32b
passed (`proc-dc35a9e21072`). Public baseline companion binds/resets/reprepares
and checks all36 executions (2 SQL alternatives ×3 encodings ×6 runs), metadata
and typed rows, with stable accounting within each identical-binding pair.
This remains scan correctness, not runtime autoindex feature credit.

## Equal-representation SQL control

`--case representations` uses undeclared key affinity (not INTEGER affinity),
so REAL1.0 survives storage. Its projected keys assert actual REAL→INTEGER and
INTEGER→REAL matches, exact TEXT/BLOB storage distinctions, NULL EQ rejection
and missing17 rejection. Native automatic_index ON/OFF typed rows and metadata
agree twice across UTF8/16le/16be (1296 rows each); both FilterAdd/Filter and
OpenAutoindex are required on the enabled path. This exercises numeric-equality
no-false-negative behavior through the actual native producer/consumer, not just
raw hash equivalence. `where.c:1133–1150` permits Bloom for non-TEXT affinity;
`vdbe.c:filterHash` routes REAL through IntValue and preserves TEXT/BLOB flags.
Native-first receipt `work:///cards/card-s-a-c/representations-native/native.json`
SHA2560691d9f832465c1cecd66c2c27fa1f73dcd2bef377e66dfe6b5b178e958b3920;
combined native→public baseline→contract checks exit0 (`proc-75b6c0d47c6e`).
The public companion verifies12 scan executions with typed keys/metadata/reset;
zero TS automatic-index/Bloom feature credit. Other affinity combinations and
standalone Bloom now has the native/pending controls below; additional affinity
combinations and native multi-loop pulldown controls remain obligations.

## Standalone persistent Bloom and pending pulldown controls

`--case standalone` extends the same capture infrastructure: physical `rk`
index, ANALYZE/stat1, repeated CROSS JOIN probes, RHS-only payload predicate.
It requires persistent `USING INDEX rk`/SeekGE and no OpenAutoindex on either
alternative. The native optimization mask (test-control15, BloomFilter0x80000)
disables Bloom alone for the comparison; the legacy receipt `automaticIndex`
boolean also controls PRAGMA automatic_index but is not standalone feature credit.
Both modes return34 typed rows, five metadata fields and DONE twice in all three
encodings; enabled mode requires989 absent jumps/34 present fallthroughs, disabled
mode0/0, autoindex status0 in both. Receipt and final commands are in the current
card status. The existing public companion checks unforced persistent access and
NOT INDEXED correctness, not TS Bloom support.

`where-bloom-contract.mjs` defines a **distinct pending** private adapter contract:
`assertStandaloneBloom` requires version1, persistent-index planKind, stable
indexIdentity, autoindexBuilds0, no dispatched OpenAutoindex, actual Once/FilterAdd/
Filter, exact caller-owned typed rows/metadata/error and exact nonnegative
builds/insertedFilterKeys/probes/absent/present/persistentSeeks/collisionRejects.
InsertedFilterKeys counts actual FilterAdd keys, not automatic IdxInsert or Next.
Probes=absent+present; persistentSeeks=present applies to these single-probe
controls (no IN, extra seek or NULL bypass counted as a probe). Exact `trace`
is caller-selected expected dispatch order, not adapter-generated expectations:
loop/filter/outer-iteration identities must remain distinguishable when the
adapter is implemented. `standaloneBloom` executes/reset/executes each supplied
case and requires fresh positive executionId and stable nonempty planIdentity.

`assertPulldown` compares caller-owned complete per-loop placement observations:
loopId; outer/inOperator/notReady/skipScan booleans; early; keyKind rowid/index;
filterRegisterAfter; breakTargetBefore/After; outerNext; absentTarget; earlyTrace.
Excluded loops must have early=false and no early trace. Eligible early rowid
probes require MustBeInt then Filter; index probes require Affinity then Filter;
the absent continuation is OuterNext, break target is restored and regFilter
cleared. This is a normalized absent-probe trace, not an assertion that a present
probe skips the authoritative persistent seek. where.c construction excludes
outer/IN/unready early initialization; wherecode.c adds skip-scan exclusion and
consumes the initialized register. Tests mutate each exclusion, conversion/order,
continuation/register restoration, wrong index, counts, stale reset and rows.
Four synthetic tests exercise these assertions; the one explicit runtime skip
remains honest. No adapter/production counters are supplied. Three-source
`pulldown` and `pulldown-dependent` captures now compare BloomPulldown on/off
with automatic indexes disabled and Transitive disabled in both alternatives
(sqliteInt.h masks 0x100000/0x80). Ordinary joins permit the independent
later key l.k to initialize under the earlier Once and Filter before the first
SeekGE; dependent r.k cannot move early. Both produce 34 typed rows twice,
metadata5 and DONE in all encodings, preserving actual full EQP/EXPLAIN.
`where-bloom-placement.mjs` defines pending actual emitted-placement observations:
order of Once/FilterAdd/Filter/SeekGE, onceBlocks, laterFilterBeforeFirstSeek,
plus rows/columns/error/fresh positive executionId/stable planIdentity. Native
captures check both absent jumps target the first seek's outer continuation.
The receipt-driven test rejects reversed placement and drives the pending
adapter contract from native expectations. This does not supply production
execution, per-loop state restoration observations, or all outer/IN/skip-scan
native exclusion witnesses. Existing synthetic exclusions retain those obligations.


## Public operation-control baseline

`AUTO_PUBLIC_CONTROLS=1` on the adjacent baseline invokes
`where-autoindex-public-controls.mjs` on each unforced/NOT INDEXED statement
and encoding (nonparameterized, at least two native rows). It tests pre-aborted
signal and zero-duration deadline both before first step and after one result,
exact JSQLiteError kind/message/non-SQLite codes, caller abort reason identity,
failed-step saved error identity, reset cleanup/rethrow followed by safe reset,
full native-typed retry and separately live survivor continuation/metadata.
The expectations come from docs/api.md and VdbeStatement control/reset ownership;
SQLite vdbe.c entry interruption and vdbeaux.c sqlite3VdbeReset supply upstream
halt-before-error-return rationale. AbortSignal/deadline are public adaptations,
not native SQLite error-code equivalence. These finite controls establish public
baseline isolation and error behavior, NOT mid-build/probe interruption, actual
allocation-site failure, refund/high-water, or runtime autoindex/Bloom credit.

## SQLite execution error and off-path baseline

The adjacent `overflow`/`overflow-offpath` captures use the same LEFT join with
an ON CASE residual selecting abs(SMALLEST_INT64) unless l.k=17. Source func.c
absFunc owns integer-overflow detection; vdbeaux.c sqlite3VdbeReset owns cleanup
before reporting the saved error. Both actual automatic-index ON/OFF alternatives
retain full plans, metadata5 and twice/reset results in all encodings. The error
case requires code/extendedCode1, exact integer overflow message, zero rows and
reset1 on both attempts. Public companion requires the independently captured
error, saved-step/reset identity and retry; finalize after reset succeeds.
Off-path fixture sets all outer keys to absent17 and requires64 typed NULL-extended
rows/DONE/reset0. Native enabled filter reports64 absent skips/0 present; the
error case reports0 absent/1 present before failure. EXPLAIN asserts Filter before
SeekGE before abs Function: the negative control tests actual seek/residual
suppression (not merely an isolated abs call). Public scans must preserve the
same suppression. This is finite error/off-path coverage, not corrupt-page,
allocation-site, native runtime or broader evaluation-order acceptance.

## Cross-affinity multikey boundary

`affinity` projects TEXT lhs keys against INTEGER rhs keys with a NOCASE second
key; `affinity-reverse` reverses the declared affinities. Both retain numeric-text
'01'/'1', duplicates, nonnumeric text, NULL and unmatched keys. Pinned
expr.c sqlite3CompareAffinity/IndexAffinityOk and where.c termCanDriveIndex govern
admission: forward native plan indexes both keys and applies NUMERIC Affinity
before Filter/SeekGE; reverse excludes the incompatible TEXT numeric-comparison
key, indexes only payload, has no Bloom and retains the numeric equality residual
after seek. Both alternatives produce2080 typed rows (2048 matches) twice in all
encodings. The existing public companion remains authoritative: the original
491669df baseline failed reverse (1056 rows in UTF8; '01' matches missing).
The scalar emitter's left-biased affinity selection is repaired by consuming
both affiliations through sqlite3CompareAffinity semantics; forward/reverse
now pass the unchanged native-FIRST expectations. [Repair evidence and limits](scalar-comparison-affinity.md).
Do not skip this fixture, replace native expectations, or infer runtime
automatic-index/Bloom feature acceptance.
See [[card:card-s-a-c]] current status for exact evidence and correction scope.

## Remaining acceptance obligations

Bounded new meaningful coverage is native absent-bit/collision plus semantic
all-encoding cases and public scan controls. Actual runtime work assertions await
the implementation dependency through [[card:card-s-a]]. the parameterized lifetime fixture now supplies reset/rebind/reprepare rows and
metadata; a finite integer-overflow/absent-key error/off-path family is now supplied;
independently obtained corrupt-storage controls remain required. Raw native hash/type-flag controls are supplied by the C
witness above. Production resource fault execution remains pending. This document
explicitly does not close the entire accepted brief or
beta.5. File60/batch600, original workloads and caps are unchanged. No WR/MOST
reacceptance or entire-product compatibility claim.
