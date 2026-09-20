# Conformance evidence

This document records bounded evidence; it is not a claim of whole-SQLite compatibility. The product scope is [`SPEC.md`](SPEC.md), sequencing is [`PLAN.md`](PLAN.md), the pinned source identity is [`reference/sqlite/manifest.json`](../reference/sqlite/manifest.json), and protocol/fixture rules are in [`oracle.md`](oracle.md). Counts below always state their denominator. Excluded and local/no-credit companions do not become upstream passes.

## Source and evidence boundaries

All upstream references below are against SQLite **3.53.4**, source ID `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`. [`SQLITE_SOURCE_MAP.md`](SQLITE_SOURCE_MAP.md) maps the relevant C routines and Tcl tests. Native code, generated databases, fixture serving, and the oracle are development evidence only; the shipped runtime does not use native SQLite as a backend.

There are three intentionally separate kinds of evidence:

1. **Native oracle credit**: exact selected upstream assertion IDs observed against the pinned native build.
2. **No-credit companions**: repository assertions for transport fidelity, adaptation, or safety. They are useful regressions but never increase the upstream numerator.
3. **TypeScript/runtime evidence**: only operations actually reached through the public adapter or a clearly labelled internal storage/parser test. A mapped-but-unreached SQL assertion receives zero TS credit.


## Window functions tests-before-port gate ([[card:card-o-a-b]])

`test/conformance/cases/stage3-window.spec.json` declares a bounded **29-case**
window slice: **10 exact upstream assertions** and **19 source-based/local
no-credit companions**. `stage3-window.json` is the immutable native expectation.
The pinned capture attempted and passed **28/28 executable native cases**; one
private-controls declaration is intentionally source-only. Native upstream credit
is therefore **10/10**, companion observations are **18/18 executable plus 1
source-only with zero credit**, and public TypeScript is exactly **0 attempted, 0
credited, 29 unattempted**. No result claims exhaustiveness across the 17 upstream
window suites.

The slice covers all three database encodings; typed values and metadata;
prepare/step errors; join, grouped aggregate, subquery, ordinary/recursive CTE and
outer ordering compositions; named inheritance, default/offset bounds;
collation/NULL peers; ROWS/RANGE/GROUPS and all EXCLUDE modes; built-ins and
aggregate windows; same/different window sharing and illegal nesting; lifecycle;
and progress cancellation. Private byte/work/row, deadline and yield controls are
preserved as a source-owner declaration but receive no native or TS credit because
the native C API cannot observe those project-private harness controls faithfully.

Run `npm run test:conformance:window` for schema, pinned identity, exact upstream
ID/SQL anchors, **source-derived setup assertions and reset boundaries**, archive
integrity, source-owner, ordering and denominator integrity. The setup validator
reconstructs each credited setup from a pinned setup assertion, hashes its complete
body, and specifically checks that `window1-6.3` follows the `reset_db` boundary
at `window1-6.1`; `window4-4.1` is tied to the complete `window4-4.0` setup.
After `tools/oracle/build.sh`, `npm run test:conformance:window:native` recaptures to the
card work root and byte-compares the immutable artifact. Native success does not
promote any mapped case to TS runtime credit.

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

### Window rewrite implementation accounting ([[card:card-o-b-f]], 2026-09-18)

The immutable `stage3-window` manifest remains unchanged: 29 declared entries, 28 native executions, 10 upstream credits, and all 29 TypeScript entries unattempted/zero-credit. Source-based `test/conformance/window-rewrite.test.mjs` is deliberately outside that credit denominator. It covers rewrite graph/lifting/sort-copy behavior, selective aggregate-depth repair, exact prepare-time ORDER aggregate misuse, and scalar/table atomic publication gates. Frame runtime remains unsupported, so these tests do not promote any manifest case.


Window setup evidence added by [[card:card-o-b-g]] does not change the immutable denominator: exactly 29 declared entries, 0 TypeScript attempts, and 0 TypeScript credits. The compiler-level source test inspects emitted setup operations, register/cursor identity, compatible sharing, nested ownership, and the existing atomic public gates; it does not execute a frame or manifest case. Its public architecture gate runs two prepare outcomes in each immutable encoding fixture (UTF-8, UTF-16LE, UTF-16BE): exact pre-rewrite `misuse of aggregate: sum()` precedence and temporary unsupported atomic rejection followed by connection reuse. These 6 prepare assertions remain source/architecture evidence outside the execution-credit denominator.

