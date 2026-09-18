# Conformance evidence

This document records bounded evidence; it is not a claim of whole-SQLite compatibility. The product scope is [`SPEC.md`](SPEC.md), sequencing is [`PLAN.md`](PLAN.md), the pinned source identity is [`reference/sqlite/manifest.json`](../reference/sqlite/manifest.json), and protocol/fixture rules are in [`oracle.md`](oracle.md). Counts below always state their denominator. Excluded and local/no-credit companions do not become upstream passes.

## Source and evidence boundaries

All upstream references below are against SQLite **3.53.4**, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. [`SQLITE_SOURCE_MAP.md`](SQLITE_SOURCE_MAP.md) maps the relevant C routines and Tcl tests. Native code, generated databases, fixture serving, and the oracle are development evidence only; the shipped runtime does not use native SQLite as a backend.

There are three intentionally separate kinds of evidence:

1. **Native oracle credit**: exact selected upstream assertion IDs observed against the pinned native build.
2. **No-credit companions**: repository assertions for transport fidelity, adaptation, or safety. They are useful regressions but never increase the upstream numerator.
3. **TypeScript/runtime evidence**: only operations actually reached through the public adapter or a clearly labelled internal storage/parser test. A mapped-but-unreached SQL assertion receives zero TS credit.


## Stage 3 comparison/collation/record-key tests-first evidence

[[card:card-f-b-a]] established a bounded 19-case manifest in
`test/conformance/cases/stage3-comparison-key.json`: 6 literal upstream SQL
assertions, 8 internal runtime-facing vectors, and 5 local safety companions.
`test/conformance/comparison-key-manifest.test.py` is executable coverage of the
tests-first contract: it checks the exact SQLite source ID, literal assertion IDs
and SQL text against the extracted 3.53.4 tests, required C routine anchors, unique
bounded IDs, zero-credit classifications, the closed four-function handoff, and
exact title links for newer executable orientation, incremental-limit, and seek
construction evidence.
The tranche represents storage-class/numeric boundaries, BINARY embedded-NUL,
ASCII-only NOCASE, RTRIM byte-space behavior, cached numeric+TEXT, per-term
DESC/NULL ordering, key-versus-total fields, prefix/defaultRc/eqSeen, record
borrows, malformed headers, and configured limits.

The manifest keeps all 6/6 mapped upstream SQL cases
`unimplemented-temporary`. Its 8 internal vectors are now explicitly
`executable-internal-no-public-sql-credit`; all 5 current malformed/limit/caller-
construction specifications remain local safety with no credit. A separately linked production-orientation regression is executable
internal evidence. All execute through `test/value/comparison.test.mjs`. These
internal passes confer no public SQL credit because resolver/compiler/VDBE/index consumers
have not reached `src/internal/comparison.ts`. The implementation exposes SQLite's
packed-LHS/unpacked-RHS sign directly, keeps `defaultRc` on that RHS, and sets
`eqSeen` only after equal/exhausted comparison. Current-pin `record` versus `seek`
construction replaces unsupported legacy prefix labels: seek admits only a
nonempty prefix through `nKeyField`, while short ordinary RHS comparison is
rejected. The direct pinned comparator lane additionally proves the asymmetric
boundary: intentional short seek RHS reaches `defaultRc`, but equal-prefix packed
LHS header exhaustion reports corruption with `eqSeen` false. Those two cases remain
direct native/internal zero-credit evidence. A distinct declared-serial truncated-
payload vector is deliberately stricter TypeScript untrusted-input safety: the
pinned comparator probe returns `-1`/`eqSeen=false`/`errCode=0` because that path
assumes readable padded/valid b-tree buffers. It is labeled local safety plus a
native source-assumption observation, not parity, and earns no credit. Comparison uses the singular Mem,
preserves input caches, validates borrows, and limits built-ins to BINARY,
ASCII-only NOCASE, and RTRIM. At the historical tests-first mapping checkpoint,
the C-API oracle protocol exposed no internal Mem/key diagnostic and the pinned
oracle binary was unavailable, so that checkpoint claimed no native comparison
result. The later development-only direct comparator harness now supplies the
explicit no-public-credit and source-assumption observations described above; it
does not expand the public oracle protocol or SQL credit. The custom
`add_int_type` helper required by `types3-3.3` remains a future development-only
fixture extension, not a runtime host-function or host-collation facility.

