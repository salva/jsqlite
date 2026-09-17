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

[`api.md`](api.md) is the singular public contract. `src/index.ts` now contains
the implemented bounded runtime accumulated by later stages; that later work is
not evidence or scope credit for this historical Stage 1 contract section. The contract selects full-file bounded
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
This was reproduced as a fidelity gap and was first corrected by card-owned commit
`9ed1c0ca7eab68f18d01c7c57e9feb8a96b0e762` (with evidence follow-ups
`fd56a284fb8607e352d028459bb877a624a52940` and
`97916d472406df267b00e33b07a86639a581e0dd`). Table/index seek descends one selected child per interior page and keeps
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

The current integrated tree includes a later bounded first-SELECT execution slice.
That descendant work is outside this storage card and is not credited here.
Broader resolution, compilation, planner/VDBE execution, public statement handles and conversions, automatic
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

The checked-in `src/generated/parser-tables.ts` and `keyword-table.ts` are deterministically emitted by `tools/parser/generate.mjs` from pinned `src/parse.y` and `tool/mkkeywordhash.c`, with provenance hashes for those inputs, `lemon.c`, `lempar.c`, and `tools/parser-profile.json`. The development generator compiles a disposable copy of pinned `lemon.c` after disabling only its actionless-unit-production elision: unlike generated C, the TypeScript parser has an external callback for every reduction, so those productions are semantically observable and must remain materialized. Ordinary Lemon table compression and SHIFTREDUCE encoding remain enabled. It emits the 600-state/412-rule Lemon action, lookahead, shift/reduce offset, default, token-ID and rule metadata tables; `src/internal/lemon-runtime.ts` is the browser-safe no-eval shift/reduce table consumer. The runtime does not use eval/Function or native code. `src/internal/tokenize.ts` follows `src/tokenize.c:sqlite3GetToken` byte spans for the covered lexical classes. `src/internal/parse.ts` consumes generated production metadata and builds ordered SELECT expression/source/predicate structures and CREATE TABLE/INDEX/VIEW/TRIGGER schema nodes.

Evidence: exact `test/tokenize.test` IDs 1.1–1.12 and 2.1–2.2 are in `test/parser/tokenizer-parser.test.mjs`, alongside UTF-8 tails and lexical companions; deterministic generation is checked by `test/parser/generator.test.mjs`. Configured parser work and stack depth are enforced in the Lemon loop, and expression depth is measured from actual `expr ::= ...` reduction ancestry (including unparenthesized unary/binary trees), rather than approximated by parenthesis count. The Lemon runtime invokes a production-keyed semantic-action callback at reduction time; the bounded `cmd ::= select` and stored CREATE TABLE/INDEX/VIEW/TRIGGER productions attach immutable authored structures to their actual reduction values. Generated `yyFallback` is applied only when the current parser state lacks an action for the original lookahead, and tokenizer-context decisions for WINDOW/OVER/FILTER follow their pinned branches; focused tests include REPLACE fallback and neighboring keyword contexts. This is a progressive parser foundation: semantic actions exist only for the bounded SELECT/schema structure layer. Remaining detailed DDL fields, compound/CTE/window semantic consumers, and full syntax diagnostics are explicit backlog. Parsed but uncompiled forms produce temporary unsupported at the public compiler boundary rather than syntax errors; there is deliberately no separate literal-SELECT evaluator, so accepted syntax cannot acquire execution semantics outside the future translated compiler/VDBE.

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