### Aggregate-window execution contract matrix

The frame-execution implementation denominator is
`test/conformance/cases/stage3-aggregate-window.spec.json`, with settled native
expectations in the adjacent `.json`. It declares exactly **44 cases: 25 literal,
hash-bound upstream assertions and 19 no-credit local companions**. Exactly 43 are
native executable and the pinned independently built 3.53.4 library passes 43/43;
the remaining resource-control declaration is source-only because private
byte/entry/key/work/row ceilings, cooperative yield, deadline and injected cleanup
faults are project controls. This paragraph records the preimplementation
allocation; the execution result below supersedes its former zero-attempt status.

`capture-aggregate-window.py` verifies source identity before capture.
`aggregate-window-contract-manifest.test.py` fails closed on archive identity,
source assertion/setup hashes, class partition, case order and all denominators.
The source-credit partition covers source algorithms; encoding, typed-value,
composition and safety/resource companions remain visibly non-credit. This matrix
supplements rather than relabels the earlier 29-case window graph/rewrite evidence.

The EXCLUDE source-credit slots are pinned `window8.test` cases `2.1.3`, `2.2.3`,
`2.3.3`, and `2.4.3`: ordinary aggregate `min`/`max`/`sum` cases for NO OTHERS,
CURRENT ROW, GROUP, and TIES. They replace the similarly numbered `.2`
`nth_value` cases, which require special value-function state outside this goal.
The denominator is unchanged. Coverage in these four slots is now aggregate
EXCLUDE over UNBOUNDED PRECEDING..CURRENT ROW, not `nth_value` or
unbounded-following EXCLUDE coverage.

### Aggregate-window execution result ([[card:card-o-c-b]], 2026-09-19)

The superseding TypeScript result is **43 executable attempted / 43 passed**, with
**25/25 upstream-source-credit cases passed**. Source-only ordinal 44 is excluded
from that denominator and was validated separately: **1 attempted / 1 passed**, no
source credit, by `aggregate-window-private-controls.test.mjs`. The public runner
checks tagged values, metadata, errors, physical UTF-8/UTF-16LE/UTF-16BE fixtures
and represented compositions. These finite denominators do not claim exhaustive
SQLite window compatibility; the separate special-built-in section below now
supersedes this aggregate-only checkpoint for ranking/value execution. The spec
and captured artifact retain their allocation-time `accounting` and per-case `ts`
fields as historical capture provenance. Their `currentTsAccounting` field is the
fail-closed current result checked by the contract validator; native expectations
and source-credit labels are unchanged.

### Special built-in window executable contract ([[card:card-o-d-a]], 2026-09-19)

`test/conformance/cases/stage3-special-window.spec.json` allocates 43 cases before
runtime implementation: 11 exact pinned `window1.test` assertions and 32 no-credit
companions. The immutable native artifact executes 41/41 SQL cases; two companions
are source-only project safety/atomic-rejection contracts. TypeScript accounting is
0 attempted, 0 credited, 43 unattempted. This denominator is additive to, and does
not relabel, the ordinary aggregate-window denominator.

Run `npm run test:conformance:special-window` for archive/source identity, exact
upstream body hashes, registration/arities, allocation and accounting. After
`tools/oracle/build.sh "$SAIVAGE_CARD_WORK_ROOT/oracle-build"`, run
`npm run test:conformance:special-window:native` to recapture and byte-compare typed
rows, metadata, errors, reset/rebind and interruption outcomes. Coverage includes
all 11 special built-ins, frame coercion versus value-frame applicability, all
EXCLUDE forms for value functions, peers/NULL/NOCASE/order policy, parameters and
argument errors, sharing/nesting/compositions, and UTF-8/UTF-16LE/UTF-16BE.

## Special built-in window execution ([[card:card-o-d-b]])