## Stage 3 internal Mem numeric/affinity/CAST evidence

[[card:card-f-a-c]] translates the bounded internal value conversion surface from
SQLite 3.53.4 `util.c:sqlite3Atoi64`/`sqlite3AtoF`,
`vdbe.c:applyNumericAffinity`/`applyAffinity`, and
`vdbemem.c:sqlite3VdbeMemNumerify`/`sqlite3VdbeMemCast`. Direct internal cases in
`test/value/mem-numeric.test.mjs` cover the mapped `cast.test` value classes plus
int64 extrema/overflow classification, numeric prefix versus lossless affinity,
INTEGER/REAL/TEXT/BLOB casts, UTF-16 numeric input, embedded NUL, signed zero, and
infinity. Exact caller-mask regressions additionally verify reusable
INTEGER/REAL/IntReal+TEXT caches, encoding preservation, and deliberate clearing
by TEXT/BLOB versus numeric casts/affinity, including subtype/from-bind behavior.
The focused tests, typecheck and conformance-accounting checks pass (9/9
internal tests; log `work:///cards/card-f-a-c/processes/proc-6e3f33a56353/stdout.log`).
These internal regressions confer **zero public SQL credit**: mapped SQL cases stay
temporary until compiler/VDBE/public statement execution reaches this surface.


### Reproducible assets

The development-only oracle implementation and build/profile checks live under `tools/oracle/` and `test/oracle/`. The protocol requires the exact source identity and mandatory JSON, math, UTF-16, floating-point, column-metadata, and autoreset capabilities described in [`oracle.md`](oracle.md); a missing capability is a failure, not a skip.

`test/fixtures/CURRENT.json` selects an immutable generation by semantic catalog hash. The selected catalog contains eight distinct, hashed, sidecar-free, read-only databases: `empty`, `close`, `bind`, `meta`, `encoding-utf8`, `encoding-utf16le`, `encoding-utf16be`, and `readonly`. Fixture specs and generation tests verify encoding, schema, rows, hashes, source/profile provenance, read-only reopen, integrity, and absence of journal/WAL/SHM sidecars. The runner-owned loopback server in `test/conformance/fixture-server.mjs` serves only validated catalog artifacts so the TS lane exercises the unchanged public Fetch boundary rather than a test-only byte-open API.

### Native oracle result

`test/conformance/cases/stage2-initial.json` is the denominator: **38 exact upstream IDs** and **9 no-credit companions**. The upstream groups are:

- 10 lifecycle assertions, `close.test:close-1.1` through `close-1.4.4` as explicitly enumerated by the manifest;
- 6 UTF-8/UTF-16 prepare, tail, and error assertions from `capi3c.test`;
- 10 binding/name/int64 assertions from `bind.test`;
- 8 metadata/storage-value assertions from `capi3c.test`;
- 3 database-encoding assertions from `enc2.test`; and
- 1 read-only assertion, `readonly.test:readonly-1.2`.

The nine companions cover reset retention, clear-bindings observations, finalize, exact int64 transport, special REAL transport, NULL versus empty TEXT/BLOB, arbitrary blob bytes, and duplicate ordered columns.

The durable observation file `test/conformance/last-native.jsonl` ends with:

```json
{"summary":{"oraclePassed":38,"companionPassedNoCredit":9,"oracleObservations":47,"tsPassed":0,"tsUnimplemented":38,"tsCompanionUnimplementedNoCredit":9,"engine":"unimplemented"}}
```

