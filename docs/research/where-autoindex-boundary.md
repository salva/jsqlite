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
This is not raw Mem flag/hash coverage; signed wrap, IntReal, saturation, explicit
native hash receipts and detailed filter-pulldown remain required.

Native-first capture commands completed exit0 in
`work:///cards/card-s-a-c/processes/proc-c752e7250f09/stdout.log` (first10 cases)
and `work:///cards/card-s-a-c/processes/proc-8937c5dff754/stdout.log` (collations).
Receipts live under `work:///cards/card-s-a-c/boundary/CASE/native.json`.
Earlier diagnose receipt remains independent evidence, not overwritten.

## Pending exact private observation contract

`where-autoindex-contract.mjs` exports executable assertions, exercised by
`node --test docs/research/where-autoindex-contract.test.mjs`. Synthetic contract
self-tests are NOT runtime tests. Explicitly skipped feature cases mark missing
implementation; skipped tests never count as runtime passing. No runtime counter
was added. Future adapter must capture actual production execution, not infer
work from SQL or alias existing persistent-index counters.

Version1 snapshot fields: `version=1`; `planKind` chosen retained loop kind;
`executedOps` unique actually-dispatched opcode names (not emitted-only ops);
`builds` successful OpenAutoindex per execution/frame; `insertedRecords` successful
IdxInsert calls (128 here, NOT native statement-status127); `probes` Filter calls
excluding EQ NULL bypass; `filterAbsent` taken absent branches; `filterPresent`
fallthrough; `indexSeeks` actual automatic-cursor SeekGE calls; `collisionRejects`
present-filter probes whose authoritative prefix search finds no equal key;
`coveringTableLookups` original RHS seeks/record loads after build (zero).
Counters reset per execution; read snapshots must be immutable copies.
`where-autoindex-pending-controls.mjs` supplies adapter-driven executable
work/lifetime, capacity and interruption assertions; no adapter exists yet.
Its limit result uses existing PrivateStateLimitError, not a new public code.
Adapter bind(17) must use a parameterized fixture whose expected work is supplied
by the caller (not the fixed literal captures). Fault-driver behavior and actual
runtime results remain pending; importing these functions is not execution.
ExecutionId changes on reset/rebind/reprepare execution; planIdentity remains
stable across reset/rebind without reprepare. Reprepare must instead publish a
new immutable plan after releasing the old execution (not covered by assertFresh).

Release snapshot: `ownedBytes` charged bytes attributable to this execution,
`openCursors` live execution-owned cursors, `onceActive` reusable Once state,
`filterBytes` owned Bloom bytes. All zero/false after release. Independent
statement snapshots must be byte-for-byte unchanged by another owner's cleanup.
Use existing limits/work/scheduler/abort/deadline, no new public options. Future
private deterministic pause/fault controls must identify execution, phase
(build/probe), successful allocations and requested bytes; fail before allocation
publication, preserve the original error, and never replay work automatically.
Capacity tests must measure successful high-water H then exercise H−1/H/H+1 on
identical input, plus page/record/filter partial faults. Cancel/deadline must fire
after confirmed work in each phase, and reset/retry/finalize/close must verify
release plus independent statement survival. These are required pending controls,
not executed safety guarantees. Empty skip bodies are inventory, not coverage.

## Remaining acceptance obligations

Bounded new meaningful coverage is native absent-bit/collision plus semantic
all-encoding cases and public scan controls. Actual runtime work assertions await
the implementation dependency through [[card:card-s-a]]. Missing parameterized
rebind/reprepare fixtures, independently obtained error/corrupt/off-path captures,
raw native hash/type-flag controls, and executable resource fault drivers remain
required; this document explicitly does not close the entire accepted brief or
beta.5. File60/batch600, original workloads and caps are unchanged. No WR/MOST
reacceptance or entire-product compatibility claim.