Current bounded construction supports ordinary column declarations; ordered default-expression indexes; not-null (including `build.c`'s implicit NOT NULL for WITHOUT ROWID primary-key columns), unique, collation and primary-key column metadata; generated expressions with stored/virtual state; explicit-index uniqueness/origin and per-term collation/sort/null-order metadata; views; and WITHOUT ROWID declared-primary-key storage mapping. CHECK and REFERENCES/foreign-key declarations are recognized by generated reductions but currently report temporary unsupported rather than publishing a shallow graph. Automatic indexes (including their origin), triggers, virtual tables, fuller named constraint graphs, and further recognized grammar consumers
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

## Relational working-state gate (historical design/capture checkpoint)

- Oracle/selection: `test/conformance/cases/stage3-relational-working-state.spec.json`, captured manifest `.json`, `capture-relational-working-state.py`, and `relational-working-state-manifest.test.py`; pinned to manifest source ID and built with `SQLITE_ENABLE_COLUMN_METADATA`.
- At this checkpoint, ORDER/DISTINCT generation was mapped to `src/select.c` `DistinctCtx`, `SortCtx`, `selectInnerLoop`, `pushOntoSorter`, and `generateSortTail`; term resolution to `src/resolve.c` `resolveOrderGroupBy`/result-list alias and ordinal handling; and LIMIT/OFFSET to `computeLimitRegisters` and VDBE counter/coercion opcodes. Compounds were then unsupported. The current bounded compound mapping and its documented materialization substitution are in the completion sections below; `multiSelect` and `multiSelectByMerge` remain the upstream comparison, not an invented `multiSelectOrderBy` routine.
- Runtime private state maps to `src/vdbe.c` sorter/ephemeral/index/compare operations, `src/vdbesort.c`, private ephemeral paths in `src/btree.c`, and record/KeyInfo packing/comparison in `src/vdbeaux.c`. The first implementation is `src/internal/private-state.ts`, consumed by typed `SorterOpen/SorterInsert/SorterSort/SorterData/SorterNext` and `OpenEphemeral/Found/IdxInsert` routes in `src/internal/vdbe.ts`; it is memory-only, stable for equal sorter keys, owns copied `Mem` cells, and has explicit entry/key/total-byte ceilings. Its browser work adaptation charges each record and copied logical byte, visited `KeyInfo` term, and merge move; control checks bracket growth and a failed post-growth check rolls the entry back. Exact charging is covered in `test/value/private-state.test.mjs`; exhaustive multi-cursor cleanup, first-error precedence, reset/finalize, and restored admission are covered in `test/conformance/relational-private-lifecycle.test.mjs`. It originally served one-column ORDER and direct-column DISTINCT only; that is the historical foundation handoff. The current ORDER/LIMIT implementation below consumes the same primitive for complete multi-term expression keys. At that checkpoint, compound and generalized consumers remained gaps; the compound gap is superseded by the bounded completion mappings below.
- Literal upstream assertions are selected from `test/limit.test`, `test/distinct.test`, and `test/select4.test`. Edge/lifecycle adaptations are explicit no-credit companions. Native observations are development evidence only and runtime TypeScript must not import native code. The public TS gate now attempts and passes `up-limit-1.2.1`, `up-distinct-3.0`, and `up-select4-10.3`, while crediting only the exact-setup `up-limit-1.2.1` and `up-select4-10.3` (2/18); `up-distinct-3.0` remains no-credit because automatic-index schema loading prevents its upstream `UNIQUE(a,b)` fixture; its additional relational queries remain uncredited smoke demonstrations outside the declared denominator. DISTINCT lowering emits `OpenEphemeral`/`Found`/`IdxInsert` before sorter production and patches the duplicate branch only after the complete variable-length ORDER key and `SorterInsert` route is known.

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
`run-order-limit-contract-ts.mjs`. The public test admits complete multi-term
resolution: every alias/positive-ordinal/identical-result-expression/table-expression
fallback term reaches immutable `KeyInfo` with collation, direction, and NULL-order
flags and participates in typed sorter comparison. The current implementation admits
ORDER expressions and explicit COLLATE/NULLS terms; the temporary-unsupported and
one-column descriptions above are historical `af6ee17`/foundation handoffs, not
current behavior. Historically `3104d7a` exposed acceptance with one-term
`KeyInfo` risk, `af6ee17` added the conservative rejection, and `37fd90b` retained
the pinned expected rows now exercised by the public repair. These 29 contract cases are outside `stage3-relational-working-state` accounting;
that denominator is now exactly 2/18 after successful exact-setup public assertions were
explicitly promoted. The passing `up-distinct-3.0` assertion is no-credit until the
fixture can preserve its upstream UNIQUE autoindex setup. The public runner makes exactly 34 statement attempts: 30
admitted executions/error-phase checks, 3 expected typed structural rejections,
and 1 expected SQLite prepare error for an unknown collation. Those include four distinct public collation attempts (declared NOCASE, explicit
BINARY, RTRIM, and NOCASE embedded-NUL/byte-length); this attempt count is test
inventory, not relational credit. This relational checkpoint originally gated both
compounds and subqueries; bounded compounds are now implemented as mapped below,
while subqueries remain gated.

- `parse.y:orderby_opt/sortlist/limit_opt` -> typed `SelectNode.orderBy/limit/offset`.
- `resolve.c:resolveOrderGroupBy`, `select.c:pushOntoSorter` -> expression/alias/ordinal/table fallback and complete `KeyInfo` keys in `compileTableSelect`.
- `vdbeaux.c:sqlite3VdbeRecordCompareWithSkip`/`sqlite3VdbeRecordCompare`, `main.c:nocaseCollatingFunc`, and `util.c:sqlite3_strnicmp` -> shared `compareMem`/`compareBuiltinText`; public declared NOCASE, explicit BINARY/RTRIM, and embedded-NUL byte-length cases prove actual ordering rather than `KeyInfo` labels.
- `select.c:computeLimitRegisters` and `codeOffset`, `vdbe.c:OP_MustBeInt`, `OP_OffsetLimit`, `OP_IfPos`, `OP_IfNotZero`, and `OP_DecrJumpZero` -> emitted register/opcode control, including mismatch phase, negative and zero branches; scalar LIMIT/OFFSET opcodes precede deferred result-expression opcodes, and table LIMIT/OFFSET precedes scan/sorter setup. The pinned/native and public `abs(INT64_MIN) LIMIT 0` case proves the zero jump bypasses result evaluation, while invalid OFFSET coercion remains before that jump.

### Schema UTF lead-byte and fixture provenance correction (2026-09-15)

`src/internal/utf.ts` now maps every lead byte through the exact groups of
`src/utf.c:sqlite3Utf8Trans1` and `READ_UTF8` (`utf.c:52-60,164-174`), notably the
zero entries for `0xfe` and `0xff`. `test/schema/sqlite-utf.test.mjs` protects
`FF 80 80 -> U+FFFD` and neighboring malformed/legacy sequences. The independent
capture in `test/oracle/schema-identifier-case.test.py` loads the manifest-pinned
3.53.4 library, verifies `sqlite3_sourceid()`, and captures UTF-8 results as well
as catalog identity across UTF-8/UTF-16le/UTF-16be. Databases created at test time
by host Python `sqlite3` remain setup fixtures only; assertions about pinned
behavior are backed by this source-identified native capture, not by the host
module's unversioned provenance.

## Compound SELECT / structured multirow VALUES design (superseded checkpoint, 2026-09-15)

> This table is the original design checkpoint, not current status. Its
> zero-credit/not-implemented cells and 15-attempt evidence are superseded by the
> later implementation mappings: the current exact public gate is 22 declared /
> 22 attempted / 22 passed / 22 credited.

| Project seam | Pinned SQLite 3.53.4 owner | Required mapping / current status |
|---|---|---|
| Production-owned immutable query graph | `src/parse.y:selectnowith`, `multiselect_op`, `values`, `mvalues`; `Select.pPrior/pNext/op`, `SF_Values/SF_MultiValue` | Implemented: `src/internal/lemon-runtime.ts` invokes per-reduction callbacks and retains `child.semantic`; `src/internal/parse.ts:productionAction` owns immutable semantics at `values`, both `mvalues`, ordinary `oneselect`, and both `selectnowith` productions, with `select` and `cmd` publishing their child. Recursive find/findAll and flattened leaves are not SELECT graph construction inputs (they remain only in documented legacy DDL extraction and local clause extraction). Dense reciprocal links, RHS operator, and structured rows are asserted |
| Width, names, metadata, affinity | `src/select.c:multiSelect`, `sqlite3ResultSetOfSelect`, `sqlite3SubqueryColumnTypes` | validate width at prepare; public metadata from leftmost arm; future derived-table affinity scans arms without coercing set values |
| Compound ORDER | `src/resolve.c:resolveCompoundOrderBy`, `sqlite3ResolveOrderGroupBy` | dedicated left-to-right alias/ordinal/output-expression resolver; explicit COLLATE retained; no arbitrary non-output expression |
| Collation and duplicate equality | `src/select.c:multiSelectCollSeq`, `multiSelectByMergeKeyInfo`, `generateOutputSubroutine`; `src/vdbeaux.c:sqlite3MemCompare`, record compare | immutable order and full-row duplicate `KeyInfo`; NULL-equal, INTEGER/REAL numeric equality, typed TEXT/BLOB distinction; preserve source representative |
| VALUES and unordered UNION ALL | `src/parse.y:values`/`mvalues`; `src/select.c:multiSelectValues`, `multiSelect`, `selectInnerLoop`, `SelectDest`/`SRT_Output`/`SRT_Coroutine` | Historical requirement: one destination-based arm compiler; VALUES rows retain insertion order and bare VALUES rejects ORDER/LIMIT in the grammar; sequential UNION ALL. This was not implemented at the checkpoint and is now superseded by the completion mappings below. |
| Ordered/all set compounds | `src/select.c:multiSelect`, `multiSelectByMerge` and A/B transition table | split only contiguous same-op UNION/UNION ALL chains under pinned balanced-merge conditions (not generic AST balancing); exact per-operator A<B/A=B/A>B/EOF control and representative side; synthesize/complete ORDER for unordered sets; reuse typed sorter for producers, no JS Set/sort |
| Compound LIMIT/OFFSET control | `src/select.c:computeLimitRegisters`, `multiSelectByMerge`; `src/vdbe.c` `MustBeInt`/`IfNot`/`OffsetLimit` | initialize once before coroutines; literal zero jumps immediately and expression/parameter zero jumps after LIMIT coercion, in both cases before OFFSET evaluation and all producer work. Only nonzero LIMIT coerces OFFSET. UNION ALL copies the same `LIMIT+OFFSET` cap to both producers while retaining global counters; set operators receive no membership-changing arm cap. This deliberately differs from the currently admitted single-SELECT adaptation, which still coerces OFFSET before its zero jump |
| VM/private state and public limits | `src/vdbe.c` `InitCoroutine/Yield/EndCoroutine/Gosub/Return/Permutation/Compare`, LIMIT and sorter operations; `src/vdbeaux.c` labels/register/KeyInfo; applicable `src/btree.c` private ephemeral paths | add typed opcode/state routes in `src/internal/vdbe.ts`; reuse bounded `private-state.ts`; preserve suspension, counters, ownership and exhaustive cleanup. Every private cursor now receives immutable finite `program.privateStateLimits` (defaults: 100,000 entries, 16 MiB key, 256 MiB aggregate), never public `maxRows`/`maxResultBytes`: `maxRows` remains solely the global public `ResultRow` outcome limit, while `ResultRow` also checks the public per-value byte ceiling immediately before publication. Generic `Copy` matches pinned `OP_Copy` by charging/copying without applying that public ceiling, so private-only sorter/ephemeral staging is governed solely by immutable `program.privateStateLimits`; output-growing scalar functions retain their preflight. Work remains operation-tightenable; all failures are `kind:"limit"` |
| Connection lifetime and admission | `src/main.c:connectionIsBusy`, `sqlite3Close`, `sqlite3LeaveMutexAndCloseZombie`; `src/vdbeapi.c`/`vdbeaux.c` reset/finalize cleanup | busy `close()` leaves every owner intact; validly admitted `closeDeferred()` changes admission only. Existing compound statements and graph/program/KeyInfo/schema/storage dependencies remain usable through step/reset/finalize until last-statement finalization completes zombie destruction. A pending `step()` retains serialized connection admission across suspended host yields, so overlapping `closeDeferred()` synchronously fails with `misuse`, changes no state, and may be retried only after that promise settles; private state unwinds at normal halt/reset/finalize boundaries and first-error precedence is retained |
| Evidence | pinned public C API via `stage3-compound-values.spec.json`, captured JSON and exact recapture; no-credit focused companions via `stage3-compound-values-boundaries.spec.json` | Historical checkpoint evidence: core 22/22 native exact with 15 valid TS prepare attempts; boundary 12/12 native exact with 11 valid TS prepare attempts; both were then zero-credit. Current core accounting is 22/22 attempted/passed/credited as recorded below. |

`docs/TRANSLATION.md#compound-select-and-structured-multirow-values-design-implementation-handoff`
is the consuming contract, including AST invariants, error timing, LIMIT/OFFSET,
resource/lifecycle rules and test matrix. At this historical checkpoint, the design proposed no exceptional algorithm
substitution: the bounded TypeScript sorter was to serve ordered producers while
the pinned 3.53.4 coroutine merge and operator transitions were to be translated.
The later accepted implementation instead documents a bounded materialization
substitution, its TypeScript constraint, upstream comparison, preserved observables,
and source-based tests.
The accepted `bd33810` parser/schema baseline, `f1dbe61` foundation, completed
native-gate commit `e1e6b91` (core 22/22 and boundary 12/12 exact recaptures), and
audit finding 1 established ownership, oracle evidence, and honest rejection at
that checkpoint only—not then-current runtime conformance or TS credit.

### Structured VALUES implementation checkpoint (2026-09-16)

`src/internal/parse.ts` now maps `parse.y:values`/`mvalues` and compound
`selectnowith` reductions to immutable rows and reciprocal indexed arm links.
`src/internal/vdbe.ts` maps standalone structured rows to the existing expression
opcode compiler plus `ResultRow`, corresponding to `select.c:multiSelectValues` /
`selectInnerLoop`. `test/conformance/structured-values.test.mjs` covers public
multirow typed output, metadata, reset, and atomic width failure. At this
chronological checkpoint, compound merge lowering remained explicitly unsupported
and received no compatibility credit; later completion sections supersede that status.

`src/internal/vdbe.ts:compileScalarSelect` now translates the unordered
`select.c:multiSelect` `TK_ALL` destination reuse branch for bounded scalar arms,
including shared LIMIT/OFFSET counters and pre-publication width checking.
`test/conformance/compound-union-all.test.mjs` covers order/multiplicity,
leftmost names, global LIMIT/OFFSET, lazy coercion/first-error, and atomic width
failure. At this checkpoint, `multiSelectByMerge` was not yet claimed; the current
bounded adaptation is documented below.

`src/internal/private-state.ts:EphemeralIndexCursor.replace/sort` and
`src/internal/vdbe.ts` now map the unordered `select.c:multiSelect` UNION
SRT_Union ephemeral b-tree behavior: full-row KeyInfo equality, replacement of
equal records, and key-order traversal. Focused public tests cover NULL,
INTEGER/REAL representative selection, and storage-class distinctions.

`src/internal/private-state.ts:EphemeralIndexCursor.remove/clear` and the
`SetDelete`/`SetIntersectInsert`/`SwapEphemeral` VDBE operations translate the
scalar `multiSelect` SRT_Except and intersection two-ephemeral-set transitions.
The public focused suite verifies left-associative mixed transitions and exact
cardinality. At this checkpoint, later `UNION ALL` after a set transition was not
yet claimed; the set-prefix destination-handoff completion below supersedes that gap.

`src/internal/vdbe.ts:compileScalarSelect` now shares LIMIT/OFFSET registers with
final ephemeral traversal for set routes and implements the one-result-column
portion of `resolve.c:resolveCompoundOrderBy` plus KeyInfo-driven ordered set
output. Tests cover aliases, ordinals, matching expressions, non-output errors,
post-set LIMIT/OFFSET timing, coercion, and first-error behavior. At this checkpoint this remained a bounded precursor, not a claim of full
`multiSelectByMerge`; the later completion records the accepted bounded substitution.

`src/internal/vdbe.ts:compileScalarSelect` maps finite scalar/VALUES ordered UNION
ALL arms to the existing SorterOpen/SorterInsert/SorterSort destination. Unlike
`select.c:multiSelectByMerge`, these bounded producers need no coroutine; the
complete resolved multi-term KeyInfo, complete-row payload, stable equal-key
sequence, top-N capacity, and output LIMIT/OFFSET preserve observable behavior.
At this checkpoint table producers remained mapped to future coroutine work. The
later admitted direct-column table mapping is documented below; broader producers
remain excluded.

`src/internal/vdbe.ts:compileScalarSelect` consumes `SelectArm.valuesRows` in all
compound destinations, mapping `select.c:multiSelectValues` structured rows to
ALL output, sorter, or set insertion. The intersection auxiliary-set swap occurs
once per arm. Focused tests cover VALUES/SELECT UNION ALL, VALUES duplicate UNION,
and two multirow VALUES INTERSECT arms.

`src/internal/parse.ts:selectAction` guards the `parse.y` compound arm-local
ORDER/LIMIT syntax boundary after generated recovery, using arm source ownership
to reject clauses before the rightmost arm rather than publishing a graph that
silently omits them. Parser tests assert no partial program can result.

`src/internal/lemon-runtime.ts:errorInput` carries the `parse.y` failure cursor to
`parseSql`; this maps syntax diagnostics to the parser-selected token/EOF.
`compileScalarSelect` maps width errors through `SelectArm.operatorFromPrior`,
and the recovered arm-local ORDER guard emits the corresponding operator name.
The seven pinned prepare-error cases now match native primary code/message.

`src/internal/vdbe.ts:compileSimpleTableCompound` maps the bounded table-arm
portion of `select.c:multiSelect`: each resolved arm uses OpenRead/Rewind/Column/
Next and targets either direct output or the shared ephemeral UNION destination.
Leftmost `ColumnNode` owns metadata and KeyInfo collation, matching select.c's
leftmost affinity/name rules and multiSelectCollSeq's left-to-right choice.

- **Table compound set-to-ALL handoff (2026-09-16):** `src/internal/vdbe.ts::compileSimpleTableCompound` maps pinned `select.c::multiSelect` destination transitions: the set prefix is exhausted into typed ephemeral state, then a trailing `UNION ALL` suffix resumes the result destination. `INTERSECT` populates separate right membership and filters the left ephemeral state, retaining the left storage-class representative as `multiSelect` does. Ordered mixed table handoffs feed the completed typed set prefix and direct suffix through one bounded sorter destination, the admitted direct-column adaptation of `multiSelectByMerge`. Focused public coverage is in `test/conformance/compound-union-all.test.mjs`.
- **Compound suspension/resources:** `src/internal/vdbe.ts::PreparedStatementImpl.step/#checkControl/#finishPrivate` and `src/internal/private-state.ts::EphemeralIndexCursor` preserve PC/cursors over browser yields and apply cancellation, deadline, work, entry, key and aggregate-byte bounds. Active public tests are in `test/conformance/compound-union-all.test.mjs`.

### Compound collation/accounting completion (2026-09-16)

- `src/select.c:multiSelectCollSeq` plus `src/expr.c:sqlite3ExprCollSeq` ->
  `src/internal/vdbe.ts:compileScalarSelect` resolves each scalar compound result
  collation from generated expression structure, first explicit collation
  left-to-right (including propagated COLLATE in admitted function argument
  lists), then BINARY. The duplicate
  ephemeral `KeyInfo` remains distinct from ORDER comparison.
- `src/select.c:multiSelectByMergeKeyInfo` and its separate `pKeyDup` -> compound
  ORDER inherits the result collation unless ORDER has explicit COLLATE; the
  explicit override configures a separate bounded sorter and never changes set
  membership. `src/vdbeaux.c` comparison remains shared through `KeyInfo`/`Mem`.
- `test/conformance/compound-collation.test.mjs` records pinned/public
  discriminators for NOCASE, RTRIM, later-arm first collation, ORDER inheritance
  and override, multi-position equality, and representative/storage class.
- The core gate is currently 22 native-matched and 22 exact public TS credits.
  `run-compound-values-ts.mjs` records actual public operations and requires them
  to equal the manifest partition; prepare errors truthfully leave statement-only
  operations unattempted. `recapture-compound-values.py` preserves this current
  accounting on pinned-oracle recapture.

### Set-prefix destination handoff completion (2026-09-16)

- `src/select.c:multiSelect` set destination transitions ->
  `src/internal/vdbe.ts:compileScalarSelect`: scalar and structured-VALUES set
  prefixes use typed ephemeral `KeyInfo`, preserve left-to-right representatives,
  then drain once into the same destination used by trailing `UNION ALL` arms.
- Unordered rows use the direct output destination. Ordered admitted finite
  producers use the existing bounded typed sorter as the browser-safe substitute
  for `multiSelectByMerge` coroutine subprograms. The TypeScript VM has finite
  generated producers but no native resumable VDBE subprogram stack; observable
  ordering, multiplicity, comparison, global LIMIT/OFFSET, suspension and bounds
  are preserved by focused source-based tests.
- Current exact gate: 22 declared / 22 attempted / 22 passed / 22 credited. The
  earlier zero-credit, 15-attempt, not-implemented table is explicitly superseded.
  Atomic table-arm and broader SQL exclusions are unchanged.

### Aggregate private-state budget correction (2026-09-16)

- `src/vdbe.c` sorter/ephemeral cursor lifetime and cleanup plus `src/vdbesort.c`,
  `src/btree.c` private ephemeral paths, and `src/vdbeaux.c` record/KeyInfo
  accounting -> `src/internal/vdbe.ts:VdbeStatement` owns one
  `PrivateStateByteBudget`; `src/internal/private-state.ts` shares it across all
  sorter and ephemeral cursors in that execution.
- Insert/replacement/removal/intersection/clear/close and failed-growth rollback
  reserve or release aggregate logical bytes atomically. Thus overlapping compound
  primary, membership, and output cursors cannot each consume `maxPrivateBytes`.
- `test/value/private-state.test.mjs` checks cross-kind accounting and rollback;
  `test/conformance/compound-union-all.test.mjs` checks the limit, saved-error
  lifecycle, cleanup, rerun, and later admission through the public API.
- This fixes resource ownership only. The documented finite-producer typed
  materialization substitute for `select.c:multiSelectByMerge`, its preserved
  observables, exact 22/22 compound gate, and broader exclusions are unchanged.

## Multi-source SELECT / join architecture ([[card:card-k-a]])

The detailed consumer contract is
[`architecture/multi-source-select.md`](architecture/multi-source-select.md), with
pinned expectations in
`test/conformance/cases/stage3-multisource-select.{spec.json,json}` and capture in
`test/conformance/capture-multisource-select.py`.

| Concern | Pinned 3.53.4 owner | TypeScript handoff / evidence |
|---|---|---|
| Source production and flags | `src/parse.y:stl_prefix/seltablist/joinop/on_using`; `src/build.c:sqlite3SrcListShiftJoinType`; `src/sqliteInt.h:Select/SrcList` | generated reduction-owned immutable ordered `SourceList`; shift join flags onto RHS, retain RIGHT/FULL and immutable `JT_LTORJ` on all items left of the right-most RIGHT; preserve ON/USING and unsupported payloads |
| Expansion and wildcard | `src/select.c:selectExpander` (notably `JT_LTORJ` plus `inAnyUsingClause`), `sqlite3ProcessJoin` multi-left USING/coalesce branch | bind schema/table identity, assign stable statement cursor IDs, expand `*`/`q.*`; omit RHS USING/NATURAL columns from bare `*`, but emit applicable left-of-RIGHT names unqualified for resolver selection; qualified stars remain source-specific; no source reversal; RIGHT/FULL reject atomically until complete retained-order control passes |
| Name lookup and descriptors | `src/resolve.c:lookupName` (`pFJMatch`/`extendFJMatch`), `resolveSelectStep`, `sqlite3SelectCheckOnClauses`; `src/sqliteInt.h:NameContext` | linked frames and resolved identity; for USING/NATURAL, INNER/LEFT chooses left direct value/metadata/affinity/collation, RIGHT chooses right direct, FULL builds source-order `coalesce` with expression/null-origin metadata, affinity deferred to the first/left argument, and expression collation; qualified references remain direct; real columns precede `NC_UEList`; preserve ambiguity/no-such-column and ON-right-reference checks |
| Join predicates and loop control | `src/select.c:sqlite3ProcessJoin`; `src/whereexpr.c` outer/inner ON provenance; `src/where.c:sqlite3WhereBegin`; `src/wherecode.c` left/right join match and unmatched paths | retain ON ownership separately from WHERE; streaming source-order loops respect RIGHT/`JT_LTORJ` barriers; match registers plus `WhereRightJoin` typed RHS match state and shared interior continuation, no Cartesian row array |
| RIGHT/FULL unmatched control | `src/wherecode.c:sqlite3WhereRightJoinLoop`; `WhereRightJoin`; `WHERE_RIGHT_JOIN` | scan original RHS, skip matched identities, null every applicable left cursor, invoke preserved downstream-loop subroutine; FULL combines LEFT unmatched and unmatched-RHS paths |
| NULL cursors and composition | `src/vdbe.c:OP_NullRow` and column/cursor opcodes; `src/select.c:selectInnerLoop` destinations | null-row is cursor state read by shared column primitive; feed existing ResultRow, KeyInfo sorter, DISTINCT/set ephemeral and compound destinations |
| Bounds and lifecycle | `src/vdbe.c`, `src/vdbeapi.c`, applicable ephemeral paths | charge loop/predicate/compare/growth work; suspend complete loop/null/match state; one statement-wide `PrivateStateByteBudget`; exhaustive reset/finalize cleanup and first-error precedence |

The checked-in native capture has 47/47 identity-verified cases. It is oracle
expectation only, not runtime credit. The implementation consumer must add public
TS accounting plus adversarial cancellation/deadline/work/private-limit and
streaming proofs before changing `docs/api.md`.

### Multi-source foundation implementation checkpoint (2026-09-16, [[card:card-k-b]])

| Pinned owner | Current TypeScript mapping | Evidence / boundary |
|---|---|---|
| `parse.y:stl_prefix/seltablist/joinop/on_using`, `build.c:sqlite3SrcListShiftJoinType` | `src/internal/parse.ts` reduction-owned immutable `SourceList` and shifted RHS flags/ownership | `test/parser/tokenizer-parser.test.mjs` |
| `select.c:selectExpander/sqlite3ProcessJoin` | `src/internal/resolve.ts` schema/cursor binding, stars, NATURAL synthesis, USING validation/RHS hiding | `test/parser/resolver.test.mjs`; no evaluator claim |
| `resolve.c:resolveCompoundOrderBy/sqlite3ResolveOrderGroupBy`, `expr.c:sqlite3ExprCompare` | `src/internal/resolve.ts` left-to-right alias/ordinal matching plus direct generated-`LemonValue` reduction comparison; resolved identifiers use SQLite equality across quote forms, while literal/variable/BLOB/CAST and overflow-integer spellings retain pinned distinctions; no copied-token normalizer or reparsing | `test/parser/resolver.test.mjs` includes the architecture invariant; bounded structural coverage, not general tree equivalence |
| `resolve.c:lookupName/resolveAlias/resolveSelectStep/resolveOrderGroupBy`; `select.c:sqlite3SelectCheckOnClauses` | `src/internal/resolve.ts` direct/merged identity and metadata, real-column-before-rowid candidates, exact INTEGER PRIMARY KEY substitution, generated result/WHERE/ON/GROUP/HAVING/ORDER/LIMIT/function/FILTER/OVER resolution, source-first aliases, ordinals, aggregate placement, built-in arity/ownership and explicit COLLATE validation, outer-owner scope check; `src/internal/vdbe.ts` bounded WHERE alias substitution after source lookup | resolver/public source-resolution tests; linked outer contexts, user-defined functions, and GROUP/HAVING/window evaluation pending |
| `vdbe.c:OP_Rowid`, table btree cursor rowid | `src/internal/btree.ts:TableScanCursor.rowid`; `src/internal/vdbe.ts:Rowid` | public rowid/_rowid_/oid bigint and metadata assertions |

The pinned multi-source oracle artifact is exact-recaptured with source identity,
including UTF-16le qualified lookup and UTF-16be USING-star cases. Public
`source-resolution.test.mjs` additionally checks UTF-8/UTF-16le/UTF-16be duplicate
names and NULL/empty TEXT/int64/REAL values. These checks grant no join execution
credit; joins, GROUP/HAVING, frames/windows/aggregates, and general functions are
owned by downstream implementation cards.


### Comma/CROSS/INNER execution mapping ([[card:card-k-c]], 2026-09-17)

- `src/where.c:sqlite3WhereBegin` and `src/wherecode.c` loop emission ->
  `src/internal/vdbe.ts:compileInnerTableSelect`: stable resolver cursor IDs drive
  source-order nested `OpenRead`/`Rewind`/`Next`; source-owned ON and synthesized
  USING/NATURAL terms branch to that source's continuation, while WHERE branches
  from the complete joined row. No Cartesian row collection or host evaluator.
- `src/select.c:selectInnerLoop` destinations -> the existing Mem expression,
  DISTINCT ephemeral, KeyInfo sorter, LIMIT, and ResultRow lowering.
  `compileJoinedUnionAll` embeds the same relational producer, relocates its VDBE
  control addresses, and redirects output into the compound ORDER destination.
- `src/vdbe.c` cursor opcodes -> cursor-keyed scan/decoded-record state in
  `VdbeStatement`; reset, finalize, halt, and first-error cleanup close all state.
  Sorter/ephemeral owners retain the one execution-wide private-byte budget.
- Evidence denominators remain distinct: native artifact **47/47 captured**; admitted
  pinned/public matrix **8/8**; focused INNER runtime suite **27/27**. LEFT/RIGHT/FULL
  execution is not mapped as complete and remains a prepare-time gate.
