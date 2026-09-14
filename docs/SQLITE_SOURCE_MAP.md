# SQLite source map

This is the progressive engineering index for the selected upstream SQLite
implementation. It is a progressive index, not a corpus inventory. The historical
NONFUNCTIONAL Stage 1 contract is
[`api.md`](api.md); product scope remains in [`SPEC.md`](SPEC.md), sequencing in
[`PLAN.md`](PLAN.md), and translation rules plus the historical Stage 1 evidence
questions in [`TRANSLATION.md`](TRANSLATION.md). Stage 2 delivered the bounded
oracle/fixture harness. Stage 3 currently includes acquisition/storage,
generated tokenization/parsing and immutable internal schema discovery, plus the
shared internal Mem/value, scalar arithmetic, built-in collation/comparison, and
packed/unpacked record-key foundations; resolver, compiler, VDBE execution, and
broad conformance remain incomplete.

## Pinned source and usable development cache

`reference/sqlite/manifest.json` is authoritative. It selects the official full
source archive `sqlite-src-3530400.zip` for SQLite **3.53.4** and check-in
`bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`
(source ID timestamp `2026-07-24 19:02:57`). The archive is retained unchanged at
`reference/sqlite/sqlite-src-3530400.zip`. The extracted full source and tests are
usable at:

```text
reference/sqlite/sqlite-src-3530400/
```

Both paths are development reference material and are ignored by Git. They must
not enter runtime exports, browser bundles, or published package artifacts. The
current `package.json` is a private (`"private": true`) Stage 3
storage/parser/schema and internal value/comparison foundation development
manifest, with a lockfile and `tsconfig.json`; it does not define a
publish/build pipeline or by itself prove package contents. The present repository
boundary is enforced by `.gitignore`: it excludes the SQLite archive and extracted
reference tree as well as `node_modules`, build/dist, cache, coverage, test-result,
and TypeScript build-info outputs. Any future publishable package configuration
must add and validate an explicit artifact allowlist/exclusion policy; current
private tooling is not a packaging compatibility claim.

### Reproducible verification and extraction

Run from the repository root. Verification uses Python's standard library so both
manifest hashes (SHA-256 and SHA3-256), ZIP CRCs, and archive paths are checked:

```sh
python3 - <<'PY'
import hashlib, json, pathlib, zipfile
base = pathlib.Path("reference/sqlite")
m = json.loads((base / "manifest.json").read_text())
zpath = base / m["archive"]
data = zpath.read_bytes()
with zipfile.ZipFile(zpath) as z:
    names = z.namelist()
    bad_crc = z.testzip()
    unsafe = [n for n in names
              if pathlib.PurePosixPath(n).is_absolute()
              or ".." in pathlib.PurePosixPath(n).parts]
    roots = sorted({pathlib.PurePosixPath(n).parts[0] for n in names if n})
print(f"archive={zpath}")
print(f"bytes expected={m['bytes']} observed={len(data)} match={len(data)==m['bytes']}")
for key, ctor in (("sha256", hashlib.sha256), ("sha3_256", hashlib.sha3_256)):
    got = ctor(data).hexdigest()
    print(f"{key} expected={m[key]} observed={got} match={got==m[key]}")
print(f"zip_test={bad_crc!r} members={len(names)} roots={roots} unsafe_paths={len(unsafe)}")
assert len(data) == m["bytes"] and bad_crc is None and not unsafe
assert hashlib.sha256(data).hexdigest() == m["sha256"]
assert hashlib.sha3_256(data).hexdigest() == m["sha3_256"]
assert roots == ["sqlite-src-3530400"]
PY
```

Observed for the retained archive:

```text
archive=reference/sqlite/sqlite-src-3530400.zip
bytes expected=14557315 observed=14557315 match=True
sha256 expected=d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b observed=d18fa15aec74d8c17e1463f861095adc01b5ad190256acb4f91d22f0368d232b match=True
sha3_256 expected=b834d474b9b393d85a9e3ee4cc11f1329e007e9376a424ee740796f5c4bda3a8 observed=b834d474b9b393d85a9e3ee4cc11f1329e007e9376a424ee740796f5c4bda3a8 match=True
zip_test=None members=2264 roots=['sqlite-src-3530400'] unsafe_paths=0
```

For a missing cache, extract only after the verification above. This refuses to
merge with or overwrite an existing cache:

```sh
python3 - <<'PY'
import json, pathlib, zipfile
base = pathlib.Path("reference/sqlite")
m = json.loads((base / "manifest.json").read_text())
target = base / "sqlite-src-3530400"
assert not target.exists(), f"refusing to overwrite {target}"
with zipfile.ZipFile(base / m["archive"]) as z:
    z.extractall(base)
PY
```

Confirm the extracted identity against the manifest rather than trusting the
directory name:

```sh
python3 - <<'PY'
import json, pathlib
base = pathlib.Path("reference/sqlite")
m = json.loads((base / "manifest.json").read_text())
r = base / "sqlite-src-3530400"
version = (r / "VERSION").read_text().strip()
uuid = (r / "manifest.uuid").read_text().strip()
print(f"VERSION={version} expected={m['version']} match={version==m['version']}")
print(f"manifest.uuid={uuid} expected={m['fossilCheckin']} match={uuid==m['fossilCheckin']}")
print(f"source_id={m['sqliteSourceId']}")
print(f"source_id_expected={m['fossilTimestampUtc'][:19].replace('T', ' ')} {uuid} match={m['sqliteSourceId']==m['fossilTimestampUtc'][:19].replace('T', ' ')+' '+uuid}")
print(f"files={sum(p.is_file() for p in r.rglob('*'))}")
assert version == m["version"] and uuid == m["fossilCheckin"]
assert m["sqliteSourceId"] == m["fossilTimestampUtc"][:19].replace("T", " ") + " " + uuid
PY
```

Observed: `VERSION=3.53.4` and `manifest.uuid` equals the pinned check-in (both
matches true), with 2,208 extracted files (about 112 MiB). Extraction did not
change archive size or either hash. The manifest already records the initialization
latest-stable check; no contradictory evidence required another network check.

## Stage 3 comparison/collation/record-key mapping

The tests-first slice is pinned to the same 3.53.4 extraction. Its exact bounded
manifest is `test/conformance/cases/stage3-comparison-key.json`; the manifest
validator is executable, while every runtime vector remains temporary and zero
credit until a Mem-consuming implementation exists.

