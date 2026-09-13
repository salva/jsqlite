# SQLite source map

This is the progressive engineering index for the selected upstream SQLite
implementation. It is deliberately focused on the first public API tranche; it
is not a corpus inventory or an approved TypeScript API. Product scope remains in
[`SPEC.md`](SPEC.md), sequencing in [`PLAN.md`](PLAN.md), and translation rules
and open design questions in [`TRANSLATION.md`](TRANSLATION.md).

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
not enter runtime exports, browser bundles, or package artifacts. There is no
package manifest/configuration yet, so `.gitignore` establishes the current
boundary but future packaging must explicitly preserve it.

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

Stage 1 still must settle nullable access without conflating NULL with empty
TEXT/BLOB, value/error representation, column-type observation after conversion,
and cleanup/ownership behavior. An immutable initial-type field would be a stated
adaptation, not native post-conversion behavior.

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

## Bounded discrepancies and gaps

No engine exists yet. The Stage 1 API decisions above are contract completion, not
a compatibility claim. Stage 2 must translate and execute the mapped assertions;
later stages must implement Fetch, format/storage reading, parser/planner/VDBE,
SQLite conversions, automatic reprepare, bounded execution, and all specified
encodings. Numeric default limits need implementation evidence before publication.
Temporary gaps must throw `unsupported`; permanent exclusions remain only those in
SPEC.

C-only mutexes, allocators, destructor callbacks, raw pointers, writable-main-file
paths, and host extension surfaces are adaptation/omission candidates only after
checking their applicable read-only call paths. Required mutable private execution
state (sorters, ephemeral b-trees, registers, aggregates) is not excluded merely
because the main database input is immutable.
