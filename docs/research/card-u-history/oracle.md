# Native oracle architecture

Status: **Stage 2 bounded implementation**. The checked-in development-only build verifies the pinned source identity and profile; fixture generation publishes eight immutable hashed databases; and an executable first native tranche covers close-v2 lifecycle through `close-1.4.4`, representative tails/errors, bind names/int64/reset, metadata/types, all database encodings, and read-only rows. A development-only UTF-8 JSONL subprocess now executes the bounded `hello/open/prepare/bind/step/reset/clearBindings/finalize/close` sequence with monotonic handles, exact integer/text/blob/REAL row tags, copied tails, and path rejection. It is intentionally not yet the complete closed union below (notably prepare16, metadata/error/file operations remain direct-harness-only). The runtime SQL engine remains unimplemented: the TS lane now completes real public
Fetch/open, then reports `unimplemented-temporary` at the genuine public
`Connection.prepare()` boundary without SQL credit.

## Window evidence sidecar

The window tests-before-port gate is a direct C-API sidecar, not an extension of
the closed JSONL request union and never a runtime backend. Its immutable spec and
captured expectation are `test/conformance/cases/stage3-window.spec.json` and
`stage3-window.json`. Reproduce them only with the manifest-verified library:

```sh
tools/oracle/build.sh
npm run test:conformance:window:native
npm run test:conformance:window
```

Capture fails before setup on source-ID/version mismatch and retains typed INTEGER,
REAL bits, NULL, UTF-8 text bytes, BLOB bytes, metadata, prepare-versus-step error
phase, reset/rebind/finalize and progress cancellation. The manifest gate also
hashes the pinned archive and each complete upstream setup-assertion body, rebuilds
the credited setup SQL from those bodies, and verifies the `reset_db` boundary for
`window1-6.3`; this makes the 10/10 credit include upstream state provenance rather
than SQL text alone. UTF-16le/be companions set
the database encoding before schema setup. Native success is native evidence only:
all 29 TS entries remain unattempted and zero-credit. The bounded 10 upstream plus
19 companion entries are not an exhaustive window-suite claim. Byte/work/row,
deadline and yield controls are explicitly source-only/no-credit because the
native C API cannot faithfully observe project-private controls; progress-handler
cancellation is separately captured.

## Boundary and mandatory profile

The oracle is a C subprocess linked directly to the SQLite source selected by
`reference/sqlite/manifest.json`. Test and fixture tools may launch it; runtime
source, browser bundles, and published artifacts must not import or contain it.
Fixture setup may write in a fresh directory, but the TS lane only receives a
closed, sidecar-free immutable main database. Protocol tests must cover exact schema
validation plus immediate legacy/v2 close, BUSY legacy close, v2 zombie creation,
access through a zombie-owned statement, and final-statement zombie cleanup. The
last two must demonstrate that no diagnostic sampling dereferences the zombie db.
The zombie-prepare test additionally verifies its wrapper diagnostic comes only
from the returned `SQLITE_MISUSE` plus `sqlite3_errstr`, with `errorAfter:null`.

Before accepting any case the `hello` reply must prove:

- version 3.53.4, version number 3530400, and exact source ID
  `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`;
- `SQLITE_ENABLE_COLUMN_METADATA` and `SQLITE_ENABLE_MATH_FUNCTIONS` are present;
- JSON (`json('[1]')`), math (`sqrt(9)`), prepare16, UTF-8/UTF-16le/UTF-16be
  database creation, floating point, origin metadata, and modern autoreset probes
  pass; and
- no `SQLITE_OMIT_JSON`, `SQLITE_OMIT_UTF16`, `SQLITE_OMIT_FLOATING_POINT`, or
  `SQLITE_OMIT_AUTORESET` is present.

A missing identity/capability is a failed run, never a skip. Every case starts in a
clean case directory and inherits no database, journal, WAL, or oracle process.

## Framing, primitive types, and validation

Transport is UTF-8 JSON Lines on stdin/stdout. Each line is one object. Standard
JSON duplicate member names, unknown members, non-integer JSON numbers, invalid
base64/hex/UTF-8, and values outside stated ranges are protocol errors. `seq` is a
safe integer in `0..9007199254740991`, strictly increases, and is echoed. `u32` is
`0..4294967295`; `Handle` is a positive safe integer allocated monotonically and
never reused in a process.

```ts
type Schema = "jsqlite-oracle/1";
type Bytes = { encoding: "base64"; bytes: number; data: string };
type DbEncoding = "UTF-8" | "UTF-16le" | "UTF-16be";
type Storage = "null" | "integer" | "real" | "text" | "blob";
type ErrorSnapshot = {
  primaryCode: number;                 // sqlite3_errcode(db)
  extendedCode: number;                // sqlite3_extended_errcode(db)
  messageUtf8: Bytes;                  // copied sqlite3_errmsg(db)
};
type DirectDiagnostic = {
  source:"sqlite3_errstr";
  messageUtf8:Bytes;                   // copied sqlite3_errstr(resultCode)
  tclWrapperUtf8:Bytes;                // exact "(<decimal>) <message>" adaptation
};
type DirectStatus = {
  resultCode: number;                  // exact return from a result-code API
  primaryCode: number;                 // resultCode & 0xff, not sampled db state
  directDiagnostic:DirectDiagnostic|null; // non-OK direct result only; no db access
  errorAfter: ErrorSnapshot|null;      // only where the provenance table permits
};
type AccessorStatus =
  | { sampled:"after-accessor-live"; error:ErrorSnapshot }
  | { sampled:"unavailable-owner-zombie"; error:null };
type SqlValue =
  | { kind: "null" }
  | { kind: "integer"; decimal: string } // canonical -2^63..2^63-1
  | { kind: "real"; ieee754be: string }  // exactly 16 lowercase hex digits
  | { kind: "text"; utf8: Bytes; databaseEncoding: DbEncoding | null }
  | { kind: "blob"; value: Bytes };
type BindValue =
  | { kind: "null" }
  | { kind: "integer"; decimal: string }
  | { kind: "real"; ieee754be: string }
  | { kind: "text"; value: Bytes; inputEncoding: "UTF-8"|"UTF-16le"|"UTF-16be" }
  | { kind: "blob"; value: Bytes };
```