| Concern | Exact implementation/callers | Initial test mapping |
|---|---|---|
| Storage-class and numeric comparison | `src/vdbeaux.c:sqlite3MemCompare`, `sqlite3IntFloatCompare`; `src/vdbe.c` comparison opcodes | `test/affinity2.test:affinity2-300`; `test/types3.test:types3-3.3`; internal int64/REAL boundary |
| Built-in BINARY/NOCASE/RTRIM | `src/main.c:binCollFunc`, `nocaseCollatingFunc`, `rtrimCollFunc`; encoding conversion in `src/utf.c:sqlite3VdbeMemTranslate` | `test/collate1.test:collate1-1.1`; `test/collate2.test:collate2-1.2`; `test/collateA.test:collateA-1.13`; internal embedded-NUL/non-ASCII/space vectors |
| Key descriptor and unpacked state | `src/sqliteInt.h:KeyInfo`, `UnpackedRecord` | internal key-field/total-field, sort flags, `default_rc`, `eqSeen`, borrow/release vectors |
| Packed record unpack/compare | `src/vdbeaux.c:sqlite3VdbeRecordUnpack`, `sqlite3VdbeRecordCompare`, `sqlite3VdbeRecordCompareWithSkip`, serial helpers | `test/index.test:index-4.4`; internal serial/unpack, prefix/default result, malformed and configured-limit vectors |
| Consumers | `src/vdbe.c:OP_Compare`, index seek/found/no-conflict opcodes; `src/btree.c` and `src/vdbesort.c` KeyInfo/record callers | mapped future index/sorter backlog; no current public SQL credit |

The implementation is `src/internal/comparison.ts`, consuming the existing
`Mem` through `compareMem`, `compareBuiltinText`, `unpackRecordKey`, and
`compareRecordKey`. `KeyInfo` terms carry built-in collation plus semantic
DESC/NULL-order flags; total record fields and compared key fields remain
distinct. `UnpackedRecordKey` carries current-pin construction state (`record`
or `seek`), `defaultRc`, mutable `eqSeen`, and releaseable borrow generations;
legacy prefix-mode labels are absent in 3.53.4. Complete generic unpack may inspect
a zero/short record, but ordinary comparison rejects fewer than `keyFieldCount`
values, while seek construction alone admits a nonempty short prefix and rejects
zero or excess key fields. Comparison reads numeric and byte
caches without mutating inputs; encoding conversion, when a built-in callback
requires it, occurs on an owned temporary Mem copy. Packed decoding maps structural
failures to `ComparisonError("corrupt")` and configured field/byte/work ceilings to
`"limit"`. `compareRecordKey` uses `record.ts`'s incremental `RawRecordReader` and
creates one temporary borrowed Mem at a time, matching
`sqlite3VdbeRecordCompareWithSkip`: it stops at the declared compared-field count
or a decisive term without validating an unrelated packed-key tail; if equal
comparison still requires another RHS field, packed-header exhaustion is corrupt
(and does not set `eqSeen`), whereas intentional short seek RHS exhaustion reaches
RHS `defaultRc`. This direct native differential applies to a missing next serial
type. For a declared next serial type with truncated payload, TypeScript retains a
deliberately stricter untrusted-input corruption guard; the pinned internal
comparator assumes readable padded/valid b-tree key buffers and the direct probe
returns `-1` with `errCode=0`, so that case is labeled a local safety companion and
source-assumption observation, not native parity. Full `unpackRecordKey` still validates the complete record. Host collation registration is excluded by product scope. JS string
ordering, locale APIs, and Unicode folding are not source-equivalent implementations.

The internal API now exposes a validated immutable `KeyInfo` class: construction
defensively snapshots/freezes nested terms and collation specs, unpacked keys
retain the exact descriptor identity, and comparison rejects identity mismatch.
This enforces the source `UnpackedRecord.pKeyInfo` relationship across later
consumer handoffs rather than relying on TypeScript `readonly` declarations.

The 8 internal vectors and 5 local safety companions are executable in
`test/value/comparison.test.mjs`. The 6 mapped SQL assertions remain temporary and
zero credit because no compiler/VDBE/index consumer reaches this internal layer.

## Public contract orientation

All paths below are relative to the extracted root and all line numbers are only
orientation for this exact pin.

### Declarations: `src/sqlite.h.in`

The source comments are part of the behavior to preserve, not just prototypes.
The prepare contract is around lines 4490–4595; statement execution and lifecycle
contracts are around 5230–5715; result-column contracts are around 5360–5555; bind
contracts are around 4870–5010.

* `sqlite3_prepare_v2`/`v3`: `nByte` is a **byte** limit, not a character count;
  `pzTail` points to the byte after the first compiled statement. Empty/comment-only
  input succeeds with no statement. Errors leave the statement output null. v2
  retains SQL for reprepare and is v3 with no public flags.
* `sqlite3_step`: `SQLITE_ROW` exposes one current row and `SQLITE_DONE` finishes
  execution; v2-style statements can automatically reprepare after schema change.
* `sqlite3_reset` rewinds but retains bindings and may itself return the prior
  execution error. `sqlite3_finalize` destroys the statement even when returning
  that error. A caller must not discard either result.
* Result columns use zero-based indexes and are valid only during the current row.
  Accessors can convert/cache representations. `sqlite3_column_type` is specified
  as the initial storage class only before such conversion.
* SQL storage classes are signed 64-bit INTEGER, IEEE REAL, TEXT, BLOB, and NULL.
  Public C pointer/destructor conventions describe lifetime but do not dictate a
  TypeScript signature.

### Connection lifecycle: `src/main.c`

* `openDatabase` (line 3360) initializes global state and output, validates/masks
  flags, chooses mutex/cache mode, allocates the connection, and establishes its
  state/error fields before opening backends. Translation should map the applicable
  initialization/control flow after the acquisition boundary is chosen; C mutex,
  lookaside, VFS pointer, and callback mechanics are not automatically public API.
* `connectionIsBusy` and `sqlite3Close` (line 1266) show that outstanding statements
  and backups matter. Null close is `SQLITE_OK`. Legacy `sqlite3_close` (line 1363)
  returns `SQLITE_BUSY` and leaves a busy connection open; `sqlite3_close_v2`
  (line 1364) marks it zombie and defers deletion until dependents finish.
  Virtual-table disconnection/rollback happens before the busy decision.
* `sqlite3LeaveMutexAndCloseZombie` completes deferred cleanup after the final
  dependent disappears. A future TS API must choose and document which close model
  it exposes rather than silently cascade-destroying statements.