The special-window contract declares 43 cases: 41 executable and two source-only.
`npm run test:conformance:special-window:ts` runs the 41 public cases plus one
accounting test and currently passes **42/42**; source-only declarations receive no
runtime credit. Coverage includes all eleven registered built-ins, arities/frame
coercions, typed INTEGER/REAL/NULL results, validation and diagnostics, peers and
EXCLUDE, callback/direct cursor branches, sharing/nesting, joins/groups/subqueries/
CTEs/recursive and compound producers, UTF-8/UTF-16le/UTF-16be, interruption, and
accounting. The separate aggregate-window plus rewrite gate passes **92/92** and
retains its own 44-declaration denominator (43 executable, 25 source-credit, one
source-only); these denominators are not combined. As with the aggregate artifact,
allocation-time `accounting` and per-case `ts` fields remain historical capture
provenance, while `currentTsAccounting` guards the superseding **41/41 executable
plus 2/2 source-only** result without changing native evidence or promoting
companions to source credit.

## Ordinary scalar tests-first evidence ([[card:card-p-a-a]])

`stage3-ordinary-scalars.spec.json` inventories 50 active in-scope production ordinary-scalar registration rows and declares 37 cases expanded to 59 encoding observations. Fresh manifest-pinned native capture in `stage3-ordinary-scalars.native.json` completes 59/59 typed observations, including one expected step error for multi-character LIKE ESCAPE. This is reference-only and grants **0 TypeScript credit**. This was the tests-first checkpoint before implementation: accounting was 12 genuinely dispatched registration rows and 38 absent (superseded by the current 50/50 accounting below). `python3 test/conformance/ordinary-scalars-manifest.test.py` enforces pinned catalog rows, checked macro semantics/flags, raw and effective scalar arities, exact assertion and setup hashes, nonempty existing source ownership, fixture existence, absent-row/slice case coverage, identity, status counts, and typed outcome presence. It is profile-specific, not a general C preprocessor. The original unsupported runner recorded 114 zero-credit outcomes (38 absent rows × 3 encodings). It now treats those immutable `tsStatus` values as historical baseline metadata, asserts 50 current dispatchable rows, and requires typed success for persisted Fetch rows. Full behavior/slicing/reproduction notes are in [`research/card-p-a-a-ordinary-scalars.md`](research/card-p-a-a-ordinary-scalars.md).

The ordinary-scalar contract separately records raw FuncDef match arity and resolver-selected effective scalar arity. For `min`/`max`, raw `-3` admits 1..1000, while exact one-argument aggregate/window registrations outrank it; ordinary scalar ownership is 2..1000. The native discriminator case covers aggregate, window, and scalar selections. Validator ownership checks require every absent row and source-owned slice to have cases, nonempty source symbols, and verified assertion/setup provenance.

Following independent review `record:///review.md?card=card-p-a&v=3`, the scalar corpus includes two persisted `scalar_values` column cases across each physical UTF-8/UTF-16LE/UTF-16BE fixture (six public executions). Fixtures carry TEXT, embedded-NUL TEXT, BLOB, and NULL values; expected typed rows are manifest data captured directly from those exact hashed physical fixtures with the pinned oracle. Current public executions honestly reject on absent functions and earn zero credit. Fixture hashes and this coverage are validator-required; the validator also executes every persisted case directly against each fixture with the supplied pinned library and compares typed rows. All 50 rows also have exact semantic routine ownership (or explicit compiler owner for inline registrations), propagated into their slice and covering-case provenance and validated.

The corrected persisted-column gate requires the manifest-pinned native library: `python3 test/conformance/ordinary-scalars-manifest.test.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"`. Capture opens the exact hashed fixtures, and validation independently opens them read-only and compares all typed rows. This supersedes the invalid synthetic UTF-16 `CAST(X'410042' AS TEXT)` setup without changing counts or TS credit.

The final coherence rerun used the exact existing library at `/work/jsqlite2/.saivage/work/cards/card-p-a-a/oracle-build/build/libsqlite3-oracle.so`: `python3 test/conformance/ordinary-scalars-manifest.test.py --library /work/jsqlite2/.saivage/work/cards/card-p-a-a/oracle-build/build/libsqlite3-oracle.so`. It reported 50 rows, 37 cases/59 observations, and 12 implemented/38 absent after verifying source ID and executing both persisted cases against every hashed physical fixture. The former argument-less transcript was invalid and is superseded.