`Bytes.bytes` must equal decoded base64 length. Text bytes are explicit and may
contain NUL. Bind text must be well-formed in its named encoding and is passed with
its explicit byte length (not `-1`); fixture SQL and UTF-8 prepare SQL must be well-formed UTF-8; the closed
`prepare16` rules below govern its bytes. REAL bits are copied with `memcpy`, converted to/from network-order hex, and
never parsed through a JSON number. This preserves integral REAL, signed zero,
subnormals, and infinities. Any NaN bit pattern is accepted by `bind`; native
`sqlite3_bind_double`/`sqlite3VdbeMemSetDouble` makes its observed SQL value NULL.

NULL, empty TEXT, and empty BLOB are distinct tags even when native pointers are
null. Ordered collections are arrays, preserving duplicate column names. Text
results contain exact `sqlite3_column_text` bytes and `sqlite3_column_bytes`; raw
on-disk text bytes belong to fixture evidence, not a fabricated column API value.

## Closed request union

Every request is `{schema:Schema, seq:number}` intersected with exactly one member:

```ts
type RequestBody =
 | { op:"hello"; manifest:{version:string; versionNumber:number; sourceId:string} }
 | { op:"open"; path:string; flags:"readonly"|"readwrite-create"; uri:boolean }
 | { op:"close"; db:Handle; mode:"legacy"|"v2" }
 | { op:"prepare"; db:Handle; sql:Bytes; byteLimit:number }
 | { op:"prepare16"; db:Handle; sql:Bytes;
     inputEncoding:"UTF-16le"|"UTF-16be"; byteLimit:number }
 | { op:"bind"; stmt:Handle; index:number; value:BindValue }
 | { op:"clearBindings"; stmt:Handle }
 | { op:"step"; stmt:Handle }
 | { op:"columnAccess"; stmt:Handle; column:number;
     access:"initial"|"int64"|"double"|"text"|"blob" }
 | { op:"statementMetadata"; stmt:Handle }
 | { op:"parameterMetadata"; stmt:Handle }
 | { op:"connectionError"; db:Handle }
 | { op:"reset"; stmt:Handle }
 | { op:"finalize"; stmt:Handle }
 | { op:"execSetup"; db:Handle; sql:Bytes }
 | { op:"fileSnapshot"; path:string };
```

For UTF-8 `prepare`, `byteLimit` is `-1` or `0..sql.bytes`. `prepare16` is
native-only: `sql` must have an even byte length, decode as well-formed UTF-16 in
`inputEncoding`, contain no BOM, and end with one U+0000 code unit when `byteLimit`
is `-1`. Its nonnegative `byteLimit` is an even byte count in `0..sql.bytes`.
The harness records host endianness in `hello`; selected `capi3c-2.*` requests use
that matching UTF-16 encoding, remove no bytes, and call `sqlite3_prepare16_v2`
directly without byte swapping. Thus the adaptation matches upstream Tcl's native-
endian `encoding convertto unicode`. A mismatched selected encoding is a failed
case/profile, not an implicit conversion. Bind indexes are positive u32; columns
are u32. Paths are relative normalized paths beneath the process case root—no
absolute path, `..`, symlink escape, or NUL. `readwrite-create` and `execSetup` are
admitted only when the process was started with `--fixture-mode`.

## Closed response union

A response is `{schema,seq}` plus either `{outcome:"protocol-error", error:{message:string}}`
or `{outcome:"ok", result:ResultBody}`. Protocol errors terminate after replying.
Harness/self-check failures terminate nonzero and do not produce case observations.
**SQLite non-OK codes are normal typed results**, not envelope errors; this allows
expected BUSY/MISUSE/SQL errors to be asserted without ambiguity.