### Prepare and tail: `src/prepare.c`

* `sqlite3LockAndPrepare` (line 836) first nulls the output, checks arguments,
  enters connection/B-tree locks, retries bounded `SQLITE_ERROR_RETRY`, and allows
  one schema reset/retry on `SQLITE_SCHEMA`. Failure does not leak a statement.
* `sqlite3_prepare_v2` (line 937) requests `SQLITE_PREPARE_SAVESQL`;
  `sqlite3_prepare_v3` (line 955) adds masked public prepare flags.
* `sqlite3Reprepare` (line 886) recompiles retained SQL, swaps the replacement VM
  into the original handle, transfers bindings, resets the temporary VM's step
  result, and finalizes it.

A JS string index is not an upstream tail byte offset: supplementary characters
and non-ASCII text make UTF-8 bytes differ from UTF-16 code units. Stage 1 must
explicitly select a byte offset, remaining SQL, or another lossless representation,
and must represent successful preparation with no statement.

### Statement lifecycle and cleanup: `src/vdbeapi.c`, `src/vdbeaux.c`

* `sqlite3_finalize` (`vdbeapi.c:105`) accepts null; otherwise it resets, deletes,
  normalizes the API result, and triggers zombie-connection cleanup.
* `sqlite3_reset` (`vdbeapi.c:134`) calls `sqlite3VdbeReset` and rewinds while
  preserving bindings. `sqlite3_clear_bindings` (`vdbeapi.c:155`) releases each
  value, replaces it with NULL, and expires binding-sensitive plans if required.
* Internal step changes READY to RUN, tracks active/read/write execution, usually
  auto-resets HALT for reuse, exposes the result row only for `SQLITE_ROW`, and
  clears it otherwise. Public `sqlite3_step` (`vdbeapi.c:919`) retries schema
  failures via `sqlite3Reprepare`, bounded by `SQLITE_MAX_SCHEMA_RETRY`.
* `sqlite3VdbeReset` (`vdbeaux.c:3586`) halts a running VM, transfers VM errors to
  the connection, clears result/error state, and returns the masked prior result.
  `sqlite3VdbeFinalize` (`vdbeaux.c:3677`) resets when needed and then deletes.

GC is not a substitute for these state changes: row invalidation, retained versus
cleared bindings, error transfer, and zombie-close completion are observable.

### Binding, values, columns, and metadata: `src/vdbeapi.c`

Focused anchors are `sqlite3_column_count` (1272), `sqlite3_data_count` (1282),
`sqlite3_column_type` (1443), name/decltype (1556/1579), database/table/origin
metadata (1595/1609/1623), bind implementations (1755–1915), and parameter
count/name/index (1937/1948/1963).

* Bind indexes are one-based; result columns are zero-based. Unbound parameters
  are NULL. Reset retains values while clear-bindings nulls them.
* Bound INTEGER requires signed 64-bit fidelity; REAL remains REAL even when
  integral-valued. The related internal `sqlite3VdbeMemSetDouble` rule maps NaN to
  NULL but keeps infinities REAL (see `src/vdbemem.c`).
* Text/blob length and NUL rules depend on the binding call. Public copied values
  are the current proposed TS default, but C destructor callbacks and pointer
  ownership should become explicit JS ownership semantics, not literal emulation.
* `sqlite3_column_count(NULL)` is 0; data count is 0 without a current row. Invalid
  column access uses a static NULL-equivalent internally and records `SQLITE_RANGE`.
  Typed access can convert. Metadata distinguishes display name and declared type;
  database/table/origin are null for expressions/constants.

Stage 1 settles nullable access, value/error representation, stable initial-type
observation, and cleanup/ownership behavior in [`api.md`](api.md). In particular,
NULL is distinct from empty TEXT/BLOB, and immutable initial type is a documented
adaptation rather than a claim about native post-conversion behavior. These are
contract choices only; their runtime and upstream assertion evidence remains
Stage 2/later work.

## Focused upstream test candidates

These are identifiable source-backed candidates for Stage 2 translation, not a
claim that the corpus was inventoried or that a test tranche is approved.

* **Close/lifecycle — `test/close.test`:** `close-1.1`, `1.2.1–1.2.2`,
  `1.3.1–1.3.3`, `1.4.1–1.4.4`, and `1.5` cover close-v2 with unstepped/stepped
  statements and blobs, retained row access, post-zombie stepping, rejected new
  preparation, and eventual finalize/close. **`test/capi3.test`** `capi3-6.1–6.3`
  covers legacy busy close, continued statement usability, then finalize.
* **Prepare/tail — `test/capi3.test`:** `capi3-1.1`, `1.4–1.6`, and
  `1.7–1.9` cover the legacy UTF-8 prepare cases: empty input, a second-statement
  tail, exact and length-plus-one byte limits, and invalid SQL/error text.
  `capi3-2.1–2.5` are the UTF-16 prepare counterparts. **`test/capi3c.test`** is
  adapted to the v2 API: `capi3c-1.*` covers UTF-8 `sqlite3_prepare_v2`, while
  `capi3c-2.*` covers UTF-16 `sqlite3_prepare16_v2`. Before translating, pin exact
  assertions within those families because Tcl helper-generated names vary.
* **Binding — `test/bind.test`:** `bind-1.1–1.9` covers tail/parameter discovery,
  initially NULL parameters, reset retention, and selective rebinding;
  `bind-2.1.1–2.1.8` covers parameter names/indexes; `bind-2.2–2.4` and `3.1–3.2`
  cover 32/64-bit INTEGER; `bind-4.1–4.5` covers REAL, integral-valued REAL,
  NaN-to-NULL, and large/small finite values; `5.1–5.2` covers NULL; `6.1–6.5`
  covers explicit lengths, embedded NUL, and UTF-8/UTF-16 database differences.
* **Values/metadata — `test/capi3.test`:** `capi3-5.0`, `5.1`, `5.3`, `5.6`,
  `5.9` cover count/names/decltypes/origins; `5.4`, `5.7`, `5.10` cover initial
  classes and conversions; `5.11–5.12` cover DONE/finalize; `5.20–5.23` distinguish
  direct-column metadata from aggregate/expression metadata; `5.30–5.35` cover
  aliases, origins, parameters, and missing declared types. Nearby helpers exercise
  UTF-8/UTF-16 byte counts, repeated conversions, and out-of-range accesses.
  `test/capi3c.test` contains the v2-oriented counterpart. UTF-16 and origin
  metadata assertions are build-feature gated upstream.