It contains 58 passing observation records: 38 selected upstream assertions, 9 companions, and 11 fixture-open observations. The summary record is the 59th JSONL line. Thus the credited native result is **38/38**, while companion evidence is **9/9 with zero upstream credit**. This recovery did not rerun the native lane because this card's disposable work root has no built `libsqlite3-oracle.so`; the result above is a checked-in artifact corroborated by the approved Stage 2 record for [[card:card-c]], not a newly observed run.

### Stage 2/3 public harness accounting

`test/conformance/cases/stage2-ts.json` deterministically expands the same manifest to **47** ordered public-operation sequences. `test/conformance/generate-ts-cases.py --check` and `test/conformance/ts-accounting.test.mjs` enforce exact-once IDs, 38/9 classification, a real successful `openFixture`, the exact first failed operation, and the unattempted suffix. The runner does not convert adapter/import/transport/SQLite errors into unsupported observations.

At the completed acquisition/storage milestone recorded by [`PLAN.md`](PLAN.md), [`oracle.md`](oracle.md), and approved [[card:card-d]], all 47 sequences completed real catalog-backed Fetch acquisition and then stopped at operation index 1, public `prepare`, with a genuine temporary-unsupported error. Therefore that recorded milestone had **47/47 acquisition attempts succeed**, **0/38 upstream SQL assertions pass in TS**, and **0/9 companion SQL assertions pass**. Every operation after `prepare` was explicitly unattempted.

That historical result is not silently promoted to parser or execution credit. An
early recovery run failed on the first sequence because then-current parser code
returned a syntax error for `SELECT * FROM t`; this was a harness/parser integration
failure, not acquisition credit. Subsequent parser repairs restored the intended
post-parse temporary-unsupported compiler boundary. The current accounting remains
47 attempted sequences, 0/38 upstream SQL passes, and 0/9 companion SQL passes.

## First prepared SELECT tests-first tranche ([[card:card-h-a]])

`test/conformance/cases/stage3-first-select.json` adds a separate, bounded tranche;
it does not alter or replace the historical Stage 2 denominator of **38 upstream +
9 no-credit companions = 47 sequences**. Its eight literal upstream assertions are
`test/e_expr.test:e_expr-2.1` through `e_expr-2.4`,
`test/select1.test:select1-1.4`, `select1-1.6`, `select1-1.8.1`, and
`select1-3.3`. The manifest records exact source assertion/setup anchors, SQL,
typed native expectations, and an explicit operation-by-operation TS disposition.
The public runner now completes all eight through finalization; none of their
operations are unattempted. **TS credit is 8/8** for these exact upstream
first-SELECT cases. `test/conformance/run-first-select-ts.mjs` emits a distinct
result for each case with every operation's attempted/pass/fail state and an
explicit zero unattempted summary; validation is identity- and assertion-based,
not count-derived. The four boundary/encoding companions remain explicitly
no-credit. Broader SELECT features remain gaps.

Four executable no-credit boundary groups cover (1) sparse/repeated parameter
numbering, names, binding, reset retention, clear-bindings and finalize; (2)
UTF-8/UTF-16le/UTF-16be ordered duplicate columns, metadata and typed values; (3)
int64/REAL/NaN/infinity, NULL, empty/nonempty TEXT/BLOB and copied bind input; and
(4) empty SQL, exact UTF-8 tail, row validity, legacy BUSY close, deferred close
and final cleanup. These native/API observations remain distinct from TS
compatibility credit. In the card's pinned native run all **8/8 upstream
assertions** and **4/4 no-credit groups** passed; this does not claim engine
implementation (`work:///cards/card-h-a/processes/proc-62f4a9867827/stdout.log`).

Canonical integration is fail-closed and reproducible from the repository root:

```sh
npm run test:conformance:accounting
npm run test:conformance:native
```