### Ordinary scalar implementation evidence ([[card:card-p-b-a-b]])

The immutable denominator remains 50 rows and 37 cases/59 native observations.
At this tranche checkpoint registry accounting was 47 dispatched and three
explicitly unsupported sibling rows (`printf`, `format`, `round`); the integrated
formatting evidence below supersedes it. The public pattern gate adds five
immutable LIKE/GLOB observations and 24 original boundary observations across the three
physical encodings, including BLOB conversion, ESCAPE and saved-error cleanup,
sets/ranges, NULL/NUL, pattern length, work, cancellation, and deadline. The
source-discriminator extension adds 90 cross-encoding assertions for `%`/`_`,
ASCII-only folding, `*`/`?`, class/range/inversion/literal and malformed classes,
Unicode, BLOB and embedded-NUL conversion, ESCAPE wildcards/NUL/NULL, exact arity
and step-error shapes, and adversarial work. Twelve represented column, parameter,
join, subquery and aggregate compositions and nine failure-reset-reuse lifecycles
run through Public Fetch; the separate focused window case covers a LIKE predicate
moved through window rewriting.
`run-ordinary-scalars-owned-ts.mjs` gives this tranche 26-case/44-observation public
Fetch evidence across physical UTF-8/UTF-16LE/UTF-16BE fixtures. It includes owned
projections of parameter/composition/variadic mixed rows and persisted columns;
it never executes or credits sibling rows. Expected failures compare prepare/step
phase, SQLite kind, result/primary/extended codes, and exact message.

The ordinary-scalar public runner also exercises bounded output/work companions without changing the immutable 26-case/44-observation credit count: pre-allocation failures for Unicode quoting/decoding, concatenation, character construction, hex decoding and random/zero BLOBs; adversarial `instr` work; abort/deadline interruption; first saved-error identity; reset/finalize cleanup; and connection reuse. These project-control companions grant no native or formatting-slice credit.

### Ordinary scalar integrated evidence ([[card:card-p-b-c]])

Current registry accounting is 50/50 dispatchable after the source-shaped
`printf`/`format`/`round` translation. The formatting public gate covers aliasing,
registered arities and exact wrong-arity diagnostics, NULL/missing arguments,
parameters, composition, flags, width/precision, integer/REAL boundaries, SQL
escaping, embedded-NUL termination, output limits, saved-error precedence and
cleanup. The immutable denominator remains 50 rows and 37 cases/59 native
observations; formatting and pattern companions do not inflate it. Date/time,
math, JSON, aggregate, and window registries remain separate scopes.

### Formatting non-emitting width discriminator ([[card:card-p-b-b]])

The focused formatter native/public gates distinguish pinned SQL `%n`/`etSIZE`
from emitting conversions: literal/dynamic width is ignored for output, dynamic
width alone consumes an argument, and surrounding literals/neighboring `%d`
retain argument order under a five-byte result ceiling. Emitting hostile width
continues to fail with the typed result limit and statement lifecycle coverage.

### Ordinary math tests-first corpus (SQLite 3.53.4)

`test/conformance/cases/stage3-math.spec.json` is the immutable, profile-specific
contract for the `SQLITE_ENABLE_MATH_FUNCTIONS` block in `src/func.c`. It inventories
30 active `FuncDef` rows (29 names; `log` has arities 1 and 2), including the four
`SQLITE_HAVE_C99_MATH_FUNCS` rows, exact macro-derived flags, user-data, callback
families, aliases, and wrapper branches. Twenty selected/source-derived cases yield
60 exact native observations across UTF-8, UTF-16le, and UTF-16be. REAL observations
carry IEEE-754 hex plus C hex-float text, so signed zero and nonfinite values never
pass through JSON numbers. Cases cover parameters, persisted REAL/TEXT/BLOB/NULL
columns, composition, coercion, domains/poles, NaN-to-NULL, infinity, precision,
and result storage class. `capture-math.py` pins source/profile and
`math-manifest.test.py` rejects registry or capture drift. `run-math-cases-ts.mjs`
uses only the public API; absent functions are expected and earn **0/20** TS credit.
Finite transcendental payloads are observations of this host libm, not a claim that
all supported hosts return identical last bits.