## Stage 1 public contract decisions

[`api.md`](api.md) is now the singular public contract; `src/index.ts` is
explicitly nonfunctional type scaffolding. The contract selects full-file bounded
Fetch acquisition, synchronous prepare/local accessors, asynchronously chunked
step, copied public blobs, UTF-8 byte tail offsets plus exact suffixes, stable
initial column types, legacy busy close plus explicit deferred zombie close, and
distinct SQLite/transport/control/misuse/unsupported/internal errors. Finite
numeric resource defaults remain deferred until an implementation can measure and
test them; this is not runtime support.

The Stage 1 test expectations retain the focused upstream candidates already
listed: `test/close.test` for busy/zombie lifecycle; `test/capi3.test` and
`test/capi3c.test` for prepare/tail, row and metadata behavior; and `test/bind.test`
for parameter, reset-retention, numeric, NaN, and encoding assertions.

## Current B-tree seek fidelity gap (audit finding 3)

At HEAD `303a8746b35df03f233c78a46fa668507bdb794d`,
`src/internal/btree.ts` maps page/cell/payload layout and supplies a genuine lazy
forward `tableScanCursor`, but `tableCursor`/`indexCursor` do **not** yet map pinned
`src/btree.c:sqlite3BtreeTableMoveto` (5805-6034) or
`sqlite3BtreeIndexMoveto` (6036-6183). They recursively materialize every table or
index descriptor through `readTable`/`readIndex`, then binary-search the array.
This was reproduced as a fidelity gap and is corrected in the current working
tree. Table/index seek now descends one selected child per interior page and keeps
only the positioned descriptor; complete bidirectional movement triggers deferred
full traversal only when requested. The focused mutation of page 141 now proves
both table and index minimum seeks ignore an unrelated malformed rightmost
subtree, while a malformed selected child still reports corruption. Existing
seek tests retain exact/inexact GE/LE placement, and depth-limit coverage is
charged when seek descends rather than during cursor construction.

The independently loaded pinned SQLite 3.53.4 library with the manifest source ID
returned the minimum rowid from the same mutated image. Native evidence:
`work:///cards/card-d-e/processes/proc-01847f777fb9/stdout.log`; repaired focused
and broader evidence: `work:///cards/card-d-e/processes/proc-c22fb69a467e/stdout.log`.
The repair preserves `tableScanCursor`, record and overflow behavior, shared
owner/close invalidation, and movement-invalidated borrows.

## Bounded discrepancies and gaps

No executing SQL engine exists yet. The Stage 1 API decisions are contract
completion, not a compatibility claim. Fetch, format/storage reading, UTF-8 SQL
tokenization, generated Lemon parsing/reductions, exact tails and bounded internal
schema discovery now exist. Later slices must implement resolution, compilation,
planner/VDBE execution, public statement handles and conversions, automatic
reprepare, and broader conformance. Numeric execution limits need implementation
evidence before publication.
Temporary gaps must throw `unsupported`; permanent exclusions remain only those in
SPEC.

## Internal Mem/value slice ([[card:card-f-a-a]])