The accounting command includes `first-select-manifest.test.py`, which validates
source identity, literal assertion/setup anchors, uniqueness, additive counts,
and attempted/unattempted TS accounting. The native command passes the pinned
`$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so` to
`run-first-select-native.py` after the existing native lanes. A missing or
incompatible shared library fails the command; it is never treated as a skip or a
count-derived pass.

## Stage 3: immutable format-3 storage and schema foundation

[`file-format.md`](file-format.md) documents the implemented full-file acquisition,
immutable storage owner, header/page validation, record decoding, overflow
traversal, and known-root table/index b-tree cursor. A later Stage 3 tranche now
uses those primitives for bounded immutable internal schema discovery across all
three database encodings. Generated SQL parsing is also implemented; public
resolver/compiler/VDBE execution remains unimplemented.

`test/conformance/cases/stage3-storage.json` records **7 source-derived entries** and **7 local safety adaptations**. These are a mapping, not seven public SQL passes. The source-derived entries cover page-size reopen/header observations, integrity after population, the three database encodings, and an uncorrupted multilevel table/index database. The local entries cover larger product-required page sizes, reserved-byte policy, exact int64 rowids, serial classes, multilevel/overflow shapes, malformed geometry/chains, and partially exercised resource limits.

The fixture producer described in [`file-format.md`](file-format.md) creates 18 databases total: the original eight Stage 2 fixtures plus ten storage fixtures (eight page sizes from 512 through 65536 and UTF-16le/UTF-16be 4096-byte companions). Internal TS tests—not public SQL conformance—exercise b-tree movement/seeks, table/index ordering, overflow reconstruction/corruption, all supported page sizes and encodings, depth/cell bounds, owner invalidation, varints, record serial types, exact integers/REAL bits, TEXT/BLOB distinctions, and malformed record safety.

A recovery-time focused run of `node --test test/storage/record-primitives.test.mjs test/storage/btree-reader.test.mjs` passed **15/15** tests. This result grants no public SQL/API credit. At that **historical storage-only checkpoint**, `maxWorkUnits`, schema discovery, comparison/collations, public value conversion, and SQL execution were gaps. Schema discovery, parser work, internal Mem/public value conversion boundaries, and internal comparison/collation/record-key foundations later landed; the current first-SELECT compiler/VDBE/full-table-scan slice is documented below, while general resolver/VDBE and index/sorter consumers remain gaps. `maxFileBytes` belongs to separate acquisition coverage.

## Parser foundation evidence ([[card:card-e-b]])

This section is intentionally after the recovered Stage 2/Stage 3 evidence.

`test/parser/tokenizer-parser.test.mjs` preserves exact upstream IDs `test/tokenize.test:tokenize-1.1..1.12` and `tokenize-2.1..2.2`; focused companions cover generated keyword classification, quotes, comments, parameters, blob literals, non-ASCII byte spans, supplementary-character tails, empty SQL, SELECT structure, schema DDL structure, and syntax boundaries. `test/parser/generator.test.mjs` checks two clean generations and checked-in byte identity. These tests are foundation evidence only, not broad SQL execution conformance.

The generated runtime now attaches bounded SELECT and stored CREATE
TABLE/INDEX/VIEW/TRIGGER structures during actual Lemon reductions; complete
semantic compilation, resolver/compiler/VDBE execution, and the still-staged
schema constructs remain uncredited gaps. The 47-case current lane now completes
with every SELECT stopping at temporary unsupported after parsing; parser-local
and schema-local green tests must not be reported as the 38 upstream execution
assertions.

## Commands and recovery-time verification

Run from the repository root:

```sh
npm run typecheck
npm run test:conformance:accounting
npm run test:conformance:ts
node --test test/storage/record-primitives.test.mjs test/storage/btree-reader.test.mjs
npm run test:package-boundary
npm run test:parser
```

Observed during that historical recovery checkpoint (not the current verification
record):