```ts
type Metadata = {
  ordinal:number; name:Bytes; declaredType:Bytes|null;
  database:Bytes|null; table:Bytes|null; origin:Bytes|null;
};
type Parameter = { index:number; name:Bytes|null };
type ColumnObservation = {
  ordinal:number; initialType:Storage; value:SqlValue;
};
type Conversion =
 | { access:"initial"; initialType:Storage; value:SqlValue }
 | { access:"int64"; value:{kind:"integer";decimal:string} }
 | { access:"double"; value:{kind:"real";ieee754be:string} }
 | { access:"text"; value:{kind:"null"}|{kind:"text";utf8:Bytes} }
 | { access:"blob"; value:{kind:"null"}|{kind:"blob";value:Bytes} };

type ResultBody =
 | { op:"hello"; sourceId:string; version:string; versionNumber:number;
     compileOptions:string[]; probes:Record<string,true>; hostEndian:"little"|"big";
     compiler:string; os:string; arch:string; oracleSha256:string }
 | { op:"open"; status:DirectStatus; db:Handle|null; databaseEncoding:DbEncoding|null }
 | { op:"close"; status:DirectStatus; destroyed:boolean; zombie:boolean }
 | { op:"prepare"; status:DirectStatus; stmt:Handle|null; tailOffsetBytes:number;
     tail:Bytes|null }
 | { op:"prepare16"; status:DirectStatus; stmt:Handle|null;
     tailOffsetBytes:number; tail:Bytes|null;
     tailEncoding:"UTF-16le"|"UTF-16be" }
 | { op:"bind"|"clearBindings"|"reset"; status:DirectStatus }
 | { op:"step"; status:DirectStatus; step:"row"|"done"|"error";
     row:ColumnObservation[]|null }
 | { op:"columnAccess"; status:AccessorStatus; column:number;
     observation:Conversion|null }
 | { op:"statementMetadata"; status:AccessorStatus; columns:Metadata[] }
 | { op:"parameterMetadata"; status:AccessorStatus; parameters:Parameter[] }
 | { op:"connectionError"; snapshot:ErrorSnapshot }
 | { op:"finalize"; status:DirectStatus; destroyed:true }
 | { op:"execSetup"; status:DirectStatus }
 | { op:"fileSnapshot"; bytes:number; sha256:string;
     sidecars:[]; databaseEncoding:DbEncoding };
```

`Record<string,true>` in `hello` is not open-ended behavior: required keys are
exactly `json`, `math`, `prepare16`, `utf8`, `utf16le`, `utf16be`, `floatingPoint`,
`columnMetadata`, and `autoreset`; no others are allowed. All other unions are
closed.

Status provenance is operation-specific; the implementation must not infer a
sampling rule merely from the presence of a handle:

| Operation | `resultCode` provenance | diagnostic provenance |
|---|---|---|
| open | direct `sqlite3_open_v2` return | sample `errorAfter` only when SQLite returned a non-null live db pointer; otherwise null |
| prepare, prepare16, bind, clearBindings, step, reset, execSetup | direct named result-code API return | sample `errorAfter` immediately only when the owner db is live; null when a statement owner is zombie or prepare targets a zombie |
| legacy close | direct `sqlite3_close` return | on BUSY only, sample `errorAfter` because the db remains live; on OK null because the call destroyed it |
| close-v2 | direct `sqlite3_close_v2` return | always null: OK may destroy immediately or make a zombie, and neither permits a safe general post-call sample |
| finalize | direct `sqlite3_finalize` return | always null: it destroys the stmt and may perform final zombie-db destruction |
| column/statement/parameter accessor | no synthesized C return code | copy the accessor value, then sample owner error only when owner is non-zombie; otherwise `unavailable-owner-zombie` |
| connectionError | no direct status | non-destructively sample all three fields from the named live, non-zombie db |

The harness captures ownership before a destructive call but never dereferences a
db or stmt afterward merely to populate diagnostics. Successful immediate close and
final-statement zombie cleanup therefore contain no invented message or extended
code. Accessor null/value results retain native ambiguity (for example allocation
failure); `AccessorStatus` supplies the only safe contemporaneous error snapshot and
never calls a value accessor a result-code API. `connectionError` is admitted only
for a known live, non-zombie db. Prepare failure has `stmt:null`,
`tailOffsetBytes:0`, and `tail:null`; success computes offset by pointer subtraction
inside submitted bytes. UTF-8 returns the copied suffix. `prepare16` reports a byte
offset (never code units), verifies it is even and in range, and copies the suffix
in the same submitted encoding. For `byteLimit:-1`, the copied wire tail excludes
the final U+0000 terminator, matching the Tcl `utf8` helper that strips it; an empty
tail is zero bytes. No C pointer is exposed. Step maps only
`SQLITE_ROW`/`DONE` to row/done and all other codes to error. A row is snapshotted
with `sqlite3_column_type` first for every column, then the accessor matching that
initial type; accessors copy bytes before reply.

`columnAccess` is required even though step includes a convenient row snapshot. It
operates on the current live row and calls the named native accessor at request
time. Thus `close-1.3.2` performs step, close-v2, **then** `columnAccess(text)`; it
does not reuse the earlier copy. `initial` must be requested before any converting
accessor if its value is to be portable. Native `column_type` after conversion is
undefined and is never an expected value. C pointer addresses/destructors are never
transported; handles and copied bytes are deliberate safe adaptations.

## Handle state and admission

Open success allocates a db ID; prepare success with a nonempty statement allocates
a stmt ID owned by that db. Failed operations allocate nothing. Unknown/destroyed
IDs are protocol errors. SQLite-valid misuse on a known live/zombie handle is a
SQLite result. A current row survives close-v2; existing statements may step and
access it, while new prepare returns SQLITE_MISUSE. Legacy close BUSY leaves the db
open. Successful close destroys it; close-v2 with dependents marks zombie and final
statement destruction destroys the db. Finalize destroys the stmt even when its
saved code is non-OK. Reset invalidates the row, retains binds, and reports the
saved code; a second reset before step is valid and returns OK. Clear-bindings does
not reset. Sequences reset before re-execution; repeated step after DONE/error is
not used as a portable expected assertion despite the required modern autoreset
profile.

## Case protocols: bounded executable schema and future full schema

