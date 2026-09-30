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
| `src/select.c` tags 0486/0488; `src/vdbe.c:OP_Once`, `OP_Gosub`, `OP_Return`, `OP_OpenDup` | one statement-owned ephemeral fill and independent duplicate cursor | repeated immutable-view route and deferred-close/cleanup tests |
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
| `src/select.c:generateWithRecursiveQuery` and recursive destination routing | `compileRecursiveCteSelect`, bounded `compileMultipleRecursiveCtes`; `OpenFifo`/`FifoInsert`/`FifoShift`; `OpenPriorityQueue`/`PriorityInsert`/`PriorityShift`; typed sorter materialization | Public recursive conformance: FIFO, all-history UNION, ORDER priority, LIMIT/OFFSET, 20k iterative/lifecycle/control stress, plus two distinct recursive declarations composed through a direct-projection cross join and output ORDER BY with source-shaped explicit collation/direction/NULL flags; producer materialization uses a zero-field stable key rather than comparing payload values. Broader/reused consumers reject temporarily. |
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
| Partial predicate usability | `src/where.c:whereUsablePartialIndex` 3700-3730 and call in the index loop near 4125; `src/expr.c:sqlite3ExprIsInteger` 2899+, `sqlite3ExprImpliesExpr` 6847-6871, `sqlite3ExprIsNotTrue` 6774-6781, `sqlite3ExprIsIIF` 6793-6818, `exprImpliesNotNull` 6698-6845 | `schema.ts:IndexNode.partialWhere` becomes an immutable table-bound resolved expression; `where-plan.ts` proves every predicate AND conjunct from safe `WhereTerm`s. Initial proof is exact structure, index-predicate-side `pE2` OR (either arm), qualifying query-side `pE1` resolved inline-IIF function identity (ASCII-case-insensitive registered `iif` or built-in alias `if`, including upper-case spellings) or one-pair searched-CASE condition (exactly two args/absent ELSE, or exactly three args with pinned not-true ELSE: NULL, FALSE, or integer AST recursively decoded as zero including decimal/hex literals (parentheses parse-discarded) and nested UPLUS/UMINUS; never REAL zero at any such unary depth, TEXT zero, parameters under the no-parse-context call, CAST/arithmetic constant expressions, variadic IIF, simple/multi-WHEN CASE, or TRUE/nonzero ELSE), and only source-enumerated NOT-NULL branches (including query-side OR only when both arms prove non-NULL). Unknown is false/fallback, never acceptance. |
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