- `typecheck`: passed.
- `test:conformance:accounting`: passed; reported deterministic **38 upstream + 9 companions** and the required real-open/exact-failure accounting rules.
- `test:conformance:ts`: failed as described above; it must not be reported as a passing check.
- focused storage tests: passed **15/15**.
- package boundary: passed; private package with no runtime native/tool/fixture imports.
- Native conformance was not rerun because the required built shared library was absent from this card's work root.

The checked-in manifests and JSONL artifact are the machine-readable authority for historical counts. Unknown prior prose wording and any results not represented by those artifacts or durable card records were not reconstructed as fact.

## Stage 3 internal Mem core evidence

`test/value/mem-core.test.mjs` supplies six internal primitive tests mapped to
pinned 3.53.4 `vdbemem.c` set/copy/move ownership behavior. They cover NaN versus
infinity and integral REAL, NULL/empty, int64/IntReal, explicit byte lengths and
embedded NUL in UTF-8/UTF-16le/UTF-16be, zero-tail BLOB, subtype, full/shallow/move,
borrow invalidation, aggregate cleanup, limits, raw-record adaptation, and copied
public BLOB input/output. Explicit stale-borrow, malformed-lifecycle, lone-
surrogate, and limit checks are local safety companions and receive no upstream
SQL-conformance credit. These tests exercise an internal primitive, not the public
SQL adapter; no SQL execution pass is claimed.

## Stage 3 internal arithmetic and NULL/truth evidence

[[card:card-f-a-d]] directly executes the pinned internal `Mem` primitive port in
`src/internal/vdbe-primitives.ts`. The upstream numerator for this bounded internal
tranche is **7/7** exact assertions: `test/e_expr.test:e_expr-2.3`, `e_expr-2.4`,
and `e_expr-6.1`–`e_expr-6.5`. The same focused suite includes three explicitly
no-credit boundary groups for arithmetic overflow/zero/IEEE behavior, 64-bit
bitwise shifts, and three-valued NULL/truth/branch behavior. The pinned native
oracle independently produced matching typed outputs for 36 representative SQL
expressions; this is development evidence, not a shipped backend.

Verification: `node --experimental-strip-types --test test/value/vdbe-primitives.test.mjs test/value/mem-numeric.test.mjs test/value/mem-core.test.mjs`, `npm run typecheck`,
and `npm run test:conformance:accounting` pass. Exact mappings and credit labels
are in `test/conformance/cases/stage3-vdbe-primitives.json`. Public SQL credit is
still **0/7** because resolver/compiler/VDBE statement execution does not yet call
these primitives; that is temporary unsupported, not a primitive mismatch.

### Mem canonical-cache repair evidence

The correction prompted by `record:///review.md?card=card-f-a&v=3` adds direct
internal tests for INTEGER+TEXT, REAL+TEXT and IntReal+TEXT, reuse of canonical
cache bytes, forced clearing, subtype clearing, and coexistence through full copy,
shallow copy, move, source reset/borrow invalidation and destination reset. It also
tests `changeEncoding` byte lengths and embedded NUL across UTF-8/UTF-16le/be,
SQLite legacy malformed UTF-8 replacement, odd UTF-16 truncation through UTF-8,
and odd-byte preservation on direct UTF-16 endian swap. These are source-mapped
internal tests, not public SQL execution or SQL conformance credit.


## First-SELECT implementation and promotion ([[card:card-h-b]], [[card:card-h-c]], [[card:card-h-d]])

All eight exact upstream first-SELECT assertions now execute through the public
TypeScript compiler/program/VDBE path. `test/conformance/run-first-select-ts.mjs`
checks each declared operation and exact typed result independently, producing
8/8 credit with zero failed or unattempted operations. Native remains a distinct
8/8 oracle lane plus 4/4 no-credit boundary groups; the historical Stage 2 38+9
inventory remains unchanged and does not contribute to this tranche's credit.
The four companion groups remain no-credit even where focused implementation tests
exercise their parameter, value, lifecycle, encoding, metadata, and close behavior.