The checked-in executable bounded TS schema is `jsqlite-ts-cases/1` in
`test/conformance/cases/stage2-ts.json`. Each of its 47 records has an exact case
ID, `upstream` or `no-credit-companion` classification, fixture ID, ordered setup
and operations, and expected temporary-unsupported `JSQLiteError` shape.
`run-ts.mjs` starts the tokenized fixture bridge, invokes the singular
`public-api-adapter.mjs` through the repository's direct-TypeScript test mode,
records the exact attempted operation index/key, lists later operations as not
attempted, and validates exact-once/zero-credit accounting. Public `openFixture`
now completes real loopback Fetch for every case; each sequence stops at operation
1 (`prepare`) with the genuine public temporary-unsupported error.
`ts-accounting.test.mjs` rejects synthetic operation-0 unsupported results as well
as duplicate, missing, malformed, and incorrect-suffix observations.

The richer schema below is the normative future expansion for cases that can
continue beyond the first unsupported operation; no claim is made that the bounded
consumer accepts every field below yet.

`docs/CONFORMANCE.md` inventories assertions. The future full machine file uses
this closed schema:

```ts
type Ref = { file:string; id:string; occurrence:number }; // occurrence is 1-based
type Lane = "oracle"|"ts";
type Disposition = "required"|"unimplemented-temporary"|"excluded-no-credit";
type Capability = "always"|"utf16"|"columnmetadata"|"non-asan";
type OracleOperation = { key:string; request:RequestBody; save?:string };
type TsValue =
 | { js:"null" }
 | { js:"bigint"; decimal:string }
 | { js:"number"; ieee754be:string }
 | { js:"string"; value:string }
 | { js:"uint8array"; value:Bytes };
type TsBindLiteral = TsValue | { valueRef:string };
type TsRequestBody =
 | { op:"openFixture"; fixture:string }
 | { op:"close"|"closeDeferred"; db:string }
 | { op:"prepare"; db:string; sql:string }
 | { op:"bind"; stmt:string; indexOrName:number|string; value:TsBindLiteral }
 | { op:"clearBindings"|"step"|"reset"|"finalize"; stmt:string }
 | { op:"column"; stmt:string; column:number }
 | { op:"columnType"; stmt:string; column:number }
 | { op:"columnInteger"|"columnReal"|"columnText"|"columnBlob";
     stmt:string; column:number }
 | { op:"columnMetadata"; stmt:string; column:number }
 | { op:"columnCount"|"parameterCount"; stmt:string }
 | { op:"parameterName"; stmt:string; index:number }
 | { op:"parameterIndex"; stmt:string; name:string }
 | { op:"statementMetadata"|"parameterMetadata"; stmt:string };
type TsMetadata = { ordinal:number; name:string; declaredType:string|null;
  database:string|null; table:string|null; origin:string|null };
type TsParameter = { index:number; name:string|null };
type TsErrorKind = "sqlite"|"transport"|"cancelled"|"timeout"|"limit"|
  "misuse"|"unsupported"|"internal";
type TsError = { name:"JSQLiteError"; kind:TsErrorKind; message:string;
  code:number|null; extendedCode:number|null;
  unsupportedClassification:"temporary"|"permanent"|null };
type TsResultBody =
 | { op:"openFixture"; db:string }
 | { op:"close"|"closeDeferred"; closed:boolean; deferred:boolean }
 | { op:"prepare"; stmt:string|null; tailOffsetBytes:number; tail:string }
 | { op:"bind"|"clearBindings"|"reset"|"finalize"; completed:true }
 | { op:"step"; state:"row"|"done" }
 | { op:"column"; column:number; value:TsValue }
 | { op:"columnType"; column:number; storage:"null"|"integer"|"real"|"text"|"blob" }
 | { op:"columnInteger"|"columnReal"|"columnText"|"columnBlob";
     column:number; value:TsValue }
 | { op:"columnMetadata"; column:TsMetadata }
 | { op:"columnCount"|"parameterCount"; count:number }
 | { op:"parameterName"; index:number; name:string|null }
 | { op:"parameterIndex"; name:string; index:number }
 | { op:"statementMetadata"; columns:TsMetadata[] }
 | { op:"parameterMetadata"; parameters:TsParameter[] };
type TsResponse =
 | { outcome:"return"; result:TsResultBody }
 | { outcome:"throw"; error:TsError };
type TsEquals = null|boolean|string|number|TsValue|TsError|TsMetadata|TsParameter
  | TsResultBody|TsResponse|TsValue[]|TsMetadata[]|TsParameter[]|string[]|number[];
type TsOperation = { key:string; request:TsRequestBody; save?:string };
type OracleExpected = { ref:Ref; disposition:Disposition; capability:Capability;
  operationKey:string|null; select:string|null; equals:unknown|null;
  adaptation:string|null; exclusion:string|null };
type TsExpected = { ref:Ref; disposition:Disposition; capability:Capability;
  operationKey:string|null; select:string|null; equals:TsEquals;
  adaptation:string|null; exclusion:string|null };
type OracleLane = { lane:"oracle"; setup:OracleOperation[];
  operations:OracleOperation[]; expected:OracleExpected[] };
type TsLane = { lane:"ts"; fixture:string|null; literals:Record<string,TsValue>;
  setup:TsOperation[]; operations:TsOperation[]; expected:TsExpected[] };
type Case = { caseKey:string; lanes:[OracleLane,TsLane] };
```