The stable consumer surface and invariants are specified in
[TRANSLATION.md, “Mem consumer surface”](TRANSLATION.md#mem-consumer-surface-decision-for-the-valuesvdbe-slices).
It is based on the pinned `src/vdbeInt.h:sqlite3_value` and `MEM_*` definitions;
`src/vdbemem.c:sqlite3VdbeMemStringify`, `sqlite3VdbeMemNumerify`,
`sqlite3VdbeMemCast`, `sqlite3VdbeMemSetDouble`, `sqlite3VdbeMemSetStr`,
`sqlite3VdbeMemShallowCopy`, `sqlite3VdbeMemCopy`, `sqlite3VdbeMemMove`, and
release/grow/encoding paths; `src/util.c:sqlite3AtoF`, `sqlite3Atoi64`, and
`sqlite3DecOrHexToI64`; and exact `src/vdbe.c` consumers `OP_Copy`, `OP_SCopy`,
`OP_IntCopy`, `OP_Cast`, `OP_RealAffinity`, comparison affinity, `OP_Column`,
`OP_Function`, `OP_AggStep`, and `OP_ResultRow`. `src/vdbeapi.c` supplies bind and
column boundary callers. The TS deviation is explicit ownership/generation tokens
instead of C allocation/destructor pointers and an opaque semantic state instead
of exposing numeric C flags.

`src/internal/record.ts:RawRecordValue` is the sole record adapter input and
`src/index.ts:SqliteValue` is the sole public adapter output/input; neither replaces
Mem. `src/internal/utf.ts` is reusable only for the source-equivalent decoding it
actually implements. Mem numeric parsing/string rendering and re-encoding now have an internal bounded port in
`src/internal/mem.ts` ([[card:card-f-a-c]]): byte-counted UTF-8/UTF-16 scanning follows
`util.c:sqlite3Atoi64`/`sqlite3AtoF`; `applyAffinity` follows `vdbe.c:applyNumericAffinity`
and `applyAffinity`; and all five delegated CAST affinities follow
`vdbemem.c:sqlite3VdbeMemCast`, including int64 saturation, integer/REAL
classification, numeric prefixes, signed zero (both IEEE zero payloads render
canonically as `0.0` while a non-forced REAL cache retains the negative-zero sign), infinities, and embedded-NUL caller
semantics. `vdbemem.c` flag masks are represented explicitly: non-forced
stringify and encoding changes retain numeric+canonical-TEXT caches; forced
TEXT/BLOB casts clear numeric forms; NUMERIC/INTEGER/REAL casts and successful
numeric affinity clear bytes while preserving non-type subtype/from-bind metadata
per `MemSetTypeFlag`; creation of a new string cache follows
`sqlite3VdbeMemClearAndResize` and clears that non-type metadata. TypeScript uses `bigint` for the decimal accumulator and `number` only at
the IEEE-754 result boundary. `test/value/mem-numeric.test.mjs` maps the direct Mem
surface; SQL-level entries remain zero credit until compiler/VDBE/public statements
exist. Public binding and returned BLOB policy
remains copy-in/copy-out. Bound public JS TEXT has a now-explicit adaptation:
well-formed UTF-16 only (lone surrogates are `misuse`), strict scalar-to-UTF-8
encoding, then the `vdbeapi.c:bindText` path translates immediately to the
connection encoding. Embedded NUL is retained under an explicit length;
supplementary scalars and logical bytes are verified for UTF-8/UTF-16le/UTF-16be.
Source and translated byte lengths are each limit-checked without counting a
terminator. This is distinct from SQL-tail mapping and forbids silent WHATWG
replacement.

The child-ready test specification is `test/conformance/cases/stage3-mem.json`
(schema `jsqlite-mem-cases/2`). Its executable read-only tranche uses literal
`cast-1.13`, `cast-1.14`, `cast-1.23`, `cast-1.33`, `cast-1.39`, `cast-1.45`, and
`cast-1.46`, each with setup, operation, typed expected result, prerequisites, and
`unimplemented-temporary` disposition. The write-dependent upstream `bind-3.1`,
`bind-3.2`, `bind-6.1`, and four encoding-branch occurrences of `bind-6.5` are kept
separately as **native-only provenance** with explicit native fixture/oracle setup
ownership and no TS bind credit. Their TS int64 adaptation binds the same three
values to the read-only statement `SELECT ?1, ?2, ?3, typeof(?1), typeof(?2),
typeof(?3)`; any natively populated immutable table later read by TS is record/
column evidence, not bind evidence. Four no-credit JS adaptations specify that
int64 SELECT, NUL/supplementary binding across all encodings, and rejection of lone
high/low surrogates.

`test/conformance/mem-manifest.test.py` pins the source ID, rejects range/wildcard/
generated placeholders, checks literal Tcl case occurrence counts (so duplicate/
gapped names cannot be hidden), enforces zero-credit classifications, and rejects
mutating SQL or mutation-dependent setup from every executable TS operation.
Broader cast/affinity/type/bind/column/function families remain only in a separately
marked non-executable future backlog.

The selected upstream cases intentionally form a small first slice rather than
claim corpus coverage. In particular pinned `cast.test` duplicates `cast-1.38` and
has gaps, so no contiguous range is asserted. `bind-6.1` and `bind-6.5` retain only
their native explicit-length/encoding provenance; public JS companions separately
test whole-string binding because public `bind()` has no C byte-length argument.
Native fixture-generation writes are permitted evidence setup, but the browser TS
runtime never prepares or executes their INSERT/DELETE statements.

The oracle protocol transports decimal int64, exact REAL bits, byte-counted
text/blob and initial/typed column observations. Internal cache/IntReal, subtype,
copy/move, generation invalidation, and aggregate-cleanup behavior is now tested
directly through the implemented `src/internal/mem.ts`; ordinary public SQL cases
must continue through the existing public adapter. These internal tests do not
claim public SQL execution credit.

C-only mutexes, allocators, destructor callbacks, raw pointers, writable-main-file
paths, and host extension surfaces are adaptation/omission candidates only after
checking their applicable read-only call paths. Required mutable private execution
state (sorters, ephemeral b-trees, registers, aggregates) is not excluded merely
because the main database input is immutable.

## Stage 3 tokenizer/parser implementation status ([[card:card-e-b]])

The checked-in `src/generated/parser-tables.ts` and `keyword-table.ts` are deterministically emitted by `tools/parser/generate.mjs` from pinned `src/parse.y` and `tool/mkkeywordhash.c`, with provenance hashes for those inputs, `lemon.c`, `lempar.c`, and `tools/parser-profile.json`. The development generator compiles pinned `lemon.c` in card-scoped disposable storage and emits the actual 600-state/412-rule Lemon action, lookahead, shift/reduce offset, default, token-ID and rule metadata tables; `src/internal/lemon-runtime.ts` is the browser-safe no-eval shift/reduce table consumer. The runtime does not use eval/Function or native code. `src/internal/tokenize.ts` follows `src/tokenize.c:sqlite3GetToken` byte spans for the covered lexical classes. `src/internal/parse.ts` consumes generated production metadata and builds ordered SELECT expression/source/predicate structures and CREATE TABLE/INDEX/VIEW/TRIGGER schema nodes.

Evidence: exact `test/tokenize.test` IDs 1.1–1.12 and 2.1–2.2 are in `test/parser/tokenizer-parser.test.mjs`, alongside UTF-8 tails and lexical companions; deterministic generation is checked by `test/parser/generator.test.mjs`. Configured parser work and stack depth are enforced in the Lemon loop, and expression depth is measured from actual `expr ::= ...` reduction ancestry (including unparenthesized unary/binary trees), rather than approximated by parenthesis count. The Lemon runtime invokes a production-keyed semantic-action callback at reduction time; the bounded `cmd ::= select` and stored CREATE TABLE/INDEX/VIEW/TRIGGER productions attach immutable authored structures to their actual reduction values. This is a progressive parser foundation: semantic actions exist only for the bounded SELECT/schema structure layer. End-to-end Lemon token adaptation (including fallback/window keyword decisions), detailed DDL fields, compounds/CTEs/windows, and full syntax diagnostics remain explicit backlog. Parsed but uncompiled forms produce temporary unsupported at the public compiler boundary rather than syntax errors; there is deliberately no separate literal-SELECT evaluator, so accepted syntax cannot acquire execution semantics outside the future translated compiler/VDBE.

## Immutable schema initialization tranche

`src/internal/schema.ts` now translates the root-page-1 bootstrap path in
`src/prepare.c:sqlite3InitOne/sqlite3InitCallback` for ordinary tables,
indexes, and views. It consumes the connection's existing `ImmutableStorage`
through `BtreeDatabase`, decodes the five `sqlite_schema` fields with
`record.ts`, converts text with the source-derived `utf.c` subset in `utf.ts`,
and consumes generated-Lemon reduction structures for stored DDL before publishing
a close-invalidated, recursively runtime-frozen ordered graph. The row rootpage remains authoritative. `src/build.c` and `src/sqliteInt.h`
`Table`/`Column`/`Index` inform ordered columns, affinity, default/generated
expression links, index terms, view Selects, WITHOUT ROWID state and identity
links. Catalog names are keyed and linked by the shared ASCII-only helper in
`src/internal/sqlite-case.ts`, derived from `src/util.c:sqlite3StrICmp` and
`src/global.c:sqlite3UpperToLower`; non-ASCII UTF-8 bytes do not case-fold. Focused fixture/oracle coverage is in
`test/schema/catalog-init.test.mjs` across UTF-8, UTF-16le and UTF-16be and in
`test/schema/sqlite-utf.test.mjs` for malformed/legacy conversion behavior.

Current bounded construction supports ordinary column declarations; ordered default-expression indexes; not-null, unique, collation and primary-key column metadata; generated expressions with stored/virtual state; explicit-index uniqueness/origin and per-term collation/sort/null-order metadata; views; and WITHOUT ROWID declared-primary-key storage mapping. Automatic indexes (including their origin), triggers, virtual tables, fuller named/CHECK/foreign-key constraint graphs, and further recognized grammar consumers
report explicit temporary unsupported errors; malformed row shape/type/text/root/link/DDL reports schema
corruption. They are backlog, not permanent exclusions, and are never silently
skipped. The loader does not execute user DDL and does not reopen or copy the
connection storage owner.

## Stage 3 internal Mem core (implemented)

`src/internal/mem.ts` maps SQLite 3.53.4 `src/vdbeInt.h:228-346` and
`src/vdbemem.c` `sqlite3VdbeMemSetNull`, `SetInt64`, `SetDouble`, `SetStr`,
`SetZeroBlob`, `ShallowCopy`, `Copy`, `Move`, `MakeWriteable`, and `Release`.
`memFromRawRecord` consumes `src/internal/record.ts` decoder output; public adapters
consume the one `SqliteValue` union from `src/index.ts`. Focused tests are
`test/value/mem-core.test.mjs`. Explicit borrow generations and strict lone-
surrogate rejection are labeled TypeScript safety/API adaptations; public BLOBs
are copied. This mapping covers internal value representation and lifetime; the
following bounded mapping covers affinity/casts, but neither implies VDBE program
execution or public SQL support.

Numeric conversion and rendering in the same module map `src/util.c:sqlite3AtoF`
and `sqlite3Atoi64` plus `src/vdbemem.c:vdbeMemRenderNum` and its default
17-significant-digit `printf.c`/`sqlite3FpDecode` path, including the private
`sqlite3Fp2Convert10`/`powerOfTen` integer conversion rather than host decimal
formatting; precision-sensitive normals, subnormals, exponent boundaries,
round-trip shortening, and deterministic binary64 differential cases have direct
regressions. The scanner retains SQLite's value-bounded unsigned mantissa (so
leading zeroes do not consume significant digits), and REAL text uses SQLite's
alternate-form generic exponent spelling. Focused regressions, including leading
zeroes and exponent sign/padding, are in `test/value/mem-numeric.test.mjs`. Both
IEEE zero payloads are mandatory deterministic native boundaries in
`test/conformance/cases/stage3-mem.json`, executed by
`test/conformance/mem-native-boundaries.py`; this is internal conversion evidence
and grants no public SQL/VDBE execution credit.