- The selected Stage 3 expression/core-scalar lane now earns 40/40 TS credit through public prepare/metadata/step/finalize. This does not promote its 12 companions or the ordinary-scalar backlog described in TRANSLATION.

The historical multi-source semantic-foundation lane had **0 runtime credit**.
The 2026-09-17 bounded runtime tranche now passes the admitted pinned/public matrix
**8/8** and focused comma/CROSS/INNER suite **27/27**. The source artifact remains
exactly **47/47 captured** and is not claimed as 47 runtime passes: LEFT/RIGHT/FULL
unmatched execution remains atomically gated. Public companions cover two/three
sources, USING/NATURAL projection, all encodings, reset/rebind, scan order,
cancel/deadline/work/resource cleanup, and the joined compound arm. GROUP/HAVING,
outer joins, frame/window/aggregate execution, and general functions remain downstream.

### Expression bounded-execution companion

`npm run test:conformance:expressions:bounded` is a translated-runtime public-path safety companion, not additional upstream case credit. It verifies exact scalar work admission, checkpoint abort/deadline behavior, connection `maxResultBytes` preflight for replacement growth, parameter and column-origin inputs, saved-error identity, cleanup, and post-reset reuse. Native boundary captures remain oracle-only.

### Relational working-state pre-implementation gate

`stage3-relational-working-state.json` is a schema-v4, native-captured development gate for ORDER BY, DISTINCT, LIMIT/OFFSET, compounds, and private-state cleanup. The TypeScript private-state safety companions additionally assert exact per-record/logical-byte/KeyInfo-term/merge-move charging and exhaustive cleanup-error behavior; these remain no-credit lifecycle evidence. Validate it with `python3 test/conformance/relational-working-state-manifest.test.py`; regenerate only with the pinned metadata-enabled native library and `capture-relational-working-state.py`. The validator requires literal upstream IDs/setup anchors, exact source identity, typed ordered values, operation partitions, and phase-correct errors. `run-relational-working-state-ts.mjs` attempts/passes 3 literal upstream assertions: declared 18, attempted/passed 3, unattempted 15, upstream credit 2, companion credit 0. `up-distinct-3.0` passes but is no-credit pending exact UNIQUE-autoindex fixture parity; credited IDs are `up-limit-1.2.1` and `up-select4-10.3`. Its two additional exact public-API sorter/ephemeral queries are uncredited smoke demonstrations outside the declared denominator. Companion tests and native matches never establish upstream compatibility.

### Aggregate private-byte correction evidence (2026-09-16)

`maxPrivateBytes` is now tested as one execution-wide bound across simultaneous
sorter and ephemeral cursors, rather than as a separate allowance for each cursor.
The internal private-state suite covers cross-kind reservation, atomic failed
reservation/replacement, post-growth rollback, clear, and close. The public
compound lifecycle suite forces two individually admissible 8-byte INTEGER set
entries to overlap under a 12-byte limit and requires a `kind:"limit"` failure,
first-error identity through reset/finalize, deterministic rerun, full cleanup,
and successful later connection admission. These are no-credit resource/lifecycle
companions: they do not change the relational 18-case accounting or the compound
gate's 22 declared/attempted/passed/credited cases.

### Historical RIGHT/FULL bounded gate (2026-09-17; superseded below)

`test/conformance/multisource-right-full.test.mjs` compares 7/13 RIGHT/FULL-bearing
cases from the immutable pinned 3.53.4 multi-source capture through the public typed
API and adds reset/rebind plus cancellation, deadline/work, and shared private-state
failure checks. The other six remain explicit zero-credit temporary gates; do not
report the 47/47 native capture as TypeScript runtime credit.

### Historical RIGHT/FULL manifest promotion (2026-09-17; scope corrected below)

Public typed execution now credits all 15 bounded RIGHT/FULL-adjacent stage-3 manifest cases: 13 successful result/metadata cases and two pinned prepare diagnostics. Coverage includes terminal and downstream barriers, both unmatched sides, USING/NATURAL and wildcard ownership, WHERE/ON placement, and FULL downstream composition. UTF-16le/be smoke probes supplement the UTF-8 captured matrix. This is not a claim for neighboring aggregate, subquery, generated-column, or WITHOUT ROWID SQL, which retains its documented gates.