`key` and `save` match `[A-Za-z][A-Za-z0-9_-]*` and are unique per case. Within each lane, `key`/`save` namespaces and handle resolution are independent.
Oracle handles use `{"$ref":"name"}` and resolve only to a prior saved non-null
native Handle. TS string handles resolve only to prior saved public adapter objects. A
`TsBindLiteral.valueRef` matches `[A-Za-z][A-Za-z0-9_-]*` and resolves only to a
named immutable `TsValue` in `TsLane.literals`; literal keys obey the same key
regex and it never references an expected output. Literal decimal, bit-string, and byte validation is identical to
the corresponding lossless oracle primitives. The TS adapter catches every public
exception and emits exactly `TsResponse`: success is `outcome:return`; a thrown
`JSQLiteError` is copied field-by-field into `TsError`, while any non-JSQLiteError
is a failed runner rather than an observation. Exactly `kind:"sqlite"` has non-null
`code` and `extendedCode`; all other kinds have both null. Exactly
`kind:"unsupported"` has non-null `unsupportedClassification`; every other kind
has it null. Handles are opaque manifest strings,
never serialized JS objects.

Every TS operation has exactly the matching `TsResultBody.op`; mismatches fail the
runner. `step` deliberately carries no row snapshot because public columns are read
by subsequent operations. `column`, `columnType`, every typed column operation,
`columnMetadata`, `columnCount`, `parameterCount`, `parameterName`, and
`parameterIndex` invoke the identically named public method/property directly;
they are never inferred from another result or aggregate metadata. Column indexes
are zero-based; parameter-name indexes are positive; invalid representations are
captured as public misuse, while SQLite-origin range errors remain sqlite.
`parameterIndex` returns observed zero for an absent name. Typed column results are
restricted respectively to bigint-or-null, number-or-null, string-or-null, and
Uint8Array-or-null `TsValue` tags; the adapter rejects a mismatched tag as runner
failure. `columnType` returns the initial storage scalar and therefore remains
stable after conversion calls. Prepare tail is the public JS suffix and its
UTF-8 byte offset. Metadata and parameter arrays preserve order and duplicate
names. `TsValue` is a **TS adapter codec**, not a native SQL value: it serializes
public bigint as canonical decimal, public number via copied binary64 bits, public
string as JSON Unicode text, copied `Uint8Array` as `Bytes`, and null distinctly.
This preserves infinities and signed zero without asking JSON numbers to carry them.

`select` is a restricted JSON Pointer into the matching lane response (RFC 6901; no
wildcards). Oracle `equals` uses oracle wire values; TS `equals` is the closed `TsEquals`
union and must equal the selected JSON subtree of `TsResponse`. JSON `number` in
`TsEquals` is restricted to safe integers used for counts/offsets/codes; public
SQLite REAL values always use `TsValue` binary64 bits. Every selected `(file,id,occurrence,lane)` has exactly one
expected record in its lane. The same Ref may point to different operation keys and
result shapes across lanes. Oracle-only mechanics use an empty TS operation list and a TS expectation with
`disposition:"excluded-no-credit"` plus null operation/select/equals; the runner never sends oracle JSONL to the TS adapter. Global
fixture generation is outside `Case`: a fixture name resolves through the hashed
fixture catalog; only the oracle fixture builder may write, while `openFixture`
opens its immutable sidecar-free artifact. Duplicate IDs therefore remain distinct. An assertion may be
required in the oracle and adapted/unimplemented or excluded in TS without mixing
denominators. Summary counts are by lane and disposition; excluded and
unimplemented never count as passes.

## Immutable fixture catalog contract

The repository-owned fixture root `test/fixtures/` is the only fixture namespace.
`CURRENT.json` atomically selects one immutable generation directory; the selected
`generations/<generationId>/catalog.json` has this closed schema:

```ts
type FixtureId = "empty"|"close"|"bind"|"meta"|
  "encoding-utf8"|"encoding-utf16le"|"encoding-utf16be"|"readonly";
type FixtureEntry = {
  id:FixtureId;
  specPath:string;                 // exact repository-relative JSON spec below
  specSha256:string;               // 64 lowercase hex
  setupKey:"EMPTY"|"CLOSE"|"BIND"|"META"|"ENC-UTF8"|
    "ENC-UTF16LE"|"ENC-UTF16BE"|"RO";
  databaseEncoding:"UTF-8"|"UTF-16le"|"UTF-16be";
  artifactPath:string;             // generation-relative generated/<id>.db
  bytes:number;                    // positive safe integer
  sha256:string;                   // 64 lowercase hex of closed main file
  sidecarFree:true;
  immutableReadonly:true;
  source:{ version:string; versionNumber:number; sourceId:string;
    archiveSha256:string };
  profile:{ profileSha256:string; oracleSha256:string;
    compileOptions:string[]; hostEndian:"little"|"big" };
};
type FixtureCatalog = { schema:"jsqlite-fixtures-v1";
  generationId:string; entries:FixtureEntry[] };
type CurrentFixtureGeneration = { schema:"jsqlite-fixture-current-v1";
  generationId:string; semanticCatalogSha256:string };
```

There is exactly one entry and one distinct artifact per `FixtureId`; no sharing is
selected because the schemas/rows or encoding observations differ. Specs are
closed declarative JSON (not free SQL): database encoding, ordered table definitions
(column names and declared types), ordered literal `SqlValue` rows, indexes, and
`userVersion:0`; extra members are rejected. `empty.json` has UTF-8 and no tables,
but is still a valid generated zero-schema SQLite database—not a zero-byte file or
runtime-created database. `close.json`, `bind.json`, `meta.json`, the three encoding
specs, and `readonly.json` encode exactly the setup records in CONFORMANCE.

