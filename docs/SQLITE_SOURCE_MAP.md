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

## Window-function evidence mapping

The immutable tests-before-port gate in
`test/conformance/cases/stage3-window.{spec.json,json}` maps exact selected cases
from `test/window1.test` and `test/window4.test`; the broader `window1..9`,
`windowA..E`, `windowerr`, `windowfault` and `windowpushd` corpus remains outside
this bounded denominator. Algorithm/source owners are `src/window.c` (rewrite,
frame/cache/code generation), `src/func.c` (built-in step/inverse/value functions),
`src/resolve.c` (placement and named-window resolution), `src/parse.y` (OVER,
WINDOW, frame and EXCLUDE grammar), `src/select.c` (aggregate/group/subquery
composition), and applicable `src/vdbe.c`, `src/vdbeapi.c`, and `src/vdbeaux.c`
(statement execution/lifecycle). This is a future translation map, not TS runtime
credit. `window-manifest.test.py` requires every owner, exact upstream case/SQL
anchor, and source-derived credited setup against the pin. Complete setup-assertion
body hashes plus normalized statement comparison protect inherited state; the
post-`reset_db` `window1-6.1` setup is the explicit owner for `window1-6.3`, and
`window4-4.0` owns the grouped `window4-4.1` setup. Project-private byte/work/row/deadline/yield controls have
no faithful native C-API observation and are explicitly source-only/no-credit;
progress cancellation uses `sqlite3_progress_handler` as a separately captured
native companion.

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
only the positioned descriptor. The current repair also retains the index
ancestor/child path and translates pinned `btreeNext`/`btreePrevious`: boundary
positioning descends one edge, while next/previous move on the current page,
descend from an interior cell, or ascend that retained path without invoking
`readIndex`. The focused mutations now prove table/index seeks and adjacent index
movement ignore unrelated malformed subtrees, while malformed selected children
still report corruption. Existing exact/inexact GE/LE, complete bidirectional
ordering, and depth-limit coverage remain passing.

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

Current bounded construction supports ordinary column declarations; ordered default-expression indexes; not-null (including `build.c`'s implicit NOT NULL for WITHOUT ROWID primary-key columns), unique, collation and primary-key column metadata; generated expressions with stored/virtual state; explicit-index uniqueness/origin and per-term collation/sort/null-order metadata; views; and WITHOUT ROWID declared-primary-key storage mapping. CHECK and REFERENCES/FOREIGN KEY declarations are retained from generated reductions as ordered immutable read-schema nodes, including expression/source, local/referenced columns, linked target tables, actions, and deferral metadata (`parse.y`, `build.c:sqlite3AddCheckConstraint/sqlite3CreateForeignKey/sqlite3DeferForeignKey`). Column-level REFERENCES associates the generated following `ccons ::= defer_subclause` sibling with its FK; `NOT DEFERRABLE INITIALLY DEFERRED` remains immediate. Automatic indexes beyond supported primary-key layouts, triggers, virtual tables, and further recognized grammar consumers
report explicit temporary unsupported errors; malformed row shape/type/text/root/link/DDL reports schema
corruption. They are backlog, not permanent exclusions, and are never silently
skipped. The all-encoding rich-constraint path is checked by both the immutable
TS loader and the source-ID-verified pinned 3.53.4 library. The public Chinook
Fetch fixture is provenance-bound to 1,007,616 bytes and SHA-256
`7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`;
its floating GitHub URL is not itself compatibility evidence. The loader does not execute user DDL and does not reopen or copy the
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
| Function lookup/name/arity and staged dispatch | `src/callback.c:matchQuality`; registrations/macros in `src/func.c:aBuiltinFunc` and `src/sqliteInt.h`; call-context opcode choice in `src/vdbeaux.c:sqlite3VdbeAddFunctionCall` | `src/internal/functions.ts` immutable 50-row profile registry; `test/conformance/run-ordinary-scalar-foundation-ts.mjs` exact name/arity, flags, ordinary-SELECT `Function` lowering and registered-but-not-dispatchable diagnostics |
| CAST, comparison, CollSeq, lazy control and calls | `src/vdbe.c`: `OP_Add`…`OP_Remainder`, `OP_CollSeq`, `OP_Cast`, `OP_Eq`…`OP_Ge`, `OP_If`/`OP_IfNot`, NULL branches, `OP_Function`/`OP_PureFunc` | captured typed rows/errors and short-circuit companion |
| Function bodies and shared values | `src/func.c`: `minmaxFunc`, `typeofFunc`, `lengthFunc`, `bytelengthFunc`, `absFunc`, `substrFunc`, `nullifFunc`, `replaceFunc`; `src/vdbemem.c`, `src/util.c`, `src/utf.c` | exact `func-1.4/1.6/1.7/1.8`, `2.0`, `4.4.1/4.4.2`, `6.3`-`6.5`; no-credit embedded-NUL/CollSeq fixture |

The no-credit boundary capture `test/conformance/cases/stage3-expression-function-boundaries.json` maps encoding conversions to `utf.c`/`vdbemem.c`, size enforcement to `sqlite3_result_error_toobig` and function result allocation paths, progress interruption to VDBE progress/interrupt checks, and callback result/destructor ordering to `sqlite3_context`/function teardown. It is development provenance only; it does not authorize host registration in the product API.

Boundary refinement: result-value destructor observations map to `sqlite3_result_text` ownership and `sqlite3VdbeMemRelease` paths on replacement/reset/finalize; the `sqlite3_create_function_v2` application destructor at connection close is recorded separately and must not be used as evidence for result-Mem cleanup. Since the C destructor is `void`, secondary cleanup-error precedence is a jsqlite2 function-context invariant rather than a native observable. Cancellation capture installs `sqlite3_progress_handler` after prepare and observes `SQLITE_INTERRUPT` from step.

| Stage 3 bounded expression/scalar execution | `src/internal/parse.ts`, `src/internal/vdbe.ts` | `expr.c:sqlite3ExprCodeTarget`, `resolve.c:resolveExprStep`, `vdbe.c:OP_Function/OP_Cast/comparisons`, `func.c:sqlite3RegisterBuiltinFunctions`, `vdbemem.c` | `test/conformance/cases/stage3-expression-functions.json`, `run-expression-functions-ts.mjs` (40 selected cases) |

| `src/vdbe.c` `OP_Function` result-error/cleanup path; `src/vdbeInt.h` `sqlite3_context`; `src/vdbemem.c` release; `src/vdbeapi.c` auxdata replacement | `src/internal/vdbe.ts` `FunctionContext`, `runFunctionContext`; `test/conformance/run-expression-function-cleanup-ts.mjs` | Shared result and aux-state ownership, replacement/final cleanup, and first-error identity. Ordinary calls emit `Function`; `PureFunc` is selected only by a nonzero special call context, not merely by a CONSTANT registration. |
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
compounds and subqueries; current bounded compounds and represented FROM-subqueries
are implemented as mapped below. Ordinary single-table DISTINCT now derives its
membership `KeyInfo` from each resolved result descriptor, so direct columns retain
declared collation while explicit result COLLATE overrides it. Shared byte-counted
`compareBuiltinText` keeps BINARY case and embedded-NUL suffix distinctions.

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

## Historical multi-source SELECT / join architecture handoff ([[card:card-k-a]]; implementation status revised below)

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

### Historical LEFT JOIN / NullRow initial execution mapping ([[card:card-k-d]], 2026-09-17)

- `src/where.c` `iLeftJoin`/`OP_IfPos` unmatched control ->
  `src/internal/vdbe.ts:compileInnerTableSelect` per-RHS match registers and one
  empty/depleted-RHS fallback through the normal joined-row body.
- `src/vdbe.c:OP_NullRow` plus `OP_Column`/`OP_Rowid` -> `NullRow` clears the
  cursor's decoded-record state; shared Column/Rowid owners consequently return
  Mem NULL without a fabricated host row. ON/USING runs before the match marker;
  WHERE remains at the innermost body after NULL extension.
- `test/conformance/multisource-left.test.mjs` compares the pinned 3.53.4
  unmatched, ON-placement, and WHERE-placement cases through the public API.
  This focused repair does not claim the complete 47-case outer-join gate.

#### Historical LEFT completed bounded evidence ([[card:card-k-d]]; RIGHT/FULL status superseded below)

- `src/where.c` `iLeftJoin`, `OP_IfPos`, `OP_NullRow` -> per-left-level match
  register and exactly-once unmatched branch in `compileInnerTableSelect`.
- `src/vdbe.c` `OP_NullRow`, `OP_Column`, `OP_Rowid` -> cursor-owned absent record
  and shared Mem NULL reads in `VdbeStatement`.
- `test/conformance/multisource-left.test.mjs` -> pinned/public capture cases and
  bounded all-encoding, value, composition, destination, restart, and failure-path
  checks. RIGHT/FULL mappings are intentionally not claimed.

### Historical RIGHT/FULL bounded execution mapping ([[card:card-k-e]], 2026-09-17; scope corrected below)

- `wherecode.c:sqlite3WhereRightJoinLoop`, `WhereRightJoin` -> terminal-barrier RHS
  rowid match tracking in `EphemeralIndexCursor`, original-RHS rescan, left cursor
  `NullRow`, and relocated interior VDBE continuation in
  `src/internal/vdbe.ts:compileInnerTableSelect`; state uses the shared
  `PrivateStateByteBudget` and reset/finalize cleanup.
- `resolve.c:lookupName` FULL `pFJMatch` -> result lowering reads merged source
- `resolve.c:lookupName` / linked `NameContext.pNext` maps to transient `NameContext` frames in `src/internal/resolve.ts`. Generated nested `Select` nodes are resolved structurally, ambiguity terminates at the first matching level, outer hits set per-select correlation, and one statement-wide monotonic cursor allocation prevents sibling/deep nested collisions. Focused resolver coverage includes lexical shadowing, two-level outward lookup, ambiguity/missing/width errors, and sibling cursor identity; public singular-Fetch coverage promotes those exact prepare errors across all three encodings.
  columns in source order with `NotNull`; qualified columns retain direct metadata.
- `test/conformance/multisource-right-full.test.mjs` credits 7/13 immutable
  RIGHT/FULL-bearing cases plus reset/rebind and cancel/deadline/work/private-limit
  companions. Non-terminal downstream continuations and multi-left merged
  USING/NATURAL wildcard values remain explicit atomic gates, not claimed mappings.

## Historical 2026-09-17 RIGHT/FULL completion revision (scope corrected below)

- `src/internal/resolve.ts` → `select.c:sqlite3ProcessJoin`, `resolve.c:lookupName`: RIGHT/FULL USING/NATURAL merged owner and ambiguous-left USING diagnostic.
- `src/internal/vdbe.ts` → `wherecode.c:sqlite3WhereRightJoinLoop`, `where.c:sqlite3WhereEnd`: RHS rowid match set, left NullRow, original RHS unmatched scan, and shared downstream continuation. Forward target finalization before copying is the TS opcode-array equivalent of native label resolution.
- `test/conformance/multisource-right-full.test.mjs` → all 15 RIGHT/FULL-adjacent pinned stage-3 manifest cases plus encoding and lifecycle/resource probes.

## Repeated RIGHT/FULL barrier boundary (2026-09-17, current)

Pinned `wherecode.c:sqlite3WhereRightJoinLoop` has `WhereRightJoin` state per `WhereLevel`. `compileInnerTableSelect` currently has one match cursor/key/unmatched pass; therefore >1 barrier is atomically prepare-gated rather than partially translated. `multisource-right-full.test.mjs` covers repeated RIGHT, repeated FULL, mixed barriers, downstream join, and WHERE gate shapes. This corrects the scope of the earlier 15-case mapping.

## Aggregate/GROUP/HAVING pre-implementation gate (SQLite 3.53.4)

| Concern | Pinned implementation/test evidence | Project evidence/status |
|---|---|---|
| classification/resolution | `src/sqliteInt.h` `Expr`/`Select`/`AggInfo`; `src/resolve.c:resolveExprStep`, aggregate depth and `NC_AllowAgg`/`NC_HasAgg` | Frozen architecture in `docs/TRANSLATION.md`; runtime not implemented |
| analysis/lowering/lifecycle | `src/select.c:analyzeAggregate`, `resetAccumulator`, `updateAccumulator`, `finalizeAggFunctions`, GROUP/HAVING branches; `src/expr.c` `TK_AGG_FUNCTION`; `src/vdbe.c` `OP_AggStep`/`OP_AggInverse`/`OP_AggValue`/`OP_AggFinal` | Planned AggInfo owner, statement-owned Mem/context, shared execution-wide `PrivateStateByteBudget`; no algorithm substitution |
| built-ins | `src/func.c:countStep`, `sumStep`, `sumFinalize`, `avgFinalize`, `totalFinalize`, `minmaxStep`, `groupConcatStep`/`Inverse`/`Value`/`Finalize` | count/sum/avg/total/min/max/group_concat admitted; later-window-compatible callback seam |
| source tests | `test/aggfunc.test`, `groupby.test`, `select1.test`, `filter1.test`, `distinctagg.test`, `minmax.test` (exact pinned tree) | Bounded public/native matrix derives empty/type/overflow/group/HAVING/alias/bare-minmax/DISTINCT/FILTER/order/collation/composition/error cases; it is not a claim that all upstream assertions are translated |
| executable evidence | manifest + immutable fixture catalog hashes | Historical pre-implementation checkpoint: `stage3-aggregate-group.spec.json` -> `capture-aggregate-group.py` -> `stage3-aggregate-group.json`; the then-current public gate was intentionally red at 37 native captures and 0 TS credit. Current accounting is recorded in the aggregate-local modifier section below. |

### Aggregate contexts and first non-grouped route

| TypeScript owner | Pinned SQLite 3.53.4 source | Status/evidence |
|---|---|---|
| `src/internal/vdbe.ts` aggregate resolution, AggInfo-like entries, `AggStep`/`AggFinal` | `src/resolve.c` function classification; `src/select.c` aggregate analysis/lowering; `src/vdbe.c` `OP_AggStep`/`OP_AggFinal`; `src/vdbeapi.c` aggregate context | Translated for one-table/no-FROM, optional-WHERE, non-grouped aggregates. Shared Mem/VDBE expression path; no host reductions. |
| `aggregateStep`/`aggregateFinal` | `src/func.c` `sumStep`, `sumFinalize`, `totalFinalize`, `avgFinalize`, `countStep`, `minmaxStep`, `groupConcatStep` and finalizers | Core empty/NULL, int64/REAL, collation, and text behavior covered by tagged public oracle cases. |
| Aggregate state budgeting/cleanup | `src/vdbemem.c` aggregate Mem release; `src/vdbe.c` halt/reset/finalize | Aggregate retained bytes use execution-owned `PrivateStateByteBudget`; Mem cleanup is exercised by public reset/finalize. |

### GROUP expression-identity correction (2026-09-17)

| TypeScript owner | Pinned SQLite owner | Current evidence/boundary |
|---|---|---|
| `src/internal/vdbe.ts:selectHasAggregate`, `simpleGroupShape`, generated `Expression` comparison | `src/resolve.c:resolveExprStep`, `resolveOrderGroupBy`; `src/select.c:sqlite3Select` | Aggregate calls and GROUP/result/ORDER identity are derived from generated expression reductions, not token-name regexes or joined spellings. Public adversarial tests cover aliases, scalar wrappers, qualification, COLLATE, and atomic alias-collision rejection. Manifest accounting remains 11/32 credited. |

| Grouped HAVING lowering | `src/resolve.c:lookupName/resolveAlias`; `src/select.c:finalizeAggFunctions` and HAVING branch | `src/internal/vdbe.ts` substitutes result aliases only absent a source-column owner, lowers HAVING aggregates into shared accumulator registers, and emits `IfNot` after `AggFinal`; focused public alias filtering passes, while manifest credit waits for its dependent aggregate-result ORDER destination. |

| GROUP collation and wrapped ORDER identity | `src/select.c` GROUP sorter `KeyInfo`; `src/expr.c:sqlite3ExprCollSeq`; `src/vdbeaux.c:sqlite3MemCompare` | Group keys retain resolved NOCASE/BINARY/RTRIM in shared `KeyInfo`; generated `ORDER BY group-expression COLLATE ...` identity is admitted without token reconstruction. Pinned `collation-group` public rows/metadata are credited; aggregate gate is 12/32. |

| Grouped HAVING parameters/reset | `src/vdbe.c:OP_Variable`, `sqlite3VdbeReset`; `src/select.c` HAVING after aggregate finalization | Generated HAVING `Variable` runs after `AggFinal`; public bind/exhaust/reset/rebind compares both pinned row sets and exercises ordinary sorter/aggregate cleanup. Aggregate gate: 13/32. |

| Finalized GROUP result destination | `src/select.c:sqlite3Select` aggregate finalization/HAVING and `selectInnerLoop`; sorter ORDER/LIMIT branches | `src/internal/vdbe.ts` sends finalized projected groups to a shared-budget result sorter with resolved result indexes, direction/collation/NULL flags, top-N and output OFFSET/LIMIT. Pinned HAVING ORDER/LIMIT and metadata cases pass; gate 17/32. |
| Grouped inner-join input | `src/select.c:sqlite3Select` aggregate GROUP sorter fed inside `sqlite3WhereBegin`/`sqlite3WhereEnd` loop | `src/internal/vdbe.ts` emits cursor-qualified nested loops and ON/WHERE branches into GROUP sorter insertion; columns carry distinct physical and flattened payload indexes. `join-group-valid` exact oracle case passes. |
| Aggregate UNION ALL destination | `src/select.c:multiSelect` UNION ALL arm destinations and ORDER BY sorter | `src/internal/vdbe.ts` compiles aggregate arm programs, relocates their branches, redirects ResultRow to one shared sorter, then drains it. Bounded to parameter-free UNION ALL ordered by first output. |

## Grouped result DISTINCT and lifecycle ([[card:card-l-c]], 2026-09-17)

| Pinned SQLite 3.53.4 owner | TypeScript owner | Evidence / boundary |
|---|---|---|
| `src/select.c` aggregate output / `SRT_DistFifo`-style distinct destination | `compileAggregateSelect()` in `src/internal/vdbe.ts`: finalized projection, `Found`, `IdxInsert`, then result sorter/output | `test/conformance/aggregate-group-lifecycle.test.mjs`; SELECT-level DISTINCT only |
| `src/vdbe.c` ephemeral/sorter cleanup and abort paths | `VdbeStatement` plus `SorterCursor` / `EphemeralIndexCursor` and one `PrivateStateByteBudget` | cancellation, deadline, work/private limits, reset/finalize, first-error and admission tests |
| `src/resolve.c` source name before GROUP result alias fallback | aggregate `resolve()` then guarded `aliasExpression()` | immutable `alias-group-resolution`, aggregate gate 20/32 |
| `src/build.c:sqlite3CreateIndex` implicit PRIMARY KEY index construction during schema initialization | `src/internal/schema.ts:loadSchemaGraph` bounded NULL-SQL index branch | Reconstructs only `sqlite_autoindex_<table>_1` for one non-INTEGER rowid-table PRIMARY KEY from parsed declaration plus validated root page; schema tests execute UTF-8/16le/16be. Composite, UNIQUE, WITHOUT ROWID, later ordinal and other implicit layouts remain atomic temporary gates. |

Aggregate-local DISTINCT/FILTER/ORDER remains [[card:card-l-d]] scope. All three database encodings execute the grouped result-DISTINCT companion.
Only the source-shaped single-column PRIMARY KEY autoindex needed by those pinned
fixtures is admitted; other automatic-index layouts remain gated.

## Aggregate-local modifiers ([[card:card-l-d]], 2026-09-17)

| Pinned SQLite 3.53.4 owner | TypeScript owner | Evidence / boundary |
|---|---|---|
| `src/select.c:updateAccumulator`, `finalizeAggFunctions` (`iDistinct`, `iOBTab`, FILTER branch, ordered replay); `src/parse.y:918-934` per-item `sortorder`/`nulls` | `src/internal/vdbe.ts:aggregateParts` preserves each generated `sortlist` item; `compileAggregateSelect`, VDBE `Found`/`IdxInsert`, sorter replay and group-boundary clears | `run-aggregate-group-ts.mjs`: 30/34 exact public tagged native-success cases from 39 native captures; mixed ASC/DESC and nullable mixed NULLS FIRST/LAST cases prove per-item flags; remaining 4 need FROM subqueries; 5 prepare errors compare exactly |
| `src/func.c` count/sum/total/avg/min/max/groupConcat callbacks | `aggregateStep`/`aggregateFinal` with aggregate-capable `Mem` context | DISTINCT/FILTER/order and ordinary aggregation; represented aggregate-window execution is mapped separately below. This aggregate-registry row does not describe the special built-ins, whose current mapping is in the later special-window section. |
| `src/vdbe.c` ephemeral/sorter lifetime | `SorterCursor.clear`, `EphemeralIndexCursor.clear`, shared `PrivateStateByteBudget` | Per-group state is released before the next group; reset/finalize/error retain common cursor cleanup |

### Compensated aggregates and callback context correction ([[card:card-l-b]], 2026-09-17)

| Pinned SQLite 3.53.4 owner | TypeScript owner | Evidence / boundary |
|---|---|---|
| `src/func.c` `SumCtx`, `kahanBabuskaNeumaierStep`, `kahanBabuskaNeumaierStepInt64`, `kahanBabuskaNeumaierInit`, `sumStep`, `sumFinalize`, `avgFinalize`, `totalFinalize` | `src/internal/vdbe.ts` `SumCtx`, KBN helpers, `sumStep`, `sumResult`; exact int64 branch plus compensated REAL/error state | `test/conformance/aggregate-sum-context.test.mjs`: public cancellation, large-int split, overflow/REAL transition, final class and overflow diagnostics |
| `src/sqliteInt.h` `FuncDef`; `src/vdbe.c` `OP_AggStep`/`OP_AggValue`/`OP_AggFinal`; `src/vdbeapi.c` aggregate context/result APIs | `AggregateDefinition`, `AggregateFunctionContext`, `AggregateContext`, registry dispatch; aggregate-capable `Mem` remains state owner | `test/conformance/aggregate-context-opcodes.test.mjs` proves repeated non-destructive `AggValue`; optional `inverse`/`value` slots do not admit windows |

### 2026-09-17 aggregate retained-state correction ([[card:card-l-d]])

| Pinned owner | TypeScript owner | Evidence / boundary |
|---|---|---|
| `src/func.c:minmaxStep`, `minMaxValueFinalize`, `groupConcatStep`; `src/vdbe.c:OP_AggStep`, `OP_AggFinal` cleanup | `src/internal/vdbe.ts:extremaDefinition`, `concatDefinition`, `AggregateContext`; shared `PrivateStateByteBudget` | Extrema TEXT/BLOB replacement reserves the positive complete-byte delta before copy, preserves the prior winner on failure, releases shrink deltas after commit, and releases retained bytes through aggregate `Mem` cleanup. Concat growth rolls reservation back if part insertion fails. `aggregate-group-lifecycle.test.mjs` covers extrema initial/replacement/reset/finalize/failure and aggregate-local DISTINCT/ordered queue byte-failure cleanup. Host OOM remains outside the catchable contract; SQL scope/accounting is unchanged. |

## Subquery/view pre-implementation contract ([[card:card-m-a]], 2026-09-17)

| Pinned SQLite 3.53.4 owner | Planned existing-project owner | Contract / evidence |
|---|---|---|
| `src/select.c:selectExpander`, `flattenSubquery`, `fromClauseTermCanBeCoroutine`, `sqlite3Select` | generated `Select`/`SourceList`, `src/internal/schema.ts`, `src/internal/resolve.ts`, `src/internal/vdbe.ts` | Expand immutable view/derived SELECT, linked resolve, guarded flatten, otherwise coroutine or typed materialization. `stage3-subquery-view.{spec,json}` derived/view/composition cases; no TS credit yet. |
| `src/resolve.c:lookupName`, linked `NameContext.pNext`/`nRef` | `src/internal/resolve.ts` linked contexts and source identity | Innermost-level lookup, ambiguity before outer traversal, structural correlation, width/missing errors at prepare. Scope/error cases in the immutable artifact. |
| `src/build.c:viewGetColumnNames` / `sqlite3ViewGetColumnNames` | `src/internal/schema.ts` plus expansion-owned transient columns | Explicit/inferred view names, affinity/collation and origin metadata; schema remains immutable. View and metadata cases are native-only. |
| `src/expr.c:sqlite3CodeSubselect`, `sqlite3FindInIndex` callers | `src/internal/vdbe.ts` scalar/EXISTS destinations; `EphemeralIndexCursor`, `KeyInfo`, `Mem` | First-row scalar/empty NULL, EXISTS integer, correlated rerun, Once for uncorrelated, and four-state IN/NOT IN NULL/empty behavior. No JS collection equality. |
| `src/vdbe.c:OP_Gosub`, `OP_Return`, `OP_InitCoroutine`, `OP_Yield`, `OP_EndCoroutine`, `OP_Once` | existing opcode array/register file and `VdbeStatement` | Non-overlapping result/return registers; pc exchange survives suspension; reset/finalize/close clear nested state once. Planned mapping, not implemented. |
| `test/subquery.test`, `in.test`, `select1.test`, `select4.test`, `select6.test`, `select7.test`, `with1.test`, `window1.test` | `test/conformance/cases/stage3-subquery-view.spec.json`, capture script and immutable JSON | 46/46 native captured, plus 15 separate future companions; TS attempted/credited 0/0. Upstream labels are exact canonical assertion identifiers; SQL is a documented bounded fixture adaptation. Four aggregate 30/34 blockers are included. CTE/recursive/window are atomic future gates. |

All nested retained state shares the existing execution-wide
`PrivateStateByteBudget`; all nested opcodes share work/cancel/deadline state.
Defaults remain expression depth 1000, parser depth 2500, work 10,000,000,
private bytes 256 MiB, 100,000 entries and 16 MiB/key. Configured-small boundary
and cleanup tests are required before any runtime credit.

### Subquery/view review revision ([[card:card-m-a]])

`docs/TRANSLATION.md` now maps every
`fromClauseTermCanBeCoroutine` condition (1a--c, 2a--b, 3--5) to retained source
order/join/CTE/flag/view-identity facts, with unknown facts conservatively selecting
non-coroutine. It also maps `tag-select-0482` coroutine, 0484 reusable CTE, 0486
self-joined view `OpenDup`, and 0488 correlated/Once materialization. Native plan
discriminators, expanded view schema/collation cases, 15 executable future
lifecycle/resource companions, and hashed assertion/source provenance live in
`stage3-subquery-view*.spec.json`; the validator enforces them. TS credit remains
0/0.

### Allocated FROM-derived/view runtime promotion ([[card:card-m-f-g]])

| Pinned SQLite 3.53.4 source | TypeScript mapping | Evidence / boundary |
| --- | --- | --- |
| `src/select.c:flattenSubquery`, `substSelect`, `selectExpander` | `src/internal/parse.ts`, `resolve.ts`, `vdbe.ts` guarded derived/view expansion, predicate substitution, metadata preservation | 15 allocated derived/view IDs × 3 encodings; exact rows and five metadata fields |
| `src/select.c:fromClauseTermCanBeCoroutine`, tags 0482/0484 | `compileDerivedProducer`, VDBE `InitCoroutine`/`Yield`/`EndCoroutine` | opcode route tests plus suspension/reset, work, cancellation and deadline evidence |
| `src/select.c` tags 0486/0488; `src/vdbe.c:OP_Once`, `OP_Gosub`, `OP_Return`, `OP_OpenDup` | `src/internal/vdbe.ts:compileRepeatedImmutableView` resolves the bounded physical-table view body and calls `compileInnerTableSelect` with the parent `SelectProgramBuilder`/ephemeral `SelectDest`; one fill, independently positioned duplicate reader, parent LIMIT/OFFSET after producer LIMIT | `select-repeated-view-parent-native.py`, `.test.mjs`, `-builder.test.mjs` typed rows/names/error/reset/limits and no finished-child PC relocation; other view bodies and pinned first-view coroutine plan remain unmapped |
| `src/select.c:multiSelect` result destinations; aggregate `updateAccumulator`/ordered replay | bounded compound-derived result redirection into shared aggregate/sorter opcodes | four aggregate blockers exact in three encodings; overflow finalize code and aggregate-local sorter shared-byte differential |
| `src/resolve.c:lookupName` nested `NameContext` | linked nested SELECT/allocated persisted-view `EXISTS` resolution | allocated `view-correlated` only; no general scalar/EXISTS/IN claim |

Manifest accounting is 46 native captured, 19 TS attempted/credited. Public
matrix accounting is 57/57 and companion route/resource accounting is 20/20.
At this historical FROM-derived/view checkpoint, CTE, recursive CTE, windows,
unmatched derived shapes, and unrepresented general aggregate-over-derived forms
rejected before execution. The ordinary/recursive WITH mappings below supersede
that CTE status.

### Expression-subquery lowering completion ([[card:card-m-f-k]])

| Pinned SQLite 3.53.4 source | TypeScript mapping | Evidence / boundary |
| --- | --- | --- |
| `src/expr.c:sqlite3CodeSubselect`, `sqlite3FindInIndex` (`pParse->nTab++`), `EP_VarSelect`, `SRT_Mem`, `SRT_Set`; `src/vdbe.c:OP_OpenRead`, `OP_Rewind`, `OP_Next`, `OP_Once` | `src/internal/resolve.ts` linked nested `NameContext`; `src/internal/vdbe.ts:compileExpressionSubquery`, parent-VDBE-unique nested read-cursor relocation, `Once`, typed ephemeral set, scalar destination and per-row correlated rerun/clear | `subquery-view-foundation.test.mjs`: exact public scalar/EXISTS/IN behavior across all three encodings, retained correlated IN/NOT IN reset/rerun case, direct uncorrelated Once versus correlated no-Once opcode assertion, and outer/inner table cursor-collision regression with multirow, empty, NULL and reset paths |
| `src/expr.c:sqlite3CodeSubselect` (`SRT_Mem`, correlated parent Parse/VDBE); `src/where.c` equality-join probe control | `src/internal/vdbe.ts:compileScalarSelect` aggregate-child register/cursor/destination relocation; `compileAggregateSubquery` joined correlated `EXISTS` with outer-independent typed key materialization and per-row outer probe for `=`/`==`, retaining NULL-safe `IS` on the generic correlated loop | `expression-subquery-chinook.test.mjs`, `expression-subquery-composition.test.mjs`, `expression-subquery-chinook-native.py`: A1 independent/correlated aggregate destinations and B4 joined correlation, including the all-encoding `IS NULL` discriminator, exact metadata/result, reset, limits, first-error cleanup and fresh manifest-source oracle |

The admitted expression SELECT shapes share the parent program's registers, work
and private-state budgets. Unsafe width, compound, grouping and unsupported local
aggregate forms retain atomic prepare-time gates rather than partial execution.

## Expression-subquery completion and compound ORDER identity (2026-09-17)

- `src/internal/vdbe.ts` maps scalar/EXISTS/IN destination-aware lowering and ordered bounded compound production to `src/select.c` (`sqlite3Select`, `multiSelect`, `multiSelectOrderBy`, `computeLimitRegisters`) while retaining one parent VDBE's work/private-state owner.
- Compound ORDER term ownership maps to `src/resolve.c` `resolveCompoundOrderBy` / `sqlite3ResolveOrderGroupBy`: ordinal, resolved result alias, then generated expression-structure comparison. The translation no longer compares joined token text. Explicit COLLATE is ignored for expression identity and retained for sorter KeyInfo; resolved column identity tolerates equivalent qualification/spelling while preserving column index when known.
- `test/conformance/subquery-view-foundation.test.mjs` covers all encodings, bounded scalar subqueries in both compound arms, equivalent parenthesized spelling plus COLLATE, quoted/case-varied alias ownership, and destination-aware lowering. Companion accounting is indivisible 15/15. CTE/recursive/window/unsafe atomic gates remain covered.

- **Compound ORDER ownership review repair (2026-09-17):** the direct-table
  `compileSimpleTableCompound` route now shares the generated-expression identity
  rule used by scalar compounds after ordinal/alias precedence, mapping pinned
  `resolve.c:resolveCompoundOrderBy` rather than comparing token text. Explicit
  COLLATE remains KeyInfo metadata while decoration, parentheses, qualification,
  identifier quoting/case do not define ownership. The public table-compound
  discriminator in `test/conformance/compound-union-all.test.mjs` protects the
  destination-aware table-arm handoff.

## Historical CTE source-model foundation ([[card:card-n-a]], 2026-09-18; superseded below)

This table records the pre-execution architecture checkpoint. Its “planned” and
“no TS execution” cells are retained as history; the ordinary and recursive
tranche tables below are the current implementation and evidence mapping.

| Pinned SQLite 3.53.4 owner | Current/planned TypeScript owner | Evidence and boundary |
| --- | --- | --- |
| `src/parse.y:609-621,1955-1973` WITH/select attachment, `wqlist`, `wqitem`, aliases, `M10d_Any/Yes/No` | `src/internal/parse.ts` generated reduction actions and immutable `SelectNode.with` / `WithClause` / `CteNode` | parser tests cover ordered items, recursive marker, aliases, hints, nested Select ownership, freezing, ASCII-case duplicate diagnostic |
| `src/sqliteInt.h:3597-3620,4462-4514` `Select.pWith`, `With`, `Cte`, `CteUse` including `addrM9e` | immutable authored graph now; planned transient `WithScope` and one lazy prepare-lifetime `CteUse` per successfully resolved declaration | unused declarations allocate none; prepare context map owns declaration→use, resolved sources/rewrites share identity, semantic `materializationAddress` maps to `addrM9e`; use state not yet implemented |
| `src/select.c:5610-5880,6000-6030,6388` `searchWith`, push/pop, `resolveFromTermToCte`, recursive diagnostics | `src/internal/admission.ts` graph-complete temporary gate now; planned expansion in `resolve.ts`/compiler before ordinary `NameContext` expression resolution | cycle-safe root, expression-subquery, derived, compound-arm and schema-view traversal after schema load; owning WITH discovery short-circuits before body traversal. Innermost shadowing, outer fallback, lazy shared-use allocation, schema-qualified bypass and recursive diagnostics remain planned |
| `src/select.c:7275-7276,7797-8020` coroutine/materialization/reuse branches | planned `vdbe.ts` producer/materialization routes using shared `CteUse` | no TS execution or route credit yet |
| `src/vdbe.c` `InitCoroutine`/`Yield`/`EndCoroutine`, `OpenEphemeral`/`Rewind`/`RowData` and recursive SELECT queue destinations in `select.c` | existing typed coroutine/ephemeral primitives plus future bounded recursive queue | no recursive JS evaluator; one statement's work/cancel/deadline/private-state owners |
| `test/with1.test`, `test/with2.test` | `stage3-cte-architecture.{spec,json}`, capture and validator | 14 credited logical cases + 3 no-credit companions × UTF-8/16le/16be = 51 pinned native executions; TS 0/0. Pin has no `test/with.test`. |

Verified pinned hashes: `parse.y` `19628d51...3185`, `sqliteInt.h`
`3846e622...cc3`, `select.c` `bdf052a3...3408`, `resolve.c`
`0ab2b579...7107`, `vdbe.c` `d92cb9c4...ca1d`, `with1.test`
`02524973...092`, and `with2.test` `9f83b8c7...427` (full hashes remain
machine-verifiable from the pinned tree/spec). `src/index.ts` loads schema and calls `selectGraphContainsWith()` before all ordinary lowering. `test/conformance/cte-admission.test.mjs` covers scalar/EXISTS/IN, retained and flattening-adjacent derived, compound-arm and persisted-view ownership in UTF-8/16le/16be, exact diagnostics, close-without-residue and reuse. That architecture checkpoint's public claim was temporary prepare-time unsupported; the ordinary and recursive mappings below supersede it without retroactively granting execution credit.

## Ordinary WITH tranche (2026-09-18)

| Pinned SQLite 3.53.4 source | TypeScript mapping | Evidence / credit |
|---|---|---|
| `select.c`: WITH scope push/pop and `resolveFromTermToCte`; `sqliteInt.h`: `CteUse` | `src/internal/cte.ts`, `SourceList.cteDerived` in `src/internal/parse.ts` | Public TS: `test/conformance/cte-execution.test.mjs` and `cte-admission.test.mjs` in UTF-8/UTF-16LE/UTF-16BE, including represented derived/view ownership, no caller capture, nested shadowing and outer fallback (`with1` 3.4/3.5; applicable `with2` 1.6/1.7), schema-qualified bypass (`with2` 1.8), mixed CROSS JOIN, grouped aggregate, and UNION ALL composition. Native credit remains the card-n-a oracle manifest only; focused public companions are not relabeled native. |
| `select.c`: coroutine eligibility and materialization (`addrM9e`/shared use), duplicate ephemeral cursor | `compileDerivedProducer` and `compileCteDerivedSources` in `src/internal/vdbe.ts` | Public TS covers one-use coroutine, two declarations, repeated-use one-fill/`OpenDup`, and `MATERIALIZED`; an internal production-opcode discriminator additionally proves repeated compound-arm `NOT MATERIALIZED` uses two coroutine routes without ephemeral/OpenDup. Existing FROM-derived lifecycle tests are internal/public companion evidence. |
| `select.c` recursive-owner recognition before recursive queue lowering | `recursiveCteOwner` pre-lowering dispatch in `src/internal/cte.ts` / `src/index.ts` | **Historical ordinary-WITH checkpoint (superseded by the recursive mapping below):** this row carried no queue execution credit and self-reference then had a dedicated temporary prepare error. Current represented self-reference dispatches to iterative queue compilation; ordinary declarations under a RECURSIVE marker also execute. Expression-owned nested ordinary WITH retains its distinct general CTE temporary residual assertion. |

### Revision 2026-09-22 — A2 ordinary scope/composition and aggregate destination

| Pinned SQLite 3.53.4 semantic owner | TypeScript mapping | Adaptation, evidence, and boundary |
|---|---|---|
| `select.c:sqlite3WithPush`, `searchWith`, `resolveFromTermToCte`, `sqlite3SelectPopWith`; `sqliteInt.h:Cte/CteUse` | `src/internal/cte.ts` scope/use graph and `compileCteDerivedSources`/`compileDerivedProducer` | Statement-local nesting/shadowing, aliases, multiple and reused declarations, joins/subqueries/views, and represented grouped ordinary producers compose through shared compiler/VDBE state. Reuse is statement-private materialization/coroutine adaptation, not host evaluation. Public companion evidence is separate from the pinned recursive manifest. |
| `select.c:generateWithRecursiveQuery` destination handoff and aggregate `sqlite3Select`/`AggInfo`; `vdbe.c` `AggStep`/`AggFinal` | `compileRecursiveAggregateSelect` composes `compileRecursiveCteSelect(..., producerOnly=true)` with the existing VDBE aggregate op family | Exact admission: one outer ungrouped `sum(direct-column)` over one recursive producer. Queue PC/register/cursor/private state and controls remain in one iterative Program. Public all-encoding A2 evidence verifies metadata `sum(x)`, INTEGER 55, row then DONE; it is not upstream/native credit. Outer GROUP BY/HAVING, aggregate modifiers/expressions, multiple/reused recursive aggregate owners, and other untranslated compositions reject temporarily. |

| SQLite 3.53.4 source | TypeScript translation | Evidence / residual |
|---|---|---|
| `src/select.c:generateWithRecursiveQuery` and recursive destination routing | `compileRecursiveCteSelect`, bounded `compileMultipleRecursiveCtes`; `OpenFifo`/`FifoInsert`/`FifoShift`; `OpenPriorityQueue`/`PriorityInsert`/`PriorityShift`; typed sorter materialization | Multiple recursive queue producers now emit into the enclosing SelectProgramBuilder and a zero-key sorter destination directly, each with its own queue/cursor and forward break label. No completed child opcode/PC/register/cursor rebasing or Halt rewriting in this caller. `selectInnerLoop` destination is chosen before emitting producer rows; VM `SorterInsert` still owns insertion and execution budget. Public recursive conformance: FIFO, all-history UNION, ORDER priority, LIMIT/OFFSET, 20k iterative/lifecycle/control stress, plus two distinct recursive declarations composed through a direct-projection cross join and output ORDER BY with source-shaped explicit collation/direction/NULL flags; zero-field stable key does not compare payload values. Source-ID-checked `recursive-oracle/oracle.py` confirms typed INTEGER output and reset on a cross-join ORDER control. Broader/reused consumers reject temporarily; other fallback completed-child callers remain live. |
| `src/select.c:resolveFromTermToCte` recursive CteUse branches | recursive pre-emission validation and generated-semantic nested-reference walk | Exact width, circular, direct multiple, nested multiple, aggregate/window prepare diagnostics. |
| `src/vdbe.c` ephemeral cursor lifecycle/control loop | `FifoCursor`, `PriorityQueueCursor`, shared private budget, `VdbeStatement.#halt/#privateControl` | reset/rebind/finalize/error/cancel/deadline/work/yield state retained in one VM. |

## Window-function pre-implementation map ([[card:card-o-a-a]], 2026-09-18)

Pinned identity: SQLite 3.53.4 / source id
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
This map is progressive architecture only: current TypeScript window attempted and
credited execution counts are **0/0**. The current generated parser/compiler has no
admitted Window graph/lowering, so window statements remain atomic unsupported
prepare outcomes. Existing aggregate, subquery/view and ordinary/recursive CTE
claims are unchanged.

| Pinned owner | Exact source responsibility | Planned project owner / gate |
|---|---|---|
| `src/parse.y`: `filter_over`, `over_clause`, `window_clause`, `windowdefn[_list]`, `window`, `frame_opt`, `range_or_rows`, `frame_bound[_s/_e]`, `frame_exclude[_opt]` | Generated construction and destruction of OVER/named-window/frame/filter semantic values; implicit RANGE unbounded/current default. | Generated parser actions and immutable test snapshots; no token reparse. Must land before syntax admission. |
| `src/sqliteInt.h`: `struct Window`; `src/window.c`: `sqlite3WindowAlloc`, `sqlite3WindowAssemble`, `sqlite3WindowAttach`, delete/unlink/list-delete | Window fields, expression/function/SELECT ownership, default/explicit frame identity, normalized bounds and cleanup. | Mutable compiler graph with discriminated frame/bound/exclusion enums and exact one-owner cleanup. |
| `src/window.c`: `windowFind`, `sqlite3WindowChain`, `sqlite3WindowUpdate` | Earlier-definition named inheritance, override errors, copied OVER definitions, RANGE-offset cardinality validation, built-in frame coercion and FILTER restriction. | Resolver pass after function lookup; prepare-time diagnostics and source tests. |
| `src/resolve.c`: function-expression branch around `NC_AllowWin`/`NC_HasWin`, calls to `sqlite3WindowUpdate` and `sqlite3WindowLink` | Scope legality, nested aggregate/window checks, function class/arity, linking at the owning SELECT. | Existing linked NameContext/function resolution extended structurally; atomic no-Program errors. |
| `src/window.c`: tri-state `sqlite3WindowCompare`, `sqlite3WindowLink` | Return `0` means equal/shareable; `1` different and `2` indeterminate are both non-shareable. Exact frame/PARTITION/ORDER chains share; non-sharing may set `SF_MultiPart`. | Compiler chain identity must test `compare(...)===0`, never truthiness/“not different”. FILTER remains function-local; `1` and `2` both lower through nested SELECT rewrites. Comparator source tests include indeterminate expression identity. |
| `src/window.c`: `selectWindowRewriteSelectCb`, `selectWindowRewriteExprCb`, `selectWindowRewriteEList` | Track entry into scalar subselects; inside them lift only `TK_COLUMN` nodes owned by the outer original `SrcList`, never local columns/aggregates/windows. | Source-shaped rewrite walker with explicit nested-SELECT marker and cursor-membership check. Snapshot/source tests cover correlated outer columns beside local columns, local aggregate/window ownership, and no accidental buffer lift. |
| `src/window.c`: `sqlite3WindowExtraAggFuncDepth` with walker depth callbacks | After inserting the generated subquery layer, increment qualifying outer-referencing `TK_AGG_FUNCTION` `Expr.op2` depth. | Post-attachment graph-repair pass; snapshots assert exact changed/unchanged aggregate depths across nested scalar subqueries. |
| `src/window.c`: `disallowAggregatesInOrderByCb`; early branch in `sqlite3WindowRewrite` | Before graph mutation, a non-aggregate SELECT rejects an unowned ORDER aggregate with `misuse of aggregate`. | Prepare-time validation gate before rewrite/publication; source tests assert diagnostic and phase and that no Program/partial graph escapes. |
| `src/window.c`: `exprListAppendList` `bIntToNull` branch and parent-ORDER prefix elision in `sqlite3WindowRewrite` | Generated PARTITION+ORDER sort copies convert copied integer literals to NULL after COLLATE/likely wrappers, retain term sort flags, then remove parent ORDER when it is expression-identical to a generated-sort prefix. | Owned expression-copy helper plus rewrite ordering logic. Snapshots assert originals unchanged, NULL copies, ASC/DESC/NULLS flags, prefix/non-prefix cases, parent deletion and resulting sorter ownership/work. |
| `src/window.c`: remaining `sqlite3WindowRewrite`; `src/select.c`: call before WHERE planning | Move FROM/WHERE/GROUP/HAVING to sorted subquery, rewrite parent expressions to buffer columns, append partition/order/args/filter, allocate `regAccum`, `regResult`, `iEphCsr`. | Source-shaped Select rewrite preserving existing aggregate/subquery/CTE/metadata graphs; full rewrite snapshot gate before VM work. |
| `src/select.c`: window branches in `sqlite3Select`, select-loop destinations and outer output subroutine | Compile rewritten producer, call CodeInit before WHERE loop, call CodeStep, expose each completed row through `regGosub`/`addrGosub` and `OP_Return`. | Existing SELECT destinations and VM lowering; no recursive Statement or host iterator. |
| `src/window.c`: `sqlite3WindowCodeInit` | Open main ephemeral and three duplicate cursors; initialize partition, exclusion and built-in application cursor/register state. | Typed ephemeral cursors under the one Program private budget; non-overlapping register/cursor allocator. |
| `src/window.c`: `WindowCodeArg`, `windowCheckValue`, `windowCodeRangeTest`, `windowIfNewPeer`, `windowCodeOp`, `sqlite3WindowCodeStep` | One-time partition bound checks; ROWS counters, GROUPS peers, RANGE ASC/DESC comparisons; partition flush; step/inverse/return ordering and safe deletion modes. | VDBE op/control translation using `Mem`/`KeyInfo`, deterministic work and resumable pc/register/cursor state. |
| `src/window.c`: `windowAggStep`, `windowAggFinal`, `windowReturnOneRow`, `windowCacheFrame`, exclusion/full-scan branches | FILTERed step/inverse, value/final, cached/random-access versus sliding mode, frame scan and EXCLUDE semantics. | Existing aggregate context plus window accumulator state; shared byte/entry accounting and first-error cleanup. |
| `src/window.c`: built-in callbacks and `sqlite3WindowFunctions` (`WINDOWFUNCALL`, `WINDOWFUNCX`, `WINDOWFUNCNOOP`) | Callback implementations and coerced frames for row_number/rank/dense_rank/percent_rank/cume_dist/ntile/first/last/nth/lead/lag; lead/lag bytecode ownership. | Dedicated built-in definitions preserving callback-versus-bytecode split; not ordinary host scalar registration. |
| `src/func.c`: `WAGGREGATE` registrations for sum/total/avg/count/min/max/group_concat/string_agg and inverse/value callbacks | Ordinary aggregate functions reused as aggregate windows. | Existing source-shaped aggregate `FuncDef`/context expanded only with inverse/value lifecycle required by the selected mode. |
| `src/vdbe.c`: `OP_Gosub`, `OP_Return`, `OP_InitCoroutine`, `OP_Yield`, `OP_EndCoroutine`, `OP_OpenEphemeral`/`OpenDup`, `OP_AggStep`/`AggInverse`/`AggValue`/`AggFinal`; `src/vdbeaux.c`: coroutine/subroutine finish/analysis | Return-address and coroutine-pc exchange, shared ephemeral handles, callback dispatch/finalization. | Existing opcode-array/register VM adaptation, resumable across bounded async yields; focused opcode and cleanup gates. |
| `src/select.c`: coroutine/materialization/flattening and aggregate SELECT paths | Composition with derived tables, CTEs, aggregates, compounds and outer ORDER/DISTINCT/LIMIT; window flatten restriction. | Preserve current admitted architecture. Reject the complete statement at prepare if any required composed route is unavailable. |
| `test/window*.test`, `test/e_window*.test`, `test/windowfault.test` in the pinned tree | Upstream semantic, boundary and fault evidence candidates. | Future immutable pinned-native artifact plus public Fetch TypeScript runner; no credit until exact rows/types/errors and lifecycle companions pass. |

Project-only operational bounds are deliberate browser/read-only adaptations, not
SQL algorithm substitutions: all window/auxiliary ephemeral state shares
`PrivateStateByteBudget`, private entry/key limits and the one execution work
counter; each move/comparison/callback/copy is charged; cancellation, deadline and
host yield preserve state without replay. `maxRows`/`maxResultBytes` remain public
output limits. Reset retains bindings but destroys all window execution state;
rebind reruns cleanly; finalize/failure/cancel/deadline release every cursor,
accumulator and reservation once while preserving the first error. Required tests
must include tiny byte/entry/work limits and injected suspension/cleanup failures.

Inspected for this decision: the manifest and the pinned files `src/window.c`,
`src/sqliteInt.h`, `src/parse.y`, `src/resolve.c`, `src/select.c`, `src/func.c`,
`src/vdbe.c`, and `src/vdbeaux.c`, including all named routines above. The current
revision-labelled fidelity audit was checked against current docs/source: its
later ordinary and recursive CTE revisions supersede old CTE predictions, while
its sustained rule against substitute semantic owners remains applicable; it has
no evidence of implemented window execution. No exceptional substitution is
proposed.

### Window parser/resolver implementation evidence ([[card:card-o-b-a]], 2026-09-18)

`src/internal/parse.ts` now retains the generated `frame_opt` graph (type, bounds and offset expressions, implicit default, and exclusion) and applies `sqlite3WindowAlloc`'s integer-zero boundary canonicalization. `src/internal/resolve.ts` now materializes earlier-definition inheritance using `sqlite3WindowChain`'s override ordering, updates function-owned windows after built-in arity lookup using `sqlite3WindowUpdate` frame coercions, and assigns compatible chain groups using the fields compared by `sqlite3WindowCompare`/`sqlite3WindowLink`. The immutable resolved graph is the explicit handoff to rewrite; it is not runtime admission. `test/parser/window-graph.test.mjs` covers graph identity, inheritance errors, built-in update/FILTER/arity, RANGE cardinality, zero normalization, compatible sharing, and distinct partition nesting. Runtime bound-value checks and `sqlite3WindowRewrite` remain mapped to later owners above.

### Window rewrite foundation ([[card:card-o-b-f]], 2026-09-18)

Historical pre-frame checkpoint (superseded for runtime/admission by the current CodeStep mappings below): the selected branches in the rows above for `sqlite3WindowRewrite`, `sqlite3WindowExtraAggFuncDepth`, and `disallowAggregatesInOrderByCb` are now represented in `src/internal/window-rewrite.ts`, with resolved cursor/depth carriers from `src/internal/resolve.ts` and public compiler routing in `src/index.ts`/`src/internal/vdbe.ts`. The immutable `WindowAggregateDepthRepair` records only aggregates whose resolved outer cursor crosses the generated layer (`before >= scalar SELECT depth`); local nested aggregates remain unchanged. ORDER misuse is diagnosed before graph construction, and table/scalar routes reject before Program publication because `sqlite3WindowCodeStep` is not implemented. `test/conformance/window-rewrite.test.mjs` is the source/public evidence. This is a bounded immutable handoff, not the complete mutable SELECT rewrite: cursor/register and Gosub/Return fields describe planned ownership but no `OpenEphemeral`/`OpenDup`/window subroutine program is emitted. Rows for `sqlite3WindowCodeInit`, `sqlite3WindowCodeStep`, callbacks and frame execution remain future work.

### Window emitted setup ([[card:card-o-b-g]], 2026-09-18)

Historical setup-only checkpoint (superseded by the current execution mapping below): `src/internal/vdbe.ts:compileWindowSelectLowering` implements the mapped `window.c:sqlite3WindowCodeInit` setup and `select.c` producer handoff as actual internal VDBE operations: shared-layer `OpenEphemeral` plus three `OpenDup`, allocated partition/one/accumulator/result registers, and layer-owned `Gosub`/`Return`. `test/conformance/window-rewrite.test.mjs` inspects operation operands and shared-versus-nested ownership. The product is intentionally setup-only and cannot be published by public prepare because `sqlite3WindowCodeStep` is still unsupported.


### Window recursive ownership correction ([[card:card-o-b-b]], 2026-09-18)

Following immutable review `record:///review.md?card=card-o-b&v=3`, the `src/window.c:sqlite3WindowRewrite` nesting mapping now uses `WindowRewriteGraph.root`: an innermost original-clause producer and explicit `rewritten-select` parent/subquery edges for each incompatible group. `compileWindowSelectLowering` traverses that ownership chain inside-out; `test/conformance/window-rewrite.test.mjs` walks the edges, proves FROM/WHERE/GROUP/HAVING have one owner, and checks compiler order. This corrects the prior flat-layer overclaim. The lowering is a non-publishable ordinary `select.c` producer-loop boundary, not full `sqlite3WindowCodeInit`; EXCLUDE/application-cursor branches and frame stepping remain mapped future work, and public window execution remains 0 credited.

### Producer-loop binding correction ([[card:card-o-b-g]], 2026-09-18)

Per `record:///review.md?card=card-o-b&v=3`, `compileWindowSelectLowering` lowers the recursive `WindowRewriteGraph.root` through the ordinary resolved source scan: `OpenRead`/`Rewind`, per-row inside-out `Gosub`, loop-back `Next`, then outer-continuation `Return`. Tests bind exact operation addresses to graph groups and distinguish the original producer from recursive rewritten-select owners. The `sqlite3WindowCodeInit` mapping is narrowed to the common ephemeral/duplicate/partition/one/accumulator prefix. Its EXCLUDE and special built-in application cursor/register branches remain source-mapped but deferred until `sqlite3WindowCodeStep`, their sole consumer, is translated; allocating them inertly would not preserve an observable compiler/runtime contract.

### Window ORDER-prefix structural identity correction ([[card:card-o-b-b]], 2026-09-18)

Per the fidelity notification and immutable review `record:///review.md?card=card-o-b&v=9`, the parent ORDER-prefix branch mapped from `window.c:sqlite3WindowRewrite` and `expr.c:sqlite3ExprListCompare` no longer compares normalized token text. It reuses generated structural expression identity without skipping top-level COLLATE and compares parser-derived DESC/NULLS flags before elision. `test/conformance/window-rewrite.test.mjs` distinguishes structurally identical COLLATE copies from different collations, direction mismatch, integer-to-NULL generated copies, grouping-wrapper equivalence, and independent per-item flags in recursive multi-term sortlists. Per-item extraction is required because each upstream `ExprList_item.sortFlags` excludes prior list items. This does not expand the pre-frame execution boundary.

### Recursive SELECT/coroutine lowering correction ([[card:card-o-b-g]], 2026-09-18)

Per `record:///review.md?card=card-o-b&v=9`, `WindowRewriteGraph.root` is no longer reduced to an ordered layer array sharing one source loop. `compileWindowSelectLowering` emits an innermost original-clause coroutine, then one sorter-backed child-consuming producer coroutine per compatible group. Incompatible groups form distinct `InitCoroutine`/`Yield`/`EndCoroutine` loops with layer-local Gosub/Return; compatible functions share a producer. Multi-source original FROM uses nested Rewind/Next ownership rather than the invalid parallel reverse-Next scan. Structural ORDER-prefix identity from [[card:card-o-b-b]] determines retained versus producer ordering. CodeInit branch deferral and the no-frame/publication boundary are unchanged.

### Aggregate-window step/lifetime handoff ([[card:card-o-c-a]], 2026-09-18)

| Pinned 3.53.4 owner | Exact branch/observable | TypeScript consumer contract / evidence |
|---|---|---|
| `src/select.c:sqlite3Select` 8284, 8332 | `CodeInit` before the WHERE loop; each producer row enters `CodeStep`; outer row body is a `Gosub` continuation | accepted recursive producer graph from [[card:card-o-b]]; preserve one producer advance and VM pc across suspension |
| `src/window.c:sqlite3WindowCodeInit` 1388 | ephemeral cursor + 3 duplicates; accum/result; cache, min/max, first/nth and lead/lag application branches | common prefix exists; specialized state is allocated only with its step consumer |
| `src/window.c:windowAggStep/windowAggFinal/windowFullScan/windowReturnOneRow` 1656-1996 | FILTER, step/inverse/value/final, EXCLUDE scan, cursor-owned built-ins | existing aggregate `FuncDef`/context/Mem lifecycle; no generic host recomputation |
| `src/window.c:windowCacheFrame/windowIfNewPeer/windowCodeRangeTest/windowCodeOp` 2029-2435 | cache policy, peer groups, ASC/DESC+BIGNULL+collation RANGE arithmetic, safe deletion and frame schedules | typed private cursors/`KeyInfo`; one execution byte budget; deterministic work |
| `src/window.c:sqlite3WindowCodeStep` 2784 onward | partition compare/flush, bound evaluation, ROWS/RANGE/GROUPS start/end family dispatch | `compileWindowSelectLowering` typed VM schedules; public execution evidence in the 43-case matrix |
| `src/vdbe.c` 1119-1175, 7837-8019; `src/vdbeaux.c` opcode/P4 lifecycle | `Gosub/Return`; `AggStep/Inverse/Value/Final`; context error/final cleanup | VM integer pc/register adaptation, exact-once cleanup and first-error precedence |

Executable evidence is
`test/conformance/cases/stage3-aggregate-window.{spec.json,json}`, captured by
`test/conformance/capture-aggregate-window.py` and guarded by
`test/conformance/aggregate-window-contract-manifest.test.py`: 44 declared = 25
hashed literal upstream cases + 19 explicitly no-credit companions; native 43/43,
source-only 1; TypeScript executable 43/43 with 25/25 source-credit, plus one separately validated no-credit private-control declaration. This allocation is separate from the earlier
29-case graph/rewrite evidence and is the implementation denominator for aggregate
window stepping.

#### EXCLUDE allocation correction ([[card:card-o-c-a]], 2026-09-18)

Source-credit ordinals 22–25 are `test/window8.test` cases `2.1.3`, `2.2.3`,
`2.3.3`, and `2.4.3` (ordinary `min`/`max`/`sum`) for EXCLUDE NO OTHERS,
CURRENT ROW, GROUP, and TIES. The former `.2` cases used `nth_value`, whose
dedicated `window.c` application state is outside this aggregate-window handoff.
The replacement preserves the denominator and four-mode EXCLUDE intent, but
changes those samples to UNBOUNDED PRECEDING..CURRENT ROW and makes no
`nth_value` or unbounded-following coverage claim.

### Aggregate-window sliding callback completion ([[card:card-o-c-b]], 2026-09-19)

| Pinned owner | TypeScript mapping | Adaptation/evidence |
| --- | --- | --- |
| `src/window.c:sqlite3WindowCodeInit` min/max application-list branch; `src/func.c:minmaxStep` | `src/internal/vdbe.ts:extremaDefinition`; inverse-capable accumulators use an ordered owned-`Mem` multiset, ordinary accumulators retain one current best | Browser-memory aggregate-context representation replaces the dedicated sliding ephemeral cursor while preserving collation ordering, duplicates, NULL behavior, and xValue; all retained cells debit the statement byte budget. Ordinary aggregate replacement atomically swaps its one reservation, matching `minmaxStep` rather than retaining all inputs. |
| `src/func.c:groupConcatStep/groupConcatInverse/groupConcatValue` | `src/internal/vdbe.ts:concatDefinition` FIFO text/separator entries | Preserves removal of the oldest value and following separator, including variable separators; retained UTF-8 logical bytes debit/release the statement budget. |
| Source case plus aggregate-registry companion | `test/conformance/cases/stage3-aggregate-window.json` `companion-aggregate-registry` | Shared bounded ROWS scan verifies sliding count/sum/avg/total/min/max/group_concat through the public API. |


### Aggregate-window execution completion ([[card:card-o-c-b]], 2026-09-19)

The CodeInit/CodeStep rows above are now represented by `src/internal/vdbe.ts`
window setup, frame schedules, typed ephemeral cursor operations and aggregate
callback opcodes. Recursive queue producers are relocated into the same coroutine
boundary (`ResultRow` to copy/`Yield`) without a host evaluator.
`test/conformance/run-aggregate-window-ts.mjs` passes all 43 executable cases
(25 source-credit); `aggregate-window-private-controls.test.mjs` separately
validates source-only ordinal 44. The special built-ins use the separate execution
mapping immediately below.

### Special built-in window contract ([[card:card-o-d-a]], 2026-09-19)

| Pinned owner | Required translated behavior | Executable evidence |
| --- | --- | --- |
| `src/window.c:sqlite3WindowFunctions`, `WINDOWFUNCALL/X/NOOP` | Exact names/arities and callback versus direct-VDBE ownership for all 11 special built-ins | `stage3-special-window.spec.json`: exact `window1` arity/misuse/FILTER/lead/row-number cases plus per-function companions |
| `src/window.c:sqlite3WindowUpdate` | Coerce ranking/distribution/ntile/lead/lag frames and clear EXCLUDE; retain first/last/nth frame and EXCLUDE; reject FILTER | coercion, FILTER and all EXCLUDE companion cases |
| `src/window.c:sqlite3WindowCodeInit`, `windowCacheFrame`, `windowReturnOneRow` | Main+duplicate cursors, application registers/cursors; cache first/nth/lead/lag; direct rowid seek and default handling | lead/lag arities and offsets, first/nth frame lookup, mixed sharing |
| `src/window.c:windowAggStep/windowAggFinal`, ranking/value callbacks | Peer-sensitive INTEGER/REAL results, ntile partition arithmetic and exact argument errors, last-value lifecycle | peer/NULL/NOCASE/no-ORDER, large buckets, parameter reset, nth/ntile errors |
| `src/window.c:sqlite3WindowCodeStep`; `src/select.c`; `src/vdbe.c` | Partition buffering, peer comparison, frame step/inverse/return/delete ordering, result-register Gosub publication, first-error cleanup | 43-case contract: 11 source-credit + 32 companions; native 41/41; TS 41/41 executable plus two separately validated source-only companions |

This allocation is additive to ordinary aggregate windows. Its immutable native
artifact is `test/conformance/cases/stage3-special-window.json`; capture verifies
the exact 3.53.4 source ID. Project byte/entry/work/row ceilings, cooperative yield,
injected cleanup faults, and unsupported write-context rejection are companions,
not upstream credit. There is no algorithm substitution: implementation handoff is
the pinned callback/direct-bytecode split and existing typed VDBE frame engine.

### REAL-affinity extraction correction (2026-09-19)

| Pinned source | TypeScript owner | Public evidence |
| --- | --- | --- |
| `src/expr.c:sqlite3ExprCodeTarget` TK_COLUMN REAL branch; `src/vdbe.c:OP_Column`, `OP_RealAffinity`; record serial decode retains INTEGER | `src/internal/vdbe.ts` direct-column and expression-tree resolved-column lowering emit `Column` then `RealAffinity`; VM realifies only an INTEGER `Mem` | `test/select/real-column-affinity.test.mjs`, `test/fixtures/real-affinity/*`: all three database encodings; integral/nonintegral REAL, NULL, int64 boundaries and neighboring NUMERIC/INTEGER; direct, `typeof`, arithmetic, and aggregate consumers; metadata and lifecycle |

This is not a record-decoder substitution: raw serial integers remain INTEGER and
only a resolved declared-REAL column extraction receives the source opcode. Fresh
source-ID-pinned native baseline results were `real|20.0`, `real|10.0`,
`real|35.5`, and `null|NULL` in UTF-8/UTF-16le/UTF-16be, while the pre-repair
public path exposed INTEGER/`bigint` for compact integral REAL records. The mapped
repair is commit `ab674fd7b84ddeb5ff0b0b4dde9ffa19a9cfc1ff`; the generalized
expression-consumer follow-up is commit
`ad433c2a4ae92bf679ff6303e3ea421ce73f0234`. Unsupported SQL consumers are not
part of this verified mapping.

### Special built-in window execution ([[card:card-o-d-b]], 2026-09-19)

Pinned `src/window.c:sqlite3WindowFunctions`, `sqlite3WindowUpdate`,
`sqlite3WindowCodeInit`, `sqlite3WindowCodeStep`, `windowAggStep`,
`windowReturnOneRow`, and `windowCodeOp` map to `src/internal/resolve.ts` and
`src/internal/vdbe.ts`. Exact arities/coercions are resolved before lowering;
callback functions retain aggregate contexts and inverse/value/finalize behavior,
and lead/lag plus first/nth direct branches retain application-cursor rowid access.
`test/conformance/run-special-window-ts.mjs` and
`test/conformance/window-rewrite.test.mjs` cover typed results, diagnostics,
peer/frame/exclusion branches, sharing/nesting, composition, encodings, and
lifecycle/private controls. The bounded ROWS lower-bound repair and GROUPS
literal-one dispatch preserve `windowCodeOp` cursor/queue ownership and introduce
no host-side full-partition algorithm. The same VDBE owner binds ordinary scalar
calls moved with the source WHERE clause, including infix LIKE/GLOB's source-level
operand order, and models `count(*)` as zero callback arguments;
`test/conformance/ordinary-scalars-pattern-window.test.mjs` covers that combined
rewrite path through Public Fetch.

## Ordinary scalar registry tests-first map ([[card:card-p-a-a]])

The exact 50-row `src/func.c:aBuiltinFunc` ordinary-scalar map, aliases/arities/FuncDef flags, historical baseline 12-implemented/38-absent classification, source-owned implementation slices, and 37-case/59-observation typed corpus live in [`research/card-p-a-a-ordinary-scalars.md`](research/card-p-a-a-ordinary-scalars.md) and `test/conformance/cases/stage3-ordinary-scalars.spec.json`. Principal owners are `func.c` (`upperFunc`, `lowerFunc`, `likeFunc`/`patternCompare`, `trimFunc`, `instrFunc`, `unicodeFunc`, `quoteFunc`, `roundFunc`, `printfFunc`, registration), `printf.c`, `vdbemem.c`, `utf.c`, `util.c`, and compiler/resolver callers in `resolve.c`, `expr.c`, and `vdbe.c`. Machine-mapped implementation branches are recorded per slice. Exact selected assertion bodies and hashes include `func.test`, `like.test`, `func9-200`, `func9-210`, and `printf-1.1.1`; the validator checks them against the pinned tree. Date/time (`date.c`), math and JSON (`json.c`) remain visible future root registries; aggregates/windows are separate already-owned surfaces.

### Ordinary scalar overload and provenance precision (third correction)

The scalar machine map distinguishes raw FuncDef matching from effective scalar dispatch. `FUNCTION(min|max,-3,...,minmaxFunc)` has a raw match range of 1..1000 via `callback.c:matchQuality`, but exact `WAGGREGATE(min|max,1,...)` wins for one argument; `resolve.c:resolveExprStep` then classifies the selected `xFinalize` definition as aggregate/window-owned. Thus the ordinary `minmaxFunc` slice owns 2..1000 arguments. `case-minmax-overload-discriminator` captures one-argument aggregate/window and two-argument scalar paths. Every absent row and source-owned slice now links to cases and nonempty pinned branches; assertion fixtures carry checked body/setup ranges and hashes.

Independent review `record:///review.md?card=card-p-a&v=3` prompted a complete 50-row semantic-owner audit. Each ordinary registry row now maps its recorded routine into its source slice and covering cases; inline registrations map explicitly to `sqlite3ExprCodeTarget`. In particular CHAR owns `charFunc`, UNISTR owns `unistrFunc` plus `isNHex` and `sqlite3AppendOneUtf8Character`, and UNICODE alone owns `unicodeFunc`. Persisted-column cases use `scalar_values` in all three physical encoding fixtures; pinned native capture and validation open those exact hashed fixtures directly, avoiding synthetic encoding conversions.

The superseded tests-first handoff checkpoint was 50 active registry rows, 37 cases/59 native observations, and 12 dispatched/38 absent; current accounting is 50/50 as recorded below. Final validation used `python3 test/conformance/ordinary-scalars-manifest.test.py --library /work/jsqlite2/.saivage/work/cards/card-p-a-a/oracle-build/build/libsqlite3-oracle.so`; this loads and source-ID-checks the pinned library and executes the persisted-column cases against all three exact hashed fixtures. Any earlier argument-less transcript is invalid/superseded.

### Non-pattern/non-format ordinary scalar implementation ([[card:card-p-b-a-b]])

`src/internal/functions.ts`, `src/internal/ordinary-scalars.ts`, and
`src/internal/vdbe.ts` map the delivered rows to pinned `src/func.c:aBuiltinFunc`,
`trimFunc`, `instrFunc`, `unicodeFunc`, `charFunc`, `unistrFunc`, `quoteFunc`,
`unhexFunc`, `zeroblobFunc`, `concatFunc`/`concatwsFunc`, `signFunc`, random/state/
identity/compile-option callbacks; compiler-inline conditionals and hints map to
`src/expr.c:sqlite3ExprCodeTarget`. Text/value conversion follows `src/utf.c`,
`src/vdbemem.c`, and `src/vdbeapi.c`. `||` lowering maps to `src/expr.c:TK_CONCAT`
and `src/vdbe.c:OP_Concat`. The browser adaptation for `sqlite_log` is a no-op
sink because no host log callback is public; its SQL result remains NULL. Registry
accounting at this tranche checkpoint was 47 dispatchable and three represented
non-dispatchable sibling rows: `printf`, `format`, and `round`; the formatting
translation below supersedes that checkpoint. `src/internal/pattern.ts` maps `func.c:patternCompare`
and `likeFunc` to an explicit-state LIKE/GLOB matcher (rather than host regex),
including ESCAPE, ASCII folding, sets/ranges, malformed classes, NUL termination, the pinned pattern
limit, and bounded-work control. `src/internal/functions.ts` preserves `glob(2)` and
`like(2|3)` registration/flags; `src/internal/resolve.ts` rejects wrong arity during
prepare; infix lowering reverses candidate/pattern as `likeFunc` requires; and
`src/internal/vdbe.ts` converts NULL/TEXT/BLOB in database encoding before normal
Function-context dispatch. Public evidence is the five immutable observations,
24 original boundaries, 90 cross-encoding source discriminators, 12 represented
compositions, nine failure/reset/reuse lifecycles, and the focused window-rewrite
case in `run-ordinary-scalars-pattern-ts.mjs` and
`ordinary-scalars-pattern-window.test.mjs`. No RegExp, native SQLite, eval, or host
callback is used. `quote(REAL)` maps the distinct
`func.c:sqlite3QuoteValue` `%!0.17g` branch through the shared translated
`util.c:sqlite3FpDecode` formatting primitive; typed pinned-native and public
binding vectors cover integral REAL, signed zero, precision/subnormal boundaries,
and infinities. TEXT/BLOB expansion checks the result limit before construction.

### Ordinary scalar bounded execution revision (2026-09-20)

`src/func.c:instrFunc`, `unistrFunc`, `unistrQuoteFunc`, `concatFunc`, `charFunc`, `unhexFunc`, `zeroblobFunc`, and `randomBlob` map to the ordinary dispatch and bounded helpers in `src/internal/vdbe.ts` / `ordinary-scalars.ts`. Output bytes are incrementally preflighted before host allocation; long loops check controls and charge in 256-unit intervals. `instr` deliberately retains upstream's nested candidate comparison rather than substituting a different search algorithm. Browser Web Crypto is chunked at 65,536 bytes. Deferred upstream `MEM_Zero` is adapted to eager browser bytes because the read-only public BLOB API exposes a `Uint8Array`; allocation occurs only after output and proportional-work admission. `test/conformance/run-ordinary-scalars-owned-ts.mjs` supplies public low output/work, abort/deadline, saved-error, reset/finalize, and connection-reuse evidence. At this bounded-execution checkpoint accounting remained 47/50; the formatting section below supersedes that count.


### SQL formatting scalar translation ([[card:card-p-b-b]])

`src/internal/printf.ts` translates the SQL-accessible branches of pinned
`src/printf.c:sqlite3_str_vappendf` and `src/func.c:printfFunc`/`roundFunc`. It
retains format scanning, sequential/missing argument consumption, flags, dynamic
and literal width/precision, integer bases and signed-64 behavior, REAL decimal
digit decoding, SQL `%q`/`%Q`/`%w` escaping, embedded-NUL termination, padding,
and the round direct-integer versus `%!.*f` paths without host printf or Intl.
`src/internal/vdbe.ts` owns result limits and saved-error cleanup through the
existing FunctionContext/VDBE path. `run-ordinary-scalars-format-ts.mjs` covers
the pinned cases plus parameters, composition, padding/bases, exact output limit,
and saved-error/finalize behavior. The foundation gate additionally checks exact
`round` wrong-arity diagnostics. Registry accounting is now 50/50 dispatchable;
the immutable spec's 12/38 `tsStatus` fields remain historical allocation metadata,
not current runtime support.

#### Formatting fidelity correction ([[card:card-p-b-b]])

Review correction maps `printf.c`'s `etORDINAL`, `cThousand`, end-of-format `%`,
negative `*` precision, `adjust_width_for_utf8`, and floating special-value
branches explicitly into `src/internal/printf.ts`. The same translation now
pre-admits every width/precision-driven repeat, padding/grouping expansion, and
floating temporary before allocation. Public discriminators in
`run-ordinary-scalars-format-ts.mjs` match the manifest-pinned oracle for `%r`,
`%,d`, terminal `%`, UTF-8 width, negative precision, and infinity spelling, and
exercise hostile literal/dynamic dimensions under a five-byte result ceiling.

#### Conversion-specific precision admission correction

The `printf.c` precision parser is separated from conversion admission:
`etSTRING` and `etESCAPE_*` map to bounded input scans and actual expansion
preflight, `etCHARX` maps to encoded repeated-byte admission, and numeric branches
retain worst-case temporary/output checks. Pinned-native and public tests distinguish
large literal/dynamic precision on short/empty values from genuine escaped,
character, and floating excess under the same five-byte ceiling.

#### `etSIZE` width correction

Pinned `printf.c` maps `%n` to `etSIZE`, whose SQL argument-list branch clears
`length` and `width` without consuming a conversion value. `printf.ts` now parses
literal/dynamic width safely before dispatch but defers output admission to each
emitting conversion. Source-ID-pinned and public tests cover `%999n`, `%*n`,
surrounding literals, and neighboring argument consumption under a five-byte
result ceiling, alongside retained excessive emitting-width failures.

## Value-list `IN` execution mapping (2026-09-20)

| TypeScript / evidence | Pinned SQLite owner | Mapping and bounded claim |
|---|---|---|
| `src/internal/vdbe.ts` generated expression adaptation | `src/parse.y`, reduction `expr ::= expr in_op LP exprlist RP` and the empty-list reduction | Builds an ordered `in-list` expression from generated reductions; no token reconstruction or ad-hoc SQL parser. |
| `src/internal/vdbe.ts` `in-list` lowering | `src/expr.c:sqlite3ExprCodeIN`, `sqlite3FindInIndex`, `IN_INDEX_NOOP` | Evaluates LHS once and scans RHS terms in order using shared comparison affinity/collation and NULL propagation, with control-flow short-circuit after a match. No JS `Set`/`includes`, native/WASM runtime, or index-backed/subquery claim. |
| `test/conformance/cases/audit-in-list.{spec.json,json}`, `capture-audit-in-list.py`, `run-audit-in-list-ts.mjs` | Exact pinned 3.53.4 public results | 21 cases × three physical encodings = 63 zero-credit comparisons; typed values, ordered names, initial/reset results, expected step errors, first-error identity and finalize behavior are checked. |
| aggregate bare-column/rowid repair in `src/internal/vdbe.ts` | `src/select.c` aggregate code generation and `src/vdbe.c` cursor/register ownership | A decoded record caches its rowid, and ordinary non-min/max aggregate output saves bare columns from the first qualifying input row rather than rereading an exhausted cursor. This is shared ownership repair, not additional aggregate credit. |

## Date/time functions ([[card:card-q-a-a]])

> Historical design checkpoint: the planning/0-of-18 statements in the original
> handoff are superseded by the current execution mapping immediately below. Current
> bounded accounting is 29/29 selected assertions: 18 body-hashed upstream and
> 11 pinned `date.c` 24:00 source-control branches; two result companions,
> nine boundaries, and six seam contracts remain zero-credit evidence.

| Pinned source owner | Translation/integration owner | Evidence and status |
| --- | --- | --- |
| `src/date.c:DateTime`, `parseYyyyMmDd`, `parseHhMmSs`, `computeJD`, `computeYMD_HMS`, `parseModifier`, `isDate` | Historical plan for the private date module, exact bigint iJD, independent source flags, shared Mem coercion, and FunctionContext results | Superseded by “Date/time scalar execution” below; retained as design provenance |
| `src/date.c:sqlite3RegisterDateTimeFunctions`, output callbacks; `src/parse.y:term` CURRENT_* keywords | Historical integration plan for the existing registry/resolver and VDBE Function lowering | Superseded below; current public TS credit is 29/29 selected assertions (18 body-hashed upstream and 11 source-control), with companion/boundary/seam categories separate |
| `src/vdbeapi.c:sqlite3StmtCurrentTime`; VFS current time | Connection environment plus execution-owned lazy statement cache | One injected sample per execution across rows/subqueries/yields/aliases; reset resamples; prepare does not sample |
| `src/date.c:osLocaltime`, `toLocaltime`, localtime/utc modifier branches | Injectable `localFieldsAtUnixSecond` host boundary; source equivalent-year remap and UTC fixed-point loop remain translated | Exact local outcomes require injection; ambient browser timezone/tzdata is explicitly host-dependent; provider failure is `local time unavailable` |
| `test/date.test`, `test/timediff1.test` selected literals; `src/date.c` 24:00 cache control | Manifest/capture/public execution | Current evidence is 40 selected cases × 3 encodings = 120 typed observations; 29/29 selected assertions are public TS credit (18 body-hashed upstream plus 11 exact source-control assertions), while six implemented seam contracts and native capture remain separate evidence |

### Date/time scalar execution ([[card:card-q-a-b]])

| Pinned SQLite 3.53.4 owner | TypeScript owner | Evidence |
|---|---|---|
| `src/date.c` `DateTime`, `computeJD`, `computeYMD`, `computeHMS`, `clearYMD_HMS_TZ`, `parseYyyyMmDd`, `parseHhMmSs`, `parseModifier`, `isDate` | `src/internal/date-time.ts` bigint iJD plus independently authoritative parsed YMD/HMS caches, parser/calendar/modifier pipeline | `run-date-time-cases-ts.mjs`, 120 typed observations across UTF-8/UTF-16LE/UTF-16BE; exact full-date/time direct and `strftime`, `subsec`, numeric/ceiling invalidation, Z/zero/nonzero timezone neighbors, and reset lifecycle |
| `src/date.c` `dateFunc`, `timeFunc`, `datetimeFunc`, `juliandayFunc`, `unixepochFunc`, `strftimeFunc`, `timediffFunc`, registration table | `src/internal/functions.ts` registrations; `src/internal/vdbe.ts` shared Function/PureFunc lowering/dispatch; `date-time.ts` callbacks | parameter, column, composition, reset and CURRENT_* public Fetch checks |
| `src/vdbeapi.c:sqlite3StmtCurrentTime`; `src/date.c:localtimeOffset` | execution-owned cached clock and private `DateTimeEnvironment` local-field adapter | `run-date-time-seams-ts.mjs` lazy/stable/resample, provider calls/failure, saved-error lifecycle |
| `sqlite3StrAccumInit(...SQLITE_LIMIT_LENGTH)` in `strftimeFunc` and VDBE interruption | shared `ScalarControl.charge/checkSize` passed into date-time execution | seam output-limit and strftime work-limit/reset/reuse checks |

The local-time provider is a browser adaptation because ECMAScript exposes host
civil-time fields rather than SQLite's platform `localtime_r`; the translated UTC
iteration and observable SQL output/error behavior remain source-shaped. No public
host callback API, parallel evaluator, native/WASM path, or `Date.parse` is used.

#### Date/time follow-up branch map ([[card:card-q-a-b]])

| Pinned branch | Current owner / evidence |
|---|---|
| `isDate` non-numeric `sqlite3_value_text`; `parseDateOrTime` initial `subsec`/`subsecond` | `date-time.ts:textArg/parse`; cross-encoding public BLOB and lazy clock/reset checks |
| `toLocaltime` 1970..2038 direct branch, equivalent-year mapping, `osLocaltime` failure | `date-time.ts:localJulian`; deterministic mapped provider input plus null/throw/invalid-field SQLite-error lifecycle |
| `strftimeFunc` `%Y`, `%F`, `%G`, `%g` signed integer formatting; `DateTime` simultaneous validJD/validYMD/validHMS and cache invalidation | `date-time.ts:displayFields/apply`; public negative/year-zero formatting and 11 exact 24:00 retain/recompute source-control assertions across three encodings |
| VDBE interrupt checks during `strftimeFunc` scan | shared `DateTimeControl.charge`; public AbortSignal identity/reset/finalize check |

### Ordinary math functions — tests-first mapping

| Surface | Pinned source | Project evidence | Status |
|---|---|---|---|
| 30 math registrations / 29 names | `src/func.c:aBuiltinFunc` `SQLITE_ENABLE_MATH_FUNCTIONS`; `src/sqliteInt.h:FUNCTION/MFUNCTION` | `functions.ts` immutable arity/flag registry; `stage3-math.spec.json`, `math-manifest.test.py` | enabled through shared resolver/compiler/VDBE dispatch |
| conversion and wrapper branches | `src/func.c:ceilingFunc`, `logFunc`, `math1Func`, `math2Func`, `piFunc`; `src/vdbemem.c:sqlite3VdbeMemSetDouble`, `sqlite3VdbeRealValue` | `math.ts`; 22 cases / 66 observations in `stage3-math.native.json` | public typed match, 22/22 credit; signed-int64 endpoints enforced |
| upstream behavior selection | `test/func7.test` (`func7-100`, `110`, `200`, `210`, PostgreSQL/MySQL-derived assertions) | `capture-math.py`; public `run-math-cases-ts.mjs` | source-linked public pass across three encodings |

The development oracle profile is SQLite 3.53.4 with
`ENABLE_COLUMN_METADATA` and `ENABLE_MATH_FUNCTIONS`; this build exposes `trunc`,
`acosh`, `asinh`, and `atanh`, establishing C99 availability for the captured
profile. The TypeScript adaptation uses ECMAScript `Math` as the browser-safe
libm surface while retaining the pinned wrapper branches: SQLite numeric-type
conversion for wrapper-gated arguments (numeric TEXT only; BLOB rejection), and
`log(B,X)`'s distinct `sqlite3_value_double(X)` numeric-prefix/BLOB conversion in
the database encoding, INTEGER preservation for
ceil/floor/trunc, domain/NaN-to-NULL, REAL outputs, infinity, signed zero,
log base control, aliases and arities. The immutable corpus currently passes
22/22 cases (66/66 encoding-specific observations), including exact typed and
IEEE-754 evidence for both signed-int64 endpoints through all four preserving
rounding names and representative unary/binary REAL wrappers. Finite transcendental
bit-level identity beyond the captured host/profile remains a documented libm
portability limit rather than a cross-engine guarantee.

## JSON foundation — [[card:card-r-a]]

| Pinned SQLite 3.53.4 source | TypeScript owner | Evidence |
|---|---|---|
| `src/json.c` JSONB constants/header sizing, `jsonbPayloadSize`, `jsonbValidityCheck` | `src/internal/json.ts` byte encoder/decoder/validator | `test/conformance/json-foundation.test.mjs` malformed, truncated, nonminimal and exact-hex cases |
| `src/json.c` `JsonParse`/`JsonNode`, `jsonParseFuncArg`, `jsonTranslateTextToBlob`, `jsonReturnString` | ordered `JsonNode`, parser, renderer, `json`/`jsonb` handoff | foundation/scalar public Fetch tests and pinned 3.53.4 CLI capture |
| `src/json.c` `jsonValidFunc`, `jsonExtractFunc`, aggregate steps/finals and `JsonEachCursor`/`jsonEachFilter`/`jsonEachNext`/`jsonEachColumn`/`jsonEachCursorReset` | scalar/aggregate VDBE dispatch; statement-owned incremental internal/native TypeScript cursors for `json_each`, `json_tree`, `jsonb_each`, and `jsonb_tree`. Rewind retains one ordered parse image; next constructs one current row; cursor cleanup releases reserved input/node/path/stack state. Original JSONB element bounds and label offsets drive `id`/`parent` and source container slices, including nonminimal headers. Expression arguments, roots, visible/hidden reads, WHERE, ORDER/LIMIT/OFFSET, grouped aggregate/HAVING consumers, physical-left correlated joins and two-source left-to-right JSON correlation are admitted. | Focused public Fetch tests cover eight visible columns, scalar/root traversal, parameter reset, expression predicates/projections, hidden inputs, original/nonminimal JSONB offsets and container bytes, malformed truncation, incremental LIMIT under work bounds, private-state first-error/finalize cleanup, ORDER/LIMIT/OFFSET, grouped aggregate/HAVING consumption, physical-left correlation and correlated JSON-source traversal; RIGHT/FULL mixed joins, reverse correlation, and advanced aggregate modifiers remain typed temporary unsupported |
| `src/select.c` `sqlite3GenerateColumnNames` and `generateColumnTypes` | `src/internal/vdbe.ts` resolved JSON result metadata distinguishes direct virtual columns from computed source spans across single, correlated JSON, and physical-left/JSON-right routes; visible JSON fields have null declared type, hidden `json`/`root` have the upstream empty string, and physical fields retain their schema type/origin | Public all-encoding metadata tests cover all fields, qualifiers, aliases, duplicates, COLLATE, computed comments/spacing, wildcards, correlation, mixed physical joins, reset and finalize |
| `src/vdbe.c` subtype copy/move and `src/expr.c` subtype consumers; `src/json.c:jsonArgIsJsonb` and `JFUNCTION` result flags | existing `Mem` subtype field and Function/PureFunc result lifetime; text JSON carries subtype 74 while validated JSONB is a subtype-0 BLOB | subtype/composition and reset/finalize assertions, including `subtype(jsonb(...))=0` and structural JSONB aggregate input |

- `src/json.c:jsonTypeFunc,jsonArrayLengthFunc,jsonErrorFunc,jsonArrayFunc,jsonObjectFunc,jsonRemoveFunc,jsonReplaceFunc,jsonPatchFunc,jsonExtractFunc,jsonLookupStep` → `src/internal/json.ts` scalar inspection/construction/copy-on-write edit/merge-patch/path and `src/internal/vdbe.ts` registration dispatch; public cases in `test/conformance/json-scalar-full.test.mjs` ([[card:card-r-b]]).
- `src/parse.y` `PTR` expression plus `src/json.c` `->`/`->>` registrations → tokenizer `PTR`, expression lowering to private JSON callbacks, and VDBE scalar result shaping.

## JSON aggregate functions ([[card:card-r-c]], 2026-09-21)

| Pinned SQLite 3.53.4 source | TypeScript owner | Public evidence |
| --- | --- | --- |
| `src/json.c`: `jsonArrayStep`, `jsonArrayCompute`, `jsonArrayValue`, `jsonArrayFinal` | `src/internal/vdbe.ts`: `jsonAggregateDefinition` array branch; `src/internal/json.ts`: `jsonNodeFromSqlValue`, render/JSONB encoder | `test/conformance/json-aggregate-paths.test.mjs` empty, typed, subtype, grouped, window, limit/lifecycle cases |
| `src/json.c`: `jsonObjectStep`, `jsonObjectCompute`, `jsonObjectValue`, `jsonObjectFinal` | same definition object branch; ordered entry nodes preserve duplicate labels | same public Fetch suite |
| `src/json.c`: `jsonGroupInverse`; `WAGGREGATE` rows near 5700 | definition `inverse` plus shared `AggInverse`/`AggValue`/`AggFinal` and `AggregateContext` cleanup | sliding `ROWS 2 PRECEDING`, reset/finalize/admission tests |
| `src/func.c`, `src/vdbe.c`: aggregate context/result ownership | existing `FunctionContext`, aggregate `Mem`, private-state budget | aggregate sum regression and standard aggregate/window suites |
- Review correction: `src/json.c:jsonErrorFunc`, JSONB-output branches of `jsonArrayFunc`/`jsonObjectFunc`/`jsonSetFunc`/`jsonRemoveFunc`/`jsonReplaceFunc`/`jsonPatchFunc`, and `JSON_AINS` map to `src/internal/json.ts` parser error offsets, JSONB result shaping, and array insertion. `jsonLookupStep`'s missing-object-member branch maps to retained per-label JSONB encodings: path-created raw labels use `JSONB_TEXTRAW`, escaped quoted labels retain `JSONB_TEXT5`, and existing decoded labels preserve their source type/payload across edits. Exact public constructor/set/patch/array-insert bytes prevent canonical tree re-encoding from approximating this branch. `jsonPrettyFunc` is inventoried/registered but temporary unsupported.
- Mutation correction: `src/json.c:jsonInsertIntoBlob`, `jsonRemoveFunc`, and the `jsonLookupStep` `#-N` array branch map to `src/internal/json.ts:jsonEdit`, `pathParts`, and `editNode`, shared by TEXT/JSONB families.
| `src/json.c:jsonArgIsJsonb`, `jsonParseFuncArg` tag-20240123-a | shared `jsonArgIsJsonb` plus BLOB-document text fallback in `src/internal/json.ts` | `test/conformance/json-blob-document.test.mjs` |

## WHERE planner architecture map (draft, 2026-09-21, [[card:card-s-a-a]])

This is a representation/admission map for parent [[card:card-s-a]], not runtime
credit. The mutable contract is in `TRANSLATION.md` under “WHERE planning
representation and staged admission contract”. No public API changes.

| Concern | Pinned SQLite 3.53.4 owner | Current TS owner/finding | Staged evidence gate |
|---|---|---|---|
| Clause split, term provenance, prerequisite masks, derived terms | `src/whereInt.h:WhereClause,WhereTerm,WhereMaskSet`; `src/whereexpr.c:exprAnalyze` (1121), `sqlite3WhereSplit` (1599), outer-join branches 506-507 and 1187-1197 | Resolved expressions/source order in `parse.ts`/`resolve.ts`; no shared term model | ON/WHERE/USING outer-join truth, correlated prerequisites, bigint-mask tests |
| B-tree candidate generation and dominance | `src/where.c:whereLoopInsert` (2832), `whereLoopAddBtreeIndex` (3220), `whereLoopAddBtree` (4004) | `schema.ts:IndexNode`; current `vdbe.ts` scan-only lowering | rowid then ordinary-index equality/range/composite-prefix candidates; forced-index atomic gates |
| Index-term affinity/collation eligibility and handoff | `src/where.c:whereScanInit` (485), `whereScanNext` affinity/collation branch around 386-422, `whereLoopAddBtreeIndex` (3220); `src/expr.c:sqlite3CompareAffinity` (342), `comparisonAffinity` (364), `sqlite3IndexAffinityOk` (387), `sqlite3BinaryCompareCollSeq` (424), `sqlite3ExprCompareCollSeq` (452); `src/whereexpr.c:exprCommute` (113) | shared `where-plan.ts:IndexConstraintAdmission` created once by candidate construction and retained by `BtreeCapability` equality/range members through `WhereLoop`/`WherePath` to lowering; resolved column identity/affinity/collation in `schema.ts`/`resolve.ts`; current `vdbe.ts:expressionAffinity`, `expressionCollation`, `explicitCollation`, `binaryCollation`; `mem.ts:Mem.applyAffinity`; `comparison.ts:compareMem` and identity-bearing `KeyInfo` | immutable handoff owns exact term, physical field/ordinal, KeyInfo-term identity, canonical operator/original orientation, ordinary-comparison affinity plus validated effective term collation or an IS-NULL mode owning neither, and semantic bound direction; both modes retain physical field/KeyInfo identity and lowering consumes without recomputation; mismatch/unproved metadata excludes an unforced seek and atomically rejects a forced dependency; typed TEXT/numeric/BLOB/NULL and both-orientation tests across encodings |
| Physical rowid-index descriptor and exact identity | `src/sqliteInt.h:Index.nKeyCol/nColumn/aiColumn/aSortOrder/azColl`, `KeyInfo.nKeyField/nAllField`, `XN_ROWID`; `src/build.c:sqlite3KeyInfoOfIndex` (5653); `src/vdbe.c` `OP_Column`, `OP_IdxRowid`/`OP_DeferredSeek` (6708), `OP_Idx*` (6827) | `schema.ts:IndexNode.terms` currently describes declared terms only; `comparison.ts:KeyInfo` already enforces immutable identity and key/all counts | one schema-publication `PhysicalRowidIndex`: declared fields plus implicit rowid tail, encoding/collation/DESC/NULL policy, UNIQUE-null key-count rule; same identities across candidates/open/unpack/compare/covering/rowid/deferred seek; ambiguous layouts gated atomically |
| RIGHT/FULL initial planner boundary | `src/whereInt.h:WhereRightJoin`, `WhereLevel.pRJ`; `src/where.c:bFirstPastRJ` and branches 7393-7422, 7540-7550, 7726-7731; `src/wherecode.c` matched-set and `sqlite3WhereRightJoinLoop` around 2740-2946 | current `vdbe.ts` source-order compiler owns match tracking, physical-left NULL rows and unmatched-right pass; proposed planner has no equivalent state | W1/W2 statement-wide dispatch to unchanged source-order compiler before planner work; matched/unmatched RIGHT/FULL, ON/WHERE, nested, reset/error fallback regressions; later planning requires its own mapped tranche |
| N-best join path and order/distinct facts | `src/whereInt.h:WhereLoop,WherePath`; `src/where.c:wherePathSolver` (5835); `sqlite3WhereIsDistinct` (62), `sqlite3WhereIsOrdered` (74); `src/select.c` consumers around 8304-8308, 8543-8545 | source-order nested scan; existing typed sorter/DISTINCT and complete `KeyInfo` | deterministic cost/tie/path tests; only complete-path proof may elide sorter/distinct work |
| Level/code ownership | `src/whereInt.h:WhereLevel`; `src/wherecode.c:codeEqualityTerm` (803), `sqlite3WhereCodeOneLoopStart` (1466); `src/where.c:sqlite3WhereBegin` (6829), `sqlite3WhereEnd` (7520) | VDBE labels/cursors/null-row/lifecycle exist but are not planner-owned | scan, rowid seek, index seek/termination, reverse, covering, deferred-seek program shapes and cleanup |
| Physical seek and key semantics | `src/btree.c:sqlite3BtreeTableMoveto` (5805), `sqlite3BtreeIndexMoveto` (6036); seek/index/deferred-seek cases in `src/vdbe.c`; `src/sqliteInt.h:KeyInfo` | path-local `btree.ts`; shared Mem/comparison and identity-bearing `KeyInfo` | typed key boundaries plus off-path/selected-path corruption; exact IndexNode/KeyInfo identity |
| Stats and logical cost | `src/analyze.c:decodeIntArray`, `analysisLoader`, `sqlite3AnalysisLoad`; `Index.aiRowLogEst`, `aiColumnNotNull`, STAT4 sample paths | no stat loader; no planner costs | pinned defaults first; stat1 later; STAT4 remains atomic unsupported until sample probing is ported |
| Unsupported physical forms | WHERE index matching/partial implication/IN-loop branches; `WhereLevel.u.in`; WITHOUT ROWID index layout | schema rejects partial/ambiguous autoindexes; represents expression indexes and WITHOUT ROWID without planner capability | prepare-time atomic gates for WITHOUT ROWID, partial, expression, unsupported stats/autoindex/KeyInfo and planner-IN cases |

Representation choices are ordinary TypeScript adaptations: immutable objects and
arrays for source structs/lists, `bigint` for dense masks and logical LogEst/stat
values, and labels for VDBE addresses. They retain upstream candidate/path/lowering
algorithms; no exceptional substitution is proposed. W1/W2 do not claim that the
reduced `WhereLevel` translates `WhereRightJoin`: a statement containing RIGHT or
FULL uses the existing source-order compiler atomically until that source model is
mapped. Existing eager decoded-tree
restoration, native runtime backends, writes, eval, API/registration changes, and
product-scope changes are explicitly absent.

Architecture validation performed before this draft: clean `git status`; direct
inspection/grep of the pinned manifest and the structures/routines above; current
`schema.ts`, `btree.ts`, `resolve.ts`, `vdbe.ts`, `comparison.ts`, and statement
lifecycle; and revision-labeled audit findings 3/6/8/9/10. Documentation-only
checks for this draft are recorded in the card status. Runtime/oracle checks are
deferred to the implementing consumer because this card intentionally changes no
runtime.

### Persistent index planner — executable zero-credit boundary ([[card:card-s-a-b]])

| Pinned source | Project evidence | Status |
|---|---|---|
| `test/index3.test:index3-2.1/index3-2.2`; `src/where.c:whereLoopAddBtreeIndex`; `src/wherecode.c:codeEqualityTerm`, `sqlite3WhereCodeOneLoopStart` | `test/conformance/cases/stage3-index-planner.spec.json`, pinned `.json`, `capture-index-planner.py`, `recapture-index-planner.py`, `index-planner-manifest.test.py`, `run-index-planner-ts.mjs` | 13 manifest-pinned native captures; attempted public TS assertions remain 0 credit pending planner/private-counter implementation |
| `build.c:sqlite3KeyInfoOfIndex`; `pragma.c:index_xinfo`; `vdbe.c` seek/index/deferred-seek opcodes | committed 512-byte `test/conformance/fixtures/index-planner.db`, exact digest/schema roots/explicit and `sqlite_autoindex_t_1` xinfo, native EQP/VDBE/work capture | fixture setup is pinned proof; host SQLite setup is not accepted |
| `where.c`/`wherecode.c` deferred branches for WITHOUT ROWID, partial/expression indexes, stat choice, and IN loops | five separately machine-accounted atomic gates in the same capture | unattempted, zero credit; no partial plan may prepare |

### Ordinary CTE B3 bounded materialization route (2026-09-22)

| Pinned source behavior | TypeScript route | Evidence |
|---|---|---|
| `select.c` CTE SrcItem resolution and ephemeral materialization precede ordinary table consumption; residual represented owners do not become schema names | `compileDerivedProducer` compiles the grouped source-0 producer into a typed VDBE sorter and consumes it with one ordinary schema table; `compileTableSelect` rejects unhandled derived owners before schema lookup | `cte-chinook-lead.test.mjs`: exact `Title`,`n` metadata and three typed rows through public Fetch, plus connection reuse, in UTF-8/UTF-16LE/UTF-16BE. Python SQLite 3.45.1 supplied comparison rows only; no pinned-native 3.53.4 credit is claimed. |

## `BETWEEN` and result-name span mapping (2026-09-22)

| Project owner/evidence | Pinned owner | Current bounded mapping |
|---|---|---|
| `parse.ts`, `resolve.ts`, `vdbe.ts` | `parse.y` `expr ::= expr between_op expr AND expr`; `expr.c:exprCodeBetween`, `sqlite3ExprCodeTarget`, `sqlite3ExprIfTrue/False` | Structured generated reduction; lhs register evaluated once; lower then upper shared comparisons preserve affinity, CollSeq, NULL/NOT and target-vs-predicate control. No token parser or range evaluator. |
| exact `ExprNode.sourceText` and compiled column metadata | `select.c:sqlite3GenerateColumnNames`, `sqlite3DbSpanDup` | Unaliased computed expressions use the original UTF-8 source slice; aliases win and resolved direct columns use their column names. |
| `audit-chinook-b1-b5*`, `between-lowering.test.mjs` | Exact pinned public results and development-only one-call function probe | 22 cases/56 executions, zero credit; typed rows, ordered names, repeated prepare/reset, expected errors and lifecycle. Native function registration is oracle-only, not public API. |
| Physical encoding/affinity executable completion | `src/where.c:whereScanNext`; `src/expr.c:sqlite3CompareAffinity`, `sqlite3IndexAffinityOk`, `sqlite3BinaryCompareCollSeq`; `src/whereexpr.c:exprCommute`; `test/index3.test:index3-2.1/2.2` | three physical UTF-8/UTF-16le/UTF-16be fixtures and 23 cases each in `stage3-index-planner.json`; typed affinity/collation/orientation neighbors, EQP/VDBE evidence, exact roots/xinfo/hashes; all nine private counter families have per-case exact/bounded invariants, with `inProbes` zero outside index-backed IN, with non-vacuous claimed-path movement and exact-zero forbidden work | 69 pinned captures and public attempts, 0 TS credit; five atomic gaps unchanged |

### W1/W2 WHERE foundation delivery ([[card:card-s-b-a-a-a-a]], 2026-09-22)

| Pinned owner | Current production owner | Verified boundary |
|---|---|---|
| `build.c:sqlite3KeyInfoOfIndex`; `sqliteInt.h:Index` physical fields | `schema.ts:physicalRowidIndex`, `IndexNode.physical` | One immutable rowid-tail descriptor and KeyInfo per admitted schema index; unsupported layouts publish `null` atomically |
| `whereexpr.c:exprAnalyze/sqlite3WhereSplit`; `where.c:whereScan*`, `whereLoopAddBtreeIndex`, `whereLoopAddBtree` | `where-plan.ts:WhereClause`, `admitIndexConstraint`, `btreeLoops` | Exact cached admission identities, leading equality plus next-field range, affinity/collation/IS-NULL gates, covering/order/reverse, forced/unforced behavior |
| `where.c:whereLoopInsert`, `wherePathSolver`; `whereInt.h:WhereLoop/WherePath` | `where-plan.ts:WhereLoop`, `wherePathSolver` | Bigint masks/estimates, prerequisites, deterministic best-per-ready-mask no-stat path; opcode lowering remains unmapped/uncredited |

W1/W2 correction: `where-plan.ts:analyzeWhere` now maps the admitted
`sqlite3WhereSplit`/`exprAnalyze` production path (resolved identity, commutation,
original-order collation, prerequisites, LEFT provenance); `btreeLoops` maps
INTEGER PRIMARY KEY rowid equality/range and forced-full/NOT INDEXED branches.
`logEstAdd` and the bounded N-best/dominance path set replace the former
one-state simplification and map `util.c:sqlite3LogEstAdd`,
`where.c:whereLoopInsert`, and `wherePathSolver`. RIGHT/FULL still dispatches to
the unchanged source-order fallback; W3 lowering remains uncredited.

W1/W2 review correction maps LEFT source-order loop prerequisites to the
`whereexpr.c:exprAnalyze` outer-ON barrier and carries them through all
`btreeLoops` shapes. `wherePathChoiceWidth` maps admitted `where.c:wherePathSolver`
widths 1/5/12 (excluding the star-query 18-width extension), with bounded
same-ready-mask cost/rows/order dominance. Equality-fixed ORDER accounting maps
the corresponding `wherePathSatisfiesOrder` behavior; `ROWID_NEEDED` maps coverage
to the immutable physical rowid tail. Statement preflight rejects participating
WITHOUT ROWID layouts before W1/W2 publication. Encoding-specific tests now run
analysis through exact admission/candidate/selected-path identity rather than
checking detached descriptors.

Renewed W1/W2 correction maps `whereexpr.c:exprAnalyze` `EP_OuterON`/
`extraRight`: preserved-side LEFT-ON terms remain residual and are excluded from
capabilities. The both-indexable-column branch now creates exact parent/virtual
commuted-child identities with reversed operators, original-order collation,
independent masks, and outer safety. `planWhere` source masks now retain the full
prefix through a LEFT nullable RHS for subsequent INNER/CROSS sources, matching
the admitted flat three-source join-order branches; tests cover nullable-side
references and both operand spellings.

Immutable-review correction maps comparison admission to
`expr.c:sqlite3CompareAffinity`/`sqlite3IndexAffinityOk`, explicitly separating
literal storage class from expression affinity. Candidate construction now maps
the admitted `whereScan*`/`whereLoopAddBtreeIndex` proposal behavior by emitting
all leading equality alternatives and next-field lower/upper pairs (including
rowid forms), each with exact identities and prerequisite masks, before solver
dominance. A same-slot IN and range must also produce competing alternatives:
`whereLoopAddBtreeIndex` restores saved nEq/nBtm/nTop before considering the
next term rather than returning after equality recursion. The three-encoding
`where-plan-analysis.test.mjs` competing-IN/range test checks both alternatives;
these candidate assertions do not establish selected cursor access. Multi-source `WherePath.orderTermsSatisfied` is intentionally zero
until complete `wherePathSatisfiesOrder` path state is ported; local capability
order facts remain non-authoritative for sorter removal. Cross-encoding affinity,
text-order-invariant alternatives, and inner-restart order tests enforce these
boundaries without claiming W3 execution.

### W1/W2 production lowering completion (2026-09-23)

| Pinned SQLite 3.53.4 owner | TypeScript owner / evidence | Status |
|---|---|---|
| `src/where.c:sqlite3WhereBegin`, `sqlite3WhereEnd`; `src/wherecode.c:codeEqualityTerm`, `sqlite3WhereCodeOneLoopStart` | `src/internal/where-plan.ts`, `src/internal/vdbe.ts`; `test/conformance/run-index-planner-ts.mjs` | Selected immutable rowid/index capabilities lower to table/index seek, range termination, direction, residual, covering, deferred-seek, and loop-end control. Every multi-source path conservatively publishes zero global order until the complete pinned `wherePathSatisfiesOrder` state machine is translated. |
| `src/vdbe.c` seek/`Idx*`/`DeferredSeek`/`Column`/rowid traversal cases | `src/internal/vdbe.ts`; `stage3-index-planner.spec.json` and pinned capture | Page-local B-tree movement and `Mem`/`KeyInfo` comparisons serve explicit and persistent implicit rowid indexes. 69/69 public-route executions enforce rows/errors and exactly nine private counter families; `inProbes` is zero outside index-backed IN. No exceptional algorithm substitution. |

### Selected RIGHT unmatched-pass cursor and control graph ([[card:card-t-d]], 2026-10-01)

| Pinned producer/consumer | TypeScript path | Evidence / remaining gap |
| --- | --- | --- |
| `src/wherecode.c:sqlite3WhereRightJoinLoop` (2842–2950) emits `OP_NullRow` for each left table and `iIdxCur`, then scans RHS | `src/internal/vdbe.ts:compileInnerTableSelect` nulls each left table/index via source ordinal before `Rewind`/`Found` and shared unmatched continuation | Source-order assertion and public forced-selected/scan RIGHT hit/miss/NULL rebind in 3 encodings; pinned source-ID typed native `select-joined-index-null-native.py` compares INTEGER/NULL metadata and rows. No planner admission changed. |
| `src/vdbe.c:OP_NullRow` (6195–6228), `OP_Rewind` (6372–6410) clear stale cursor then position fresh scan | VM `NullRow` invalidation and `Rewind` replace prior seek cursor/deferred rowid so `Next` advances the newly positioned scan | Before repair, copied RHS expression `ShortCircuit` jumped back to the matched pass, exhausting sorter entries. `relocateControlTargets` now maps all address-bearing opcodes during continuation copy instead of hand-written subset; VM still owns PC/register/budget. Exact work-unit parity, suspended concurrency and full RIGHT/IN matrix remain open. |

### Selected LEFT null-row cursor-state boundary ([[card:card-t-d]], 2026-09-30)

| Pinned producer/consumer | TypeScript path | Evidence / remaining gap |
| --- | --- | --- |
| `src/where.c:sqlite3WhereEnd` (7655–7710) resolves inner-to-outer IN restart before `OP_IfPos`, then emits `OP_NullRow` on both table and selected index for a LEFT miss | `src/internal/vdbe.ts:compileInnerTableSelect` emits table `NullRow`, then selected-index `NullRow` if opened, then re-enters the joined body | Public forced/scan LEFT hit/miss/reset rows in `run-advanced-index-ts.test.mjs`; typed pinned oracle `select-joined-index-null-native.py` three encodings; source-order assertion protects the hidden cursor transition |
| `src/vdbe.c:OP_NullRow` (6195–6228) invalidates cursor cache and clears Btree position | `src/internal/vdbe.ts:VdbeStatement` removes decoded row, rowid and pending deferred seek on p1 and clears positioned index/table cursor via `src/internal/btree.ts:CursorBase.clearPosition`; future seek/restart retains opened cursor identity | Source/VM regression asserts deferred invalidation. Exact native work-unit equivalence and broader suspended/corruption parity remain open; no root [[card:card-s]] planner admission changed. |

### Joined selected nullable range-start exit ([[card:card-t-d]], 2026-09-30)

Pinned `src/wherecode.c:sqlite3WhereCodeOneLoopStart` Case 4
(1990–2042) emits `OP_IsNull` after computing nullable `pRangeStart`
and before affinity and seek, targeting `addrNxt`; `src/vdbe.c:OP_IsNull`
(2755–2768) reads the register and changes PC without cursor movement.
The joined `src/internal/vdbe.ts:compileInnerTableSelect` caller emits
`IsNull` for the start register (not `IS NULL` equality) before
`IndexSeekPrefix` and carries its label through `rewindEmpty`,
`inRestarts` and next-outer exits, resolving before RIGHT JOIN
continuation copying. The existing VM retains seek and register/PC
execution ownership. Public forced-vs-scan NULL/duplicates/IS/IN
reset/budget tests in `run-advanced-index-ts.test.mjs`, with typed
source-ID-checked native differential in
`select-joined-index-null-native.py`, exercise the bounded path. This
is not a wholesale migration of joined WHERE loops or VM execution.

### Nullable selected range-start guard ([[card:card-t-d]], 2026-09-30)

Pinned `src/wherecode.c:sqlite3WhereCodeOneLoopStart` Case 4
(1990–2042) evaluates the nullable range-start RHS, emits `OP_IsNull`
to `addrNxt` before affinity/seek, then uses `aStartOp`; `src/vdbe.c:OP_IsNull`
(2755–2763) performs the register branch. The selected
`src/internal/vdbe.ts:compileTableSelect` caller now emits an `IsNull`
branch for a present range start, but not for an equality `IS NULL`
key; `sqlite3WhereEnd` patches that target to the same selected-loop
failed-seek/IN-restart edge. VM `IsNull` executes on Mem register storage,
while VM `IndexSeekPrefix` retains cursor movement and key release. Public
all-encoding/reset/rebind forward and reverse forced-vs-control coverage
in `run-advanced-index-ts.test.mjs` and source-ID-checked native typed
rows in `select-nullable-index-range-native.py` check this bounded seam.
No general planner or VM architecture migration is claimed.

### Unbounded reverse selected-index loop start ([[card:card-t-d]], 2026-09-30)

Pinned `src/wherecode.c:sqlite3WhereCodeOneLoopStart` Case 4 `aStartOp`
(1850–1866) selects `OP_Last` when a chosen index is reverse and has no
start constraint, and `sqlite3WhereEnd` selects `OP_Prev` (2214–2216).
`src/vdbe.c:OP_Last/OP_Rewind/OP_Prev` (6254, 6372, 6495) owns cursor
position and movement. In `src/internal/vdbe.ts:compileTableSelect` the
no-bound selected-index branch now emits `IndexLast` for reverse,
`IndexRewind` for forward; `sqlite3WhereEnd` already emits `IndexPrev`.
VM positioning/record invalidation, bound seeks, Mem/KeyInfo and cleanup
are unchanged. Public selected-vs-control all-encoding/reset test in
`test/conformance/run-advanced-index-ts.test.mjs` and source-ID-checked
read-only oracle `select-unbounded-reverse-index-native.py` cover typed
INTEGER rows in all three encodings. This is a start/step contract fix,
not full WHERE path parity or a VM architecture migration.

### Joined selected-index one-sided range review ([[card:card-s-c-c-c]], 2026-09-28)

Pinned `wherecode.c:1821-1866,1952-2041` Case 4 keeps `pRangeStart` and `pRangeEnd` separate, appends the start constraint to the equality prefix for a seek, and emits an independent end constraint only when present. The represented joined lowering currently seeks the equality prefix and evaluates the original WHERE residual; it must **not** recycle a lone lower start into `IndexRangeEnd`. A review-derived all-encoding `m_abc` joined fixture distinguishes lower-only `b>1`, upper-only `b<3` and two-sided `b>1 AND b<=2` from `NOT INDEXED`, initial and reset. Removing the recycled end restores typed rows in all three encodings; this is a conservative range-start fallback, not a claim of SQLite-equivalent bound positioning or exact movement counts. Joined strict starts, reverse scans, IN-prefix restarts and selected-path ORDER/accounting still require independent coverage or preselection gates. The frozen partial/expression selected-access manifest remains zero-credit.


| Contract | Pinned owners/assertions | Disposition |
|---|---|---|
| WITHOUT ROWID composite PK/secondary physical mapping | `build.c:convertToWithoutRowidTable`, `btree.c:sqlite3BtreeIndexMoveto`, `test/without_rowid1.test` | Three encodings native captured and TS selected-access credited for primary exact/prefix and represented secondary mappings; the descriptor retains exact PK-field ordinals, including deduplicated/interspersed fields rather than assuming a suffix |
| Partial implication | `where.c:whereUsablePartialIndex`, `expr.c:sqlite3ExprImpliesExpr`, `test/index6.test` | Positive/negative native and public-row neighbors captured; TS selected access remains unattempted and zero-credit pending the reopened implementation |
| Expression identity | `where.c:whereLoopAddBtreeIndex`, `expr.c:sqlite3ExprCompare`, `test/indexexpr1.test` | Identical/mismatch native and public-row neighbors captured; TS selected access remains unattempted and zero-credit pending the reopened implementation |
| IN/composite ranges | `where.c:whereLoopAddBtreeIndex/wherePathSolver`, `wherecode.c:codeEqualityTerm`, `test/in4.test` | Three-encoding TS selected-access credit covers represented IN and composite/multiple-range neighbors |

Machine contract/capture/validator are `stage3-advanced-index.spec.json`, `stage3-advanced-index.json`, and `advanced-index-manifest.test.py`. `exactProvenance` maps every local case and applicable companion to a pinned Tcl assertion ID or stable source range and exact text SHA-256; validation reads and hashes the archive itself. Machine-required rationale separates inherited behavior from local-capture evidence. Composite/multiple-range semantics specifically map to hashed `wherecode.c` Case 4 and `where.c:whereLoopAddBtreeIndex` branches (equality prefix, first usable range, later residual), not `in4-3.21/.22`; validator requires range category, planner/lowering owners, and branch markers, while any test citation is neighbor-only. Each case's separate `futurePrivateExpected` maps the future uncredited TS selected root/cursor roles and exact/min/max physical-work shape; it is not native stmt-status evidence. Counter semantics follow the ordinary contract (seek positions, Next moves between rows with a possible terminal probe, residual tests visited candidates, sorter rows inserted rows). Validator rules derive IN probes from distinct RHS parameters, enforce zero probes for non-IN, full-cardinality base scan/residual bounds, emitted-row deferred seeks, covering zero-table access, and sorter cardinality. Captures include native lifecycle/error/reuse, statement-status bounded-work, bind-phase LENGTH and prepare-phase VARIABLE_NUMBER configured limits, and two selected-page/off-path-isolation surfaces: `btree.c:moveToRoot/getAndInitPage` for an index root and `btree.c:accessPayload/getOverflowPage` for an indexed payload overflow chain. Source SHA-256 prefixes are `where.c e96a8fea`, `whereexpr.c a6dc7d0f`, `wherecode.c 496fd3fb`, `btree.c c0982890`, `build.c c7154980`, `analyze.c d015f3d7`, and `expr.c 363e581d`. This is 30 native captures and 0 TS attempted/credited, not runtime implementation or algorithm substitution.

### Advanced index execution revision (2026-09-23, [[card:card-s-c-b-b]])

| TypeScript owner | Pinned SQLite 3.53.4 owner | Evidence / boundary |
|---|---|---|
| `schema.ts:physicalIndex` immutable WITHOUT ROWID PK suffix fields | `build.c:convertToWithoutRowidTable`, `sqlite3CreateIndex` | Exact composite PK order/collation/direction is appended to secondary keys; three-encoding descriptor and public cases. |
| `where-plan.ts:admitIndexConstraint/makeCapability` | `where.c:whereLoopAddBtreeIndex`, `whereexpr.c:exprAnalyze` | Exact `PhysicalIndex`/`KeyInfo` identity; residual columns remain in covering needs. Partial/expression admissibility is deliberately not credited here. |
| `vdbe.ts` primary and deferred secondary lowering | `wherecode.c:sqlite3WhereCodeOneLoopStart`, especially 2171-2185; `vdbe.c:OP_DeferredSeek` 6680-6740 | Exact/prefix BLOBKEY movement and complete secondary PK-suffix lookup. Current rowid-index `DeferredSeek` is eager rather than upstream-lazy: all-encoding empty/one/three-row companions observe TS table seeks of 0/1/3 when no uncovered read occurs (pinned behavior 0/0/0); projecting uncovered `c` twice over three rows correctly yields 3, not 6, so the repair must preserve once-per-position materialization caching. This localizes the defect to pending-state creation timing, not prepare, initial seek, index movement, or repeat-read caching. |
| `btree.ts:IndexCursor` | `btree.c:sqlite3BtreeIndexMoveto`, `btreeNext`, `btreePrevious` | Retained-path lazy seek/movement; selected corruption fails and unrelated malformed subtrees remain untouched. |

The advanced manifest now records 30 attempted public row assertions and 24 credited encoding/case pairs: `wr-primary-exact`, `wr-primary-prefix`, `wr-secondary-suffix`, `index-backed-in`, `composite-equality-two-ranges`, `multiple-range-neighbor`, `partial-implied`, and `expression-identical`. The latter two earn three pairs each through loaded-root KeyInfo/live seeks, pinned EQP and typed rows; `partial-not-implied` and `expression-mismatch` scan and remain `unattempted`/zero for selected-access credit. See CONFORMANCE for eligibility; review-derived NULL/reset and corruption probes are not pinned recaptures for [[card:card-s-c-c]]. The focused non-covering `wr_c` case is additional source-backed coverage, not an invented native capture.

#### WITHOUT ROWID secondary remapping correction (2026-09-23)

`schema.ts:physicalIndex` now maps every primary `KeyInfo` term to an immutable selected-secondary record ordinal by exact column plus PK collation. `vdbe.ts:DeferredIndexSeek` gathers those ordinals in PK order. This translates pinned `wherecode.c:2171-2185` without assuming SQLite's deduplicated PK fields form a contiguous suffix. Native-generated all-encoding fixtures and public exact-counter tests cover mixed declared/auxiliary, reordered/interspersed, no-suffix, and collation-duplicate layouts. See immutable review `record:///review.md?card=card-s-c-b&v=3`.

### Partial/expression persistent-index architecture handoff ([[card:card-s-c-c-a]], 2026-09-23)

| Concern | Pinned SQLite 3.53.4 anchor | Required existing owner / decision |
|---|---|---|
| Partial predicate usability | `src/where.c:whereUsablePartialIndex` 3700-3730 and call in the index loop near 4125; `src/expr.c:sqlite3ExprIsInteger` 2899+, `sqlite3ExprImpliesExpr` 6847-6871, `sqlite3ExprIsNotTrue` 6774-6781, `sqlite3ExprIsIIF` 6793-6818, `exprImpliesNotNull` 6698-6845 | `schema.ts:IndexNode.partialWhere` becomes an immutable table-bound resolved expression; `where-plan.ts` proves every predicate AND conjunct from safe `WhereTerm`s. Initial proof is exact structure, index-predicate-side `pE2` OR (either arm), qualifying query-side `pE1` resolved inline-IIF function identity (ASCII-case-insensitive registered `iif` or built-in alias `if`, including upper-case spellings) or one-pair searched-CASE condition (exactly two args/absent ELSE, or exactly three args with pinned not-true ELSE: NULL, FALSE, or integer AST recursively decoded as zero including decimal/hex literals (parentheses parse-discarded) and nested UPLUS/UMINUS; never REAL zero at any such unary depth, TEXT zero, parameters under the no-parse-context call, CAST/arithmetic constant expressions, variadic IIF, simple/multi-WHEN CASE, or TRUE/nonzero ELSE), and source-enumerated NOT-NULL branches plus the bounded true-only query-side OR extension documented in the R1 correction (never under seenNot). Unknown is false/fallback, never acceptance. |
| Expression-key identity | `src/where.c:whereScanNext` expression branch around 366-373 and `whereScanInitIndexExpr`; `src/expr.c:sqlite3ExprCompare` 6564-6650 and `sqlite3ExprCompareSkip` 6682-6689 | Current all-encoding identity discriminators also prove two independent comparison branches: query `lower(a) COLLATE BINARY` must skip top COLLATE and seek while `COLLATE NOCASE` must fail the later physical collation gate; query `b+01` must match indexed `b+1` by resolved numeric literal value/class. TS full-scans the former BINARY case and only uses the first expression field for the latter, with extra candidates/table reads/residuals/sorting. These are correct-row but wrong-path defects. Current all-encoding public self-join evidence fails both expression neighbors: forced `e_expr` returns no rows when the expression is bound to the selected alias and also when identical spelling is bound to the other alias (where pinned SQLite full-scans the forced index); both pinned results are `(1,1)`. An ordinary forced covering `m_abc` self-join control likewise returns no rows rather than pinned `(2,2)`. Direct code comparison localizes the immediate owner: `compileInnerTableSelect` opens only table roots and lowers only selected rowid equality/upper bounds; it never opens or moves a retained selected `PhysicalIndex`. This is not limited to forced access: automatic `m_abc` selection returns `[]` in every encoding while the identical `NOT INDEXED` query returns pinned `(2,2)`. Additionally, `compileInnerTableSelect` emits loop nesting in `expanded.sources` order and only looks up a selected loop by source ordinal; it does not honor `multiWhere.path.loops` order. An all-encoding reversal control returns `[]` for `x JOIN y` when selected constrained `y` must precede a correlated rowid seek of `x`, but returns pinned `(2,2)` for equivalent `y JOIN x` where text and selected order align. A joined selected-corruption control further proves exact identity bypass: forced aligned-order `e_expr` self-joins succeed and return `(1,1)` against corrupt expression-index roots in all encodings, with zero index movement, instead of raising SQLite corruption. Ensure forced `PhysicalIndex`/`KeyInfo` identity reaches cursor opening and preserves selected-path error ordering; a successful table scan is not a forced substitute. |
| Affinity, collation, generated columns | `whereScanInitIndexExpr` (`sqlite3ExprAffinity`); `whereScanNext` affinity/collation gate; generated-expression affinity guard in `expr.c` near 4768 | Expression fields publish expression affinity and resolved built-in collation. Generated-column indexes use exact `ColumnNode` identity and declared affinity/collation; spelling the generation expression is not the column. Expression terms that read generated columns remain ordinary structurally compared index expressions. |
| Join/provenance safety | `where.c:whereUsablePartialIndex` `JT_LTORJ`, `EP_OuterON`, `TERM_VNULL`, `iTab/-1` tests; `whereexpr.c:transferJoinMarkings` and `exprAnalyze` outer/inner ON, `extraRight`, prerequisite and virtual-term branches | Existing `WhereTerm.origin`, masks, parent/child, virtual and `outerJoinSafe` facts are mandatory inputs. Proof never makes a residual omittable. LEFT synthetic-NULL and ON timing remain lowerer-owned; RIGHT/FULL keeps statement-wide fallback. Current public all-encoding evidence finds a concrete branch-matrix divergence: forced `p_live` with `p.c IS NOT NULL` in INNER WHERE or INNER/LEFT ON is admitted by pinned SQLite but rejected by TS in all nine positive cases. LEFT WHERE (too late after null extension) and missing-proof neighbors are correctly rejected. Thus TS currently loses usable implication for joined tables generally, not merely an outer-ON flag. A reversed textual-order control with `p` first still rejects safe INNER-ON proof in all encodings, so this failure precedes path-order lowering. `usablePartialIndex` currently compares whole-expression serialization and additionally requires `term.left.source===source`; split null-test terms do not retain that same left-operand shape. Repair resolved operator/operand implication and provenance against `sqlite3ExprImpliesExpr`, rather than source-order or SQL-shape special cases. |
| Atomic/lifecycle boundary | `where.c:whereLoopAddBtreeIndex` and `whereLoopAddBtree` index iteration/full-scan branches around 4119-4125 and 4232-4243 plus its `nSeek`/`x IN (...)` cost discussion around 3986-3995; `wherecode.c:codeEqualityTerm/sqlite3WhereCodeOneLoopStart`; `expr.c` variable/reprepare comparison branch | Unforced non-proof excludes the expression seek and falls back. A forced unproved partial index rejects before program publication because it is incomplete. A represented non-partial expression index without a matching constraint instead uses the source-shaped forced full-index scan, retains residuals, and looks up the table unless independently covering; it rejects only for a concrete unrepresented physical descriptor or scan/deferred-lookup lowering. RHS bind values may seek, but parameters never prove identity/implication and reset never replans. All-encoding/reset public tests distinguish the forced branches: unproved `p_live` rejects atomically, whereas an `e_expr` structural mismatch performs a truthful complete-index scan with residual table reads and zero index seeks. All nine production-private fields begin at zero for every execution/reset. Each executed index-backed IN probe increments `inProbes`, independently of ordinary/partial/expression index family; non-IN paths (including the four frozen cases and forced full scans) leave it zero. Rejected candidates/paths execute no probes or other execution counters. Malformed schema fails publication; valid unrepresented metadata falls back/rejects; selected physical corruption stays path-local. Independently generated all-encoding corrupt-`p_live` and corrupt-`e_expr` roots now verify both new families specifically: forced selected access fails as SQLite corruption, while the corresponding `NOT INDEXED` table access succeeds both before and after on the same connection. |

This handoff adds no runtime selection or public API. Ordinary immutable TS objects,
exact object references, arrays and tri-state tags adapt upstream structs and
return codes; no exceptional algorithm substitution is proposed. A conservative
`unknown` follows upstream's documented optimization-safety rule and preserves
observable rows through unforced fallback. Validation remains the four zero-credit
partial/expression cases in `stage3-advanced-index.spec.json` across all encodings,
their frozen private expectations, and the focused structural/provenance/limits/
lifecycle matrix specified in `TRANSLATION.md`.

- `src/internal/vdbe.ts` aggregate-predicate ordered scalar producer maps pinned `expr.c:sqlite3CodeSubselect` SRT_Mem NULL initialization/Once/LIMIT-one control and `select.c` sorter destination flow into one shared Program; `test/conformance/aggregate-group-chinook-regressions.test.mjs` and `aggregate-group-lifecycle.test.mjs` cover the hash-gated result, controls, reset, UTF-8/16le/16be, and empty-to-NULL behavior.

- C5 qualified correlated SELECT-list aggregate ownership: pinned
  `resolve.c:lookupName` (linked `NameContext.pNext`, local frame before outer
  frame) and `expr.c:sqlite3CodeSubselect` (`EP_VarSelect` suppresses `OP_Once`;
  child destination/registers remain in the parent VDBE) map to
  `resolve.ts:expandAndResolveSelect` and `vdbe.ts:compileTableSelect`. The
  lowering handoff reconstructs qualified `alias.column` components before
  source-aware binding, preserving the resolved outer cursor, lexical shadowing,
  and parent-VDBE correlation ownership. The pinned observable regression is
  `SELECT Name,(SELECT COUNT(*) FROM Album a WHERE a.ArtistId=ar.ArtistId) FROM
  Artist ar WHERE ar.ArtistId=1` returning typed `AC/DC|2` rather than a missing-
  column error. `expression-subquery-chinook-native.py`,
  `expression-subquery-chinook.test.mjs`, and
  `expression-subquery-composition.test.mjs` cover source identity, exact result,
  typed metadata, UTF-8/UTF-16le/UTF-16be, qualified filtering, multiple aggregate
  children, arithmetic, reset, empty/NULL neighbors, lifecycle, shared work/private
  state, and cleanup. Correction: [[card:card-m-f-k]], commit
  `30894db664433bc3ebaba3b3467963fd34adafdc`.

#### Owner C4 shared REAL decoder

`util.c:sqlite3FpDecode` maps to `mem.ts:sqliteFpDecode`, including 16/20 digit
limits and 17-digit round-trip shortening; `printf.c` etFLOAT/etEXP/etGENERIC
supply `iRound` and altform2 selection. Mem stringification, CAST/columnText,
`func.c` quote, and SQL printf/format consume the same primitive. Source-ID-
pinned native tests use C column access (not CLI rendering) for boundary,
subnormal, Inf and altform2 outputs.

#### C4 etFLOAT/etEXP altform2 callers

`printf.c`'s common `sqlite3FpDecode(..., flag_altform2 ? 20 : 16)` maps through
`fixed` and `exponential` in addition to `generic`. Source-ID-pinned/public cases
cover `%!.20f`, pinned-unsupported `%!.20F`, `%!.20e`, and signed zero-padded
`%!+030.20E`, while prior result/lifecycle and shared REAL accessor gates remain.

### Joined unforced IN fallback source identity ([[card:card-s-c-c-c]])

The later all-encoding unhinted IN fallback review found a source-identity regression in that first exclusion implementation: cloning `ResolvedSource` to set `notIndexed` caused `where-plan.ts:binding` to compute source ordinal −1 from `resolved.sources.indexOf(use.source)` and abort preparation before any scan. `src/where.c` term/source prerequisites retain cursor identity while candidate loop sets are pruned; `src/wherecode.c:codeEqualityTerm` still requires true selected IN restarts if admitted. The planner handoff now passes an `excludedIndexSources` ordinal set into `planWhere`, applying the NOT INDEXED gate only to candidate generation while retaining the original resolved sources, column-use owners and join provenance. This preserves the temporary forced rejection and makes unforced scan fallback executable without substituting a new IN algorithm. Public UTF-8/16LE/16BE first-row/reset/NULL-rebind controls assert unhinted and `NOT INDEXED` rows, zero selected seeks and positive table movement. Focused 4/4 and combined 118/118; no selected-IN or frozen partial/expression credit.

### Joined reverse ORDER coverage clarification ([[card:card-s-c-c-c]])

A review-derived forced `m_abc(a,b,c)` join with `ORDER BY y.b DESC` returned the right three rows but inserted all three into a sorter. Initially a test demanded zero sorter inserts, mistaking a single selected index's locally reversible key order for proven **global joined** ORDER. Inspection of `where-plan.ts:wherePathSolver` shows it deliberately sets `orderTermsSatisfied` to zero whenever `sourceCount>1`; `vdbe.ts:compileInnerTableSelect` consequently retains the sorter, correctly avoiding a false global ORDER claim under its current fixed source-order lowering. Pinned `src/where.c` ORDER proof operates over a whole WherePath and `src/wherecode.c:sqlite3WhereCodeOneLoopStart` reverses a selected loop only once that proof and chosen order allow it. The assertion was corrected to require correct public typed rows, a selected root seek, and retained sorter for this unproved joined ordering, initially and after reset, in all encodings. This is a test-expectation correction, **not** proof of physical reverse cursor movement or a pinned native sorter capture; implementing an ORDER proof requires source-based joined path-order/uniqueness analysis and reverse cursor execution checks. Focused 1/1, combined advanced/shared 98/98; no manifest credit.

### Historical joined selected IN admission gate ([[card:card-s-c-c-c]], superseded)

Pinned `src/wherecode.c:codeEqualityTerm` / `sqlite3WhereCodeOneLoopStart`
requires an IN-loop with a chosen-index seek per member and NULL handling.
At this checkpoint joined `compileInnerTableSelect` lacked restarts: forced
selected IN rejected atomically and unforced selection replanned with that
source `NOT INDEXED` rather than masquerading as selected cursor movement.
Those all-encoding rejection/scan and reset controls prove only the historical
safety fallback. The later selected `codeINTerm`/per-slot mapping below
supersedes the general unsupported-IN claim; selected single-, two- and tested
three-slot joined paths now execute actual index probes. This does not prove
arbitrary vector RHS admission, joined ORDER proof or full native parity.

### Joined IN-list residual source ownership ([[card:card-s-c-c-c]])

Review-derived all-encoding regression `run-advanced-index-ts.test.mjs` exposed `SELECT x.id,y.id FROM m x JOIN m y [INDEXED BY m_abc | NOT INDEXED] ON y.a=x.a WHERE x.id=2 AND y.b IN (1,3) ORDER BY y.id DESC` returning no rows for both paths (pre-repair advanced 42/43). The shared joined `compileInnerTableSelect.resolveTree` recursed into binary nodes but not `in-list`: its left `y.b` retained no source cursor and the residual `Column` read cursor zero (`x.b`). Pinned `src/resolve.c:resolveExprStep` resolves operands within the owning name context and `src/expr.c:sqlite3ExprCodeIN` evaluates the resolved left operand before testing list members. The joined resolver now visits `in-list` left and values, `between` value/limits, `in-subquery` left, and aggregate args, without descending into a nested SELECT's independent name context; this mirrors the existing single-source `assign` recursion. Forced selected and unforced scan both now yield typed `(2,3),(2,1)` initially and after reset in UTF-8/16LE/16BE. This validates residual identity, not selected joined IN-prefix restart/seek counts; the host 3.45.1 sanity result is not a pinned native capture, and no manifest credit changes. Focused 1/1; combined advanced/planner/multisource/WITHOUT ROWID 95/95, manifest 7/7, public first-select 8/8, typecheck and boundary passed (see card status).

### Joined selected-index bound correction ([[card:card-s-c-c-b]])

`src/wherecode.c:sqlite3WhereCodeOneLoopStart` consumes `src/where.c:whereLoopAddBtreeIndex` admitted equality/range terms at the selected loop, after its prerequisites have been positioned. `src/internal/vdbe.ts:compileInnerTableSelect` now seeks the joined selected root with its physical KeyInfo/affinity and tests prefix/range termination before deferred table access, exiting the current loop on mismatch. The shared `storage_values` typed INNER self-join previously exhausted `maxWorkUnits` on unbounded index traversal; the public UTF-8/16LE/16BE regression now completes. Joined IN, arbitrary path reordering and reverse movement remain separate limits; residual predicates still run.

2026-09-29 partial-proof correction: `src/where.c:whereUsablePartialIndex` (3700–3734) passes the indexed table cursor to `src/expr.c:sqlite3ExprImpliesExpr` (6847–6871); `exprImpliesNotNull` (6698–6765) compares the proof *operand* to the target. `src/internal/where-plan.ts:partialProofIdentity` now requires a resolved use on the indexed source and matching declared column rather than a last-name collision across joined sources. Public `run-advanced-index-ts.test.mjs` joined same-name nullable p.c versus m.c discriminator checks UTF-8/UTF-16LE/UTF-16BE, reversed and LEFT join, reset and forced atomic rejection. This is a bounded proof correction, not new selected-access credit.

#### Bounded joined selected IN-prefix handoff ([[card:card-s-c-d-a]])

`wherecode.c:codeINTerm` (around 660–803) advances a distinct RHS cursor and
restarts its chosen index seek; `expr.c:sqlite3CodeRhsOfIN` (around 3592–3810)
materializes the list with `IdxInsert`, suppressing duplicate keys. In the
currently bounded multi-source `compileInnerTableSelect` path, a single-field
selected IN equality prefix now retains an `InListValue` iterator and seeks the
selected physical index per distinct non-NULL affinity/coercion + KeyInfo
collation key; probe exhaustion restarts the iterator, while iterator exhaustion
runs the level's LEFT unmatched/outer continuation. RHS expressions are computed
per outer entry, so reset/rebind cannot reuse the last entry's values. The
in-memory register list plus comparison on each advance (rather than a second
B-tree cursor) is a browser/TS representation adaptation for this bounded RHS:
it retains SQLite's set-valued keys and NULL omission, but costs O(n²) instead
of ephemeral-index insertion. `run-advanced-index-ts.test.mjs`'s demanded joined
forced IN test covers selected seeks, NULL, duplicate keys, rebinding and LEFT
null-row/matched-once transitions across captured encodings. This does not
implement composite/ranged IN, cost/statistic parity or all RHS subqueries;
those candidates remain excluded/rejected. Native side-by-side oracle coverage
of this particular joined branch is still outstanding.

### IN-only/range/stat choice evidence ([[card:card-s-c-d-c]])

`test/conformance/cases/in-range-stat-native.json` and `test/conformance/fixtures/in-range-stat-*.db` are pinned 3.53.4, three-encoding before/after ANALYZE snapshots. Generator `test/conformance/capture-in-range-stat.py` builds only in development and captures read-only; `in-range-stat-native.test.py` asserts physical selected `t_ab` range/IN RHS VDBE loop versus `NOT INDEXED` scan, and a separate stat1-driven **chosen** access change (`t_a` before, covering `t_ab` after). Public `in-range-stat-ts.test.mjs` checks typed scan and atomic temporary rejection of selected composite IN, not optimizer credit. Source: `src/where.c:whereLoopAddBtreeIndex`, `whereInScanEst`, `whereRangeScanEst`; `src/wherecode.c:codeINTerm` (IN_INDEX_LOOP, RHS cursor Rewind/Next), `sqlite3WhereCodeOneLoopStart`; `src/analyze.c` stat1 format/`analysisLoader` and optional STAT4 paths. Pinned native build has no STAT4; no STAT4 selected-choice comparison was obtained. W3 stat4 gating remains unchanged. See `docs/CONFORMANCE.md` for numerical discriminators.

Selected composite single-IN-slot/range follow-up (2026-09-29): pinned
`wherecode.c:codeINTerm`/index loop restart and `where.c:whereLoopAddBtreeIndex`
map to `src/internal/vdbe.ts:compileTableSelect` (`InListValue`, composite
`IndexSeekPrefix`, `IndexPrefixEnd`, `IndexRangeEnd`). `whereexpr.c:exprAnalyze`
RHS prerequisites originate in `src/internal/where-plan.ts`. In-memory set
iteration substitutes for ephemeral RHS cursor (browser-safe finite list), with
KeyInfo term affinity/collation comparison and NULL/duplicate filtering; typed
three-encoding pinned differential and selected seeks are asserted by
`test/conformance/in-range-selected-red.test.mjs`. Multi-IN nesting, joined
composite lowering and statistics parity are not established by this mapping.

2026-09-29 joined selected IN correction: the historical joined gate above now
applies to multiple selected IN equality slots only. Pinned
`wherecode.c:codeEqualityTerm/codeINTerm`, `sqlite3WhereCodeOneLoopStart` and
`sqlite3WhereEnd` map to `vdbe.ts:compileInnerTableSelect` per-source IN iterator,
composite IndexSeekPrefix and end-check restart, with per-level LEFT unmatched
handling and `whereexpr.c:exprAnalyze` prerequisite mask. Single IN prefix/range
public comparisons across the six frozen fixture states and selected seeks are
in `test/conformance/in-range-selected-red.test.mjs`; the advanced-index public
reset/rebind neighbor replaces the older fallback expectation. Finite in-memory
RHS set (rather than ephemeral Btree) remains the browser-safe substitution;
multiple IN nesting and general native stats/ORDER parity remain open.

`src/wherecode.c:codeINTerm` and `src/expr.c:sqlite3CodeRhsOfIN` maintain a
Btree-backed RHS cursor. The TypeScript `vdbe.ts:InListValue` finite set
substitution checks work before every candidate/prior-key comparison and uses
`finally` to release both temporary Mem values. Source-based checks in
`in-range-selected-red.test.mjs` establish a real selected seek preceding a
`maxWorkUnits` limit on 180 duplicate RHS values, independent of six-fixture
selected/off-path malformed index-root isolation; no general Btree work parity
is asserted.

`wherecode.c:codeINTerm` records each selected equality IN cursor; `where.c:
sqlite3WhereEnd` iterates `aInLoop` from last to first and rewinds inner
cursors when advancing an outer one. `vdbe.ts:compileInnerTableSelect` and the
single-table selected caller lower per-slot `InListValue` probes, resetting
inner registers on outer advancement and targeting the innermost probe on
seek/prefix/end jumps. The six frozen encoding/state tests prove two-slot
forced/unforced and LEFT cases. Separate UTF-8/16le/16be advanced-index tests
exercise three selected slots, single-table rebind and joined LEFT selected
seeks with expected IDs. The independent manifest-pinned read-only capture
`capture-three-in.py` / `cases/three-in-native.json` now freezes those exact
three-slot single/LEFT queries (and an extra LEFT unmatched neighbor plus
NOT INDEXED scan control) for all three
advanced-index encodings: fixture SHA-256, `m`/`m_abc` roots, typed ordered rows,
EQP, relevant RHS cursor/seek VDBE operations and bounded native stmt counters.
`three-in-native.test.py` asserts native root/cursor/scan structure;
`capture-three-in.py` also steps both parameter sets on the same native prepared
statement after reset/clear bindings; `three-in-native-ts.test.mjs` compares the same SQL, fresh/reset-rebound typed
public rows and selected probe vs scan work, including off-path scan and
selected-root corruption (SQLite code 11) on disposable byte mutations. This does not prove arbitrary
multi-IN, optimizer cost, or ORDER parity. Unsupported RHS/vector shapes must
still reject atomically.

`expr.c:sqlite3CodeRhsOfIN` inserts list cells into a KeyInfo ephemeral Btree;
`wherecode.c:codeINTerm` flips `bRev` on descending index columns and reads
that RHS cursor in sorted order. `vdbe.ts:InListValue` caches a bounded ordered
Mem set per RHS index register (field collation/affinity and physical direction)
until `Integer` resets the register or VDBE halt; two selected-index callers
supply slot direction. Frozen-six unsorted RHS row-order tests in
`in-range-selected-red.test.mjs` were independently compared against pinned
native 3.53.4 on the existing read-only fixtures.

Immutable stat-choice slice ([[card:card-s-c-d-f]]): `analyze.c:sqlite3AnalysisLoad/analysisLoader/decodeIntArray` -> `schema.ts:statisticsForIndex/sqliteLogEst/loadSchemaGraph` (represented index stat1 rows, encoding-aware immutable b-tree read). [[card:card-s-c-d-k]] checks the callback-text vs stored BLOB stat1 boundary: matched non-NULL BLOB estimates reject before planning instead of being skipped; `test/conformance/stat-record-boundary.{py,test.mjs}` pins three-encoding BLOB `sz=` native rows and public prepare rejection, while unmatched-table rows remain skippable. `build.c:sqlite3DefaultRowEst` and `where.c:whereLoopAddBtreeIndex/whereLoopAdjustCost/wherePathSolver/whereSortingCost` -> `where-plan.ts:indexLoopEstimate/adjustIndexSubsets/wherePathSolver` (bounded prefix/IN/sort costs). `test/conformance/in-range-stat-choice-red.test.mjs` compares six frozen pinned choices and forced controls. Not mapped: STAT4 samples, general `whereLoopInsert` pruning and `wherePathSatisfiesOrderBy` for joins. Pinned 3.53.4 EXPLAIN on advanced-index fixture selects the join equality, not the competing IN slot, in `run-advanced-index-ts.test.mjs`'s joined forced single-field case.

[[card:card-s-c-d-f]] follow-up: `src/where.c:whereLoopCheaperProperSubset`
case 1 permits same-index shorter-prefix subsets without term-identity equality;
`where-plan.ts:adjustIndexSubsets` now reflects that branch. Case 2 now compares represented admitted term identity and covering eligibility;
`whereLoopAdjustCost` adjusts a candidate against previously inserted loops in
order. `whereLoopInsert/whereLoopFindLesser` replacement/discard remains unmapped.
`whereLoopAddBtreeIndex` stat1 IN gating distinguishes indexed seek from
seek-scan/normal scan; neither alternate path is represented by a fabricated
cost penalty. Frozen stat-choice 6/6 is not composite-IN access parity.

[[card:card-s-c-d-f]] bounded follow-up: `src/where.c:whereBegin` two-pass
`wherePathSolver` and `whereSortingCost` ordinary ORDER BY cost now map to
`src/internal/where-plan.ts` first-pass unsorted cardinality and second-pass
sort costing; `wherePathSatisfiesOrderBy` IN-prefix matching also tracks index
reverse direction. Frozen stat-choice tests pass 6/6 but selected-access red
suite remains red (42/52 combined), so candidate insertion, widths, output
adjustment and join ordering are not established. See `docs/TRANSLATION.md`.

- Scalar child LIMIT initialization (`src/expr.c:sqlite3CodeSubselect`,
  `src/select.c:computeLimitRegisters` and `selectInnerLoop`): the table-backed
  correlated child producer now initializes its Mem/Exists result before a
  child-local LIMIT guard and patches zero-limit to bypass the scan and result
  disposal. `test/conformance/select-scalar-child-native.py` and `.test.mjs`
  compare pinned/public typed NULL/0 and names through reset/finalize. For
  SRT_Set (`select.c:selectInnerLoop`), a nonzero LIMIT decrements after each
  inserted row; the correlated IN producer now exits its scan after the
  corresponding insertion, not merely on the zero guard. These changes
  repair behavioral divergences in the existing parent-Program child producer,
  **not** the separate scalar child Program splice: the latter still relocates
  finished table/aggregate children and the structural test remains red.

- FROM-less IN child destination (`src/expr.c:sqlite3CodeSubselect` SRT_Set,
  `src/select.c:selectInnerLoop` SRT_Set): `compileScalarSelect` now emits
  the one-row no-FROM RHS into the enclosing builder's own ephemeral cursor,
  inserts its result before probing with `InSet`, and shares the register/VM
  budget. This replaces the former atomic unsupported rejection only for
  no-WHERE/no-ORDER/no-compound single-result children, including LIMIT 0/1
  with SRT_Set opened before the zero guard and probe after it. Scalar Mem
  initializes before its child LIMIT guard. `src/select.c:codeOffset` /
  `selectInnerLoop` now map to `IfPos` before no-FROM Mem/Exists/Set
  projection, skipping the sole candidate for OFFSET 1 without consuming
  LIMIT or bypassing the outer probe. Pinned source-ID/public paired
  `select-scalar-child-native.py` / `.test.mjs` cover LIMIT 0/1 OFFSET 0/1,
  typed results, metadata and reset/finalize. `expr.c:sqlite3CompareAffinity`
  and `comparisonAffinity` determine the IN comparison affinity from both
  operands, not a constant BLOB; the no-FROM child now uses that semantic
  owner for its `InSet` probe. Source-ID
  paired `select-scalar-child-native.py`/`.test.mjs` cover IN, NOT IN, RHS
  NULL, names/types and reset/finalize. Table and aggregate child Programs
  still require relocation; this is a bounded producer/caller migration,
  **not** completion of the scalar structural contract.

- Incremental SELECT destination/allocation seam (`src/select.c:sqlite3SelectDestInit`,
  `selectInnerLoop` SRT_Mem/Exists/Output; `src/expr.c:sqlite3CodeSubselect`):
  `src/internal/select-program.ts` and `src/internal/vdbe.ts:compileScalarSelect`.
  Scalar child and output register spans now use the shared builder; child
  Program splice/relocation remains a temporary divergence, not a translation
  of the shared Parse/Vdbe compilation path. See `docs/research/card-t-b-select-entry.md`.

- Grouped aggregate range consumption (`src/select.c:selectInnerLoop` output,
  `src/expr.c:sqlite3ExprCode*`, `src/vdbeaux.c` instruction building):
  `src/internal/vdbe.ts:compileAggregateSelect` now reserves all aggregate
  scratch spans through `SelectProgramBuilder.range` and publishes its count.
  Source-first read-only paired check: `test/conformance/select-aggregate-destination-native.py`
  and `test/conformance/select-aggregate-destination.test.mjs`. Other producers,
  cursor/jump ownership and nested child splicing remain incomplete.

- Recursive CTE Queue/Distinct cursor and queue-exhaustion label:
  pinned `src/select.c:generateWithRecursiveQuery` allocates Queue then optional
  immediately adjacent Distinct cursor, and branches on queue exhaustion.
  `src/internal/vdbe.ts:compileRecursiveCteSelect` now allocates them through
  `SelectProgramBuilder.cursor()` (reserving cursor 0 for this VM's existing
  convention), allocates priority key registers via `range()`, and resolves
  the queue-empty label at `finish()`. Output continues through
  `emitSelectDestination`; other arm/limit fixups are still direct.
  Paired probes: `test/conformance/select-recursive-builder-native.py` and
  `.test.mjs`; see `docs/research/card-t-b-select-entry.md` for coverage limits.

- `src/expr.c:comparisonAffinity` -> `src/internal/vdbe.ts:comparisonAffinity`:
  both parent-owned no-FROM and still-spliced table SRT_Set consumers derive
  affinity from left and RHS projection expressions; result metadata's
  declaredType is not expression affinity (CAST projections). Pinned/public
  paired probe: `test/conformance/select-scalar-child-native.py` / `.test.mjs`.
  This does not remove the completed-child splice.

- `src/select.c:sqlite3Select`/`selectInnerLoop` with `src/expr.c:sqlite3CodeSubselect`
  -> `src/internal/vdbe.ts:compileScalarSelect` direct one-table column/rowid
  child, shared `SelectProgramBuilder` cursor/register ranges and Mem/Exists/Set
  destination, LIMIT-zero before Rewind and outer IN probe after set production.
  `expandAndResolveSelect` supplies the `resolve.c:NameContext` direct result.
  Paired tests: `test/conformance/select-scalar-child-native.py` and `.test.mjs`.
  Other table/aggregate child programs still require relocation; structural
  integration remains open.

- `src/where.c:sqlite3WhereCodeOneLoopStart` + `src/select.c:selectInnerLoop`
  -> parent-owned direct table-child WHERE in `compileScalarSelect`: resolver
  column-use identities bind cursor operands; false/NULL predicates advance
  before destination emission and child LIMIT accounting. Pinned/public
  scalar-child differential includes filtered Mem/Exists/Set, zero and one LIMIT.
  Aggregate and correlated child relocation remains unresolved.

- `src/select.c:selectInnerLoop` / `pushOntoSorter` / `generateSortTail`
  + `src/expr.c:sqlite3CodeSubselect` -> bounded direct table child single-key
  ORDER BY sorter scan and drain in `src/internal/vdbe.ts:compileScalarSelect`.
  Resolved result ordinal/alias or direct source-column keys use the parent's
  cursor/register allocation and Mem/Exists/Set destinations, with child LIMIT
  after sorter output and WHERE before sorter insertion. The direct no-FROM and
  direct single-table IN producers now route their set insertion through
  `select-program.ts:emitSelectDestination`'s bounded `set` destination (one
  column, existing ephemeral cursor), like `select.c:selectInnerLoop` SRT_Set;
  this changes ownership of emission, not the remaining compiler splice.
  Other keys retain the
  completed-child fallback. Source-ID-checked native and public scalar-child
  probes cover ASC/DESC, LIMIT 0/1/2, sibling destinations, types, names,
  two reset iterations and finalize. Unfiltered structural assertion remains red
  on admitted aggregate/table completed-child relocation.

- `src/expr.c:sqlite3CodeRhsOfIN` SRT_Set and `src/select.c:selectInnerLoop`
  OFFSET/LIMIT handling -> bounded aggregate-parent one-table direct-column
  `compileAggregateSubquery` IN producer emits into shared set destination
  after `computeLimitRegisters` and before the outer probe. Source-ID/public
  `select-scalar-child-native.py` and `.test.mjs` pair count(*)-3 IN
  LIMIT 0/1/1 OFFSET 1 (types, names, reset/finalize). This is one consumer;
  scalar-parent child Program relocation remains red.

- `src/expr.c:sqlite3CodeSubselect` SRT_Exists initialization/LIMIT and
  `src/select.c:selectInnerLoop` OFFSET before destination -> bounded
  aggregate-parent `compileAggregateSubquery` EXISTS guard and offset in
  `src/internal/vdbe.ts`; pinned-oracle/public count(*) WHERE EXISTS
  LIMIT 0/1/1 OFFSET 4 in `select-scalar-child-native.py` and
  `select-scalar-child.test.mjs` (typed rows, names, reset). This remains a
  separate consumer route; it is not a shared child compiler migration.

- `src/resolve.c:resolveExprStep` (`TK_SELECT`/`TK_EXISTS`/`TK_IN`) and
  `resolveSelectStep` (`NC_HasAgg`) -> `src/internal/vdbe.ts:selectHasAggregate`:
  child SELECT aggregates no longer classify the parent; the `TK_IN` left
  operand does. Source-shaped ownership is checked in
  `test/conformance/select-aggregate-ownership.test.mjs`; paired
  `select-scalar-child-native.py`/`.test.mjs` exercise an admitted
  count/EXISTS/IN child. Aggregate-valued IN left operands now lower through the aggregate producer's
  output register entries before `expr.c:sqlite3ExprCodeIN`-like probing,
  source-ID/public-tested for count(*) against a one-column child (see guide);
  completed-child relocation remains.

- `src/select.c:sqlite3Select` / `flattenSubquery`,
  `src/build.c:sqlite3ViewGetColumnNames`, `src/expr.c:sqlite3CodeSubselect`
  -> bounded immutable-view scalar/Exists/IN child in
  `src/internal/vdbe.ts:compileScalarSelect`: existing view substitution
  feeds the same parent-owned direct scan and Mem/Exists/Set destination;
  the view source alias qualifies substituted leaves rather than blocking
  flattening. Paired `select-scalar-child-native.py` / `.test.mjs` cover
  named/inferred columns, qualified aliases, inner/outer WHERE, ORDER/LIMIT,
  typed metadata and reset. Nonflattenable view children remain on fallback.

- `src/select.c:flattenSubquery` / `selectInnerLoop`,
  `src/resolve.c` direct NameContext binding, `src/expr.c:sqlite3CodeSubselect`
  -> bounded single-source derived scalar/Exists/IN children in
  `src/internal/vdbe.ts:compileScalarSelect`. Substitution reads qualified
  Lemon leaves and synchronizes ExprNode tokens with replaced reductions so
  direct resolution sees the underlying source; predicate conjunction then
  feeds the parent-owned direct scan, allocations and destination.
  Paired `select-scalar-child-native.py` / `.test.mjs` cover qualified and
  unqualified ORDER/OFFSET, LIMIT zero, combined WHERE, typed rows and reset.
  Nonflattenable producers remain on fallback.

- `src/select.c:multiSelectByMerge` / `multiSelectByMergeKeyInfo`
  ordered set compound, `src/expr.c:sqlite3CodeSubselect` Mem/Exists/Set ->
  bounded one-column no-source ordered set child in
  `src/internal/vdbe.ts:compileScalarSelect`. Parent-owned typed set cursor
  first eliminates/deletes/intersects, then parent-owned sorter applies the
  resolved single result-column ORDER key before LIMIT/OFFSET and destination.
  Budgeted async cursors adapt pinned merge coroutines for finite constant
  arms. Paired `select-scalar-child-native.py` / `.test.mjs` cover ordered
  typed/null/limit/reset branches. Ordered mixed and source-backed arms remain
  on fallback; no general merge parity is claimed.

- `src/select.c:multiSelect` set prefix followed by unordered UNION ALL
  shares `SelectDest` and LIMIT/OFFSET between merge and trailing arms ->
  `src/internal/vdbe.ts:compileScalarSelect` drains the parent-owned typed
  cursor before trailing constant rows and patches scalar/Exists exits past
  the whole child. Paired `select-scalar-child-native.py` / `.test.mjs` cover
  empty-prefix, duplicates, offset, typed destinations and reset. Ordered
  set and source-backed producers remain unmigrated.

- `src/select.c:multiSelect` / `multiSelectByMerge` set-compound
  UNION/EXCEPT/INTERSECT, `src/expr.c:sqlite3CodeSubselect` shared
  Mem/Exists/Set -> bounded single-column no-source unordered child
  producer and caller in `src/internal/vdbe.ts:compileScalarSelect`.
  Parent-owned typed ephemeral cursors implement insert/delete/intersection
  and sorted drain; budgeted async cursors adapt SQLite merge coroutines for
  finite constant arms. Paired `select-scalar-child-native.py` / `.test.mjs`
  cover duplicate/null/typed results, destination kinds and reset. Ordered,
  mixed and source-backed set producers remain on the audited fallback.

- `src/select.c:multiSelectByMerge` ordered compound shared SelectDest,
  `src/expr.c:sqlite3CodeSubselect` Mem/Exists/Set -> bounded constant
  single-column UNION ALL child with one resolved result key in the enclosing
  `src/internal/vdbe.ts:compileScalarSelect` builder. Budgeted typed sorter
  substitutes for two SQLite coroutines on finite constant arms; paired
  `select-scalar-child-native.py` / `.test.mjs` compare sorted typed rows,
  names and resets. Source-backed/multi-key/set operators remain unmigrated.

- `src/select.c:multiSelect` unordered UNION ALL shared limit iLimit
  zero branch before offset coercion -> `src/internal/vdbe.ts` shared
  `computeLimitRegisters` early-zero branch; pinned/public
  `select-scalar-child-native.py` / `.test.mjs` exercise
  `LIMIT 0 OFFSET 'bad'` NULL/INTEGER 0 and reset.

- `src/select.c:multiSelect` unordered UNION ALL left/right SelectDest,
  `src/expr.c:sqlite3CodeSubselect` Mem/Exists/Set ->
  `src/internal/vdbe.ts:compileScalarSelect` bounded single-column no-FROM
  non-aggregate/non-window compound arm emission into the enclosing builder;
  pinned/public `select-scalar-child-native.py` / `.test.mjs` check
  INTEGER/NULL, metadata and reset. Table-backed and ordered compound
  consumers still require separate migration.

- `src/select.c:multiSelectValues/selectInnerLoop`,
  `src/expr.c:sqlite3CodeSubselect` SRT_Mem/Exists/Set ->
  `src/internal/vdbe.ts:compileScalarSelect` bounded single-column VALUES
  child uses the enclosing builder for each constant row, set cursor and
  destination. Pinned/public `select-scalar-child-native.py` / `.test.mjs`
  compare INTEGER/NULL, metadata and reset; general compounds remain outside
  this branch.

- `src/expr.c:sqlite3ExprCodeTarget` TK_CASE branch/base/WHEN/THEN/ELSE,
  `src/resolve.c:resolveExprStep` child NameContext ->
  `src/internal/vdbe.ts:compileScalarSelect` bounded one-source CASE
  projection binder. Parent builder owns CASE registers and the eventual
  Mem/Exists/Set destination; paired pinned/public
  `select-scalar-child-native.py` / `.test.mjs` compare searched and simple
  CASE typed rows, metadata and reset. Nested-subquery/multi-source children
  are not migrated.

- `src/resolve.c:resolveOrderGroupBy` unmatched ordinary ORDER expression,
  `src/select.c:selectInnerLoop` sorter key/payload ->
  `src/internal/vdbe.ts:compileScalarSelect` bounded one-source child binds
  the ORDER expression in the child NameContext and builds its key independently
  of the projected payload in the enclosing builder. Pinned/public
  `select-scalar-child-native.py` / `.test.mjs` compare typed `x+2 ORDER BY
  x*2 DESC LIMIT/OFFSET` Mem/Exists/Set, metadata and reset. Other producers
  retain the audited fallback.

- `src/expr.c:sqlite3ExprCodeTarget` TK_COLLATE operand and
  `src/resolve.c:resolveExprStep` collated NameContext use -> bounded collated
  one-source child result binding in `src/internal/vdbe.ts`. Parent builder
  retains projection, DISTINCT, sorter and destination. Pinned/public
  `select-scalar-child-native.py` / `.test.mjs` compare collated INTEGER and
  CAST TEXT projections with LIMIT/OFFSET and IN; other child shapes retain
  their fallback.

- `src/resolve.c:resolveOrderGroupBy` alias/ordinal/result-expression ORDER,
  `src/select.c:selectInnerLoop` sorter key/result production ->
  `src/internal/vdbe.ts:compileScalarSelect` one-source expression child:
  result-expression ORDER copies its bound projected register into the sorter
  key, direct column ORDER loads its own key, DISTINCT still precedes sorter;
  builder owns key/payload/cursor and SRT destination. Other ORDER producers
  are not migrated. Pinned/public `select-scalar-child-native.py` / `.test.mjs`
  compare typed `x+1` ORDER by expression/ordinal/alias, DISTINCT,
  LIMIT/OFFSET, scalar/IN/EXISTS, names and reset.

- `src/resolve.c:NameContext` child result/predicate binding,
  `src/select.c:selectInnerLoop` projection before DISTINCT/OFFSET then SRT ->
  `src/internal/vdbe.ts:compileScalarSelect` one-source expression child:
  resolved result column uses bind into its builder cursor; expression VM
  projects into its builder registers, reusing the DISTINCT result for sorter
  payload/SRT. Single-column or ordinal ORDER only; other producers remain.
  Pinned/public `select-scalar-child-native.py` / `.test.mjs` compare `x+1`
  with WHERE, DISTINCT, descending ORDER, LIMIT/OFFSET, Mem/Exists/Set,
  typed rows, names and reset.

- `src/select.c:computeLimitRegisters` and `src/vdbe.c:OP_OffsetLimit`
  -> `src/internal/vdbe.ts:computeLimitRegisters` and interim completed-child
  register relocation of all three OffsetLimit operands; pinned/public
  `select-scalar-child-native.py` / `.test.mjs` compare two-source child
  ORDER/LIMIT/OFFSET with Mem/Exists/Set and reset. **Not yet parent-owned**;
  this relocation must retire when multi-source child producer migrates.

- `src/select.c:sqlite3Select` grouped multi-source producer /
  `selectInnerLoop` SRT_Mem/Exists/Set and `src/expr.c:sqlite3CodeSubselect`
  -> `src/internal/vdbe.ts:compileAggregateSelect` parent builder consumed by
  `compileScalarSelect` for bounded multi-source grouped children; paired
  `select-scalar-child-native.py` / `.test.mjs` compare join predicate, HAVING,
  ORDER/LIMIT/OFFSET, zero/empty groups, types/names/reset. Other fallback
  children remain.

- `src/resolve.c:resolveOrderGroupBy`, `src/select.c:selectInnerLoop`,
  `src/expr.c:sqlite3CodeSubselect` -> bounded one-candidate no-FROM
  child ORDER result alias/ordinal/expression in `compileScalarSelect`;
  enclosing Mem/Exists/Set and LIMIT/OFFSET remain shared. An independent
  ORDER key is not elided. Paired `select-scalar-child-native.py` / `.test.mjs`
  check typed rows/names, WHERE, LIMIT/OFFSET and reset; completed-child
  fallbacks remain.

- `src/select.c:sqlite3Select` / `computeLimitRegisters` early integer-zero
  exit before OFFSET and `sqlite3WhereBegin` / `selectInnerLoop` ->
  `src/internal/vdbe.ts:computeLimitRegisters` now places the zero exit before
  OFFSET for all bounded callers instead of treating compound SELECT as an
  exception. Existing parent-owned single-source child Mem/Exists/Set and IN
  probe retain their destination; completed-child fallbacks remain.
  Pinned/public `select-scalar-child-native.py` / `.test.mjs` compare
  aliased view-derived child and top-level no-FROM/table LIMIT 0 OFFSET NULL,
  typed metadata and reset. Other shape combinations remain unclaimed.

- `src/select.c:sqlite3Select` zero-source `sqlite3WhereBegin` /
  `selectInnerLoop` and `src/expr.c:sqlite3CodeSubselect` ->
  `src/internal/vdbe.ts:compileScalarSelect` parent-owned one-row WHERE
  predicate: false/NULL branches over OFFSET and SRT_Mem/Exists/Set candidate
  while LIMIT setup and destination initialization precede candidate testing.
  The integer-zero LIMIT branch precedes OFFSET coercion as in
  `src/select.c:computeLimitRegisters`. Paired
  `select-scalar-child-native.py` / `.test.mjs` cover scalar/EXISTS/IN,
  NULL/INTEGER, LIMIT-zero/OFFSET NULL, names and reset.

- `src/select.c:selectInnerLoop` result DISTINCT before OFFSET/SRT and
  `src/expr.c:sqlite3CodeSubselect` enclosing destination ->
  `src/internal/vdbe.ts:compileScalarSelect` no-FROM one-row child: DISTINCT
  cannot duplicate its sole candidate, so no ephemeral is needed; existing
  builder-owned LIMIT/OFFSET and Mem/Exists/Set remain. Pinned/public
  `select-scalar-child-native.py` / `.test.mjs` pair LIMIT 0/1 OFFSET 0/1,
  typed rows, names and reset. Other child shapes are not implied.

- `src/select.c:sqlite3Select` result DISTINCT ephemeral / `selectInnerLoop`
  duplicate branch before OFFSET and `generateSortTail` sorted OFFSET ->
  `src/internal/vdbe.ts:compileScalarSelect` direct one-table child: builder
  cursor, typed projected key `Found`/`IdxInsert`, duplicates skip to Next
  without consuming LIMIT/OFFSET; Mem/Exists/Set and sorter drain stay in
  enclosing Program. Pinned/public `select-scalar-child-native.py` / `.test.mjs`
  pair unsorted/sorted WHERE, LIMIT and OFFSET, typed rows, metadata, reset.
  Other table shapes still use completed-Program relocation.

- `src/select.c:sqlite3Select` result DISTINCT ephemeral / `selectInnerLoop`
  duplicate check before OFFSET/SRT, `src/expr.c:sqlite3CodeSubselect` enclosing
  Mem/Exists/Set -> `src/internal/vdbe.ts:compileAggregateSelect` no-GROUP
  parent-owned result DISTINCT: builder cursor, reserved output register
  `Found`/`IdxInsert`, duplicate jump past destination. Pinned/public paired
  `select-scalar-child-native.py` / `.test.mjs` check LIMIT 0/1 OFFSET 1 and
  filtered empty count, typed rows, names and reset. This does not imply
  general aggregate-child or accumulator-DISTINCT ownership.

- `src/expr.c:sqlite3CodeSubselect` SRT_Mem/Exists/Set and
  `src/select.c:sqlite3Select` group sorter / `selectInnerLoop` ->
  `src/internal/vdbe.ts:compileScalarSelect` calling
  `compileAggregateSelect` in the enclosing `SelectProgramBuilder` for
  single-source `simpleGroupShape` children; group
  projection uses its builder-owned output range, the group sorter and
  optional result DISTINCT ephemeral allocate cursors, and `Found`/`IdxInsert`
  consume the projection's reserved register range before OFFSET and SRT
  emission. The bounded result ORDER sorter likewise allocates a builder
  cursor, inserts projected keys/payload, drains to the reserved range and
  emits to the caller's SRT after OFFSET. Pinned/public paired ORDER and
  DISTINCT group Mem/Exists/Set probes cover LIMIT, OFFSET, HAVING, typed
  results, names and reset. HAVING/OFFSET/LIMIT retain emission order and no child Halt is
  published. Pinned/public `select-scalar-child-native.py` / `.test.mjs`
  pair group Mem/Exists/Set typed rows, names, reset/finalize. Other
  admitted child plans still relocate finished Programs.

- `src/select.c:selectInnerLoop` / `codeOffset` and sorter tail ->
  `src/internal/vdbe.ts:compileScalarSelect` direct one-table child
  `computeLimitRegisters` / `IfPos` at qualifying-row and sorted-drain
  transitions. `src/expr.c:sqlite3CodeSubselect` supplies the enclosing
  Mem/Exists/Set destinations and builder allocations. Pinned/public
  `select-scalar-child-native.py` / `.test.mjs` pair WHERE, sorted OFFSET and
  LIMIT 0 OFFSET (typed rows, names, two resets/finalize). Other child
  producers still use completed-Program relocation; no general ownership claim.

- `src/expr.c:sqlite3CodeSubselect` / `src/select.c:sqlite3Select` shared
  `Parse.nTab` nested cursor ownership -> `src/internal/select-program.ts`
  `SelectProgramBuilder.reserveCursorsThrough` and
  `src/internal/vdbe.ts:compileAggregateSubquery`: reserve the aggregate
  parent's still-fixed source/sorter/modifier range and allocate EXISTS/IN/
  scalar-child cursors from the parent builder. Pinned/public paired
  `select-scalar-child-native.py`/`.test.mjs` includes a simultaneous EXISTS
  predicate and IN projection. This does not replace completed scalar-parent
  child Programs or manual relocation; structural reproducer remains red.

- Partial aggregate-child LIMIT producer: pinned `src/select.c:computeLimitRegisters`, `selectInnerLoop` SRT_Mem/Exists/Set and `src/expr.c:sqlite3CodeSubselect` initialize destination before row production. `src/internal/vdbe.ts:compileAggregateSelect` now gates no-GROUP accumulator scanning on LIMIT 0 and skips its single final output on OFFSET; paired `test/conformance/select-scalar-child-native.py` / `.test.mjs` compare scalar/EXISTS/IN rows, types, names, reset. Scalar caller still relocates a finished child Program; parent-owned compilation remains outstanding.

- `src/expr.c:sqlite3CodeSubselect` -> `src/select.c:sqlite3Select` /
  `flattenSubquery` -> `src/internal/vdbe.ts:compileAggregateSelect`: bounded
  derived/immutable-view recursive compilation forwards the enclosing
  builder/destination instead of dropping it. This is only forwarding for
  the no-GROUP path; pinned/public `select-scalar-child-native.py` and
  `.test.mjs` pair scalar/Exists/IN derived counts, filtered rows, LIMIT/OFFSET,
  typed names and reset/finalize. The aggregate flattening result-name map
  now uses `expressionName` (as ordinary flattening does), not synthetic
  `columnN`, so qualified `d.x` substitutes its bound source expression;
  both qualified and unqualified predicates are paired. Other completed-Program
  child splices remain unmigrated.

- Joined no-GROUP aggregate child (bounded): pinned
  `src/select.c:sqlite3Select` no-GROUP `sqlite3WhereBegin` /
  `updateAccumulator` / `sqlite3WhereEnd` / `finalizeAggFunctions`,
  `src/expr.c:sqlite3CodeSubselect` destination initialization ->
  `src/internal/vdbe.ts:compileAggregateSelect` enclosing builder, nested
  source cursor Rewind/Next and `emitSelectDestination`. Paired
  `select-scalar-child-native.py` / `.test.mjs` check ON/WHERE/HAVING,
  empty input, scalar/Exists/IN, LIMIT/OFFSET and reset/finalize. Not a
  general join ownership claim; nonaggregate child relocation remains.

- Joined rowid equality child, interim: `src/wherecode.c` rowid seek and
  `src/select.c:sqlite3Select` / `selectInnerLoop` destination ->
  `src/internal/vdbe.ts:compileInnerTableSelect` produces `SeekRowid`;
  `compileScalarSelect` still relocates its cursor, key register and exit PC
  into the enclosing program. `test/conformance/select-scalar-child-native.py`
  / `.test.mjs` pair rowid-equality join Mem/Exists/Set and resets. This is
  not yet a source-owned joined child builder/destination; structural assertion
  remains red.

- Ordered nonflattenable one-table LIMIT producer and outer WHERE:
  pinned `src/select.c:flattenSubquery` restriction (19), `selectInnerLoop`
  sorter insertion/drain and `src/expr.c:sqlite3CodeSubselect` Mem/Exists/Set
  -> `src/internal/vdbe.ts:compileScalarSelect` binds producer ORDER alias or
  ordinal, retains bounded top-N sorted projected payload, applies producer
  LIMIT before outer WHERE at drain, then delivers the caller destination.
  The caller selects one matching producer EList expression; producer width
  can exceed one because ORDER is bound to its own EList before drain. Only
  selected value reaches the caller destination. For an outer predicate on
  another direct producer column, `compileScalarSelect` binds the substituted
  column to the single resolved source, stores it beside the selected value
  in the producer sorter payload and tests it on the sorted drain before the
  destination. Pinned `select.c:generateSortTail` owns this row retention;
  `resolve.c` NameContext does not bind substituted outer reductions inside
  the producer. This is not general transient-row materialization. Paired
  `x AS a, x+1 AS b ORDER BY 2 DESC LIMIT 2` checks both `d.a` and `d.b`
  as scalar/EXISTS/IN with names, types and resets. Source-ID-checked paired
  `select-scalar-child-native.py` / `.test.mjs` compare DESC LIMIT 1 rejection
  and DESC LIMIT 2 second-row acceptance, typed NULL/0/0 versus 4/1/1,
  names and two resets. Other predicates/offsets and multirow materialization
  remain unmigrated; completed-child fallback remains reachable.

- Nonflattenable one-table LIMIT producer and outer WHERE: pinned
  `src/select.c:flattenSubquery` restriction (19) and `selectInnerLoop` ->
  `src/internal/vdbe.ts:compileScalarSelect` keeps producer scan/LIMIT before
  substituted outer predicate and enclosing Mem/Exists/Set destination. Bounded
  no-ORDER/non-DISTINCT one-table producer, one-column scalar/EXISTS/IN caller.
  Source-ID-checked paired native/public expression projection `x+1 AS y`
  with LIMIT 1 then `d.y>2`, typed rows, names, two resets; pre-edit public
  prepare failed `no such table: d`. Not general materialization or ORDER.

- COLLATE-wrapped producer ORDER references: pinned
  `src/resolve.c:resolveOrderGroupBy` / `sqlite3ExprSkipCollateAndLikely`
  and `src/select.c:flattenSubquery` -> `src/internal/vdbe.ts:compileScalarSelect`
  unwraps COLLATE to bind producer AS-name/ordinal, substitutes producer EList
  reduction within the preserved COLLATE wrapper, then transfers ORDER to
  the enclosing sorter. Source-ID-checked paired native/public alias/ordinal
  typed rows, names and resets; pre-edit values 4/2 instead of 10/10.
  General NameContext and nonflattenable materialization remain open.

- Producer ORDER ordinal before flatten transfer: pinned
  `src/resolve.c:resolveOrderGroupBy` and `src/select.c:flattenSubquery`
  -> `src/internal/vdbe.ts:compileScalarSelect` validates integer ordinal
  against producer EList width, substitutes the producer expression before
  transfer to the enclosing parent's sorter. Source-ID-checked paired
  native/public two-column producer ordinal/alias rows, metadata and resets,
  plus pinned 1..2 error for out-of-range 3; pre-edit ordinal failed 1..1.
  General nonflattenable derived materialization remains open.

- Producer ORDER AS-name before flatten transfer: pinned
  `src/resolve.c:resolveOrderGroupBy` and `src/select.c:flattenSubquery`
  ORDER transfer -> `src/internal/vdbe.ts:compileScalarSelect` resolves
  producer aliases against producer EList before handing the key to the
  parent's scan/sorter. Native/public source-ID-checked paired `x+1 AS y`
  ORDER y vs ORDER 1 rows, types, names and resets; pre-edit alias returned
  4 instead of pinned 10. General ORDER NameContext remains open.

- Source-permitted nonzero-source derived LIMIT transfer: pinned
  `src/select.c:flattenSubquery` restrictions (13)/(14)/(19) and LIMIT
  transfer -> `src/internal/vdbe.ts:compileScalarSelect` carries producer
  LIMIT/ORDER to the parent only when it has no WHERE/LIMIT and producer has
  no OFFSET. Parent one-table scan/sorter consumes its destination in the
  enclosing builder. Paired source-ID-checked native/public scalar/EXISTS/IN
  rows, metadata and resets for LIMIT 0/1 and ORDER with LIMIT 1/2; outer
  WHERE with producer LIMIT remains nonflattenable and unmigrated.

- Nonzero-source derived ORDER transfer: pinned
  `src/select.c:flattenSubquery` restrictions (7)/(11)/(19), producer ORDER
  transfer and `selectInnerLoop` -> `src/internal/vdbe.ts:compileScalarSelect`
  substitutes result/WHERE then transfers producer ORDER to a single-source
  parent (only without producer LIMIT or parent ORDER), recursively compiles
  that parent's scan/sorter and destination in the enclosing builder.
  Source-ID-checked paired scalar-child native/public tests cover typed
  scalar/EXISTS/IN rows, names and resets. LIMIT-bearing producer and general
  CTE/derived materialization remain open; live generic relocation remains.

- ORDER term resolution for no-FROM derived producer: pinned
  `src/resolve.c:resolveOrderGroupBy` -> `src/internal/vdbe.ts:compileScalarSelect`
  maps AS-name and integer ordinal to the producer EList transient registers
  before ORDER expression lowering; out-of-range ordinals reject at prepare
  with pinned diagnostic. Source-ID-checked paired scalar-child native/public
  tests cover typed alias/ordinal rows and resets; native 0/3 ordinal errors
  and public rejection followed by valid statement cover bounded atomicity.
  General NameContext and multirow sorter parity remain open.

- ORDER no-FROM derived producer: pinned
  `src/select.c:flattenSubquery` restriction (7), `selectInnerLoop` and
  `pushOntoSorter` -> `src/internal/vdbe.ts:compileScalarSelect` binds
  producer ORDER keys to shared transient registers, evaluates them on the
  admitted candidate before its OFFSET and consumes the one row through
  the outer Mem/Exists/Set. No key comparison/sorter drain is required for
  a no-FROM singleton; multirow ORDER requires upstream sorter ownership.
  Source-ID-checked paired `select-scalar-child-native.py` / `.test.mjs`
  cover typed values, names, empty candidate and reset. General derived/CTE
  ORDER and generic relocation remain open.

- DISTINCT no-FROM derived producer: pinned
  `src/select.c:flattenSubquery` restriction (7), `sqlite3Select` DISTINCT
  planning / `selectInnerLoop` -> `src/internal/vdbe.ts:compileScalarSelect`
  admits DISTINCT for the no-FROM at-most-one-row producer, evaluates its
  transient row once after WHERE/LIMIT/OFFSET admission and consumes the
  outer Mem/Exists/Set. No dedup cursor is required for a singleton; this
  does not replace multirow DISTINCT planning. Source-ID-checked paired
  `select-scalar-child-native.py` / `.test.mjs` cover typed rows, empty
  producer, names and reset. ORDER, wider derived/CTE and generic relocation
  remain open.

- Multi-column no-FROM derived producer: pinned
  `src/select.c:flattenSubquery` restriction (7) / `selectInnerLoop`,
  `src/resolve.c:resolveExprStep` and `src/expr.c:sqlite3CodeSubselect` ->
  `src/internal/vdbe.ts:compileScalarSelect` allocates producer row registers
  in the enclosing builder, fills them on an admitted candidate, binds
  transient source names in outer WHERE/result and emits Mem/Exists/Set after
  gating. Paired `select-scalar-child-native.py` / `.test.mjs` cover two
  producer columns, typed results, absent candidates and reset. One-row
  register binding replaces C's ephemeral row cursor for this bounded
  no-FROM producer; wider derived/CTE materialization, ORDER and generic
  relocation remain open.

- Outer expression on zero-source derived column child: pinned
  `src/resolve.c:resolveExprStep` NameContext,
  `src/select.c:flattenSubquery` restriction (7) / `selectInnerLoop`,
  `src/expr.c:sqlite3CodeSubselect` ->
  `src/internal/vdbe.ts:compileScalarSelect` substitutes the producer's
  transient reduction throughout the outer result, lowers after producer and
  outer gates into the enclosing Mem/Exists/Set. Paired
  `select-scalar-child-native.py` / `.test.mjs` check typed scalar/EXISTS/IN,
  absent producer and reset. Independent ORDER, wider producer and generic
  completed-child relocation remain open.

- Outer WHERE on zero-source derived column child: pinned
  `src/select.c:flattenSubquery` restriction (7) / `selectInnerLoop`,
  `src/resolve.c:resolveExprStep` NameContext and
  `src/expr.c:sqlite3CodeSubselect` ->
  `src/internal/vdbe.ts:compileScalarSelect` substitutes transient producer
  column into the outer predicate, gates after producer candidate and before
  outer OFFSET and Mem/Exists/Set. Paired `select-scalar-child-native.py` /
  `.test.mjs` check typed rows/names, absent/matched/rejected candidates and
  reset. Outer ORDER, wider producers and generic relocation remain open.

- Nested outer LIMIT on zero-source derived column expression child: pinned
  `src/select.c:sqlite3Select` LIMIT initialization / `selectInnerLoop`
  OFFSET row event, `src/expr.c:sqlite3CodeSubselect` shared destination ->
  `src/internal/vdbe.ts:compileScalarSelect` allocates the outer limit ahead
  of the unflattenable producer limit and gates outer row emission after
  producer suppression. Paired `select-scalar-child-native.py` / `.test.mjs`
  cover typed scalar/EXISTS/IN, both suppressed candidates and reset. Outer
  WHERE/ORDER and generic completed-child fallback remain outside this slice.

- Zero-source derived column expression child: pinned
  `src/select.c:flattenSubquery` restriction (7) / `selectInnerLoop` and
  `src/expr.c:sqlite3CodeSubselect` ->
  `src/internal/vdbe.ts:compileScalarSelect` bounded zero-source producer,
  direct derived-column projection to enclosing Mem/Exists/Set. Producer
  WHERE/LIMIT/OFFSET controls the row event; IN probes after Once. Paired
  `select-scalar-child-native.py` / `.test.mjs` check typed value, suppressed
  candidate, names and reset. Wider derived projection and the completed-child
  fallback remain unresolved.

- Zero-source derived count expression child: pinned
  `src/select.c:flattenSubquery` restriction (7) / `selectInnerLoop` candidate
  and `src/expr.c:sqlite3CodeSubselect` ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` parent-owned branch
  uses the shared builder for producer WHERE/OFFSET/result event, accumulator
  finalization and Mem/Exists/Set. Source-ID-checked paired
  `select-scalar-child-native.py` / `.test.mjs` cover candidate suppression,
  typed count, metadata and reset. The top-level producer compatibility
  bridge and generic completed-child fallback remain separately live.

- Ungrouped aggregate projected ORDER child (bounded): pinned
  `src/expr.c:sqlite3CodeSubselect` SRT_Mem/Exists/Set and
  `src/select.c:sqlite3Select` one-row accumulator ->
  `src/internal/vdbe.ts:simpleUngroupedAggregateOrder` admits projected ORDER
  result identity; existing `compileAggregateSelect` parent builder and
  destination finalize one row before LIMIT/OFFSET. Source-ID-checked
  `select-scalar-child-native.py` / `.test.mjs` pair count, empty input,
  Mem/Exists/Set, metadata and reset. Independent ORDER expression and
  nonflattenable producer shapes are not newly admitted; global relocation
  assertion remains red.

- Ordered grouped expression child (bounded): pinned `src/select.c:sqlite3Select`
  GROUP-key sorter / `src/expr.c:sqlite3CodeSubselect` SRT destination ->
  `src/internal/vdbe.ts:aggregateOrderGroupIndex`, `simpleGroupShape` and
  `compileAggregateSelect` copy saved GROUP-key registers into the result
  sorter's key range when an ORDER term is a group key not projected in the
  result. Source-ID checked `select-scalar-child-native.py` / `.test.mjs`
  cover descending derived/view grouping, rows/names and two resets. Arbitrary
  ORDER expressions and nonflattenable derived producers remain outside this
  bounded path; global completed-child relocation assertion still fails.

- Flattenable grouped derived/view child (bounded): pinned
  `src/select.c:flattenSubquery` and `sqlite3Select` grouped accumulator /
  `src/expr.c:sqlite3CodeSubselect` destination ->
  `src/internal/vdbe.ts:compileScalarSelect` calls `compileAggregateSelect`
  with shared builder/destination; its simple-derived and immutable-view
  flattening recurse with the same parent. `select-scalar-child-native.py` /
  `.test.mjs` pair empty/HAVING/LIMIT and view grouping, typed rows/names and
  reset. ORDER-key admission and nonflattenable derived/CTE still
  need audit; global completed-child relocation assertion remains red.

- Grouped scalar child (bounded destination checkpoint): pinned
  `src/expr.c:sqlite3CodeSubselect` / `src/select.c:sqlite3Select` grouped
  accumulator and sorter drain -> `src/internal/vdbe.ts:compileScalarSelect`
  passes builder and SRT_Mem/Exists/Set destination to `compileAggregateSelect`
  for direct physical-table GROUP BY. Paired `select-scalar-child-native.py` /
  `.test.mjs` check empty/HAVING/DISTINCT/LIMIT grouped children, typed rows,
  metadata and reset. Derived/view and other relocation consumers remain;
  full structural assertion remains red.

- Joined nonaggregate expression child (bounded builder checkpoint): pinned
  `src/select.c:sqlite3Select` / `selectInnerLoop`, `src/expr.c:sqlite3CodeSubselect`,
  `src/wherecode.c` rowid seek and `src/vdbeaux.c:sqlite3VdbeMakeLabel` ->
  `src/internal/vdbe.ts:compileInnerTableSelect` optional enclosing builder,
  cursor-based resolution, shared result range and `emitSelectDestination` at
  scan/sorter drain. Paired `select-scalar-child-native.py` / `.test.mjs`
  predate migration and check joined Mem/Exists/Set typed rows and reset. Other
  completed-child relocation remains; structural test still red.

- Independent nested scalar in admitted one-table producer expression:
  pinned `src/resolve.c` gives nested SELECT its own NameContext;
  `src/expr.c:sqlite3ExprCodeTarget/sqlite3CodeSubselect` compiles it into
  the same Parse/Vdbe. `src/internal/vdbe.ts:compileScalarSelect` producer
  binder now leaves scalar-subquery source binding to its own compiler, and
  the existing callback emits nested destination, registers and cursor into
  the enclosing builder. Native/public `ORDER BY (SELECT 1) DESC LIMIT 2`
  scalar/EXISTS/IN compare typed 1/1/0, names, two resets. The binder also
  binds only the left side of nested `x IN (SELECT 4)` to this producer,
  leaving its RHS NameContext and destination to `src/expr.c:sqlite3CodeSubselect`;
  native/public outer Mem/Exists/Set compare typed NULL/0/0 and, with
  `x IN (SELECT 1)`, typed 1/1/1, names and two resets. General correlated RHS and transient source binding remain
  unestablished; completed-child fallback remains reachable.

- Unsorted derived LIMIT + outer WHERE destination: `src/select.c:selectInnerLoop`
  decrements producer LIMIT after row events, whereas
  `src/expr.c:sqlite3CodeSubselect` caps SRT_Mem/SRT_Exists to their first
  accepted outer row. `src/internal/vdbe.ts:compileScalarSelect` now exits
  the no-sort Mem/Exists drain on first accepted row even with post-predicate;
  Set and rejected rows still advance according to producer LIMIT. Source-ID
  checked native/public paired LIMIT 3, LIMIT 3 OFFSET 1 and LIMIT 1 OFFSET 1
  give typed 2/1/1, 4/1/1 and NULL/0/0 with names and two resets. Full transient
  rows and generic completed-child migration remain open.

- Ordered derived LIMIT/OFFSET outer WHERE: pinned
  `src/select.c:generateSortTail` applies producer OFFSET before the
  post-producer predicate (restriction 19); `src/expr.c:sqlite3CodeSubselect`
  caps SRT_Mem/SRT_Exists at one accepted result while preserving OFFSET.
  `src/internal/vdbe.ts:compileScalarSelect` now admits this bounded
  one-table path with producer OFFSET; its sorted drain stops Mem/Exists
  after the first accepted row instead of overwriting it, while Set drains.
  Source-ID-checked native/public paired LIMIT 2 OFFSET 1 and LIMIT 1
  OFFSET 1 compare typed 4/1/1, names and two resets. Full transient rows,
  general offset shapes and generic completed-child removal remain open.

- Ordered direct scalar producer without post-predicate: pinned
  `src/select.c:pushOntoSorter` bounds the sorter at producer LIMIT(+OFFSET)
  independent of consumer WHERE. `src/internal/vdbe.ts:compileScalarSelect`
  now passes the producer's `computeLimitRegisters.capacity` on both filtered
  and unfiltered SorterInsert paths; `generateSortTail` drains into the shared
  Mem/Exists/Set destination. Pinned-source-ID/public typed 9/1/1, names and
  two resets for `SELECT x FROM t2 ORDER BY x DESC LIMIT 2`. Broader budgets
  and completed-child migration remain open.

- Ordered derived one-table LIMIT + outer predicate CASE: pinned
  `src/select.c:flattenSubquery` (19), `generateSortTail` and
  `src/expr.c:TK_CASE` -> `src/internal/vdbe.ts:compileScalarSelect` sorter
  payload column collection *and* sorted-drain recursive CASE substitution.
  Both branches must walk operand, WHEN, THEN and ELSE before Mem/Exists/Set;
  otherwise CASE reads an exhausted source cursor. Source-ID-checked/public
  paired `CASE WHEN d.a<9 THEN d.a ELSE 99 END<9` with `d.b` output returns
  typed 4/1/1, metadata and two resets. The completed-child fallback remains.

- Correlated no-FROM IN RHS in the direct one-table scalar producer: pinned
  `src/resolve.c:lookupName` / `resolveExprStep` (`EP_VarSelect`),
  `src/expr.c:sqlite3CodeSubselect` (no Once on correlated expressions),
  `src/select.c:selectInnerLoop` -> `src/internal/resolve.ts:ResolvedColumnUse`
  and `src/internal/vdbe.ts:compileScalarSelect` RHS column binding at the
  producer scan cursor. Paired source-ID-checked native/public
  `select-scalar-child-native.py` / `.test.mjs` compare typed scalar/EXISTS/IN
  9/1/0, names and two resets. Other correlation depths and completed-child
  relocation are not covered.

- Correlated no-FROM RHS WHERE (follow-up): `src/resolve.c:lookupName` outer
  NameContext use, `src/expr.c:sqlite3CodeSubselect` correlated evaluation,
  `src/select.c:sqlite3Select` WHERE before SRT_Set -> `src/internal/vdbe.ts`
  `bindCorrelated` for both child WHERE and child projection. Pinned-source-ID
  native/public paired `select-scalar-child-native.py` / `.test.mjs` compare
  `x IN (SELECT x WHERE x>1)` scalar/EXISTS/IN typed 9/1/0, metadata and two
  resets; pre-repair public 9/1/1. Other NameContext depths remain open.

- Bounded no-FROM correlated function calls: `src/resolve.c:lookupName` /
  `sqlite3ResolveExprNames` and `src/expr.c:sqlite3ExprCodeTarget` ->
  `src/internal/vdbe.ts:bindCorrelated`, `expressionFromReduction` and
  `aggregateParts` exprlist order; `src/select.c:sqlite3Select` WHERE-before-
  destination ordering remains shared by Mem/Exists/Set. Pinned/public paired
  `select-scalar-child-native.py` / `.test.mjs` exercises `abs(x)` in result
  and WHERE, typed 9/1/0, names, twice-reset statement. Other correlation
  nesting and the completed-child relocation path remain unmigrated.

- One-source scalar scan fallback (bounded, card-t-b): pinned
  `src/expr.c:sqlite3CodeSubselect` -> `src/select.c:sqlite3Select`/
  `selectInnerLoop` Mem/Exists/Set and sorter drain ->
  `src/internal/vdbe.ts:compileScalarSelect` -> `compileInnerTableSelect`
  enclosing `SelectProgramBuilder` for nonaggregate one-source as well as
  joined producers. Paired source-ID-checked `select-scalar-child-native.py`
  and `.test.mjs` exercise two-key ORDER/limit/offset typed rows and resets.
  Completed-child opcode relocation for other shapes is still present.

- Grouped LEFT JOIN child (bounded card-t-b): `src/select.c:sqlite3Select`
  GROUP BY sorter after `src/where.c:sqlite3WhereBegin`/
  `src/wherecode.c:sqlite3WhereEnd` NULL-extension ->
  `src/internal/vdbe.ts:compileAggregateSelect` grouped sorter input loop;
  `src/expr.c:sqlite3CodeSubselect` Mem/Exists/Set -> enclosing builder.
  `select-scalar-child-native.py` / `.test.mjs` check matched/unmatched
  typed count groups with order and reset. RIGHT/FULL/USING not admitted;
  generic completed-child relocation still requires migration.

- Grouped LEFT synthetic-row entry revision (card-t-b):
  `src/wherecode.c:sqlite3WhereEnd` NULL-row continuation after ON ->
  `src/internal/vdbe.ts:compileAggregateSelect` grouped `afterOn` labels;
  `src/select.c:sqlite3Select` sorter receives post-ON, post-WHERE row.
  Paired `select-scalar-child-native.py` / `.test.mjs` count nullable right
  column with unmatched and ON-rejected groups. Generic relocation remains.

- Grouped ORDER-only expression (card-t-b): `src/resolve.c:sqlite3ResolveOrderGroupBy`
  alias/ordinal vs independent expression; `src/select.c:sqlite3Select`
  `sqlite3ExprAnalyzeAggList(&sNC,sSort.pOrderBy)` and
  `generateSortTail` -> `src/internal/vdbe.ts:compileAggregateSelect`
  `orderExpressions` / saved-column remapping / grouped result sorter ->
  `emitSelectDestination` Mem/Exists/Set. Source-first paired
  `test/conformance/select-scalar-child-native.py` / `.test.mjs`.

- Unordered table-backed UNION ALL IN (bounded card-t-b):
  `src/select.c:multiSelect` TK_ALL consecutive `sqlite3Select` calls with
  common `SelectDest` -> `src/expr.c:sqlite3CodeSubselect` SRT_Set ->
  `src/internal/vdbe.ts:compileScalarSelect` per-arm
  `compileInnerTableSelect` with shared builder/set cursor and `InSet`.
  Paired `select-scalar-child-native.py` / `.test.mjs` checks typed hit/miss,
  names and reset. ORDER/LIMIT/set-operator and non-IN compound ownership
  remains pending; completed-child relocation still exists elsewhere.

- Table-backed unordered UNION ALL scalar/EXISTS (card-t-b follow-up): pinned
  `src/select.c:multiSelect` shared destination and `selectInnerLoop`
  SRT_Mem/Exists first accepted row -> `src/internal/vdbe.ts:compileScalarSelect`
  per-arm `compileInnerTableSelect` in enclosing builder; `select-program.ts`
  Mem found flag disambiguates first NULL from empty. Paired source-ID-checked
  scalar-child native/public first/empty-left/NULL tests include reset.
  General compound ownership and completed-child fallback are not resolved.

- Mixed table/no-FROM unordered unlimited UNION ALL expression children:
  pinned `src/select.c:multiSelect` TK_ALL shares the SelectDest and
  `selectInnerLoop` emits a no-FROM single candidate; `vdbe.ts:compileScalarSelect`
  now sends simple no-FROM arms through `emitSelectDestination` alongside
  `compileInnerTableSelect` for table arms. Source-ID-checked paired
  scalar/Exists/Set first/empty/NULL public cases test metadata/reset.
  No general compound ownership or fallback relocation removal is claimed.

- Mixed compound classification (card-t-b): pinned
  `src/select.c:multiSelect` walks `pPrior` then right-hand SELECT using a
  common SelectDest; `vdbe.ts:compileScalarSelect` guards the all-constant
  and simple no-FROM producers by **all** `SelectNode.arms`, not the
  rightmost `from`. This routes left no-FROM/right table TK_ALL to the
  shared builder. Pinned-source-ID public scalar/Exists/Set tests include
  NULL-first, metadata and reset; generic fallback still remains.

- Mixed no-FROM WHERE expression arms (card-t-b): pinned `src/select.c`:
  `multiSelect` / `sqlite3Select` / `selectInnerLoop`, `src/where.c`:
  `sqlite3WhereBegin` constant-term false jump to `iBreak`, `src/expr.c`:
  `sqlite3CodeSubselect` Mem/Exists/Set. `vdbe.ts:compileScalarSelect`
  lowers the no-FROM predicate before projection and destination emission in
  the enclosing mixed TK_ALL arm loop; false/NULL jumps to its next arm.
  Paired source-ID/public tests include WHERE 0 and NULL WHERE 1 with table
  RHS, typed values, names and two iterations. Generic relocation unresolved.

- All-no-FROM TK_ALL arms with WHERE (card-t-b): pinned `select.c:multiSelect`
  calls `sqlite3Select` on each arm with one `SelectDest`; `where.c:sqlite3WhereBegin`
  tests constant terms before `selectInnerLoop`; `expr.c:sqlite3CodeSubselect`
  supplies Mem/Exists/Set. `vdbe.ts:compileScalarSelect` defers constant/simple
  no-FROM classification when any arm has WHERE, and uses the existing arm-local
  predicate and shared destination. Paired source-ID and public types/names/reset
  for WHERE 0 and NULL WHERE 1; generic relocation still red.

- `src/select.c:sqlite3Select` ungrouped aggregate tag-select-0820,
  `src/resolve.c:resolveOrderGroupBy`, `src/expr.c:sqlite3CodeSubselect` ->
  `src/internal/vdbe.ts:compileAggregateSelect` ORDER-only expression AggInfo
  entries and `aggregateShapeSupported`; `test/conformance/select-scalar-child.test.mjs`
  pinned independent `ORDER BY sum(x)` scalar/EXISTS/IN, LIMIT 0, reset and
  metadata. Single accumulator output has no result sorter; completed-child
  fallback remains untranslated.

- `src/select.c:sqlite3Select` tag-select-0820 / `src/where.c:sqlite3WhereBegin` /
  `src/expr.c:sqlite3CodeSubselect` -> `src/internal/vdbe.ts:compileScalarSelect`
  zero-source aggregate routing into `compileAggregateSelect` with enclosing
  `SelectProgramBuilder` and Mem/Exists/Set. WHERE filters accumulator input,
  not the final row; LIMIT guards publication. Pinned typed public reset tests:
  `test/conformance/select-scalar-child.test.mjs`. This is bounded to unordered,
  ungrouped, noncompound child SELECTs; generic child relocation remains.

- `src/select.c:sqlite3Select` tag-select-0820 (`WhereEnd` -> `finalizeAggFunctions`
  -> HAVING -> `selectInnerLoop`) -> `src/internal/vdbe.ts:compileAggregateSelect`
  finalization/HAVING/destination for no-FROM expression children. Parent
  routing no longer excludes HAVING; `select-scalar-child.test.mjs` pairs the
  pinned native scalar/Exists/Set values, LIMIT 0, names and reset. Generic
  completed-child relocation remains.

- `src/select.c:sqlite3Select` tag-select-0820 and
  `src/resolve.c:resolveSelectStep` ORDER resolution ->
  `src/internal/vdbe.ts:compileScalarSelect` zero-source aggregate entry into
  `compileAggregateSelect` (ORDER-only aggregate registers allocated before
  stepping, no output sorter for one accumulator row). Pinned native/public
  typed source comparison: `select-scalar-child.test.mjs`; general completed
  child relocation is not retired.

- `src/resolve.c:resolveSelectStep` ORDER binding after result list and
  `src/select.c:sqlite3Select` zero-source WhereBegin/`selectInnerLoop` ->
  `src/internal/vdbe.ts:compileScalarSelect` no-FROM nonaggregate expression
  child validates all independent ORDER keys via `expandAndResolveSelect`
  before emitting its enclosing destination. One candidate needs no sorter;
  ordinal/name errors remain prepare-time. `select-scalar-child.test.mjs`
  compares pinned native rows, names, errors and reset. The generic completed
  child splice is still unmigrated.

- `src/resolve.c:resolveSelectStep` GROUP binding,
  `src/select.c:sqlite3Select` grouped WhereBegin → sorter → accumulator →
  destination -> `src/internal/vdbe.ts:compileAggregateSelect` zero-source
  grouped producer, consumed by `compileScalarSelect` enclosing Mem/Exists/Set.
  False WHERE skips sorter insertion directly (no Next cursor), producing no
  group; unlike ungrouped count it does not finalize an empty group. Pinned
  public typed/name/reset comparison: `select-scalar-child.test.mjs`.
  Completed-child relocation remains a separate gap.

- Nested zero-source derived count outer limiter: pinned
  `src/select.c:sqlite3Select` tag-select-0650 `computeLimitRegisters` per
  SELECT, `selectInnerLoop` producer candidate, `src/expr.c:sqlite3CodeSubselect`
  SRT_Mem/Exists/Set -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
  parent branch computes outer limiter before inner candidate and skips only
  final destination for outer LIMIT/OFFSET; inner limiter skips AggStep.
  `test/conformance/select-scalar-child.test.mjs` compares native typed values,
  metadata and two resets. Generic completed-child splice remains separate.

- Nonflattenable zero-source derived count HAVING: pinned
  `src/select.c:sqlite3Select` tag-select-0820 (`finalizeAggFunctions`,
  `sqlite3ExprIfFalse(pHaving,addrEnd,SQLITE_JUMPIFNULL)`, `selectInnerLoop`)
  and `src/expr.c:sqlite3CodeSubselect` SRT destinations ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` parent branch. Only
  count(*) aggregate references bind to finalized output; ordinary Boolean
  expression lowering handles the rest, unsupported references reject.
  Source-ID native/public `test/conformance/select-scalar-child.test.mjs`
  checks typed rows, names and reset/finalize. Generic splice not retired.

- Bounded zero-source derived count ORDER binding: pinned
  `src/resolve.c:resolveSelectStep` / `resolveOrderGroupBy` before
  `src/select.c:sqlite3Select` tag-select-0820 ungrouped accumulator and
  suppressed sorter -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
  resolves ORDER terms with `expandAndResolveSelect` against a transient
  derived-result schema (resolution only, no physical table), before computing
  parent/producer LIMITs or finalizing count. Qualified/unqualified derived
  column ORDER keys and absent names bind/error at prepare. This is not a
  general derived materialization. Source-ID native/public
  `test/conformance/select-scalar-child.test.mjs` covers values and prepare
  errors even under LIMIT 0; generic relocation still present.

- Pinned `src/select.c:sqlite3Select` tag-select-0820 `sqlite3WhereBegin`
  over a derived row before AggStep/finalize/HAVING/`selectInnerLoop`, with
  `src/resolve.c:resolveSelectStep` rejecting WHERE aggregate use at prepare
  -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount` parent-owned
  one-candidate derived result register and outer WHERE `IfNot` before count
  AggStep. A transient derived-result schema binds names but is never scanned.
  Public/native typed/reset/error probes in
  `test/conformance/select-scalar-child.test.mjs`; not a general derived scan.

- Pinned `src/select.c:sqlite3ColumnsFromExprList` / `sqlite3Select` derived
  result-list projection and `src/resolve.c:resolveSelectStep` source-column
  binding before the tag-select-0820 outer count loop ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` computes all no-FROM
  producer result registers in projection order and binds outer WHERE against
  the corresponding unique transient column names; AggStep still counts only
  the accepted row event. No general multirow materialization. Pinned/public
  `test/conformance/select-scalar-child.test.mjs` probes width/name collision,
  NULL, ORDER and errors; completed-child splice remains.

- Pinned `src/resolve.c:resolveSelectStep` / `resolveOrderGroupBy` validates
  inner derived SELECT ORDER names, expressions and ordinals before
  `src/select.c:sqlite3Select` producer ordering. In
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount`, the bounded zero-FROM
  one-row producer invokes `expandAndResolveSelect(source,schema)` at prepare;
  ordering that single candidate is a no-op, but invalid ORDER still fails
  preparation even under LIMIT 0. Source-ID native/public
  `test/conformance/select-scalar-child.test.mjs` compares destination typed
  rows/reset and errors. Not a materialized multirow sorter.

- Pinned `src/select.c:selectInnerLoop` `codeDistinct` before OFFSET and SRT
  destination -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount` admits
  DISTINCT in its at-most-one-candidate zero-FROM producer. A single emitted
  row cannot equal a prior row, so the ephemeral duplicate set is omitted
  only in this bounded cardinality case. `src/resolve.c:resolveSelectStep`
  validates inner projection/ORDER at prepare. Native/public
  `test/conformance/select-scalar-child.test.mjs` covers typed rows,
  reset/finalize and ordinal errors; no claim for multirow DISTINCT.

- Pinned `src/select.c:sqlite3Select` tag-select-0820 AggStep/finalize and
  `src/func.c:countStep` nullable-argument check ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` evaluates a single
  `count(expr)` argument from the derived producer registers only after
  source/outer WHERE gates, then passes it to AggStep; matching HAVING uses
  AggFinal's output. Transient result names resolve at prepare even under
  LIMIT 0. Source-ID native/public `test/conformance/select-scalar-child.test.mjs`
  tests NULL/non-NULL, reset, destinations and missing columns. Other
  aggregate identities are not conflated; no multirow derived support.

- Pinned `src/select.c:sqlite3Select` AggInfo collection of result and HAVING
  expressions (`sqlite3ExprAnalyzeAggList`/`sqlite3ExprAnalyzeAggregates`),
  tag-select-0820 step/finalize/HAVING ordering, `src/func.c:countStep` ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` collects separate
  count identities from bounded derived HAVING before emission, assigns
  separate builder registers and steps/finalizes each against its projected
  candidate. `test/conformance/select-scalar-child.test.mjs` native/public
  compares NULL versus non-NULL counts, LIMIT 0, predicates, destinations,
  reset and missing-column prepare; other aggregate families/multirow derived
  producers are not covered.

- Pinned `src/select.c:resetAccumulator` distinct-argument ephemeral setup,
  `updateAccumulator` `codeDistinct` before AggStep and `src/func.c:countStep`
  -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount`: on its at-most-one
  accepted no-FROM candidate, admit one-argument DISTINCT count without a
  duplicate set, but distinguish DISTINCT versus ordinary aggregate identity
  for separate result/HAVING registers. Native/public tests in
  `test/conformance/select-scalar-child.test.mjs` compare NULL/empty/mixed
  HAVING/destinations/errors/reset. Multirow distinct remains unimplemented by
  this branch.

- Pinned `src/select.c:updateAccumulator` FILTER-before-arguments/distinct/
  AggStep, `sqlite3Select` AggInfo result/HAVING collection and `src/resolve.c`
  nested aggregate validation -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
  per-count FILTER gates and distinct FILTER-aware identities on its sole
  candidate. `test/conformance/select-scalar-child.test.mjs` compares native
  and public NULL, LIMIT 0, mixed counts, destinations, reset and invalid
  FILTER expressions. No multirow deduplication/iteration is inferred.

- Pinned `src/select.c:updateAccumulator` FILTER -> ORDER key -> argument ->
  sorter -> AggStep path maps to `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
  only for count with at most one accepted derived row: resolve/code keys in
  the same gated order, distinguish ORDER identities in HAVING, step the one
  accepted argument without a sorter. `test/conformance/select-scalar-child.test.mjs`
  covers native/public ordered count rows, typed destinations, reset, empty
  producer and prepare-time ORDER errors. Multirow ordered aggregates require
  actual sorter/argument replay.

- Pinned `src/select.c:sqlite3Select` result/HAVING AggInfo collection and
  step/finalize order, `src/func.c:sumStep`, `sumFinalize`, `totalFinalize`,
  `avgFinalize` -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
  dispatches count/sum/avg/total names to existing translated VM AggStep and
  AggFinal with independent identities and the no-FROM producer's <=1 row.
  `test/conformance/select-scalar-child.test.mjs` compares native/public
  integer/real/NULL, empty-input, mixed HAVING, destinations and reset/errors.
  Multirow derived materialization and distinct/sort cursors remain unmapped.

- Pinned `src/select.c:updateAccumulator` aggregate argument collation and
  `src/func.c:minmaxStep`/`minMaxFinalize` -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
  dispatches min/max from the <=1-row derived source into the existing VM
  extrema aggregate, forwarding argument collation and distinct HAVING
  identities. Native/public checks in `test/conformance/select-scalar-child.test.mjs`
  cover integer/text/NULL, empty producer, destinations, FILTER/HAVING,
  reset and missing column at prepare. Multirow extrema remain a separate
  producer-iteration problem.

- Pinned `src/select.c:updateAccumulator` argument emission order and
  `src/func.c:groupConcatStep`/`groupConcatFinalize` ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` stores an argument
  vector for each aggregate entry, forwarding one/two arguments to existing
  VM group_concat/string_agg AggStep and finalizing on empty input. Native/
  public typed destinations, mixed HAVING, FILTER/DISTINCT/ORDER and error
  checks live in `test/conformance/select-scalar-child.test.mjs`. No multirow
  string aggregation claim.

- Pinned `src/select.c:sqlite3Select` zero-source GROUP BY group formation,
  `src/resolve.c:resolveOrderGroupBy` ordinal/name/misuse checks ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` resolves and emits
  the inner no-FROM grouped candidate into the enclosing accumulator;
  its WHERE can remove the only group. `test/conformance/select-scalar-child.test.mjs`
  compares native/public typed destinations, LIMIT 0, ORDER, empty group,
  reset and errors. Inner HAVING/multirow grouping are not mapped here.

- Pinned `src/select.c:sqlite3Select` GROUP BY result generator (HAVING
  after group finalization, before `selectInnerLoop`/OFFSET), `src/resolve.c`
  HAVING name binding -> `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
  nonaggregate inner HAVING on a no-FROM one-candidate GROUP BY producer.
  `test/conformance/select-scalar-child.test.mjs` tests accepted, rejected,
  NULL, OFFSET, typed destinations and preparation error; aggregate inner
  HAVING and multirow groups still need separate production.

- Pinned `src/select.c:sqlite3Select` GROUP BY AggInfo reset/step/finalize
  and HAVING result gate, `src/func.c:countStep/countFinalize` ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` allocates one inner
  count(*) accumulator for single-candidate GROUP BY HAVING, separately
  from the enclosing accumulator. `test/conformance/select-scalar-child.test.mjs`
  checks typed destinations, empty/filtered groups, ORDER/LIMIT/OFFSET,
  repeated reset and name-resolution errors. Multirow grouping and other
  aggregate expressions are not mapped through this route.

- Pinned `src/select.c:updateAccumulator` FILTER/argument/step order and
  GROUP BY finalizer/HAVING gate, `src/func.c` aggregate finalizers ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` inner HAVING
  accumulator vector, separate from its enclosing aggregate. Source-ID
  typed public checks in `test/conformance/select-scalar-child.test.mjs`
  cover count(expr), FILTER/DISTINCT, numeric/extrema/string aggregates,
  collation, empty group, name resolution, reset and destinations. Aggregate
  ORDER BY, expression subqueries and multirow group materialization remain
  unmapped in this bounded producer.

- Pinned `src/select.c:updateAccumulator` aggregate FILTER -> ORDER key ->
  argument -> sorter/step, GROUP BY finalize/HAVING ->
  `src/internal/vdbe.ts:compileZeroSourceDerivedCount` one-candidate inner
  HAVING aggregate vector. `test/conformance/select-scalar-child.test.mjs`
  verifies typed ordered string/numeric aggregates, NULL, key-error under
  LIMIT 0 and reset. No runtime sorter is required for one accepted value;
  multirow aggregate ORDER remains outside this mapping.

- `src/select.c:flattenSubquery` restrictions (9)/(16), `sqlite3Select`
  subquery coroutine/materialization -> `src/internal/vdbe.ts:compileScalarSelect`
  bounded nonaggregate multirow table producer via `compileInnerTableSelect`
  and `src/internal/select-program.ts:aggregate-expression` destination. The consuming
  count(*) only needs row events, so direct `AggStep` replaces transient-table
  rereads in the same enclosing builder; `AggFinal` runs on the empty input.
  Pinned oracle `native-multirow-count.py` and public
  `test/conformance/select-scalar-child.test.mjs` check ORDER/LIMIT/OFFSET,
  typed value/name and reset. This mapping excludes general materialized
  derived tables and does not retire completed-child relocation.

- Pinned `src/select.c:flattenSubquery`, `updateAccumulator` and
  `src/func.c:sumStep/countStep` -> `src/internal/vdbe.ts:compileScalarSelect`
  bounded derived projected-column aggregate route and
  `src/internal/select-program.ts:aggregate-expression`. Producer sorter/LIMIT/
  OFFSET gates the projected result vector before aggregate step; the outer
  accumulator resets/finalizes once and emits Mem/Exists/Set. Only a single
  uncorrelated column-argument count/sum/avg/total consumer without outer
  predicate/group/distinct/filter is covered; streaming is a read-only TS
  adaptation, not general subquery materialization. Source-ID
  `native-multirow-values.py` and `select-scalar-child.test.mjs` cover typed
  zero/nonzero input, IN, reset and invalid projected names under LIMIT 0.

- Pinned `src/select.c:updateAccumulator` and `src/func.c:minmaxStep` /
  `minMaxFinalize` -> `src/internal/select-program.ts:aggregate-expression` with
  argument collation for bounded `min/max` of derived projected column in
  `src/internal/vdbe.ts:compileScalarSelect`. Producer sorter, limit and offset
  precede step; finalize on empty input. `native-multirow-extrema.py` (source
  ID) and `select-scalar-child.test.mjs` check typed result, COLLATE, IN,
  EXISTS, invalid name under LIMIT 0 and two reset cycles. No grouped or
  general materialized derived consumer is claimed.

- Pinned `src/select.c:updateAccumulator` `sqlite3ExprCodeExprList` and
  `src/expr.c:sqlite3ExprCodeTarget` -> bounded derived-row argument binder
  in `src/internal/vdbe.ts:compileScalarSelect`, with
  `src/internal/select-program.ts:aggregate-expression` consuming producer
  result registers at scan or sorter drain. Resolves projected names before
  producer execution; no nested aggregate/SELECT argument in this route.
  `native-multirow-expr.py` and public `select-scalar-child.test.mjs` cover
  typed expression aggregates, empty rows, LIMIT/OFFSET and invalid columns;
  generic completed-child relocation remains unmigrated.

- `src/select.c:updateAccumulator` (NEEDCOLL) ->
  `src/expr.c:sqlite3ExprCollSeq` -> `src/internal/vdbe.ts` derived-row
  `argumentCollation`, before lowering references to registers. A bare
  projected column takes its resolved descriptor collation; a binary
  expression does not inherit implicit column collation, though explicit
  COLLATE wins. Pinned `collation-probe/native.py` and public scalar-child
  tests distinguish RTRIM/BINARY `max` across two reset cycles.

- Pinned `src/select.c:updateAccumulator` FILTER `sqlite3ExprIfFalse`
  (NULL jumps) -> `src/internal/select-program.ts:aggregate-expression`:
  `emitFilter`/`IfNot` precedes `emitArgument`/`AggStep`, with FILTER names
  bound before `compileInnerTableSelect` and producer scan/sorter events in
  `src/internal/vdbe.ts:compileScalarSelect`. Zero-argument count(*) uses the
  same destination. Former `count-step` and `aggregate-step` variants retired
  after their bounded consumers migrated. Pinned `filter-probe/native.py` and
  public `select-scalar-child.test.mjs` check false/NULL, empty input, names,
  metadata and two reset cycles. No general multirow aggregate sorter.

- Pinned `src/select.c:resetAccumulator` DISTINCT ephemeral KeyInfo and
  `updateAccumulator` FILTER -> argument -> `codeDistinct` -> AggStep ->
  `src/internal/vdbe.ts:compileScalarSelect` bounded derived aggregate
  `distinctCursor` and `src/internal/select-program.ts:aggregate-expression`
  Found/IdxInsert gate. `src/internal/private-state.ts:EphemeralIndexCursor`
  retains Mem-owned key comparison/budget/lifecycle; producer sorter and
  LIMIT gate before argument. Source-ID `distinct-probe/native.py` and public
  `select-scalar-child.test.mjs` cover typed, collation, FILTER, reset,
  Mem/IN/EXISTS and invalid name under LIMIT 0. No general materialization.

- Pinned `src/select.c:resetAccumulator` aggregate ORDER index,
  `updateAccumulator` FILTER -> ORDER key -> argument -> DISTINCT -> insert,
  and `finalizeAggFunctions` drain/AggStep/AggFinal ->
  `src/internal/vdbe.ts:compileScalarSelect` bounded derived aggregate sorter
  and `src/internal/select-program.ts:aggregate-expression`. Producer sorter/
  LIMIT/OFFSET selects candidate rows; aggregate sorter drains afterward.
  `src/internal/private-state.ts:SorterCursor` owns stable ties, typed payload,
  budget and VM cleanup. Pinned `order-probe/native.py` / public
  `select-scalar-child.test.mjs` verify typed FILTER/DISTINCT, empty, Mem/IN/
  EXISTS, missing ORDER key at LIMIT 0, name and two reset cycles. Only the
  single-argument uncorrelated no-GROUP bounded producer is mapped.

- Pinned `src/select.c:resetAccumulator` / `updateAccumulator` /
  `finalizeAggFunctions` ordered single-argument `group_concat` -> bounded
  `src/internal/vdbe.ts:compileScalarSelect` derived-row producer and
  `src/internal/select-program.ts:aggregate-expression` sorter destination;
  `src/internal/vdbe.ts:aggregateStep` still owns default separator and Mem
  state. Pinned `order-probe/native.py` and public scalar-child tests cover
  ORDER/FILTER/DISTINCT, empty, IN and reset. Two-argument and general
  materialization paths are not mapped here.

- Pinned `src/select.c:updateAccumulator` argument range and ordered record,
  `finalizeAggFunctions` `nArg` sorted drain, and
  `src/func.c:groupConcatStep` second separator argument ->
  `src/internal/select-program.ts:aggregate-expression` argument vector and
  `src/internal/vdbe.ts:compileScalarSelect` bounded derived-row sorter
  payload range/drain; VM aggregate state remains the Mem owner. Oracle
  `order-probe/oracle-vector.log` and public scalar-child two-reset tests
  check string_agg, custom separator, FILTER, empty, IN and prepare errors.
  Earlier one-argument-only mapping for this route is superseded; general
  grouped/materialized SELECT is not mapped.

- Pinned `src/select.c:sqlite3Select` non-GROUP `sqlite3WhereBegin` before
  `updateAccumulator` -> `src/internal/vdbe.ts:compileScalarSelect` binds the
  bounded derived-row outer WHERE before producer execution and
  `src/internal/select-program.ts:aggregate-expression` gates rows before
  FILTER/ORDER/arguments/DISTINCT/step. Producer ORDER/LIMIT/OFFSET runs first.
  Source-ID oracle `order-probe/oracle-where.log` and public scalar-child cases
  check typed results, IN, resets and bad names at LIMIT 0; not general WHERE.

- Pinned `src/select.c:sqlite3Select` limiter tag-select-0650 before scan,
  non-GROUP `finalizeAggFunctions` then `selectInnerLoop` -> bounded derived-row
  scalar compiler outer `computeLimitRegisters`, producer scan/step/finalize,
  offset gate then `emitSelectDestination` for Mem/Exists/Set. Producer's own
  LIMIT/OFFSET remains separate. Source-ID `where-validation/outer-limit-
  oracle.log` and public scalar-child two-reset cases cover typed results,
  IN/EXISTS, LIMIT 0 and bad name at prepare. No general grouped/materialized
  producer mapping.

- `src/resolve.c:resolveOrderGroupBy` alias/ordinal before source-expression
  binding and `src/select.c:sqlite3Select` one non-GROUP final row to
  `selectInnerLoop` -> bounded ordinary-table derived-row aggregate compiler
  outer ORDER binder (no second sorter), separate producer/aggregate argument
  sorters. Pinned ctypes `where-validation/outer-order-oracle.log`; public
  scalar-child two-reset typed/name/error, LIMIT 0, IN/EXISTS probes. Other
  grouped/compound/materialized ORDER consumers not mapped here.

### Derived aggregate count bridge ownership (revision)

`src/select.c:sqlite3Select` aggregate input event and `src/func.c:groupConcatStep`
argument consumption map to `src/internal/vdbe.ts:compileZeroSourceDerivedCount`
(count-only completed-producer fallback) and `compileCompoundDerivedAggregate`
(argument-bearing compound row consumer). The former must not claim non-count
aggregates: `test/conformance/from-subquery-routes.test.mjs` checks the captured
`stage3-subquery-view` group-concat result and sorter budget in three encodings.
Completed-child relocation in both paths still requires migration.

| Mixed IN/range selected inner-join ordering | `src/where.c:wherePathSolver`, `src/whereexpr.c:exprAnalyze`, `src/wherecode.c:codeEqualityTerm`, Case 4, `sqlite3WhereEnd` | `src/internal/where-plan.ts` selects dependency-ordered path; `src/internal/vdbe.ts:compileInnerTableSelect` executes its inner-join ordinals and continues the selected cursor; `test/conformance/mixed-in-range-red.test.mjs` checks three encodings. Outer-join NULL continuation retains source order; no general STAT4/DESC parity claim. |

| Standalone SELECT contiguous register range | `src/select.c:selectInnerLoop` (`pDest->iSdst=pParse->nMem+1`, then `nMem+=nResultCol`) | `src/internal/vdbe.ts:compileInnerTableSelect` standalone `range(count)` now reserves exactly `count` from the next register, matching `src/internal/select-program.ts:SelectProgramBuilder.range`; three-source USING/NATURAL and RIGHT/FULL sort tests exercise key copies. |

### Review-v6 original IN/range branch applicability — [[card:card-s-c-d-m]]

Pinned `whereexpr.c:exprAnalyze`, `where.c:whereLoopAddBtreeIndex`,
`whereLoopInsert`, `wherePathSolver`, `sqlite3WhereEnd` and
`wherecode.c:codeINTerm/codeAllEqualityTerms/Case 4` map to
`where-plan.ts:analyzeWhereClause/btreeLoops/wherePathSolver` and
`vdbe.ts:compileInnerTableSelect/sqlite3WhereEnd`. The public/pinned executable
matrix is `test/conformance/cases/in-range-branch-applicability.json`, builder
`capture-in-range-branch.py`, runner `in-range-branch-applicability.test.mjs`.
`fourth-IN-slot` is selected with innermost-first restart; `subquery-IN-RHS`
is safe residual index traversal (not a selected seek); `selected-versus-residual`
is the NOT INDEXED table-scan control; `multi-source-prerequisite` uses positioned
outer RHS before selected inner access; `forced-index-traversal` scans an index
on a non-leading constraint; `prepare-unsupported` is a vector IN SELECT
producer boundary, not a dropped predicate. Equality-prefix competing range
alternatives and later residual terms are a separate selected matrix row. No
STAT4/pruning/order or arbitrary selected-access parity is established. Existing
i/j/k tests and [[card:card-t]]'s four shared reds remain separately scoped.

- [[card:card-t-b]] bounded compound-derived no-FROM aggregate subquery:
  pinned `src/select.c:multiSelect` TK_ALL / `sqlite3Select` accumulator /
  `selectInnerLoop` SRT_Mem/Exists/Set, `src/expr.c:sqlite3CodeSubselect`;
  `src/internal/vdbe.ts:compileCompoundDerivedAggregate` parent arm-row
  generation, AggStep/AggFinal and `emitSelectDestination`;
  `test/conformance/select-scalar-child.test.mjs` compound-derived twice-step
  typed Mem/Exists/Set regression. The parent branch also computes outer
  LIMIT/OFFSET before arms and suppresses the final publication as in
  `select.c:computeLimitRegisters` / `selectInnerLoop`; pinned-ID typed and
  twice-reset comparisons are in `$SAIVAGE_CARD_WORK_ROOT/limit-review/`.
  Other compound-derived routes still use
  finished-arm relocation; the generic scalar child bridge was retired in the
  bounded parent-destination migration below.

- [[card:card-t-b]] expression SELECT generic completed-child bridge retirement:
  `src/expr.c:sqlite3CodeSubselect` -> `src/select.c:sqlite3Select` /
  `selectInnerLoop` SRT_Mem/Exists/Set -> `src/internal/vdbe.ts:compileScalarSelect`
  fallback calls `compileAggregateSelect` or `compileInnerTableSelect` with the
  same `SelectProgramBuilder`, Once and destination; no generic `child.ops.map`
  relocation. `test/conformance/select-scalar-child.test.mjs` structural and
  public typed/reset tests, `select-output-differential.test.mjs` and the card's
  `parent-migration/oracle.py` pinned-ID two-pass comparator. No observed
  successful generic-fallback hit in broad instrumented inventories; top-level
  `compileCteUnionAll` and compound-derived finished-arm relocation persist.

- [[card:card-t-b]] bounded unordered UNION ALL ownership: pinned
  `src/select.c:multiSelect` TK_ALL + `sqlite3Select` on the existing Vdbe,
  `src/resolve.c` zero-FROM arm resolution, and `selectInnerLoop` SRT_Output ->
  `src/internal/select-compiler.ts:compileSelect` compound-before-aggregate
  routing (unlimited unordered SELECT-origin UNION ALL arms) ->
  `src/internal/vdbe.ts:compileCteUnionAll` shared `SelectProgramBuilder`,
  `compileInnerTableSelect`/`compileAggregateSelect` destination consumers and
  `emitSelectDestination` for no-FROM arms. Public first-name/typed-order/reset,
  width/name/table prepare errors: `select-compound-owner.test.mjs`; pinned-ID
  oracle: `$SAIVAGE_CARD_WORK_ROOT/compound-validation/oracle.py`.
  Ordered, limited, set, VALUES, window and derived routes are not thereby migrated;
  retaining their existing selection avoids silently narrowing admitted SQL.

- Ordered compound arm ownership (in progress): `select.c:multiSelectByMerge`,
  `selectInnerLoop`/`SelectDest` -> `src/internal/vdbe.ts:compileOrderedCteUnionAll`,
  `src/internal/select-program.ts:emitSelectDestination`; structural and public
  checks in `test/conformance/select-compound-owner.test.mjs`. Direct builder
  emission replaces completed-child relocation, but CTE-derived arm binding is
  now accepts the bounded single-use ordinary CTE via producer substitution
  before resolution (`select.c:flattenSubquery`, `resolve.c:resolveSelectStep`);
  materialized/repeated CTE and full merge parity remain unproven.

- `src/select.c:multiSelect` copies SelectDest and codes prior/right arm on one
  Parse/Vdbe; `selectInnerLoop` directs rows, `multiSelectByMerge` owns ordered
  or set merging. Bounded `src/internal/vdbe.ts:compileSimpleTableCompound`
  consumes `SelectProgramBuilder` register/cursor allocation and
  `src/internal/select-program.ts:emitSelectDestination` for output, retaining
  typed ephemeral/set and sorter transitions in the same Program. Explicit
  scan cursor is carried through OpenRead/Rewind/Column/Next. Source-ID oracle
  and paired public table tests: `test/conformance/select-compound-owner.test.mjs`.
  Not mapped: full merge scheduling, WHERE/index cursor planning, CTE/derived/
  window compositions and comprehensive error/budget parity.

- Materialized/repeated CTE bounded owner: pinned `src/select.c:sqlite3Select`
  tag-select-0484/0488 `SRT_EphemTab` and shared Vdbe ->
  `src/internal/vdbe.ts:compileCteDerivedSources` parent builder,
  `compileInnerTableSelect` destination overload and
  `src/internal/select-program.ts:emitSelectDestination` ephemeral insertion.
  Outer direct comparison runs only after materialization, with OFFSET/LIMIT
  after filtering. `test/conformance/select-compound-owner.test.mjs` checks
  pinned-native typed rows, names, prepare errors and reset. The separate
  `compileCteDerivedSourcesFallback` still relocates finished Programs for
  other admitted shapes: this mapping does not claim those paths migrated.

- Filtered table-backed materialized CTE continuation: `src/select.c:sqlite3Select`
  tag-select-0488 producer `SRT_EphemTab`, `src/expr.c:sqlite3ExprCodeTarget`
  predicate registers -> `src/internal/vdbe.ts:compileCteDerivedSources` ->
  `compileInnerTableSelect` parent-builder destination with its existing
  `resolveTree`/`compilePredicate` and table cursor; distinct outer WHERE
  remains on the consumer side. Native source-ID-checked typed/reuse/error/reset
  and public comparison: `test/conformance/select-compound-owner.test.mjs`.
  Other producer forms still invoke `compileCteDerivedSourcesFallback`.

- `src/select.c:sqlite3Select` FROM SrcItem generated Select materialization
  (~8050–8130), `multiSelect` UNION ALL (~2935), `selectInnerLoop` destination
  (~1139) -> `src/internal/parse.ts:sourceList` ordered derived carrier and
  `src/internal/vdbe.ts:compileCteDerivedSources` bounded two constant compound
  producer destinations/ON/ordinal sorter; paired pinned public/native
  `test/conformance/select-derived-composition.{test.mjs,native.py}`.
  Still not general derived/compound lowering; unsupported shapes reject before
  publishing a Program. See the bounded revision in `docs/TRANSLATION.md`.

- `src/select.c:sqlite3Select` materialized CteUse/SRT_EphemTab
  (tag-select-0484/0488 ~8075–8145), `multiSelect` UNION ALL (~2935),
  `selectInnerLoop` destination (~1139) -> `src/internal/cte.ts` CteUse
  identity carrier and `src/internal/vdbe.ts:compileCteDerivedSources` bounded
  two-MATERIALIZED-compound-CTE parent builder. Native/public paired test:
  `test/conformance/select-cte-compound-composition-{native.py,test.mjs}`.
  Other compound CTE producers and finished-child fallback remain unmigrated.

- [[card:card-t-d]] zero-source materialized CTE WHERE slice:
  `src/select.c:sqlite3Select` no-FROM WHERE / `selectInnerLoop` SRT_EphemTab,
  `src/vdbeaux.c:sqlite3VdbeAddOp3` construction and `src/vdbe.c:sqlite3VdbeExec`
  PC/IfNot/result execution -> `src/internal/vdbe.ts:compileCteDerivedSources`
  parent `SelectProgramBuilder`, predicate then projection then ephemeral insertion;
  runtime `Vdbe.step` retains PC/registers/cursors/budget/suspension ownership.
  `compileInnerTableSelect` remains the table-backed WHERE planner consumer;
  `compileCteDerivedSourcesFallback` still relocates independent Programs for
  unmigrated producer forms. Source-ID-checked typed native script
  `$SAIVAGE_CARD_WORK_ROOT/cte-vm/oracle.py` and public
  `test/conformance/select-cte-zero-source-owner.test.mjs` test false/true
  predicate, repeated use and reset. No C1–C6/Chinook or full lifecycle credit.

- [[card:card-t-d]] table-backed CTE LIMIT: `src/select.c:sqlite3Select`
  tag-select-0488, `selectInnerLoop` SRT_EphemTab/LIMIT loop exit, and
  `src/vdbe.c:sqlite3VdbeExec` OP_IfNot/OP_DecrJumpZero ->
  `src/internal/vdbe.ts:compileCteDerivedSources` parent emission of
  `compileInnerTableSelect` with `computeLimitRegisters` and parent destination;
  `Vdbe.step` remains the stateful execution owner. The `where.c` candidate/path
  handoff is consumed inside `compileInnerTableSelect`. `producer.hasOrderBy`
  still routes to fallback: source SRT_EphemTab retains insertion rowids after
  sort drain; current EphemeralIndexCursor sorts by record key instead. Pinned
  typed/reset oracle `$SAIVAGE_CARD_WORK_ROOT/cte-order/oracle.py` and public
  `test/conformance/select-cte-order-owner.test.mjs` cover LIMIT 0/2/OFFSET 1
  and duplicate CTE use; full execution ownership migration remains open.

- 2026-09-30 [[card:card-t-d]] bounded CTE ORDER producer: `select.c:sqlite3Select`/`selectInnerLoop` SRT_EphemTab producer and sorter drain → `src/internal/vdbe.ts:compileCteDerivedSources`/`compileInnerTableSelect`; `wherecode.c` reverse loop setup/advance and `vdbe.c` OP_Last/Rewind/Prev/Next → TS Last/IndexLast/Rewind/IndexRewind and Prev/IndexPrev/Next/IndexNext in VM. Parent builder owns branch addresses; VM owns cursor position. `private-state.ts:EphemeralIndexCursor` insertion-order mode retains materialized row order. `test/conformance/select-cte-order-owner.test.mjs` native-source-ID-checked public control. Other producer fallback relocation and independent execution paths remain unmigrated.

- `src/resolve.c:resolveSelectStep` (arm WHERE/result resolution),
  `src/expr.c:sqlite3ExprCodeTarget` (gate value), `src/select.c:sqlite3Select`
  WHERE before `selectInnerLoop`/`multiSelect` SRT_EphemTab ->
  `src/internal/vdbe.ts:compileCteDerivedSources` per-arm no-FROM gate in the
  shared parent builder. Paired `test/conformance/select-cte-compound-where-native.py`
  and `.test.mjs` assert typed materialized pair/join results and reset. The
  finished-Program fallback and independent SELECT dispatcher remain live.

- `src/select.c:multiSelect` per-arm `sqlite3Select` to CteUse SRT_EphemTab,
  `selectInnerLoop`, `src/resolve.c:resolveSelectStep` arm NameContext and
  `src/expr.c` expression coding -> `src/internal/vdbe.ts:compileCteDerivedSources`
  dispatches FROM-bearing compound arms to parent-owned `compileInnerTableSelect`
  (where.c/wherecode.c plan handoff unchanged). Native/public
  `test/conformance/select-cte-table-compound-parent-{native.py,test.mjs}`
  compare pinned typed joined rows, metadata and reset. Other compound arm
  operators/ordering and remaining completed-Program fallback are not migrated.

- `src/select.c:sqlite3Select` CteUse per-destination materialization and
  `multiSelect` only for its compound member, `selectInnerLoop` ordered/LIMIT
  table output; `src/resolve.c:resolveSelectStep` per-producer contexts and
  `src/expr.c` WHERE/result coding -> `src/internal/vdbe.ts:compileCteDerivedSources`
  mixed MATERIALIZED pair admission, retaining `compileInnerTableSelect` parent
  ORDER/LIMIT/where.c handoff and per-use cursor identity. Pinned/public
  `test/conformance/select-cte-ordered-mixed-parent-{native.py,test.mjs}`
  check typed rows, names and reset. Other ordered/compound combinations and
  finished-child fallback not established by this pair.

#### Linked scalar aggregate over constant UNION ALL derived source (card-t-c bounded repair)
Pinned `src/resolve.c:lookupName`/`resolveExprStep` links outer `t.a` across the scalar SELECT's NameContext while `src/select.c:selectExpander` installs transient derived columns; `src/expr.c` scalar subselect does not reuse an `OP_Once` when `EP_VarSelect` is set. `src/select.c:multiSelect` (`TK_ALL`) feeds successive arms to the same destination; aggregate finalization occurs after the producer (including zero qualifying rows). `src/internal/resolve.ts:resolveNested` currently installs a transient schema description for this compound source, while `src/internal/vdbe.ts:compileTableSelect/compileExpressionSubquery` now does not open its root-page-zero descriptor as a physical Btree, and emits arm results, correlated WHERE and aggregate steps/finalization in the enclosing program. Only bounded one-column no-FROM UNION ALL arms with count/sum and a linked predicate are admitted; other derived scalar shapes remain temporary unsupported. The synthetic schema/name recovery and dedicated scalar branch are not the full upstream derived-producer or resolver migration. Paired pinned/public `test/conformance/select-correlated-derived-aggregate-{native.py,test.mjs}` checks typed count/sum zero-match behavior, physical correlated control, metadata and reset.

Linked identity correction (card-t-c): pinned `src/resolve.c:lookupName` fixes `Expr.iTable/iColumn` while searching `NameContext.pNext`, then `resolveExprStep` marks correlated SELECT; `src/expr.c` scalar generation omits once for the variable SELECT. For the existing derived scalar count/sum consumer, `src/internal/resolve.ts:lookupName` already recorded each reduction's `ResolvedColumnUse` (source, index including -1 rowid, selectDepth). `src/internal/vdbe.ts:compileTableSelect/compileExpressionSubquery` now binds its predicate and aggregate arguments by those exact reduction identities into the enclosing producer, instead of searching outer source names a second time. This preserves rowid, aliases and resolver-reported missing names for the tested bounded path. Paired `test/conformance/select-linked-derived-identity-{native.py,test.mjs}` checks typed rowid/ordinary outer columns, names, repeated execution/reset and missing-name errors. The transient derived schema and specialized compiler branches remain; other callers still have separate binders and the resolver migration is incomplete.

Physical scalar linked identity follow-up (card-t-c): pinned `src/resolve.c:lookupName` sets `Expr.iTable/iColumn` while walking `NameContext.pNext`; `src/expr.c:sqlite3CodeSubselect` omits `OP_Once` for `EP_VarSelect` and `src/select.c:sqlite3Select` consumes the source cursor into the scalar aggregate destination. In the ordinary physical-table `src/internal/vdbe.ts:compileTableSelect` expression-subquery consumer, `bind` now receives the same generated reductions recorded in `nested.columnUses`. For result, WHERE, and ORDER target expressions it uses the resolved `source/columnIndex` (including implicit rowid -1) and mapped child read cursor, not an independently ordered scan of current/nested/outer tables by spelling. The consuming path still emits into its enclosing parent builder; only this consumer's duplicate name search was removed. Paired `test/conformance/select-physical-linked-native.py` and `.test.mjs` cover typed correlated count over rowid/a/b, names, repeated step/reset/finalize/close and negative outer missing-name/inner ambiguity diagnostics. This does not migrate the separate joined scalar caller (`compileJoinSubquery`), synthetic compound-derived resolver descriptor, or live child-program fallback.

Joined scalar correlated target follow-up ([[card:card-t-c]]): pinned `src/resolve.c:lookupName` walks `NameContext.pNext` and writes cursor/iColumn (rowid -1) before `src/expr.c:sqlite3CodeSubselect` lowers correlated expressions into the parent program without `OP_Once`; `src/select.c:sqlite3Select` uses the scalar aggregate Mem destination. `src/internal/vdbe.ts:compileInnerTableSelect/compileJoinSubquery` now consumes `entry.plan.columnUses` by exact generated reduction identity for the joined-row child WHERE and aggregate argument. The child physical read cursor maps to `entry.cursor`, outer identity to resolved `source.cursorId`. This retires that caller's independent spelling/ambiguity/alias search and uses its existing parent scan/AggStep/AggFinal, not a generic evaluator or a shared derived-register binder. Paired pinned/public `test/conformance/select-joined-linked-native.py` and `.test.mjs` compare qualified outer rowid and second joined source, NULL/nonmatch count 0, typed INTEGER/name metadata, reset/finalize/close and missing/ambiguous preparation errors. Other scalar shapes, transient derived resolver schema and finished-child fallback remain live/unmigrated.

Compound-derived duplicate projected names in scalar expressions ([[card:card-t-c]]): pinned `src/select.c:sqlite3ColumnsFromExprList` (2227–2315) derives a transient Table column list from the first EList and suffixes colliding names `:1` before `src/resolve.c:lookupName` searches linked child/outer NameContexts; `src/expr.c:sqlite3CodeSubselect` and `src/select.c:sqlite3Select` deliver the correlated aggregate Mem target. `src/internal/resolve.ts:expandAndResolveSelect` now assigns collision-free ordinal transient names to its bounded compound-derived child descriptor. `src/internal/vdbe.ts:compileTableSelect/compileExpressionSubquery` emits *all* constant UNION ALL arm columns into corresponding parent registers before the already linked predicate/aggregate consumes the resolved ordinal, rather than admitting only one producer column. The synthetic descriptor remains a bounded resolution adaptation (root-page-zero is never opened), not a general derived storage implementation. Paired pinned/public `select-derived-duplicate-resolve-native.py` / `.test.mjs` exercise `d.x`, `d."x:1"`, correlated outer rowid/column, typed rows, names, errors, two reset cycles and cleanup; joined NULL-valued identity is separately covered by `select-joined-null-*`. More general derived producers, other dispatches and finished-child fallback remain unmigrated.

Table-backed compound-derived projection ([[card:card-t-c]], later bounded repair): `src/internal/vdbe.ts:compileSingleCompoundDerived` still composes finished `compileTableSelect` arms, but now relocates *all* address-bearing child control edges through `relocateControlTargets`, including WHERE short-circuit jumps, seek/IN/scan exhaustion, and replaces each child Halt with an arm-exit Goto. Pinned `select.c:multiSelect` TK_ALL passes its destination to both arm `sqlite3Select` calls and drains each arm before the next; `select.c:sqlite3ColumnsFromExprList` (2227–2315) derives collision-free names from first-arm output before `resolve.c:lookupName` binds outer projections. This consumer now indexes first-arm unique transient names and exposes those names as result metadata, including `x:1`; missing admitted projected names fail prepare, not fallback to an unrelated derived compiler. Paired `select-table-compound-names-native.py` / `.test.mjs` tests a two-row WHERE/IN first arm followed by a one-row arm, names, INTEGER types, missing-name error, two cycles and cleanup. This repair does **not** translate direct shared-builder SELECT ownership or retire finished-child composition; those and other WHERE interfaces remain gaps.

Follow-up parent migration ([[card:card-t-c]]): `compileSingleCompoundDerived` no longer calls `compileTableSelect` per arm or `relocateControlTargets`. It obtains per-arm `expandAndResolveSelect` plans with unique parent-owned cursor ranges, then feeds each to `compileInnerTableSelect` with the same `SelectProgramBuilder` and `SelectDest`; first-arm `sqlite3ColumnsFromExprList` naming and last-arm descriptor metadata remain distinct. The shared table-loop destination branch now exits early only for Mem/Exists, not output/sorter; pinned `select.c:selectInnerLoop` (SRT_Output versus SRT_Mem/Exists) and `multiSelect(TK_ALL)` (2990–3055) require draining the first arm before advancing. Paired pinned/public `select-table-compound-names-*` checks rows/types/names/error/reset; `select-compound-parent-builder.test.mjs` guards against reintroducing finished-child splicing. Other completed-child relocation remains in `compileJoinedUnionAll`, `compileSingleCompoundDerived`'s neighboring derived/CTE paths and the coroutine producer (`relocateControlTargets` is still used outside this caller); this does not resolve those paths or broaden table-arm admission.

#### Single-source derived VALUES parent coroutine (card-t-c bounded caller)
- `reference/sqlite/sqlite-src-3530400/src/select.c:multiSelectValues` 2862–2900
  (one `selectInnerLoop` destination across rows), `sqlite3Select` derived
  coroutine setup, `src/resolve.c:lookupName` derived EList naming ->
  `src/internal/vdbe.ts:compileDerivedProducer` no-FROM multirow VALUES branch,
  `src/internal/select-program.ts:emitSelectDestination` coroutine branch.
  Parent `SelectProgramBuilder` allocates all row/source/stable coroutine
  registers; each row is emitted in order before EndCoroutine and outer
  ORDER/LIMIT. No completed scalar child or old-PC relocation on this branch.
- Pinned/public `test/conformance/select-derived-values-parent-native.py` /
  `.test.mjs`, structural `select-derived-values-parent-builder.test.mjs`,
  three-encoding/parameter/limits `derived-values-registers.test.mjs`.
  Ordered finite no-FROM single-column UNION ALL derived arms with one
  supported ORDER key now likewise use a parent builder, typed sorter and
  SRT_Coroutine destination, not a finished-child relocation. Other non-VALUES
  table/window/compound forms still retain their separate fallback. See the
  paired `select-derived-nonvalues-parent-*` native/public/structural tests.
  The admitted one-column, single-table LIMIT-derived producer (no inner
  WHERE/ORDER, DISTINCT, compound or window) now resolves the child with
  `expandAndResolveSelect`, then invokes `compileInnerTableSelect` on the
  parent's builder with `SRT_Coroutine` destination, following
  `select.c:sqlite3Select` tag-select-0482 and `selectInnerLoop` iBreak.
  No completed-child relocation on this branch; independent parent and child
  limits and SQLite missing-name diagnostics are paired in
  `select-derived-table-parent-*` native/public/structural tests. Other
  table/window/compound fallbacks remain live; where.c/wherecode.c interface
  remains coordinated through [[card:card-s]].
  Window-derived predicate materialization follows
  `src/select.c:sqlite3Select` tag-select-0488 (`SRT_EphemTab`, child
  `sqlite3Select(pSub,&dest)`, then outer `selectInnerLoop`).
  `compileDerivedProducer` now passes an enclosing `SelectProgramBuilder`
  and typed zero-key sorter destination to `compileWindowSelectLowering`;
  the window result producer emits into that destination, not a copied
  finished child's `ResultRow`. Pinned/public/structural
  `select-derived-window-parent-*` verify ranks before parent WHERE, INTEGER
  type, name, ORDER/LIMIT/OFFSET, zero LIMIT, reset and prepare error. Other
  window/CTE/compound fallback owners remain unpaired.

- `src/select.c:multiSelect` TK_ALL and `sqlite3Select` FROM CTE materialization;
  `src/resolve.c:resolveSelectStep` -> `src/internal/cte.ts:lowerOrdinaryCtes`
  per-arm `cteDerived`/`CteUse` -> `src/internal/vdbe.ts:compileCteUnionAll`
  parent builder ephemeral producer and duplicate readers ->
  `test/conformance/select-cte-compound-source-native.py` and
  `select-cte-compound-source.test.mjs`. Bounded one-column constant producer;
  other CTE arm shapes remain temporary unsupported, not physical schema tables.

- `src/resolve.c:lookupName` linked NameContext column uses and
  `src/expr.c:sqlite3CodeSubselect`, `TK_CASE` (5683–5747),
  `sqlite3ExprIfFalse(...,SQLITE_JUMPIFNULL)` ->
  `src/internal/vdbe.ts:compileTableSelect` physical-table
  `compileExpressionSubquery` reduction-linked target binder: optional CASE
  operand, WHEN/THEN pairs and ELSE bind in original reduction order before
  the existing parent-VDBE expression target emits its branches. No independent
  name lookup or cursor workaround. Manifest-source-ID-verified SQLite 3.53.4
  read-only users fixtures give empty NOT IN (NULL), Alice/Cara for simple CASE,
  Bob for searched CASE, and code 1 for missing WHEN column; public
  `subquery-view-foundation.test.mjs` verifies all three encodings, reset cycles,
  and prepare-error restoration. This does not retire other subquery/SELECT
  fallbacks or establish arbitrary CASE/window/compound compatibility.

#### [[card:card-t-d]] zero-source derived coroutine ownership (bounded)
`src/select.c:sqlite3Select` tag-select-0482 uses `SRT_Coroutine` for a FROM
subselect; `src/select.c:selectInnerLoop` exits via its enclosing break label.
`src/vdbeaux.c:sqlite3VdbeAddOp3` appends into the enclosing Vdbe;
`src/vdbe.c:OP_InitCoroutine`/`OP_Yield`/`OP_EndCoroutine` execute PC handoff.
`src/internal/vdbe.ts:compileDerivedProducer` now sends admitted zero-source
scalar rows into parent `SelectProgramBuilder`/`SelectDest` with child LIMIT,
WHERE, and register allocations; VM stepping retains coroutine PC/row ownership.
The distinct finished-child fallback remains for other producers. See
`test/conformance/select-derived-scalar-owner-{native.py,test.mjs}` for pinned
source-ID checked public typed/lifecycle differential evidence; the structural
whole-fallback test remains red. Shared WHERE handoff belongs to [[card:card-s]].

#### [[card:card-t-d]] unordered derived UNION ALL OFFSET branch
`src/select.c:multiSelect` TK_ALL -> `selectInnerLoop` / `codeOffset` (OP_IfPos
skips output-limit decrement) -> `src/internal/vdbe.ts:compileDerivedProducer`
parent `SelectProgramBuilder` coroutine destination, `IfPos` target after
`DecrJumpZero` -> `src/internal/vdbe.ts` VM `IfPos`, `Yield`, `EndCoroutine`.
Pinned public oracle/TS pair: `test/conformance/select-derived-union-owner-native.py`
/ `.test.mjs`; bounded zero-source unordered arms only. Other derived fallback
still relocates completed child ops; structural owner check remains red.

#### [[card:card-t-d]] single-candidate ORDER BY derived caller
`src/resolve.c:resolveOrderGroupBy` alias/ordinal validation ->
`src/select.c:sqlite3Select` FROM `SRT_Coroutine` / `selectInnerLoop` lone
candidate -> `src/internal/vdbe.ts:compileDerivedProducer` bounded scalarOrder
and parent builder destination -> VM `Yield`/`EndCoroutine` PC handoff.
Source-ID-checked public pair `select-derived-union-owner-native.py` / `.test.mjs`
includes ORDER/LIMIT/OFFSET/reset checks; multi-candidate and general ORDER
forms are not claimed, and other completed-child relocation remains.

#### [[card:card-t-d]] no-FROM aggregate producer ownership
Pinned `src/select.c:sqlite3Select` tag-select-0482 / aggregate
`updateAccumulator` and `finalizeAggFunctions` -> `src/internal/vdbe.ts`
`compileDerivedProducer` aggregateProducer -> `compileAggregateSelect` with
parent `SelectProgramBuilder`, `SRT_Coroutine`-equivalent destination ->
`EndCoroutine`. VM AggStep/AggFinal and Yield retain execution ownership.
Source-ID-checked public pair `select-derived-union-owner-native.py`/`.test.mjs`
compares count/false WHERE/sum LIMIT 0 and reset; finished-child fallback for
other derived producers is still present.

#### [[card:card-t-d]] table-derived DISTINCT/ORDER destination
Pinned `src/select.c:sqlite3Select` tag-select-0482 calls inner SELECT with
`SRT_Coroutine`; `selectInnerLoop` emits distinct filtering and sorter draining
before destination handoff. `src/internal/vdbe.ts:compileDerivedProducer`
now delegates admitted single-table DISTINCT and ascending ORDER to
`compileInnerTableSelect` using the parent `SelectProgramBuilder`/destination;
VM cursors, sorter, Yield, budgets and reset retain execution ownership.
`select-derived-table-parent-{native.py,test.mjs}` is the pinned public pair.
Descending selected-table ORDER guard and unrelated completed-child fallback
remain; the structural owner test is red.

#### [[card:card-t-d]] ungrouped derived aggregate HAVING handoff
`src/select.c:sqlite3Select` tag-select-0482 compiles the inner aggregate into
`SRT_Coroutine`; the ungrouped aggregate branch finalizes accumulators then
`sqlite3ExprIfFalse(pHaving, addrEnd, SQLITE_JUMPIFNULL)` before
`selectInnerLoop`. `src/internal/vdbe.ts:compileDerivedProducer` now admits
HAVING on its bounded no-FROM aggregate route into parent-owned
`compileAggregateSelect`. Its shared `IfNot` reject falls through to
`EndCoroutine`; VM PC, aggregate Mem, budgets and reset remain execution-owned.
Pinned public `select-derived-union-owner-{native.py,test.mjs}` covers true
and false HAVING with two resets. Grouped/ordered/window and other child
Program relocation are not migrated by this tranche.

#### [[card:card-t-d]] ordered ungrouped derived aggregate
`src/select.c:sqlite3Select` tag-select-0482 and ungrouped aggregate branch
clear `sSort.pOrderBy` after AggFinal/HAVING and call `selectInnerLoop` with
`SRT_Coroutine`; `src/resolve.c:resolveOrderGroupBy` checks result alias/ordinal
before emission. `src/internal/vdbe.ts:compileDerivedProducer` routes bounded
single-key no-FROM aggregate ORDER (also invalid positive ordinal for resolver
diagnostics) to `compileAggregateSelect` with the enclosing builder and coroutine
destination. `select-derived-union-owner-{native.py,test.mjs}` covers typed
ordered row, exhausted OFFSET, invalid ordinal, reset and finalize. VM PC and
Mem remain runtime-owned; other completed-child fallbacks remain.

#### [[card:card-t-d]] zero-source GROUP BY derived destination
`src/select.c:sqlite3Select` GROUP BY key sort/transition, `finalizeAggFunctions`,
HAVING and `selectInnerLoop` feed the enclosing tag-select-0482
`SRT_Coroutine`. `src/internal/vdbe.ts:compileDerivedProducer` routes bounded
`simpleGroupShape` with no FROM to parent-owned `compileAggregateSelect` even
without an aggregate call. The latter owns group key sorter, accumulator reset,
HAVING, LIMIT/OFFSET and destination; VM retains runtime cursor/PC/Mem state.
Paired public pinned `select-derived-union-owner-{native.py,test.mjs}` tests
true/false HAVING and exhausted OFFSET over GROUP BY 1, reset and finalize.
Other finished-child composition remains.

#### [[card:card-t-d]] single-table grouped derived coroutine
`src/select.c:sqlite3Select` tag-select-0482 and its GROUP BY branch use
`sqlite3WhereBegin`/group sorting, accumulator transitions, HAVING and
`selectInnerLoop` with enclosing `SRT_Coroutine`. The bounded single-table
`simpleGroupShape` in `src/internal/vdbe.ts:compileDerivedProducer` calls
parent-aware `compileAggregateSelect` (source cursor, sorter, group reset,
LIMIT/OFFSET, destination) instead of `compileTableSelect`'s GROUP rejection.
`select-derived-table-parent-{native.py,test.mjs}` tests typed fixture grouping,
HAVING, name, reset/finalize against source-ID-checked pinned public API.
Compound/window/multi-source and other completed-child composition remain.

#### [[card:card-t-d]] single-table ungrouped derived aggregate
`src/select.c:sqlite3Select` no-GROUP aggregate branch uses
`sqlite3WhereBegin`, `updateAccumulator`, `sqlite3WhereEnd`,
`finalizeAggFunctions`, HAVING and `selectInnerLoop` with enclosing
`SRT_Coroutine` (tag-select-0482). `src/internal/vdbe.ts:compileDerivedProducer`
keeps aggregate expressions out of ordinary `tableProducer` and routes bounded
single-table ungrouped forms to parent-aware `compileAggregateSelect`, which
owns WHERE scan, accumulator, HAVING and LIMIT before coroutine destination.
Paired source-ID-checked public `select-derived-table-parent-{native.py,test.mjs}`
adds WHERE count and HAVING-rejected count, typed name/rows, reset and finalize.
Completed-child fallback and other unrepresented shapes remain.

#### [[card:card-t-d]] bounded unordered UNION derived coroutine
`src/select.c:multiSelect` combines arms in its enclosing Vdbe, and
`sqlite3Select` tag-select-0482 targets `SRT_Coroutine`;
`src/vdbe.c:OP_IdxInsert` and ephemeral iteration own execution.
`src/internal/vdbe.ts:compileDerivedProducer` now emits bounded integer-literal
UNION set insertion, ordered drain and LIMIT/OFFSET into the parent's builder,
then yields to the outer consumer. Other compound callers still retain the
completed-child fallback. Public paired `select-derived-union-owner-*` checks
pinned source ID, typed rows, two reset passes and finalize.

#### [[card:card-t-d]] EXCEPT/INTERSECT literal derived set (mapping correction)
Pinned `src/select.c:multiSelect` lines 2990–3005 synthesizes ORDER BY 1 for
non-ALL compounds and enters `multiSelectByMerge`. Prior UNION mapping above
was inaccurate about upstream's algorithm. For the bounded one-column integer
literal case, `compileDerivedProducer` reuses the typed ephemeral set/drain
adaptation from `compileScalarSelect` in the parent Vdbe: `SetDelete`,
`SetRetainIntersection` and `ClearEphemeral` model ordered compound results
before coroutine emission. Distinct collation and expression effects excluded;
source-ID paired `select-derived-union-owner-*` checks public typed rows and
reset, not exact merge work/error parity. Other callers retain fallback.

#### [[card:card-t-d]] mixed set-prefix / ALL-tail derived destination
`src/select.c:multiSelect` 2990–3047 uses a merge/implicit ORDER 1 for a
non-ALL prefix, then reuses destination and LIMIT/OFFSET for TK_ALL tail;
`sqlite3Select` tag-select-0482 provides enclosing coroutine. Bounded integer
literal prefix uses parent typed set insertion/deletion/intersection and ordered
drain, then emits trailing arms through that same parent destination in
`src/internal/vdbe.ts:compileDerivedProducer`. `select-derived-union-owner-*`
provides source-ID pinned/public typed reset comparison. Merge VM work/error
parity and all other mixed shapes remain gaps; completed-child fallback retained.

#### [[card:card-t-d]] BINARY text literals in parent set-prefix
`src/select.c:multiSelect` (implicit ORDER BY 1) and
`multiSelectByMergeKeyInfo` compare compound result keys before enclosing
`SRT_Coroutine`; `src/internal/vdbe.ts:compileDerivedProducer` now admits
unadorned text literals as well as integer literals into the bounded parent
`KeyInfo`/ephemeral drain, `Mem` and VM retaining encoding/type. Explicit
COLLATE, nonliteral expressions and work/error parity are not covered.
Paired `select-derived-union-owner-*` tests pinned/public typed BINARY rows.

#### [[card:card-t-d]] scalar literal Mem keys in derived set prefix
`select.c:multiSelect` 2990–3050 / `multiSelectByMergeKeyInfo` select the
implicit ORDER BY comparison and shared TK_ALL destination; `vdbeaux.c`
Mem/record comparison and `vdbe.c` coroutine execution are runtime owners.
`src/internal/vdbe.ts:compileDerivedProducer` bounded parent set gate now
accepts literal NULL, finite REAL and BLOB alongside INTEGER/TEXT: typed
`KeyInfo` and `Mem` compare instead of independent SQL-text evaluation.
`select-derived-union-owner-*` compares source-ID pinned and public typed
NULL/REAL/BLOB order, deduplication, limit and reset. Exact merge work/error
and other fallback callers remain unverified.

#### [[card:card-t-d]] EXCEPT/INTERSECT prefix + ALL tail
`src/select.c:multiSelect` 2990–3055: recursive non-ALL left uses implicit
ORDER BY 1 merge; TK_ALL right inherits destination and LIMIT/OFFSET with
`OP_IfNot` skip. `src/internal/vdbe.ts:compileDerivedProducer` parent bounded
literal prefix now admits EXCEPT/INTERSECT without requiring UNION; VM
`SetDelete`/`SetRetainIntersection` produce prefix then shared coroutine
limit/offset drives tail. `select-derived-union-owner-*` pinned/public typed
and reset cases compare empty/cross-tail transitions; exact merge costs not proven.

#### [[card:card-t-d]] bounded nonliteral constant set arms
Pinned `select.c:multiSelect` 2990–3055 and tag-select-0482 build the compound
into enclosing SRT_Coroutine; `vdbeaux.c:sqlite3VdbeAddOp3` constructs while
`vdbe.c` executes arithmetic/typed keys. `src/internal/vdbe.ts` bounded
`compileDerivedProducer` accepts unary +/- finite numeric literal and binary
integer-literal + arms using existing expression opcode compiler, then parent
KeyInfo set and shared TK_ALL destination. Public pinned source-ID paired
`select-derived-union-owner-*` covers typed signed/sum keys and reset. This
neither migrates arbitrary expressions nor establishes merge work/error parity.

#### [[card:card-t-d]] bound parameter prefix and ALL tail
Pinned `select.c:multiSelect` 2990–3055 destination/limit sharing;
`vdbeaux.c:sqlite3VdbeAddOp3` constructs; `vdbe.c:OP_Variable` 1575–1590
reads bound Mem, coroutine opcodes preserve PC/registers. TS
`src/internal/vdbe.ts:compileDerivedProducer` now admits single-column bare
`variable` arms into existing parent set/mixed builder; the common parameter
builder and VM `Variable` opcode own bindings and reset. Public paired pinned
`select-derived-bound-*` verifies typed rows for bind/reset/rebind, offset,
EXCEPT and ALL tail. Other completed-child callers and exact merge work/error
parity remain unresolved.

#### [[card:card-t-d]] derived multi-source scan
`select.c:sqlite3Select` tag-select-0482 builds a coroutine source in the
parent Vdbe; `selectInnerLoop` writes to SRT_Coroutine, `wherecode.c` owns
position/loop exits, `vdbeaux.c` constructs and `vdbe.c` executes Yield/End.
`src/internal/vdbe.ts:compileDerivedProducer` now routes multi-source
noncompound nonaggregate nonwindow table producers to already parent-aware
`compileInnerTableSelect` with shared builder/destination; no finished-child
PC relocation on this path. `select-derived-join-*` pinned source-ID/public
compares joined typed rows, sort, LIMIT/OFFSET, LEFT ON and reset. Other
finished-child fallback paths remain, so structural gate and broader parity
are not satisfied.

#### [[card:card-t-d]] joined table-arm compound and sorter payload
`select.c:multiSelect` TK_ALL forwards destination across arms; tag-select-0482
puts derived coroutine in one Vdbe. `select.c:pushOntoSorter` 730ff distinguishes
ORDER key width from row payload. `src/internal/vdbe.ts:compileSingleCompoundDerived`
now sends multi-source table arms through common `compileInnerTableSelect`
owner, retaining WHERE joins, predicates and cursor allocation. Its outer
`SelectDest` sorter carries `keyCount` independently of result count to satisfy
`src/internal/private-state.ts:SorterCursor.insert` and typed KeyInfo. Public
source-ID pair `select-derived-joined-union-*` tests JOIN/LEFT JOIN UNION ALL
and outer ORDER on first of two columns with reset. Other completed-child
fallback callers, exact work/error order and structural gate remain red.

#### [[card:card-t-d]] joined aggregate derived producer
`select.c:sqlite3Select` tag-select-0482 and aggregate
`sqlite3WhereBegin` / `updateAccumulator` / `sqlite3WhereEnd` (8878ff) produce
rows in the enclosing Vdbe; SRT_Coroutine transfers finalized results.
`src/internal/vdbe.ts:compileDerivedProducer` admits multi-source represented
noncompound aggregates into parent `compileAggregateSelect` destination;
existing aggregate compiler owns multi-source loop/ON/WHERE/finalization.
`select-derived-joined-aggregate-*` pinned source-ID/public verifies typed
count, empty result input, LIMIT 0 and reset. Earlier fallback threw an
internal scalar-expression error. Other child-PC relocation remains live.

#### [[card:card-t-d]] optional outer WHERE for materialized window child
`select.c:sqlite3Select` tag-select-0482, `window.c:sqlite3WindowRewrite`,
and `select.c:selectInnerLoop` produce a window result in the parent Vdbe;
outer WHERE is optional before ORDER/LIMIT/output. The existing parent-builder
window destination in `src/internal/vdbe.ts:compileDerivedProducer` now skips
its outer `IfNot` and jump fixup when the predicate is absent. Pinned/public
`select-derived-window-no-where-*` source-ID pair covers ORDER/LIMIT/OFFSET,
LIMIT 0, reset, and prepare error. General window and remaining child-PC
fallback are not proven migrated.

#### [[card:card-t-d]] DISTINCT aggregate child
`select.c:sqlite3Select` tag-select-0482 and the aggregate
`sqlite3WhereBegin`/`updateAccumulator`/`sqlite3WhereEnd` branch feed
`selectInnerLoop`/`codeDistinct` before `SRT_Coroutine`; `vdbeaux.c` builds
opcodes, `vdbe.c:OP_Found`/`OP_Yield` executes them. In
`src/internal/vdbe.ts:compileDerivedProducer`, DISTINCT aggregate children
now enter the existing parent `compileAggregateSelect` destination, whose
`distinctResultCursor` filters before output LIMIT; no independent VM/WHERE
policy added. Pinned/public `select-derived-distinct-aggregate-*` pair checks
integer counts, empty input, LIMIT 0 and reset. Finished-child fallback
remains live for other forms; group/index and precise native work order not
proven by this gate.

#### [[card:card-t-d]] zero-source DISTINCT producer
`select.c:sqlite3Select` tag-select-0482 -> `selectInnerLoop` ->
`codeDistinct` default `OP_Found`/`OP_IdxInsert` -> `codeOffset` ->
`SRT_Coroutine`; `vdbeaux.c` constructs and `vdbe.c:OP_Found` executes.
`src/internal/vdbe.ts:compileDerivedProducer` now emits the finite scalar
DISTINCT child in its parent `SelectProgramBuilder` using typed KeyInfo
instead of rejecting the clause in a standalone scalar program. Pinned/public
`select-derived-distinct-scalar-*` pair checks integer/zero-limit/offset/
WHERE-false and reset. General DISTINCT work order and the surviving
finished-child fallback are not claimed migrated.

#### [[card:card-t-d]] compound shared LIMIT across table arms
`select.c:multiSelect` TK_ALL copies `iLimit`/`iOffset` to the prefix and
skips the tail on exhausted count; `selectInnerLoop` decrements only emitted
rows. `vdbeaux.c` builds addresses and `vdbe.c` executes counter and cursor
state. `src/internal/vdbe.ts:compileSingleCompoundDerived` now computes the
compound limit once in `SelectProgramBuilder`, shares it with
`compileInnerTableSelect`'s existing scan/destination loop, and fixes its
breaks to the next arm/end. Pinned/public `select-derived-compound-limit-*`
exercises cross-arm OFFSET, first-arm exhaustion, zero limit, outer ORDER and
reset. General ordered/other-op compounds and precise work parity remain
unproven; no WHERE planner or VM state policy changed.

#### [[card:card-t-d]] ordered joined compound destination
`select.c:multiSelectByMerge` builds two arm coroutines, comparison and merge
into `SRT_Coroutine` (`sqlite3Select`, tag-select-0482); `vdbeaux.c` constructs
and `vdbe.c` steps the opcodes. The finite prefix-ordinal BINARY `UNION ALL`
joined-table producer in `src/internal/vdbe.ts:compileSingleCompoundDerived`
now routes both arms to a parent-owned child sorter, drains into the existing
outer destination; `compileInnerTableSelect` retains WHERE/index scan and
limit exits. This is a sorter-for-merge adaptation, not native merge parity:
independently resumable arm coroutines/permutation are not yet in this
builder. Pinned/public `select-derived-ordered-joined-*` pair tests typed
results, inner/outer ordering, reset. Non-prefix, child DESC, complex
collation, tie/work/error ordering remain unproved or excluded.

#### [[card:card-t-d]] ordered compound output LIMIT
`select.c:multiSelectByMerge` computes shared result `iLimit`/`iOffset`,
copies separate `iOffset+1` input capacities for A/B, then calls
`generateOutputSubroutine` for post-merge OFFSET/LIMIT; `vdbeaux.c` constructs
and `vdbe.c` executes the PC/counter branches. In bounded
`compileSingleCompoundDerived` the parent builder sends both
`compileInnerTableSelect` arm scans to its child sorter without shared output
counters; drain applies `IfPos` OFFSET then output and `DecrJumpZero`. The
unbounded-input sorter is a documented TS adaptation (not native arm work,
error, or budget parity). Pinned/public `select-derived-ordered-limit-*`
checks typed rows, LIMIT 0, cross-arm OFFSET, outer ORDER and two resets.

#### [[card:card-t-d]] derived no-FROM scalar ORDER expressions
`resolve.c:resolveOrderByTermToExprList` resolves single-result ORDER
expressions; `select.c:sqlite3Select` tag-select-0482 compiles the child in
its enclosing Vdbe to SRT_Coroutine; `selectInnerLoop` applies LIMIT and
OFFSET around the one candidate. In `src/internal/vdbe.ts:compileDerivedProducer`,
`scalarProducer` now admits one ORDER expression, validates via
`expandAndResolveSelect`, and emits into its existing parent builder; VM
execution/WHERE/index contracts unchanged. Pinned/public
`select-derived-scalar-order-expression-*` verifies typed rows and resets.
General ORDER expression evaluation and remaining
finished-child fallback are not established.

#### [[card:card-t-d]] multi-term scalar ORDER admission
`resolve.c` simple SELECT ORDER-term resolver checks each term;
`select.c:sqlite3Select` (tag-select-0482) emits into the parent
SRT_Coroutine and `selectInnerLoop` handles the sole no-FROM candidate.
`src/internal/vdbe.ts:compileDerivedProducer` now admits all ORDER term counts
for the no-FROM nonaggregate scalar and validates via
`expandAndResolveSelect`; aggregate admission remains separately bounded.
Pinned/public `select-derived-scalar-multi-order-*` tests mixed direction,
LIMIT/OFFSET, integer output and reset. Other fallback producers and native
work/error ordering remain unestablished.

#### [[card:card-t-d]] ungrouped aggregate ORDER in derived coroutine
`resolve.c:resolveOrderGroupBy` resolves each ORDER term;
`select.c:sqlite3Select`/tag-select-0482 and AggInfo generate one ungrouped
accumulator output in the enclosing Vdbe. `src/internal/vdbe.ts` admits
multi-term ORDER only for no-GROUP aggregate derived producers;
`compileAggregateSelect` owns resolution, AggStep/Final, LIMIT and
`SelectDest` into `compileDerivedProducer`'s parent coroutine. Paired
`select-derived-aggregate-multi-order-*` checks joined count, empty input,
LIMIT 0 and resets. Grouped/descending paths, VM work/error order and
remaining finished-child fallback have not been proven.

#### [[card:card-t-d]] no-FROM UNION ALL arm WHERE
Pinned `select.c:multiSelect` TK_ALL passes shared destination and limit to
both `sqlite3Select` arms; `selectInnerLoop` applies WHERE before result row,
OFFSET and SRT_Coroutine. `resolve.c` owns arm name resolution;
`vdbe.c:OP_IfNot`/`OP_Yield` own runtime jump/resume. TS
`src/internal/vdbe.ts:compileDerivedProducer` resolves each arm using its
SELECT context and emits arm-local predicate jumps in its parent builder;
`computeLimitRegisters`, `emitSelectDestination`, and VM remain shared.
Pinned/public `select-derived-union-where-*` checks 7 cases ×2 resets.
Physical WHERE/index, more general compounds and remaining child relocation
are not proven.

#### [[card:card-t-d]] ordered constant-arm WHERE into parent sorter
Pinned `select.c:multiSelectByMerge` resolves ORDER, emits arm A/B coroutines
and applies OFFSET/LIMIT in merged output (`generateOutputSubroutine`);
`selectInnerLoop` applies each WHERE before its row destination. TS
`compileDerivedProducer` resolves each no-FROM arm in the child SELECT context,
then branches to the next arm before inserting into its existing parent-owned
typed sorter. Paired `select-derived-ordered-arm-where-*` pinned/public tests:
7 typed cases ×2 resets. Typed sorter is a bounded substitution, not native
incremental merge, work/error parity or general compound support.

- Pinned `select.c:multiSelect`, `selectInnerLoop` SRT_Coroutine and
  `sqlite3Select` tag-select-0482 -> `compileDerivedProducer` tableCompoundProducer
  -> `compileSimpleTableCompound` optional enclosing builder/parameters/destination.
  Single-column physical table set/order arms no longer publish/copy a child
  Program for this caller; limit/empty break falls through to EndCoroutine.
  `expr.c:TK_COLUMN` IPK rowid ownership -> Rowid in the table-arm scan.
  Tests: `select-derived-table-parent-native.py`, its public companion and
  `select-derived-table-compound-owner.test.mjs`. Broader non-table fallback
  and joined continuation relocation remain, not architectural acceptance.

- `resolve.c:resolveCompoundOrderBy`, `select.c:multiSelectCollSeq` and
  `multiSelectByMerge` -> compileDerivedProducer ordered SELECT-arm UNION ALL:
  parent builder allocates complete payload and multiple KeyInfo key registers,
  emits SRT_Coroutine without a finished child. Existing finite sorter adaptation
  retained. Native/public two-column/two-key LIMIT/OFFSET case and ordered slice
  structural assertion added; non-SELECT/other fallback branches still live.

- `select.c:multiSelectValues` -> compileDerivedProducer ordered/streaming UNION
  ALL loops over `arm.valuesRows ?? [arm.result]` in enclosing builder; retains
  shared compound LIMIT/OFFSET and full payload/key ranges. Paired native/public
  tests include tail and intermediate VALUES; structural slice checks both loops.

- `select.c:multiSelect` TK_UNION/TK_EXCEPT/TK_INTERSECT, multiSelectCollSeq ->
  compileDerivedProducer scalarSetArms/setProducer/mixedProducer: represented
  one-column expressions/VALUES rows use enclosing set/coroutine destination.
  INTERSECT retention follows complete right-arm insertion; ALL prefixes and
  tails retain distinct set/streaming ownership. Native/public arithmetic VALUES
  union and mixed intersection cases plus slice structural gate. Wider/ordered
  set compounds remain unmigrated.

- `select.c:multiSelect` complete nCol set keys / multiSelectCollSeq per-column
  -> derived set owner setWidth, parent contiguous row range, KeyInfo terms and
  full-width coroutine output. Two-column UNION VALUES distinguishes equal x /
  different y; mixed INTERSECT preserves complete rows. Ordered sets still open.

- `select.c:multiSelectByMerge`, compound ORDER resolution -> represented
  one-column/one-key set/mixed derived owner outputSorter. Complete prefix and
  ALL tail sort before common limits/output. Existing finite set-plus-sort
  adaptation retained; paired descending UNION and mixed intersection tests,
  parent structural assertion. Wider ordered sets remain typed temporary.

- `select.c:sqlite3Select` GROUP BY output ORDER sort/selectInnerLoop ->
  compileDerivedProducer aggregateProducer passes all ORDER terms to existing
  parent-aware compileAggregateSelect. Removed redundant <=1-term gate that
  misdispatched grouped aggregates into compileTableSelect. Paired two-key
  group/count alias probe and structural delegation gate; descending physical
  derived exclusion remains unchanged.

- `select.c:sqlite3Select` zero-source WHERE / `multiSelect` complete right arm
  -> parent set/mixed per-arm resolve and IfNot (NULL-as-false). Skip insertion
  before intersection retention, never skip retention itself. Paired false/NULL
  UNION/mixed and empty-right INTERSECT probes. No shared WHERE file edits.

- `select.c:selectInnerLoop/codeDistinct` per-arm duplicate elimination ->
  zero-source scalar compound admission proves one candidate per SELECT arm.
  DISTINCT is redundant locally, not propagated as compound-wide deduplication.
  Paired ALL duplicate / ordered ALL / UNION tests and bounded structural gate;
  proof excludes multi-row VALUES and grouped/aggregate arms.

- `select.c:multiSelect TK_ALL` plus sqlite3Select accumulator -> parent-aware
  compileAggregateSelect per zero-source unordered ALL arm; parent ephemeral
  one-row bridge to shared compound limits/SRT_Coroutine. No Program copying.
  False-input count and inner/outer OFFSET pinned/public probes. Arm HAVING lacks
  SelectArm expression carrier and remains unsupported; direct shared-limit
  destination flow remains a documented adaptation gap.

- `parse.y:having_opt` / `resolve.c:resolveSelectStep pHaving` /
  `select.c:sqlite3Select` final-row HAVING -> parse.armAction per-arm having
  ExprNode; derived unordered aggregate ALL resolve/compileAggregateSelect and
  CTE per-arm projection preserve it. False/NULL/true distinct arm probes plus
  missing-name public error and post-error prepare. Synthetic arms may omit the
  internal carrier; hasHaving without reduction remains excluded atomically.

- Supersedes aggregate ALL one-row ephemeral bridge: `multiSelect TK_ALL`
  shared iLimit/iOffset/iBreak -> compileAggregateSelect parent compoundLimit
  registers/stops + direct SRT_Coroutine. Zero-limit patched once by compound;
  HAVING and OFFSET skip decrement, exhaustion exits all arms. Public/native
  rejected-first-arm OFFSET and zero-limit probes plus no-ephemeral structure.

- `select.c:codeDistinct WHERE_DISTINCT_UNORDERED/selectInnerLoop` -> physical
  one-column compileSimpleTableCompound.scan per-arm distinct cursor, output
  column KeyInfo, Found/IdxInsert then destination, duplicate target Next.
  Pinned/public duplicate physical ALL and ordered ALL/OFFSET; no global ALL
  deduplication, including tails. Zero-source scalar DISTINCT already admitted.

- `select.c:sqlite3Select` GROUP AggInfo / `resolve.c:resolveSelectStep pHaving`
  cannot be served by raw physical multiSelect scan. compileSimpleTableCompound
  now rejects hasGroupBy/hasHaving before parent op emission. SelectArm lacks
  groupBy expression list: first/last grouped and grouped-HAVING compound
  temporary-error probes paired with pinned valid grouped rows. Existing
  standalone/noncompound grouped aggregate ownership unchanged.

- `parse.y:groupby_opt` -> SelectArm.groupBy retained by armAction/CTE projection;
  `select.c:multiSelect TK_ALL/sqlite3Select` -> groupedAllProducer resolves each
  physical grouped arm and emits via existing aggregate parent destination with
  common compoundLimit stops. Group completion does not patch common zero jump.
  Bounded unordered all-grouped derived ALL only; mixed/raw/ordered/set remains
  temporary. Pinned/public cross-arm and HAVING-empty/zero-limit probes.

- `select.c:multiSelect TK_ALL/selectInnerLoop iBreak` -> mixed grouped/raw
  derived ALL, compileInnerTableSelect compoundLimit explicit registers/stops
  plus existing aggregate owner. Ordinary empty/WHERE/offset transitions stay
  local, exhausted count exits common producer; zero patched only once. No
  finished-child copy and no WHERE planner changes. Paired raw-first/group-first,
  cross-arm offset, false WHERE and zero-limit tests.

- `select.c:columnTypeImpl` derived source recursion (1984–2004) -> grouped/mixed
  ALL rightmost-arm expandAndResolveSelect descriptors, preserving per-arm GROUP/
  HAVING/WHERE, then existing outer projection rename. Paired pinned public C
  metadata probes assert INTEGER/main/t2/x including aliased first t1/a followed by t2/x, rather than
  inheriting later arm origins or generic nulls.

- Raw physical compound derived descriptor branch now shares `columnTypeImpl`
  last Select source recursion with grouped branch; leftmost names independent
  of last-arm aliases. Native/public differing-table aliased ALL/UNION probes
  establish name x and INTEGER/main/t2/x, not first main/t1/a. Existing parent
  compound destination algorithms unchanged.

- Direct physical compound publication retains leftmost result metadata
  (`select.c` column-name/type generation), unlike columnTypeImpl derived
  recursion. Paired direct aliased ALL/UNION probes return x/INTEGER/main/t1/a
  versus derived x/INTEGER/main/t2/x. Existing standalone descriptor unchanged.

- compileJoinedUnionAll first physical join arm -> existing parent
  compileInnerTableSelect with sorter SelectDest (`select.c:selectInnerLoop`
  sorter destination); shared builder/register/parameter ownership replaces
  completed Program +1 PC copy. Existing finite sort specialized strategy
  unchanged; general ordered compound merge not translated here. Pinned/public
  join ON with duplicate x rows plus scalar tail ORDER1 and no-copy structural
  test. Nested join continuation relocation remains.

- `select.c:multiSelectValues` complete forward row production -> actual live
  compileOrderedCteUnionAll zero-source arm valuesRows iteration and destination
  emission. compileCteUnionAll ordered dispatch precedes compileJoinedUnionAll;
  pinned/public joined ON + intermediate two-row VALUES + scalar tail ORDER1
  catches prior dropped second row. Aggregate tail countercheck already passed.

- Ordered physical one-column ALL entry -> compound owner before rightmost
  aggregate classification; actual GROUP/HAVING arm fields -> existing
  compileAggregateSelect including GROUP without aggregate functions.
  `select.c:sqlite3Select`, HAVING false/NULL output jumps 8747/8909.
  Pinned/public join+count HAVING0/NULL and grouped x HAVING predicate/0.

- Ordered ALL sorter terms -> select.c:multiSelectCollSeq/ByMergeKeyInfo,
  left-first actual resolved expression collation; explicit ORDER override then
  first available arm collation then default. Shared actual flattened arm plan
  supplies direct descriptor and ordinary producer. Pinned text NOCASE left/
  later arm and BINARY override differential. Implicit expression propagation
  beyond direct source remains unresolved.

- expr.c:sqlite3ExprCollSeq248–279 COLUMN / CAST / UPLUS ->
  resolve.ts:resolvedImplicitCollation, linked columnUses reduction identity,
  used by ordered ALL compound KeyInfo. Pinned public CAST(note AS TEXT), +note
  versus note||'' over orders.note NOCASE. Other caller migration and deferred
  function/vector/register branches remain open.

- expr.c:sqlite3ExprCollSeq248–311 / sqlite3BinaryCompareCollSeq420–441 ->
  vdbe expressionCollation/binaryCollation nullable source selection and final
  default. Pinned/public concat/lower/CASE vs CAST/+ and right column NOCASE;
  explicit override and scalar min control. NEEDCOLL argument selection remains
  separate/unmigrated (currently explicit-only).

- expr.c TK_FUNCTION5400/5457 NEEDCOLL -> functionArgumentCollation, registry
  flag, first available nullable expression collation then BINARY. Used by
  opcode and constant expression consumers; pinned min/max beta/Z precedence
  and nullif NULL. Function result collation remains distinct.

- select.c:codeDistinct/selectInnerLoop -> existing compileInnerTableSelect
  per-arm ephemeral Found/IdxInsert; ordered ALL guard no longer rejects
  rightmost hasDistinct wholesale. Pinned first/last DISTINCT physical arms,
  join+DISTINCT tail, text NOCASE/NULL. DISTINCT VALUES carrier not represented.

- select.c:sqlite3KeyInfoFromExprList1598–1620 -> ordinary physical producer
  DISTINCT KeyInfo uses explicit plus resolver-linked implicit expression
  collation/default/validation; CAST/UPLUS vs concat pinned/public probes.

- select.c:sqlite3KeyInfoFromExprList1598–1620 -> resolvedResultKeyTerms shared
  by direct physical and ordinary parent-destination DISTINCT OpenEphemeral.
  Direct and ordered ALL CAST/+note vs concat pinned/public regressions.

- Top-level zero-FROM GROUP BY admission: pinned `resolve.c:resolveOrderGroupBy`
  ordinal substitution and `resolveSelectStep` aggregate-key rejection;
  `select.c:sqlite3Select` grouped branch -> existing public `compileSelect`
  aggregate producer. `test/select/first-select.test.mjs` checks INTEGER/REAL/NULL
  names/rows, rejected candidate, code 1 group-key errors and reset/finalize.
  This is a contract expectation correction, not a new producer migration.

- card-t-d RIGHT output break: wherecode.c:sqlite3WhereRightJoinLoop + select.c:selectInnerLoop -> compileInnerTableSelect outputLimitStops, consumed by scalar SRT_Mem/Exists/Set, derived coroutine and compound callers. Cloned unmatched output LIMIT exits now participate in the same enclosing label resolution; live body cloning and other Program relocation remain. `test/conformance/select-right-continuation-native.py` / `.test.mjs`: 5 typed cases x2 reset; no native merge/subroutine, work/error or full regression claim.

- select.c:sqlite3Select8054–8074 (tag-select-0482) ->
  compileDerivedProducer joinedOrderedAllProducer -> compileOrderedCteUnionAll
  owner overload -> enclosing SelectDest coroutine -> EndCoroutine. Public
  prepare/compileSelect/compileTableSelect reaches this wrapped join+scalar ALL
  path; prior `inner` compileTableSelect/child.ops/pcMap no longer used for this
  admitted slice. ORDER ordinal1, joined physical first arm, zero-source ALL
  tails; no inner LIMIT/window/GROUP/HAVING. Remaining fallback branch retains
  other admitted shapes pending consuming evidence, not blanket deleted.

- select.c:multiSelect TK_ALL3020–3060 + sqlite3Select8057–8074 -> public
  compileSelect/compileTableSelect/compileDerivedProducer mixedPhysicalAllProducer
  -> compileCteUnionAll owner -> ordinary physical scan/scalar output with parent
  coroutine destination. Retired actual child.ops/pcMap for unordered mixed
  ordinary physical/zero-source ALL (no inner LIMIT/group/window/CTE/VALUES).
  Last arm supplies derived type/origin, first names. Paired native/public mixed,
  reverse, empty, outer LIMIT0 tests in derived-table-parent-native and
  derived-joined-fallback-owner. Remaining fallback not blanket removed.

- **RIGHT parent interior (card-t-d, supersedes clone note):**
  wherecode.c BeginSubrtn and sqlite3WhereRightJoinLoop ->
  compileInnerTableSelect.rightBody entry and unmatched Gosub;
  where.c sqlite3WhereEnd -> continue/break Return with NULL fallthrough;
  vdbe.c OP_BeginSubrtn/Gosub/Return -> VM Mem address/PC dispatch;
  vdbeaux.c sqlite3VdbeNoJumpsOutsideSubrtn -> compiler boundary validation,
  permitting producer early exhaustion, not runtime relocation. All scalar,
  coroutine, aggregate/compound destination callers use the one body. Window
  sourceProgram composer remaps new register ops but retains its live child
  composition. Paired select-right-continuation tests retain typed NULL/INTEGER,
  downstream IN/LEFT and LIMIT/OFFSET resets; source owner assertion excludes
  body-copy relocation. Native Bloom/work/error/multiple-barrier parity and
  general derived/window fallback migration remain explicitly unestablished.

- select.c:sqlite3Select8114–8128 SRT_EphemTab; multiSelect TK_ALL;
  updateAccumulator6808/8891 -> compileCompoundDerivedAggregate standalone:
  shared SelectProgramBuilder + arm resolver/ordinary producer destination;
  insertion-order ephemeral -> aggregate step/final. Removed children Program
  array, max-child-register allocation, fixed nextCursor40, ResultRow/Halt and
  base-PC rewriting for this live aggregate family. Native/public count/sum,
  empty/duplicates/name/type/reset/error regression in derived-table-parent-native
  and derived-joined-fallback-owner; structural gate asserts destination/scan/no
  child.ops. Retained parent-only zero-source aggregate destination branch;
  aggregate expression binding walkers and other fallback owners unresolved.

- select.c:multiSelect3020–3037 -> compileCteUnionAll shared-destination arm
  dispatch; selectInnerLoop1297/codeDistinct933 -> compileInnerTableSelect's
  existing per-arm resolvedResultKeyTerms/Found/IdxInsert. Removed rightmost
  compound hasDistinct and mixed ordinary arm DISTINCT exclusions; actual
  DISTINCT physical+scalar ALL derived consumer no longer reaches child/pcMap.
  No extra TS shape compiler. DISTINCT multirow VALUES excluded honestly; tests
  native/public physical constant duplicates, scalar DISTINCT, reverse order,
  outer limits, name/type/reset/error; broad production assertions retain generic
  fallback RED alongside passing ordinary DISTINCT owner contract.

- select.c:multiSelect3018–3041 compound iLimit/iOffset -> compileCteUnionAll
  computes one LimitRegisters in shared builder; physical ordinary owner receives
  compoundLimit/stops; scalar output applies offset then destination then count;
  deferred stop targets cross all arms, parent EndCoroutine owns exhaustion.
  Existing mixed ordinary derived owner admits inner LIMIT/OFFSET without new
  shape compiler. Tests paired native/public inner/outer limits, reverse arms,
  DISTINCT/offset, negative/zero limit, missing-column LIMIT0. Previously
  unsupported WHERE-limited path now represented; no exhaustive clone claim.
  Limited transient/aggregate/window/group producers remain honestly excluded.

- window.c39–53 rewritten GROUP/HAVING ownership + select.c8055–8074
  SRT_Coroutine -> compileWindowSelectLowering groupedProducer Select ->
  compileAggregateSelect(parent builder/ops/parameters/coroutine payload).
  Current window allocations reserved before AggInfo; producer register/cursor
  high-water marks returned to later layers/outer sorting. Caller EndCoroutine;
  removed grouped completed Program allocation/copy/PC relocation. Recursive
  CTE alternate source now shares enclosing producer destination (below). Paired grouped window
  native/public tests and structural no-sourceProgram grouped branch contract;
  ORDER BY window alias error now repaired via resolveOrderGroupBy1818–1853
  result-slot ownership -> rewrite lifting result expression -> parent drain
  consuming result slot, not alias input column. Paired alias r/s and ordinal2
  public/native coverage; original failure retained in status evidence.

- select.c generateWithRecursiveQuery2666–2848 + sqlite3Select8055–8074:
  compileRecursiveWindowSelect -> CTE names/transient resolution -> deferred
  recursiveProducer Select -> window source InitCoroutine -> existing
  compileRecursiveCteSelect shared builder/parameters/coroutine destination ->
  caller EndCoroutine -> window publication builder.finish (Queue empty label).
  No standalone source compile even for metadata; no window sourceProgram
  opcode remapping. Range reservation/high-water and pinned public queue empty,
  OFFSET, parent ORDER and reset/finalize coverage; generic derived copier open.

- Progressive ordered aggregate ALL: select.c multiSelect2990 ->
  multiSelectByMerge (finite typed sorter adaptation retained, not merge claimed).
  compileAggregateSelect ordered compound now forwards arm SRT_Sorter into
  enclosing builder and drains to parent SelectDest, with builder cursor/range
  allocation and no armPrograms copy. compileDerivedProducer ordered aggregate
  descriptor resolution -> shared compiler coroutine destination. Generic
  residual child.ops/pcMap remains and original census/general dispatch open.

- select.c multiSelect3010–3047 TK_ALL shared destination: production
  compileTableCompoundProducer dispatch consumed by compileTableSelect and
  residual physical compound derived producer, forwarding existing ordered,
  ALL scan, and table-set specialized owners. No completed residual physical
  metadata Program/pcMap; transient names first arm/descriptors last resolved
  arm. General CTE/nested/complex residual fallback remains unresolved.

Progressive CTE compound descriptor dependency: compoundArmColumns resolves
transient result names/qualifiers independently of completed Programs. Existing
compileCteUnionAll materializes CteUse once, OpenDup per arm, emits parent
SelectDest in shared builder (select.c multiSelect3015–3040 and
sqlite3Select8055–8074). Admitted `WITH q(x) AS (VALUES(2),(1)) SELECT d.x
FROM (SELECT x FROM q UNION ALL SELECT 8) d LIMIT 4` native/public INTEGER
[2,1,8], x/reset/finalize. Two-CTE-arm derived variant is NOT established admitted:
current early tableCompound metadata resolves lexical q as schema table and
fails; no general CTE compatibility claimed. General residual pcMap and exhaustive
transitive caller census remain open. Public API unchanged.

Residual compound destination admission now also consumes ordinary aggregate
arm owners (historical residualPhysicalCompound renamed compoundDestinationProducer).
No aggregate exclusion when the production multiSelect dispatcher already
forwards compileAggregateSelect(builder,ops,parameters,destination). Descriptors
still resolve independently via compoundArmColumns; accumulator step/finalize
and empty aggregate row belong to the existing arm owner, not a parent walker.
Pinned select.c multiSelect3015–3040 / sqlite3Select8055–8074; differential
SELECT d.s FROM (SELECT sum(a) AS s FROM t1 WHERE a>1 UNION ALL SELECT 8) d
LIMIT 4 => INTEGER[15,8]; empty aggregate => [NULL,INTEGER8]; parent LIMIT0 =>[].
Names/reset/finalize retained. General residual nested-derived/window/other
owner census and pcMap retirement remain open, not general SELECT equivalence.

Transient compound routing correction: compileSingleCompoundDerived and
 tableCompoundProducer persistent scan admission now exclude retained
 from.derived/cteDerived SrcItems before schema-table resolution. Source
 select.c8075–8088/8134–8139 preserves CteUse subquery/materialized ownership
 and OpenDup, never treats lexical CTE name as schema storage. The common
 compound dispatcher/compoundArmColumns handles these retained contexts.
 Previously documented two-CTE-arm `WITH q(x) AS (VALUES(2),(1)) SELECT d.x
 FROM (SELECT x FROM q UNION ALL SELECT x FROM q) d` now pinned/public
 INTEGER[2,1,2,1], with and without outer LIMIT4, name/reset/finalize. This
 repairs misrouting at physical admission, not SQL text. Generic pcMap still
 exists for other contexts; transitive census/general owner remains incomplete.

Window/compound integrity boundary: window.c958–964 sqlite3WindowRewrite
requires pPrior==0. compileWindowSelectLowering now rejects a retained compound
owner with typed temporary unsupported BEFORE rewriting, shared by scalar,
table and derived callers. Previously `SELECT d.r FROM (SELECT row_number()
OVER () AS r UNION ALL SELECT 8) d LIMIT 4` published INTEGER[1] although
pinned native produces [1,8]. This was silent partial compilation, not a
supported shape to preserve. Public regression requires atomic temporary;
standalone variant also rejects. Correct window-arm composition remains open:
current lowering requires initial builder and private parameter ownership, and
ordered compound dispatcher declines windows. No support/equivalence claim.

Window-arm composition supersedes the previous whole-compound rejection for
unordered ALL: multiSelect's isolated Select arm now calls the existing window
owner with shared builder/parameters/destination. window.c958–964 pPrior==0
still enforced at lowering entry; compound itself is never rewritten as arm1.
sqlite3WindowRewrite accepts enclosing nMem/nTab high-water allocation floors;
physical resolver sources allocate at builder.cursors. Window exhaustion emits
an explicit ownerExit Goto past generated Gosub/Return bodies instead of Halt.
Existing derived materialization caller consumes that exit carrier rather than
assuming child Halt. Initial attempt failed maxWorkUnits because old caller
re-entered setup; carrier correction repairs exit ownership, not VM behavior.
Native/public scalar two-arm [1,8], two window arms [1,1], physical window arm
parentLIMIT2/OFFSET1 [2,3], empty window arm/scalar [8], resets/finalize pass.
Compound ORDER/set/child LIMIT window admission remains atomic temporary;
no general window compound or transitive fallback retirement claim.

Nested ordinary compound arm: extracted existing standalone bounded
flattenSubquery production into flattenOrdinaryDerived, shared by arm emitter,
compoundArmColumns and standalone caller. Pinned select.c4290–4348 admits
nonzero FROM; conservative existing DISTINCT/GROUP/ORDER/LIMIT/window/compound
exclusions retained. Parser eager SrcList splicing must not erase renamed
projection expressions: a AS x was wrongly considered identity projection,
leaving outer x against t1.a. Retain renamed projection for lowering substitution.
Native/public nested arm SELECT x FROM (SELECT a AS x FROM t1 WHERE a>1) n
UNION ALL SELECT8 wrapped parentLIMIT4 => INTEGER[3,5,7,8], x/reset/finalize.
This was formerly no-such-column, not an admitted child clone. General transient
materialization/descriptor graph and fallback retirement still unresolved.

Renamed projection follow-up: absent outer alias cannot make a single-source
EList an identity splice. parse.ts now retains that SrcItem independent of alias
presence. Existing flattenOrdinaryDerived then substitutes expressions and
combines WHERE before ordinary resolver/arm lowering (select.c4681 substSelect).
Pinned/public aliasless nested compound arm INTEGER[3,5,7,8] and standalone
INTEGER[3,5,7], column x, reset/finalize; missing tail under parentLIMIT0 errors
before Statement publication. Prior alias-only gate missed this path; no new
execution algorithm. Multi-source parser eager flattening debt remains outside
this bounded single-source production; general child.ops/pcMap gate remains red.

Retained compound-arm derived LIMIT/OFFSET gap: parser now recognizes clauses
owned by a FROM SrcItem Select as nested, not misplaced arm ORDER/LIMIT
(parse.y623ff composition). Native nested LIMIT2/OFFSET1 arm+scalar returns
INTEGER[5,7,8]; public formerly parse-error then, after ownership repair,
no-such-table:n. select.c4336–4340 restrictions13–15 prevent flattening this
producer. No materialization implementation is claimed: descriptor/emitter
owners now reject retained non-CTE derived arms atomically typed temporary
before physical schema lookup. Standalone/derived wrappers both covered;
ordinary flattened renamed arms remain supported. Next implementation needs
shared builder/parameters/destination on compileDerivedProducer, including
caller coroutine termination and LIMIT after child output, not flattening
OFFSET or copying completed child programs.

Nested limited ordinary physical arm supersedes the preceding blanket gap:
compileDerivedProducer accepts enclosing builder/parameters/destination for its
existing single physical child path. InitCoroutine patches use local init PC,
resolver uses enclosing cursor floor, allocators propagate high-water, output
uses caller destination, exhaustion falls through without Halt/freezing shared
ops. Child LIMIT/OFFSET remains inside child coroutine; parent output remains
outside (select.c8055–8074). Native/public nested LIMIT2/OFFSET1+scalar [5,7,8]
and existing reset/finalize pass. Shared owner conservatively declines DISTINCT,
ORDER/WHERE/aggregate/window/multiple-source parents and nonordinary children;
compound-wide LIMIT on retained arm also stays temporary. Descriptor resolution
uses child descriptors then transient names; emitter makes final shape admission.
General child.ops/pcMap fallback remains, no general nested-materialization claim.

Retained DISTINCT ordinary physical child is now admitted by the shared derived
owner. This delegates to existing compileInnerTableSelect result KeyInfo,
Found/IdxInsert before OFFSET/destination/LIMIT, matching select.c selectInnerLoop
codeDistinct; DISTINCT is per child, never compound ALL deduplication. It remains
unflattened (select.c4342 restriction4). Pinned/public duplicates t2[1,1,3,9]
produce child[1,3,9]+tail8; childLIMIT1/OFFSET1 => [3,8], empty child => [8].
No ORDER/window/aggregate/nested child admission change. General copied child
fallback and shared compound-limit filtering still unresolved.

Retained ordinary physical derived arms now carry compound LIMIT/OFFSET output
through compileCteUnionAll's existing emitRow continuation. The derived consumer
calls it after local child coroutine Yield; shared compound iOffset/iLimit never
replaces the child's own limit. Shared stops patch to compound end, not child
EndCoroutine; zero LIMIT still resolves all arms before publication. This follows
select.c selectInnerLoop destination+LIMIT ordering and multiSelect shared limit.
Pinned/public child DISTINCT LIMIT2/OFFSET1 then compoundLIMIT2/OFFSET1 [9,8],
derived parentLIMIT1 [9], compoundLIMIT0[]; public missing tail under LIMIT0
errors before Statement. Limited CTE/window/aggregate arms remain temporary.
No generalized evaluator/coroutine VM alteration or finished Program relocation.

Retained physical child's ascending ORDER is now forwarded by shared derived
owner to existing compileInnerTableSelect sorter. DISTINCT before sorter insertion,
child OFFSET/LIMIT on sorter drain, then coroutine/compound output continuation
retain select.c selectInnerLoop/pushOntoSorter/generateSortTail ordering. Paired
child DISTINCT ORDERx LIMIT2/OFFSET1 + scalar [3,9,8], with compoundLIMIT2/OFFSET1
[9,8] pass INTEGER/name/reset/finalize. Descending child remains typed temporary
under existing scan-direction admission; parent ORDER is not newly admitted.
This is owner forwarding to existing specialized sorter, not new generic sort or
claim of complete ORDER/collation/NULL compatibility. Parent WHERE binding and
general fallback copier remain open.

Shared retained derived owner now forwards zero-FROM ordinary children to its
existing scalarProducer selectInnerLoop candidate instead of physical-only
admission. LIMIT/OFFSET/WHERE enters local EndCoroutine, then existing compound
output continuation. scalarProducer resolves all child names even LIMIT0 (not
only when ORDER exists), preserving atomic error before publication. Paired
scalar3 LIMIT1+tail8 [3,8], compoundLIMIT1/OFFSET1 [8]; public empty/offset/WHERE
and missing-column LIMIT0 regressions. No additional expression walker or VM
change; parent WHERE NameContext work and general copier census remain open.

Retained VALUES child compound descriptors now use transient column1..columnN
names rather than expression token names; width is validated before descriptor
publication (select.c sqlite3ColumnsFromExprList/multiSelectValues). Existing
compileDerivedProducer VALUES branch already feeds each row to coroutine then
shared compound output continuation; no emitter/VM change. Pinned/public nested
VALUES(2),(1)+scalar8 [2,1,8], compoundLIMIT2/OFFSET1 [1,8], column1/types/reset/
finalize pass. Missing projected name and mismatched VALUES width at LIMIT0
reject atomically. General transient NameContext/copy census remains open.

Transient name collision owner is now resolver-exported transientColumnNames;
vdbe imports it for derived/CTE/view/window consumers instead of duplicate
implementation. Pinned select.c2301–2306 strips trailing colon even without
numeric digits on collision; prior /:\d+$/ diverged for duplicate x: and emitted
x::1. Corrected shared primitive /:\d*$/; native/public duplicate x: projected
x:1 => INTEGER[1,8]. Source primitive tests cover ASCII fold/suffix stripping,
input immutability/frozen result. Existing deterministic suffix allocation beyond
four collisions remains an adaptation gap: upstream randomizes counter after
cnt>3, tests do not claim oracle parity for randomized suffixes. General
transient descriptors/NameContext affinity and copier census still open.

Nested resolver compound transient names now come from resolved first-arm
results (qualified TK_COLUMN names), not joined lexical tokens; pinned
select.c2260ff. Public scalar retained compound still cannot compose its child
destination; it now rejects typed temporary before false persistent-table lookup.
Oracle SELECT (SELECT d.a FROM (SELECT t1.a FROM t1 UNION ALL SELECT8) d LIMIT1)
returns INTEGER1; this is a recorded unresolved producer gap, not output parity.
First-arm descriptor resolution is bounded; full compound affinity/collation and
lexical NameContext ownership remain work, not claimed implemented here.

Standalone scalar/EXISTS over retained unordered ordinary UNION ALL now composes
compileDerivedProducer on enclosing builder with Mem/Exists destination and
first-output break (select.c SRT_Mem, expr.c sqlite3CodeSubselect). Child arms are
bounded ordinary <=1-source, no CTE/nested/window/aggregate/set/ORDER. Empty gives
NULL/0; parent LIMIT/OFFSET remain independent. Scalar compiler now emits result
body and LIMIT setup on one builder using setup/body/continuation labels, replacing
its detached resultOps append, so nested coroutine PCs remain absolute. Derived
OFFSET now targets actual resume after destination, not fixed instruction count.
Pinned standalone qualified child scalar => INTEGER1; public OFFSET1=>3,
LIMIT0/empty=>NULL, EXISTS=>1, invalid tail LIMIT0 atomic error. Expanded cases
not newly native paired. Outer compound scalar-expression emission remains
excluded; generic child.ops copier/census and affinity/collation gaps remain.

Unordered ordinary zero-FROM ALL arms now call compileScalarSelect with enclosing
builder/ParameterBuilder and output continuation, sharing its expr.c subquery
owner instead of compileExpression without subquery hook. Scalar publication/
Halt belong only to root; shared return leaves ops mutable and common compound
LIMIT/OFFSET stays in multiSelect output. Scalar entry also routes eligible ALL
to common owner, including when parser recovered nested LIMIT means top-level
FROM is empty. Pinned/public nested physical compound scalar +8 => INTEGER[1,8],
x/reset/finalize. Public common OFFSET=>[8], childLIMIT0=>[NULL,8], parentLIMIT0=>[],
invalid tail under parentLIMIT0 atomic SQLite error. Expanded probes not newly
native paired. WHERE/DISTINCT scalar arms and VALUES retain existing specialized
routes; no general correlated/JSON/ORDER/set coverage claim. General copier gate
still red, source/transitive census and C1–C6/Chinook/resources remain required.

Common ALL zero-source ordinary WHERE arms now compose shared scalar owner too.
The owner codes predicate with the same expr.c subquery hook and jumps to its
local continuation on false/NULL before result body/output; common compound
OFFSET/LIMIT only sees admitted rows. Pinned select.c8292/8347 invokes WHERE
before selectInnerLoop; where.c7020–7035 nTabList==0 tests predicate with
SQLITE_JUMPIFNULL to iBreak. No physical WHERE planner/interface changed.
Pinned/public nested scalar WHERE1+8 [1,8], WHERE0+8 [8], empty predicate EXISTS
+8 [8], predicate EXISTS true commonOFFSET1 [8], name x/INTEGER/reset/finalize.
Invalid projected child under WHERE0/parentLIMIT0 rejects atomically (public-only
new error probe). DISTINCT/VALUES/physical predicate branches retain their
specialized routes. General transient binding, clone census and full integration
remain open; this is not a general WHERE/correlation parity claim.

Common ALL ordinary zero-source DISTINCT arms now call shared scalar expression/
subquery owner, with or without WHERE. Upstream where.c6945–6952 establishes
WHERE_DISTINCT_UNIQUE for nTabList==0; select.c codeDistinct UNIQUE emits no filter.
A sole candidate needs no new KeyInfo/ephemeral set (not an algorithm exception).
The scalar owner's clause gate acknowledges that bounded shared ordinary case;
VALUES/compound/physical DISTINCT keep existing owners/boundaries. Pinned/public
nested DISTINCT scalar +8 [1,8], WHERE0 +8 [8], ALL equal tail [1,1] (no cross-arm
DISTINCT), name x/INTEGER/reset/finalize. Public NULL child plus commonOFFSET [8]
and invalid child WHERE0/parentLIMIT0 atomic error. No generic DISTINCT/correlation
or multirow VALUES parity claim. General copier/census and full integration open.

Ordinary scalar-root DISTINCT now acknowledges the same WHERE_DISTINCT_UNIQUE
single-candidate branch as shared ALL scalar arms (where.c6945–6952,
select.c codeDistinct972–976). Root versus shared destination does not change
uniqueness. Admission excludes VALUES, compound and physical FROM; ORDER/group/
HAVING retain clause gates. Root publication/Halt remains unchanged. Pinned/public
standalone DISTINCT retained-compound scalar => INTEGER1/x/reset/finalize. Public
childLIMIT0=>NULL, rootLIMIT0/rootOFFSET1=>empty and invalid child rootLIMIT0
atomic error. Expanded probes public-only. This repair does not establish general
DISTINCT, retained producer/correlation/copy-retirement or integrated compatibility.

Root ordinary zero-source WHERE is resolved by compileTableSelect then handed to
compileScalarSelect's shared expression/predicate owner, after window rewrite
and before physical scan admission. No physical WHERE interface/planner change.
select.c8292/8347 and where.c7025–7035 order zero-source predicate before result
production; false/NULL exits before output. Scalar owner root admission now accepts
WHERE as well as shared arms. Pinned/public DISTINCT retained scalar WHERE1=>
INTEGER1/x, WHERE0/NULL=>empty/reset/finalize. Public predicate EXISTS=>3, LIMIT0
empty and invalid predicate/projected child atomic SQLite errors. ORDER/VALUES/
compound/group/window retain their specialized routes/boundaries. This is not
completion of linked NameContext/correlation or general copier retirement.

Retained ordinary zero-source scalar child producer now invokes shared
compileScalarSelect expression/predicate owner with SRT_Coroutine callback
(select.c8055–8073 tag-select-0482 sqlite3Select(pSub,&dest)). Child LIMIT/OFFSET
and false predicate exit fall through to its EndCoroutine; parent/common limits
remain separate. Replaced duplicate predicate/result/DISTINCT/limit emission,
including unnecessary single-candidate set, not completed Program/PC copying.
Pinned/public nested scalar-expression child +8 => INTEGER[1,8]/x/reset/finalize.
Public childLIMIT0, childOFFSET1/DISTINCT, WHERE0, commonOFFSET1 =>[8] and invalid
projected grandchild childLIMIT0 atomic error. Expanded cases public-only.
General compound scalar/VALUES/ordered child specialized routes, transitive
copier census, linked transient affinities and full integration remain open.

Retained zero-source ALL ordinary SELECT arms now compose shared scalar
expression/predicate owner and coroutine destination under the child's common
LIMIT/OFFSET (select.c3010ff multiSelect shares limit/offset and calls sqlite3Select).
Multirow VALUES retains its specialized loop. Arm projection resets hasValues
from arm.origin, not inherited compound flags, in resolution and lowering.
Pinned/public retained nested scalar ALL =>INTEGER[1,8]/x and commonOFFSET1=>[8].
Public WHERE0/DISTINCT=>[8], NULL scalar=>[NULL,8], LIMIT0 empty and invalid child
atomic error/reset/finalize. Expanded non-OFFSET probes public-only. No complete
compound/VALUES/correlation/copy-retirement or integrated compatibility claim.

Retained ALL VALUES row ELists now use shared scalar expression/subquery owner
one row at a time, retaining row iteration/common child LIMIT/OFFSET/coroutine
(select.c multiSelectValues2862–2889 invokes selectInnerLoop for each node;
shared scalar owner supplies expression/destination body in TS).
Not scalarizing the entire multirow VALUES or introducing another evaluator.
VALUES-first retained ALL metadata now uses column1..N rather than lexical
expression text (select.c sqlite3ColumnsFromExprList). Pinned/public nested scalar
VALUES + (3) +8 =>INTEGER[1,3,8]/column1/reset/finalize. Public OFFSET=>[3,8],
NULL scalar=>[NULL,3,8], LIMIT0 empty and invalid child atomic error. Expanded
probes public-only. Standalone VALUES/ordered/set specialized expression emitters
and general copier/census/transient affinity/integration remain open.

Standalone VALUES now iterates row ELists on one SelectProgramBuilder/parameters
and uses shared scalar expression/subquery/destination owner for each one-row
body (select.c2875–2889 multiSelectValues/selectInnerLoop). Width validation and
column1..N metadata retained; every row resolves before publication; root alone
Halts/freezes. Program carries supplied database/maxRows because row subqueries
may open physical cursors: expression composition must preserve execution context,
not merely ops/registers. Pinned/public VALUES nested scalar,(3) =>INTEGER[1,3]/
column1/reset/finalize; public reversed rows[3,1], NULL child[NULL,3], invalid late
row/grandchild atomic SQLite errors. Expanded probes public-only. Other specialized
VALUES/compound/ordered routes and general copier/census/integration remain open.

Pure retained VALUES producer now calls the shared VALUES expression owner with
coroutine destination on the enclosing builder/parameters, replacing its duplicate
no-subquery-hook row emitter (select.c8055–8073 coroutine and2877–2889 VALUES
selectInnerLoop iteration). Parent limits stay consumer-owned; producer finishes
with local EndCoroutine. Pinned/public retained VALUES nested scalar,(3) =>
INTEGER[1,3]/column1/reset/finalize. Public parentOFFSET1=>[3], childLIMIT0=>
[NULL,3], parentLIMIT0 empty, invalid late row atomic SQLite error. Expanded probes
public-only. Ordered/set expression paths and general copier/census/transient
binding/integrated compatibility remain unresolved.

Retained ordered zero-source ALL now composes shared scalar expression/predicate
owner per ordinary arm/VALUES EList with sorter insertion continuation. This
removes independent no-hook expression/predicate emission; ordinary single-row
DISTINCT uses existing UNIQUE proof, VALUES iteration preserved. Common sorted
LIMIT/OFFSET/topN and coroutine destination unchanged. Upstream select.c3584/3599
multiSelectByMerge compiles each arm with sqlite3Select, and selectInnerLoop owns
expression evaluation. Existing bounded finite-sorter adaptation is not replaced
by upstream merge here; no broader ordering/correlation compatibility claimed.
Pinned/public nested scalar +8 ORDER DESC =>INTEGER[8,1]/x/reset/finalize. Public
commonOFFSET=>[1], WHERE0=>[8], NULL scalar=>[8,NULL], invalid child LIMIT0 atomic
SQLite error. Expanded probes public-only. General copier/census/transient
binding/integration remain unresolved; set destinations still have separate
expression emission requiring owning-path translation.

Retained set/mixed arms now compose shared expression/predicate body into existing
IdxInsert/SetDelete and ALL-tail destinations; duplicate no-hook evaluators removed.
VALUES ELists iterate fully before INTERSECT retention. Pinned/public nested
scalar UNION8 =>INTEGER[1,8]/x/reset/finalize. Public INTERSECT[1], EXCEPT[],
NULL UNION NULL[NULL], WHERE0[8], mixed tail/commonOFFSET[8,1], invalid child LIMIT0
atomic SQLite error pass. Expanded probes public-only.
Important current-source comparison: SQLite3.53.4 select.c2987–3003 routes *all*
non-ALL compounds through multiSelectByMerge, synthesizing ORDER BY1. The retained
TS KeyInfo ephemeral-set route is pre-existing adaptation, NOT a translation of
an upstream temporary-set branch. This slice changes expression/destination
ownership only; source-faithful merge replacement/technical rationale review
remain open along with general copier/census/transient binding/integration.
Upstream3584/3599 compiles arm sqlite3Select coroutines; shared body preserves
that semantic ownership while current TS destination algorithm remains debt.

Retained two-arm unordered non-ALL zero-source compounds now use source-shaped
multiSelectByMerge control flow (select.c2987–3003,3570–3719): sorted arm
coroutines, A<B/A==B/A>B, eof-A/eof-B, generateOutputSubroutine previous-key
suppression before common OFFSET/LIMIT. Shared scalar/VALUES expression owner
feeds each arm sorter. No ephemeral union/delete/intersection on this admission.
Existing sorter arm representation remains browser-safe; CompareJump fuses
OP_Compare/OP_Jump using shared Mem/KeyInfo (all ascending full-row tie keys here;
explicit ordered/mixed/more-than-two arms retain old route). Both initially empty
and exhausted transitions use caller Yield P2; no completed Program relocation.
Pinned/public multi-column INTEGER,NULL duplicate UNION=>[[1,NULL],[2,NULL],
[3,NULL]], INTERSECT=>[[2,NULL]], EXCEPT=>[[1,NULL]], metadata/reset/finalize pass.
Public initial empty arms/common limits pass. Illegal trailing VALUES LIMIT
fixture was removed: pinned grammar rejects it too, not a product regression.
General old set-route replacement, collation/encoding/REAL/BLOB/resources/ordered
merge and transitive copier census/integration remain open. This is bounded
source-owner progress, not complete compound fidelity or exception approval.

Unordered retained pure set chains now recursively compose prior SELECT merge
into A coroutine (select.c3570–3607 destA/pPrior sqlite3Select). Prefix merges
own previous-key suppression but not root common LIMIT/OFFSET; their end falls
through to local EndCoroutine. Root alone applies common limits. This replaces
pre-existing ephemeral-set algorithm on admitted pure unordered set chains,
not mixed ALL/ordered paths. Pinned/public left-associated UNION/EXCEPT/INTERSECT
and three-arm duplicate UNION commonOFFSET pass INTEGER/x/reset/finalize.
Structural regression requires recursive merge/CompareJump/root limits and
excludes ephemeral set/child.ops in that producer. 149 focused tests/type pass;
general copier ownership remains red. REAL/BLOB/collation/encoding/resource and
mixed/ordered merge translation plus transitive census/full integration remain
open; no broad compatibility claim.

Retained unordered mixed chains ending in a set operator now recursively merge
ALL prefixes as sorted streams (select.c3507–3516 regPrev=0 for TK_ALL,
3653–3689 equal emits A/advances A, EOF drains both). ALL merge allocates no
previous-key state; enclosing set merge suppresses duplicates. Common limits
remain root-only. Chains ending ALL retain existing sequential output route,
not sorted by this change. Pinned/public ALL-prefix duplicate UNION[1,2],
INTERSECT[2], EXCEPT[1], commonOFFSET[2] pass INTEGER/x/reset/finalize.
This removes ephemeral set consumption on this admission; ordered/mixed tails
and old set fallback still need displacement. Final regPrev branch source
comparison prompted deletion of unnecessary ALL state; type26 focused pass
following earlier native/type149 pass. General compatibility/census/integration
and collation/REAL/BLOB/encoding/resource gaps remain open.

Retained unordered mixed compounds ending ALL now emit merged prefix then
sequential tail to same coroutine destination/common limit registers, matching
select.c3004–3045 multiSelect TK_ALL ownership. Prefix limit exhaustion skips
all tails; prefix EOF resumes tail with residual OFFSET/count. Tail WHERE runs
in shared expression owner before counting output. No tail sorting/deduplication.
All admitted unordered set/mixed paths now avoid old ephemeral-set branch;
that branch remains for explicit ordered sets pending merge permutation work.
Pinned/public UNION2,1 ALL2=>[1,2,2], empty EXCEPT prefix=>[1], common
LIMIT2 OFFSET1=>[2,2], OFFSET2=>[2], INTEGER/x/two resets/finalize pass.
Public LIMIT0/LIMIT1/false tail/two unsorted tails/invalid tail despite LIMIT0
atomic error pass. Native/type149/diff pass; general copier16/1 remains red.
REAL/BLOB/collation/encoding/resources/full census/peer integration open.

Retained admitted ordered set/mixed compounds now use recursive coroutine merge,
removing superseded ephemeral-set/delete/intersection/output-sorter branch.
Existing ordered admission remains one column/one term: permutation identity,
not general ORDER support. select.c3465–3507 distinguishes merge vs duplicate
KeyInfo: descending/explicit collation/NULLS placement affect merge/arm sorter,
previous-row equality remains compound collation ascending. CompareJump now
honors KeyInfo nullsLarge before descending reversal (shared Mem storage class).
Ordered ALL tails are recursive sorted merge, unordered tails stay sequential.
Pinned/public DESC[2,1], DESC NULLS FIRST[NULL,1], mixed DESC/commonOFFSET[2,1]
with x/types/reset/finalize pass; native/type149/diff pass. Full collation/type
encoding/resources, multi-column permutation/order admission and general
copier/census/integration remain open. Structural tests updated to require merge
ownership, not deleted ephemeral implementation details.

Retained ordered ALL one-column/one-term producers now dispatch to shared
recursive source merge instead of finite whole-compound sorter. TK_ALL owns
no regPrev (select.c3507–3516), equal emits A/advances A, both EOF branches drain
remaining duplicates (3662–3684). Common limits root-only; shared expression
body produces arm sorter/coroutine. Wider/multiple-order supported ALL retains
existing sorter adaptation until permutation support lands, not rejected.
Pinned/public duplicate DESC[2,2,1], DESC NULLS FIRST[NULL,1], commonOFFSET[2,1],
metadata/types/two resets/finalize pass; native/type149/diff pass; broad copier16/1
still red. No full compound/type/encoding/collation/resource compatibility claim.

Retained wider/multiple-term ordered ALL now shares recursive source merge:
ORDER resolution maps each term to result index, arm sorter stores permuted keys
plus full payload, CompareJump indexes payload through permutation (select.c
3479–3505 OP_Permutation/KeyInfo). Removed whole-compound finite-sorter branch;
no supported width/order contract narrowed. Set admission remains existing
one-term/one-column; no claim general set tie-key expansion implemented.
Pinned/public two-column ORDER2,1DESC=>[[3,1],[2,1],[1,2]], alias ORDER y,xDESC
LIMIT1 OFFSET1=>[[2,1]], INTEGER/x,y/two resets/finalize pass. Earlier NULL,
scalar/predicate/VALUES/compound probes retained. Native/type149/diff pass after
obsolete structural locator updated; broad copier16/1 remains red. Full type,
collation,encoding,resources/census/linked contexts/integration remain open.

Root zero-source set/mixed compound arms now use shared scalar expression body
and destination callbacks on enclosing builder/parameters; replaces no-hook
compileExpression row emitters in prefix and ALL suffix. Physical scalar
subqueries carry Program.database/maxRows at publication. Pinned select.c3584/
3599 arm sqlite3Select and expr.c scalar destination ownership inform composition;
root ephemeral set algorithm remains debt, not claimed pinned merge translation.
Pinned/public SELECT(SELECT a FROM t1 LIMIT1) UNION8=>INTEGER[1,8]/x/reset/finalize
now passes (previous public typed temporary); EXCEPT/INTERSECT/ALL suffix pass.
Native/type149/diff pass. Root ordered/unordered ALL emitter and root set merge
algorithm remain unresolved, as do general census/resources/integration.

Root admitted scalar set/mixed compounds and retained set/ordered ALL now call
one emitScalarCompoundMerge mutable-builder/destination owner, rather than root
ephemeral insertion/delete/intersection/output sorting. select.c2987–3005 and
multiSelectByMerge arm/destination/output policy own recursion; root SRT_Output,
retained SRT_Coroutine. Unordered trailing ALL sequential/common limits retained.
Root width/ORDER admission unchanged (ordered sets one-column/term). No synthetic
FROM wrapper/finished graph relocation. Root prevalidation still computes unused
old limit setup before selecting merge; not emitted/published, cleanup debt.
Pinned/public root EXCEPT chain[1], ALL-prefix INTERSECT[2], ALL-tail OFFSET[2,8],
DESC OFFSET[1] INTEGER/x/reset/finalize pass; physical scalar regression remains.
Native/type149/diff pass after structural helper-following assertion update;
broad copier16/1 red. Root pure ALL/ordered ALL duplicate emitters, full type/
collation/encoding/resources/linked contexts/census/integration remain unresolved.

Root ordered scalar/VALUES ALL now calls emitScalarCompoundMerge with SRT_Output,
same owner as retained coroutine compounds. Removed independent ORDER resolver,
compileOrderedScalarSubquery hook and whole-compound sorter; source TK_ALL
regPrev=0/recursive arm coroutine ownership select.c3507–3518,3580–3605.
Root set prevalidation/unused duplicate limit setup removed: shared owner resolves
ORDER/errors and owns limits. Existing ordered set width admission unchanged.
Pinned/public duplicate DESC[2,2,1], NULLS FIRST[NULL,1], two-column permutation,
physical scalar ORDER/OFFSET[1] pass; physical scalar previously typed temporary.
Native/type149/diff pass, broad copier16/1 remains red. Root unordered ALL still
uses separate no-hook row emitter; encoding/type/collation/resources/census and
linked transient contexts/integration remain open, not compatibility acceptance.

Root zero-source unordered ALL now lowers every arm/VALUES EList through shared
scalar expression owner on enclosing builder/parameters with sequential output
and common limits, per select.c3005–3048 TK_ALL. Dispatcher no longer sends this
zero-source contract to compileCteUnionAll's no-hook expression route; physical/
CTE/predicate/DISTINCT/group branches retain their specialized producer. Program
carries database/maxRows for physical scalar cursor execution. No sorting/dedup.
Pinned/public physical scalar ALL[1,8], OFFSET[1], scalarLIMIT0[8,NULL], INTEGER/
NULL/x/two resets/finalize pass. Public VALUES[1,3,8] and invalid late scalar
under LIMIT0 atomic SQLite error pass. Native/type149/diff pass; broad copier16/1
red. Specialized CteUnionAll zero-source arm emission still needs shared owner;
full type/encoding/collation/resources/census/linked contexts/integration open.

compileCteUnionAll zero-source ordinary/VALUES arms now use compileScalarSelect
with shared builder/parameters/common emitRow, removing fallback no-hook emitter
that scalarized VALUES to its first EList. select.c multiSelect TK_ALL3005–3048
and multiSelectValues/selectInnerLoop own row iteration. Compiled descriptor
columns preserve VALUES-first column1 naming. Physical/CTE/aggregate/window arm
branches unchanged. Zero-source grouping remains typed temporary not partial.
Pinned/public VALUES physical-scalar + table ALL[1,3,1,3,5,7], table+VALUES
[1,3,5,7,1,8], common OFFSET[3,1] INTEGER/column1 or x/reset/finalize pass.
Native/type149/diff pass; expanded public metadata/late-invalid-LIMIT0 pass after
illegal trailing VALUES LIMIT fixture corrected with SELECT tail. Ordered CTE
zero-source emitter and CTE materialization row hooks remain unresolved; broad
copier16/1/type encodings resources/census/integration remain open.

Ordered specialized ALL no-source arm now uses shared scalar/VALUES expression
owner feeding its existing sorter destination (select.c3580–3605 arm owner).
Project hasValues from arm.origin in semantic producer: compound-wide flag was
wrong on mixed SELECT/VALUES and caused missing-row invariant failure. Manual
predicate/result hookless loop removed. Numeric complete-result ORDER admission
unchanged; alias ordering remains temporary in this specialized route. Legal
VALUES middle+SELECT tail required (trailing VALUES ORDER is syntax error).
Pinned/public table+scalar[1,1,3,5,7], table+VALUES+tail[1,1,3,5,7,8,9], scalar
WHEREfalse[1,3,5,7] INTEGER/x/reset/finalize pass. Native/type149/diff pass after
structural test follows shared owner. Existing specialized whole-compound sorter
algorithm debt remains; CTE materialization/census/resources/integration open.

CteUnionAll bounded materialized SELECT/VALUES producer now delegates row
expressions to shared compileScalarSelect builder/parameters/ephemeral destination
rather than no-hook compileExpression. select.c8102–8139 tag-select-0488 calls
sqlite3Select(SRT_EphemTab); existing Gosub/Return/OpenDup reuse remains. Pinned/
public repeated physical-scalar VALUES CTE[1,3,1,3], empty scalar CTE[NULL,NULL]
metadata x/reset/finalize pass, native/type149/diff. Scalar LIMIT nested in CTE
currently misattributed by parser (LIMIT before UNION error); probes use WHERE
unique/empty instead, parser gap retained. Materialization Once/error ordering,
CTE descriptor/collation/general shape and specialized ordered merge debt remain;
no exhaustive compatibility/resources/integration claim.

Ordinary physical/scalar ordered ALL numeric complete-result keys now compose
shared recursive merge via arm emitter interface: physical compileInnerTableSelect
feeds source sorter destination, scalar owner feeds ordered row callback. Pinned
select.c3580–3605 destinations remain arm-owned; aggregate/CTE/derived/window/
DISTINCT specialized routes retain old bounded sorter until integrated. No
finished graph relocation. Resolved implicit column collation accompanies ORDER
KeyInfo (first emitted attempt lost NOCASE; existing regression exposed it and
owning key producer fixed). Pinned/public physical WHERE/empty/tie cases pass;
native/type149/diff pass. Whole-compound sorter remains for excluded specializations,
not removed globally; interfaces/census/type encoding resources/integration open.

Ordered specialized numeric complete-result ALL aggregate/GROUP/HAVING arms
now feed shared recursive merge through compileAggregateSelect sorter destination,
not whole-compound sorter. select.c3580–3605 compiles arm sqlite3Select; aggregate
output flows through selectInnerLoop destination. Empty SUM NULL, HAVINGfalse,
group rows preserve output/lifecycle, pinned/native/type149/diff pass. KeyInfo
resolution must project each arm GROUP/HAVING carriers as row lowering does;
inherited compound HAVING caused false nonaggregate error, owning semantic
projection corrected. DISTINCT/CTE/derived/window specialized sorter remains;
no census/resource/full compatibility acceptance claimed.

Ordered physical DISTINCT ALL arms now enter shared recursive merge, preserving
arm DISTINCT carrier and compileInnerTableSelect Found/IdxInsert before sorter
destination (select.c selectInnerLoop/codeDistinct); no-source DISTINCT retained
specialized route until its row contract integrates. Numeric complete-result ORDER
admission unchanged. Pinned/public duplicate parity [1,1], empty A [1], NULL ties
[NULL,NULL] plus existing CAST/+column NOCASE cases pass; native/type149/diff,
then new shared-owner structural test passes. Specialized CTE/derived/window and
no-source DISTINCT whole-compound sorter remains; exhaustive census/resources/
C1–C6/Chinook integration unclaimed.

Ordered specialized ALL single-candidate no-FROM SELECT DISTINCT now feeds shared
merge through scalar row callback. No-source SELECT has at most one candidate;
lexical DISTINCT resolution retained then dedup flag elided in lowering, matching
select.c codeDistinct WHERE_DISTINCT_UNIQUE no-op. VALUES multirow not included;
physical DISTINCT retains own Found/IdxInsert. Pinned/public physical-scalar
DISTINCT, false predicate and NULL ties preserve rows/types/x/reset/finalize;
native/type150/diff pass. Old sorter remains for CTE/derived/window and non-single
candidate specializations; census/resources/full integration not approved.

Ordered single-use ordinary CTE flatten now precedes shared merge admission/key
resolution (select.c7879 flattenSubquery before producer). Existing bounded
restriction and EList/WHERE substitution moved, not expanded: materialized,
repeated, compound, GROUP/DISTINCT/ORDER/LIMIT/nested sources still excluded.
Reconstructed arm carriers carry substituted result/from/where to merge while
preserving original compound operator. Pinned/public table CTE predicate and
combined parent predicate [2,5,7]/[2,5] metadata/reset/finalize pass; native/type150/
diff pass after shared-owner locator updated. Old ordered sorter remains for
other specializations, generic flatten restrictions/CTE mappings/census/resources/
full integration remain debt; no exhaustive compatibility claim.

Ordered ALL represented window arms now compose shared merge through existing
compileWindowSelectLowering sorter destination on enclosing builder. select.c7699/
window.c958 sqlite3WindowRewrite applies to individual pPrior==0 arm; multiSelect
3580–3605 composes destinations. Never invoke window lowerer on whole compound.
Pinned/public row_number ordered tie [1,2,2,3,4] and empty A [2] INTEGER/x/reset/
finalize pass; prior caller fell through to typed temporary complex table arm.
Native/type150/diff pass. Numeric complete-result ORDER bounded admission unchanged;
retained derived/CTE/materialization and generic copying/census/resources/integration
remain open, not global window/compound compatibility approval.

Ordered ordinary derived single-table flattenable arm now uses existing
flattenOrdinaryDerived before shared merge. select.c flattenSubquery4290ff/7879
substitutes EList/WHERE before execution; lexical output column names survive
producer substitution (qualified d.x outputs x, not producer a). Preserve aliases
from lexical column expression, not expressionName token text. Pinned/public
predicate and combined predicate [2,5,7]/[2,5] INTEGER/x/reset/finalize pass;
native/type150/diff. Retained LIMIT/compound/DISTINCT/group/window derived
producers remain excluded by existing flatten restrictions, no general flatten/
metadata/type-origin/resource compatibility claim; copier/census/integration open.

Ordered retained ordinary derived noncompound/nonnested projection now invokes
compileDerivedProducer shared destination/row callback inside merge (select.c
3580–3605 arm destination,8048+ retained coroutine). Child LIMIT remains owned by
child, never flatten into parent. KeyInfo collation derives through producer
projection descriptor/name substitution for this bounded single-level branch,
not physical lookup of lexical d. Arm emitter owns resolution; scalar-only merge
validation remains when no emitter supplied. Pinned/public LIMIT2 [1,2,3] and
LIMIT0 [2] names/reset/finalize pass; native/type150/diff. Compound/nested retained
keys, CTE/materialization, generalized transient NameContext/copying/census/types/
resources/integration remain debt; no general descriptor compatibility claim.

Retained derived merge key now checks explicit collation inherited from producer
projection before implicit resolved-column fallback. select.c2574 multiSelectCollSeq
uses first non-null sqlite3ExprCollSeq in left-to-right arm order; prior bounded
metadata substitution omitted producer explicit COLLATE. Child execution/LIMIT
unchanged. Pinned/public retained literal NOCASE 'a' versus 'B' => ['a','B'], TEXT,
x/reset/finalize; baseline wrongly binary ['B','a']. Native/type150/diff pass.
This repairs existing key producer, not full transient resolver/descriptor debt;
compound/nested sources/census/resources/full integration remain unclaimed.

Retained transient column default BINARY now terminates compound collation search
when its producer has no explicit/implicit collation. expr.c248 TK_COLUMN always
looks up column collation; select.c2426–2429 sets optional producer collation on
transient descriptor, otherwise default remains BINARY. Metadata projection must
not treat a literal producer's lack of collation as the outer column's lack.
Pinned/public retained literal 'a' then 'B' COLLATE NOCASE => ['B','a'], TEXT/x/
reset/finalize; prior output ['a','B'] wrongly inherited later arm NOCASE.
Native/type150/diff pass; cast/unary-plus column identity preserved. General
transient descriptors/compound keys/census/resources/integration still open.

Transient merge collation metadata now derives recursively from leftmost producer
EList (select.c2346 sqlite3SubqueryColumnTypes follows pPrior) and resolved
expression collation/default BINARY. Consumer projected column identity is matched
to unique transient names; CAST/+ preserve identity. No expression substitution
or child predicate/LIMIT movement in key producer. Removed prior substituted-key
and special default fallback path. Ordered nonnested compound derived projection
now feeds existing shared producer; pinned/public NOCASE scalar ALL child plus
outer 'B' => ['a','B','c'], TEXT/x/reset/finalize. Native/type150/diff pass after
normalizing descriptor uppercase BINARY at KeyInfo boundary. Helper covers
collation only, not full affinity/type/name/NameContext migration; unsupported
noncolumn nested projection remains typed temporary. Copier/census/resources/
CTE/full integration still open.

Transient collation metadata now requires resolution of represented producer arms
before leftmost descriptor extraction, matching select.c2346 SF_Resolved
precondition. Reuses expandAndResolveSelect (no new expression walker), maps
NameResolutionError to SQLITE error before descriptor/Program publication; nested
producer validation recurses. Public/native later missing-column both ordinary
and LIMIT0 reject at prepare (native SQLITE_ERROR/null stmt). Corrected baseline
already rejected during lowering; this is error/semantic ownership relocation,
not a newly fixed behavioral red. Initial test used wrong error.reason instead
of API error.kind; corrected baseline passed. Native/type150/diff pass.
General linked transient resolver/affinity/types/census/resources still open.

Transient descriptor precondition now validates later derived arm projection as
well as its child producer: isolate arm then existing descriptor qualifier/name
checks; recursion terminates on single-arm branch. select.c2346 SF_Resolved
requires consumer expressions resolved, not only producer. Public/native nested
later n.missing with inner LIMIT0 yields atomic SQLITE prepare error (native null
stmt). Baseline already rejected during lowering; ownership moved earlier, not
behavioral red. Native/type150/diff pass. Full linked NameContext integration
remains missing; this local descriptor precondition is not its replacement.

Transient merge metadata now binds a SrcItem-indexed descriptor to the existing
expandAndResolveSelect linked NameContext instead of local name/qualifier lookup.
select.c2346 builds transient columns; resolve.c278 lookupName owns consumer
expression resolution. Descriptor override is explicit optional resolver argument,
not schema mutation/alias. Metadata-only rootPage0 table never enters physical
producer; affinity remains placeholder BLOB, not full type/affinity translation.
Removed local projection walker/name matching; inherited collation through resolved
column uses existing implicit owner. Native/type150/diff pass. Invalid direct
column with child LIMIT0 remains atomic SQLITE. COLLATE-wrapped invalid projection
still fails earlier typed temporary in compoundArmColumns (unimplemented shape),
not falsely claimed repaired. Physical planner interfaces unchanged.

compoundArmColumns retained direct projection now consumes the same transient
SrcItem descriptor/resolver as merge collation. Removed independent name splitting,
qualifier matching and exposed-index walker; resolver's direct column reference
owns index and output alias. Shared transientSourceTable supplies unique names,
collations and declaration metadata (select.c2346 / resolve.c278 lookupName).
Metadata-only physical rootPage0 isolation unchanged; affinity placeholder BLOB
and general type-origin propagation remain debts. Public/native aliased retained
NOCASE column yields renamed/['a','B']; baseline already passed, ownership repair.
Native/type150/diff pass. Unsupported nondirect projections still typed temporary;
producer/register contexts/census/resources/full integration not claimed.

Bounded single-source CTE compound column metadata now attaches shared transient
SrcItem descriptor to resolver, deleting duplicate name/qualifier walker. CTE
explicit column aliases preserved from normalized producer EList (VALUES default
column1 is not CTE x). Collation precondition likewise binds CTE descriptors,
without schema mutation or physical planner changes. select.c2346 and resolve.c278
own descriptor/lookup path. Public/native repeated q(x) VALUES child projected
renamed => [2,1,2,1], INTEGER/name; baseline passed. First implementation lost CTE
names to VALUES defaults; corrected descriptor name policy. Native/type150/diff
pass. Runtime materialization/register/affinity/census/resources still debt.

Transient SrcItem descriptors now carry noVisibleRowid independently of physical
WITHOUT ROWID. select.c5908 sets TF_NoVisibleRowid on derived transient table;
resolve.c471/564 VisibleRowid guards implicit rowid candidates. Resolver checks
this flag only after real column lookup, preserving explicitly projected rowid
and physical table rowids. Shared transientSourceTable sets flag for derived/CTE
metadata; no physical planner/storage semantics changed. Unit red allowed hidden
rowid via descriptor; corrected. Pinned/public rowid/_rowid_/oid missing with child
LIMIT0 are atomic SQLITE prepare errors; explicit rowid returns [1,2]. Native/
type157/diff pass. General affinity/type/register/census/resources still open.

Transient metadata now has one resolveTransientArm binding/error owner shared by
compoundArmColumns and collation extraction. Removed separate validation recursion
and duplicated derived/CTE resolver setup: each arm resolves its actual SrcItems
once in collation extraction, then leftmost plan supplies descriptors (select.c2346
SF_Resolved / pPrior, resolve.c278 lookupName). Recursive child descriptors remain
metadata-only, never physical scans. Public/native COLLATE missing-column LIMIT0
atomic SQLITE error verified; current baseline already rejects after previous
column resolver repair, superseding older temporary prediction. Native/type157/
diff pass. Affinity placeholder and general execution register contexts remain.

Ordinary transient descriptor affinity now uses resolvedExpressionAffinity
(expr.c45 sqlite3ExprAffinity): resolved column/rowid, CAST type, COLLATE operand,
parentheses representation; unary plus and literals have no affinity. Consumes
columnUses or direct result binding, not declared-type guess. Shared descriptor
uses this only for noncompound producers. Compound cross-arm DataType/conflict/
FLEXNUM scan (select.c2378–2398) remains explicitly BLOB placeholder; scalar SELECT
expression affinity remains absent, not claimed translated. Unit source-branch
coverage plus existing pinned public differential native/type158/diff pass.
No runtime producer/register context migration or broad compatibility claim.

Nested compound-derived resolver descriptor now uses SrcItem-indexed binding,
not child schema alias injection, and carries TF_NoVisibleRowid (select.c5908,
resolve.c471). Explicit rowid columns remain visible. Scalar retained compound
caller resolves consumer before temporary destination admission, preserving lexical
error precedence even LIMIT0. Pinned/public nested implicit rowid/_rowid_/oid now
SQLITE_ERROR before statement publication; first public attempt remained temporary
because capability check preceded resolution, corrected at caller. Unit/native/
type159/diff pass. Runtime unsupported destination remains temporary for valid
unimplemented shapes; compound affinity/register/census/resource debt remains.

resolvedExpressionAffinity now includes expr.c56 TK_SELECT: scalar SELECT follows
semantic SelectNode identity into existing linked resolved child then first result
expression affinity. Correlated outer column and differently typed siblings use
their actual resolved contexts; IN/EXISTS/unary plus do not inherit SELECT affinity.
Shared ordinary transient descriptor consumes this without independent re-resolution.
Unit baseline undefined scalar affinities repaired; existing pinned differential/
type160/diff pass. No new public affinity observability claim. Compound cross-arm
DataType/FLEXNUM scan, general register contexts/copiers/resources remain open.

Transient compound descriptor now scans resolved arm expression affinity and prior
DataType masks (select.c2378–2398), stopping on real BLOB affinity, not confusing
it with NONE. expr.c106 DataType owner covers represented literals/parameters/
functions/column/CAST/scalar SELECT/CONCAT/CASE output unions, unary plus/COLLATE.
Numeric/text prior conflict gives BLOB; no affinity defaults BLOB. FLEXNUM on
numeric leftmost CAST remains explicit metadata placeholder BLOB, not a claimed
runtime substitute; shared Mem has no FLEXNUM yet. Unit mask red then native/
type161/diff pass; public affinity observability not newly asserted. Runtime
register contexts/copiers/census/resource acceptance remain open.

Correction to compound affinity scan: source select.c2387 loops over later arms
AFTER selecting first affinity owner as well as prior NONE masks. Previous scan
omitted tail masks. resolvedCompoundAffinity now owns both loops; transient table
caller consumes it. Source tests numeric column then text => BLOB, TEXT CAST then
numeric => BLOB, NULL/integer/NULL => integer, BLOB CAST stops. Native/type162/diff
pass. Numeric CAST FLEXNUM placeholder remains explicit; no new public affinity
observability acceptance or general execution context migration claimed.

Shared Mem affinity now represents FLEXNUM explicitly (vdbe.c386–410): converts
numeric text, preserves preexisting REAL/IntReal, NULL/BLOB/non-numeric text.
NUMERIC also performs source integer-affinity on existing REAL (old TS incorrectly
exempted NUMERIC). Compound numeric leftmost CAST now supplies FLEXNUM instead of
BLOB placeholder (select.c2397); comparison affinity treats FLEXNUM as numeric.
Unit REAL/text/BLOB across three encodings plus descriptor CAST branch; native/
type178/diff pass. Initial test used nonexistent setReal; corrected setDouble;
initial red was test API failure, not demonstrated production red. General runtime
register contexts/copier/census/resource acceptance still open.

Compound FLEXNUM CAST identity now peels TS-only parentheses (parse.y1176
returns same Expr); COLLATE remains real Expr, so does not qualify as TK_CAST
(select.c2397). Source-unit nested parentheses red repaired. Added pinned/public
retained compound numeric CAST/ALL/order probe: REAL1/INTEGER2/INTEGER3, name x,
reset twice/finalize. Native/type179/diff pass; probe was already supported, not
claimed public behavioral red. General register/copier/census/resources remain.

Resolved affinity/DataType now includes represented TK_VECTOR first-field metadata
(expr.c76–81/135–145), through leftmost nexprlist, using actual linked column use.
Does not admit row-value result lowering. Function DataType branch now recognizes
actual grouped Lemon function signature explicitly; previously function happened
to return unknown via generic identifier affinity branch (baseline passed).
Unit vector red repaired; function coverage passing baseline retained. Native/
type181/diff pass; TK_SELECT_COLUMN/deferred-function affinity and generic runtime
contexts/copier/census/resources remain unclaimed.

Nested scalar compound-derived resolver descriptor now resolves every represented
producer arm and consumes shared resolvedCompoundAffinity, replacing blanket BLOB
(select.c2378–2399 SF_Resolved prerequisite/scan). First-arm output names unchanged;
SrcItem-index attachment/noVisibleRowid preserved. Linked scalar affinity now
integer/NULL, numeric/text conflict BLOB, numeric CAST FLEXNUM. Unit red repaired,
existing pinned/public native/type182/diff pass; no new runtime destination admitted.
Nested descriptor collation/type-origin and general runtime contexts/copier/census/
resources remain open; later arm lexical resolution now happens at descriptor owner.

resolvedImplicitCollation now consumes direct ResolvedResult binding when no
columnUses entry exists (expr.c248 TK_COLUMN); nested compound transient descriptor
uses first resolved producer implicit collation, default BINARY. NOCASE/BINARY
first-column order coverage unit red repaired, native/type183/diff pass. This is
not full nested explicit EP_Collate propagation: explicit COLLATE/expression
children and type-origin remain open at nested descriptor owner. No new destination
admission or broad compatibility claim; runtime/copier/census/resources remain.

Resolved expression collation owner now handles represented explicit COLLATE and
EP_Collate left-to-right children (expr.c276–308), skipping scalar SELECT contents,
CAST/UPLUS/parentheses operand ownership first. Nested compound descriptor and
transientResultCollations consume it; latter removes duplicate expression-tree
conversion for explicit collation. Unit explicit/function/binary/SELECT boundary
red repaired; native/type184/diff pass. Vector/deferred-function/register collation
branches and full type-origin/runtime/census/resource coverage remain unclaimed.

Resolved TK_VECTOR collation now follows first field before EP_Collate child scan
(expr.c271): later explicit COLLATE cannot override first field or supply missing
collation. Affinity/collation share parser first-field extraction. Result KeyInfo
consumer uses resolvedExpressionCollation, removing duplicate explicit-tree walk.
Unit red repaired; native/type pass, initial suite184/1 obsolete structural locator,
updated locator then185/0. Native not rerun after assertion-only change. Deferred/
register collation, remaining compound callers/runtime/census/resources still open.

Compound merge now resolves each actual arm and uses shared resolvedCompoundCollation
(select.c2574 prior-first/non-null); removes explicit/implicit/derived conditional
collation walker from emitScalarCompoundMerge. Whole-compound ordered CTE route
also uses resolvedExpressionCollation per arm; no resolvedImplicitCollation calls
remain in vdbe.ts. BINARY physical column stops later NOCASE, literal NONE permits
later collation. Unit owner red; initial type narrowing failure then obsolete
locator185/1, corrected native/type186/diff pass. General source/type-origin/
register/copier/census/resources remain; not exhaustive compatibility acceptance.

Nested compound resolver descriptor declared type no longer blanket NULL: shared
transientDeclaredType normalizes original resolved direct-column type against
computed affinity (select.c2399–2420/global.c standard table), NUM for FLEXNUM,
INT/REAL/TEXT/BLOB otherwise. Original INTEGER preserved, numeric/text conflict
BLOB, CAST FLEXNUM NUM source-unit red repaired; native/type187/diff pass.
This is descriptor metadata, not new public provenance acceptance: full columnType
CAST/scalar SELECT/origin recursion and general transientSourceTable consumer still
need migration, as do runtime/copier/census/resources.

Nested transient type normalization now consumes resolvedExpressionDeclaredType:
select.c columnTypeImpl TK_COLUMN and semantic-linked TK_SELECT (including outer
binding) only; TS parentheses preserve Expr identity, CAST/UPLUS/functions do not
inherit declared type. Unit red repaired with direct wrapped fallback; native/
type188/diff pass. General producer descriptor/origin recursion and public metadata
assertions still pending; not a new declared-type compatibility claim.

General transientSourceTable now consumes resolved columnType and shared declared
normalization (select.c2399–2420), removing independent compoundArmColumns type
copy. Public/native compound CAST probe additionally checks top-level decltype
NULL (leftmost CAST expression has no columnType), rows/types/name/reset unchanged; this is not evidence
that descriptor NUM equals public origin metadata. Ownership locator red repaired;
native/type189/diff pass. Derived origin recursion, scalar expression metadata and
remaining runtime/copier/census/resource integration remain pending.

Resolved scalar SELECT result descriptors now inherit linked child type/database/
table/origin (select.c2033 TK_SELECT), preserving parent name and not copying
child affinity/collation. Parentheses only preserve C Expr identity; CAST/UPLUS/
functions remain expression metadata. Unit metadata red repaired; native/public
scalar INTEGER/name/value probe passes, public provenance checked against source
(not native metadata functions); type190/diff pass. Derived-origin recursion and
runtime/copier/census/resources remain unresolved.

Derived descriptor columnType now follows attached resolved current producer EList
(select.c1988–2005), not transient alias as main-table origin. WeakMap keyed by
TableNode represents SrcItem subquery relationship without modifying physical
schema; ordinary derived producers attach, CTE names excluded (separate C branch).
Nested scalar unit alias-origin red repaired, literal producer type/origin null.
Native/type191/diff pass before CTE guard; guard type33/diff pass afterward.
No fresh public/native derived-origin probe; retained execution metadata copier
and exhaustive CTE/view/type-origin integration still pending.

Retained derived compoundArmColumns now consumes resolved descriptor producer
relationship (columnTypeImpl subquery branch), removing independent child metadata
recursion while preserving direct-projection capability boundary. New native/public
derived physical-column probe preserves INTEGER/name/value and source provenance.
Initial oracle expectation of last literal decltype NULL was disproved (INTEGER);
corrected test passed baseline, not a public product red. Native/type192/diff pass.
Public compound metadata arm selection still requires generalized source census;
runtime/copier/resource integration remains open.

Residual compound destination metadata now takes leftmost arm for both name/type/
origin (select.c2155 and generateColumnTypes call), removing last-arm provenance
copy. Earlier commentary attributing CAST probe NULL to last literal was wrong:
CAST itself has no columnType. Native derived-column/literal pair confirms INTEGER
while CAST/literal pair NULL; existing public probes pass. Structural branch red
repaired; native/type193/diff pass. No exhaustive compound metadata census or
runtime/copier/resource acceptance implied.

Correction: columnTypeImpl subquery branch uses pS->pEList, with no pPrior rewind
(select.c1999). Compound derived origin therefore follows current/rightmost arm,
unlike GenerateColumnNames top-level leftmost and transient affinity/type scan.
Producer bindings now attach rightmost plan. Native literal-first/physical-last
retained derived probe disproved NULL hypothesis: INTEGER; public baseline passed,
nested resolver source-unit red repaired. Native/type193/diff pass. Earlier
residual leftmost metadata repair still needs caller-context distinction review:
public root vs derived producer cannot share blanket arm ownership. No complete
compound metadata/census/runtime/resources acceptance.

Residual derived producer metadata correction: current/rightmost type/origin with
leftmost transient names, not top-level GenerateColumnNames. Attempted parent
resolved metadata passed193 tests but inspection showed producerOutput width must
remain child width, independent of parent projection; removed that attempt before
handoff. Current source-specific producer composition restored (columnTypeImpl
1999); type/focused tests pass. Full suite/native from removed attempt are not
acceptance evidence for final code; broad rerun remains due.

Producer-width follow-up differential now covers three-column compound coroutine
payload consumed by one-column parent and reordered/repeated three-column parent,
LIMIT2 and two reset cycles, INTEGER rows and names through public/native APIs.
Both pass on final current-arm metadata composition. Native/type193/diff rerun
closes prior removed-attempt verification gap, not overall migration acceptance.
The child payload register range must not be allocated from parent EList width
(selectInnerLoop destination count vs parent result; TS producerOutput).

columnTypeImpl represented COLUMN/SELECT metadata now shares
resolvedExpressionMetadata for declared type and origin; declared-type wrapper and
scalar result finalization consume it. Parent scalar identity gate does not rewrite
ordinary merged/coalesce result descriptors. Direct descriptors take precedence
over columnUses to preserve INTEGER PRIMARY KEY origin name. Unit absent-owner
red then IPK/merged descriptor regressions repaired; type194/diff pass. Native pair
passed before final identity gate; public pair rerun afterward. No new execution
admission or complete origin/branch compatibility claim.

Shared columnType metadata now honors resolver FULL USING semantic coalesce rewrite
before looking at child columnUses: resolve.c lookupName builds TK_FUNCTION,
columnTypeImpl default has null type/origin. TS retains Lemon syntax and explicit
ResolvedResult coalesce marker, so metadata checks that marker. Direct, wrapped,
and scalar-linked FULL USING metadata unit red repaired. Native/type195/diff pass;
no new public FULL execution admission or native provenance-function comparison.
Affinity/collation semantic rewrite ownership remains to census independently.

FULL USING deferred coalesce correction: resolve.c774 assigns SQLITE_AFF_DEFER;
expr.c76/272 explicitly follows first argument for affinity/collation, while
DataType FUNCTION is7 (scalar SELECT wrapper instead uses text affinity mask6).
Merged result bindings now supply first source for affinity/collation and function
mask for direct DataType. Initial generic-function no-affinity hypothesis was
wrong and removed. Wrapped missing-bindings repaired; final type29/diff pass.
Broad/native final rerun due; no new FULL public execution admission.

Deferred coalesce ownership lookup is now shared across affinity/DataType/
collation/columnType metadata, matching Lemon parentheses by semantic identity
(parse.y same Expr, resolve.c774 deferred function, expr.c76/272 first argument).
Source test directly passes peeled inner expression to all owners; final
native/type197/diff pass closes prior final broad/native verification gap.
This is represented result rewrite ownership only, not exhaustive predicate or
runtime context binding. No new public FULL execution compatibility claim.

lookupName now carries FULL USING merged argument sources on ResolvedColumnUse,
not just result descriptors (resolve.c774 deferred coalesce rewrite). Shared
semantic owner consults these bindings for predicates and correlated references;
DataType FUNCTION7 and null columnType no longer infer first raw column type.
Predicate source-unit verifies WHERE-only binding. Initial probe used wrong
fixture index2 (actual same index1), corrected; no claimed baseline product red.
Native/type198/diff pass. Runtime codegen use of merged argument list and full
transitive semantic context census still pending; no new public admission.

Coalesce/ifnull scalar lowering now follows expr.c4592–4607: first argument
copies into target, target NotNull precedes each next argument, no redundant
last test/NULL write. Mem Copy and async execution retained. Existing lowering
already short-circuited observably; pinned public/native overflow-unused-argument
probe passed before and after, integer result with reset twice. Structural owner
coverage verifies branch order. Final native/type199/diff pass. This does not yet
lower lookupName deferred merged argument bindings in runtime predicates:
joined resolveTree still searches names, and correlated binder selects first
raw column. Deferred flags/affinity/collation and root WHERE interfaces must land
together; no FULL predicate admission or general migration approval claimed.

Joined correlated aggregate scalar binder now lowers lookupName mergedSources
into deferred coalesce arguments (resolve.c774), mapping inner source to its
allocated cursor and retaining outer cursors. Expression deferredAffinity flag
supplies first-argument affinity/collation (expr.c76/272), distinct from ordinary
coalesce call. Shared expr.c4592 lowering emits short circuit. Native/public
matched FULL USING correlated aggregate probe passes baseline and final; final
native/type199/diff pass. Unmatched FULL/residual outer WHERE/name-search binder
coverage still pending; scalar nonaggregate LIMIT form remains typed temporary.

Joined residual predicates/result expressions and non-result ORDER now carry
Lemon reduction identity into resolver columnUses lowering, including FULL USING
mergedSources to deferred coalesce (resolve.c774/expr.c4592). Removed independent
name search for these original expressions. Native/public FULL USING WHERE x=1
probe reproduced internal lost-identity error and now passes integer result.
Physical selected operands/generated USING still lack reduction identity and
retain bounded name binding: coordinate root WHERE interface before removal.
Final native/type199/diff pass, not exhaustive CASE/subquery/outer-pass coverage.

Joined original-expression and correlated scalar binders now align erased
parentheses with Lemon identity before operand traversal (parse.y expr LP expr
RP returns same Expr). Parenthesized searched/simple CASE public probes first
reproduced internal operand identity failure, repaired at binder entry; expr.c
5683 CASE producer ordering preserved. Qualified unmatched FULL residual pass
and reset twice verified, not new merged unmatched coverage. Native/type199/diff
pass; native/public rerun after adding wrapped correlated aggregate coverage.
Physical synthetic binding/deferred unmatched/context census remain open.

Parentheses identity alignment is shared in expressionIdentityReduction
(parse.y1176 A=X), consumed by joined original/scalar and window source/FILTER/
retained producer binders. Window WHERE (a=1) native passes/public internal
operand binding red repaired at owning representation primitive. Only LP expr RP
is peeled; CAST/COLLATE/unary semantics survive. Final native/type199/diff pass.
FILTER/retained contexts consume same primitive but fresh public probes there
still due; no exhaustive window rewrite/runtime ownership claim.

Window FILTER BETWEEN probe exposed ignored filter in whole-partition drain
(native1/public16). window.c1049 duplicates full FILTER into producer payload;
1688 reads it before AggStep. FILTER binder now traverses BETWEEN/IN/call/CASE
operands. Existing unguarded regAccum AggStep sites in represented specialized
window drains now share emitStep's IfNot(payload filter) around callback only;
AggValue and row/group progress remain unconditional. Shared Mem/async intact.
Native/type199/diff pass. Temporary-accumulator exclusion branches already have
individual guards and remain; inverse/direct-frame exhaustive census and fresh
IN/CASE FILTER probes remain due. No general window compatibility claim.

Filtered sliding ROWS IN probe native [1,1,NULL,NULL] exposed inverse callback
without stepped value. window.c1688 guard applies to inverse as well as step.
Specialized drains now share guarded emitStep(inverse), and pending bounded
streaming rows invoke existing windowCodeOp WINDOW_AGGINVERSE. Cursor positioning
and unconditional progress unchanged. Native/type199/diff pass. Combined
step/value/inverse sites and transitive frame census remain due: this is not
exhaustive FILTER compatibility. Probe covers INTEGER/NULL distinction.

windowAggregateCallback now owns shared FILTER/args/callback guard for
windowAggStep and specialized emitStep, removing duplicate guard production
(window.c1688). Ordered EXCLUDE TIES combined step/value/inverse routes callbacks
through it while value stays unconditional. CASE NULL/false FILTER current-row
and RANGE EXCLUDE TIES probes pass baseline/final, not behavioral reds.
Final native/type199/diff pass. Unordered no-current peer combined pair and
already individually guarded pending branches remain to consolidate/census;
no exhaustive callback or NULL/filter compatibility claim.

Unordered GROUPS1 FOLLOWING..UNBOUNDED CASE NULL/false FILTER public/native
probe (two reset cycles) passes baseline/final, not a behavioral red. No-order
combined pair and remaining pending inverse producers now use shared guarded
windowAggregateCallback/windowCodeOp (window.c1688); cursor advance still precedes
callback and progress/value remains unconditional. Direct AggInverse producer
census leaves only shared conditional opcode production plus runtime consumer
in vdbe.ts. This is textual producer census, not exhaustive frame/reachable
transitive admission proof. Step/temporary accumulator duplicate production,
resources/limits and full integration remain due. Native/type199/diff pass.

Retained derived parent expression projection: native filtered window over a
LIMIT2 physical producer yields two INTEGER1 rows, but destination composition
is not yet implemented. compileDerivedProducer no longer reports the whole
valid function expression as a missing column. It resolves the transient parent
NameContext via resolveTransientArm before typed temporary capability rejection;
actual missing identifiers remain SQLITE errors. No window admission added or
LIMIT flatten bypass. window.c1049 FILTER payload/select.c retained coroutine
composition remains required. Native/type199/diff pass includes this explicit
gap test, not row parity for this unimplemented combination.

Pending individual cumulative/sliding/following window step now consumes
windowAggregateCallback, replacing duplicate FILTER guard (window.c1688).
Fresh abs(a) FILTER cumulative public/native INTEGER1 probe passes baseline/final;
not a behavioral red. Native/type199/diff pass. Retained physical LIMIT2 window
composition was inspected (source coroutine, grouped payload and derived dispatch)
but not implemented: existing producer requires direct parent projections and
register binder/destination must be composed rather than child Program copying.
Temporary-accumulator step producers and remaining pending shared-step production
still require consolidation; no completed window producer migration claim.

GROUPS cumulative EXCLUDE CURRENT ROW temporary accumulator scan now consumes
windowCodeOp WINDOW_AGGSTEP with accumulator override. window.c1688 guards every
aggregate callback on FILTER false/NULL, including full-scan exclusion paths.
Its missing guard produced [NULL,1,4,9] instead of pinned [NULL,1,1,1] for sum(a)
FILTER WHERE a=1. Six specialized temporary scans now share this owner, retaining
identity/peer exclusions, cursor positioning and unconditional row progress.
Focused red→pass, native/type199/diff pass. Remaining pending shared step producers,
retained derived-window destination and full frame/resource census remain open;
this repairs the reproduced exclusion FILTER defect, not overall migration.

### Retained physical producer → window parent (card-t-c current repair)
The previously temporary LIMIT2/FILTER window probe is now admitted. Production
compileSelect→compileTableSelect resolves the parent via resolveTransientArm;
compileWindowSelectLowering consumes retainedSource on the same builder through
compileInnerTableSelect SRT_Coroutine. select.c8048–8077 (tag-select-0482) owns
InitCoroutine/child result range/EndCoroutine; window.c1049 copies complete FILTER
into producer payload. Direct transient column bindings copy child result registers
(not physical Column on rootPage0); FILTER uses the existing resolver-identity
expression binder returning register leaves, compiled by compileExpressionTree.
This reuses normal expression lowering, not a separate evaluator or SQL rewriting.
Child LIMIT/OFFSET belongs to its source and survives parent limits/window buffering.
No finished child Program or pcMap on this consuming path. Existing generic fallback
still remains for other callers, not retired globally. Bounds: single noncompound
physical child without DISTINCT/group/HAVING/window/order and parent without WHERE/
group/HAVING/compound; other valid destinations remain temporary, lexical errors
resolve first. Broader expression buffer slots remain atomically unrepresented.
Pinned/public INTEGER1x2/reset, LIMIT0 empty, OFFSET1 sum3, qualified FILTER plus
parent LIMIT1 pass; native/type199/diff pass. Structural gate now16/18: new retained
producer ownership passes; generic fallback and CTE metadata Program tests remain
red. Grouped owner test delimiter updated for preceding retained-source branch,
no assertion waived. Prior 15/18 intermediate included this stale delimiter.

CTE metadata investigation: parse.y609/1955ff → parse.ts selectAction excludes
WithClause child SELECT tokens from outer misplaced-clause guard. Native LIMIT2
CTE compound metadata x/INTEGER/main/t1/a; public now temporary (scalar-only CTE
producer bounds), not false lexical SQLITE. Existing structural reds unchanged;
no claimed metadata Program replacement. See TRANSLATION investigation entry.

CTE compound source: select.c8102–8139 → compileCteUnionAll CteUse map,
Gosub/Return/OpenDup and new physical compileInnerTableSelect ephemeral destination.
resolveTransientArm binds parent projection; compoundArmColumns follows producer
semantic descriptor without emitting Program. Native/public LIMIT2 INTEGER1,3,9,
metadata x/INTEGER/main/t1/a/reset, LIMIT0 tail9 and missing-column SQLITE pass.
Metadata owner gate now transitive; generic pcMap gate remains red (17/18 total).

Singleton SELECT ordering: where.c6943–6952 zero-table nOBSat full ORDER/eDistinct
unique → compileScalarSelect resolves ORDER then removes satisfied sort carrier.
Existing derived scalar expression/multi-order native/public tests (including
missing identifier LIMIT0) cover shared destination admission regression. Generic
pcMap branch no hits in180-test diagnostic census is not unreachable proof;
remaining copier gates preserved. See TRANSLATION caller/admission census notes.

Nested retained producer: select.c8048–8077 → compileDerivedProducer nestedProducer
semantic metadata + recursive shared builder SRT_Coroutine. Synthetic `(subquery)`
never enters physical tableProducer on this path. Native/public LIMIT/OFFSET/reset
and origin pair in select-derived-window-parent; new no-child-copy slice assertion.
Generic pcMap remains live debt; owner gate18/19, not complete migration.

Residual retained destination: select.c8048–8077 sqlite3Select(pSub,&dest),
2987ff multiSelect + selectInnerLoop → compileDerivedProducer semantic metadata
compoundArmColumns and residual scalar/table compound, aggregate, inner table,
scalar shared-builder dispatch. Removed completed child PC/ResultRow/Halt copier.
Existing paired derived tests and strengthened owner20/20 gate; selected279/279.
Two-source inner.ops and compound aggregate relocation remain separate debt.

select.c8048–8077/8102–8134 → compileDerivedProducer index1 two-source
coroutine/materialization: semantic compoundArmColumns, shared builder existing
producer owners, explicit payload range, EndCoroutine or Return, parent reinit/
empty/next transitions. Both inner.ops manual relocation loops retired here.
Paired select-derived-two-source-owner native/public LIMIT2/0/OFFSET2 + structural
destination gate; selected284 pass. Index0 spool/compound aggregate debt retained.

select.c8102–8134 first-source materialization → compileDerivedProducer index0
retained CTE spool: semantic descriptors + shared builder zero-key sorter
SelectDest, builder payload/output/cursors and sequential materialize/consume
control. Removed actual child ops/first-instruction/ResultRow/Halt splicing.
Paired first-source tests (LIMIT2/0/OFFSET2 + missing identifier LIMIT0), selected
289 pass; legacy physical cursor reservation remains transitional. Direct-derived
source0 admission and compound aggregate relocation are separate unresolved debt.

select.c finalizeAggFunctions/selectInnerLoop + materialization8102–8134 →
compileCompoundDerivedAggregate top-level consumer: all aggregate/ORDER/row/
output allocation retains builder high-water; output SelectDest (no fixed reg1).
Producer already shared-builder, prior relocation prediction corrected. Native/
public four compound aggregate cases + allocation gate, selected294 pass.
Bounded parent scalar-arm branch and wider parent exclusion unchanged.

- Current post-c714/b532 d caller census: `research/card-t-d-integration-c714.md`.
  sqlite3Select/tag-select-0482 parent producers and vdbe.c/vdbeaux.c execution
  boundaries checked against current sources. Remaining CTE forced/repeated
  materialization fallback4473 still composes child Programs manually; former
  generic-derived/window pcMap sites are gone. Root/s source materialization
  cursor0..30 seam and specialized semantic walkers remain live. Integrated
  owner gate passes but652/648/4 failures prevent broad acceptance.

- d c714 integration test consumers now match multiSelect database/schema
  dependencies and per-operation work tightening (same-connection cleanup
  admission); no changes to vdbe execution or emitted algorithms. Historical
  four integration reds and current reruns retained in census/status.

select.c8102–8145 CteUse/materialization → compileCteDerivedSourcesFallback:
semantic columns, enclosing builder destination, Once/fill Gosub/Return and
OpenDup reuse; no child Program/PC copying. Existing caller bounds retained,
physical0..30 reservation transitional. Paired fallback tests + selected300 pass.

- Post-c723 current integration: research/card-t-d-integration-c723.md replaces
  c714 live CTE-copy prediction. Actual fallback now follows parent producer
  destination/Once/Gosub/Return/OpenDup ownership; select.c8102–8145 compared with
  current consumers and vdbe dispatch. Native typed/errors + integrated658/658/
  type/diff pass. Resolver/expression/AggInfo semantic bindings, specialized
  dispatch and root/s allocation identity remain actionable; exact overlapping
  candidate selection boundary recorded, no mixed-file staging acceptance.

resolve.c lookupName/resolveExprStep → resolvedExpressionCarrier lexical-use
identity/depth/children → compileJoinSubquery bindResolvedExpression; expr.c
sqlite3ExprCodeTarget column metadata consumed with caller cursor mapping.
Replaced local correlated binder reduction walk/search, not other consumers.
Correlated physical join COLLATE/reset + missing/ambiguous LIMIT0 paired;
selected304 pass, literal/NULL binder and wider intersections remain gaps.

resolve.c linked lookup / expr.c target binding → compileExpressionSubquery
ordinary scalar result/WHERE/ORDER consumes carrier/shared binder, explicit
nestedReadCursors mapping and preserveScalarLeaves mode. Local duplicate walk
retired; first joined consumer bounds unchanged. Paired NULL/CASE/BETWEEN/
COLLATE/reset/errors + selected490 pass; specialized aggregate/window debt stays.

- Post-c732/c741 current integration: research/card-t-d-integration-c741.md traces
  resolve.ts730 carrier → vdbe1378 binder → joined3090 and ordinary scalar4974
  callers, lookupName frame/source/merged identity and expr codegen ownership.
  Native typed/error/reset and explicit combined owner files674/674/type/diff
  pass; wider depth/merged/metadata/resources and register-phase/window consumers
  remain mapped next work. Root/s allocation and cumulative candidate selection
  are separate unresolved boundaries, no mixed whole-file approval.

expr.c TK_AGG_COLUMN directMode/register distinction (4990–5023), resolve.c
lookupName linked depth → ResolvedExpressionBinding location/producer-row phase
and derived scalar ALL predicate/argument shared carrier consumer. Synthetic
rows[iColumn] and outer lexical cursors remain caller-owned; local bindDerived
and arg walker retired. This is not shared AggInfo finalized-row ownership or
window.c rewritten-subquery identity migration. Paired NULL/count/sum/reset/
COLLATE/alias/LIMIT0/errors and selected496 pass, not exhaustive compatibility.

window.c selectWindowRewriteExprCb/sqlite3WindowRewrite FILTER producer handoff
→ WindowRewriteFunction.filterCarrier (owned expression identity captured before
substitution), compileWindowSelect shared binder window-filter cursor/producer-row
location. Local FILTER walk/search retired; source WHERE walker remains. Physical
NULL/COLLATE/EXCLUDE/empty/errors/reset paired; selected502 pass. Retained FILTER
probes public temporary (native supported), not new admission or full rewrite proof.

window.c sqlite3WindowRewrite original pSrc/pWhere handoff → original producer
sourcePredicates linked carriers (ON then WHERE), compileWindowSelect physical
source loop shared window-source cursor location binding before Yield. Local
bindSourceExpression walk/search retired; retained/group/recursive producers
retain their own predicate owners. No stale substituted identities/register
inference. Native typed predicate/FILTER/EXCLUDE/NULL/empty/errors/reset and
selected508 pass, not full window or AggInfo compatibility.

expr.c TK_AGG_COLUMN/TK_AGG_FUNCTION, select.c finalizeAggFunctions/selectInnerLoop
→ standalone compileCompoundDerivedAggregate ResolvedAggregatePhaseCarrier:
linked argument/order source-row payload → accumulator AggStep/AggFinal →
finalized-output register. resolveTransientArm owns column links; shared binder
aggregate-source retires forRow spelling search. Parent/ordinary lower remain.
Native empty/NULL/REAL/order/reset/non-LIMIT errors + selected518 pass; LIMIT0
public temporary before caller and GROUP/FILTER/DISTINCT/bare remain gaps.

Ordinary original result aggregate lower → linked argument/ORDER phase carrier,
shared ordinary-aggregate source binding and AggStep/AggFinal accumulator location.
expr.c analyzeAggregate/select.c finalizeAggFunctions comparison: earlier resolve,
FILTER and alias HAVING/ORDER legacy lowering remain; not complete AggInfo owner.

Ordinary original result edge: pinned expr.c analyzeAggregate/AGG_COLUMN and
AGG_FUNCTION → shared linked original expression binding (args/FILTER/ORDER and
physical cursor/GROUP payload location), lowerResult phase carrier →
select.c finalizeAggFunctions/selectInnerLoop AggStep/AggFinal then projection.
Original rawTrees.map(resolve) retired. rowid/IPK payload location corrected at
owner after GROUP metadata crash. Alias HAVING/ORDER, WHERE/GROUP and subquery
binders remain separate. native/type527 + exact9 pass, not full owner acceptance.

- R1 bounded public unlimited unordered SELECT-origin UNION ALL:
  `select.c:sqlite3Select` SelectPrep -> multiSelect before arm SF_Aggregate,
  `multiSelect` shared Parse/dest and `selectInnerLoop` result range ->
  `select-compiler.ts:compileSelect` parent builder/parameters/output -> existing
  `vdbe.ts:compileCteUnionAll` shared-owner overload and c arm consumers. Owner
  overload returns columns only; entry emits Halt and freezes one Program.
  `test/conformance/select-entry-context.test.mjs` checks typed arm rows/errors,
  context propagation and terminal compiler errors. Broader R1 remains open.

R3 partial: compileCompoundDerivedAggregate resolveTransientArm before decline
→ select.c SelectPrep; parse.ts SrcList prefix carrier retention → parse.y
stl_prefix/seltablist and build.c sqlite3SrcListAppendFromTerm. Source0 join
producer LIMIT/OFFSET still missing, current R3 suite red, not full acceptance.

R3 first-source join: select.c computeLimitRegisters/selectInnerLoop → parent
limit skip/count at final output or sorter extraction; child limit before join.
parse.y prefix append retains generated derived identity but not a spliced
flattened annotation on appended ordinary item. Native/type536/diff pass after
three UTF8/16 derived-join regression fixes. Remaining R2/root seam unchanged.

Ordinary aggregate alias consuming edge: resolve.c lookupName/resolveAlias
→ resolve.ts NameContext aliasUses → resolvedExpressionCarrier substitution
→ vdbe bindResolvedExpression → compileAggregateSelect lowerResult phase entries
→ AggStep/AggFinal accumulator/final output. HAVING and unmatched ORDER no longer
use lowerAlias or resolve(aliasExpression); GROUP/WHERE remain. expr.c4977+
AggInfoColumnReg/directMode/sorter/REAL/RIGHT-null full relationships unresolved.
Paired select-aggregate-alias-owner tests/native; native/type547/diff pass.

Ordinary aggregate source WHERE: resolve.c resolveSelectStep/lookupName →
aggregatePlan column/alias carriers → shared bindResolvedExpression source
cursor/payload location → compileAggregateSelect WHERE filtering before sorter
capture/AggStep (select.c sqlite3WhereBegin/updateAccumulator ordering). Removed
resolve(whereTree) consumer only; GROUP/ON/subquery/parent spelling owners remain.
Paired select-aggregate-source-owner native/public and selected555 pass; full
AggInfo directMode/sorter/REAL/RIGHT-null phase relationships not certified.

#### Linked wrapper column identity — third checkpoint d repair
Pinned resolve.c `resolveExprStep` TK_ID/`lookupName`, `sqlite3ResolveExprNames`
walker: the column belongs to the leaf below COLLATE, while its wrapper owns
collation. TS resolve.ts `direct` unwraps for metadata, `lookupName` now publishes
both existing metadata wrapper use and true leaf use with the same lexical
source/column/depth/mergedSources. `resolvedExpressionCarrier` and shared
`bindResolvedExpression` consume that leaf without re-resolution. Original group
DISTINCT lifecycle encoding test plus nested parentheses and pinned
select-linked-wrapper-identity-native.py (4 fixtures ×2 shapes ×2 resets) cover
this relationship. No GROUP alias dispatch, VM or WHERE contracts changed; joint
checkpoint selection remains pending.

Checkpoint bounded regression: select.c selectInnerLoop SRT_Coroutine + caller
Yield/EndCoroutine → compileCompoundDerivedAggregate ordinary ALL same-builder
arm producers, shared row register, aggregate argument/local sorter owner. Removed
unnecessary ephemeral row store; budget24 encoding regressions restored without
budget increase. expr.c subselect SRT_Mem/Exists/Set → existing parent aggregate
owner before retained projection gate; finalized output LIMIT/OFFSET preserved.
Existing public exact51 and shared424 pass; native destination rows/types pass.
No completed-child splice restored. Full producer/R2 obligations not complete.


### R1 partial Boolean implication correction (2026-10-02)

`expr.c:exprImpliesNotNull` (6698–6768) distinguishes true-only from non-NULL proof and has no TK_AND/TK_OR cases. `where.c:whereUsablePartialIndex` (3700–3735) consumes that proof before choosing a partial index. The former TS unconditional AND recursion under NOT was unsound: NULL AND false is false, so NOT can be true while the partial predicate column is NULL. Nested AND now yields no proof; top-level conjunct splitting remains in `analyzeWhere`. Query-side OR is **not a direct translation of this switch**: the bounded true-only extension requires both arms independently prove the target and is disabled in every seenNot/non-NULL context. This compensates for absent upstream OR-derived analysis terms in the represented scalar path, rather than installing general OR optimization. If OR is true at least one arm is true; requiring both true-only proofs is sufficient. It cannot establish non-NULL OR operands (NULL OR true is true). Pinned public capture confirms `a=1 AND (c>0 OR c<0)` still admits forced p_live; removing this positive branch would reject a represented valid proof. Index-predicate-side OR remains a separate pinned `sqlite3ExprImpliesExpr` branch.

Verified pinned 3.53.4 native read-only fixture behavior in UTF-8/UTF-16LE/UTF-16BE: `a=1 AND NOT(c>0 AND a=2)` and reversed arms reject forced p_live at prepare and return INTEGER ids 1,2 unforced/NOT INDEXED. Parameter neighbors `[1,1]` and `[NULL,2]` return empty controls. The public regression checks both orders, reset/rebind, NULL, forced preparation rejection, zero unsafe index seeks, damaged partial-root off-path isolation, and a valid c>0 selected neighbor. No output filtering is used to compensate for an incomplete index. Frozen 24/30 selected-access accounting is unchanged; no general optimizer or complete implication claim follows.


#### R1 ordered enclosing entry ([[card:card-t-b]])
R1 ordered entry slice: select.c sqlite3Select SelectPrep/multiSelect and selectInnerLoop shared Parse/destination -> compileSelect parent allocation/publication -> compileOrderedCteUnionAll(owner) -> existing emitScalarCompoundMerge arm destinations. resolve.c resolveCompoundOrderBy integer range before specialization -> compileOrderedCteUnionAll orderIndexes code1 range check. Regression: select-entry-context.test.mjs ordered types/reset/metadata/atomic error and owner-call assertions. No claim all ordered/recursive/set ownership migrated.

R2 bounded GROUP source-key owner update: ordinary compileAggregateSelect GROUP
keys now use resolvedExpressionCarrier + shared bindResolvedExpression with
aggregate resultLocation (linked SrcItem/cursor and IPK physical payload slot),
not resolve(aliasExpression(...)) spelling lookup before sorter capture. Deleted
now-unused aliasExpression walker; resolve remains live for ON/subquery owners.
Pinned resolve.c2081 GROUP ownership and expr.c4977 TK_AGG_COLUMN/select.c8579
source-key capture comparison supports this edge only: full directMode /
AggInfoColumnReg / sortingIdxPTab/iSorterColumn/REAL/RIGHT invalid-null and
source→sorter→bare/accumulator/final relationships remain original R2 debt.
Native source+alias/full-context tests and public phase/source/alias28 pass;
current type/shared aggregate/select/resolver + digest-pinned Chinook487 pass.
Earlier broad484/485 lacked CHINOOK_DB, rerun with existing pinned fixture, not
suppression. c828 streaming/budget/destinations and b547 ordered shared entry
remain unchanged. No new feature/admission/budget/WHERE reservation change.
GROUP ordinal semantic production and ON/subquery/parent consumers remain
explicit dependent seams; do not claim this bounded key edge completes R2.

#### [[card:card-t-d]] recursive-sum / zero-source-count construction repair
Pinned select.c selectInnerLoop1441–1456 and generateWithRecursiveQuery2695+ ->
compileRecursiveAggregateSelect -> compileRecursiveCteSelect(shared destination)
-> aggregate-expression AggStep -> parent AggFinal/output/publication.
Zero-source count owner -> compileScalarSelect(shared builder/parameters/destination)
-> ordinary ALL or ordered/set merge (existing window/CTE shared overloads
forwarded) -> parent finalization. Completed producer.ops ResultRow/Halt-copy
loops removed only after those production callers migrated. Count loop previously
misattributed to recursive aggregation actually belonged to
compileZeroSourceDerivedCount. vdbeaux.c610–655 -> SelectProgramBuilder labels;
vdbe.c1746/7881/7976 -> unchanged ResultRow suspension/AggStep/AggFinal Mem owners.
Existing fused aggregate-expression destination is a bounded construction
adaptation, not a new upstream SRT kind; rationale and limits in TRANSLATION.
Tests: recursive-cte-aggregate six typed public controls × UTF8/16LE/16BE,
bind/reset/finalize; select-vdbe-owner-boundary source regression. Native six
controls match; final shared433 and canonical/lifecycle/index164 pass. New native
capture followed implementation; no native-first sequencing or complete R1/R2
claim. Exact commands/hashes recorded in card status.

R2 aggregate ON source-row update (supersedes preceding live-resolver census):
compileAggregateSelect grouped and ungrouped ON now consume aggregatePlan's
resolved ON expression carrier through shared bindResolvedExpression and
resultLocation, retaining linked lexical source identity/IPK/cursor/affinity.
Pinned select.c504+ ON tagging and resolve.c1062+ join-expression scope own
resolution, not a second spelling walker at predicate emission. Existing
predicate/reject-level/LEFT match/null-row/WHERE ordering and subquery callback
contracts are unchanged. Actual post-migration census finds no external calls
to the local recursive resolve walker: it was deleted with its stale comment.
The earlier claim that it remained a subquery consumer was incorrect; aggregate
subquery emission has its own linked context path. This is not proof that all
nested/parent contexts or AggInfo phases have migrated. No scope/admission or
private budget change. Native-first paired ON cases (grouped LEFT NULL/IPK,
ungrouped CASE/REAL/FILTER/DISTINCT/min bare tie) pass; focused31 and shared550
including canonical C1–C6, pinned Chinook, recursive destinations and private
lifecycle pass. Original full source→sorter→bare/accumulator/finalized column
ownership (expr.c4977 directMode/AggInfoColumnReg/useSortingIdx/iSorterColumn,
REAL extraction and RIGHT invalid-column NULL), GROUP ordinal production and
parent consumers remain explicit dependencies, not completed by this edge.


#### R1 recursive enclosing output entry ([[card:card-t-b]])
select.c sqlite3Select/SelectPrep -> generateWithRecursiveQuery shared Parse/Vdbe/SelectDest -> select-compiler.ts ordinary recursive branch parent builder/parameters/output -> vdbe.ts compileRecursiveCteSelect(shared) queue/history/label allocation -> enclosing finish/Halt. Standalone overload remains for other callers. Physical zero reservation preserves prior queue numbering; no WHERE seam remap. Tests select-entry-context and select-recursive-builder. General recursive specialized ownership remains open.

- Recursive outer destination limits (d after b559): select.c
  selectInnerLoop1168–1173 consumer OFFSET and generateWithRecursiveQuery2809–2827
  body OFFSET/LIMIT/restart map to separate consumerLimit/body limit carriers in
  compileRecursiveCteSelect. Consumer skip reaches body decrement/expansion;
  body skip reaches expansion directly. Both exit labels resolve in the shared
  builder. Compile-time output binding precedes publication even if runtime
  LIMIT0 skips the seed. Native/public recursive-builder and three-encoding
  recursive-cte-aggregate controls preserve typed rows, metadata, binding/reset
  and prepare code1. No new runtime evaluator or physical WHERE cursor remap.

R2 grouped column-phase migration: compileAggregateSelect's linked binding now
attaches shared columnOwner/iAgg identity to actual column expressions. Grouped
payload production retains physical source-width layout; each payload column
owns iSorterColumn and saved bare accumulator cell. Shared expression emission
consumes directMode/useSortingIdx: source cursor before capture, sorter row
register+iSorterColumn for arguments/FILTER/local aggregate ORDER, saved column
cell for HAVING/output/unmatched ORDER after finalization. Removed independent
rowColumns/savedColumns recursive walkers and register-range/group-index identity
inference. select.c8579+ capture, updateAccumulator/reset/finalization and
expr.c4977–5027 TK_AGG_COLUMN govern the relationship. Bare saved-cell copies and
min/max tie change gating are retained. REAL sorter extraction copies into a
fresh Mem and emits RealAffinity only for iColumn>=0 REAL, not rowid; absent
column entry in phase lookup emits NULL. No RIGHT expression-index admission
claim: native iAgg>=nColumn NULL branch is represented but exact upstream
expression-index RIGHT invalidation producer remains unproved/dependent.
Browser VM adaptation: SorterData already decodes payload into contiguous Mem
registers rather than SQLite's pseudo-table cursor; sortingIndexRegister plus
owned iSorterColumn addresses that same row, preserving shared sorter budget,
async lifetime and Mem types. This replaces AST register rewrites, not a generic
evaluator. Native source/alias and focused phase/private tests41 passed; added
native-first BETWEEN/IN bare min tie + CASE REAL argument combination passes42.
Initial broad556 passed; fresh final offset-field refinement broad557 passed.
GROUP ordinal production, parent/subquery correlation phase contexts and full
AggInfo analyzer/index-expression relationships remain unfinished. No budget,
feature admission or public resource/lifecycle guarantee change; c828 streaming
private24 and d244 separate recursive counters remain intact.

- GROUP result ordinal: resolve.c resolveOrderGroupBy1835+ assigns iOrderByCol
  then sqlite3ResolveOrderGroupBy substitutes result expression. resolve.ts449+
  publishes selected reduction in linked substitution map after validation;
  compileAggregateSelect group construction uses carrier.reduction to build AST
  and linked binder. Group columnOwner phases and VM sorter state unchanged.
  Original GROUP1+REAL GROUP1/HAVING/order paired native/public controls added.

- Grouped retained UNION ALL: compileAggregateSelect resolves transient parent
  source with resolveTransientArm; shared arm compilers emit coroutine rows;
  Yield/capture/WHERE/Goto restart then EndCoroutine/SorterSort transition is
  select.c tag-select-0482 and8579+ + vdbe.c1163–1248. Column owner sourceRegisters
  feeds shared emitter before capture; sortingIndexRegister/saved accumulator
  remain later phases. Producer ordering/limits reject; ungrouped c828 retained.

R2 correlated aggregate EXISTS consumer repair (after d260): actual
compileAggregateSubquery EXISTS branch now obtains aggregatePlan.nested linked
select identity. Inner WHERE/ON reductions use shared resolvedExpressionCarrier
and bindResolvedExpression; local sources map to allocated inner cursors, outer
source identity maps through resultLocation to existing AggregateColumnOwner.
Deleted this branch's owners[] name/depth guessing and independent recursive
expression binder. Parent grouped HAVING (!directMode) reads saved bare cell;
source WHERE reads live source, sorter argument phase remains owner-selected.
expr.c analyzeAggregate7403+ source-column/nested traversal and TK_AGG_COLUMN4977+
plus resolve.c linked NameContext lookup and select.c capture/update/finalization
own this relationship. Existing sole-equality EXISTS ephemeral-key specialization
retains Once/KeyInfo/local materialization and probes with the same linked outer
phase; general predicate runs existing inner loops. Public native-first grouped
HAVING red returned [] instead of two INTEGER groups; now repaired. Additional
native controls for source WHERE, local alias shadow and sole equality were
captured after repair (not all native-first). Native source/alias, type, focused63,
changed-input broad664 including canonical/Chinook/index/private/recursive pass.
No new engine, budgets or root cursor remapping. d260 grouped coroutine and
ordinal, d247 recursive counters and c828 streaming private24 remain covered.
This is the EXISTS consuming slice, not full aggregate-subquery migration:
other scalar/IN contracts and full AggInfo analyzer/index-expression/RIGHT
invalidation remain incomplete. Retained producer ORDER/LIMIT composition is
separate coordination debt; no full R1/R2 architecture acceptance claimed.


#### R1 scalar/set enclosing entry ([[card:card-t-b]])
select.c sqlite3Select SelectPrep7655/multiSelect7897/selectInnerLoop -> compileSelect final zero-source branch enclosing builder/parameters/output -> compileScalarSelect(owner) -> emitScalarCompoundMerge or scalar setup/VALUES same builder, early window/CTE owner forwarding -> enclosing Halt/builder.finish. Decline/error gates precede publication; no alternate generator retry. Existing standalone overload retained for unmigrated callers. Tests select-entry-context scalar owner/public binding/type/error/reset cases; compound private lifecycle controls.

R2 ordered scalar parent consuming migration: compileAggregateSubquery's
retained single-source ORDER BY/LIMIT1 SRT_Mem branch now binds actual result,
WHERE and ORDER reductions through nested resolved select/carrier identity.
Local source maps to its allocated cursor; outer reference maps via parent
resultLocation to AggregateColumnOwner source/sorter/saved phase. Removed only
this branch's independent local spelling/recursive walker. resolve.c linked
NameContext lookup, expr.c analyzeAggregate7403+/TK_AGG_COLUMN4977+ and
sqlite3CodeSubselect EP_VarSelect/Once branch govern actual consumers. Correlated
nestedPlan omits Once; each evaluation initializes NULL and reopens existing
sorter before reading local rows. Uncorrelated nestedPlan retains Once and
cached SRT_Mem. Existing read/WHERE rejection/Next/empty SorterSort/topN1/end
and shared async Mem/KeyInfo/private control remain unchanged; no new evaluator.
Native-first grouped nearest-row red (wrong no-such-column t.a) passes with
four distinct typed parent groups. Additional native controls captured after
repair (before paired public additions) cover source WHERE correlation, saved
output predicate with empty->NULL then populated groups, and local alias-shadow
uncorrelated cached scalar; types/names/reset/done/finalize retained. Native
source/alias, type/focused75 and changed-input selected broad670 pass including
b568 entry/canonical/Chinook/private/index/recursive. No entry edit or budget,
root reservation/admission guarantee change. c864 EXISTS/d260 ordinal+transient
sourceRegisters/d247 counters/c828 private24 preserved. This bounded consuming
migration does not complete scalar aggregate/IN/full nested depth, AggInfo
index-expression/RIGHT invalidation producers or general retained ORDER/LIMIT
composition. Parent architectural review remains revision_required.


#### R1 ordinary aggregate enclosing entry ([[card:card-t-b]])
select.c sqlite3Select AggInfo analysis8358+, grouped sorter/updateAccumulator/finalization/selectInnerLoop -> compileSelect ordinary aggregate parent allocation (physical0..30 reserved) -> compileAggregateSelect(parent) existing linked phases -> parent destination -> enclosing Halt/finish. compileZeroSourceDerivedCount singleton branch excludes compound/VALUES before emission; existing count-only compound/VALUES producer now uses parent scalar aggregate-expression destination and parent output, retaining standalone caller mode. Admission decline pre-emission; selected errors terminal.

R2 scalar aggregate argument consuming repair: compileAggregateSubquery's
retained single-local-source aggregate scalar now binds actual aggregate
reduction/arguments via nested resolved identity and shared carrier/binder.
Local reference maps to inner cursor, outer reference through parent
resultLocation to AggregateColumnOwner live source or saved finalized phase.
Displaced local spelling/recursive argument walker removed. expr.c
sqlite3CodeSubselect EP_VarSelect guard, analyzeAggregate7403+ and
TK_AGG_COLUMN4977+ plus select.c resetAccumulator/update/finalize own state:
correlated invocation omits Once and initializes accumulator NULL each time;
uncorrelated retains Once. Empty Rewind goes to AggFinal, normal Next precedes
AggFinal. Same shared Mem/KeyInfo/async/error cleanup, no new evaluator.
Native-first SUM(local+parent) prepare-error red now passes distinct totals;
post-repair native-before-public controls source WHERE, REAL arguments,
local shadow/cache and NULL argument group then populated sums pass. Existing
runner checks types/names/two reset iterations/done/finalize. Type/focused81
pass. Selected broad676 has 25 failures (651 pass), NOT a green compatibility
claim: same-input disposable baseline with only vdbe pre-repair restored
reproduces all failing names across baseline suites. Existing enclosing
aggregate retained derived/COUNT composition failures require coordinated
follow-up; not waived as unsupported. No changes to b577 COUNT5268–5546/entry,
c873/c864/d260/d247/private/root seam. Full scalar/IN nested-depth/analyzer,
index-expression/RIGHT invalidation producers and retained composition remain
unfinished; parent revision_required. Phase NULL is not RIGHT producer proof.


#### R1 retained aggregate caller correction ([[card:card-t-b]])
compileCompoundDerivedAggregate5150+: removed parent-only single aggregate zero-source evaluator; actual existing SRT_Coroutine retained producer consumes parent builder/ParameterBuilder/destination for all previously admitted physical/scalar ALL arms. Linked aggregate phase binding and private sorter allocations preserved; outputs retain complete computed-expression metadata. computeLimitRegisters outer before producer; finalize then offset/output; parent end targets enclosing Halt. Caller compileAggregateSelect parent remains terminal on selected errors; standalone still publishes own finish/Halt. Eligibility remains pre-emission.

R2 aggregate IN RHS consuming repair: retained one-column/one-local-source
compileAggregateSubquery IN branch now consumes nested resolved select/result
carrier through bindResolvedExpression. Local identity maps to allocated inner
cursor; outer maps via parent resultLocation to AggregateColumnOwner live or
saved phase. Deleted displaced local spelling/index/affinity column binder.
expr.c sqlite3CodeRhsOfIN3592+ EP_VarSelect and SRT_Set3711+ govern conditional
Once: correlated RHS reopens empty ephemeral set and recomputes child limits
per invocation; uncorrelated retains cached set. Existing OpenRead/Rewind,
OFFSET-before-insert, LIMIT-after-insert, Next/empty/end and shared InSet
probe/NULL/negation remain unchanged. Parent phase follows TK_AGG_COLUMN4977+
and linked resolve NameContext, not qualification text. Browser shared
Mem/KeyInfo/async/private cleanup unchanged, no new evaluator or admission
widening beyond correctly binding existing projected column contract.
Native-first grouped outer RHS red no-such-column t.a passes hit1/0/0/0;
post-repair native-before-public controls source WHERE, local shadow/cached
set, NULL-left empty LIMIT0 and LEFT-null-parent NOT IN prove distinctions.
Names/types/two resets/done/finalize and focused86/type/native source+alias
pass; fresh selected broad681/681 includes C1-C6/Chinook/private/index/recursive
and b unified compound aggregate repair. Previous c882 integration25 are
resolved by b583, not waived. No b583 compound/COUNT/entry or c882/c873/c864/
d260/d247/root reservation changes. Still unfinished: deeper aggregate lexical
ownership, full AggInfo analyzer/index-expression/RIGHT invalidation producers,
general retained ORDER/LIMIT/destination composition. NULL phase tests are not
RIGHT producer parity; selected tests are not whole-card architecture approval.


### Bounded lexical aggregate ownership repair ([[card:card-t-d]])
Pinned resolve.c1356–1378 assigns TK_AGG_FUNCTION.op2 to nearest referenced
SrcList NameContext (unreferenced count/constants stay local); expr.c7473
analyzeAggregate enrolls only matching walkerDepth. resolve.ts now publishes
function reduction→lexical depth separately from column location. Physical
ordinary SELECT entry consults that resolved ownership when its aggregate
exists only inside a scalar child; existing transient/set/window/recursive
preparation branches retain their owners. Resolver exceptions become public
SQLite errors before publication. General preparation migration is not done.

compileAggregateSelect enrolls nested outer-owned functions into enclosing
linked phase/AggStep/AggFinal entries before stepping. Nested SRT_Mem reads the
final accumulator through a local source existence loop, initializing NULL,
Rewind empty→end, WHERE failure→Next, first match Copy→end. It does not step an
outer function once per inner row. Local-owning scalar aggregate still resets
and steps its own accumulator. Browser reduction identity/depth map and shared
registers adapt upstream Expr.op2/pAggInfo/iAgg; no independent evaluator or
SQL-text substitution. Bare ungrouped result metadata now uses resolved result
descriptors rather than unconditional computed/null origins.

Paired select-aggregate-lexical-owner-native.py and .test.mjs retain native-first
ungrouped/grouped red cases and local-owning control; added native-before-public
empty scalar WHERE and REAL argument controls (after implementation). Five
public cases check exact types/origins, completion, reset and finalize. This is
bounded physical single-source scalar consuming coverage, not full lexical
ownership parity: deeper transient/ordered/limited/compound producers, general
AggInfo analyzer/index rewrite/RIGHT invalidation remain load-bearing. Missing
column phase NULL is not RIGHT producer evidence. Root0..30/private24/recursive
consumer/body LIMIT and peer b583/c891 consumers preserved. Commands, failed
hypotheses and final verification live in card status and lexical-owner-repair
work artifacts. No API scope or budget changes.

Lexical-owner repaired-slice final evidence and exact owner/caller map:
[card-t-d repair report](research/card-t-d-lexical-owner-repair.md).
resolve.c TK_AGG_FUNCTION.op2 / expr.c matching walkerDepth map to the separate
resolved aggregate-depth carrier and enclosing linked aggregate enrollment;
scalar local existence control consumes the finalized enclosing register.
Selected broad686/686 is regression evidence, not full upstream analyzer parity.

R2 lexical aggregate scalar-expression consuming repair ([[card:card-t-c]]):
d269 resolve.c1356–1386 aggregateUses depth and expr.c analyzeAggregate
matching walkerDepth enrollment unchanged. Actual scalar result carrier now
consumes enrolled aggregate leaf registers through optional aggregateOutput
on existing shared expression binder, before argument binding. Retired
whole-result sole-aggregate lookup/Copy restriction; linked composite
arithmetic/CASE/cast codegen runs only on qualifying local scalar row, otherwise
initialized NULL survives Rewind/WHERE rejection. Source local cursor and
parent saved/source binding retained. Mixed unenrolled aggregate leaves remain
atomic typed temporary; local aggregate branch still owns its accumulator.
No generic evaluator, new graph walker or broad physical/transient/no-FROM
preparation guard removal. Native-first ungrouped SUM(outer)+1=[1,17] and
grouped totals2/4/6/8; native-before-public empty scalar and multi-leaf CASE
REAL/overflow-short-circuit controls pass. Names/origin/types/two resets/done/
finalize retained. Native lexical/source/type/focused260 and fresh selected
broad690 pass including C1-C6/Chinook/private/index/recursive. b583/c891/d269
and root WHERE0..30/sourceRegisters/private24/LIMIT contracts preserved.
Deeper/transient owners, full AggInfo analyzer/index-expression/RIGHT
invalidation producers, general retained producer/destination composition
remain unfinished. Phase NULL is not RIGHT analyzer proof; selected coverage
is not original architectural acceptance.


#### R1 specialized recursive SUM entry ([[card:card-t-b]])
Public recursive SUM selection now allocates enclosing builder/parameters/output destination before invoking compileRecursiveAggregateSelect. Existing queue producer and accumulator consume these allocations; finalize/Copy feeds emitSelectDestination rather than a hardcoded ResultRow. Parent entry alone adds Halt/finish; standalone helper mode remains for live callers. select.c generateWithRecursiveQuery/selectInnerLoop and sqlite3Select finalizeAggFunctions share Parse/Vdbe/destination; aggregate-expression queue destination is the existing bounded TS accumulator construction adaptation, not native SRT. Pre-emission decline preserves window/multiple-CTE ownership; selected errors remain terminal. No preparation guard broadening, lexical enrollment/binding change, flag removal or budget adjustment. Existing unsupported recursive SUM ORDER/LIMIT/other aggregate consumers remain honest exclusions, not silently discarded flags. Native INTEGER55/reset plus three-encoding public recursive controls precede migration; entry22/22 and destination/lexical/scalar/composition neighbors52/52 after migration, type/diff clean. Remaining table/window/multiple-CTE and general preparation R1 still incomplete; selected checks are not full architectural acceptance.


#### R1 multiple recursive CTE enclosing composer ([[card:card-t-b]])
compileSelect now supplies actual compileMultipleRecursiveCtes builder/parameters/output destination; existing producers materialize through sorter destinations in that same owner. Consumer row/output/order-key ranges now allocate through SelectProgramBuilder.range, not a separate manual counter; sorted and unsorted final events use supplied destination. Parent entry alone Halt/finishes; standalone callers remain live. select.c generateWithRecursiveQuery/selectInnerLoop SRT_Coroutine/SRT_Output and sorter output use one Parse/Vdbe; current zero-key FIFO sorter materialization/nested-loop representation is existing bounded browser adaptation, no new evaluator or finished-child relocation. Shared ParameterBuilder removes post-emission parameter decline: legitimate producer bindings now complete selected compilation and share numbering, independently native/public tested with rebinding/reset. Existing ORDER/collation/NULL support retained; LIMIT/OFFSET/other capability declines unchanged. Selected errors terminal, preparation depth/enrollment/composite binding guards unchanged. Fresh changed-input broad692/692 (includes prior SUM slice), initial focused52/52 and expanded CTE bindings31/31; native cross-join/bindings0/type/diff0. Remaining window/table/general preparation R1 unfinished; no architectural acceptance claim.


#### R1 recursive window enclosing entry ([[card:card-t-b]])
Public compileSelect now passes its builder/parameters/output destination through actual compileRecursiveWindowSelect transient preparation to existing compileWindowSelectLowering owner. sqlite3WindowRewrite/recursive source coroutine therefore consume enclosing state, output uses existing owner destination, root drain jumps past appended window subroutines to enclosing Halt; parent alone finishes. Standalone preparer/lowerer retained for live callers. select.c8314+ sqlite3WindowCodeStep/regGosub/addrGosub and window.c sqlite3WindowRewrite share Parse/Vdbe; existing async coroutine/window event representation unchanged adaptation. Lowerer initializes register highwater from supplied builder and publishes again after late frame/subroutine allocations, preventing enclosing continuation allocation overlap. No lexical guard, clause flag, queue/WHERE/root/private budget or error conversion changes. NameResolutionError remains public code1 and selected errors terminal; compound windows still explicitly reject. Source-first pinned recursive INTEGER row_number/reset/body LIMIT controls and cross-feature public baseline precede migration. Focused13/13 then final window/entry/CTE/private46/46, native/type/diff clean; fresh changed-input broad recorded in card status. Original ordinary window/table/general preparation convergence remains unfinished, not whole task acceptance.


#### R1 ordinary physical window entry ([[card:card-t-b]])
For a noncompound/no-WITH ordinary unqualified single physical table (not derived/CTE/flattened/function input), compileSelect allocates builder/parameters/output and reserves the live physical WHERE0..30 range, then passes shared state through actual compileTableSelect name preparation into compileWindowSelectLowering. Rewrite/WHERE/window/result destination and root continuation now consume enclosing owner; parent alone Halt/finishes. Other table specializations and qualified/multisource window inputs retain live standalone contracts, not unsupported flag dropping. Table preparer preserves NameResolutionError code1 and existing atomic zero-column incomplete-lowering rejection; unsupported translation is terminal, never a retry. Source select.c8318+ window step/Gosub/selectInnerLoop and window.c sqlite3WindowRewrite use same Parse/Vdbe; existing coroutine/event representation unchanged adaptation. Earlier late highwater/ownerExit contract retained, manual lowerer allocator convergence remains unfinished. Native paired physical FILTER/NULL/WHERE/EXCLUDE/order/limit rows/types/names/reset baseline before migration and after0; final focused49/49/type/diff0. Current fresh broad evidence in card status, not prior recursive694 reuse. Remaining ordinary table/general preparation, broader window branches/full allocator convergence and committed architecture proof remain original debt; bounded entry does not certify the full correction.

Outer retained/CTE window preparation ([[card:card-t-d]]): select.c7699 and
window.c958 source rewrite maps to compileTableSelect retained window dispatch
before ordinary derived ORDER/flattening, then compileWindowSelectLowering
retainedSource. Compound source uses compileTableCompoundProducer with shared
builder/parameters/coroutine destination; physical source retains
compileInnerTableSelect. Empty arms and child LIMIT remain producer-owned;
FILTER uses the existing retained payload location; outer LIMIT remains consumer.
No VM PC transformation or source-text special case. Broader transient/window
preparation and manual allocator convergence remain open. Paired pinned capture
and public test evidence: select-window-transient-preparation.test.mjs and
work:///cards/card-t-d/window-transient-repair/.


#### R1 window setup register owner ([[card:card-t-b]], after d278)
compileWindowSelectLowering partition registers, partition-initialized/one/output-ready setup now allocate through enclosing SelectProgramBuilder.register (window.c1408–1418 sqlite3WindowCodeInit shared Parse.nMem). At each layer import still-manual prior consumer highwater before allocation, then publish frontier to remaining manual frame/buffer consumers; final late-subroutine highwater/ownerExit remains necessary. No independent setup counter, new evaluator or behavior flags; constant/null initialization and frame error ordering unchanged. Partition-initialized/output-ready are existing coroutine TS state, not new native registers claimed. Preserves d278 window-before-ORDER/flattening, retained compound+ordinary shared coroutine/common EndCoroutine/FILTER/independent LIMIT and standalone live callers, peer lexical/root/private/WHERE guards. Source-first linked native0 and public neighbors before migration; final focused88/88/native0/type/diff0 and changed-input selected broad in card status. Only these setup producers moved, not full lowerer allocation or ordinary table/general preparation convergence. Bounded ownership regression is not whole architecture approval; parent revision_required/original obligations remain.


#### R1 frame expression register owner ([[card:card-t-b]], after setup)
Actual compileWindowSelectLowering frame-bound compileExpressionTree callback now uses enclosing builder.register, retiring its independent ++registers producer. window.c sqlite3WindowCodeStep2881–2884 allocates offsets in shared Parse.nMem; 2941–2945 evaluates/checks them before partition processing. Existing TS once-before-producer evaluation/check adaptation unchanged; expression traversal, shared ParameterBuilder, ROWS/GROUPS integer vs RANGE numeric checking and error order unchanged. Published builder frontier back to still-manual exclusion/application/buffer consumers, keeping prior-layer import and final late-subroutine highwater/ownerExit. No flags/admission or root drain changes; d278 retained source rewrite/order/common coroutine/EndCoroutine/FILTER/independent limits and semantic/private/root WHERE guards preserved. Native-first ROWS1 PRECEDING..1 FOLLOWING and RANGE2 PRECEDING..CURRENT typed controls0; existing offset affinity/error/layered controls pass; final expanded focused183/183/native0/type/diff0, fresh selected broad in card status. Only frame expression owner moved; application/buffer/output/cursor/label/general table preparation still unfinished, not full architecture approval.


#### R1 window application register/cursor owner ([[card:card-t-b]])
Actual EXCLUDE rowid pair and EXCLUDE/lead/lag/first/nth application cursor producers now use enclosing builder.register/cursor (window.c1417–1422 sqlite3WindowCodeInit shared Parse.nMem/nTab). Import cursor next-free frontier with reserveCursorsThrough(frontier-1), preserving enclosing physical/rewrite reservations; publish builder register/cursor frontier to still-manual buffer/sorter/child/outer consumers. EXCLUDE-first branch, Integer1/0/OpenDup ordering, null application cursor when unused and existing cached-partition value/offset adaptation unchanged. Retired these ++registers/nextApplicationCursor++ producers only; shared late root/subroutine highwater, d278 rewrite/order/retained compound+ordinary coroutine/EndCoroutine/FILTER/independent LIMIT, semantic/private/root WHERE guards and standalone remain. Native-first typed EXCLUDE SUM/lag/first_value controls0; final focused184/184/native0/type/diff0 and fresh selected broad in card status. Remaining buffer/output/cursor/label/manual owners and ordinary table/general preparation plus committed architectural proof are unfinished; bounded producer migration is not full task approval.


#### R1 window input/record/rowid/peer register owner ([[card:card-t-b]])
Actual input range and four peer arrays now consume builder.range; record/rowid consume builder.register, retiring their ++registers producers (window.c2868–2902 sqlite3WindowCodeStep shared Parse.nMem). Zero input preserves next-free regNew without range(0); unused peers remain null/empty without allocation, contiguous range views are immutable arrays. Publish final builder register frontier to still-manual source/producer coroutines/output; setup/frame/application and late-root/subroutine handoffs remain necessary. Existing order/check/EXCLUDE/peer semantics and d278 rewrite/retained coroutine/EndCoroutine/FILTER/independent limits, semantic/private/root WHERE and standalone contracts unchanged. Native-first ROWS/RANGE/GROUPS typed controls0; final focused185/185/native0/type/diff0 and fresh broad in card status. Strengthened structural check initially sliced after regNew declaration (focused184/185, broad705/706); corrected test start boundary only, no production waiver. Buffer setup allocator moved, not remaining output/other cursor/label/manual allocation or real table/general preparation/committed architecture proof. Original task remains revision_required, not whole approval.


#### d post-b658 bounded ROWS frame publication repair
[[card:card-t-d]] independent native-first integration found two incorrect-row paths, not an allocator collision. Resolver frameForBuiltin agrees with window.c699–730 and does not coerce first_value. The actual divergence was callback sliding first/nth (inverse is a noop), plus missing executable following-EXCLUDE schedule and root readiness. `scannedRowsLayer` now selects unpartitioned moving ROWS first/nth ending CURRENT and following/current-only EXCLUDE CURRENT; ordinary sliding/exclusion schedules remain live outside this slice. Compiler caches producer rows, positions current independently, resets temporary aggregates for each frame, rewinds scan cursor, checks inclusive start/end and current-row exclusion before FILTER/AggStep, publishes AggValue, restores current payload and sets readiness before Yield. Root and parent consume only ready rows; late shared allocations import manual frontier and publish highwater. No VM/evaluator/parameter/error-order change; d278 preparation/source ordering, d269/c900/private24/WHERE0..30 and b setup/frame/application/buffer handoffs preserved.

Source: window.c1814–1910 windowFullScan supplies reset/frame-bound/EXCLUDE/step/value ownership; windowReturnOneRow1930–1955 uses regApp-bounded seek for first/nth (not cumulative inverse). TS bounded first/nth uses the existing full-scan callback machinery instead of that optimized regApp seek: current browser representation lacks per-function regApp frame endpoints in this lowerer, and callback inverse cannot evict the first value. This explicit bounded substitution preserves frame membership, NULL/INTEGER results, nth validation/FILTER/error and lifecycle ownership through VM ops; full cache/frame rescans cost more work than upstream optimized seek. It is not resource-count parity or broader frame approval. Direct regApp production remains a concrete optimization/fidelity debt; do not reuse this branch for partitions or general frames without source-based tests.

Independent native then public captures and exact scoped patch/hashes: work:///cards/card-t-d/window-cross-layer-repair/. Durable select-window-cross-layer-integration tests preserve both RED cases plus independently captured nth/current-only/FILTER/zero-width frame/empty controls and binding/error reset. Native narrow3 and expanded5 public differentials failures0; selected fresh type/focused192/broad713 passed before final extra binding test, which passes separately8/8. Prior intermediate partial/expanded-zero failures and test reset-contract mistake are recorded in status, not erased. Original R1–R4 revision_required and remaining ordinary/transient/manual producers unchanged; partition-expression and outer window-child preparation RED gaps from post-b658 report remain unresolved. No full compatibility or fresh canonical12 native recapture claim.


#### d non-EXCLUDE bounded ROWS endpoint migration
[[card:card-t-d]] supersedes the preceding first/nth rescan rationale for admitted unpartitioned ROWS PRECEDING/CURRENT..CURRENT without EXCLUDE. Missing implementation was not a browser constraint. `compileWindowSelectLowering` setup now gives each affected function builder-owned contiguous start/end registers and an OpenDup cursor (window.c1452–1460,2009–2010). `emitEndpointRowsDrain` admits one end row, advances start after offset+1, increments exclusive-start/inclusive-end instead of first/nth callbacks (1718–1724), restores current payload, initializes NULL, validates current nth through WindowCheck (1480–1520), adds start, guards end, seeks and reads the argument (1930–1955). Builder labels resolve at the enclosing owner's finish; allocation imports/publishes late manual highwater. Sorter reservation now includes per-function cursors: the initial draft omitted these and overwrote an OpenDup with SorterOpen. No VM seek cast workaround.

Compiler owns this schedule/labels/register and cursor identities; VDBE still owns running PC, Mem arithmetic/affinity, cursor positioning, private budgets, Yield suspension, binding, saved-error reset/finalize. OpenDup/SeekRowid consumers compared with vdbe.c4480–4508/5495ff; duplicate positions remain independent over shared entries. Root [[card:card-s]] WHERE0..30/index/restart/RIGHT contracts untouched. No completed-program copying or independent evaluator added. Shared application cursor remains only for offset functions and specialized unconsumed first/nth branches; endpoint-only slice no longer allocates the superseded shared cursor. EXCLUDE retains reset/rewind/FILTER/step/value scan, including repaired readiness. Other partitions/frames, specialized callback schedules, source/producer/output manual frontiers and broader preparation gaps remain live debt, not migrated by this slice.

Observable typed rows/NULL/zero/empty/current-only/FILTER, bindings and saved errors remain covered by cross-layer tests; endpoint ownership tests require no first/nth callback plus guarded seek and retain EXCLUDE scan control. Independent pinned narrow3/expanded5 baseline was captured before edits; public two-execution/reset/metadata comparison passes after migration. Fresh pinned nth NULL/0/-1/1.5/non-numeric TEXT errors and numeric TEXT2 values agree with public binding tests. Existing focused/private tests exercise cancellation/suspended reset/deadline/lifecycle; not an exhaustive new concurrency matrix. Evidence and exact commands/hashes: work:///cards/card-t-d/endpoint-owner-green/ and card status. No exact native work-count parity: endpoint bytecode removes repeated candidate AggStep scans, but EphemeralIndexCursor.seekRowid still linearly searches shared entries; source Btree seek complexity/storage and cache-retention differences remain explicit existing primitive debt. No change to owner scope or resource guarantees, no whole architecture/compatibility approval.

Endpoint verification revision: typecheck and owner/cross-layer/private13 passed; final public narrow3/expanded5 failures0, focused197/197 and selected broad715/715 (C1–C6/Chinook/lifecycle/index/stat), zero skips/cancellations. Commands/logs in endpoint-owner-green; production SHA256 a336537d7cfec644416108183043a4c27b822ac4210ba183d7aad0801354b514 (final source comment only after runtime checks, typecheck rerun). No fresh full canonical12 native capture. Earlier typecheck and cursor-collision failures retained in card status.


#### R1 window coroutine destination register ownership ([[card:card-t-b]], post-d296)
Actual sourceCoroutine and per-rewrite-layer producerCoroutines now allocate on enclosing SelectProgramBuilder before InitCoroutine/body/SelectDest construction (select.c8058–8075 tag-select-0482 shared Parse.nMem, SRT_Coroutine, recursive sqlite3Select, EndCoroutine). Import register frontier then publish to still-manual source/buffer expression/output consumers; retired these independent ++registers producers only. Source/grouped/retained compound/recursive destinations use the same identity, payload/ParameterBuilder and common EndCoroutine; empty sources, predicates, child LIMIT and root readiness unchanged. d296 per-function endpoint cursors/labels and corrected sorter reservation, EXCLUDE scan, late highwater/ownerExit, d278 and semantic/private/root WHERE guards preserved. Final focused198/198, linked pinned native0 and independent previously captured narrow3/expanded5 public typed rows/reset/metadata controls0; fresh selected broad in status. Source/buffer callbacks, prior-peer/output-save/projection and other cursor/label/manual control plus ordinary table/general preparation and R1–R4 architectural proof remain unfinished; not whole approval or exact resource parity. No public contract narrowing or new algorithm substitution.


#### R1 positioned window source/buffer expression allocation ([[card:card-t-b]])
Actual source predicate, producer FILTER and constant unary/cast/parameter compileExpressionTree callbacks now allocate on enclosing builder.register, importing/publishing manual frontier around each actual expression producer. expr.c sqlite3GetTempReg7600+ consumes shared Parse.nMem (with native temporary reuse); existing TS monotonic temporary allocation remains, now shares enclosing ownership. Source IfNot-before-Yield and FILTER/carrier positioned-row evaluation before payload Copy remain unchanged; retained/grouped/recursive and prior-window identity copies precede expression branch as before. No new evaluator, late recomputation or flag narrowing. d296 endpoints/cursors/labels/sorter reservation/EXCLUDE/readiness, b coroutine identity, d278 child LIMIT, semantic/private/root WHERE0..30/late highwater preserved. Focused199/199/type/diff0 and native FILTER/public expanded controls0, fresh selected broad in status. Remaining prior-peer/save/output projection and manual cursor/label/control plus ordinary/general preparation/R1–R4 proof are not waived; no exact native work/temporary reuse parity claim.


#### R1 retained output/peer range allocation ([[card:card-t-b]])
Eleven actual cached-drain outputSave/endSave/startSave/currentPeer/previousPeer contiguous producers now use enclosing builder.range, preserving zero-width frontier without allocation and importing/publishing to live manual consumers. window.c2870–2904 shared Parse.nMem input/peer ranges compared. TS payload operations overwrite regNew while independent cursors advance; existing saved row Copy/restore before Yield remains necessary adaptation, not a new algorithm. No step/inverse/EXCLUDE/readiness/error branch reordered; d296 endpoint saved ranges/cursors/labels/sorter frontier untouched. Source/callback/coroutine handoffs, d278 child LIMIT and semantic/private/root guards preserved. Focused200/200/type/diff/native/public0, selected broad in status. This bounded saved-row/peer allocation repair does not certify output projection/callback ownership, other cursors/labels/control/general preparation, temporary reuse or full R1–R4 closure; no public narrowing.


### Retained endpoint outer publication repair ([[card:card-t-d]], post-b685)

The retained-window branch in `compileTableSelect` owns the outer
`SelectProgramBuilder`; `compileWindowSelectLowering(owner)` deliberately returns
unresolved shared ops so nested consumers do not finalize an enclosing graph.
This outer caller previously returned those ops directly. Endpoint frame
`builder.jump` fixups therefore retained zero targets: execution after the
second child row reached the frame-value Goto and restarted at PC0, reopening
private cursors until work exhaustion. Child LIMIT and coroutine continuation
were correct; this is not evidence of an allocator or VM PC defect.

The outer caller now appends Halt and publishes `builder.finish()` and the
complete register frontier, following pinned vdbeaux.c610–654 label marking and
850ff resolveP2Values (fixups only after all opcodes have been inserted).
Pinned vdbe.c1174–1240 coroutine transitions retain their next-PC TS
representation unchanged. SELECT owns relocation; VM still owns PC/Mem/cursors,
budgets, suspension, bindings, saved-error reset/finalize. No parallel evaluator
or source copying was added; root [[card:card-s]] WHERE0..30 contracts untouched.

Preserved public regression `select-window-retained-endpoint-integration.test.mjs`
uses independently captured pinned INTEGER/NULL rows for ordinary/CTE/compound
children, outer ORDER/LIMIT/OFFSET and two executions/reset. All three now
terminate and agree; native capture preceded edits. Focused203 passes. Exact
commands, scoped patch and hashes: card status and
work:///cards/card-t-d/endpoint-repair/. Existing EXCLUDE/specialized frame
branches, linear ephemeral seek/storage and general preparation debt remain;
no exact resource parity, broader compatibility approval, or scope change.

Publication-repair verification: fresh typecheck, reproducer3/3, focused203/203
and selected broad755/755 (canonical C1–C6/Chinook, index/stat, private lifecycle
and parser/resolver/select included), no skips/cancellations; diff check clean.
Expanded captured-native public12 probe still exits1: ten matches and two
unchanged preparation gaps (aggregate compound derived child; CAST first_value).
These are not repaired or waived by label publication. vdbe SHA256
fe37a84027f2f4e98fd7a5d2a8a7e4a2cc4f363ded3b3be856f3378d7cbeb6b5.


#### R1 window root projection/consumer limit register owner ([[card:card-t-b]])
Actual outputStart contiguous row range and computeLimitRegisters callback now allocate on enclosing builder after frontier import, publishing to remaining manual output/late-subroutine consumers. select.c1177–1202 selectInnerLoop iSdst/nSdst shared Parse.nMem compared: allocation is conditional on emitting a nonempty admitted row, non-emitting remains0. Consumer OFFSET-before-SelectDest and LIMIT-after, direct/sorted projection and shared parameters unchanged. Existing sort prefix/key construction and manual other consumers remain debt, not source ownership completion. d305 outer Halt/finish after late subroutines and ownerExit retained (never finish nested builder); endpoint cursor/sorter/labels/EXCLUDE/readiness, retained child LIMIT/common coroutine and semantic/private/root WHERE0..30 untouched. Focused204/204/type/diff/public-three/native0; expanded native12/public still ten matches/two preparation failures aggregate compound child/first_value CAST, not waived. Fresh broad in status; no full R1–R4 or resource parity claim/public narrowing.


#### R1 ordered root key/sorter allocation owner ([[card:card-t-b]])
Actual outerSorter now consumes enclosing builder.cursor after conditional reservation through live application/rewrite sorter frontier; publishes next-free cursor to remaining manual callers. Actual SorterInsert keyStart contiguous range now builder.range with register handoff; no-sort branches allocate neither cursor nor key. select.c8215–8235 tag-select-0600 shared Parse.nTab cursor construction and1180–1207 sort prefix/iSdst Parse.nMem compared. Existing separate key/payload VM representation retained; readiness/Copy/SorterInsert/SorterData/SelectDest/OFFSET/LIMIT order unchanged. Reserved application endpoint cursors remain disjoint; d305 outer Halt/finish after late bodies and ownerExit, d296 labels/EXCLUDE/readiness, semantic/private/root WHERE0..30/peer dirty intact. Focused205/205/type/diff/native/public-three0; expanded12 still ten matches/two preparation failures, not waived. Fresh selected integration in status; broader register/frame temporary/cursor/control/general preparation/R1–R4 ownership remains debt, not full approval or exact resource parity.


#### R1 late bounded-peer EXCLUDE scan construction ([[card:card-t-b]])
sharedBoundedPeerExclusion now consumes shared builder registers for current/start/candidate rowids, temporary accumulators, constant width and ties identity. Rewind/first/bounds/peer/ties/FILTER/next/finish branches now shared labels marked in the same order; displaced per-op manual address writes retired only here. Enclosing finish resolves labels after late bodies (d305 Halt/ownerExit unchanged); existing application OpenDup cursor remains setup-owned, no replacement cursor. Compare pinned window.c1814–1910 windowFullScan: current identity, reset before scan, skip before start/stop after end, EXCLUDE GROUP or TIES current-row exemption, FILTER before step, aggregate value then payload restoration. Existing TS bounded-rowid start computation and monotonic temporaries remain adaptations, not a new evaluator/native temp-reuse or resource-count claim. Source/producer current payload is authoritative because candidate EphemeralData overwrites regNew. Pin-checked public GROUP/TIES/NO OTHERS FILTER rows/NULL/metadata/reset added; existing error/bind/limits/suspension controls retained. Shared parameters/destination and root output/key/limit unchanged; d296 endpoints/sorter cursor reservations/EXCLUDE/readiness, semantic/private/WHERE0..30/peer dirty preserved. Expanded12 remains two preparation RED gaps; earlier independent drains/general preparation/control/full R1–R4 ownership unfinished. Exact checks/patch/hashes in card status, no full compatibility approval.


#### R1 late sliding/current-following drain control ([[card:card-t-b]])
Actual sharedSliding/sharedFollowing FILTER skips and size-gated inverse/snapshot continuations now builder labels/jumps; displaced manual per-op PC fixups removed in both callers. Registers/bound parameters/duplicate cursors were already setup-owned; no replacement state/cursor or algorithm. Pinned window.c2995–3044 step/return/inverse branches and vdbeaux.c610 label production compared. Sliding step -> trim/inverse -> authoritative producer Copy restore -> value, following step -> readiness -> snapshot/value -> ready flag -> inverse remain distinct and ordered. Labels defer to d305 enclosing finish/Halt after late subroutines/ownerExit, never finish nested graph. Public pin-confirmed preceding/current, current/current, current/following FILTER INTEGER/NULL/metadata/reset controls added; existing binding/error/limits/suspension controls retained. b709 bounded-peer labels/frontiers, d296 endpoints/sorter cursor identity/EXCLUDE/readiness, semantic/private/root WHERE0..30/peer dirty preserved. Neighbor cached-offset/other frame drains have independent admission/readiness/return targets and remain debt, as do general preparation/WHERE/full R1–R4 and expanded12 two preparation RED gaps. No exact native work/temp-reuse/linear-seek parity claim; exact checks/patch/hashes in status.


### Recursive window FILTER producer location ([[card:card-t-d]], post-b721)

Independent changed-input native21/public integration found recursive SUM
FILTER+bounded ROWS EXCLUDE TIES returning NULL instead of INTEGER2/5.
`compileWindowSelectLowering.emitProducerBinding` copied direct recursive
columns from the SRT_Coroutine payload but bound composite FILTER references
to a nonexistent positioned physical source cursor. The first rewrite layer
now binds retained **or recursive** FILTER carriers to `groupedPayload +
columnIndex`, using the same destination identity as direct arguments. Physical
sources keep cursor locations; grouped producer payload and later layer
identity-copy branches remain unchanged. This fixes semantic production before
caching, not output SQL or scan callbacks.

Pinned window.c sqlite3WindowRewrite stores FILTER next to function arguments;
windowAggStep1685–1701 reads `iArgCol+nArg` from the candidate cached row and
IfNot gates stepping. select.c SRT_Coroutine producer-row ownership and current
TS compileRecursiveCteSelect destination agree: the coroutine yields a complete
row in registers, not the queue cursor. EXCLUDE scan and sliding/following
consumers still read that cached predicate. SELECT owns the expression location
and shared builder allocation; VM owns Mem/cursor/PC/budgets/suspension. d305
outer Halt/finish after late bodies, b root projection/key/LIMIT/scan/drain
labels, endpoint identities/readiness and root WHERE0..30 unchanged. No new
evaluator, temporary reuse claim or algorithm substitution.

Existing cross-layer regression preserves the failing SQL and adds independently
pin-captured two-column recursive payload controls with GROUP/TIES/NO OTHERS
and sliding default frames, ordered LIMIT, typed rows, metadata names and reset.
Native21 was captured before product edits; native-extra4 was captured after
repair to strengthen identity coverage, not a pre-edit baseline. Public21 now
has18 matches/3 unchanged preparation gaps: aggregate compound child, CAST
first_value and grouped nested-count FILTER window misuse error. These remain
unwaived. Source comparison, scoped patch, commands/hashes and focused/broad
evidence in card status and work:///cards/card-t-d/recursive-filter-repair/.
Linear seek/storage/temp/resource complexity and broader R1–R4 remain unfinished;
no origin-metadata parity or exhaustive new suspension/native-resource claim.

Recursive FILTER repair verification: fresh focused218/218 and selected
broad764/764 (C1–C6/Chinook, index/stat/private lifecycle/resources) pass without
skips/cancellations. Initial focused and broad runs failed only stale source
regex requiring a now-unneeded non-null assertion; updated that assertion to
match guarded payload access, reran both. No functional assertion removed.
Public21 remains exit1 with18 matches/3 preparation gaps, extra4 matches;
type/diff pass. Final vdbe SHA256
e6f0b01f6dba2f44ccf0ae866a3abdeb54b1ca12c6f4e82fb69112af868c22d2.

Grouped ordinary aggregate/window FILTER consuming repair ([[card:card-t-c]]):
resolve.c1320–1355 retains NC_AllowAgg for pWin, disables NC_AllowWin:
ordinary aggregates in window args/FILTER are legal, nested windows remain
misuse. TS nested-aggregate diagnostics now apply only to ordinary calls;
ordinary aggregate FILTER misuse remains code1. window.c rewrite caches
pWin->pFilter expression, not the FILTER-clause syntactic container.
window-rewrite.ts now buffers that actual predicate reduction and the same
resolved carrier; retired wrapper-as-buffer-value mechanism. Actual grouped
producer's compileAggregateSelect destination evaluates/finalizes COUNT and
predicate then copies its rewritten expression column into window cached
FILTER slot; window.c1685–1701 cached IfNot/AggStep order preserved.
No raw cursor substitution or evaluator, no vdbe/producer/index remap.
Native-before-code original count/count FILTER gives INTEGER[4,4]; false and
NULL FILTER give NULL, CAST(count AS REAL) arg gives REAL4. Two-run public
metadata/reset/done/finalize tests and ordinary misuse code1 controls retained.
Resolver expectations for window-over-aggregate permission/error category
corrected to pinned context semantics (median unavailable in native build;
supported SUM/JSON substitute confirms nested-window error category).
Standalone first_value CAST argument and aggregate-compound derived window
child remain separate unimplemented preparation gaps, not expanded here.
Preserve d314 retained/recursive columnIndex vs grouped expression index vs
previous-layer identity/physical cursors, b721 labels/frontiers, d305 finish,
d296 endpoints/EXCLUDE/readiness, private24 and root WHERE0..30. Deeper/mixed/
transient lexical/full analyzer/index-expression/RIGHT/general composition
unfinished; no whole architecture/native-resource compatibility claim.

Window producer expression consuming repair ([[card:card-t-c]], CAST tranche):
pinned window.c1036–1060 appends full argument expressions/pFilter to the
rewritten producer (SQLITE_SUBTYPE specialized branches remain distinct);
expr.c5171 TK_CAST recursively codes child then OP_Cast; select.c preparation
invokes rewrite before WHERE lowering. Actual emitProducerBinding now uses
resolvedExpressionCarrier + bindResolvedExpression + compileExpressionTree
for represented producer expressions, including CAST(column), composite args
and FILTER. Retired literal opcode emitter/producerConstant private admission
walker and separate FILTER evaluator at this caller; no new evaluator.
Deferred window-result slots remain structural handoff NULLs, not scalar
functions; previous-layer exact expression/window result copies precede new
binding. Composite previous-layer columns bind to child regNew binding indexes
or reject typed temporary if absent, never exhausted physical cursors.
First retained/recursive expressions bind payload+resolved columnIndex;
grouped finalized-expression-index copy remains earlier and distinct.
Physical sources still bind positioned cursor, shared Mem/KeyInfo/Btree async,
b721 labels/d305 finish/d296 endpoints/private24/root WHERE0..30 unchanged.
Eight independent native/public controls in cross-layer suite check REAL vs
INTEGER, NULL, TEXT, arithmetic/lag/default, FILTER, retained LIMIT and CTE,
column names and two executions/reset/done/finalize. Original REAL CAST native
before code; baseline driver incorrectly projected TEXT as NULL (missing text
API), corrected independent native capture supplies TEXT "1" (not product
waiver). Frame/binding/error/private lifecycle checks rerun as existing coverage.
CAST first_value preparation gap closed for represented linked expressions;
aggregate compound-derived child/full analyzer/deeper/mixed/transient/RIGHT/
index-expression/general composition/linear-resource debt remains. Arbitrary
residual expression/subtype/deeper previous-layer combinations are not declared
supported merely by this tranche; no architecture-wide compatibility claim.

Aggregate compound-derived window consuming closure ([[card:card-t-c]]):
the preceding CAST suffix's aggregate-compound-child preparation gap is now
closed for represented ordinary aggregate/GROUP/HAVING UNION ALL producers.
select.c multiSelect TK_ALL shares destination and LIMIT state across complete
arm SELECTs (3000ff); selectInnerLoop SRT_Coroutine1441ff copies result/yields;
sqlite3Select prepares window rewrite7699 and analyzes aggregate ELists/HAVING
before producer output. Actual compileTableSelect retained-window preparation
now precedes older CTE/repeated/single-compound derived interceptors, retaining
this existing specialized owner for eligible single source window consumers.
compileWindowSelectLowering → compileTableCompoundProducer → compileCteUnionAll
→ compileAggregateSelect(parent destination, compoundLimit) yields directly
into enclosing window sourceCoroutine/payload. Ordered arms use existing
compileOrderedCteUnionAll merge destination with child LIMIT/OFFSET. Noncompound
aggregate retained child dispatches to the same aggregate owner, not raw scan.
GROUP/HAVING arm carriers now preserved rather than flags with erased trees;
GROUP-only arms use aggregate grouping owner. Complete arm dispatch precedes
simple relational gate, without masking flags. Shared LIMIT initialized once,
OFFSET checked before destination, aggregate stop branches patched to compound
end, EndCoroutine child then enclosing finish/Halt; no child Program copying.
Retired intercepted preparation for these callers and aggregate/window-only
compound LIMIT exclusion where shared aggregate contract already exists.
Missing tree/unsupported arm still aborts prepare typed temporary. SELECT
outer WHERE/grouped/window-in-child/joins/general composition remains separately
bounded; this is not generic AggInfo/analyzer/RIGHT/index-expression/subtype or
linear-resource acceptance. Shared expression phases, c909 FILTER/!over, d314
recursive payload, root WHERE0..30 and frame/private/label/finish seams unchanged.
Independent pinned original + empty/child LIMIT0/1/order/group/HAVING/predicate/
CAST outer LIMIT/OFFSET/noncompound aggregate/GROUP-only controls retained in
cross-layer suite: typed rows and native names, two runs/reset/done/finalize;
parameterized compound frame binds/error-reset validated. Existing selected
suspension/private budgets/frame controls rerun, not newly comprehensive native
metadata origin/encoding/BLOB/resource comparison. Broader debts unwaived.


### Grouped aggregate identity across window layers ([[card:card-t-d]])
Independent post-c927 original21 now all match: c909/c918/c927 closures remain
GREEN. New grouped count + TEXT CAST first_value + incompatible current-row SUM
FILTER prepared INTERNAL because a nested finalized aggregate reached scalar
lowering in a subsequent window producer. Pinned window.c789–820
selectWindowRewriteExprCb matches TK_AGG_FUNCTION against pSub expressions, then
rewrites to TK_COLUMN/iEphCsr/iColumn. Current TS exact whole-expression copies
did not cover aggregate nodes inside CAST or FILTER.

The shared resolved expression binder now consumes an explicitly supplied
aggregateOutput mapping before scalar recursion, independently of the ordinary
aggregate enrollment policy. The later window producer supplies previous-layer
buffer expression identity/equivalence → regNew+column. Ordinary aggregate
enrollment, deferred slots, grouped first-layer finalized indexes and physical/
retained/recursive column bindings are unchanged. No new aggregate evaluator,
VM workaround, PC copy or algorithm substitution. An absent mapping does not
pretend a source column is a finalized aggregate. d305 enclosing finish/Halt,
b labels/frontiers, d296 endpoints/readiness/EXCLUDE, c predicate and destination
contracts/root WHERE0..30/private24 preserved.

Existing cross-layer reproducer retains native INTEGER/TEXT rows and names,
two runs/reset, error/binding/lifecycle controls. Native capture preceded this
repair; original21 captures reused unchanged. Public targeted6 now5 matches and
one retained correlated subquery argument unsupported gap, not reclassified.
No origin/BLOB/encoding/native resource equivalence claim. Exact scoped patch,
hashes, attempts and verification in card status and
work:///cards/card-t-d/grouped-layer-repair/. Broader analyzer/R1/R2/RIGHT/nTab/
linear seek/storage/temp debt remains; selected totals not architecture proof.

Scalar-subquery window producer consuming closure ([[card:card-t-c]], after
d323 aggregateOutput handoff): complete window argument expression codegen now
supplies the existing linked scalar-subselect lowering owner, extracted from
compileInnerTableSelect into resolvedScalarSubqueryEmitter (not a second
expression evaluator). resolve.c TK_SELECT links pNext and sets EP_VarSelect;
expr.c sqlite3CodeSubselect initializes NULL SRT_Mem, uses Once only when not
correlated, and first-row return/SELECT LIMIT. window.c selectWindowRewriteExprCb
and argument projection keep the complete expression at producer evaluation.
TS consumer uses resolved.nested identity/column carriers; local reader has its
own builder cursor, outer source reads use actual window phase location callback
(positioned physical, retained/recursive payload or previous regNew buffer).
Predicate rejection advances Next, empty scalar remains NULL; ordinary aggregate
scan finalizes even on empty input; scalar projection copies into Mem and exits
on first row. LIMIT follows expr.c:sqlite3CodeSubselect X<>0 with numeric affinity, then
select.c integer admission (NULL errors; nonzero TEXT/REAL admit one row),
not ordinary raw LIMIT admission or SQL-text guards. Nested code recurses through same
callback; zero-FROM scalar fallback preserved. DISTINCT/GROUP/HAVING/ORDER/set/
OFFSET/other unrepresented subselect branches remain atomic typed temporary.
Joined callers retain their original normal affinity/collation binding; window
phase policy is supplied only by window consumer. A broad joined NULL identity
regression exposed erroneous applying window policy everywhere (COUNT became1
instead of2); corrected owning callback policy before acceptance. Opening nested
reader at its consuming body replaces unconditional pre-opening; Once encloses
open/initialization/scan for uncorrelated, correlated reinitializes each input.
No VM/storage/WHERE change, Program copying or independent evaluator added.
Full ordinary scalar owner broader implementation remains live, not claimed
retired; new shared consumer is bounded to these existing resolved scan branches.

Native-first eight cases + four connected LIMIT0/-1/REAL CAST/empty-aggregate
controls, rows/types/names retained in cross-layer suite, twice/reset/done/finalize.
Original inequality MAX first_value produces all NULL under pin (first frame
argument is NULL), NOT inferred lack of correlation. CURRENT ROW equality checks
1/3/5/7. CTE retained/grouped/incompatible previous-layer controls retained;
parameter LIMIT0/1/-1 and NULL saved-error/reset plus nonzero TEXT/REAL admission, lexical missing column
and width diagnostics checked. Existing frame/private/suspension tests rerun,
not exhaustive new native origin/BLOB/encoding/resources/suspension comparison.
d323 aggregateOutput/deferred/grouped/prior/physical, c909 permissions,c927 arm
shared limits, d305 Halt/finish, d296 endpoints/b labels/root WHERE0..30/private24
remain. Full analyzer/deeper transient/mixed/RIGHT/nTab/index/subtype/general
preparation and linear seek/storage/resource debt unwaived; bounded ownership
restoration, not architecture acceptance or blanket scalar/window compatibility.

Scalar child LIMIT correction (current closure): exact expr.c3880–3946 comparison
found original raw computeLimitRegisters admission was wrong. Pinned X<>0 numeric
comparison admits nonzero TEXT/REAL, rejects NULL at integer admission, and skips
numeric zero. Independently captured five native controls (bad TEXT, REAL0.5,
NULL, TEXT0/1) in window-subquery-repair/oracle-limit.json; shared subquery owner
now emits comparison before MustBeInt. This supersedes earlier invalid-TEXT
code20 test/document claims; ordinary enclosing SELECT LIMIT remains unchanged.


#### R1 joined direct/sorted destination exit closure ([[card:card-t-b]])
compileInnerTableSelect now emits direct OFFSET continuation, producer LIMIT/first-row iBreak and sorter empty/data/OFFSET/next/break via shared builder labels; standalone consumer uses local builder. select.c1177ff selectInnerLoop and vdbeaux.c610 label contracts: destination is emitted before count decrement, OFFSET skips destination, empty sort skips all output. Removed outputLimitStops and producer Goto0 scanner, sortAt/offsetAt/limitAt drain mutations only within this consumer. Compound LIMIT stops deliberately remain enclosing-owned numeric handoff until that caller migrates; source WHERE/RIGHT rewinds/interior validation remain live. New resolveLabel resolves a closed producer's selected labels without freezing the enclosing program: RIGHT interior numeric validator requires resolved targets now; d305 enclosing finish/Halt still publishes all other deferred bodies. No nested finish or PC-copy rewrite. Shared c936 resolved scalar emitter/phase/X<>0+MustBeInt and d323 finalized aggregateOutput, b scan/drains, d296 endpoint/sorter readiness/EXCLUDE/physical0..30/private24 preserved. Native-first public joined direct/sorted LIMIT/OFFSET, scalar first-row and empty controls added with INTEGER/name/reset checks. Full analyzer/RIGHT/nTab/resource/general preparation/R1–R4 remain, no architecture acceptance/native resource-count parity claim. Exact checks and gaps in status.


#### Linked scalar projection consumes ordinary SELECT destination ([[card:card-t-c]])
Current consuming repair (supersedes census RED for projection only):
resolvedScalarSubqueryEmitter now hands its already-admitted nonaggregate,
one-local-physical-source projection to compileInnerTableSelect on the same full
builder/parameters and initialized Mem destination. Removed its independent
projection scan/first-row success Goto; specialized scalar aggregate scan remains
live. Both complete window arguments and joined expression callers use this
handoff. No child Program/PC relocation/finish or generic evaluator added.
Pinned expr.c3841–3978 owns Once/NULL/numeric X<>0 child LIMIT admission;
select.c1177ff/1422 owns WHERE→projection→Mem and first-row producer exit.
Prepared scalar flag means admission was already emitted, not permission to
ignore LIMIT; zero/NULL/nonzero TEXT/REAL controls retained. Linked child source
identity is unchanged, cursorFor maps local physical reads consistently including
Next; explicit window binding carries retained/prior/physical outer phase into
projection and WHERE, whereas joined default retains affinity/collation. Actual
full builder replaces the standalone legacy adapter; standalone nested cursor
frontier999 stays, enclosing-owned callers retain their own frontier. Register
allocation and final standalone register count now use that builder.

For this bounded linked scalar handoff, existing source scan owner uses its
ordinary full scan rather than physical candidate seeks: generated WHERE seek
operands currently have no reduction/outer-phase identity, and cannot consume a
prior-buffer outer register honestly. This does NOT add a scan evaluator or
change root WHERE0..30. Ordinary scan result/predicate/Next branches are reused;
root selected index/RIGHT callers unchanged. Native/public equality, inequality,
empty, first-row and CURRENT ROW controls plus existing LIMIT/error/reset tests
check observable preservation, not index/resource parity. Full linked preparation
and a phase-aware root WHERE candidate operand interface remain prerequisites
for later convergence. GROUP/HAVING/ORDER/DISTINCT/compound/OFFSET/IN/EXISTS and
multisource admission not widened; supported shapes cannot be reclassified
unsupported. d323 aggregateOutput,c927 limits,b730 RIGHT resolveLabel validation,
d305 late finish/Halt,endpoints/EXCLUDE/readiness/frontiers/private24 unchanged.

Production/source/prerequisite census:
docs/research/card-t-c-linked-scalar-preparation-census.md. New durable ownership
check and six independent pinned typed-row/name/reset controls:
test/conformance/select-linked-scalar-preparation-owner.test.mjs. Existing scalar
LIMIT window tests include NULL saved error/rebind and TEXT/REAL numeric admission;
selected tests do not establish complete metadata/BLOB/encoding/resource parity.
Full analyzer/RIGHT/nTab/storage/linear native work and general destinations remain
unwaived. This is bounded consumer convergence, not architectural acceptance.


### d direct scalar projection phase closure

The c945 ordinary scalar producer handoff requires phase binding for **all**
result productions, including direct resolved columns and merged expressions,
not only composite expressions/WHERE. `compileInnerTableSelect` now routes
results through the existing linked carrier binder when its caller supplies
`expressionBinding`. Otherwise the ordinary physical source/affinity/collation
fast paths are unchanged. Pinned select.c selectInnerLoop expression-list code
then SRT_Mem (1418ff) owns result production before destination copy/first-row
exit; an outer retained/recursive payload is not a positioned Btree cursor.
No VM, NULL fallback, evaluator, or PC-copy repair. Local cursor mapping and
Mem/Once/scalar LIMIT admission, late enclosing finish and RIGHT selective
label closure remain unchanged. Native-first post-c945/oracle-phase.json
controls (retained and recursive current-row first_value of SELECT q.a)
previously returned NULL rather than current INTEGER; durable linked scalar
owner tests retain typed rows/names/two executions/reset/finalize.
This closes direct projection phase only, not aggregate preparation or the
root seek-operand reduction/phase interface; full-scan adaptation/resource
debt and R1–R4 remain unwaived. Public scope/API unchanged.


### Linked scalar aggregate producer convergence ([[card:card-t-c]])
Supersedes the earlier finding that the shared emitter retains a specialized
aggregate scan. Window complete arguments (vdbe compileWindowSelectLowering) and
joined expressions now hand their already-admitted one-physical-source aggregate
to compileAggregateSelect using the enclosing builder/parameters, linked nested
plan, physical cursor mapper, explicit outer phase binding when supplied and
initialized Mem destination. Removed emitter OpenRead/Rewind/AggStep/Next/AggFinal.
expr.c3841–3978 still owns Once/NULL/numeric X<>0 child LIMIT admission; prepared
scalar prevents raw LIMIT readmission. select.c8390–8458 owns aggregate analysis,
8860–8919 reset→WHERE→update→finalize→selectInnerLoop/Mem. The shared no-group
producer now explicitly AggReset before positioning on every invocation (not
merely relying on standalone initial NULL registers). Empty correlated COUNT/MAX
and later nonempty invocations therefore retain source reset semantics.

Linked preparation may supply a plan without schema: already-resolved source
objects provide physical tables and local cursor mapping; no null-outer
re-resolution or fabricated schema. Ordinary schema callers are unchanged.
Outer references bypass local accumulator-column enrollment and consume explicit
window phase location or ordinary linked physical cursor. Parent label/finish,
shared Mem/Btree/KeyInfo and private limits remain owned by the enclosing program.
FILTER/DISTINCT/ORDER/GROUP/HAVING and other previously rejected shapes in this
emitter are not newly admitted. Ordinary physical scalar callbacks, general
linked dispatcher, C subroutine reuse, deeper aggregate ownership and phase-aware
root WHERE seeks remain unresolved, not architectural acceptance.

Tests: select-linked-scalar-preparation-owner structural gate plus independently
source-ID-asserted full enclosing native controls, including REAL SUM, retained
CTE window MAX, joined COUNT and scalar LIMIT0; typed rows/names/reset/done/finalize.
select-linked-correlated-owner retains linked carrier protection at its new shared
producer rather than requiring the retired local traversal. Existing window LIMIT
NULL saved errors/TEXT/REAL rebind controls remain. Selected tests do not prove
full native origin/BLOB/encoding/resource parity; no scope or budget change.


### d c955 grouped aggregate callback partial closure

Grouped window scalar arguments reach compileAggregateSelect's expression
callback, whose ordered LIMIT gate rejected scalar aggregate LIMIT1. Admitted
one-source scalar aggregates now delegate to existing linked scalar emitter
with resultLocation/enclosing builder and shared aggregate producer/Mem.
No DISTINCT/FILTER/order/group/compound/OFFSET widening; specialized other
callbacks remain live. Pinned expr.c sqlite3CodeSubselect and select.c AggInfo
then SRT_Mem own admission/production; regression retains typed rows/names
over reset/two runs. No Program finish/PC copying. Overall d integration RED:
compound retained child LIMIT cardinality and resolve.c1356–1378 outer-only
aggregate NameContext ownership remain defects, not resource parity approval.


### d c955 compound producer order/LIMIT integration (next repair)

Native EXPLAIN QUERY PLAN demonstrates MERGE(UNION ALL) under the window
producer and plain derived consumer, not concatenation LIMIT then sort.
window.c987–1038 moves the source clauses into its ordered inner producer;
select.c flattenSubquery4390–4448/4478ff distributes that producer over
UNION ALL, transfers LIMIT4695ff. Our retained-source lowering previously
limited concatenation first. Bound generated producer keys now enter the
existing source-owned ordered compound merge before LIMIT when the bounded
flatten restrictions admit it (no child order/OFFSET, distinct/group/aggregate
arm or non-UNION-ALL); plain prefix derived specialization likewise transfers
parent ordering before its shared child output limit. Existing child order
and OFFSET remain retained. Ordered merge resolves represented EList keys
by structural expression/alias as well as ordinals, rather than falling back
to an unordered simple loop for WHERE arms. No VM PC/cursor/Mem change.

Owner/caller: window lowerer → compileTableCompoundProducer → ordered
compound shared merge → compileInnerTableSelect; enclosing builder owns
publication/labels, VM Yield/PC/budgets still execute those opcodes. Existing
plain prefix specialization's sorter remains live (not a newly introduced
substitute); this bounded handoff is not complete AST flatten/substitution
parity. Eight durable pinned controls cover exact correlated SUM/window,
plain ASC/DESC, row_number ASC/DESC, child OFFSET, child order and zero LIMIT
with typed rows/names/reset/two runs. Native captures first; public7 matches.
Broad first 972/976 exposed WHERE key fallback and three lexical aggregate
regressions from the prior callback delegation: now delegate only local
aggregateUses depths; outer-owned functions retain lexical AggInfo output
callback. Corrected focused35/type/public local6 and broad976/976 pass,
including C1–C6/Chinook and selected lifecycle/limits checks. Outer-only
SUM/MAX in window arguments still fail: syntax-only grouped-producer trigger
does not consume resolver aggregateUses owning a nested function. This is
the next preparation/lifting dependency, not supported-shape permission.
Evidence work:///cards/card-t-d/c955-next/; no resource/encoding/origin matrix
or full R1–R4/analyzer/index approval. API contract unchanged.


### d outer-window NameContext partial repair

Physical-source window preparation now consumes resolver aggregateUses depths
(resolve.c1356–1378), not only top-level GROUP syntax, to route its inner
producer to the existing aggregate owner. No window-rewrite change: pinned
window.c748–766 explicitly does not lift nested aggregates as local window
terminals. The ordinary aggregate owner enrolls them through its existing
linked nested-plan walk (expr.c analyzeAggregate7405ff). Its lexical scalar
callback now precedes the specialized ORDER/LIMIT gate for unordered children
and applies expr.c's numeric X<>0 scalar LIMIT before OpenRead/Rewind.

Owning primitive correction: nested outer columns in WHERE/projection need
AggInfo saved first-row values after accumulator finalization, just like bare
output columns. The no-GROUP capture now enrolls those columnUses and maps
their existing accumulator registers into AggregateColumnOwner; directMode
is false for final output, matching select.c updateAccumulator6950–6966 and
first-row regAcc8838–8864. Previously outer scalar predicates reread exhausted
physical cursors. No independent evaluator, VM PC/Mem/Btree/budget change.
Ordered lexical children remain specialized/rejected rather than silently
ignoring ORDER. Existing local-aggregate delegation stays depth-guarded.

Six fresh pinned controls (typed rows/names/reset/two runs) cover physical
window outer SUM REAL+bad-TEXT LIMIT, bare outer SUM, grouped predicate, zero
LIMIT, nonwindow predicate, and local+outer operands. Type/public6/focused128
pass; broad982/982 including C1–C6/Chinook and selected lifecycle/limits passes.
Evidence work:///cards/card-t-d/outer-window-owner/. Retained CTE outer-only
SUM and recursive outer MAX remain red: retained preparation re-resolution
and nested result substitution must preserve aggregate owning depth, and
recursive aggregation needs its payload producer (not OpenRead on synthetic
root). A trial broadening the trigger hit synthetic page11; it was restricted
to physical callers, not labeled unsupported permission. Source graph versus
VM ownership/R1–R4/resource/RIGHT gaps unchanged; API contract unchanged.


### d retained ordinary-CTE outer aggregate repair

Source comparison: select.c substExpr/substSelect3782–3940 traverses nested
EList/GROUP/ORDER/HAVING/WHERE; TS substituteViewExpression updated only nested
WHERE. The bounded ordinary derived flatten owner now also substitutes nested
result and clause carriers, excluding locally shadowed qualifiers and bare
local names. A producer qualifier is explicitly carried through this boundary
so a replacement bare `a` cannot rebind to inner `u.a`. It is not stored as an
output alias. This remains a bounded lexical representation adaptation, not
general resolved-iTable substitution parity (unqualified correlated references,
multi-source aliases, compound nested FROM and general flatten remain gaps).

Window retained ordinary CTE caller now uses its existing bounded
flattenOrdinaryDerived owner before retained-source lowering, when child is
not aggregate. Child aggregate, DISTINCT/GROUP/ORDER/LIMIT/compound producers
retain their existing specialization. Thus ordinary CTE nested outer SUM flows
through physical window preparation -> shared aggregate owner -> lexical
AggInfo scalar callback, preserving outer cardinality and saved bare row.
No VM PC/register/Mem/Btree/budget/suspension changes or completed-PC copy.

Fresh pinned native-first six CTE controls cover REAL+LIMIT0.5 outer SUM,
outer-only predicate, local+outer operands, local-only SUM, qualifier shadowing,
zero LIMIT; typed rows/names/two runs/reset/done/finalize pass. Initial rewrite
failed because replacement `a` rebound locally; explicit producer qualification
corrected it. First focused run found illegal aggregate-child flattening;
restored that retained specialized branch, no test weakening. Guarded type,
public6, focused282, broad988/988/C1–C6/Chinook/selected lifecycle+limits/diff
pass. Evidence work:///cards/card-t-d/retained-owner/. Direct derived probes
are still rejected by existing derived admission and remain a gap (not
passed/waived); original recursive outer MAX still returns three rows rather
than pinned [5,5]. Next recursive seam is common aggregate producer capture
via coroutine payload, not opening synthetic root. Prior resource/RIGHT/index
and R1–R4 debt unchanged; API contract unchanged.


### d recursive outer aggregate input boundary closure

The accepted recursive outer MAX window control now matches pin [5,5].
Window preparation consumes nested owning aggregateUses for recursive sources
as for physical sources. Its grouped inner producer receives the original
linked resolved sources/nested carriers (with rewritten source result), not
re-resolution against a synthetic schema root. It composes the existing
recursive queue producer into a nested SRT_Coroutine payload on the enclosing
builder and supplies a compile-time input emitter to compileAggregateSelect.
The aggregate owner sets its existing AggregateColumnOwner.sourceRegisters
to that payload: reset/WHERE/step/bare capture/finalize/projection remain
aggregate-owned; recursive queue/Current/termination stay recursive-owned.
No runtime evaluator, completed Program copy, or synthetic OpenRead.

select.c updateAccumulator6915–6966 controls bare-row retention: one min/max
uses the existing AggStep change register (CollSeq/regHit semantics) to capture
the winning row; ordinary aggregates save the first admitted input row.
Final output uses saved AggInfo columns with directMode false. Nested scalar
WHERE/LIMIT observes finalized registers and saved outer row. Empty scans
still finalize; correlated accumulator initialization remains explicit.
Grouped/multiple-minmax general input and preparation remain outside this
bounded handoff, not claimed compatible.

Pinned vdbe.c OP_Yield1229ff/EndCoroutine return-PC swapping and vdbeaux.c
ResolveLabel636ff compared: new source start/consumer end/backedge relocation
belongs to SelectProgramBuilder labels, not VM PC copying. VM coroutine Mem,
register/cursor/budget/suspension/reset/finalize remain unchanged. Existing
retained compound/grouped/local aggregate specializations remain live. Root
WHERE/index/RIGHT contracts not changed.

Six native-first recursive typed/name/two-run/reset controls cover exact MAX
with correlated WHERE, MIN, REAL SUM, zero LIMIT, local+outer MAX, empty child
WHERE. Original post-c955 public integration controls now all pass. Guarded
type/public/focused114/broad994/994 including C1–C6/Chinook and selected
lifecycle/limits/diff pass; evidence work:///cards/card-t-d/recursive-aggregate-input/.
Two initial type failures (syntax then exact optional linkedPlan) corrected
before public verification. No resource/suspended native parity or general
architecture/R1–R4 approval; direct-derived admission and general qualified
substitution debt from previous revision remain. API unchanged.


#### Ordinary physical output/drain graph closure ([[card:card-t-b]])
compileTableSelect physical output now builds its direct/sorted destination graph in one local SelectProgramBuilder, publishing finish after SELECT-owned terminal Halt. select.c generateSortTail1673ff addrContinue/addrBreak and selectInnerLoop own DISTINCT/filter bypass, OFFSET-before-destination/count-after, empty sorter/drain/next. Removed tail arrays/splice/result-opcode scans and scanContinue/first IfPos/decrement/Halt searches. sqlite3WhereEnd3538ff now falls through to SELECT-owned drain instead of inserting premature Halt; the SELECT marks its continuation before source unwind; existing IN restart/seek/bound/NULL exits remain source-owned. Actual DISTINCT/residual/offset/limit/sorter consumers use builder labels, not an unused facade. Ordinary register/parameter/cursor preparation still manual; no general allocator or nTab closure claimed. Root phase-aware seek seam unchanged.
Source-first DISTINCT INTEGER DESC LIMIT/OFFSET exposed planner-authorized reverse table loop emitted Rewind/Next despite consumed ORDER. Corrected owning positioning to Last and paired Prev for ordinary reverse table scans (wherecode.c aStartOp/aStep, where.c sqlite3WhereEnd7520ff). Intermediate Prev-with-Rewind error corrected at source positioning, not VM. Native3/public3 now agree including ordered empty/direct filtered controls; metadata/reset verified publicly, no native origin/resource parity. Joined b resolveLabel RIGHT validation, c/d scalar LIMIT/Once/NULL/phase/aggregateOutput/recursive input/compound limits and late d305 finish unchanged. Guide/source mapping boundedly updated, API signatures unchanged. General preparation/full analyzer/RIGHT/nTab/resources/direct-derived/grouped/multiple-minmax/unqualified substitution/R1–R4 remain unaccepted.

### Physical scalar LIMIT integration repair ([[card:card-t-d]])
Pinned expr.c3933–3962 sqlite3CodeSubselect normalizes scalar/EXISTS LIMIT X
as numeric-affinity X<>0 before SELECT integer admission. Physical
compileTableSelect.compileExpressionSubquery previously invoked ordinary
computeLimitRegisters, rejecting REAL0.5 while shared linked/aggregate callers
accepted it. computeScalarLimitRegisters now owns this normalization for the
physical callback, resolvedScalarSubqueryEmitter and lexical aggregate callback.
Destination NULL/Exists initialization precedes guard; correlated calls still
reinitialize, uncorrelated Once still skips repeated execution. NULL comparison
remains NULL and MustBeInt produces code20; finalize preserves that saved error.
IN retains ordinary LIMIT/count decrement. No VM, WHERE, cursor, budget or graph
finish changes. Physical independent scan remains live; this is guard semantic
ownership consolidation, not migration of its whole producer. ORDER/OFFSET scalar
admission remains rejected; no supported matrix narrowed to conceal that gap.
Native-first ten controls (nine typed/name/two-run successes plus NULL code20)
and fresh integration18 pass. Final type/focused268/broad1008 incl C1–C6/Chinook,
selected lifecycle/limits/diff and unchanged-input hash comparison pass. Earlier
NULL test failed by forgetting finalize rethrows saved error; fixed test cleanup,
not runtime. Evidence work:///cards/card-t-d/physical-scalar-limit-repair/.
Next seam remains physical scalarPlans linked carriers into shared scalarPrepared
producer/destination, with allocation/cursor identity and Once/NULL/phase/reset
preserved; full general preparation/AggInfo/nTab/R1–R4/native BLOB/origin/encoding/
resource/suspension debt remains. API unchanged.


### Physical linked scalar caller convergence ([[card:card-t-c]])
Current physical compileTableSelect passes already-linked scalarPlans via
resolvedScalarSubqueryEmitter to shared scalarPrepared compileInnerTableSelect
(Mem or Exists) and compileAggregateSelect (Mem). Supported nonordered physical
projection, correlated scalar aggregate and nonaggregate EXISTS now consume real
shared production, not the physical callback's replayed scan. The caller syncs
manual parent registers with builder.registers before/after production and
reserves live nested/IN cursor ranges; enclosing destination/Halt/finish remains
physical-owned. Explicit mappings retain local source versus positioned outer
identity/affinity. expr.c3841–3978 owns Once, NULL/Exists0 initialization before
shared numeric scalar LIMIT and error admission; resolve.c1392–1419 supplies
correlation, selectInnerLoop SRT_Mem/Exists first-row exit and select.c8860–8919
AggInfo reset/update/finalize supply actual producers. Per-invocation AggReset
and d368 computeScalarLimitRegisters remain unchanged. Shared nonaggregate
Exists now initializes0 and emits Exists destination, never a projected value.

Physical ordered scalar, aggregate EXISTS, IN, zero-source and transient derived
count/sum remain live specialized callers and are intentionally not deleted.
Attempted ordered handoff returned first source row instead of sorted winner:
shared producer suppresses sorter when no ordinary limit, but scalarPrepared
already owns its guard. Retained ordered specialized production until that
source-owned sort-tail contract migrates, and restored shared ORDER rejection.
No supported physical route regressed/reclassified; ORDER/OFFSET remains prior
admission debt. No new window/join ORDER or aggregate-Exists admission implied.
No VM workaround, child Program/PC copy, generic evaluator or root WHERE changes.
Preopened physical nested reads remain necessary for live fallback routes.
Ordinary preparation/manual allocator/frontier, general dispatcher, zero-source,
subroutine reuse, full identity/AggInfo/nTab/R1–R4 and native resource/origin/BLOB/
encoding parity remain incomplete. Existing physical0..30/private24 and b
Last/Prev/drain/late finish/RIGHT contracts preserved.

Native-first eight full enclosing controls (source-ID asserted) cover correlated
projection/REAL SUM/MAX/empty/zero/numeric LIMIT/local shadow/EXISTS and ordered
fallback. Typed rows/names/reset/done/finalize in existing linked-scalar test;
d numeric9/integration18 independently rerun (original19 ORDER/OFFSET gap not
claimed green). Physical structural gate protects shared delegation/frontier;
Mem gate now recognizes destination conditional for Exists as well as literal.


### Ordered linked scalar destination closure ([[card:card-t-b]])
Current resolvedScalarSubqueryEmitter now hands ordinary scalar projection ORDER/OFFSET to compileInnerTableSelect with scalarPrepared and explicit sharedLimit. expr.c3933–3962 normalization owns X<>0/numeric guard/NULL datatype20, initialized Mem/Exists and Once; SELECT gets count1 default or normalized count, integer OFFSET and combined/capacity ranges. select.c selectInnerLoop SRT_Mem and generateSortTail1673ff own OFFSET-before-destination, destination/count/first-row exit, empty NULL and drain labels. No ordinary raw-LIMIT reevaluation. Scalar-prepared producers intentionally retain c945 full scan adaptation (phase-aware candidate operand seam); now multiOrderConsumed cannot claim ordering from the planner path whose physical loops are suppressed. Otherwise DESC lost sorter and yielded1 instead of7. Scalar correlated sorter opens before scan each invocation, not only after first accepted WHERE input, fixing empty/first transitions without VM patch.
Physical ordinary ordered scalar callers now delegate actual linked shared production; removed their superseded manual ORDER/SorterOpen/insert/drain/ClearSorter mechanism. IN/zero-source/transient/aggregate EXISTS live, no indiscriminate removal. Aggregate scalar ORDER singleton remains aggregate-owned; aggregate OFFSET admission still explicit temporary (not approved permanent exclusion). Nonaggregate physical OFFSET now translated using normalized scalar count; no product scope change. Shared cursor/register/parameters/outer phase/Once/frontier/late finish preserved. Public signatures unchanged. Native-before full enclosing8 includes existing correlated/empty crash and OFFSET admission gap; seven row controls plus NULL20 saved-finalize regression added. Selected typed/reset/origin controls are not full resources/BLOB/encoding/suspension fidelity. Full preparation/AggInfo/nTab/RIGHT/phase-aware seeks/R1–R4 remain unaccepted.

### Finalized aggregate ordinary scalar destination integration ([[card:card-t-d]])
compileAggregateSubquery now delegates child-local ordinary scalar result rows
(including ORDER/OFFSET/normalized LIMIT) through resolvedScalarSubqueryEmitter
and compileInnerTableSelect with resultLocation's saved/grouped AggInfo phase.
Pinned expr.c3933–3962 preparation and select.c1418–1442 Mem/sort-tail remain
shared owners; aggregate parent owns grouping/finalization and outer binding.
Outer-owned lexical aggregate and specialized EXISTS/IN/transient producers stay
live. The old ordered branch is retained for nonmigrated lexical cases, not
claimed removed: trial deletion was reverted before final checks. No VM/WHERE
index/physical0..30/private24 or public API changes. Fullscan phase adaptation
remains; no general identity/AggInfo/nTab architectural completion claim.
Accepted grouped count + ordered scalar REAL0.5 OFFSET1 reproducer now gives
pinned [0,1,5],[1,2,5],[2,1,5]. Native-first8 found seven passing phase controls
(grouped correlated/unrelated/empty/zero guarding bad OFFSET/text/REAL and MIN)
and an adjacent MAX winning bare-row gap: max=7 but saved a=1 instead of7;
scalar consequently NULL instead of3. That control is preserved in evidence,
not included as a passing regression or claimed fixed. Physical aggregate bare
capture still uses Once whereas recursive input's single-minmax change guard
already mirrors select.c updateAccumulator6915ff. Next owning repair is that
physical/join capture, not an ordered scalar SQL patch. Native errors/resources/
suspension/general retained/recursive/IN/aggregate OFFSET debts remain.
Final type/focused338/public7 and immutable all-src/test broad1033 including
C1–C6/Chinook/selected lifecycle+limits pass; evidence and exact command logs
work:///cards/card-t-d/grouped-scalar-owner/. API unchanged.


### Physical/join AggInfo magnet capture repair ([[card:card-t-c]])
Supersedes the adjacent MAX bare-row gap recorded under d377 above: native
max=7/bare a=7/scalar3 now matches. compileAggregateSelect physical and joined
no-GROUP owners invoke emitPhysicalAccumulator AFTER WHERE/ON admission. It
steps before capture, and shares one captureChange (inverse polarity of pinned
regHit/skipFlag) across invoked unordered min/max in aggregate-list order;
last invoked NEEDCOLL function owns capture, not an asserted unique minmax.
The ordinary no-minmax case retains first-row Once, now after steps. Empty
input captures nothing. Reset initializes magnet/seen per invocation alongside
AggReset; direct input versus saved resultLocation/accumulator phase unchanged.
Shared scalar finalized binding observes winning saved columns, not a query
specific patch or new scalar evaluator. Grouped sorter and recursive specialized
capture remain their existing owners, not silently replaced or generalized.

Source: select.c updateAccumulator6810–6977, sqlite3Select8870ff; func.c
minmaxStep2107–2143. CollSeq initializes regHit only when invoked; duplicate
DISTINCT bypass retains previous magnet, so DISTINCT ties may capture a later
bare row (native max(DISTINCT a%3),a =>2,7), unlike ordinary ties =>2,5.
The TS extrema callback now returns capture=true for NULL while no non-NULL
best exists, matching minmaxStep's absent skipAccumulatorLoad. Once a best
exists NULL/ties/nonwinning values suppress capture. This callback semantic
fix applies to existing consumers without VM changes; shared Mem/budgets kept.
FILTER's source copy-regAcc-before-jump is represented via seen/inverse magnet;
physical FILTER admission itself currently raises baseline internal execution-
only-lowering error on tested forms and is NOT claimed repaired/supported here.
No scope change or reclassification. Aggregate ORDER-delayed min/max is not
asserted to capture a winner at row ingestion. Multiple-minmax general grouping/
recursive/filter combinations remain unproved; native sampled physical
max(a),min(a),a follows last min's capture, not a unique-minmax guarantee.

Native-first14 include physical/join max/min, ordinary ties/NULL/empty,
DISTINCT ties/multiple minmax/ordinary count/grouping/correlated reset plus two
FILTER baselines. Twelve admitted controls and d's enclosing MAX scalar added
to existing typed/name/two-run/reset/done/finalize tests. FILTER errors retained
explicitly in artifacts, not excluded to conceal row regressions. No SQL-text
special case, VM/WHERE/root cursor0..30/private24/index/RIGHT/late finish change.
General AggInfo/identity/nTab/admission/resources/R1–R4 remain open. Evidence:
work:///cards/card-t-c/minmax-capture-repair/ native.py/oracle.json/public-before,
public2 (FILTER errors), success12.json/public8/scoped.patch/final logs.

### Grouped accumulator capture closure ([[card:card-t-d]])
Grouped compileAggregateSelect sorter drain now mirrors select.c
updateAccumulator6880–6977 shared regHit, represented by inverse changed magnet:
all unordered NEEDCOLL min/max steps share it, last invoked controls capture;
DISTINCT bypass preserves previous state. Per-group seen/regAcc and initial
magnet reset alongside AggReset at first/next group, outside CompareGroup
backedge. FILTER copies inverse seen before branch, suppressing saved payload
overwrite on later rejected rows. Ordinary no-minmax retains first admitted
payload after steps; columnOwner.directMode selects sorter then saved phase.
No scalar output/VM/WHERE/private24 workaround or speculative recursive merge.
Multiple grouped min/max and grouped FILTER reproductions now match pin;
eight typed/name/two-run/reset controls include NULL/DISTINCT/empty filter,
ordinary count, both minmax orders and enclosing saved-winner scalar OFFSET.
Native18 full public remains exit1 only for physical minmax FILTER internal,
aggregate+window internal lowering, and plain recursive aggregate admission.
These remain obligations, not owner exclusions. Next preparation owner must
preserve aggregate/window/FILTER carriers before execution-only scalar lowering;
R1–R4/general AggInfo/nTab/resources/native origin/BLOB/encoding/suspend debts
remain. Final type/focused359/original d8/native grouped8 and immutable broad1054
C1–C6/Chinook/selected lifecycle+limits/diff pass. Evidence:
work:///cards/card-t-d/grouped-capture/; API unchanged.


### FILTER call arity and local aggregate window producer ([[card:card-t-c]])
Supersedes d386's two INTERNAL carrier gaps, not its recursive admission debt.
Physical max(a) FILTER(WHERE a<7),a now yields typed [5,5]. Its failure was
BEFORE AggInfo: selectHasAggregate counted descendant expressions including
FILTER as min/max arguments, routed to compileTableSelect projection5375,
and leaked an execution-only aggregate to scalar lowering1893. Count arguments
with the existing aggregateParts semantic production, not a second descendant
walk; FILTER/ORDER/OVER children are separate. select-compiler aggregate entry
now consumes shared compileAggregateSelect → lowerResult/AggInfo → emitSteps,
FILTER-before-arguments → post-step magnet → saved result output. Scalar guard
remains unchanged. No aggregate added to scalar evaluator or SQL special case.

Aggregate+window failure was another producer classification gap: window
rewrite lowered aggregate/column payloads correctly but groupedLayer selected
only syntactic GROUP or nested outer aggregates. It now recognizes resolver
aggregateUses owner depth0 in addition to existing nested ownership, selecting
the existing aggregate coroutine producer even WITHOUT GROUP BY. Retained
source still owns its separate production; no new generic evaluator/VM path.
Window buffer receives finalized aggregate and saved winner from the same
builder via compileAggregateSelect, then executes windows over that payload.
Producer WHERE/empty/no-GROUP one-row aggregate, deferred window placeholders,
window ORDER/sorter/lifecycle and scalar destinations retain existing owners.
Pinned authority: resolve.c resolveExprStep1275–1356 separates x.pList arity
from window/filter properties; select.c analyzeAggFuncArgs6518–6548 separately
analyzes args/order/FILTER; sqlite3Select7699 runs window rewrite before aggregate
analysis; window.c selectWindowRewriteExprCb780–835 lifts TK_AGG_FUNCTION and
TK_COLUMN into sublist, sqlite3WindowRewrite996ff transfers aggregate/group/
HAVING work to the subquery and clears outer SF_Aggregate. TS keeps its object/
async/phase representations; this repair removes wrong scalar dispatch, not
an algorithm substitution or a claim of complete AggInfo analyzer fidelity.

Independent native FIRST14 over physical/join FILTER, REAL/NULL/empty/DISTINCT,
local aggregate window/count/multiple and correlated scalar FILTER were captured
BEFORE consuming edits. Thirteen now pass typed/name/two-run/reset/finalize
public controls, added to existing linked scalar suite. Correlated scalar FILTER
remains baseline temporary admission ('this scalar subquery shape is not
implemented'); full14 is NOT green. Original d full18 now only plain recursive
aggregate unsupported, not physical/window INTERNAL. Preserve this obligation,
not an owner exclusion. No grouped/physical magnet/reset/callback modification;
b count/OFFSET/order/Mem and d saved result phases untouched. Native metadata
origins/BLOB/encoding/resource/suspension parity, deeper retained/recursive
windows, general identity/AggInfo/nTab/preparation R1–R4 remain unproved.

Fresh type/focused372/public13 pass; immutable final src/test broad1067/1067
including C1–C6/Chinook fail/skip/cancel0, hashes OK. Evidence:
work:///cards/card-t-c/carrier-repair/{before.ts,stack.mjs,native.py,oracle.json,
public-before.log,public1.log,public18.log,success13.json,public13.log,focused.log,
broad.log,inputs.sha,immutable.log,scoped.patch}. Baseline stack proves actual
production callers; full matrices preserve residual admissions explicitly.


### Ordinary recursive aggregate input closure ([[card:card-t-b]])
Current compileSelect recursive branch now selects compileRecursiveAggregateSelect with real schema/database, replacing SUM-only argument/destination/evaluator specialization. It reuses recursive-window resolver-only transient SrcItem description (prepareRecursiveSource), resolves immutable linked NameContext, composes existing compileRecursiveCteSelect Queue/Current producer to SRT_Coroutine on same builder, then feeds compileAggregateSelect input.first/emit. No rootPage0 OpenRead, synthetic read producer, new runtime or completed Program relocation. TableNode metadata is the existing browser resolver representation of CTE SrcItem columns, not new physical schema. Input registers own direct AggInfo reads; saved/final binding owns output. SELECT owns WHERE/step/bare capture/AggReset/finalization/destination and consumer LIMIT/OFFSET; producerOnly keeps CTE body LIMIT separate. Enclosing entry publishes shared parameter names and late Halt/finish after all labels. Retired SUM aggregate-expression path only in this migrated consumer; other destinations stay live.
Source: select.c generateWithRecursiveQuery2667–2830 Queue/Current/setup/recursive/destination/body limits, sqlite3Select preparation and SrcItem coroutine path, selectInnerLoop Mem/Output/Coroutine, updateAccumulator6880–6977 shared regHit/regAcc NEEDCOLL/FILTER, expr.c saved aggregate column phase. Streamed input now reuses existing emitPhysicalAccumulator rather than independent exactly-one-minmax capture: last invoked magnet controls bare row; FILTER regAcc-before-jump and DISTINCT bypass preserved; ordinary aggregate saves first admitted input; empty finalizes once. This closes plain recursive MAX+bare pin5/5. SUM/count/min/max/FILTER/WHERE-empty/DISTINCT/REAL/multiple-minmax/LIMIT0/OFFSET controls pass selected matrix. GROUP/HAVING and nonordinary multi-source/compound consumers remain explicitly unsupported, scalar nested output admission remains a separate debt; no silent partial grouping or scope exclusion. Nine native-first full enclosing typed/name/reset controls added; original public18 no longer has this admission failure. Grouped/correlated full matrix residuals remain documented, no resource/origin/BLOB/encoding/suspension parity claim from selected controls. General preparation/AggInfo/nTab/R1–R4 remain open. Public method signatures unchanged; admitted recursive ordinary aggregate output broadened through existing semantic owner, not SQL-text special cases.

### Linked scalar aggregate FILTER caller closure ([[card:card-t-d]])
resolvedScalarSubqueryEmitter and finalized/grouped compileAggregateSubquery
now admit FILTER for child-local ordinary aggregate result into existing linked
compileAggregateSelect (not scalar evaluation). FILTER semantic carrier binds
inner cursor and outer current/saved AggInfo phase; shared emitSteps owns
predicate-before-args/step, AggReset per invocation, capture/finalization and Mem.
Pinned select.c updateAccumulator6880ff separates FILTER from arguments and
copies regAcc before branch; expr.c scalar preparation remains NULL/Once and
numeric limit guard. DISTINCT/order/offset/EXISTS/outer-owned aggregate
restrictions stay live; no general guard removal or VM/WHERE/private24 edit.
Accepted correlated MAX FILTER returns [1,NULL],[3,1],[5,3],[7,5]. Eight public
native controls cover MAX/MIN/SUM REAL/count, uncorrelated Once, zero/REAL limit
and grouped saved-winner outer binding, two-run/reset/finalize. Original native15
now only recursive GROUP/nested scalar and grouped FILTER-window admissions
remain (not exclusions). Additional8 captured post-first edit, pre-grouped-caller
edit; original15 preconsuming capture is primary independent repair oracle.
Type/focused410/immutable broad1084 C1–C6/Chinook/selected lifecycle+limits/diff
pass; evidence work:///cards/card-t-d/scalar-filter/. No general identity/AggInfo/
nTab R1–R4/native origins/BLOB/encoding/suspension/resource parity claim.


### Recursive grouped input closure ([[card:card-t-b]])
Supersedes the prior ordinary-input GROUP/HAVING admission debt for bounded
single recursive SrcItem aggregate consumers. compileRecursiveAggregateSelect
now passes GROUP/HAVING through the real linked plan and same Queue/Current →
Coroutine input. compileAggregateSelect's existing grouped sorter population
consumes input.emit(insertGroupedRow), evaluating consumer WHERE then GROUP keys
and copying queue payload registers. Physical OpenRead/Next and groupedStream
production are bypassed only when genuine parent.input exists; neither is removed
for live callers. WHERE rejection returns to the input owner's next Yield.
SorterSort empty exit, key comparison, AggReset, seen/magnet reset, shared
FILTER-before-arguments/DISTINCT/last-invoked minmax capture, saved/final phase,
HAVING and result destination/ORDER/LIMIT/OFFSET remain the existing group owner.
The queue body LIMIT/OFFSET stays producer-owned; no new runtime/evaluator,
rootPage0 physical read or completed Program relocation. Same enclosing builder,
parameters/register/cursor labels and late finish remain. TS register payloads
are the browser representation of the C coroutine SrcItem and AggInfo sorter
payload, not an exceptional grouping algorithm substitution.
Pinned select.c: generateWithRecursiveQuery2790–2835 emits Current before
recursive resume; sqlite3Select8570–8615 constructs GROUP key/AggInfo payload
sorter and switches useSortingIdx; 8650–8745 compares groups, outputs/resets on
transition and final exhaustion; updateAccumulator6830–6970 owns FILTER regAcc,
NEEDCOLL regHit/DISTINCT and saved bare capture. Existing sorter/group bytecode
is retained, not newly asserted as complete AggInfo analyzer parity.
Native FIRST11 before consuming edits covers exact grouped MAX+bare, multiple
minmax, FILTER, DISTINCT, all-NULL aggregate, REAL/ordinary first bare, empty,
HAVING/ORDER/consumer limits, NULL key and body LIMIT/OFFSET. Additional five
post-migration native controls cover ties, all-filtered first bare, multiple
FILTER, NULL source and saved correlated scalar FILTER. Public typed/name/two-run
reset/done/finalize regressions reside in the existing linked scalar suite.
Full original15 now retains two admissions: recursive nested zero-source scalar
and combined grouped FILTER-window. No full15 success, origin/BLOB/encoding/
resources/suspension parity or R1–R4/general identity/AggInfo/nTab claim.
Evidence: work:///cards/card-t-b/recursive-group-repair/; public API signatures
unchanged, bounded recursive grouping admission broadened rather than narrowed.

### Prepared zero-source scalar consumer closure ([[card:card-t-d]])
Finalized/grouped compileAggregateSubquery delegates child-local zero-source
SELECT to resolvedScalarSubqueryEmitter. Removed its unbound compileExpressionTree
shortcut: linked Mem/Exists producer now initializes NULL/0 and Once/normalized
scalar count, skips on WHERE/offset, binds result with enclosing saved AggInfo
and visits selectInnerLoop/destination once without physical WHERE planning.
bindResolvedExpression no longer preserves prebound cursor when a semantic
binding is supplied; rebind owns coroutine/sorter/saved phase. Pinned expr.c
sqlite3CodeSubselect3841–3950 owns correlation/Once/init/limit and select.c
selectInnerLoop owns destination; zero SrcList needs no cursor loop. Failed
empty-SrcList physical planner trial produced invalid cursor; rejected, not VM
patched. DISTINCT/GROUP/compound/VALUES/outer-owned aggregates stay guarded.
Eight typed/name/two-run/reset controls cover recursive ordinary/grouped saved
winner, child WHERE false/true, scalar REAL/zero LIMIT and OFFSET; original
pre-edit14 supplies accepted independent oracle, extra10 was captured post-code.
Full extra10 retains unrelated physical zero-source WHERE defects (literal WHERE0
returns42; correlated physical child admission rejects), not exclusions. Combined
grouped FILTER-window remains the original15 admission. General preparation,
identity/AggInfo/nTab/R1–R4/origin/BLOB/encoding/resource/suspend parity unproved.
Type/focused434/immutable broad1108/public8+original18 pass. Evidence
work:///cards/card-t-d/zero-scalar/. Public contracts/signatures unchanged.


### Physical singleton scalar caller migration ([[card:card-t-c]])
Supersedes d404's physical zero-source bypass only. compileTableSelect's
compileExpressionSubquery now hands scalar zero-source children (including
EXISTS) to existing resolvedScalarSubqueryEmitter/prepared singleton SELECT.
The caller supplies linked outer CURRENT cursor binding and synchronizes the
manual register frontier/cursor reservation before and after handoff, just as
its physical child producer. Removed old unconditional Copy/Exists1 shortcut,
which ignored WHERE/count/offset and failed correlation/Once. No empty SrcList
physical WHERE loop, child Program/manual PC copy, SQL-specific evaluator or VM
change. Physical source bound at cursor0, nested source reads keep relocated
cursors; prepared producer initializes NULL/0, skips Once only if correlated,
normalizes count, evaluates WHERE then offset then one destination visit.
Retained IN/derived/aggregate-EXISTS/lexical/GROUP/compound/VALUES restrictions
remain separate, no unsupported shape silently emits a partial result.
Authority: expr.c sqlite3CodeSubselect3841–3964 correlated/Once/NULL/count;
select.c selectInnerLoop SRT_Mem1422ff publishes after OFFSET/predicate admission;
resolve.c NameContext.nRef/pNext/correlated ownership. Shared Mem/Btree/KeyInfo,
async and d saved/grouped/recursive phase semantics unchanged. R1–R4/full
preparation/identity/AggInfo/nTab and index/resource/suspension parity not proved.

Existing independently pinned full10 reused BEFORE consuming edit, eight matched
two failed: physical42 WHERE0 gave42 notNULL; correlated WHERE/count/OFFSET
rejected. After caller migration full10 and original18 pass typed/name/two-run/
reset/finalize. Existing linked scalar suite adds both accepted controls and nine
post-code native boundary expansion cases (NULL/WHERE/count0/REALcount/OFFSET1,
REAL/correlated/EXISTS/descending output). Initial extra10 exposed deeper nested correlated singleton NULL for all rows
(pin5/7 on last rows), then the first broad run failed six existing UTF8/16
correlated-two-level/nested EXISTS regressions. Full extra10 now passes after
owning NameContext/producer fixes below. Capture is postrepair expansion, not
FIRST; not relabeled pre-code evidence. Original15 still only grouped FILTER-
window temporary admission. Passing focused445/public10+18 does not waive these.
Evidence work:///cards/card-t-c/physical-singleton-repair/ including baseline
before.ts, extra native script/oracle, public10/public18/public15/public-extra,
focused-final.log, broad.log, inputs.sha/immutable.log; native baseline reused
from work:///cards/card-t-d/zero-scalar/. No owner API signature change.


Physical singleton affected-path integration: first broad run1119 tests had six
failures (existing two-level correlation and nested EXISTS in all three
encodings), not erased by focused445/public10+18. resolve.c lookupName848–853
increments contexts up to the matching context; TS incremented only innermost
owner, so a singleton containing a correlated SELECT was wrongly Once cached.
TS nRef is a correlation-only marker (local refs are NOT correlation); increment
all intervening contexts before the matched context for outer references,
retaining this representation contract. Initial literal C inclusive increment
made local SELECT correlated and failed existing resolver-facing tests; adjusted
to preserve local=false. Nested physical compileInnerTableSelect also created a
fresh scalar emitter without passing its active cursor/outer-binding map;
resolve.c assigns global SrcItem cursor identities whereas TS linked sources
still use relocated mapping. Supply nested binding: local refs map via cursorFor,
outer refs via enclosing expressionBinding. Shared singleton callback then sees
correct current physical row and transitive Once state; scalar guard untouched.
This correction belongs to resolver+consumer, not a nested SQL workaround.
New deeper singleton regression and existing UTF8/16 full174 foundation suite
now pass. Final focused620 (prior11 files plus foundation) and full native10,
extra10, original18 pass. Original15 still only grouped FILTER-window temporary
admission; this repair does not widen GROUP/compound/outer-owned lexical work.
Artifacts preserve broad.log failure, nested.log inclusive-nRef trial failure,
nested2.log174 success, public-extra2/3/final, focused-own-final.log and final
immutable broad evidence. General correlation/identity/index/resource parity
is not established by these finite matrices. No VM/root/private-budget changes.

Final resolver contract alignment: second broad had1119 pass/1 failure: old
parser/resolver test explicitly expected intermediate deep.nested[0].correlated
false. Pinned lookupName848–853 plus native/public execution require true to
avoid stale Once. Updated that assertion with source note, retaining top-level
local=false and inner=true, source cursors/shadowing/ambiguity tests. This is
source-backed correction of an obsolete internal expectation, not suppression of
an SQL regression. Final focused650 includes resolver30 + foundation174; final
broad-complete and immutable-complete logs are the final acceptance evidence;
earlier broad logs retain actual failures. No src/test edits while final broad
runs. Full native10/extra10/original18 successful; original15 grouped FILTER-
window still temporary. Current bounded green is not R1–R4 approval.


### Grouped-to-window outer expression ownership ([[card:card-t-c]])
Supersedes the retained original15 grouped FILTER-window admission prediction.
Native-first full9 sibling baseline (source-ID asserted) and original15/18
are at work:///cards/card-t-c/group-filter-window-red/. All9 siblings rejected
before this slice; inner lowering returned columns0, not an accumulator/frame
exception. window.c selectWindowRewriteExprCb744ff rewrites terminals while
sqlite3WindowRewrite958ff moves GROUP/HAVING and persists AggInfo in the child.
TS lifted terminals correctly but outer output required whole-expression identity:
a%3 had lifted a, not a%3, so publication remained atomic unsupported.

compileWindowSelectLowering now binds surviving outer expressions through the
existing resolver carrier/expr lowering to finalized root payload registers.
Lifted aggregates consume their finalized payload; columns consume saved group
winner values, never raw source cursor; existing shared scalar producer receives
the same producer-row binding for correlated subqueries. The first trial omitted
that callback and admitted NULL for (SELECT t.a); corrected owning callback and
builder frontier synchronization. Ordinary outer ORDER/result aliases use the
same compiled entries. Existing window execution admission remains intact.
No new evaluator, guard-only acceptance, Program relocation, VM or WHERE change.
Grouped producer/updateAccumulator remains unchanged, preserving FILTER/regAcc,
NEEDCOLL/magnet/NULL/tie capture, resets and coroutine boundaries. Pinned expr.c
column/aggregate register consumption and resolve linked carrier identities own
expression lowering, not SQL-text recognition. No allocation/entry seam change
requiring b coordination was identified.

Regression matrix adds9 native-first cases to existing cross-layer public suite:
with/without FILTER, NULL/ties/filter0, incompatible windows/multiple aggregates,
empty GROUP input, saved correlation and descending ORDER/LIMIT/OFFSET. Public
full9/original15/original18 pass typed rows/two runs/reset; existing suite verifies
names/done/finalize. Evidence work:///cards/card-t-c/group-filter-window-repair/.
Type/focused437 pass; broad/immutable result must be read from current status,
not inferred from this note. No full origins/BLOB/encoding/error/resource parity
claim. Parent status79 R1–R4/reviewv3 and general preparation/identity/AggInfo/nTab
and C-subroutine/retained destination fidelity remain open. Public API unchanged;
unimplemented output expressions still reject atomically typed temporary.


### Recursive GROUP→window moved-column identity ([[card:card-t-d]])
Native-first post-c1000 public integration found INTERNAL for recursive GROUP
with `(SELECT (SELECT q.a))` plus first_value: pinned rows
[0,3,3,3],[1,7,7,3],[2,5,5,3]. Physical sibling matched. Stack evidence
places the first failure in compileAggregateSelect result binding, not VM step.
window.c selectWindowRewriteExprCb744–829 copies outer-source TK_COLUMN even
inside scalar children into the grouped producer and rewrites its consumer to
an ephemeral payload column. Recursive lowering reuses the resolver-only queue
source plan: replacing only plan.source omitted the moved child's columnUses.
The producer now publishes moved outer-source uses with local selectDepth0,
retaining original source/reduction identities and nested correlation metadata.
No token re-resolution, scalar evaluator or VM exception workaround is added.

The next divergence was producer publication: recursive grouped expressions
were being rebound/recomputed from queue positions; bound columns used raw
queue columnIndex instead of grouped payload position. All grouped producers
now copy their finalized expression payload by producer/buffer position through
emitProducerBinding. Ordinary recursive non-grouped producers still use queue
columnIndex and current expression binding: their dependency is different. An
initial overbroad trial broke that live branch (focused failures retained) and
was narrowed at this ownership distinction. This retires the grouped recursive
raw-source recomputation only; other manual PC/allocation branches remain live.
Compiler owns moved semantic graph, allocation, labels and coroutine payload
contract. VM retains InitCoroutine/Yield/Once PC/register/Mem/budget/reset and
suspension; root WHERE/index/RIGHT/private24 contracts unchanged. No API change.

Regression adds exact original SQL plus six independently pinned siblings to
select-window-cross-layer-integration: shallow/deeper correlation, FILTER saved
winner, singleton WHERE/numeric LIMIT, window argument, incompatible windows,
empty groups; names/types/two executions/reset/done/finalize. Original oracle
was captured before consuming edits; extra6 after edits, not native-first.
Evidence work:///cards/card-t-d/recursive-window-identity/ and post-c1000/;
current status contains exact commands/hashes/outcomes. Four unrelated scalar
DISTINCT/GROUP/compound/multisource admissions remain unresolved, not exclusions.
No general identity/AggInfo/nTab/subroutine/metadata/error/storage/resource or
R1–R4 architecture acceptance follows from this bounded closure.


### Ordinary physical entry construction ownership ([[card:card-t-b]])
Pinned select.c sqlite3Select7590–7695 obtains the enclosing Parse Vdbe and
SelectDest; selectInnerLoop1140–1205 assigns its result range from Parse.nMem;
vdbeaux.c610–650 and2647–2685 keep label resolution and MakeReady on that owner.
The ordinary single-table producer now consumes the actual entry builder,
parameters and destination. Result, expression/IN/LIMIT/scalar registers, sort
keys, nested and private sorter cursors allocate on that frontier; scan and
sorter drain dispose through the supplied destination. Local register counters,
scalar highwater handoffs and hardcoded result register1/output are retired in
this branch. Entry emits the terminal Halt and finishes after producer exits;
the standalone compileTableSelect wrapper does the same for still-live callers.

Fixed physical WHERE cursors0/3 and reserved0..30/private24 remain deliberate
partial-migration contracts; nested physical cursor namespace starts beyond999
via builder reservation, not a separate counter. They are not general nTab
fidelity. Ordinary labels/WHERE positioning, reverse/seek/IN/error gates, result
metadata and VM/Mem/Btree/budgets are unchanged. Other JSON/derived/join/compound
specializations still return independently published programs: the entry only
finishes its builder when the producer returned that same ops identity. This
identity distinguishes live ownership (no completed-child splice), not shape
reclassification or fallback after error. Those producers remain R1 obligations.

Seven independent native-first controls (source-ID asserted) exercise ordinary
scan/sort/DISTINCT/IPK seek, nested singleton, INTEGER/REAL/NULL, empty and LIMIT0.
Durable test checks typed rows/two runs/reset/done/finalize and names, recording
existing rowid public-name versus native IPK-name divergence explicitly. This
migration does not repair that prior naming gap. Existing broader tests supply
bindings, atomic errors, physical index and lifecycle coverage, not a new full
native cross-shape oracle claim. Evidence/actual command outcomes are in current
status and work:///cards/card-t-b/ordinary-entry-repair/. No new supported shapes,
algorithm substitution, full metadata parity or R1–R4 acceptance claimed.

### Bounded fourth-checkpoint compound collation correction

The independently pinned 3.53.4 matrix exposed wrong UNION/INTERSECT/EXCEPT
rows when explicit compound ORDER COLLATE differed from set equality. The
existing two KeyInfo objects alone were insufficient: `select.c:5502–5584`
`convertCompoundSelectToSubquery` runs before merge and moves ORDER/LIMIT to
an outer SELECT whenever a set prefix and explicit ORDER collation coexist
(ALL-only remains mergeable). `emitScalarCompoundMerge` now composes the
unordered set producer into a same-builder coroutine, then sorts surviving
payload using the outer ORDER KeyInfo. Inner merge/duplicate KeyInfo remain
independent (`select.c:2600–2630,3502–3523`); equality is never ORDER equality.
No SQL-text special case, VM workaround or extra DISTINCT evaluator was added.
Compound LIMIT/OFFSET apply only while draining outer sorting.

The checkpoint's repeated NOT MATERIALIZED VALUES CTE structural red also
proved a real producer-ownership divergence, not justification for deleting
its assertion. `fromClauseTermCanBeCoroutine:7266–7290` permits independent
repeated NOT MATERIALIZED sources. The compound CTE arm delegates its retained
producer into the shared destination/builder rather than the shared CteUse
spool branch; the table compound caller publishes that builder's columns/ops.
The original two-InitCoroutine assertion remains intact. Public INTEGER8,8
rows already matched before repair; the structural ownership obligation is
separate from the runtime compound wrong-row defect.

Native-first typed/reset controls and the original checkpoint regressions are
retained in `test/conformance/compound-collation.test.mjs` and
`test/conformance/cte-opcodes.test.mjs`; bounded command/results and attempted
hypotheses live in [[card:card-t-c]] status and checkpoint-collation-red/repair
work artifacts. This is not R1–R4 architecture acceptance or new breadth;
metadata/origins, general resources/storage and unrepresented shapes retain
previous qualifications. No bitwise excluded changes are part of this repair.


### Correlated scalar destination admission repair ([[card:card-t-d]], 2026-10-03)
Supersedes only the four unresolved scalar admissions recorded above. Fresh
source-ID asserted native-first DISTINCT, GROUP/ORDER, ordered UNION ALL and
multi-source physical scalar children reproduced temporary prepare failures.
Pinned expr.c:sqlite3CodeSubselect (3870–3970) initializes NULL/Exists on each
correlated invocation, applies Once only without correlation, converts scalar
LIMIT X to X<>0 (retaining OFFSET), and calls sqlite3Select with SRT_Mem.
select.c:selectInnerLoop/SRT_Mem (1412ff), generateSortTail and multiSelect
own projection, DISTINCT/grouping, OFFSET before destination and count after.

Current owner/caller chain: physical compileExpressionSubquery delegates to
resolvedScalarSubqueryEmitter; linked resolver plans retain NameContext sources
and original reductions. Local cursor maps adapt physical addresses without
re-resolving correlated names. Ordinary DISTINCT/multiple-source children call
compileInnerTableSelect on the enclosing builder/parameters/Mem destination;
GROUP/HAVING calls compileAggregateSelect with the normalized sharedLimit, so
sorted group draining cannot overwrite the scalar with later groups. Nested
compoundArms are resolved in the same outer context and ordered UNION ALL uses
emitScalarCompoundMerge with linked plans/common normalized root LIMIT. The
unordered ALL path emits sequential arm coroutines, not an invented merge of
the first arm with itself; OFFSET and destination remain at the root drain.
Physical arms consume existing linked full-scan admission (scalarPrepared),
not the selected WHERE bound-operand path that lacked reduction identity for
an outer reference. Root [[card:card-s]] WHERE/index/private24 contracts are
unchanged; this is a retained optimization gap, not a root defect finding.

Compiler still owns graph/allocation/labels and coroutine payload contracts.
No completed Program copying, independent evaluator or VM opcode special case
was introduced. VM retains PC/register/cursor/Mem/KeyInfo/Btree, budget and
suspension/reset/finalize ownership. Existing manual-PC/specialized publishers
remain live outside this bounded slice and must not be removed prematurely.
Correlated set operators, VALUES, aggregate/transient compound arms remain
honest temporary rejections; this is not general compound scalar acceptance.
No exceptional algorithm substitution or public contract/product-scope change.

Durable select-correlated-scalar-destination.test.mjs embeds independent pinned
rows/names for the four reproducers plus five LIMIT0/OFFSET/exhausted DISTINCT
and ordered/unordered ALL controls, checks INTEGER/NULL, two executions/reset,
done/finalize. Original ten-case cross-feature oracle remains in
work:///cards/card-t-d/finite-assessment/red-current/; controls and commands,
failed hypotheses and final hashes are in scalar-admission-repair/ and current
status. These tests do not establish full metadata/origins/encoding/BLOB/error
or storage/resource parity, nor finish the seven-item R1–R4 assessment.

### Specialized parent entry handoff — bounded R1

| Pinned owner | Current production consumer | Contract |
|---|---|---|
| select.c sqlite3Select7590ff / multiSelect | compileTableCompoundProducer → compileJoinedUnionAll | Same builder/parameters, separate private sorter, supplied outer destination; columns-only shared return |
| select.c FROM coroutine/materialization tags0482/0486 | compileTableSelectProducer → compileSingleCompoundDerived | Child arm loops/sorters in enclosing builder, caller output destination, late entry finish |
| select.c FROM reuse tag0488 | compileTableSelectProducer → compileRepeatedImmutableView | Shared one-fill/OpenDup readers preserved; outer drain consumes parent destination |
| select.c FROM materialization tags0486/0488 / SelectDest | compileTableSelectProducer → compileCteDerivedSources/fallback | CteUse identity and per-use cursors retained; fallback receives SAME parent; columns publication to entry |

Standalone invocations keep existing terminal publication; shared invocations do
not freeze ops or finish labels. Already-shared compileCompoundDerivedAggregate
is untouched. Test: select-specialized-parent-entry-owner plus existing repeated
view/CTE fallback/derived-table/public integration. Shared semantic cursor frontier
for joined arms is forwarded into resolution; fixed physical/private cursor
reservations elsewhere remain explicit unfinished WHERE integration, not remapped.

### Bounded IPK result metadata repair (2026-10-03, card-t-d)

The ordinary-entry pinned witness no longer exempts `rowid` naming: direct
negative-column addressing now produces the declared INTEGER PRIMARY KEY name
(or canonical `rowid` when no IPK exists). `resolve.ts` keeps lookup spelling,
source identity and negative physical columnIndex intact; only resolved-result
name production and descriptor column selection consume iPKey identity.
Explicit AS aliases still win. Pinned `select.c:sqlite3GenerateColumnNames`
2141–2210 and `columnTypeImpl` around2009 own these two consumers; VM cursor/PC,
WHERE/index and suspended execution are unchanged. No algorithm substitution.

`select-ordinary-entry-owner.test.mjs` preserves the original native-first
rows/types/names/reset witness and adds freshly source-ID-asserted native-before-
repair controls for rowid/_rowid_/oid on IPK/no-IPK tables, qualified/AS access,
origin/declaredType and leftmost compound naming. Disposable native capture and
unchanged RED diagnostic are retained under
work:///cards/card-t-d/ipk-metadata-repair/ and finite-combined-assessment/.
This supersedes the earlier bounded IPK naming qualification only, not complete
metadata parity. COLLATE expression-name/metadata and transient-table name
production have distinct upstream branches and are not certified by this slice;
JSON/retained-window publication, nTab, exact export and broader resource
qualifications remain. No root WHERE fault or scope change is asserted.


### Bounded JSON/retained-window enclosing publication correction (2026-10-03)

[[card:card-t-b]] forwards the actual table-entry builder, ParameterBuilder and
SelectDest through mixed physical/JSON, two correlated JSON sources, and single
JSON scan/group/aggregate/sorter drains. Their local contiguous ranges begin at
the enclosing register frontier; manual range increments are synchronized back
to the builder before expression allocation and return. Shared paths neither
freeze ops nor emit terminal Halt/finish. The retained-window path forwards
parameters/destination, including its flattened recursive caller, and leaves
window labels/subroutine finalization to the enclosing late Halt/finish. Actual
standalone wrappers remain. Source: select.c sqlite3Select7615, selectInnerLoop
1139ff/SRT_Output1442ff, coroutine/materialization tags0482/0488 recursively use
the same Parse/Vdbe with chosen destinations; vdbeaux label resolution remains
late. Objects/register indices are TS representation adaptations, not a new
algorithm or evaluator. Fixed JSON cursor0/1 and physical/private fences remain;
this is not general nTab/WHERE equivalence or RIGHT acceptance.

Native source-ID checked JSON five-case and retained-window probes ran BEFORE
product edits. Public JSON metadata/bind/reset/limit/error controls and window
controls are preserved; construction checks assert consumed ownership and late
publication, not SQL compatibility. A native grouped JSON control independently
shows existing TEXT `text`/REAL0.0 versus public retained `string`/INTEGER0 for a
text input: this pre-existing semantic discrepancy is not repaired or concealed
by the construction migration. No blanket metadata/type parity claim.

Revision 2026-10-03, five-caller correction: the previous omitted-edge census
above is superseded for ordinary flatten, materialized derived, immutable-view
recursion, zero-source scalar and multisource table entry. These now consume the
enclosing builder/parameters/destination. See
`docs/research/card-t-b-fallthrough-owner-census.md` for the finite branch census,
source comparison, specialization/admission constraints and verification limits.
The ops-identity escape is now an internal invariant failure, not publication of
a private Program. This does not close parent R1–R4, RIGHT or exported-candidate
acceptance, and does not repair the documented grouped JSON type discrepancy.

### Bounded grouped JSON storage-class correction (card-t-c)

The b818 grouped JSON witness is now repaired at semantic owners, not at the
SELECT drain: `json.c:jsonEachColumn`/`aJsonType` uses TEXT label `text` for
JSON strings. The table producer now shares `jsonTypeName` with `json_type`,
removing its duplicate label rule. Internal parser kind remains `string`.
`vdbe.c:sqlite3_value_numeric_type` applies numeric affinity only to fully
numeric TEXT with bTryForInt=0; nonnumeric TEXT/BLOB keep their type.
`Mem.valueNumericTypeCopy` mirrors that classification without mutating the
producer payload; arithmetic `numericTypeCopy` remains unchanged.
`func.c:sumStep1929ff` and `sumInverse1963ff` now consume this classification
and use the existing `valueDouble` accessor for non-INTEGER contributions,
so nonnumeric text contributes REAL zero, not INTEGER zero. Sum/total/avg
share the same accumulator. No new evaluator or change to group builder,
destination, parameters, cursor allocation, reset or error lifetimes.

Source-ID-checked native controls captured before consuming edits and public
storage-class/reset/rebind regressions are retained in
`test/conformance/json-group-numeric-types.test.mjs`; the existing grouped
JSON assertion now expects `text`/REAL0.0. Exact commands, failed intermediate
hypotheses and immutable input evidence live in [[card:card-t-c]] status and
json-group-semantic-red/repair artifacts. This supersedes only the b818
specific unresolved grouped witness, not general JSON/storage/resource parity,
parent R1–R4 or independent RIGHT/export proof. Metadata origins remain qualified.

### 2026-10-03 d physical outer-join aggregate input
- select.c8884–8904 → compileAggregateSelect outer-join branch →
  compileInnerTableSelect.consumeRow → emitPhysicalAccumulator → emitFinals.
  Emission-time input handoff shares builder/parameters and physical cursor map;
  no finished-child relocation or result projection of aggregate expressions.
- wherecode.c2842ff → existing joined matched/unmatched continuation;
  left NullRow and RHS Rewind/Rowid/Next now use cursorFor, matching OpenRead.
- vdbeaux.c610ff / vdbe.c1152,6204: compiler label resolution versus unchanged
  VM Return/NullRow state. No new runtime evaluator or technical substitution.
- Regression: select-outer-join-aggregate-input.test.mjs, original native-first2
  plus later independent6, full frozen1347 including lifecycle/limits/C1–C6/Chinook.
  Grouped RIGHT and repeated barriers remain honest unsupported boundaries;
  INNER/CROSS manual aggregate input stays live. See guide/status for exact limits.


### F1 endpoint lookup control repair (card-t-d, 2026-10-03)
Supersedes provisional uncontrolled linear-seek acceptance. Pinned window.c1948–1950
bounds regApp target and emits SeekRowid; vdbe.c5495–5568 performs Btree lookup
and propagates errors before position publication. Browser shared finite records
still use sequence+1 linear identity lookup (not native Btree complexity), avoiding
new shared mutation/index bookkeeping. EphemeralIndexCursor.seekRowid now requires
PrivateStateControl, charges one deterministic unit per visited entry, checks even
empty/completed searches and publishes position only after successful checks.
EphemeralSeekRowid awaits it with VM private control: host yield every256 total
work units, cancellation/deadline/limit checks within traversal. NULL target still
branches without lookup; OpenDup positions remain independent. No regApp/result
or destination lowering change, no guarantee narrowing or native work equality.
Existing primary-error/exhaustive cleanup/reset/finalize ownership is unchanged.
Primitive and public600-row bounded PRECEDING endpoint tests isolate600 visited
units by public budget delta; actual host yields inside seek, cancellation/deadline,
reset/reexecution, shared replacement/missing/failure position checks pass.
Exact attempts/native temporal provenance/export evidence in card-t-d status and
work:///cards/card-t-d/endpoint-seek-repair/. Grouped RIGHT remains delegated
in-scope feature debt; general nTab/resource/native error parity is not certified.


### 2026-10-03 original-e integration correction: shared join plan accounting

The accepted stabilization's enclosing-builder multi-source path planned real
WHERE loops but discarded its `whereAccounting` when the producer returned to
`compileTableSelectProducer`. Preserve that owning planner result across the
shared producer return; do not invent counters at execution or weaken the frozen
LEFT JOIN ON-provenance assertion. Pinned `select.c:8292–8314` retains the
`sqlite3WhereBegin` result for the actual loop producer; TS planning remains
`planWhere`-owned (including ON prerequisites/null-extension). This is private
prepare accounting propagation, not a new access algorithm or public API.
The unchanged ordinary public driver now passes 23 cases/69 encoding assertions
including exact zero index seeks on this LEFT JOIN control; selected/storage204
also passes on isolated committed source plus this repair. Earlier e0f6913
ordinary failures (twice, plannerCandidates0<1) remain historical evidence.
No advanced24/30 selection inflation, optimizer/architecture breadth or native
work-equivalence claim follows. See [[card:card-s-c-e]] repair status for commands.

### R1 operand indexability and RHS overlap (2026-10-03)

Pinned `whereexpr.c:1034–1099 exprMightBeIndexed`, `1155–1257 exprAnalyze` →
`where-plan.ts:columnUse/binding/indexedBinding/rhsPrereq/analyzeWhere` and
`admitIndexConstraint`. Exact column lookup is separate from recursive
`prereq`; parentheses/COLLATE alone are transparent for ordinary binding.
Represented structural expression matches own a source-identified XN_EXPR
binding and retain physical descriptor identity. RHS/list usage is independent
of all-use; original and commuted terms with overlapping sources remain
non-driveable residuals. No VM eligibility recomputation added.
`capture-where-operand-admission.py` and
`where-operand-admission-public.test.mjs` prove the omitted-row repair through
public execution and real private seek/scan accounting in three encodings,
with genuine expression-positive/negative controls. Existing RIGHT/FULL
fallback and LEFT masks remain covered by shared analysis regressions.