### Repeated-barrier correction (2026-09-17, current)

The 15-case promotion above remains the complete pinned **single-barrier** denominator; it is not evidence for repeated RIGHT/FULL barriers. Repeated RIGHT, repeated FULL, and mixed RIGHT/FULL statements are now public prepare-time atomic failures. Focused tests cover representative downstream and WHERE shapes and prove no partially lowered execution is returned. Per-barrier execution remains an explicit next tranche.

## Aggregate GROUP/HAVING bounded runtime evidence ([[card:card-l-c]])

The immutable pinned-native denominator is
`test/conformance/cases/stage3-aggregate-group.json`. The current public runner
attempts 32 card-applicable cases and credits **20/32** exact typed-row/metadata or
expected-diagnostic comparisons; **12/32** remain atomic typed temporary prepare
errors. This is bounded credit, not aggregate-surface or SQLite compatibility.
`SELECT`-level DISTINCT over admitted grouped output is additional focused public
companion evidence outside that frozen denominator.

`test/conformance/aggregate-group-lifecycle.test.mjs` exercises that companion and
the grouped producer through the public API: typed duplicate removal including
NULL and NOCASE, result ordering, UTF-8/UTF-16le/UTF-16be execution, reset after a
yielded row and after completion, cancellation during cooperative suspension,
deadline and exact work failures, shared entry/key-byte/total-private-byte limits,
exactly-once private cursor cleanup, reset/finalize first-error retention, and
restored connection admission. `test/schema/catalog-init.test.mjs` separately
proves the bounded schema prerequisite used by the encoding fixtures: a NULL-SQL
`sqlite_autoindex_<table>_1` is reconstructed only for an unambiguous
single-column, non-INTEGER PRIMARY KEY on a rowid table. Composite, UNIQUE,
WITHOUT ROWID, later-ordinal, and other implicit-index shapes remain temporary
schema gates; this does not expand aggregate scope.


### Historical 2026-09-18 ordinary WITH composition checkpoint (recursive status superseded below)

At the ordinary-WITH checkpoint, public companion evidence in all three database
encodings covered represented derived-WITH owners, persisted-view WITH owners
without caller-scope capture, mixed table/CTE CROSS JOIN, grouped aggregate, and
bounded UNION ALL composition. Recursive self-reference was recognized before
ordinary lowering and then rejected with the dedicated temporary prepare
diagnostic; that checkpoint credited no recursive queue execution. Expression-
owned nested WITH remained a distinct asserted temporary gap. Native credit at
that checkpoint remained limited to the immutable card-n-a architecture oracle
manifest. The recursive tranche below supersedes only the old recursive admission
status; it does not relabel architecture or ordinary public evidence.

### Bounded recursive CTE conformance (2026-09-18, current)

The represented recursive subset executes iteratively through the VDBE queue
route: FIFO `UNION ALL`, all-history duplicate suppression for `UNION`, priority
ordering, recursive LIMIT/OFFSET, represented validation diagnostics, and bounded
lifecycle/control behavior. Unsupported recursive source/destination compositions
remain atomic temporary gaps; this is not unrestricted recursive-WITH credit.

`stage3-recursive-cte.spec.json` and its capture contain **5 upstream-credit
assertions + 2 no-credit companions**, executed against pinned SQLite 3.53.4 in
UTF-8, UTF-16LE, and UTF-16BE for **21 pinned native encoding executions**. Native
upstream credit and companion evidence remain separate. The public affected CTE
suite is also separate evidence: its **39/39** observations cover bounded ordinary
and recursive execution, diagnostics, encodings, typed rows/metadata, composition,
resource/control behavior, and lifecycle; those observations are not added to the
native denominator or upstream-credit count.