The builder verifies the source manifest, builds/loads the recorded oracle profile,
validates the spec, creates each database in a fresh confined directory, sets
encoding before schema, performs only spec-described setup writes, closes every
statement and connection, and rejects `-journal`, `-wal`, and `-shm`. It reopens the
main file read-only, verifies `PRAGMA encoding`, schema, ordered rows/indexes, and
`PRAGMA integrity_check='ok'`, then records spec/artifact hashes, exact byte size,
source identity, profile hash/fields, and true invariants in a canonically ordered
catalog. Generated files and catalog must be regenerated together; hand-editing
catalog hashes is invalid.

Before any case executes, the runner reads `CURRENT.json` once, validates its exact
schema/ID/semantic hash, confines resolution to that immutable generation, and
rejects a missing generation/catalog or mismatch between
`semanticCatalogSha256` and SHA-256 of the catalog's canonical semantic projection.
The selector never hashes full provenance-bearing catalog bytes. It then rejects
duplicate/unknown IDs, noncanonical, absolute, symlinked or escaping paths,
undeclared/missing files, spec/hash/size/source/profile mismatch,
false invariants, wrong encoding/schema/rows, or any sidecar adjacent to an
artifact. It opens a private immutable byte copy through the public API and never
writes the catalog artifact. Every non-null `TsLane.fixture` and every
`openFixture.fixture` must equal the lane's one `FixtureId`, resolve to exactly one
entry, and have the setup key required by that Ref. No selected TS lane uses
`fixture:null`; null is reserved for future cases that provably require no database.
Run artifacts record fixture ID, semantic catalog hash, full catalog byte hash,
artifact hashes, and current-run producer provenance.

### Development-only Fetch bridge

TS conformance exercises the unchanged public `open(string|URL|Request)` and its
normal Fetch streaming/length/format checks. `test/conformance/fixture-server.ts`
is a runner-owned loopback HTTP/1.1 server, never a runtime API or byte-open hook.
After catalog validation it binds an OS-assigned port on numeric `127.0.0.1` only,
waits for the listening event, and publishes a random per-run 256-bit lowercase-hex
token to the in-process runner (never a file). The sole route is
`GET /fixture/<token>/<percent-encoded-FixtureId>`. After strict decode, only one
catalog ID is accepted; extra segments, dot segments, query, duplicate encoding,
malformed escape, non-GET, and unknown ID return 404 without reading a file. HTTP
fragments are never transmitted: the runner must refuse to construct a fixture URL
with a fragment; server tests cover only request-target bytes actually received. It never maps caller text to a filesystem path.

A success response is 200 with `Content-Type: application/vnd.sqlite3`, exact
`Content-Length`, `Cache-Control: no-store`, `Content-Encoding: identity`, and the
already verified main-file bytes. It does not redirect, compress, transform,
synthesize ETags, accept ranges, expose directory listings, or serve specs,
catalogs, profiles, journals, WAL/SHM, or arbitrary files. The runner constructs a
`Request` for this URL, calls public `open`, and compares a server-side streaming
SHA-256 and byte count with the catalog after response completion; mismatch fails
the run. Each lane gets a fresh request and public connection.

Server startup/readiness precedes TS cases. Teardown closes keep-alive sockets,
stops accepting, awaits the close callback in `finally`, and is required on pass or
failure; a teardown failure fails the run. Protocol tests cover exact byte identity
(including chunk boundaries), headers/content length, unknown IDs, traversal and
encoding attacks, sidecar denial, method/non-2xx behavior, concurrent distinct IDs,
and teardown/port reuse. A package-boundary test proves fixture-server/generator/
native-oracle paths are absent from runtime exports and packed/published artifacts.
The loopback bridge is development-only but does test the ordinary public Fetch
acquisition contract; it grants no server product/API compatibility.

The selected binding is: prepare/error cases → `empty`; close-v2 and legacy busy
close → `close`; bind/value/type cases → `bind`; column/metadata/conversion cases →
`meta`; each encoding case → its matching `encoding-*`; read-only case → `readonly`.
This binding is normative and may not be substituted by a runner.

## Reproducible source checks and future build command

These source checks are runnable now from repository root:

```sh
python3 - <<'PY'
import hashlib,json,pathlib,zipfile
b=pathlib.Path('reference/sqlite'); m=json.loads((b/'manifest.json').read_text())
p=b/m['archive']; d=p.read_bytes()
with zipfile.ZipFile(p) as z: assert z.testzip() is None
assert len(d)==m['bytes']
assert hashlib.sha256(d).hexdigest()==m['sha256']
assert hashlib.sha3_256(d).hexdigest()==m['sha3_256']
r=b/'sqlite-src-3530400'
assert (r/'VERSION').read_text().strip()==m['version']
assert (r/'manifest.uuid').read_text().strip()==m['fossilCheckin']
print(m['sqliteSourceId'])
PY
```

Implementation must add these files before running the build command:

```text
tools/oracle/sqlite_oracle.c
tools/oracle/verify-source.py
tools/oracle/build.sh
tools/oracle/generate-fixtures.py
test/oracle/protocol.test.ts
test/oracle/generate-fixtures.test.ts
test/conformance/fixture-server.ts
test/conformance/fixture-server.test.ts
test/package-boundary.test.ts
test/conformance/cases/stage2-initial.json
test/conformance/runner.test.ts
test/fixtures/CURRENT.json
test/fixtures/generations/<generationId>/catalog.json
test/fixtures/spec/empty.json
test/fixtures/spec/close.json
test/fixtures/spec/bind.json
test/fixtures/spec/meta.json
test/fixtures/spec/encoding-utf8.json
test/fixtures/spec/encoding-utf16le.json
test/fixtures/spec/encoding-utf16be.json
test/fixtures/spec/readonly.json
test/fixtures/generations/<generationId>/generated/empty.db
test/fixtures/generations/<generationId>/generated/close.db
test/fixtures/generations/<generationId>/generated/bind.db
test/fixtures/generations/<generationId>/generated/meta.db
test/fixtures/generations/<generationId>/generated/encoding-utf8.db
test/fixtures/generations/<generationId>/generated/encoding-utf16le.db
test/fixtures/generations/<generationId>/generated/encoding-utf16be.db
test/fixtures/generations/<generationId>/generated/readonly.db
```

`tools/oracle/build.sh` has this runnable contract (no caller path repair): it
resolves `ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)`, requires
`WORK_ROOT=${SAIVAGE_CARD_WORK_ROOT:?}/oracle-build` under Saivage (or an explicit
`ORACLE_WORK_ROOT` outside it), deletes only that directory, invokes
`verify-source.py`, copies the verified extracted tree there, configures with
`CFLAGS="-O2 -g -DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_ENABLE_MATH_FUNCTIONS"`
and `--disable-shared`, builds `sqlite3.c sqlite3.h libsqlite3.a`, and compiles
`sqlite_oracle.c` with `-std=c11 -O2 -g -Wall -Wextra -Werror`, the same defines,
`-I$WORK_ROOT/build`, `libsqlite3.a`, and `-lm`. It finally runs:

```sh
tools/oracle/build.sh
"$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/sqlite-oracle" \
  --self-check "$PWD/reference/sqlite/manifest.json"
python3 tools/oracle/generate-fixtures.py \
  --manifest reference/sqlite/manifest.json \
  --profile "$SAIVAGE_CARD_WORK_ROOT/oracle-build/profile.json" \
  --oracle "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/sqlite-oracle" \
  --spec-dir test/fixtures/spec \
  --fixture-root test/fixtures
npm run test:oracle
npm run test:fixtures
npm run test:conformance:native
npm run test:conformance:ts
```

`generate-fixtures.py` accepts only those explicit inputs, verifies manifest and
profile source identity plus oracle binary hash/self-check, and validates all eight
specs. Generation is supported on POSIX local filesystems whose same-directory
`rename(2)` is atomic and whose file/directory `fsync` provides the documented
durability; the generator rejects Windows and detected network/nonconforming
filesystems rather than weakening the guarantee.

The CLI has exactly the five input flags shown and one output boundary,
`--fixture-root`; it derives staging, `generations/<computed-id>/catalog.json`,
generated artifact paths, and `CURRENT.json` internally. There is no caller-chosen
catalog/output path. Existing generation IDs are immutable: matching artifact bytes and canonical
semantic projection reuse the existing root without rewriting its producer
provenance, while any semantic/artifact difference fails before pointer update;
the current invocation's provenance is written to its run report.

`generationId` is semantic content identity, not producer-build identity. It is
`g-` plus SHA-256 of the canonical semantic projection containing schema version,
pinned SQLite version/source/archive identity, ordered spec path+hash+setup+encoding,
and ordered generated artifact path+length+SHA-256. Compiler, OS/architecture,
host endian, profile hash, and oracle binary hash are deliberately excluded from
this ID. The generator stages the complete immutable
`generations/.stage-<random>/` on the same mounted filesystem as `generations/`.
It invokes the oracle separately per spec, writes `generated/*.db` and
`catalog.json`, verifies every invariant, fsyncs every file, then fsyncs the staged
`generated/` and generation-root directories.

Publication uses this closed collision algorithm. If
`generations/<generationId>` is absent, it atomically renames the one complete
staged directory there and fsyncs `generations/`. If it is present, the generator
never renames over or mutates it. It fully validates the existing catalog's closed
schema, canonical encoding, producer provenance structure, semantic projection and
invariants; rejects symlinks and any undeclared file or directory; and reads every
declared artifact. It requires staged-versus-existing equality for canonical
semantic projection bytes and for every artifact's relative path, byte length,
SHA-256, and complete bytes. The only permitted difference is valid producer-only
catalog fields excluded from the semantic projection. On that difference it records
the current producer and both full-catalog audit hashes in the run report, deletes
the staged candidate, and reuses the untouched existing root. Any semantic mismatch,
generation-ID collision, invalid/noncanonical catalog or provenance, artifact
mismatch/corruption, missing or extra file, path/schema/invariant difference, or
sidecar fails closed before CURRENT is written.

Only after the immutable generation is durable does it create `CURRENT.json.new`
with generation ID and SHA-256 of the canonical semantic catalog projection, fsync it, atomically `rename(2)` it over
`CURRENT.json` in the same fixture-root directory, and fsync the fixture root. Thus
one atomic pointer switch selects both catalog and databases. A crash before the
switch leaves the prior generation selected (and may leave an unreferenced staged
or complete generation); a crash after it selects only the already durable complete
generation. Startup removes only `.stage-*` directories after proving they are not
selected. Old complete generations are retained; explicit GC may remove only an
unselected generation after validation and is never part of generation.