## Bounded VDBE arithmetic and truth slice ([[card:card-f-a-d]])

`src/internal/vdbe-primitives.ts` maps pinned `src/vdbe.c` `OP_Add`,
`OP_Subtract`, `OP_Multiply`, `OP_Divide`, `OP_Remainder`, `OP_BitAnd`, `OP_BitOr`,
`OP_ShiftLeft`, `OP_ShiftRight`, `OP_BitNot`, `OP_And`, `OP_Or`, `OP_Not`,
`OP_IsTrue`, `OP_If`, `OP_IfNot`, and the register NULL test used by
`OP_IsNull`/`OP_NotNull`. Numeric truth follows
`src/vdbemem.c:sqlite3VdbeBooleanValue`; overflow decisions follow
`src/util.c:sqlite3AddInt64`, `sqlite3SubInt64`, and `sqlite3MulInt64`. It consumes
the [[card:card-f-a-c]] `Mem` conversion surface and preserves source registers by
coercing private copies.

Exact mapped assertions are `test/e_expr.test:e_expr-2.3`, `e_expr-2.4`, and
`e_expr-6.1` through `e_expr-6.5`. Local no-credit boundaries cover all five
binary arithmetic operations, overflow promotion, division/remainder zero,
int64 bit/shift behavior, signed zero/NaN/infinity, NULL propagation, three-valued
AND/OR, IS TRUE/FALSE, and If/IfNot NULL policy. The machine-readable mapping is
`test/conformance/cases/stage3-vdbe-primitives.json`; direct execution is
`test/value/vdbe-primitives.test.mjs`. This does not map comparisons between two
non-NULL values, collations, compilation, or public SQL execution.

### Canonical cache and encoding correction

Following `record:///review.md?card=card-f-a&v=3`, `Mem.stringify` maps pinned
`src/vdbemem.c:471-495` (`sqlite3VdbeMemStringify`) including bForce flag clearing,
and `Mem.changeEncoding` maps `src/vdbemem.c:212-244` plus
`src/utf.c:242-360` (`sqlite3VdbeMemTranslate`). Direct setters are destructive;
non-forced stringify preserves numeric+canonical-TEXT; force/cast, reset and
replacement clear representations according to their callers. Focused executable
coverage is in `test/value/mem-core.test.mjs`, including copy/shallow/move/reset,
cache reuse, subtype clearing, three encodings, embedded NUL, legacy UTF-8 and odd
UTF-16. This is internal primitive evidence and has zero public SQL credit.

## First prepared SELECT compiler/VM mapping

The architecture and additive zero-credit admission inventory are in
`docs/TRANSLATION.md#first-prepared-select-vm-architecture-tests-first-proposal`
and `test/conformance/cases/stage3-first-select.json`.

| Concern | Pinned implementation | Initial evidence |
|---|---|---|
| Expansion/resolution | `src/resolve.c:lookupName`, `resolveExprStep`, `resolveSelectStep`; `src/select.c:selectExpander`; `src/sqliteInt.h:NameContext/Expr/Select/SrcList/Parse` | `test/select1.test:select1-1.4..1.8.1`, `select1-3.1..3.7` |
| SELECT/expression codegen | `src/select.c:sqlite3Select`, `selectInnerLoop`; `src/expr.c:sqlite3ExprCode*` and variable/VList paths | `test/e_expr.test:e_expr-2.1..2.4`, `e_expr-6.1..6.5`; `test/expr.test:expr-11.1..11.14` backlog |
| Full scan seam | `src/where.c:sqlite3WhereBegin`; `src/wherecode.c:sqlite3WhereCodeOneLoopStart` | single-table projection/filter only; DISTINCT/ORDER/index-count assertions deferred |
| Make-ready/program ownership | `src/prepare.c:sqlite3LockAndPrepare`; `src/vdbeaux.c:sqlite3VdbeMakeReady`; `src/vdbeInt.h:Vdbe` | prepare/tail and metadata cases already in the immutable Stage 2 38-case set |
| Step/rows/bindings/cleanup | `src/vdbe.c:sqlite3VdbeExec`; `src/vdbeapi.c:sqlite3_step`, bind/column APIs; `src/vdbeaux.c:sqlite3VdbeReset/Finalize`; `src/main.c:sqlite3Close` | existing `close.test`, `capi3c.test`, and `bind.test` Stage 2 sequences, retained unchanged |