Caught failures remove staging and `.new` but never mutate the selected generation.
The supplied profile must hash-match the supplied oracle's self-check record and
must match pinned source identity, required compile options/capability probes, and
host endian observed by that oracle; stale or cross-wired inputs fail
deterministically. A producer's profile/oracle hash need not equal the checked-in
producer provenance when semantic verification is performed on another supported
host. Tests inject failure/crash at
each file write/fsync/rename boundary and prove `CURRENT.json` resolves either the
old or complete new generation, never a mixed set.

All JSON written by this tooling is canonical UTF-8: object keys sorted by Unicode
code-point order, arrays in declared order, no insignificant whitespace, safe
integers in shortest decimal form, JSON escaping only where required (lowercase
`\u` hex), and exactly one trailing LF. Hashes cover bytes excluding no fields.
The catalog retains full producer provenance (`profile` and oracle hashes/fields),
but its **semantic projection** is a separately serialized derived object with only
`schema:"jsqlite-fixture-semantic-v1"`, `generationId`, and, per FixtureId order,
ID/spec path+hash/setup/encoding/artifact path+bytes+SHA-256, sidecar/read-only
booleans, and pinned source version/versionNumber/sourceId/archiveSha256. Its bytes
use the canonical JSON rules above. `semanticCatalogSha256` is SHA-256 over exactly
those complete bytes including the trailing LF; it is not SHA-256 of
`catalog.json`, a textual redaction, or selected byte ranges. `generationId` is
recomputed from this projection with its `generationId` member omitted, avoiding a
self-hash, and must equal `g-` plus that SHA-256. CURRENT carries that resulting ID
and the hash of the complete projection (with ID present), so it is semantic and
host-independent. The runner validates full `catalog.json` schema and provenance,
derives this projection, checks both hashes/ID, and separately records SHA-256 of
full catalog bytes for audit only.

Ordinary `test:fixtures` and both conformance commands verify CURRENT, checked-in
artifact bytes, full catalog integrity, and its semantic projection; they do not
regenerate, bless, or require the current host's compiler/profile hash to equal the
recorded producer. They do require the pinned source/capability contract. Explicit
regeneration produces a reviewable immutable generation and pointer update.
Cross-host CI regenerates into an initially empty fixture root in a disposable copy
and requires byte equality for all eight `.db` files, equality of generation ID/CURRENT, and canonical byte equality
of the semantic catalog projection. Producer-only provenance may differ and is
recorded in the CI run artifact rather than compared as semantic output. A
canonical release job may update checked-in full provenance, but uses the same
semantic checks; no unspecified compiler path or command enters semantic identity.
Thus supported hosts can verify reproducibility without pretending their native
oracle binaries are byte-identical. A required generator contract test uses two
valid producer profiles with distinct compiler/OS/profile/oracle hashes but forced
identical fixture artifacts: generation ID, semantic projection bytes/hash,
CURRENT bytes, and DB bytes must be equal; full catalog provenance bytes/hash must
differ. Generating the second into a root already containing the first must reuse
the immutable generation without rewriting its catalog and must record the second
producer only in that run report; generating into an empty root may write its own
full catalog provenance while producing the same semantic identity and CURRENT.
Collision tests separately cover the permitted producer-only difference, artifact
same-hash guard via complete-byte comparison, artifact size/hash/byte mismatch,
semantic-ID collision, malformed/noncanonical or corrupted existing catalog,
corrupted/missing artifact, symlink/path violation, false invariant, and undeclared
extra file/directory; each forbidden case preserves CURRENT and the existing root.

These post-implementation commands intentionally fail by absence today; they are
not presented as current evidence. The script records command, compiler, OS/arch,
compile options, binary SHA-256, source/archive hashes, source ID, and probes in
`$WORK_ROOT/profile.json`. Builds never modify `reference/sqlite`.

Fixtures set `PRAGMA encoding` before first schema creation, close, reject `-wal`
and `-journal`, hash/copy, and reopen `SQLITE_OPEN_READONLY`; byte-swapping is
forbidden. Run artifacts at `test-results/conformance/<run-id>/run.json` contain
profile, fixture hashes, every request/reply, and per-reference lane result.

## Stable release milestone and alternatives

At Stage 2 completion, every release candidate, and before a baseline update,
fetch `https://www.sqlite.org/download.html`, parse the stable `sqlite-src-N.zip`
product row while ignoring “Pre-release Snapshots”, and record UTC check time,
version, size, and SHA3. A newer stable requires a separate coordinated manifest,
source-map, oracle, fixture, and outcome update—never a floating build. The page
checked 2026-09-13 still listed stable 3.53.4, 14,557,315 bytes, SHA3
`b834d474b9b393d85a9e3ee4cc11f1329e007e9376a424ee740796f5c4bda3a8`;
the newer artifact was explicitly pre-release.

CLI text and ordinary JSON scalars lose types, metadata, lifecycle, int64, and REAL
bits. In-process FFI exposes pointer/process hazards and risks becoming a runtime
backend. Protobuf/CBOR adds tooling without needed semantics. Closed tagged JSONL
is lossless, inspectable, and sufficient. Porting the entire corpus now would add
unnecessary complexity; the exact bounded tranche is in `CONFORMANCE.md`.