The new manifest preserves literal IDs, source occurrence, exact SQL/setup and
typed native expectations. Every TS sequence declares its exact currently attempted
prepare and unattempted suffix. Native expectations and TS credit are separate;
validation cannot infer success from a count. Cases requiring host Tcl callbacks,
DISTINCT/ORDER BY, aggregates/functions, joins, writes during assertion, or search
counters remain visible breadth gaps.

### Specifically consulted neighboring suites and deferrals

* `test/select2.test:select2-1.2` was inspected but deferred: its assertion nests
  host Tcl-driven queries and requires DISTINCT and ORDER BY, both outside the
  first scan tranche. It is not silently adapted to a different assertion.
* `test/where.test:where-1.1.1`, `where-1.2.1` and neighboring early cases were
  inspected but deferred because expected output combines query rows with
  `queryplan`/`scan`/`sort` instrumentation and index-planning assertions. The
  admitted `select1-3.3` gives an exact simple full-scan filter without claiming
  planner/search-count compatibility.
* Expression evidence was inspected in both `test/e_expr.test` and
  `test/expr.test`. Exact scalar unary cases `e_expr-2.1..2.4` are admitted;
  remainder `e_expr-6.1..6.5` remains internal primitive evidence, and
  `expr-11.1..11.14` literal/`typeof()` boundaries are deferred until the compiler
  admits the required literal and function opcodes. `e_expr-8.1.*` comparison
  breadth remains mapped to the existing comparison foundation but is not grouped
  into this tranche without per-assertion admission.

### Implemented scalar/parameter and one-table VDBE seam ([[card:card-h-b]], [[card:card-h-c]])

`src/internal/vdbe.ts` maps the bounded no-FROM paths in pinned
`expr.c:sqlite3ExprCode*` (including `TK_VARIABLE` numbering), `vdbe.c`'s
`OP_Variable`/scalar/result-row loop, and `vdbeapi.c` parameter metadata, bind,
clear, step, column, reset and finalize behavior. Compilation emits immutable
instructions and positive register/parameter slots; runtime copies binding `Mem`
cells into registers and retains PC/register state. The one-table path resolves
direct columns, emits its forward full scan through a `sqlite3WhereBegin`/
`sqlite3WhereEnd`-shaped interface, applies resolved column affinity and built-in
collation for the admitted integer equality, and consumes the lazy forward
`TableScanCursor` in `src/internal/btree.ts`; open-read no longer recursively
materializes every table entry. Lazy VDBE execution has one public mapping boundary:
b-tree/record format errors map to `SQLITE_CORRUPT`, while only the typed configured
b-tree depth/overflow ceiling maps to `limit`; unrelated `RangeError` is not
misclassified. `src/index.ts` maps the applicable
`main.c:sqlite3Close` BUSY/zombie ownership path and owns serialized connection
admission; `src/internal/vdbe.ts` retains that owner through promise settlement,
including its explicit running/suspended yield states. `OP_Column` payload work
maps `btree.c` local/overflow payload assembly into one-page incremental chunks:
each local/overflow chunk and the subsequent record decode is charged to the same
statement work counter, with host/control checkpoints between overflow pages while
PC/cursor state remains resumable. Binding follows
`vdbeapi.c:bindText`/`sqlite3VdbeMemSetStr` by copying public values into `Mem` in
the database encoding carried by every scalar/table program. Public tests hold a
scan at the real 256-opcode yield and cover all overlapping operations, reset-only
rebinding after ROW/DONE/FAILED, and TEXT/BLOB vectors on UTF-8/UTF-16le/UTF-16be.
This is not an AST interpreter
or general planner: unsupported plans and expression breadth remain temporary
unsupported.

## Stage 3 expression / ordinary scalar progressive map

| Translation seam | Pinned SQLite 3.53.4 source | Executable evidence |
|---|---|---|
| Reduction-derived expression tree and target/branch compilation | `src/expr.c`: `sqlite3ExprCodeTarget`, `sqlite3ExprIfTrue`, `sqlite3ExprIfFalse`; `src/parse.y` expression reductions | `test/conformance/cases/stage3-expression-functions.{spec,json}` (`e_expr-4.1`, `6.1`-`6.5`, `8.1.1/5/9/13`, `10.1.1`-`10.1.5`, `22.2.1`, `22.3.1`, `22.4.1`, `24.1.2`) |
| Function lookup/name/arity | `src/resolve.c`; registrations in `src/func.c` | exact `func-1.2`, `func-4.2` errors plus no-credit unknown/variadic companions |
| CAST, comparison, CollSeq, lazy control and calls | `src/vdbe.c`: `OP_Add`…`OP_Remainder`, `OP_CollSeq`, `OP_Cast`, `OP_Eq`…`OP_Ge`, `OP_If`/`OP_IfNot`, NULL branches, `OP_Function`/`OP_PureFunc` | captured typed rows/errors and short-circuit companion |
| Function bodies and shared values | `src/func.c`: `minmaxFunc`, `typeofFunc`, `lengthFunc`, `bytelengthFunc`, `absFunc`, `substrFunc`, `nullifFunc`, `replaceFunc`; `src/vdbemem.c`, `src/util.c`, `src/utf.c` | exact `func-1.4/1.6/1.7/1.8`, `2.0`, `4.4.1/4.4.2`, `6.3`-`6.5`; no-credit embedded-NUL/CollSeq fixture |

The no-credit boundary capture `test/conformance/cases/stage3-expression-function-boundaries.json` maps encoding conversions to `utf.c`/`vdbemem.c`, size enforcement to `sqlite3_result_error_toobig` and function result allocation paths, progress interruption to VDBE progress/interrupt checks, and callback result/destructor ordering to `sqlite3_context`/function teardown. It is development provenance only; it does not authorize host registration in the product API.

Boundary refinement: result-value destructor observations map to `sqlite3_result_text` ownership and `sqlite3VdbeMemRelease` paths on replacement/reset/finalize; the `sqlite3_create_function_v2` application destructor at connection close is recorded separately and must not be used as evidence for result-Mem cleanup. Since the C destructor is `void`, secondary cleanup-error precedence is a jsqlite2 function-context invariant rather than a native observable. Cancellation capture installs `sqlite3_progress_handler` after prepare and observes `SQLITE_INTERRUPT` from step.

| Stage 3 bounded expression/scalar execution | `src/internal/parse.ts`, `src/internal/vdbe.ts` | `expr.c:sqlite3ExprCodeTarget`, `resolve.c:resolveExprStep`, `vdbe.c:OP_Function/OP_Cast/comparisons`, `func.c:sqlite3RegisterBuiltinFunctions`, `vdbemem.c` | `test/conformance/cases/stage3-expression-functions.json`, `run-expression-functions-ts.mjs` (40 selected cases) |

| `src/vdbe.c` `OP_Function` result-error/cleanup path; `src/vdbeInt.h` `sqlite3_context`; `src/vdbemem.c` release | `src/internal/vdbe.ts` `FunctionContext`, `runFunctionContext`; `test/conformance/run-expression-function-cleanup-ts.mjs` | Bounded shared result ownership, cleanup ordering, and first-error identity. Compiler-emitted Function/PureFunc/CollSeq operations remain backlog. |
| `src/expr.c` `sqlite3ExprCodeTarget`/`sqlite3ExprCodeFunction`, `src/vdbe.c` `OP_Function`/`OP_PureFunc`/`OP_CollSeq` and branch operations | `src/internal/vdbe.ts` `compileExpressionTree` and operation switch; `test/conformance/run-expression-opcodes-ts.mjs` | Generated-reduction expressions lower to bounded function, collation, value and lazy-control program operations; catch-all recursive Expression operation removed. |
| `src/vdbe.c` progress/interrupt loop; `src/func.c` `replaceFunc`/`hexFunc`/`substrFunc`; `src/vdbeapi.c` result-too-big and saved reset/finalize errors | `src/internal/vdbe.ts` scalar control, `maxResultBytes`, Function/copy charging; `src/index.ts` connection limit; `test/conformance/run-expression-bounded-ts.mjs` | Deterministic bounded public scalar execution with resumable input checkpoints, source-shaped output preflight, first-error lifecycle and exact work admission. |

## Relational working-state gate (design/capture; TS unimplemented)

- Oracle/selection: `test/conformance/cases/stage3-relational-working-state.spec.json`, captured manifest `.json`, `capture-relational-working-state.py`, and `relational-working-state-manifest.test.py`; pinned to manifest source ID and built with `SQLITE_ENABLE_COLUMN_METADATA`.
- ORDER/DISTINCT generation maps to `src/select.c` `DistinctCtx`, `SortCtx`, `selectInnerLoop`, `pushOntoSorter`, and `generateSortTail`; term resolution maps to `src/resolve.c` `resolveOrderGroupBy`/result-list alias and ordinal handling; LIMIT/OFFSET maps to `computeLimitRegisters` and VDBE counter/coercion opcodes. Compounds remain unsupported: their future mapping is `multiSelect` and `multiSelectByMerge` with coroutine merge control near `select.c:3314-3399`, not an invented `multiSelectOrderBy` routine.
- Runtime private state maps to `src/vdbe.c` sorter/ephemeral/index/compare operations, `src/vdbesort.c`, private ephemeral paths in `src/btree.c`, and record/KeyInfo packing/comparison in `src/vdbeaux.c`. The first implementation is `src/internal/private-state.ts`, consumed by typed `SorterOpen/SorterInsert/SorterSort/SorterData/SorterNext` and `OpenEphemeral/Found/IdxInsert` routes in `src/internal/vdbe.ts`; it is memory-only, stable for equal sorter keys, owns copied `Mem` cells, and has explicit entry/key/total-byte ceilings. Its browser work adaptation charges each record and copied logical byte, visited `KeyInfo` term, and merge move; control checks bracket growth and a failed post-growth check rolls the entry back. Exact charging is covered in `test/value/private-state.test.mjs`; exhaustive multi-cursor cleanup, first-error precedence, reset/finalize, and restored admission are covered in `test/conformance/relational-private-lifecycle.test.mjs`. It currently serves one-column ORDER and direct-column DISTINCT only; compound and generalized key consumers remain gaps.
- Literal upstream assertions are selected from `test/limit.test`, `test/distinct.test`, and `test/select4.test`. Edge/lifecycle adaptations are explicit no-credit companions. Native observations are development evidence only and runtime TypeScript must not import native code. The public TS gate currently attempts, passes, and credits only literal upstream `up-limit-1.2.1` (1/18); its two additional relational queries are uncredited smoke demonstrations outside the declared denominator.

### 2026-09-14 audit/relational integration

| TypeScript owner | Pinned SQLite 3.53.4 owner | Bounded evidence |
| --- | --- | --- |
| `Mem.numericTypeCopy`, arithmetic/boolean callers | `src/vdbe.c` `computeNumericType`, `numericType`, `sqlite3VdbeBooleanValue` | 14-case pinned/public audit, zero credit |
| `Mem.cast("integer")` | `src/vdbemem.c` `sqlite3VdbeIntValue` / `sqlite3Atoi64` prefix | CAST exponent neighbors in 14-case audit |
| `evaluateFunction(abs)` | `src/func.c` `absFunc` storage-class switch | TEXT-prefix/class audit |
| private relational cursors and `SeekGE`/`Next` foundation | `src/vdbe.c` cursor seek/next and sorter/ephemeral lifecycle families | private state/lifecycle tests and relational working-state manifest; foundation only |

### ORDER/LIMIT acceptance contract (zero-credit handoff)

`test/conformance/cases/stage3-order-limit-contract.spec.json` and its pinned
capture map `resolve.c:resolveOrderGroupBy`/`resolveAsName`, `select.c` sorter-tail
and limit-register paths, `where.c` ordering decisions, `vdbe.c` sorter/counter/
coercion opcodes, and `vdbeaux.c` record-key comparison to
`run-order-limit-contract-ts.mjs`. The public test admits only current one-term
direct resolution and checks broader forms, including multi-term input, as typed temporary unsupported;
the compiler rejects them before execution rather than silently ignoring secondary
keys. These 24 contract cases are outside `stage3-relational-working-state` accounting;
that denominator remains exactly 1/18 until successful public assertions are
explicitly promoted. Compounds/subqueries remain structural-gate work.
