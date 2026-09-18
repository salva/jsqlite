# SQLite-to-TypeScript Translation Guide

## Authority and use

Status: seed design for project refinement, not approved immutable requirements.
`docs/SPEC.md` owns owner product semantics and scope. This is the living
project-owned translation design entrypoint. `docs/PLAN.md` owns sequencing.
When authored in their appropriate stages, project documents own their named
surfaces. `docs/api.md` now owns the singular Stage 1 public API and
`docs/SQLITE_SOURCE_MAP.md` is the project-editable progressive source/test index.
Stage 1 established the public contract. The bounded Stage 2 milestone supplies a
pinned development-only native oracle, immutable fixtures, 38 upstream native
assertions plus 9 no-credit companions, and an executable per-case TS harness.
Stage 3 now implements bounded Fetch acquisition, format-3 validation and immutable
residency; known-root record/b-tree reading; SQLite-compatible schema text
conversion; generated-Lemon SQL tokenization/parsing and reduction structures; a
bounded immutable internal schema graph; shared Mem/value, scalar arithmetic,
built-in collation/comparison and packed/unpacked record-key foundations; and a
bounded prepared-SELECT compiler/program/VDBE. The admitted public surface now
includes documented no-FROM, ordinary-table, multi-source join, compound, and
grouped aggregate routes, with shared private-state limits and connection-wide
operation admission across running and suspended VM states. Bounded flattened,
coroutine, and materialized FROM-derived sources and immutable views are admitted,
as are the documented scalar, EXISTS, IN/NOT IN, and correlated expression-
subquery routes and their bounded compositions. This is not a general SQL engine:
CTEs, recursive CTEs, windows, writes, unsafe or unrepresented subquery shapes,
and other unmapped SELECT forms remain atomic typed temporary unsupported.
Historical tranche sections below are labeled as such and do not override this
current capability summary.

Source-backed facts below describe the selected upstream implementation. Proposed
TS defaults, examples and open questions are local engineering choices: the
project may revise them and applicable API contracts coherently with source/test
evidence, preserving owner scope. Imperative engineering wording describes the
seed's recommended approach, not additional owner mandates. No specific internal
class model or mapping is approved merely by installing this document.

Read the core and relevant notes at the next relevant planning/implementation/
review decision, not every turn. If this file changed or quoted context conflicts,
read the relevant current section using ordinary tools. Update this guide, mappings,
examples and affected contracts/tests together with a concise rationale/source
citation where useful; no decision ledger or universal verification pass is needed.
Ordinary technical edits need no operator approval, prompt edit or service restart.
Owner product boundaries still require owner authorization to change. The pinned
upstream archive is reference evidence, not content to rewrite to fit the design.

Use SQLite 3.53.4 from `reference/sqlite/manifest.json`, the single authority for
the selected archive, source ID, hashes, and retrieval metadata.
References below are paths/symbols in that archive; line numbers are orientation
for this pin, not a second source registry. The extracted development cache is
convenience only. Do not use previous JSQLite implementation or acceptance claims.

## Core: source facts and proposed engineering defaults

### Translate semantics, not C allocation syntax

Translate relevant pinned upstream structures, algorithms, and control branches by
default rather than designing a SQLite-like engine. Ordinary TypeScript objects,
arrays, typed byte buffers, `BigInt`, async execution, and browser-safe
representations are adaptations of that work, not exceptions to the translation
default. No general C heap/pointer emulator is required.
No native SQLite, C or WASM in the browser runtime; native development oracles
and fixture producers are separate and may perform fixture-setup writes.

Main database input remains immutable and read-only under SPEC. Removing main-file
writes, journaling and host extension APIs does **not** remove SELECT's mutable
private working state: ephemeral b-trees, sorters, automatic indexes, aggregate
state and temporary records can be necessary. Shared internal objects need not be
copied simply because public handles have single-owner JS-agent semantics.
Do not translate irrelevant fields merely to reproduce every upstream struct.
Justify omissions by the actual read-only call paths, not a field's name alone.

An **ALGORITHM SUBSTITUTION** is exceptional. Record a brief, concrete
TypeScript/browser/read-only rationale, comparison with the implementing upstream
routine, preserved observable behavior, and source-based tests in this guide,
`docs/SQLITE_SOURCE_MAP.md`, or a nearby code note. Technical Planner and Reviewer
approval is the normal project decision path; it does not create new human
bureaucracy. Owner approval is required only when a choice changes product scope,
observable guarantees, or exclusions.

The mutable audit at
[`reviews/translation-fidelity-2026-09-14.md`](reviews/translation-fidelity-2026-09-14.md)
records revision-labeled findings and evidence gaps. Verify it against current
work rather than freezing its baseline predictions into this guide.

### Numbers and semantic state

Proposed public/internal default: SQL signed 64-bit INTEGER and
rowid use `bigint`; REAL uses IEEE-754 `number`.
An integral-valued REAL is still REAL: never infer storage class with
`Number.isInteger`. `SqliteValue = null | bigint | number | string | Uint8Array` is the public
boundary union selected in Stage 1; REAL remains distinguishable from INTEGER by
JS type even when integral-valued.
Keep bounded offsets, page numbers and register indexes as numbers only where
their range and intermediate arithmetic are exact; document the relevant bound.
Do not truncate 64-bit masks through JS's 32-bit bitwise operators.

Translate overflow, shifts, coercion and affinity per operation. Addition's
overflow-to-REAL, casts, integer division, and bit operations are not one universal
wrap rule. `BigInt.asIntN(64, ...)` is appropriate only when the source operation
calls for that behavior. Follow `vdbe.c`, `vdbemem.c`, `util.c` and their callers.
`sqlite3VdbeMemSetDouble` (`vdbemem.c:1092`) turns NaN into NULL, not all nonfinite
numbers: infinities remain REAL. Do not normalize both away in an oracle adapter.

Mem may cache simultaneous representations. Preserve needed `MEM_IntReal`, text
encoding, subtype, aggregate context, ownership and lifecycle state; a five-way
public-value union alone cannot represent it (`vdbeInt.h:228-346`). Choose a clear
internal TS model from consuming operations, not a blanket mutually exclusive tag.
Preserve macro side effects, flag masks, shared numeric flag relationships and
union selection semantics. TS enums/objects must not silently alter bit patterns
or expression evaluation order; allocation-only C details need not survive.

### References, copies and lifetime

Map pointers by meaning: object identity/reference, byte slice with explicit
offset/length, register index, or result/out-parameter return. No single pointer
replacement fits all four. Preserve ordered identity and mutation sharing.
GC releases unreachable memory; it does not implement reset, finalize, page
borrowing, aggregate cleanup or row invalidation. Specify those at their owners.

Distinguish shallow copy, full value copy and move (`sqlite3VdbeMemShallowCopy`,
`sqlite3VdbeMemCopy`, `sqlite3VdbeMemMove` in `vdbemem.c`). Do not deep-clone object
graphs as a substitute for ownership. Borrowed internal buffers must remain valid
until their consumer finishes; copy where source lifetime or mutation requires it.
Proposed default: copy public bound/returned blobs rather than exposing borrowed
engine storage. **Stage 1 decision:** `docs/api.md` adopts that default: binding
copies byte input and each returned BLOB is a fresh caller-owned copy. This avoids
making page/register borrow validity part of the public surface while preserving
internal borrowed slices where their owner outlives use.

### Bytes, text and comparison

Use `Uint8Array`/`DataView` with explicit endian interpretation for file/record
fields, including signed integer serial types and IEEE REAL bits. Byte lengths,
JS UTF-16 code-unit counts and Unicode character counts are different quantities.
Preserve UTF-8, UTF-16le and UTF-16be database encodings; keep lengths and encoding
with raw text wherever upstream consumers need them.

NUL-termination requirements and embedded NUL behavior are operation-specific.
`utf.c` `READ_UTF8`, `sqlite3Utf8Read`, `sqlite3Utf8ReadLimited` and
`sqlite3VdbeMemTranslate` do not all have the same termination/invalid-input rules.
In particular SQLite accepts some legacy UTF-8 sequences that a WHATWG decoder
handles differently (`utf.c:145-225`). `src/internal/utf.ts` ports the complete
`sqlite3Utf8Trans1` lead groups, including the zero entries for `0xfe`/`0xff`;
`FF 80 80` therefore becomes U+FFFD while neighboring legacy `FD 80 80` becomes
U+1000, as independently captured from the pinned library. Do not assume `TextDecoder`, JS string
comparison, `localeCompare` or Unicode case folding implements SQLite semantics.
Use upstream collation/length/conversion routines and focused tests for the slice;
do not invent behavior where upstream explicitly leaves it undefined. For catalog
identity, `src/internal/sqlite-case.ts` translates `util.c:sqlite3StrICmp` with
`global.c:sqlite3UpperToLower`: only UTF-8 bytes for ASCII `A`-`Z` fold. Object
keys, duplicate detection, table/index links, primary-key links, and index-column
links all use that one helper; JavaScript Unicode `toLowerCase()` is forbidden.

### Execution and errors

Put asynchronous boundaries deliberately at acquisition and bounded execution
work. No hidden await inside a synchronous API. A yield must preserve Vdbe PC,
registers, cursors, pending result/error and byte borrows, with row validity and
overlapping-operation admission consistent with the API when authored. Do not
restart evaluation after a yield. Synchronous JS cannot observe a newly delivered same-agent abort
event while it monopolizes the event loop; describe cancellation honestly.

Preserve applicable primary/extended SQLite result codes and operation cleanup,
including reset/finalize after failure. Transport/CORS failures are not SQL errors.
Known resource checks and observable allocation failures can have typed errors;
do not promise to catch browser process termination or every host OOM. Impossible
internal states fail clearly, not as fabricated NULL, empty rows or success.

### Evidence and progressive decisions

For meaningful adaptations, cite upstream file/routine and a short reason near
the implementation and relevant test. Author concise progressive mapping/status
notes in `docs/SQLITE_SOURCE_MAP.md` as work needs them; no separate giant proof
inventory. Translate the relevant upstream assertions before each slice and compare actual TS behavior to the
pinned oracle. Oracle encodings must retain INTEGER/REAL, NULL/empty, raw blob and
text-encoding distinctions; no normalization that masks divergence.
Unimplemented behavior is a visible gap, never passing compatibility credit.

## Stage 3 storage-slice decisions

The first storage design and native fixture backlog are now specified in
[`file-format.md`](file-format.md) and
`test/conformance/cases/stage3-storage.json`. The acquisition slice now implements
bounded browser Fetch into the connection-owned `src/internal/storage.ts` owner,
which alone validates format-3 headers/geometry, provides immutable exact-offset
page reads and invalidates dependent internal operations/borrows on close. Public
open maps the owner's typed corruption/unsupported failures into `JSQLiteError`.
The read-only b-tree slice consumes that validated owner (with an internal/test
factory, never a public API) and now
implements an internal known-root consumer in `src/internal/btree.ts`: format-3
table/index interior and leaf traversal, signed rowids, first/last/next/previous and
boundary seek, local/overflow payload reconstruction, page/depth/cycle/count bounds,
and movement-invalidated borrows with owned payload copies. It is exercised across
all generated page sizes and database encodings; by itself it is not schema
discovery, SQL, or a public API. The first comparison-ready
record foundation is implemented internally in `src/internal/record.ts`: bounded
SQLite varints, exact signed serial INTEGER values, REAL source bits/class, NULL
and 0/1 constants, and borrowed encoding-tagged TEXT/BLOB slices. At this
historical storage-only checkpoint it intentionally did not decode text or
implement collations/record ordering. Later Stage 3 tranches now provide the
shared Mem/value and internal comparison/collation/record-key consumers without
changing that lower-level record decoder's role. At that historical checkpoint,
the parser/schema tranche consumed these primitives internally while resolver,
compiler, VDBE construction, and execution remained temporary unsupported; the
current bounded first-SELECT compiler/VDBE is documented in its later section.
The connection owns one complete
immutable byte array. Internal page/record slices are borrows of that owner's resident bytes; closing
invalidates storage reads, cursors, and cursor borrow accessors, while `payload()`
returns an owned copy that survives close. Checked JS `number` arithmetic is used
only for page geometry within safe-integer bounds, while rowids remain signed
`bigint`. `tableScanCursor` is the preserved lazy forward path. In contrast,
A superseded implementation of `tableCursor` and `indexCursor` recursively built a
complete ordered descriptor array before seek; pinned comparison showed that it
incorrectly fault-touched an invalid rightmost off-path child. See audit finding 3
and `work:///cards/card-d-e/processes/proc-8e3a81d062d3/stdout.log` versus
`work:///cards/card-d-e/processes/proc-01847f777fb9/stdout.log`. The committed
implementation translates page-local `sqlite3BtreeTableMoveto`/
`sqlite3BtreeIndexMoveto` descent for seek and retains only the positioned
descriptor. Complete first/last/next/previous movement defers
full ordered traversal until one of those operations is requested, so cursor
construction and seek no longer fault-touch or allocate descriptors for unrelated
subtrees. Source-based table/index exact/inexact GE/LE tests, off-path fault
isolation, selected-path corruption, and seek-time path-depth limits pass. The
existing lazy forward scan, record/overflow, owner/close, and borrow-generation
behavior remains covered.
Overflow traversal detects range errors, truncation, duplicate/cyclic pages and a
configured page limit. Raw schema text conversion now uses a source-derived TypeScript subset of `utf.c` (`READ_UTF8` and the UTF-16 conversion loops in `sqlite3VdbeMemTranslate`) for UTF-8, UTF-16le, and UTF-16be. It deliberately preserves SQLite's legacy handling (including standalone continuation bytes and accepted overlong values at or above U+0080), surrogate/noncharacter replacement rules, and UTF-16 odd-byte truncation rather than using WHATWG `TextDecoder`. Focused malformed/legacy vectors live in `test/schema/sqlite-utf.test.mjs`. At the public open boundary, shared storage corruption and unsupported
states map to `JSQLiteError`; the internal b-tree API retains internal format,
cursor-state, and configured-limit errors and makes no public SQL error promise.

These implemented storage decisions follow `btree.c:lockBtree` and applicable
page/cell/payload paths, `btreeInt.h`, `pager.c/h`, `pcache.c/h`, `util.c` varints,
and `vdbeaux.c` serial decoding. Record comparison/collations and SQL compilation/
execution remain mapped future work; text conversion and bounded internal schema
discovery are now implemented by the later tranche described below. Native fixtures cover every required page size, reserved=0, all three
encodings, exact int64 rowids, mixed serial classes, multilevel table/index trees
and overflow; malformed and future resource-limit cases are clearly labeled local
no-credit adaptations.

## Initial key-structure guidance

### Connection: sqlite3

Source: `sqliteInt.h:1669`, `main.c` `openDatabase`, `sqlite3Close`.
Retain ownership of statements, schema/backend references, limits, encoding and
applicable error state. Decide how the JS connection owns acquisition and
statement lifetimes under the future API, using source-derived close behavior
rather than assuming cascading finalization. C mutexes/lookaside allocation and
excluded callbacks are not automatically fields to emulate; internal shared identity still matters.

### Statement: Vdbe and Mem

Source: `vdbeInt.h:232,458`, `vdbe.c`, `vdbeapi.c` step/reset/finalize/bind/column
routines, `vdbeaux.c` `sqlite3VdbeReset`, `sqlite3VdbeFinalize`.
Keep program, registers, parameter storage, cursor slots, PC and result-row state
distinct. Reset retains bindings but invalidates the row; finalize destroys the
statement even when reporting its previous error. Decide register indexing and
suspension ownership before the first interpreter slice. Mem's conversion caches,
subtypes and accumulator state cannot be inferred from its public output value.

#### Mem consumer surface (decision for the values/VDBE slices)

This decision is pinned to SQLite 3.53.4 (the source ID in
`reference/sqlite/manifest.json`). Implement one internal `src/internal/mem.ts`
surface and make binding, record extraction, opcodes, comparisons/functions, and
public columns consume it. Do not introduce a second expression-value union.
`RawRecordValue` remains the lossless record decoder output and `SqliteValue`
remains the copied public boundary; both adapt through `Mem`.

The representation is an opaque mutable `Mem` class (or opaque interface plus
module functions), not a public type and not a numeric bit-mask API. Its logical
state is:

```ts
type MemNumeric =
  | { kind: "integer"; value: bigint }
  | { kind: "real"; value: number }
  | { kind: "int-real"; value: bigint };
type MemBytes = {
  kind: "text" | "blob";
  bytes: Uint8Array;                 // logical byte length is bytes.byteLength
  encoding: DatabaseEncoding;       // meaningful for text; UTF-8 for blob
  terminated: boolean;
  backing: "owned" | "borrowed" | "static";
  lifetime?: BorrowLifetime;
  zeroTail?: number;                 // blob-only deferred zero bytes
};
```

`Mem` additionally carries nullable `numeric` and `bytes` caches, the manifest
state (`null`, `numeric`, `text`, `blob`, or staged `aggregate`), `fromBind`,
`clearedNull`, optional byte subtype `0..255`, and a future-capable private
aggregate slot `{definition, context, cleanup}`. Aggregate and pointer-like state
must be representable so later function work does not require changing every
consumer, but host pointer binding remains outside the public API. The first Mem
implementation need not execute aggregates or pointer APIs.

The following invariants are checked at constructors and mutation boundaries in
development tests and are relied upon by consumers:

* `integer`, `real`, and `int-real` are mutually exclusive because upstream's
  union has one `u.i/u.r` slot. Any one may coexist with a **text** cache, but none
  may coexist with blob or SQL NULL. `int-real` is a REAL manifest value held
  exactly as `bigint`; it converts/stringifies as REAL (`44.0`), while integer
  affinity can promote it to INTEGER without a lossy number round trip. Never
  infer it from `Number.isInteger`.
* A text cache coexisting with numeric state is canonical text rendered **from**
  that numeric value, never the original text from which numeric affinity was
  parsed. This preserves the index-consistency invariant checked by
  `sqlite3VdbeMemValidStrRep`. A conversion which numerifies input either drops
  source text or regenerates canonical text before setting both caches.
* Text length is always an explicit byte length in its named UTF-8/UTF-16 encoding;
  embedded NUL is data. Terminator bytes, when materialized, are outside that
  length. UTF-16 odd lengths and conversion behavior follow `utf.c`/
  `sqlite3VdbeMemTranslate`, not JS string length. Blob has no text encoding
  semantics; its UTF-8 marker is only the upstream-compatible default. A deferred
  zero tail is blob-only, nonnegative, and included in logical size/limit checks.
* NULL has no numeric/text/blob cache. `clearedNull` is only a NULL modifier.
  Subtype validity is explicit and survives only operations whose upstream flag
  masks preserve `MEM_Subtype`; it is not silently attached to a public value.
  Aggregate state is exclusive with ordinary value state and cleanup runs exactly
  once on reset/replacement/release.
* Every integer is within signed int64. REAL stores the exact JS IEEE-754 value:
  setters map NaN to NULL and preserve signed zero and both infinities, matching
  `sqlite3VdbeMemSetDouble`. On-disk NaN remains visible in `RawReal` until the
  record-to-Mem adapter applies this setter; no JSON-number transport is allowed.

`Mem` exposes source-shaped operations rather than writable fields:
`setNull/setInt64/setDouble/setText/setBlob`, `applyAffinity`, `cast`,
`integerValue/realValue/textValue/blobValue`, `changeEncoding`, `makeWriteable`,
`shallowCopyFrom`, `copyFrom`, `moveFrom`, and `release`. Setters first release
dynamic/aggregate state. Full copy owns text/blob bytes. Shallow copy shares the
byte view and lifetime and marks the destination borrowed/static-like; it never
shares aggregate cleanup ownership. Move transfers all state and ownership, then
leaves the source valid NULL (the idiomatic TS replacement for upstream's
zeroed/undefined moved-from cell). Release/reset invalidates owned state and all
borrows issued by that cell. A borrowed page/record view carries a generation
token supplied by its storage/cursor owner; access after cursor movement, close,
or source replacement throws an internal lifetime failure rather than reading
stale bytes. `static` means immutable bytes whose explicit program/schema owner
outlives the statement, not process-lifetime C storage.

Adapters are deliberately directional:

* `memFromRawRecord(raw, lifetime)` borrows raw TEXT/BLOB slices, copies exact
  `bigint`, and calls `setDouble` for REAL (therefore SQLite on-disk NaN becomes
  SQL NULL). No eager text decode occurs.
* `memFromPublic(value, connectionEncoding, limits)` validates int64 and copies
  blobs. For a string it first validates well-formed JS UTF-16 (lone high or low
  surrogate is public `misuse`), strictly encodes Unicode scalars as UTF-8, then
  follows `vdbeapi.c:bindText`/`sqlite3_bind_text`: create copied UTF-8 text and
  immediately call the SQLite-derived encoding conversion for the connection's
  UTF-8, UTF-16le, or UTF-16be encoding. This is deliberately source-shaped rather
  than direct host UTF-16 storage or WHATWG replacement. Supplementary scalars use
  four UTF-8 bytes or one UTF-16 surrogate pair. Embedded NUL is data because the
  adapter supplies the explicit encoded byte length. Check configured limits
  against both complete source UTF-8 bytes and translated logical bytes, excluding
  terminators; excess is `limit`. NaN becomes NULL and infinities stay REAL. Bad
  int64 remains public `misuse`. The surrogate rule is a documented JS adaptation:
  unlike `prepare`'s exact-tail reason, it prevents silently binding replacement
  text where the API has no raw-byte spelling for the caller's ill-formed string.
* `memToPublicInitial` observes the captured initial manifest class and returns an
  owned JS string/fresh `Uint8Array`. Typed column adapters call the same conversion
  methods but do not change that captured class. This preserves the existing
  public blob-copy contract; no source evidence requires changing `docs/api.md`.

Conversion code ports `sqlite3AtoF`, `sqlite3Atoi64`, and the exact callers in
`vdbemem.c`; JS `Number`, `parseInt`, `parseFloat`, `TextDecoder`, and generic
`BigInt(text)` are not substitutes. The bounded internal implementation now lives
in `src/internal/mem.ts` ([[card:card-f-a-c]]) with direct cases in
`test/value/mem-numeric.test.mjs`: it preserves explicit UTF byte lengths,
int64 extrema/saturation, numeric-prefix versus affinity-full-input behavior,
INTEGER/REAL/IntReal class distinctions, signed zero and nonfinite REALs across
all five CAST affinities. Caller masks are operation-specific: non-forced
stringify/encoding retain numeric+TEXT caches; TEXT/BLOB casts clear numeric forms;
numeric affinity and numeric casts clear bytes but preserve subtype/from-bind bits
that lie outside `MEM_TypeMask`. New string-cache allocation clears those non-type
bits through the translated clear/resize path. SQL-level mapped cases remain zero credit until the VDBE
and public statement path invoke it. Expected value-domain conversions (including
non-numeric text becoming 0 for CAST) are results, not exceptions. Invalid API
input maps to `JSQLiteError(kind:"misuse")`; invalid column/bind indexes map to
SQLite `RANGE`; configured byte/work limits map to `limit`; malformed record/text
state maps to SQLite corruption at the storage boundary; an expired borrow or
impossible invariant maps to `internal`. Temporary missing consumers remain typed
`unsupported/temporary`. Host OOM is not promised to become a catchable SQLite
error.

Implementation order is executable and tests-first: (1) constructors/invariants,
int64 and NaN/infinity; (2) raw/public adapters and byte lifetimes/copy-move-reset;
(3) source-derived numeric parsers, stringify and encoding; (4) affinity/cast;
(5) binding/column and opcode/function consumers. `test/conformance/cases/stage3-mem.json`
contains a bounded `exactTranche`: executable TS entries have explicit setup,
read-only operation, typed expectation, prerequisites, and temporary disposition.
Write-dependent `bind.test` assertions are retained separately as native oracle/
fixture provenance and never require the TS runtime to prepare or execute INSERT,
DELETE, or other mutation. The in-scope int64 bind adaptation instead uses
`SELECT ?1, ?2, ?3, typeof(?1), typeof(?2), typeof(?3)`; a natively populated
immutable fixture can separately test record/public-column reading but is not TS
binding evidence. Public TEXT adaptations cover embedded NUL plus supplementary
and lone-surrogate input across all database encodings.
`test/conformance/mem-manifest.test.py` rejects wildcard/range placeholders,
verifies literal source IDs and multiplicity, pins source identity, enforces zero
credit, and rejects mutating SQL or mutation-dependent setup from executable TS
entries. The separately labeled `futureBacklog` is non-executable planning only.
No case gains compatibility credit until it executes through its stated read-only
TS adapter.
The oracle's tagged decimal integers, IEEE-754 hex, byte-counted text/blob, and
initial-versus-converted column observations are sufficient for ordinary Mem
results. Add an internal-only diagnostic operation (flags expressed as semantic
tags, not raw C bits) before testing `int-real`, simultaneous text/numeric caches,
subtype, ownership, or move invalidation: those states are not observable through
the current SQL-value JSONL response without lossy inference.

#### Comparison, built-in collation, and record-key handoff

Pinned SQLite 3.53.4 evidence is `vdbeaux.c:sqlite3MemCompare`,
`sqlite3VdbeRecordUnpack`, `sqlite3VdbeRecordCompare` and
`sqlite3VdbeRecordCompareWithSkip`; `sqliteInt.h:KeyInfo/UnpackedRecord`;
comparison/index opcodes in `vdbe.c`; and `main.c:binCollFunc`,
`nocaseCollatingFunc`, and `rtrimCollFunc`. The next implementation adds one
internal `src/internal/comparison.ts` consumer of the existing `Mem`; it must not
create another value union. The closed initial surface is `compareMem(left,
right, collation?)`, `compareBuiltinText(kind, left, right, encoding)`,
`unpackRecordKey(packed, keyInfo, borrowLifetime, limits)`, and
`compareRecordKey(packed, unpacked, keyInfo)`, matching SQLite's packed-LHS and
unpacked-RHS orientation (including RHS-owned `defaultRc`/`eqSeen`). Exact TypeScript parameter shapes
may be refined during implementation, but these four responsibilities and one-Mem
boundary are fixed by the tests-first tranche.

A `KeyInfo`-like immutable descriptor separates total packed fields from compared
key fields and supplies one built-in collation plus semantic sort flags (`desc`,
`nullsLarge`) per key term. An unpacked key owns its Mem array and control state:
`defaultRc` is restricted to -1/0/+1 and `eqSeen` is output state. SQLite
3.53.4 has no `UNPACKED_PREFIX_SEARCH`, `UNPACKED_PREFIX_MATCH`, or
`UNPACKED_INCRKEY` state, so the internal API must not invent tagged prefix modes.
Caller constructions are expressed by the number of unpacked values compared,
`defaultRc`, and `eqSeen`. `unpackRecordKey` takes a closed `caller` discriminator:
generic `record` unpack permits a structurally valid zero-field record, while
`seek` enforces `vdbe.c`'s nonempty `OP_Seek*` key invariant after decoding and
still permits an intentional nonempty short prefix; it rejects fields beyond
`nKeyField`. Complete generic unpack may represent zero/short records for
inspection, but ordinary comparison rejects fewer than `nKeyField` values so an
accidental short key cannot silently acquire prefix semantics. Other exact/total
field-state rules require additional caller classes before b-tree/VDBE integration. Packed TEXT/BLOB
cells borrow record bytes with the caller's generation; unpack/replacement/release
must make lifetime explicit, and comparison must validate every borrow before
access. Encoding conversion goes through Mem's SQLite-derived conversion and the
collation's required encoding. Limits distinguish malformed record headers/serial
lengths (`corrupt`) from configured field/byte/work ceilings (`limit`); no partial
key result escapes either failure.

`sqlite3MemCompare` establishes NULL < numeric < TEXT < BLOB, compares INTEGER and
REAL without first collapsing int64 through JS `number`, and uses the TEXT cache
when the comparison has text affinity/collation. BINARY is bytewise with length as
tie-breaker, including embedded NUL. NOCASE folds only SQLite's built-in ASCII
mapping; RTRIM removes trailing byte `0x20` only. Therefore JS string relational
operators, `localeCompare`, Unicode case folding, `Intl.Collator`, and host
collation registration are prohibited substitutes. Record comparison applies
per-term collation, DESC sign reversal and NULL ordering, stops at the declared key
field count (not an incidental array length), and preserves the upstream
prefix/default-rc/eqSeen behavior used by seek/found opcodes.

The descriptor is now a validated `KeyInfo` class rather than a compile-time-only
shape. Its constructor defensively copies and freezes the term array, every term,
and nested collation specs, then freezes the descriptor. `UnpackedRecordKey`
retains that exact identity as SQLite retains `pKeyInfo`; `compareRecordKey`
rejects a different descriptor identity (including structurally equal or differing
encoding/count/collation/DESC/BIGNULL metadata). This prevents caller mutation or
metadata substitution between unpack and compare.

The bounded machine tranche is
`test/conformance/cases/stage3-comparison-key.json`; its executable source-contract
test is `test/conformance/comparison-key-manifest.test.py`, and the implemented
internal vectors/local safety companions are in `test/value/comparison.test.mjs`.
The validator pins source identity, exact literal upstream IDs, named C routines,
bounded unique cases, zero-credit dispositions, and the closed implementation
handoff. `src/internal/comparison.ts` now implements the four functions using the
singular Mem model. Comparison itself is read-only: it validates byte borrows and
uses owned temporary Mem copies for required encoding translation rather than
mutating/cache-converting its arguments. Structural record errors and configured
limits remain distinct. Packed comparison now consumes `record.ts`'s incremental
raw reader and adapts one serial field to Mem at a time, so a decisive compared
term does not inspect an unrelated malformed tail; complete unpacking continues
to validate the full record. Conversely, after an equal term, packed-header
exhaustion while another unpacked RHS field remains is corruption and leaves
`eqSeen` false. Intentional exhaustion/defaultRc belongs only to the unpacked RHS
field count. Declared-serial payload truncation is a deliberately stricter local
untrusted-input guard in TypeScript: a direct pinned probe returns a comparison
result without `errCode` because this internal C path assumes readable padded/valid
b-tree key buffers. It is therefore a local safety companion, not native parity.
The missing-serial header case remains the direct native corruption differential.
This follows the early-return loop in
`vdbeaux.c:sqlite3VdbeRecordCompareWithSkip` rather than routing packed comparison
through eager `decodeRecord`. The six SQL cases stay `unimplemented-temporary` because
resolver/compiler/VDBE/index consumers do not yet reach this layer; local safety
companions never earn upstream credit.

Alternatives rejected: a five-way discriminated value loses cached text,
`MEM_IntReal`, subtype, and ownership; faithfully exposing all 16-bit `MEM_*` flags
would leak C allocation accidents and permit illegal combinations; eager JS-string
records lose source encoding/byte length; always-deep-copy is safe but obscures
`OP_SCopy` lifetime and adds avoidable page/register copying; and a general pointer
or destructor emulator adds complexity without an in-scope public consumer. The
chosen semantic state retains the distinctions used by VDBE while relying on GC
plus explicit release/generation invalidation. It adds no runtime dependency,
network operation, public API, worker/service, or deployment change.

### Compilation: Expr, Select, SrcList, NameContext, Parse

Source: `sqliteInt.h:3039,3425,3506,3597,3882`; `expr.c`, `select.c`, `resolve.c`,
`prepare.c`, `parse.y`. Keep ordered result/source lists and stable cursor/register
identity; names are not unique map keys. Preserve flag-selected meanings, correlated
outer name contexts, compound SELECT linkage and compile-time allocation state.
Which nodes are shared, duplicated or rewritten by each upstream pass? Represent
that directly; do not flatten into an independent AST evaluator. C reduced-size
allocations need not be imitated, but their legal field-use distinctions matter.

### Schema: Table, Column, Index

Source: `sqliteInt.h:2252,2432,2797`; `build.c`, `prepare.c` schema initialization.
Keep the linked schema graph and column/index order, affinity, defaults/generated
expressions, view Selects and WITHOUT ROWID key mapping. Column.iDflt indexes
Table's expression list; it is not a universal inline default value. Decide which
schema parsing state is retained for read-only planning; no blanket removal of DDL
parsing just because executing user DDL is excluded.

### Keys: KeyInfo and UnpackedRecord

Source: `sqliteInt.h:2672-2748`; `vdbeaux.c` `sqlite3VdbeRecordUnpack`,
`sqlite3VdbeRecordCompare`, `sqlite3MemCompare`.
Preserve encoding, per-term collations/sort flags, key versus total field counts,
prefix comparison, default_rc and eqSeen. JS array lexicography is not a substitute.
Which records borrow Mem values, and which own them across a cursor search?

### Storage: BtShared, MemPage, BtCursor

Source: `btreeInt.h:273,425,531`; `btree.c` page/cell parsing, payload and cursor
movement routines. Preserve file/page identity, page-1 header offset, geometry,
local/overflow payload rules, table versus index keys and ordered cursor stack.
Distinguish signed rowids from page indexes. Determine byte-borrow validity when
moving the cursor. Main-file write balancing may be omitted; needed ephemeral
b-tree operations must still have faithful translated algorithms.

### Read boundary: Pager and PgHdr / PCache

Source: `pager.h:143,163-176`, `pager.c` Pager and page acquisition;
`pcache.h:25,91-97`, `pcache.c` fetch/release.
Retain page identity, bytes, reader references and valid borrow duration. Choose
residency/eviction only as needed for the selected acquisition design. Main-file
journal, dirty-page writeback and locking protocols are not browser persistence
requirements; do not discard analogous private working-state needs unexamined.

## Worked ownership example (illustration, not a universal copy pipeline)

`vdbeaux.c` `sqlite3VdbeSerialGet` (`4123`, text/blob branch after `4201`) points
Mem.z at record bytes with `MEM_Ephem` and the serial-type byte length. A TS slice
can represent this as a borrowed subarray with encoding and length, not eagerly
decode every record into JS strings. Its page/record owner must outlive the borrow.
If a consumer uses `sqlite3VdbeMemCopy` on non-static text/blob, it materializes
owned value bytes through `sqlite3VdbeMemMakeWriteable`; a shallow copy does not.
Proposed public-column default: return an owned JS string or fresh blob array.
Under this proposal a retained public blob cannot change when another column
converts or the statement steps/resets. SQL NULL and a zero-length BLOB remain distinct despite
both sometimes using null C pointers. Test that distinction and retained-copy
behavior when this path is translated; no need to clone the schema/page graph.

### Stage 1 decisions (resolved)

`docs/api.md` now owns these decisions. They are C-mapped browser adaptations,
not runtime support claims:

- `open()` asynchronously fetches, validates and retains the complete bounded
  immutable main file; `prepare` is synchronous and `step` asynchronous/yielding.
  Connection-local stateful overlap is rejected rather than queued.
- prepare returns `{statement, tailOffset, tail}`; empty/comment-only input has a
  null statement, the offset counts UTF-8 bytes, and the suffix is lossless.
- public values are `null | bigint | number | string | Uint8Array`; blobs are
  copied, NaN binds NULL, infinities stay REAL, and nullable typed access keeps
  NULL distinct from empty text/blob.
- ordered index access and positional metadata preserve duplicate names.
  `columnType` is a stable initial-storage-class observation, explicitly adapting
  native undefined post-conversion behavior.
- reset retains bindings; repeated reset without an intervening step is valid and
  returns success, while finalize is destructive. Both reset/finalize clean up
  before reporting saved errors. Legacy busy `close()` and zombie
  `closeDeferred()` are both exposed without cascading finalization.
- SQLite failures retain primary/extended codes; transport, cancellation,
  timeout, resource limits, JS misuse, temporary/permanent unsupported behavior,
  and impossible internal states remain distinguishable.

These choices follow `src/sqlite.h.in`, `src/main.c`, `src/prepare.c`,
`src/vdbeapi.c`, `src/vdbeaux.c`, and `src/vdbemem.c` in the selected pin. Exact
finite default limit values remain an implementation-stage decision requiring
measurement and tests; declarations are explicitly nonfunctional meanwhile.

## Bounded Stage 1 design questions (historical basis)

The questions below are retained as the historical evidence checklist that drove
the resolved Stage 1 API above. They are not open blockers, proposed signatures,
or an extra architecture/review checkpoint; later source/test evidence may still
refine the singular contract coherently.

- How will nullable typed text/blob access preserve SQL NULL versus empty TEXT
  and empty BLOB? `sqlite.h.in:5493-5496` maps SQL NULL to null pointers, while
  a zero-length BLOB can also return a null pointer (`5462-5464`).
- How will INTEGER `bigint` and REAL `number` remain distinct, including an
  integral-valued REAL? Follow SetDouble's NaN-to-NULL and infinity preservation;
  make native test transport retain these distinctions rather than lossy JSON.
- How will prepare represent success with no statement for empty/comment-only
  SQL, and return the unconsumed SQL tail? Define UTF-8 byte offsets versus JS
  string indexes explicitly from `prepare.c` and `sqlite.h.in` prepare contracts.
- What does open acquire, and what remains resident for schema/planner reads?
  Choose synchronous or asynchronous prepare consistently with that acquisition
  design, URL/input scope, Fetch controls and limits. No hidden asynchronous reads
  or silently reduced input extent. Describe cancellation/timeout honestly: a
  synchronous operation cannot receive same-agent abort events while blocking
  the event loop.
- What does column_type observe around conversions? Upstream only defines it
  before conversions (`sqlite.h.in:5421-5432`). If adapting this to an immutable
  initial-type observation, label that adaptation; undefined native post-conversion
  results are not portable oracle expectations.
- How do reset, finalize and close expose errors while performing their required
  cleanup? Finalize destroys the statement even when reporting a prior error
  (`sqlite.h.in:5595-5617`); reset retains bindings but invalidates the row.
  Derive the close choice from `sqlite3_close`/`sqlite3_close_v2` and `main.c`,
  rather than assuming cascading destruction. Any JS idempotence adaptation must
  remain explicit and must not suppress meaningful errors.
- Which errors are actual SQLite result codes and which are JS representation
  validation? An out-of-range `bigint` is not automatically SQLITE_RANGE, whose
  binding use concerns parameter indexes. Keep those cases distinguishable.
- How will temporary translation gaps and permanent SPEC exclusions be explicitly
  distinguishable? Neither may be reported as supported behavior, and a temporary
  gap cannot become a new permanent exclusion.

Choose each internal representation before its actual first consumer. Later
structure notes may remain proposed defaults; no exhaustive upfront structure
inventory, extra two-review gate, or owner engineering decision is required.
When Stage 2 authors the oracle, pin its source through the manifest and record
relevant build options, including math, JSON and column metadata needed by scope.
Native fixture setup may write; runtime main-file access may not. Classifying
an exclusion or harness-only test is not implementing an excluded capability.

## Stage 3 parser and schema representation decision

This section records the design and current bounded implementation for the
parser/schema consumers, based on SQLite 3.53.4. It refines the earlier
`Expr`/`Select` and schema guidance. Tokenization, generated parsing/reduction
structures, exact tails/empty SQL/limits, and internal schema discovery are now
implemented; resolver/compiler/VDBE execution and successful public statement
preparation are not.

### Input, tokens, and exact tail mapping

Preparation starts by rejecting unpaired JS surrogates, then makes one UTF-8
encoding of the original SQL. The tokenizer ports `tokenize.c:sqlite3GetToken`
over those bytes, including SQLite identifier, numeric, variable, comment, BOM,
and illegal-token behavior. A token is a small immutable descriptor:

```ts
type SqlToken = {
  readonly kind: TokenKind;
  readonly startByte: number;
  readonly endByte: number;
};
```

Token text remains a byte slice of the retained prepare input; it is decoded only
when an upstream action needs a name, literal, or diagnostic. Token offsets and
lengths are therefore never JS UTF-16 indexes. During the single strict encoding
pass, retain a monotone boundary table of `[utf8ByteOffset, jsCodeUnitOffset]` for
each Unicode scalar boundary (ASCII runs may be represented as spans). Every token
end must be one of those boundaries. The boundary selected by
`sqlite3RunParser`/Lemon is mapped through this table to form `tailOffset` and an
exact `sql.slice(codeUnitOffset)`; the original JS string, not decoded bytes,
supplies `tail`. This makes supplementary characters exact and prevents surrogate
splits or replacement normalization. The statement retains the original string,
UTF-8 bytes, and map for v2-style reprepare; a failed or empty prepare retains
nothing after returning its tail result/error.

Database TEXT is a separate path. Schema record fields stay borrowed
`{bytes, encoding}` until schema loading needs text, then use a port of the
applicable `utf.c` routines. Do not route malformed database text through WHATWG
`TextDecoder`. Converted schema SQL/names become owned strings (and, when lexical
fidelity is needed, owned source bytes), so the schema graph does not borrow a
cursor payload. SQL input bytes and database-encoding bytes must never share an
implicit “string length” unit.

### Generated parser, without runtime code generation

The parser is a generated, table-driven Lemon parser, not a handwritten recursive
descent grammar or independent AST evaluator. A development-only Node generator
reads the pinned `src/parse.y` grammar and ports the table construction/compression
behavior of `tool/lemon.c`/`tool/lempar.c`. It emits deterministic TypeScript token
IDs, productions, action/lookahead/offset/default tables, fallback/wildcard data,
destructor metadata, and a parser loop. Semantic actions are ordinary reviewed TS
functions keyed by a stable production signature; generation fails if a grammar
production has no declared disposition (implemented action or explicit staged
temporary gap), or if a hand-authored signature no longer exists. No generated
code contains `eval`, `Function`, dynamic import, or grammar text interpreted at
runtime.

Keyword generation similarly reads the `KEYWORD(...)` inputs in pinned
`tool/mkkeywordhash.c` and emits the static lookup tables and token IDs expected by
`sqlite3KeywordCode`; do not maintain a second handwritten keyword list. Generated
files contain the source ID plus input hashes. They are checked in for browser
builds. A clean `npm` generation command must produce byte-identical output and a
check command regenerates under a purpose-specific disposable directory and diffs
it. The pinned C Lemon/mkkeywordhash outputs may be compiled and compared in
development as an oracle, but neither those tools nor C output is shipped or
executed by the runtime. Generator tests compare production/token counts, rule
signatures, precedence/fallback declarations, table decisions, and representative
token streams against the pin before parser behavior receives credit.

#### Canonical conditional-feature profile

`tools/parser-profile.json` is the checked-in, closed generation profile. Its
`defines` list is empty and its `undefines` list enumerates every conditional
`SQLITE_OMIT_*`, `SQLITE_ENABLE_*`, and `SQLITE_UDL_CAPABLE_PARSER` symbol read by
this pin's `parse.y` or `mkkeywordhash.c`. Thus this is SQLite's ordinary full
default grammar: no `OMIT` macro removes EXPLAIN, temp schema, compound SELECT,
windows, generated columns, views, CTEs, subqueries, CAST, triggers or the other
read-only/schema syntax; optional ordered-set aggregate syntax and optional
UPDATE/DELETE LIMIT syntax are not enabled. The latter two are outside SQLite's
ordinary build default, while their absence does not remove any in-scope
read-only query grammar. Included write, pragma, attach and virtual-table grammar
is still parsed so persisted schema and SQLite diagnostics remain source-shaped;
the public policy/consumer boundary applies the SPEC's permanent exclusions.

The profile is a closed world, not ambient compiler state. Generation rejects a
symbol present in both lists, an unknown listed symbol, any conditional feature
symbol discovered in either input but absent from both lists, or any environment/
CLI define not represented by `defines`. The TS preprocessor implements Lemon
3.53.4 `preprocess_input` semantics: `-DNAME` means boolean “name is present”
(values are not interpreted), `%ifdef`/`%ifndef` test presence, and `%if` evaluates
only identifiers, `!`, `&&`, `||`, and parentheses with Lemon's precedence and
truth result. Nested branches and `%else`/`%endif` are retained or removed exactly
as pinned Lemon does; unsupported expression syntax is a generator error. For the
selected empty define set, all `OMIT` branches are false and all `ifndef OMIT`
branches survive.

The keyword generator evaluates the C mask guards from `mkkeywordhash.c` against
the **same** profile before constructing its hash. A keyword is active exactly
when its resulting mask is nonzero; its token ID must resolve in the profiled
`parse.y` token vocabulary (aside from upstream's documented tokenizer-only token
handling). This alignment is tested by compiling pinned Lemon and mkkeywordhash in
a disposable development directory with exactly the profile's `-D` arguments and
comparing preprocessed productions, token-number assignments and every keyword's
identifier/token classification to TS generator output.

Generated headers record the profile schema, SHA-256 of the exact checked-in
profile bytes, source ID, and SHA-256 hashes of `parse.y`, `lempar.c`, `lemon.c`
and `mkkeywordhash.c`. Regeneration first recomputes all hashes, scans both inputs
for the closed conditional-symbol set, and fails on mismatch/drift. CI regenerates
to a disposable directory twice, requires byte identity, compares against checked-
in output, and runs the pinned-C parity comparison. A changed profile or upstream
conditional therefore requires an intentional profile edit and generated diff;
source pinning alone cannot silently alter the grammar.

The native oracle build defines `SQLITE_ENABLE_COLUMN_METADATA` and
`SQLITE_ENABLE_MATH_FUNCTIONS`. Neither symbol is consumed by `parse.y` or
`mkkeywordhash.c`, so its grammar/keyword profile is identical to this generation
profile; a drift test asserts that statement against the scanned conditional set.
If a future oracle option intersects that set, oracle/profile parity must be
resolved explicitly rather than waived. The TS runtime may implement built-in
math semantics later without making a C compile option part of its parser.

The first parser slice generated the complete `parse.y` grammar and token
vocabulary. Semantic actions remain staged in dependency order: (1) tokenizer, tail, empty SQL,
and syntax diagnostics; (2) schema-init DDL node construction; (3) core expression
and simple `SELECT`; then sources/name resolution, compounds/subqueries/CTEs,
aggregates/windows, and remaining read-only grammar. User-issued mutating commands
that parse successfully are permanent exclusions at the prepare policy boundary.
An in-scope production whose semantic action or compiler consumer is absent is
`unsupported/temporary`; it is never a syntax error or a permanent exclusion.
DDL parsing needed to reconstruct persisted schema is internal read-only work and
must not be removed merely because executing user DDL is excluded.

### Mutable compilation graph

Use discriminated TS objects whose fields preserve the meanings and ordered
relationships of `sqliteInt.h`, rather than a generic immutable AST:

* `ExprNode` has `op`, token/span, flags, affinity, height, table/column/cursor
  identity and discriminated payloads for leaf, unary/binary, list/select, and
  window meanings. Flag-selected unions are explicit variants. A separate
  `ExprListItem[]` preserves order, aliases and sort/null flags.
* `SelectNode` retains ordered result/group/order/window lists, `SrcList`, WHERE,
  HAVING and LIMIT expressions, select flags, operation, and explicit
  `prior`/`next` compound links. It is not flattened into nested JS arrays.
* `SrcList` is an ordered list, never a name-keyed map. Each item has stable
  compiler-assigned cursor identity, database/table/alias names, schema `TableNode`
  reference, subquery/function/join payload, join flags and correlation state.
* `NameContext` is a transient linked frame with references to its source/result
  lists, aggregate/window allowances and counters. `outer` identity is retained
  so correlated lookup follows `resolve.c`; it is not copied into every node.
* `ParseContext` owns tokenizer/parser state, diagnostics, limits, transient
  allocation lists, cursor/register/parameter counters, the current schema-init
  mode and the eventual VDBE builder. It records the last token as byte offsets,
  not a borrowed C pointer. It is single-prepare and is disposed on every exit.

These nodes are intentionally mutable within ordered upstream passes. Duplication
is an explicit graph-copy operation corresponding to `sqlite3ExprDup`/
`sqlite3SelectDup`; ordinary references preserve sharing. Rewrites mutate or
replace nodes while retaining stable cursor/register numeric identities. Parent
pointers are omitted unless a translated consumer proves they are needed, avoiding
cycles and a second traversal model. C allocation-size flags are represented only
where they select legal field meaning, not as byte-layout emulation.

### Persistent schema graph and ownership

One connection owns one `ImmutableStorage` and one main `SchemaGraph`. The graph
contains ordered/name-indexed `TableNode` and `IndexNode` identities, schema cookie
and encoding; maps are lookup accelerators only and never replace declaration or
column/index order. `TableNode` owns ordered `ColumnNode[]`, constraints and
schema-origin expressions/`SelectNode`, and references its indexes. `ColumnNode`
retains name, declared type, affinity, collation, flags, generated/default state,
and `iDflt` into the table-owned expression list (not an always-inline default).
`IndexNode` retains ordered terms (column number or expression), collations,
sort/null flags, uniqueness/origin, partial predicate, root page and the
WITHOUT ROWID auxiliary/primary-key mapping. Cross-links use object identity; the
schema owner constructs privately, validates, then publishes the completed graph.

Schema bootstrap follows `prepare.c:sqlite3InitOne/sqlite3InitCallback`: open a
known-root table cursor on page **1** (the `sqlite_schema`/master root), decode each
five-column row (`type,name,tbl_name,rootpage,sql`), convert text using the database
header encoding, and parse non-null SQL in schema-init mode. The row's rootpage is
the authoritative assigned root during init rather than a root allocated by DDL
actions. Internal automatic-index entries with null SQL and the canonical schema
table are handled by the same upstream init branches, not fabricated by a generic
DDL executor. Table/index/view/trigger graph insertion and post-load linking follow
`build.c`; triggers may initially retain source/temporary semantic nodes without
becoming executable, but malformed required schema is a SQLite schema/corruption
error, not silently skipped.

The schema graph owns all decoded names, SQL, expressions and selects; it borrows
no movable cursor record. It does retain a storage-owner generation and becomes
invalid when the connection closes. Statements hold schema object references and
the connection therefore cannot physically destroy schema/storage under live
statements: legacy close remains BUSY, while deferred close keeps both owners alive
until the last statement finalizes. A later schema-cookie reprepare may replace
the connection's graph as a unit; old statements keep their old graph until reset/
reprepare/finalize. Immutable input means no in-place public schema mutation.

### Failures and finite budgets

Tokenizer illegal tokens, Lemon syntax failure, parser overflow where SQLite
reports it, malformed schema SQL, and applicable SQLite compile errors are
`JSQLiteError(kind: "sqlite")` with sourced result codes. A configured safety
budget produces `kind: "limit"`; an absent in-scope grammar action/compiler phase
produces `unsupported/temporary`; user mutation/host-extension requirements are
`unsupported/permanent` exactly as SPEC defines. Impossible generated-table or
graph invariants are `internal`. None may be converted into empty schema, NULL, a
parse error chosen to hide a gap, or successful partial preparation.

The generated parser tables retain every reduction as semantically observable. Pinned
Lemon normally elides actionless one-symbol nonterminal reductions because its
generated C has no action to call; `tools/parser/generate.mjs` disables only that
optimizer in its disposable Lemon copy because TypeScript supplies an external
per-production callback. Ordinary Lemon compression and SHIFTREDUCE handling stay
enabled. This ensures ownership productions such as `selectnowith ::= oneselect`
actually execute instead of merely passing the child's value to a parent. Tests
require each SELECT/VALUES owner signature, not only semantics on reductions that
happen to be present.

The first implementation uses finite defaults: `maxSqlBytes = 16 MiB`,
`maxParserDepth = 2500` (the pinned `SQLITE_MAX_PARSER_DEPTH`), and
`maxExpressionDepth = 1000` (the pinned `SQLITE_MAX_EXPR_DEPTH`). Token count is
bounded by encoded bytes plus the EOF token; every token, shift/reduce action and
node allocation charges the statement `maxWorkUnits`. Parser stack growth checks
`maxParserDepth` before allocation; expression constructors/check passes enforce
height, and iterative destruction/traversal is preferred where C recursion could
consume the JS stack. Schema row/cell/text totals charge file/work limits, b-tree
reads retain existing depth/overflow limits, and graph collection counts are
bounded by both source SQL/file bytes and work units. Public options may tighten,
not relax, these defaults. The 16 MiB adaptation is intentionally below SQLite's
1,000,000,000-byte compile default for a browser safety boundary; exhaustion is a
typed configurable resource limit, not a claim that larger valid SQL is outside
product scope. Numeric defaults for execution rows/work remain for their actual
consumer to measure and test.

### First ports and integration seams

Port exact `test/tokenize.test:tokenize-1.1..1.12` numeric-error expectations and
`tokenize-2.1..2.2` unterminated-comment distinction first, then the already mapped
`test/capi3.test:capi3-1.1,1.4..1.9` prepare/empty/tail/error cases. Add focused
UTF-8-tail companions containing BMP and supplementary scalars because the public
JS boundary is an explicit adaptation. The first schema tranche should preserve
`test/schema.test:schema-1.1..1.4` schema-table shape/read behavior and
`schema-4.1..4.4` table/index reconstruction assertions, using native fixture
setup for writes. Select initial table/index declaration and simple SELECT cases
from `test/table.test`/`test/index.test` only when their exact setup and assertions
are admitted to `CONFORMANCE.md`; this design does not pre-credit them.

The implementation seam is intentionally narrow: the connection passes its
single internal `ImmutableStorage` to `loadSchemaGraph`; the loader opens
`BtreeDatabase` root 1 cursors, uses `record.ts`, the implemented `utf.c` converter and
schema-init parser, and atomically returns `SchemaGraph`. `prepare()` creates a
short-lived `ParseContext` against that graph and transfers only the compiled VM,
retained SQL/mapping and graph reference into the statement. Unresolved consumers
are record comparison/collations for index search, faithful text conversion,
VDBE construction, name resolution beyond the staged slice, schema-cookie
reprepare, views/triggers/generated columns, and statement-aware busy/zombie close.

### Implemented schema-bootstrap tranche

`src/internal/schema.ts` now implements the first bounded consumer of the
persistent-schema design above. Root page 1 is traversed with the connection's
existing owner, each five-field row is detached from cursor payload storage, and
ordinary tables, expression/simple indexes, and views are linked then published in physical row
order. Stored SQL is parsed by the generated Lemon runtime and the catalog consumes
its reduction-derived column/default/generated, index-term, table-option, and view
Select structures rather than reconstructing DDL with handwritten comma splitting. UTF-8/UTF-16le/UTF-16be
fixtures confirm names and SQL conversion, roots, declaration/term order,
identity links, and close invalidation. Malformed records, encoding, DDL, roots,
or links are corruption; recognized but not constructed automatic indexes,
triggers, virtual tables, and further grammar consumers are temporary unsupported.
Supported generated/default/WITHOUT ROWID state and expression-index links are
published; `build.c:2332-2407` implicit NOT NULL is applied to every WITHOUT ROWID
primary-key column. CHECK and REFERENCES/foreign-key reductions are recognized but
currently fail temporary unsupported before publication rather than being silently
flattened. Detailed WITHOUT ROWID storage-key remapping remains progressive work.
This follows pinned `prepare.c:sqlite3InitOne/sqlite3InitCallback`, `build.c`, and
`sqliteInt.h` Table/Column/Index; the narrower parser currently limits the graph
tranche, not product scope.

## Implemented Stage 3 Mem core slice

`src/internal/mem.ts` now implements the representation selected above for the
bounded core/lifetime slice. It translates pinned 3.53.4 `vdbeInt.h` Mem state and
`vdbemem.c` SetNull, SetInt64, SetDouble, SetStr/zero-blob, ShallowCopy, Copy, Move,
MakeWriteable and Release semantics into opaque semantic state. It covers NULL,
INTEGER, REAL, IntReal, TEXT/BLOB byte state, encoding and logical lengths,
subtype, aggregate-ready cleanup, owned/borrowed/static-like bytes, generation
invalidation, and directional `RawRecordValue`/public `SqliteValue` adapters.
Public blobs copy at both boundaries. Explicit TS lifetime tokens turn stale reads
into typed internal failures; this is a local safety adaptation replacing C debug
undefined-memory detection. Conversion/affinity/casts and SQL execution remain
separate later slices and are not claimed here.

## Stage 3 bounded arithmetic and NULL/truth primitives

The internal `src/internal/vdbe-primitives.ts` slice ([[card:card-f-a-d]]) now
translates SQLite 3.53.4 `vdbe.c` `OP_Add` through `OP_Remainder`, `OP_BitAnd`
through `OP_BitNot`, and `OP_And`, `OP_Or`, `OP_Not`, `OP_IsTrue`, `OP_If`,
`OP_IfNot`, and the NULL test used by `OP_IsNull`/`OP_NotNull`, with
`vdbemem.c:sqlite3VdbeBooleanValue` and the overflow contracts of
`util.c:sqlite3AddInt64`/`sqlite3SubInt64`/`sqlite3MulInt64`. The API deliberately
uses SQL left/right order instead of the opcode's P2/P1 encoding and consumes
`Mem`; it is not a second value union or an expression evaluator.

Exact integer add/subtract/multiply stay INTEGER; overflow repeats the source's
floating path using each original operand's IEEE conversion. Integer division
truncates toward zero, except `INT64_MIN/-1` promotes to REAL. Division by either
signed zero and remainder by an integer-coerced zero produce NULL. Remainder
coerces both operands to int64 and retains REAL result class if either numeric
operand classified REAL. Floating NaN results become NULL while infinities and
signed zero survive through `Mem.setDouble`. Bitwise operations use full signed
64-bit `bigint`; left shift wraps 64 bits, right shift sign-extends, negative
counts reverse direction, and magnitudes at least 64 follow the explicit source
0/-1 rule. `BigInt.asIntN(64, ...)` is confined to operations where SQLite uses
64-bit bit patterns, never arithmetic overflow.

Truth conversion is numeric (`0`, `0.0`, and nonnumeric text are false), with an
explicit caller-selected NULL value. AND/OR use the source's three-valued lookup
tables; NOT propagates NULL; IS TRUE/FALSE always yields INTEGER; If/IfNot expose
the opcode P3 NULL policy. All binary arithmetic/bitwise paths propagate NULL.
Direct cases and their bounded manifest are in
`test/value/vdbe-primitives.test.mjs` and
`test/conformance/cases/stage3-vdbe-primitives.json`. They are internal execution
evidence only: at that tranche's historical checkpoint, compiler/VDBE program
execution and public statements remained unimplemented-temporary and received zero
public SQL credit. The later first-SELECT section documents the currently promoted
bounded consumer.

### Mem canonical TEXT cache and encoding repair

Acceptance review `record:///review.md?card=card-f-a&v=3` identified that the
implemented fields could not establish the promised simultaneous numeric/TEXT
state. The repair follows pinned `src/vdbemem.c:471-495`:
`Mem.stringify(enc, false)` adds canonical TEXT while retaining exactly one of
INTEGER/REAL/IntReal; `force=true` clears numeric forms as the CAST caller does.
Direct setters/reset still replace all representations. Direct `stringify(..., false)` is the cache-forming path. In contrast, pinned
`vdbe.c:354-433` affinity callers are destructive: numeric affinity clears
noncanonical source TEXT and TEXT affinity passes `bForce=1` then clears numeric
flags. Forced casts retain their source-specific destructive rules. Stringification clears subtype because the
upstream allocation/flag path does not retain `MEM_Subtype`.

`Mem.changeEncoding` now maps `sqlite3VdbeChangeEncoding` and
`src/utf.c:sqlite3VdbeMemTranslate`: it is a no-op without TEXT or at the requested
encoding, retains numeric flags, creates owned terminated bytes, truncates odd
UTF-16 when translating through UTF-8, and preserves an odd trailing byte for the
direct UTF-16 endian-swap path. Translation uses the existing SQLite-derived
legacy decoder rather than WHATWG behavior. Numeric CAST grammar remains sibling
work; no public SQL execution is claimed.

## First prepared SELECT VM architecture (tests-first proposal)

Status: reviewable architecture for the first compiler/VM tranche; it does not
claim an implementation. It is pinned to SQLite 3.53.4 and the source ID in
`reference/sqlite/manifest.json`. The executable admission inventory is
`test/conformance/cases/stage3-first-select.json`. It is additive: the historical
Stage 2 denominator remains exactly 38 upstream assertions plus 9 no-credit
companions (47 sequences), and this proposal grants no TS SQL credit.

### Closed slice and pass boundary

The admitted implementation slice is deliberately narrower than product scope:
constant and parameter expressions, and one ordinary rowid table with ordered
projection, `*` expansion, and a WHERE expression over a full forward scan. The
compiler must follow the existing mutable Lemon graph; an AST interpreter or a
second expression-value model is prohibited. `selectExpander`-shaped expansion
runs before `resolveSelectStep`/`resolveExprStep`-shaped resolution, followed by
expression/SELECT code generation and make-ready. Missing or ambiguous columns are
SQLite compile errors. Joins, subqueries/CTEs, compounds, aggregates/windows,
DISTINCT, ORDER/GROUP, index choice, functions beyond separately admitted
primitives, views and ephemeral structures remain explicit temporary gaps, not
permanent exclusions.

`ParseContext` is the single-prepare owner of diagnostics, work/limit accounting,
last-token/tail state, mutable parse graph, linked `NameContext` frames, and the
only program builder. Its monotonically assigned cursor and positive register
numbers are stable identities; register 0 is not a SQL value register. Expansion
binds each ordered `SrcList` item to a connection-owned `TableNode`, assigns its
cursor, and replaces each `*` in place with columns in source/schema order.
Duplicate expressions and names remain separate list items. A `NameContext` frame
references (does not copy) its `SrcList` and applicable result list, carries the
aggregate/window permissions and usage counters needed by its caller, and links to
an `outer` frame. A successful lookup rewrites the `ExprNode` to a column reference
containing table identity, cursor number, and column index/identity. This mirrors
`src/resolve.c:lookupName`, `resolveExprStep`, and `resolveSelectStep` and the
`NameContext` declaration in `src/sqliteInt.h`; it does not flatten correlation
state into strings.

Persistent schema objects remain connection-owned. Failure destroys the parse
nodes and builder. Success transfers an immutable program, static literal bytes,
ordered result descriptors, parameter descriptors, retained SQL/tail map, register
count, cursor-slot count, and schema identity reference into one statement; no
mutable parse graph is needed by normal execution. This is the TS make-ready seam
corresponding to `src/prepare.c:sqlite3LockAndPrepare` and
`src/vdbeaux.c:sqlite3VdbeMakeReady`. Reprepare is not in the first immutable-file
slice, but ownership must not preclude replacing those products atomically later.

### Program, registers, cursors and initial opcode vocabulary

The builder owns a dense instruction array with source-shaped P1/P2/P3 operands,
P4 as a discriminated owned/reference payload, P5 flags, and resolved jump labels.
Labels cannot escape make-ready. It tracks maximum positive register, cursor-slot
count and temporary register leases explicitly; release returns a temporary to the
compiler pool but never changes an already emitted operand. Static P4 text/bytes
are statement-owned; schema/table/key descriptors retain validated owner identity.
An instruction may not hold an untyped JS value or closure.

The minimum vocabulary is: initialization/halt, NULL/int64/REAL/string/blob and
parameter-to-register loads; copy/move forms required by source codegen; admitted
unary/arithmetic/truth/comparison operations; conditional branches; result-row;
and a scan seam consisting of open-read, rewind, column, rowid if required, next,
and close. Exact opcode names may preserve upstream names. The first table path
must be emitted through a bounded `sqlite3WhereBegin`/
`sqlite3WhereCodeOneLoopStart`-shaped scan-plan interface whose only admitted plan
is a forward full table scan. A direct bespoke table loop is rejected because it
would create a parallel executor. This boundary follows `src/select.c:sqlite3Select`,
`selectInnerLoop`; `src/expr.c:sqlite3ExprCode*`; and the initial paths in
`src/where.c`/`src/wherecode.c`.

At runtime the statement owns a fixed register array of existing `Mem` cells,
fixed typed cursor slots, PC, work counter, result span, saved primary execution
error and cleanup diagnostics. Cursor slots distinguish main-table from future
index/sorter/ephemeral kinds even though only main-table is constructible now.
Opening validates the schema/storage identity; VDBE open-read now constructs a
lazy forward-only `TableScanCursor`, and rewind/next resume its depth-first page
iterator rather than recursively materializing all table entries during one opcode.
Each iterator resume reads at most one root-to-leaf path plus one cell before
returning, while page/depth and overflow limits remain enforced by the existing
b-tree layer; column adaptation goes through `memFromRawRecord`. The table compiler
emits open/rewind/next/halt through the first `sqlite3WhereBegin`/`sqlite3WhereEnd`
full-scan seam, leaving future plan kinds outside this tranche. All opened cursors
are closed on halt/reset/finalize and on failed open/step.

### Parameters and result descriptors

Variable discovery occurs while compiling `TK_VARIABLE`, never by rescanning SQL
at bind time. Preserve exact spellings for `?`, `?NNN`, `:name`, `@name`, and
SQLite's `$name` forms. Anonymous `?` receives one greater than the current maximum;
`?NNN` denotes exactly NNN and may create sparse slots; a repeated named spelling
reuses its first index, while a new name receives one greater than the current
maximum. Index 0 is invalid. The maximum is the connection's variable-number
limit (default 32766 in this pin); zero, overflow, and above-limit numbers are
compile errors. These rules follow `src/expr.c`'s `TK_VARIABLE` path,
`sqlite3VListAdd`/lookup and the pinned `SQLITE_MAX_VARIABLE_NUMBER` default.
The statement owns descriptors for all indexes through the maximum (unnamed holes
included) and one `Mem` binding cell per slot. Unbound/hole cells are NULL;
public binding remains one-based, exact-name lookup returns 0 when absent, invalid
indexes are SQLite RANGE, and invalid JS representations are misuse.

Result descriptors are an ordered array, never a name-keyed object. Each captures
display name and, when a direct resolved column permits it, declared type and
main/table/origin names; expression metadata is null where SQLite supplies none.
`OP_ResultRow` publishes a register start/count and captures each cell's initial
storage class. Duplicate names and repeated columns remain ordinally distinct.
Metadata derives during compilation from the resolved expression/source identities,
not by inspecting the first row.

### State, row validity, bounded suspension and cleanup

The internal state machine is `prepared -> running <-> suspended -> row`, then
`running/suspended/row -> done|failed`; reset returns any non-finalized state to
`prepared`, and finalize moves once to `finalized`. A step attempt first invalidates
the prior row. `row` is valid only after that step resolves `"row"` and until the
next step attempt, reset, finalize, or final connection destruction. DONE and every
error expose no row. Public TEXT/BLOB values are owned adaptations; no register or
page borrow escapes.

`step()` executes at most a configured opcode/work quantum before yielding to the
host. Every opcode charges one unit. For current table scans, each local/overflow
payload chunk and record header/serial-type decode also charge one unit; overflow
reconstruction reads and yields one page at a time, checking abort, deadline and
the effective statement/connection work bound around each chunk. The cursor and PC
remain on the current row until reconstruction and decode complete, and cursor
movement invalidates the associated `Mem` borrow generation. B-tree descent is
lazy and remains guarded by the independent page/depth accounting. Suspension is permitted only at opcode
boundaries or an explicitly resumable bounded storage operation, and preserves PC,
registers, cursor stacks/generations, parameter cells, pending error and result
state. It resumes rather than re-evaluating an expression or rewinding a scan.
Abort/timeout/global-work checks occur at chunk boundaries and existing bounded
storage checkpoints; no hard real-time interruption is promised. Overlapping
connection operations remain misuse per `docs/api.md`.

On execution failure, a single VDBE boundary preserves an existing public error,
maps `BtreeFormatError`/`RecordFormatError` to `SQLITE_CORRUPT`, and maps only the
provenance-bearing `BtreeLimitError` ceilings to `limit` (never an arbitrary
`RangeError`). It then invalidates the row, retains the first result as primary, and
halt/close all cursors. Reset performs halt cleanup and register/borrow invalidation
before returning the saved error, rewinds PC/state, and retains bindings. Repeated
reset is valid. Clear-bindings replaces every parameter `Mem` with NULL without
rewinding. Finalize performs reset/halt cleanup, releases bindings, registers,
program and statement/schema references, becomes unusable, and only then reports
the saved error. Later cleanup errors are diagnostic and never replace the first
operation error. Legacy close with a live statement is BUSY and leaves the
connection usable; deferred close marks it zombie, rejects new work, keeps
schema/storage alive, and destroys them after the final statement finalizes. This
tracks `src/vdbe.c:sqlite3VdbeExec`, `src/vdbeapi.c:sqlite3_step`/bind/column,
`src/vdbeaux.c:sqlite3VdbeReset`/`sqlite3VdbeFinalize`, and
`src/main.c:sqlite3Close`/zombie cleanup. GC is leak fallback only.

### Alternatives, invariants and effects

Rejected alternatives are an AST interpreter (duplicates compiler semantics),
object rows keyed by name (lose duplicates/order), SQL rescanning for parameters
(loses source numbering), promise-per-opcode execution (unbounded overhead), and
eager cascading close (contradicts busy/zombie behavior). The design adds no
runtime dependency, native backend, write path, service, deployment change, or
generic JS coercion. Key review invariants are: one mutable source-shaped graph;
one Mem value model; immutable statement compilation products; positive stable
registers and typed cursors; all control paths bounded; one primary error; and no
credit unless the declared TS operation sequence reaches and satisfies its final
assertion.

### Review revision: executable boundary baseline

In response to `record:///review.md?card=card-h-a&v=3`, the four no-credit
companions are no longer coverage inventories. Each now declares concrete SQL or
empty/tail inputs, setup/database encoding, bindings, ordered operations, typed
rows/metadata/result codes, and the exact attempted/unattempted TS suffix. The
native runner executes all four, including sparse `?5` holes and repeated names,
reset retention/clear/finalize, row invalidation after DONE, UTF-8/UTF-16le/
UTF-16be setup, int64/REAL/NaN/infinity/NULL/empty TEXT/BLOB and copied nonempty
BLOB boundaries, exact UTF-8 tail offsets, legacy BUSY close, and deferred zombie
rejection. These remain native/API expectations or JS-boundary no-credit evidence;
they do not increase TS compatibility credit. Exact upstream entries additionally
carry literal assertion and preceding setup anchors, which the validator binds to
the pinned source before the native declared SQL is run.

### Implemented no-FROM scalar and parameter VM tranche

The first prepared-SELECT design is now implemented for bounded no-FROM integer
unary and parameter result expressions in `src/internal/vdbe.ts`. Parameter
numbering is performed once during expression compilation (`?`, sparse `?NNN`,
and repeated `:`, `@`, `$` names), producing owned descriptors and binding `Mem`
cells. `OP_Variable`-shaped execution copies those cells into result registers;
reset retains bindings, clear replaces them with NULL, and public blob binding and
reading preserve the API's copy boundary. The VM retains PC/registers across its
bounded async opcode loop and publishes ordered duplicate columns through
ResultRow. `src/index.ts` now retains live statements for legacy BUSY/deferred
zombie close. This follows pinned `expr.c`, `vdbe.c`, `vdbeapi.c`, `vdbeaux.c`, and
`main.c`; table expansion/resolution/scans are intentionally left to
[[card:card-h-c]] rather than approximated here.

### Stage 3 expression and ordinary-function evidence gate (tests first)

The additive, zero-credit baseline is `test/conformance/cases/stage3-expression-functions.json`; its exact pinned assertion list and fixture SQL are in the adjacent `.spec.json`, and `capture-expression-functions.py` reproduces typed native rows, ordered metadata, and exact errors from the source-pinned oracle. This gate does **not** claim TS support.

The first implementation tranche is deliberately bounded to reduction-derived expression nodes for NULL/INTEGER/REAL/TEXT/BLOB literals, variables and resolved columns; unary and binary arithmetic/comparison/boolean nodes; CAST, postfix built-in COLLATE, CASE, and function calls. It applies in projections and the existing full-scan WHERE. The consumer must replace token bags from generated reductions; reparsing token arrays or adding an evaluator is forbidden.

Resolution uses an immutable built-in registry translated from `func.c`, ASCII case-insensitive names, exact arity before variadic candidates, and SQLite's distinct wrong-arity/no-such-function diagnostics. Initial functions are `typeof`, `length`, `octet_length`, `abs`, `coalesce`/`ifnull`, `nullif`, scalar `min`/`max`, and `substr`/`substring`; `replace` follows only with byte/output-limit enforcement. `coalesce`/`ifnull`, CASE, AND, and OR compile as lazy control flow, not eager callbacks. LIKE/GLOB are a later ordinary-function tranche because `patternCompare` escape, recursion/work, and blob policy are not yet pinned.

Expression flags carry resolved affinity and CollSeq: explicit COLLATE wins; otherwise comparisons follow SQLite left/right precedence, and column affinity is applied at comparison/cast call sites. Scalar min/max consume the selected CollSeq and preserve SQLite's first selected tie behavior. Required VDBE growth is literal loads, Cast, CollSeq, value and branch comparisons, Goto/If/IfNot/IsNull/NotNull, and Function/PureFunc over shared `Mem`.

A function context owns output `Mem`, arguments, selected CollSeq, first-error state and cleanup. Cleanup runs once on replacement/reset/failure/finalize and cannot replace the first error. Every opcode/function invocation is charged; text scans, decoding, copies and output growth need bounded incremental charging with abort/deadline checks and pre-materialization byte limits. Result names remain SQLite expression text or aliases; duplicate order is preserved, and origin metadata is null except for direct resolved columns. Evidence: pinned `expr.c` expression/branch code generators; `resolve.c`; `vdbe.c` arithmetic, comparison, Cast, CollSeq, control and Function opcodes; `func.c` registrations/implementations; `vdbemem.c`, `util.c`, `utf.c`; exact tests enumerated in the manifest.

Evidence limitations remain explicit: these companions and the dedicated native harness are no-credit implementation targets, not TS compatibility. The harness observes deterministic interruption rather than wall-clock timeout duration, and its host-registered error function is development provenance only. Detailed translated opcode/function work charges and injected deadline behavior still require implementation-side tests. This does not narrow the owner scope.

Ordinary-function backlog after this tranche: `replace` limit/copy details; LIKE/GLOB pattern engine and ESCAPE/work policy; remaining core ordinary string functions. Aggregates/windows, date/time, math and JSON are not part of this tranche.

#### Expression/function gate evidence completion

The additive gate now separates each literal/arithmetic/division/overflow, unary/comparison, three-valued boolean, lazy branch, WHERE, min/max CollSeq/tie/NULL, embedded-NUL, resolver, and output-metadata observation so a later error cannot hide earlier results. `stage3-expression-function-boundaries.json` adds development-only, zero-credit native evidence for UTF-8/UTF-16le/UTF-16be databases with UTF-8/UTF-16le/UTF-16be bound text, `SQLITE_LIMIT_LENGTH` before oversized `replace` output, deterministic progress-handler interruption, and function result-error/destructor ordering. Host registration remains oracle-only and does not alter the public boundary. Wall-clock timeout duration is intentionally not asserted: the translated deadline must converge on the same interrupt boundary and primary code, while deterministic tests inject the deadline/progress decision.

The TS gate is fixture- and expectation-aware: `func` and `where` cases open immutable generated fixtures and, once preparation succeeds, exact metadata/typed rows or the expected phase error must match. Until implementation, every declared upstream case remains attempted, failing/unimplemented, and zero credit.

The boundary harness distinguishes function-registration teardown from result-`Mem` cleanup. A development-only result destructor is observed once when an error replaces a prior function result, once on statement reset, and once on finalize; registration teardown is separately observed at connection close. SQLite's destructor callback returns `void`, so it cannot provide an oracle for cleanup throwing after a primary error. “Cleanup failure is secondary to first execution error” is therefore an explicit project invariant, held as a zero-credit failing TS gate until the shared function context exists. Progress interruption is installed only after successful prepare and is observed during `sqlite3_step`; callback count is evidence of a boundary, not a portable TS work-unit count.

### Implemented bounded expression/function tranche

The generated Lemon expression reduction is now retained on `ExprNode` and consumed by the resolver/compiler; execution is emitted as a VDBE `Expression` operation over shared `Mem`. The bounded registry implements `typeof`, `length`, `octet_length`, `abs`, `substr`, `nullif`, and lazy `coalesce`, together with the selected literal, remainder/comparison/IS, CAST and simple CASE forms. Arity is rejected during prepare with SQLite-shaped errors. The one selected ORDER BY case uses a bounded materialized table sort. This is only the 40-case tranche: COLLATE/min/max companions, broader arithmetic/boolean/WHERE, replacement, LIKE/GLOB, remaining strings, aggregates/windows/date/math/JSON remain backlog. Source anchors remain SQLite 3.53.4 `expr.c`, `resolve.c`, `vdbe.c`, `func.c`, and `vdbemem.c`.

### Function result cleanup seam

Public TS expression execution now uses a shared `FunctionContext` result owner. Replacing or consuming a result releases it exactly once, cleanup-only failures surface, and a prior evaluation error keeps identity over a later cleanup failure; `test/conformance/run-expression-function-cleanup-ts.mjs` exercises those behaviors. This is the bounded `sqlite3_context`/result-Mem lifetime seam, not a claim that compiler-emitted `Function`/`PureFunc`/`CollSeq` opcodes or public host registration exist.

### Source-shaped expression opcode lowering

Resolved generated reductions are now lowered recursively into ordinary program operations rather than one recursive `Expression` operation. The bounded tranche emits literal/column/copy/cast/binary operations, `Function` (with the shared `FunctionContext`), `CollSeq`, and explicit `ShortCircuit`/`Boolean`/`NotNull`/`IfNot`/`Goto` control for AND/OR, coalesce, and CASE. `test/conformance/run-expression-opcodes-ts.mjs` prevents regression to the removed catch-all operation. This is intentionally bounded to accepted scalar expressions; LIKE/GLOB and broader function families remain backlog.

### Bounded scalar work and result size

The Function opcode now supplies an execution-control object analogous to VDBE progress/interrupt checks (`src/vdbe.c`) to delivered scalar implementations. Input traversal and result copies charge deterministic started 256-byte chunks, with host yields during long Function input admission; scalar scans/builds charge documented units and check the operation signal/deadline/work ceiling. `maxResultBytes` is a connection limit shaped after `SQLITE_LIMIT_LENGTH`/`sqlite3_result_error_toobig`; `hex`, `replace`, `substr`, and `char` preflight or verify encoded output before installing the FunctionContext result. This is deterministic checkpoint cancellation, not a hard real-time guarantee during a synchronous sub-span. `test/conformance/run-expression-bounded-ts.mjs` exercises public parameter and column paths, exact admission, injected abort/deadline, saved-error identity, reset/finalize cleanup, and reuse.

### Relational private working-state gate and implementation handoff

The development-only gate in `test/conformance/cases/stage3-relational-working-state.json` is captured from the exact 3.53.4 source ID by `capture-relational-working-state.py` and validated by `relational-working-state-manifest.test.py`. It preserves typed ordered cells, duplicate column metadata, phase-specific errors, cleanup traces, and separate native-match versus TS-credit accounting. Fixture setup writes occur only in native `:memory:` databases; assertion SQL is read-only. Companion coverage is explicitly no-credit and no relational TS behavior is claimed by this gate.

The historical source decisions for that implementation tranche followed `select.c` (`DistinctCtx`, `SortCtx`, `selectInnerLoop`, `pushOntoSorter`, `generateSortTail`, `computeLimitRegisters`, `multiSelect`, and (for then-future compounds) `multiSelectByMerge` plus its coroutine merge control near `select.c:3314-3399`), `resolve.c` ORDER/GROUP result-term resolution, `vdbe.c` sorter/ephemeral/comparison/LIMIT opcodes, `vdbesort.c`, `btree.c`, and `vdbeaux.c` record/KeyInfo comparison:

- ORDER keys contain resolved terms in order with KeyInfo collation, DESC and NULLS-large flags. Only the ephemeral-b-tree path appends the source `OP_Sequence` discriminator before payload; `SorterOpen` adds no synthetic sequence and preserves stable single-thread equal-key insertion order.
- DISTINCT and unordered compound sets key the complete result record without sequence/payload. DISTINCT uses NULL-equal comparison and existing Mem/record numeric equality. Compound collations are selected left-to-right by `multiSelectCollSeq`; UNION/INTERSECT/EXCEPT suppress duplicates and UNION ALL preserves multiplicity/branch order absent ORDER BY.
- Typed cursor seams are `sorter` and `ephemeral-index`. Lower through `SorterOpen/Insert/Sort/Data/Next`, `OpenEphemeral`, `MakeRecord`, `IdxInsert`, `Found/NotFound`, `Compare/Jump`, `MustBeInt`, `OffsetLimit`, `IfNotZero`, and `DecrJumpZero`; do not bypass the VM with ad-hoc JS `sort`/`Set` implementations.
- Charge opcodes, comparison terms, record encode/decode chunks, inserted rows/bytes, sort compare/move work, and compound merge advances. Check cancellation/deadline/work around bounded growth and sort/merge advances. Suspension retains PC, registers, typed cursor positions/phases, and first error without restarting input.
- Reset/finalize/halt/failure closes every private cursor and releases records and borrow generations exactly once. First execution error survives repeated finalize codes and distinct cleanup diagnostics. Browser state is memory-only: omit PMA files, worker threads, journals, main-file mutation, and spill promises; finite row/byte/record/work excess is `kind:"limit"`, not permanently unsupported.

The literal bounded upstream tranche is deliberately small (`limit.test`, `distinct.test`, `select4.test`); explicit NULL placement, remaining built-in collation/storage-class/error boundaries, and deterministic interruption/resource cleanup are named no-credit companions. This selection tests semantics and lifecycle without treating case counts or native success as TS compatibility.

The first consuming tranche is now implemented by `src/internal/private-state.ts` and typed VDBE routes in `src/internal/vdbe.ts`. `SorterCursor` and `EphemeralIndexCursor` own copied `Mem` cells under immutable `KeyInfo`; the bottom-up stable merge checks work/cancellation/deadline without `Array.sort`. Deterministic private work is one unit per admitted record, each copied logical byte, each visited `KeyInfo` term, and each merge move. Zero-unit control checks immediately bracket bounded growth; a post-growth cancellation/deadline failure rolls back the new owned entry. Entry, key-byte, and aggregate logical-byte ceilings are checked before copying. Halt/reset/finalize attempt every cursor close even after a close diagnostic; an earlier operation error remains authoritative, otherwise the first cleanup diagnostic is reported after reset/finalize state and connection admission are restored. Focused tests exercise exact real-operation charges and injected multi-cursor cleanup failures. The compiler now lowers every ORDER term in the admitted direct-column slice, resolving each term independently as a result alias, positive result ordinal, or table-column fallback. Each resolved term supplies its declared collation, direction, and NULL-order flag to one immutable multi-field `KeyInfo`; `SorterInsert` transfers the complete key register range to shared `compareMem` comparison. Integer LIMIT/OFFSET and direct-column/direct-expression DISTINCT remain admitted. DISTINCT comparison uses the complete projected record and resolved per-term collation; `Found` is patched after variable-length ORDER-key lowering and `SorterInsert`, so duplicate records bypass the whole sorter-production route. At that relational checkpoint, generalized schemas and compounds remained explicitly staged; the bounded compound completion below supersedes the latter status. Public accounting in `run-relational-working-state-ts.mjs` is 3 attempted/passed public assertions of 18 declared, with 2 credited upstream cases: `up-limit-1.2.1` and `up-select4-10.3`. `up-distinct-3.0` passes publicly but remains no-credit because its generated fixture omits upstream `UNIQUE(a,b)` while automatic-index schema loading is unsupported.

### 2026-09-14 audit integration: numeric callers and relational foundation

The 14-case no-credit audit now distinguishes the pinned value-conversion owners instead of routing all conversions through CAST NUMERIC. `Mem.numericTypeCopy()` follows `src/vdbe.c:numericType`/`computeNumericType`: it preserves the source register, accepts a numeric prefix, and keeps decimal/exponent spellings REAL. `Mem.cast("integer")` follows `src/vdbemem.c:sqlite3VdbeIntValue` and consumes only the signed decimal prefix. Boolean/CASE uses the shared VDBE boolean primitive and `abs` retains `src/func.c:absFunc` storage-class dispatch. This makes the pinned/public typed audit 14/14 while retaining zero credit pending a separate promotion decision.

The same integration commit carried the previously blocked relational foundation work: bounded private sorter/ephemeral state, source-shaped SeekGE/Next state transitions, deterministic accounting, and cleanup/reset coverage. That statement is historical: the current public relational manifest attempts/passes 3 of 18 and credits 2 exact-setup cases. `up-distinct-3.0` remains no-credit solely because automatic-index schema loading prevents fixture parity with upstream `UNIQUE(a,b)`. At that relational-foundation checkpoint, compounds, aggregates, windows, joins, and generalized consumers remained explicitly staged. The bounded compound completion below supersedes the compound status; the other listed gaps remain.

### ORDER/LIMIT test-first contract (implementation handoff)

The zero-credit capture in `stage3-order-limit-contract.json` is independently
produced by pinned SQLite 3.53.4 and does not itself alter the relational
machine denominator. Its public TS test separates the already admitted direct
column/alias/positive-ordinal direct-column sorter path from temporary unsupported
expression, explicit COLLATE/NULLS, and broader LIMIT forms. Revision history matters:
`3104d7a` exposed an accepted multi-term query while the implementation retained only
one-term `KeyInfo`, and [[card:card-j-b-a]] observed the resulting missing expected
exception; `af6ee17` therefore temporarily rejected multi-term syntax, while `37fd90b`
retained its pinned expected rows. The current repair replaces that safety rejection
with complete admitted-term preservation and multi-field `KeyInfo`/sorter comparison.
At that ORDER/LIMIT checkpoint, compounds and subqueries were still owned by structural query-production gates: generated `multiselect_op`, nested `seltablist ... LP select RP`, and subquery-expression reductions were retained as `SelectNode` flags and rejected as typed temporary unsupported before scalar or table lowering. The compound status is superseded by the completion sections below; subqueries remain gated.

| Contract behavior | Pinned control/source | Implementation handoff |
|---|---|---|
| alias, positive ordinal, expression and multi-term resolution | `resolve.c:resolveAsName`, `resolveOrderGroupBy` | preserve result-list matching before ordinary name resolution; retain every term and its expression identity |
| ASC/DESC, NULLS FIRST/LAST, BINARY/NOCASE/RTRIM and typed keys | `select.c:pushOntoSorter`, `generateSortTail`; `where.c` ordered-loop decisions; `vdbe.c` sorter opcodes; `vdbeaux.c:sqlite3VdbeRecordCompare*` | construct complete immutable `KeyInfo`; compare NULL/INTEGER/REAL/TEXT/BLOB through shared Mem/record comparison, with rowid only where the fixture explicitly stabilizes a tie |
| LIMIT/OFFSET zero, negative and coercion failures | `select.c:computeLimitRegisters`; `vdbe.c` `MustBeInt`, `OffsetLimit`, `IfNotZero`, `DecrJumpZero` | evaluate/coerce in VM registers, preserve step-time `SQLITE_MISMATCH`, negative LIMIT as unbounded, negative OFFSET as zero |
| duplicate output columns and errors | `vdbeapi.c` column metadata; resolver/VDBE error branches | preserve positional metadata and prepare-versus-step error phase |

The capture asserts numeric ties only with an explicit final `rowid` term; it makes
no promise for otherwise equal ORDER keys. `expressions40` remains regression-only
and confers no ORDER/LIMIT credit.

### ORDER expression and computeLimitRegisters completion ([[card:card-j-b-b]])

The generated parse action now retains each `sortlist` expression, direction, and
NULL placement plus both `limit_opt` expressions instead of reconstructing these
productions from flat tokens. `compileTableSelect` follows
`resolve.c:resolveOrderGroupBy`: after skipping outer COLLATE nodes, alias and positive ordinal matching precede
identical result-expression reuse and ordinary table expression resolution. Alias or ordinal substitution occurs beneath retained explicit COLLATE wrappers, matching `resolve.c`'s `sqlite3ExprSkipCollateAndLikely`/`resolveAlias` branch. Each
resolved expression is compiled by the existing expression opcode lowering and
its collation, DESC, and `KEYINFO_ORDER_BIGNULL` equivalent enter immutable
`KeyInfo`. Emitted `MustBeInt`, `OffsetLimit`, `IfNot`, `IfPos`, `IfNotZero`, and `DecrJumpZero` operations follow `select.c:computeLimitRegisters`, `codeOffset`, and `pushOntoSorter`;
`vdbe.c:OP_MustBeInt`: exact INTEGER, integral REAL, and base-10 integral TEXT are
accepted at first step; NULL, fractional/non-numeric text, and overflow report
`SQLITE_MISMATCH` (20). Negative LIMIT means unlimited, negative OFFSET becomes
zero. Matching `select.c:computeLimitRegisters`'s placement before result production and immediate zero test, scalar lowering emits LIMIT/OFFSET expression and coercion opcodes before deferred result-expression opcodes, while table lowering emits them before scan/sorter setup. The emitted `IfNot` jumps to the program halt target after both LIMIT and OFFSET have been successfully coerced when LIMIT is zero. Thus zero LIMIT skips failing or work-heavy result expressions and all table work, but an invalid OFFSET retains its execution-phase error. The pinned `SELECT abs(-9223372036854775808) LIMIT 0` native/public lifecycle regression distinguishes this ordering. Tests retain execution-phase errors
and statement cleanup. At that checkpoint compounds and subqueries remained
structurally unsupported. The compound status is superseded below; subqueries remain unsupported.
The 29-case capture is a focused contract; its inventory does not alter relational
accounting. Current machine accounting attempts/passes 3/18 and credits 2/18;
the passing DISTINCT assertion remains no-credit pending exact UNIQUE-autoindex
fixture parity.

### Compound SELECT and structured multirow VALUES design (superseded implementation handoff)

> **Superseded checkpoint (2026-09-15):** the zero-credit and 15-attempt figures
> below describe the pre-implementation handoff, not current conformance. The
> current exact public contract is 22 declared / 22 attempted / 22 passed / 22
> credited; current implementation and adaptation details are recorded in the
> later completion sections. Every imperative and present/future implementation
> statement in this superseded design body records the historical proposal only;
> it is not current guidance where a later completion section differs.

#### Immutable query graph and preparation contract

Replace the monolithic `SelectNode` flags with a closed query-production graph.
Exact type names may follow project style, but these fields and ownership are the
implementation contract:

```ts
type CompoundOperator = "union-all" | "union" | "intersect" | "except";
type SelectArm = {
  readonly id: number;                 // dense, left-to-right within this query
  readonly prior: number | null;
  readonly next: number | null;
  readonly operatorFromPrior: CompoundOperator | null; // null only at arm 0
  readonly result: readonly ExprNode[];
  readonly from: readonly SqlToken[];
  readonly where: ExprNode | null;
  readonly distinct: boolean;
};
type SelectQuery = {
  readonly kind: "select-query";
  readonly arms: readonly SelectArm[]; // root/rightmost is arms.at(-1)
  readonly orderBy: readonly OrderTermNode[];
  readonly limit: ExprNode | null;
  readonly offset: ExprNode | null;
  readonly origin: "select" | "values";
  readonly valuesRows: readonly (readonly ExprNode[])[] | null;
};
```

Dense link indices are the immutable TypeScript adaptation of `Select.pPrior` and
`pNext`: they retain both directions and operator-on-RHS ownership without a
cyclic object graph or a mutable post-parse linking pass. Validate at construction
that ids and links are reciprocal, arm 0 has no operator, every later arm has one,
and only the rightmost production owns ORDER BY/LIMIT/OFFSET. Keep each arm's
own result/from/where/distinct and reduction-backed expressions; never flatten
arms into one result list. Unsupported per-arm GROUP/HAVING, windows, subqueries,
CTEs, joins, or other existing exclusions remain represented sufficiently to
reject the whole query before lowering.

Production-keyed Lemon actions construct this graph as reductions occur. This is
an exact integration requirement, not shorthand for the current end-of-command
tree walk: extend `productionAction()` so `values`, both `mvalues`, ordinary
`oneselect`, `selectnowith ::= oneselect`, and `selectnowith ::= selectnowith
multiselect_op oneselect` each return their own immutable semantic value; parent
actions consume `child.semantic`. The compound action appends the RHS arm with its
exact operator, and `select ::= selectnowith` finalizes reciprocal indices before
`cmd ::= select` publishes that semantic unchanged. Retire
`topLevelOneSelect()`/`findAll(...multiselect_op...)` as query construction inputs;
they may not remain an alternate parser over the accepted reduction tree.

This matters at current HEAD: `lemon-runtime.ts` already invokes the callback at
every reduction and retains `semantic`, but `parse.ts:productionAction()` currently
authors query semantics only for `cmd ::= select`, then recursively discovers one
`oneselect` and reduces compound/VALUES identity to booleans. That is the safe
rejection foundation from audit finding 1, not the required graph. Do not remove
its rejection until all production semantics and graph validation are consumed by
the compiler.

Concretely, `oneselect ::= SELECT ...` creates one arm; the compound production
appends the RHS and its exact operator; `values ::= VALUES LP nexprlist RP` creates
row zero; both `mvalues` reductions append one ordered expression row. The
`oneselect ::= mvalues` action records the equivalent of
`SF_Values|SF_MultiValue`. Do not infer row boundaries from commas or walk the
accepted token stream afterwards. Copy/freeze reduction values at their owner.
Preserve SQL-wide parameter identity through the existing generated expression
reductions.

Structured VALUES is one query with `origin:"values"`, `valuesRows`, and one
logical arm, rather than fabricated UNION tokens. Validate nonempty rows and equal
width at prepare. Its result expressions and column names come from row zero;
all rows retain independent expression nodes and evaluation order. Parenthesized
VALUES/subquery uses remain excluded with subqueries. Bare standalone VALUES does
not admit ORDER BY or LIMIT in SQLite's grammar: the pinned
`multirow-values-order-limit` case fails at prepare with `near "ORDER": syntax
error`. Such clauses require a surrounding SELECT/subquery form, which remains
excluded with subqueries. The special path corresponds to `parse.y:values`/
`mvalues` and `select.c:multiSelectValues`; it is not subject to the ordinary
compound-arm limit.

Preparation performs, in order: structural/exclusion validation; VALUES and
compound width validation; per-arm ordinary name/expression resolution; compound
ORDER resolution; metadata/KeyInfo construction; then VDBE lowering. Syntax errors
remain parser-time. Unequal widths, invalid ordinals, unmatched compound ORDER
terms, unavailable collations, and excluded constructs fail `prepare()` before a
statement/program is exposed. LIMIT/OFFSET value coercion remains first-`step()`
work. No valid prefix arm may execute after any prepare failure.

#### Resolution, metadata, affinity, and equality

Port `resolve.c:resolveCompoundOrderBy` as a dedicated resolver over arms from
left to right. For each still-unmatched ORDER term, skip outer COLLATE/LIKELY,
accept a positive integer within result width, otherwise try that arm's result
alias and then structural expression identity after resolving a duplicate in that
arm's name context. Mark the term with a result-column index on first match and
continue later arms only for unmatched terms. Preserve an explicit COLLATE wrapper
when replacing its child with the ordinal. Unlike ordinary SELECT ORDER BY, never
fall back to an arbitrary table expression: every term must match an output
column. This produces the native ordinal/range or “ORDER BY term does not match”
prepare error, including duplicate aliases and expressions.

Public result name, declared type, database/table/origin metadata come from the
leftmost arm, matching `sqlite3ResultSetOfSelect` and the accepted
`leftmost-names-origin` capture. Keep resolved metadata per result position,
separate from runtime `Mem`. Where a compound is consumed as a derived table in a
future admitted slice, port `sqlite3SubqueryColumnTypes`: scan arms left-to-right
for affinity, degrade conflicting data-type classes as that routine does, and take
collation/type provenance from the leftmost expression. Do not apply one arm's
affinity to set duplicate comparison or coerce emitted public values; each arm
keeps its manifest INTEGER/REAL/TEXT/BLOB class.

`multiSelectCollSeq` selects, per result position, the first non-null expression
collation from left to right, then BINARY. Use it for set duplicate `KeyInfo` and,
unless the ORDER expression has explicit COLLATE, for compound ORDER. Set equality
compares the complete result row through the existing `Mem`/`KeyInfo` machinery:
NULL equals NULL; exact INTEGER/REAL numeric equality is shared; TEXT uses the
selected built-in byte collation; BLOB remains distinct from TEXT; no affinity is
applied. DESC and NULL placement belong only to merge-order terms, never the
duplicate key. Preserve the source transition's chosen representative when equal
rows have different storage classes (the gate's `1 UNION 1.0` returning REAL is a
required discriminator), rather than normalizing a set key.

#### Lowering, destinations, and control

Introduce one internal `compileQueryToDestination(query, destination, context)`
seam. Refactor current scalar/table SELECT production to emit through destination
semantics equivalent to the applicable `selectInnerLoop` branches, at minimum
`output` and `coroutine`; do not duplicate expression evaluation in a compound
compiler. A coroutine destination writes its row register range and executes a
translated `Yield`; output executes `ResultRow`. Register ranges, metadata,
labels, cursor ids, and immutable `KeyInfo` are allocated by the existing Program
builder and have one statement owner.

Lower structured VALUES by evaluating rows left-to-right into the same destination
(`multiSelectValues`/`selectInnerLoop`), honoring the common OFFSET/output/LIMIT
control. Lower unordered `UNION ALL` by compiling arms left-to-right to the common
destination, carrying the one global limit/offset register set; an exhausted limit
jumps over all remaining arms. Preserve branch order and multiplicity.

For every explicit ORDER compound, and for UNION/INTERSECT/EXCEPT without ORDER,
port `multiSelectByMerge`. The latter synthesizes ordinal 1, then appends every
missing result ordinal so set equality is total. Apply the pinned split rule
exactly: balanced splitting is only across contiguous same-operator UNION ALL or
UNION chains when the pinned `SQLITE_BalancedMerge` optimization is enabled;
chains of three or fewer and EXCEPT/INTERSECT split at the rightmost arm. This is
not a generic recursively balanced AST rewrite because mixed operators retain
SQLite's left-to-right grouping. Compile each side to coroutine registers; sort
each side through the existing typed sorter only where its copied resolved ORDER
requires it. Build the merge permutation and complete order `KeyInfo`, plus a
separate full-row duplicate `KeyInfo`. Translate the `InitCoroutine`, `Yield`,
`EndCoroutine`, `Gosub`, `Return`, `Permutation`, and `Compare` program/control
branches (or source-shaped typed opcode equivalents) and the exact transition
matrix:

| state | UNION ALL | UNION | EXCEPT | INTERSECT |
|---|---|---|---|---|
| A < B | output A; next A | output A; next A | output A; next A | next A |
| A = B | output A; next A | next A | next A | output A; next A |
| A > B | output B; next B | output B; next B | next B | next B |
| EOF A | drain B | drain B | halt | halt |
| EOF B | drain A | drain A | drain A | halt |

The output subroutine performs prior-row duplicate suppression for every non-ALL
operator before destination output and owns OFFSET and LIMIT. In particular,
UNION ALL emits both ordered streams including ties; UNION emits one
representative; INTERSECT emits equality matches only; EXCEPT emits left rows
absent on the right. Preserve source representative selection: on A=B, UNION
advances A without output and subsequently selects B through the A>B/EOF path,
while INTERSECT outputs A. Tests must pin these operator-specific storage-class
choices rather than assuming one normalization rule.

This historical design intentionally did **not** propose the older
materialize-both-sides set plan, JS `Set`, `Array.sort`, or a host generator
evaluator. The pinned 3.53.4
`multiSelect` routes all non-ALL operators through `multiSelectByMerge` (inventing
ORDER when absent), so using the existing bounded stable sorter for individual
ordered producers and translating the VDBE merge is ordinary adaptation, not an
algorithm substitution. No exceptional substitution was proposed at this
checkpoint. The later completion instead accepts and documents bounded typed
materialization (never JS `Set`/`Array.sort`) as an exceptional substitution. The existing
`EphemeralIndexCursor` remains available to translated destinations but is not a
reason to replace the pinned compound algorithm.

Call `computeLimitRegisters` once before coroutine initialization, but preserve its
actual branch order rather than the current single-SELECT adaptation. At first
step evaluate/coerce LIMIT first. A literal integer zero emits an immediate jump
to the compound end before OFFSET code; a non-literal LIMIT emits `MustBeInt` and
`IfNot` before OFFSET code. Therefore zero LIMIT skips OFFSET evaluation as well as
all producers in the pinned compound path. If LIMIT is nonzero, evaluate/coerce
OFFSET, compute `OffsetLimit`, then initialize arms. Negative LIMIT is unbounded
and negative OFFSET becomes zero. Tests must distinguish literal zero,
parameter/expression zero, and nonzero LIMIT with invalid OFFSET; do not copy the
current admitted single-SELECT guarantee that zero LIMIT still coerces OFFSET into
that then-future compound contract.

For UNION ALL only, copy `LIMIT+OFFSET` (the `iOffset+1` register when OFFSET is
present, otherwise LIMIT) as an identical cap into both producer coroutines while
retaining the single global output counters. This is a per-side work bound, not a
partitioned budget. For set operators do not let an arm-local cap alter duplicate/
set membership. OFFSET is consumed once in the output subroutine, and LIMIT
decrements only after a row reaches its destination. Only the rightmost arm may
syntactically own these clauses.

#### Async, resources, lifecycle, and verification

Each opcode dispatch, input advance, comparison term, copied logical byte, sorter
insert/move, and merge advance uses the existing deterministic work/cancellation/
deadline controls. `maxRows` is a public-destination counter only: charge it exactly
when `ResultRow` returns a `"row"`, globally across one compound execution until
reset. It must not cap scanned or produced rows, VALUES rows, coroutine yields,
sorter entries, or ephemeral set keys. In particular, duplicate suppression,
compound membership, and ordered input work may consume more private entries than
`maxRows` while legally emitting no more than `maxRows` rows.

Private growth instead uses a separate immutable `PrivateStateLimits` carried by
the Program/statement: a finite implementation `maxPrivateEntries`, existing
per-key (`maxKeyBytes`) bound, and finite aggregate `maxPrivateBytes`, plus
`maxWorkUnits`. Entry, key, and aggregate-byte failures map to `kind:"limit"`
without pretending to be SQLite result codes. The connection defaults for these
internal limits must be documented and tested before compound admission; they are
not aliases for `maxRows` or `maxResultBytes`. The current operation API can only
tighten `maxWorkUnits`, so that tightening composes independently with the
statement's private entry/byte ceilings and cannot relax them. If a later public
operation option tightens private ceilings, it may only take the minimum and must
be fixed for the execution across suspension.

The consuming refactor is implemented in `src/internal/vdbe.ts`: every
`SorterCursor`/`EphemeralIndexCursor` receives the immutable
`program.privateStateLimits` (`100,000` entries, `16 MiB` per key, `256 MiB` aggregate by default), never `program.maxRows` or `maxResultBytes`; the separate `ResultRow` checks retain exclusive ownership of public row/byte limits. Generic `Copy` follows pinned `src/vdbe.c:OP_Copy`: it deep-copies and charges deterministic work but does not apply the public result-byte ceiling, because the destination may be a private sorter key/payload or ephemeral record; `ResultRow` checks each value immediately before publication, while output-growing scalar functions keep their source-shaped preflight. A public regression stages oversized losing ORDER rows under generous private limits, returns a small `LIMIT 1` winner, and separately rejects the same oversized value when it is delivered. `src/internal/private-state.ts` continues to own
pre-copy entry/key/aggregate-byte checks and rollback after failed post-growth
control checks. Growth also respects register/program/column/compound and
expression/parser limits. A suspended `step()` retains PC, both coroutine PCs and
EOF/current-row states, registers, sorter phases/cursors, duplicate previous-row
state, counters, and the first error; resume never reevaluates a VALUES row or arm.
Coroutine row registers own/copy `Mem` values across yields—no page/register borrow
may outlive cursor movement. Result rows retain the existing public copy and
row-invalidation contract.

Halt, reset, finalize, completed connection destruction, cancellation, deadline,
and any arm/runtime error unwind both coroutines and every private cursor exactly
once. Continue cleanup after a diagnostic, preserve the earlier operation error
over cleanup errors, and restore connection admission where the connection remains
open. Reset retains bindings and rebuilds execution state; finalize destroys the
statement's graph/program/private state.

Connection lifetime follows the existing public owner and serialized-admission
boundaries precisely. A `close()` attempt with any statement returns `SQLITE_BUSY`
and leaves the connection, statement graph/program/KeyInfo, schema references, and
resident storage intact and usable. `closeDeferred()` only marks connection
admission zombie when it is validly admitted: it rejects new connection operations
but does not destroy or invalidate existing statements or anything they reference.
Those statements remain usable for step, row access, reset, and finalize; immutable
query graphs, programs, `KeyInfo`, schema/storage references, and resident database
bytes survive until the last statement finalizes and zombie deletion completes.
Only that completed destruction boundary releases connection-owned schema/storage.

A pending `step()` retains the one connection operation admission across every
bounded host yield and suspended VM state. Calling `closeDeferred()` (or any other
stateful operation) during that pending promise throws synchronous
`JSQLiteError(kind:"misuse")`; it does not mark the connection zombie, cancel or
restart the step, mutate coroutine/private state, or release owners. After the
promise settles to `"row"`, `"done"`, or an error, admission is released and a
separate `closeDeferred()` call may establish the zombie state. Private execution
state still unwinds at halt/reset/finalize, a current row follows the existing
invalidation/copy contract, and deferred deletion never displaces an earlier
operation/finalize/cleanup error.

Implementation seams are `src/internal/parse.ts` (production actions/types), a
new resolver/query-graph module or the existing compiler resolver,
`src/internal/vdbe.ts` (destination lowering and control opcodes),
`src/internal/private-state.ts` (reuse, not replacement), and
`src/internal/comparison.ts` (`KeyInfo`/`compareMem`). Focused tests must include:

* parser graph snapshots for all four operators, three-plus arms, reciprocal
  links, per-arm clauses, structured one/many-row VALUES, and malformed/unequal
  rows; generated-table determinism and “no token reparse/second parser” guards;
  reduction-callback tests must assert non-undefined semantic values at `values`,
  both `mvalues`, ordinary `oneselect`, and both `selectnowith` productions, and
  assert `cmd` publishes its child's graph rather than rediscovering descendants;
* all 22 pinned gate cases through public APIs, retaining metadata, INTEGER/REAL,
  NULL, encoded TEXT, BLOB, exact errors and prepare/step phase; recapture remains
  exact and zero-credit until implementation promotion. The separate 12-case
  `stage3-compound-values-boundaries` pinned-native companion freezes initial
  collation/representative/duplicate-run/ORDER/LIMIT discriminators without
  changing the 22-case denominator or granting TS credit;
* duplicate-neighbor matrices for NULL, int64/REAL boundaries and representative
  class, embedded-NUL BINARY/NOCASE/RTRIM text, TEXT versus BLOB, and per-column
  left-to-right collations; mixed operators and duplicate runs across merge sides;
* ORDER alias/ordinal/expression matches in later arms, duplicate aliases,
  explicit COLLATE/DESC/NULLS, missing/non-output/out-of-range errors, equal-key
  ordering without inventing stability, and full-row completion for unordered sets;
* global compound LIMIT/OFFSET zero/negative/integral-REAL/TEXT/error timing,
  early arm exhaustion, zero bypass of failing arm expressions, no incorrect set
  pruning, and bare multirow VALUES rejecting ORDER/LIMIT at prepare;
* strict separation of public and private limits: duplicate-heavy UNION/DISTINCT
  where scanned/private entries exceed `maxRows` but deduplicated output does not;
  ordered LIMIT/OFFSET where sorter input exceeds both `maxRows` and delivered
  rows; a control where public `ResultRow` output really exceeds `maxRows`; and
  independent entry, key-byte, aggregate-private-byte, and work failures with
  `kind:"limit"`. Assert cursor construction receives `privateStateLimits`, never
  `program.maxRows`/`maxResultBytes`, and that operation `maxWorkUnits` only
  tightens work;
* injected yield/cancel/deadline/resource failures in each coroutine and merge
  phase, exact work charges, reset/rerun with retained bindings, finalize/close,
  multi-cursor cleanup failures, and first-error precedence;
* busy `close()` preserving full usability, plus successful `closeDeferred()`
  after prepare before first step and after a current row. Separately, start a
  chunked `step()`, observe a bounded host yield while its promise remains pending,
  and require an overlapping `closeDeferred()` to throw synchronous `misuse`
  without changing admission, VM/coroutine/private state, or row access rules;
  resume the same pending step and prove it does not restart or duplicate work.
  Only after that promise settles, call `closeDeferred()` successfully and verify
  new prepares/connection operations reject while the pre-existing statement
  remains usable according to its settled row/done/error state for row access,
  further step, reset/rerun, and finalize. Across valid zombie cases, verify public
  row copies survive their stated lifetime, last finalize completes deletion
  exactly once, all private and resident owners release only then, and an earlier
  execution/finalize error outranks deferred cleanup diagnostics.

Remaining risk is concentrated in exact generated semantic action plumbing,
source equality representative transitions, compound metadata affinity when later
used as a subquery, and adding coroutine/subroutine VM state without weakening the
single-running-operation invariant. Resolve those with focused pinned-oracle cases
before credit; the present design changes no public scope or exclusion.

#### Structured VALUES implementation checkpoint (2026-09-16)

The generated reduction tree now owns immutable `SelectArm` links and structured
`values`/`mvalues` rows. Standalone VALUES lowers each row through the existing
expression compiler and `ResultRow` VDBE destination, preserving row/expression
order, parameter numbering, Mem storage classes, suspension, bounds, reset and
finalize. Width is validated atomically at prepare. This translates the applicable
`parse.y:values`/`mvalues`, `select.c:multiSelectValues` and `selectInnerLoop`
branches without reparsing tokens or adding an evaluator. Compound arms were then retained in the same graph, but their merge/destination
lowering remained gated as temporary unsupported; no prefix arm could execute.
Later completion sections supersede this chronological checkpoint.

The first compound destination branch is now active: scalar, unordered `UNION
ALL` arms compile in source order to one VDBE output destination with one
compound-wide LIMIT/OFFSET register set. Width is checked before program
publication, LIMIT coercion remains at first step, and LIMIT zero branches around
all arm expression work. Ordered and duplicate-eliminating operators remain
prepare-time unsupported pending merge-coroutine lowering.

Unordered scalar `UNION` now uses the typed private ephemeral-index path with a
full-row no-affinity KeyInfo. Equal insertions replace the retained row (thereby
preserving SQLite's right-side representative, including INTEGER/REAL equality),
and the private index performs a bounded stable merge-sort before output. NULL
compares equal while INTEGER/TEXT and TEXT/BLOB remain distinct. This is the
`multiSelect` ephemeral b-tree route, not the still-unimplemented ordered
`multiSelectByMerge` coroutine route.

Scalar `INTERSECT` and `EXCEPT` now extend that same private-set lowering for
left-associative chains whose later transitions remain set operators. `EXCEPT`
removes matching full keys; `INTERSECT` probes the accumulated left set and
replaces it with a fresh bounded ephemeral set. An initial `UNION ALL` run is
collapsed when a following set operator requires set semantics, matching
`multiSelect`'s recursive destination behavior. At this checkpoint a later `UNION ALL` transition remained gated until destination
multiplicity after a set transition was lowered. The set-prefix handoff completion
below supersedes that gap.

Compound-wide LIMIT/OFFSET is now also initialized before scalar set-arm work
and applied only while traversing the final set, so duplicate elimination and
INTERSECT/EXCEPT happen before OFFSET/LIMIT. The first bounded ordered-set slice
resolves one-column ORDER aliases across arms, ordinals, and structurally
matching output expressions; unknown terms and out-of-range ordinals are SQLite
prepare errors. Ordering reuses the final ephemeral KeyInfo (DESC/NULL flags),
not host sorting. At this checkpoint multi-column ordered set output remained gated;
the later finite-producer materialization completion supersedes that gap.

The ordered `UNION ALL` branch now emits every finite scalar/VALUES arm into the
existing typed stable sorter destination and traverses it with the compound-wide
LIMIT/OFFSET registers. Its resolver retains every ORDER term and builds a complete
KeyInfo while the payload retains every result column. This preserves duplicates,
source order among equal keys, multi-term ordering, and top-N private-state bounding
without `Array.sort`. It is a browser adaptation of `multiSelectByMerge` for finite
in-memory producers: materialization avoids coroutine machinery while retaining
the source resolver/KeyInfo observables, async output suspension, work checks, and
final semantics. Source-based focused tests compare aliases/ordinals, multi-term
ordering, multiplicity, metadata, and LIMIT/OFFSET. At this checkpoint table
producers remained gated. The later direct-column table completion supersedes that
limited status while broader table producers remain excluded.

Structured VALUES is now also a first-class compound arm producer. Each retained
`mvalues` row is compiled independently into the selected ALL/sorter/ephemeral
set destination; there is no synthesized UNION graph and no token comma scan.
Arm width (including every VALUES row) is validated before program publication.
For INTERSECT, all rows of the right VALUES arm populate the auxiliary set before
the accumulated set is swapped, preserving arm-level rather than row-level set
semantics.

A generated-parser recovery boundary now prevents arm-local ORDER/LIMIT tokens
before a later compound arm from being discarded. The complete arm graph's
source offsets are compared with accepted ORDER/LIMIT terminals; such tokens
produce a prepare-time syntax error before lowering. This is not token parsing:
the operator/arm graph and clause semantics remain generated-reduction owned;
the check preserves an unimplemented/error-recovered construct for honest
rejection and prevents partial-arm execution.

Parser failures now retain the Lemon input position that selected the terminal
error action. `parseSql` reports the offending accepted terminal, or `incomplete
input` at end-of-input, matching the pinned parser's VALUES ORDER and trailing
comma diagnostics without rescanning SQL. Compound width diagnostics use the
actual generated operator link, and recovered arm-local clauses name that link
in SQLite's clause-placement error.

The two pinned table-arm contracts now lower through a bounded shared compound
destination. The admitted shape is one direct column from each single-table,
no-WHERE arm. UNION ALL performs consecutive full scans into one ResultRow
destination; UNION inserts into one typed ephemeral index whose KeyInfo collation
comes from the leftmost result column. Public metadata likewise comes solely
from the leftmost table/result alias. All tables and columns resolve before the
program is published. More complex table expressions, WHERE arms, mixed set
operators, and joins remain atomically gated.

### Compound table producer A/B handoff follow-up (2026-09-16)
The direct-column table producer supports the bounded `multiSelect` A/B handoff: a prefix ending in `UNION`, `INTERSECT`, or `EXCEPT` is completed in the typed ephemeral destination before a trailing `UNION ALL` suffix resumes direct row production. This preserves left-to-right set semantics and suffix multiplicity without partial-arm publication. In particular, `INTERSECT` builds right-arm membership separately and filters the existing left ephemeral records, preserving SQLite's left representative across INTEGER/REAL and collation equality rather than replacing it with the matching right record. The adaptation maps pinned `select.c` `multiSelect` destination switching while retaining the existing browser-safe VDBE suspension loop. An `ORDER BY` over this mixed table handoff uses one typed global sorter destination after set-prefix completion, preserving compound-wide alias/ordinal/expression resolution, collation, direction, NULL policy, and LIMIT/OFFSET. This bounded materialized merge is the browser adaptation of `multiSelectByMerge` for the admitted finite direct-column producers. Wider table expressions/rows remain prepare-time gated.

Active public compound lifecycle coverage now forces the VDBE's 256-work-unit browser yield during a ten-arm table `UNION ALL`, proves exclusive connection/statement admission while suspended, cancels at the resumed checkpoint, and verifies reset executes all 320 rows once without restart or duplication. Companion table set-transition tests force deadline and exact work failures, entry/key/total private-state bounds, first-error reset/finalize behavior, cleanup, and later connection admission. These tests exercise the singular public prepared statement path in `test/conformance/compound-union-all.test.mjs`.

Private-limit separation regression (2026-09-16): public-path tests prove duplicate/set and ordered inputs may exceed `maxRows` when delivered output does not, while entry, key-byte, aggregate-private-byte, output-row, and existing scalar output-byte failures remain independently owned. Constructor assertions freeze finite Program defaults. These companion checks do not change the exact compound gate denominator (22 declared/attempted/credited).

Generated SELECT ownership is now reduction-local: `values` and both `mvalues` rules build immutable ordered rows; ordinary/VALUES `oneselect` rules build arm semantics; both `selectnowith` rules append immutable arms/operators; `select` builds the final node and `cmd ::= select` publishes its child semantic. Recursive command-tree discovery and flattened operator words are no longer graph construction inputs. Callback tests require non-undefined semantics throughout this chain. Compound LIMIT lowering emits its zero branch immediately after LIMIT coercion and before OFFSET expression code; single-SELECT retains its separately evidenced post-OFFSET branch. Literal/bound zero, invalid nonzero OFFSET, reset/finalize, and producer bypass are public-path tested.

#### Scalar compound collation and exact-accounting completion (2026-09-16)

Scalar compound lowering now resolves one result collation per output position by
walking generated arms left-to-right and taking the first expression with an
explicit BINARY/NOCASE/RTRIM collation, including `EP_Collate` propagated from
admitted function argument lists as pinned `expr.c:sqlite3ExprCollSeq` does, and
falling back to BINARY. This directly maps
pinned `select.c:multiSelectCollSeq`; the full-row duplicate `KeyInfo` uses those
collations for UNION/INTERSECT/EXCEPT equality. Compound ORDER terms without an
explicit COLLATE inherit the resolved result collation, while an explicit ORDER
COLLATE owns a separate sorter `KeyInfo` and cannot change duplicate membership,
matching `multiSelectByMergeKeyInfo` and its separate `pKeyDup`. Finite scalar and
VALUES producers remain materialized in the bounded TypeScript sorter rather than
native coroutines: browser-safe finite producers do not need resumable native
subprograms, while typed comparison, representatives, ordering, limits, async
publication, and all private bounds remain observable-equivalent. Pinned-native
and singular-public tests cover leftmost/later-arm NOCASE, RTRIM, per-position
keys, inherited and overridden ORDER collation, and TEXT/REAL representatives.

The core contract remains 22/22 exact public cases. Accounting now records actual
operation attempts: all successful/step-error cases attempt the full six-operation
protocol; seven prepare-error cases attempt open, prepare, and close and retain
metadata, step, and finalize as unattempted. Runtime traces must equal that
manifest partition before a passing case receives credit; native expectations and
TS credit remain independently validated.

#### Set-prefix to trailing UNION ALL completion (2026-09-16)

Scalar and structured-VALUES compounds now complete every left-to-right set prefix
in the existing typed ephemeral destination and hand its retained representatives,
followed by every trailing `UNION ALL` row in source order and multiplicity, to one
shared output or sorter destination. Unordered output is the direct
`multiSelect`/`SRT_Output`-shaped route. Ordered finite scalar/VALUES producers use
the bounded materialized sorter instead of native resumable coroutine subprograms:
the browser/TypeScript VM has finite generated producers but no native VDBE
subprogram stack, while the substitution preserves typed comparison, duplicate
representatives, global ORDER/LIMIT/OFFSET, async publication and private bounds.
The exact public denominator remains 22 declared/attempted/passed/credited; focused
source-based companions cover the additional destination transition without
changing that denominator. Existing table-arm and broader SQL exclusions remain.

#### Aggregate private-byte ownership correction (2026-09-16)

`maxPrivateBytes` is owned by one statement execution, not by each private cursor.
`VdbeStatement` creates one `PrivateStateByteBudget` and passes it to every
`SorterCursor` and `EphemeralIndexCursor`; reserve, atomic replacement, deletion,
intersection filtering, clear, failed post-growth rollback, and close update that
shared budget. This matters for admitted compounds, where a primary set, an
INTERSECT membership set, and an ordered-output sorter can overlap. The public
regression uses two individually admissible 8-byte INTEGER records with a 12-byte
execution limit and requires the second cursor's insertion to fail, followed by
complete cleanup, deterministic rerun failure, preserved first error, and later
connection admission. Entry/key/work limits retain their existing owners.

This correction does not broaden SQL or change the accepted finite-producer
substitution for pinned `select.c:multiSelectByMerge`: admitted scalar, structured
VALUES, and direct-column table producers materialize through typed `Mem`/`KeyInfo`
private cursors because the browser TypeScript VM has no native resumable VDBE
subprogram stack. Ordering, duplicate representatives, collation, global
LIMIT/OFFSET, suspension, cancellation and finite aggregate bounds remain covered
through public source-based tests. Disk spill remains intentionally omitted; wider
table expressions, joins, per-arm WHERE, and other documented forms remain gated.

### Historical multi-source SELECT tests-first architecture ([[card:card-k-a]]; implementation state superseded below)

The runtime handoff is [`architecture/multi-source-select.md`](architecture/multi-source-select.md).
It translates the pinned `SrcList`/`NameContext`/expansion/resolution and
WHERE-loop/`NullRow` ownership before [[card:card-k]] consumes join code. The
production graph is an immutable ordered source list built by generated `parse.y`
reductions; expansion binds schema identities and monotonic cursor IDs, expands
`*`/qualified `*` with USING/NATURAL visibility, and resolves columns through
linked name contexts. ON/synthesized USING predicates retain their owning join
cursor and outer/inner flags rather than being flattened into WHERE.

The first legal planner tranche is streaming source-order nested loops with the
pinned match-register and NULL-row cursor protocol. This intentionally postpones
cost/index/reordering choices; it is not a substitute join evaluator and does not
materialize a Cartesian product. `sqlite3SrcListShiftJoinType` retains SQL source
order and RIGHT/FULL flags while marking every source left of the right-most RIGHT
join with `JT_LTORJ`; the graph carries this marker. RIGHT uses typed RHS match
state and a `WhereRightJoin` unmatched scan that nulls applicable left cursors and
re-enters the preserved interior-loop continuation. FULL combines that path with
LEFT match/NullRow control. `NC_UEList` alias substitution is available to WHERE
and tagged ON terms only after real source-column lookup, while a separate
`sqlite3SelectCheckOnClauses` check rejects outer-ON references to later sources.
RIGHT/FULL remain atomic prepare gates until their complete retained-order control
tranche passes. USING/NATURAL output ownership follows `lookupName`, not a fixed
left owner: INNER/LEFT unqualified and bare-star terms resolve to the left direct
column, RIGHT to the right direct column, and FULL to a source-order `coalesce`
expression with null origin/type metadata, affinity deferred to its first/left
argument, and expression collation;
qualified terms and qualified stars always retain their named source's direct
value, origin, affinity, and collation. `selectExpander` hides RHS USING terms from
bare `*` but emits the applicable `JT_LTORJ` term unqualified so this resolver
choice occurs. Every producer feeds the existing ResultRow/sorter/DISTINCT/compound destinations,
and all live private cursors share one execution-wide `PrivateStateByteBudget`.

The 47-case pinned-native gate is
`test/conformance/cases/stage3-multisource-select.{spec.json,json}`, captured by
`test/conformance/capture-multisource-select.py`. It freezes typed rows, ordered
metadata, all database encodings, lookup/wildcard/USING/NATURAL errors, every join
family, outer unmatched/empty behavior, collation/affinity, relational and compound
composition, and reset/rebinding. Runtime-only cancellation/deadline/work/private
budget and no-Cartesian-materialization companions remain mandatory. The historical tests-first baseline assigned zero TS credit. The 2026-09-17 INNER-runtime revision below supersedes that statement only for admitted comma/CROSS/INNER forms; the 47-case artifact remains the unchanged total oracle denominator and outer-join cases remain gated.

Audit reconciliation: Finding 1's original production-identity defect is already
corrected by current compound reduction ownership. Findings 10/11's original
compound exclusion is superseded by the audit's 2026-09-16 completion revisions
(22/22 bounded compound gate and shared aggregate private-byte budget). Neither
revision claims joins; current multi-source compilation remains atomically gated.

### SrcList expansion and NameContext foundation ([[card:card-k-b]], 2026-09-16)

The generated Lemon `stl_prefix`/`seltablist` actions now own an immutable ordered
`SourceList`; RHS entries retain shifted join flags, ON/USING, aliases/index hints,
and `JT_LTORJ` markers. `src/internal/resolve.ts` is the current bounded port of
`selectExpander`, `sqlite3ProcessJoin`, and `lookupName`: it binds ordinary rowid
tables/cursor identities, expands stars, synthesizes and validates NATURAL/USING,
and retains direct versus FULL-coalesce identity with ordered metadata. Ordinary
qualified/unqualified lookup, ambiguity/missing diagnostics, alias-hidden table
names, declared-column precedence over rowid candidates, exact INTEGER PRIMARY
KEY rowid substitution with declared origin metadata, FULL merged affinity/collation,
and WHERE/ON `NC_UEList` source-first substitution are covered. Generated result,
WHERE, ON, GROUP BY, HAVING, ORDER BY, LIMIT/OFFSET, function-argument, FILTER,
and OVER reductions are walked too, so missing/ambiguous leaves in computed
expressions receive `lookupName` diagnostics before the multi-source runtime gate;
explicit COLLATE names are validated. The bounded `resolveSelectStep` port also
preserves source-before-result-alias lookup, GROUP/ORDER integer ordinals,
aggregate placement and nested-aggregate diagnostics, built-in function arity and
DISTINCT/FILTER ownership, empty LIMIT/OFFSET name contexts, and built-in window
owner/arity checks. Function arguments resolve before function ownership, while a
valid owner is established before FILTER/OVER children, matching pinned resolver
diagnostic ordering. This is semantic preparation, not function, aggregate,
GROUP/HAVING, ORDER, FILTER, or window execution credit.
ON expressions
resolve from their generated reductions, and outer-join owners reject references
to later sources per `sqlite3SelectCheckOnClauses`. Single-source public lowering consumes this graph and lowers implicit
rowid through a btree-cursor `Rowid` opcode.

The bounded compound-ORDER expression matcher follows pinned
`resolveCompoundOrderBy`/`sqlite3ExprCompare` structure rather than reconstructed
SQL. Resolved identifier leaves compare with SQLite identifier rules across
unquoted, double-quoted, bracketed, and backtick forms (including TRUE/FALSE when
they resolved as real columns); literal TRUE/FALSE tokens, BLOB spellings, named
and numbered variable spellings, and CAST type spans retain their separately
pinned token distinctions. Integer leaves compare by value only through signed
int64, including numeric underscores; overflow spellings remain distinct. Focused
oracle/regression coverage lives in `test/parser/resolver.test.mjs`.

The matcher consumes the generated `LemonValue` reduction tree directly. It does
not copy, splice, normalize, or reparse `ExprNode.tokens`; a source-level
regression rejects the removed `normalizedTokens`/`output.splice` implementation.
Pinned 3.53.4 multi-source capture is recaptured byte-for-byte in all three
database encodings, while public UTF-8/UTF-16le/UTF-16be tests independently
exercise duplicate result names plus NULL, empty TEXT, exact int64, and REAL
values through prepare/metadata/step. This is bounded evidence for the resolver
foundation, not a general expression-tree equivalence or multi-source evaluator.

This is not a join support claim. Multi-source public lowering remains an atomic
temporary prepare rejection. Join/predicate evaluation, GROUP/HAVING evaluation,
frame/window/aggregate execution, general/user-defined functions, complete FULL
expression lowering, and streaming join cursor control are downstream work and
are not completion criteria for this foundation. The
focused parser/resolver and public test files are `test/parser/resolver.test.mjs`
and `test/conformance/source-resolution.test.mjs`.


### Historical Comma/CROSS/INNER runtime revision ([[card:card-k-c]], 2026-09-17; outer-join status superseded below)

Ordinary rowid-table comma, CROSS, and INNER sources now lower to cursor-indexed
`OpenRead`/`Rewind`/`Column`/`Rowid`/`Next` opcodes and source-order nested loops.
ON and synthesized USING/NATURAL equality run at their owning source level; WHERE
runs at the innermost joined-row point. Projection, DISTINCT, ORDER BY, and LIMIT
reuse shared Mem, KeyInfo sorter, ephemeral, and result destinations. The admitted
joined `UNION ALL` arm is likewise a producer redirected into the existing global
compound sorter; this is destination adaptation, not eager Cartesian materialization.
RIGHT/FULL/LEFT unmatched-row control remains atomically unsupported.

The immutable native artifact remains exactly **47 declared/47 captured** cases; it
is not re-labelled as wholesale runtime credit. The admitted pinned/public matrix
is **8/8**, including the joined compound arm, and the focused multi-source runtime
suite is **27/27**. Source-based companions cover two/three sources, empty inputs,
USING/NATURAL visibility, affinity/collation, all encodings, reset/rebind, scan
order, bounded suspension, cancellation/deadline/work failure, private-state
budgets, cleanup, and streaming with zero private-state budget.

### LEFT JOIN NullRow repair ([[card:card-k-d]], 2026-09-17)

The first LEFT tranche now follows pinned `where.c` `iLeftJoin` control: each RHS
loop owns a match register set only after its ON/USING/NATURAL predicate succeeds;
a depleted or initially empty RHS enters one `NullRow` transition and resumes at
the joined-row body. `src/internal/vdbe.ts` owns `NullRow` as cursor state, so
`Column` and `Rowid` read NULL from that source shape and the ordinary innermost
WHERE path runs afterward. No host NULL-row object or Cartesian materialization is
introduced. Focused pinned/public evidence covers matched, unmatched, duplicate,
ON placement and post-join WHERE placement; broader LEFT composition and lifecycle
coverage remains to be completed before changing the 47-case denominator.

#### Historical LEFT bounded tranche completion ([[card:card-k-d]]; RIGHT/FULL status superseded below)

The public LEFT gate now covers the four LEFT-bearing cases in the immutable
47-case capture plus source-based companions for duplicate matches, false/NULL ON,
post-extension WHERE, empty RHS, USING/NATURAL wildcard and metadata ownership,
aliases, NOCASE affinity/collation, exact Mem classes, UTF-8/16le/16be, three-source
LEFT with LEFT/INNER/CROSS association, ORDER/DISTINCT/LIMIT, reset/rebind, and
cancel/deadline/work/row/private-state cleanup before and after matched/NullRow
transitions. This preserves the complete native **47/47 captured** denominator but
credits only LEFT execution; RIGHT/FULL remain gated. `where.c` `iLeftJoin` and
`OP_NullRow` control and `vdbe.c` cursor NULL state remain the translated owners.

### Historical RIGHT/FULL bounded runtime revision ([[card:card-k-e]], 2026-09-17; denominator superseded below)

Terminal RIGHT barriers now translate the pinned `WhereRightJoin` protocol without
source reversal. Successful ON/USING matches insert the original RHS rowid into an
existing typed ephemeral cursor under the statement-wide private-byte budget. Once
the normal source-order pass ends, the original RHS is rescanned, matched identities
are skipped, every cursor left of the barrier is put in `NullRow` state, and the
relocated VDBE interior continuation executes WHERE, projection, sorter/DISTINCT,
and LIMIT ownership for each unmatched RHS row. FULL combines this pass with the
existing LEFT match-register fallback. Resolver-owned FULL merged result columns
lower as source-order `Column`/`Rowid` plus `NotNull`, preserving direct qualified
columns separately.

The admitted pinned matrix is 7/13 RIGHT/FULL-bearing immutable cases: basic RIGHT
and FULL, empty left, a three-source left operand/barrier, ON and WHERE placement,
and two-source FULL USING/coalesce. Reset/rebind, cancellation, deadline/work and
private-entry failures cover cleanup and no restart. This is not complete RIGHT/FULL
credit: non-terminal barriers with downstream sources remain atomic temporary
unsupported, and multi-left RIGHT USING/NATURAL wildcard merging remains gated
because the current expanded result's merged identity does not yet supply the
`sqlite3ProcessJoin` effective multi-left value during unmatched output. Those six
immutable cases are the exact next tranche; no full-card compatibility claim is made.

### Historical 2026-09-17 RIGHT/FULL completion revision (scope corrected below)

The architecture-manifest denominator for this stage is the 15 RIGHT/FULL-adjacent cases in `stage3-multisource-select.json` (13 successful RIGHT/FULL executions and two join-resolution errors). All are now promoted through the public typed API. `resolve.ts` follows `select.c:sqlite3ProcessJoin` ownership for RIGHT USING/NATURAL names: an unqualified/star merged name takes the right-side owner, including qualified-star substitutions, while FULL emits the merged coalesce expression. Ambiguous multi-left USING is rejected during join processing. `vdbe.ts` follows `wherecode.c:sqlite3WhereRightJoinLoop`: one budgeted ephemeral rowid matcher, original-RHS rescan, left-of-barrier NullRow, and a relocated shared continuation for downstream joins. Resolving forward exits before relocation is a TypeScript array-construction adaptation only; it preserves the upstream VDBE target graph and prevents address-zero restart. Tests cover the manifest matrix, UTF-8/16le/16be, reset/rebind, cancellation after match output, deadline/work/private failures, and cleanup. Neighboring unsupported SQL remains governed by existing aggregate/subquery/generated/without-rowid gates; this revision does not broaden those features.

### 2026-09-17 repeated-barrier correction (current)

The earlier current-sounding statements that all RIGHT/FULL forms were gated, and the later 15-case completion revision, are historical checkpoints superseded by this section. Ordinary rowid-table SELECTs with **one** RIGHT or FULL barrier are supported across terminal/downstream continuation and the documented 15-case pinned denominator. A SELECT containing more than one RIGHT/FULL barrier is now rejected atomically at prepare with temporary unsupported classification. Pinned `wherecode.c:sqlite3WhereRightJoinLoop` owns one `WhereRightJoin` per applicable `WhereLevel`; the current compiler owns one matcher/unmatched pass, so accepting repeated barriers would partially lower them. Per-barrier state is the explicit next tranche. This boundary was required by immutable review `record:///review.md?card=card-k&v=3`.

## Aggregate, GROUP BY, and HAVING tests-first contract (Stage 3 research gate)

This section records the pre-implementation contract originally pinned to SQLite
3.53.4. At that historical checkpoint the executable artifact had 37 native
captures (33 native-success cases plus four prepare errors), 0 TS credit, and an
intentionally red public gate. The current artifact, accounting, and admitted
surface are recorded in the aggregate-local modifier section below. The matrix
uses the immutable Fetch generation, including UTF-8/UTF-16le/UTF-16be fixtures,
and preserves INTEGER decimal, REAL IEEE-754 bits, NULL, TEXT/BLOB bytes, column
metadata, prepare/step errors, reset/rebind, and finalize codes.

### Source-derived ownership and lowering

* `sqliteInt.h` `Expr`, `Select`, and `AggInfo` and `resolve.c:resolveExprStep`
  own classification. Resolution tracks aggregate depth and `NC_AllowAgg` /
  `NC_HasAgg`; aggregate calls are not scalar calls selected by spelling.
  Aggregate prohibition, nesting, aliases, GROUP/HAVING visibility, and outer
  depth must therefore be settled in resolver state before code generation.
* A per-SELECT `AggInfo`-like immutable compiler product owns aggregate columns,
  functions, arguments, FILTER, DISTINCT/ordered-input descriptors, and
  accumulator register identities. `select.c:sqlite3Select`,
  `analyzeAggregate`, `resetAccumulator`, `updateAccumulator`, and
  `finalizeAggFunctions`, plus `expr.c`'s `TK_AGG_FUNCTION` lowering, are the
  algorithm baseline. GROUP input is compared with shared Mem/KeyInfo collation;
  group change finalizes the old accumulator before reset and first-row state.
  No-GROUP aggregate SELECT creates exactly one group even with zero input;
  GROUP BY over zero input creates none. HAVING executes after finalize and before
  result ORDER/DISTINCT/LIMIT. Bare columns are group-row values; the built-in
  single min()/max() row-selection rule is source behavior, not a generic
  first-row shortcut.
* Runtime accumulator ownership belongs to the statement execution, not the AST,
  connection, or public row. Each accumulator is a Mem aggregate state and a
  function context. `vdbe.c` `OP_AggStep`/`OP_AggInverse`/`OP_AggValue`/
  `OP_AggFinal` and `func.c` count/sum/avg/total/minmax/group-concat callbacks are
  the lifecycle baseline. The internal definition seam is later-window-compatible:
  `step(context,args)`, optional `inverse(context,args)`, `value(context,out)`,
  and `final(context,out)`. Initial GROUP execution invokes step/final only;
  value/inverse are present but not fabricated. Context exposes shared Mem
  arguments/result, SQLite error/code, collation, encoding, subtype/aux flags,
  and one aggregate-private slot with exactly-once cleanup.
* All sorter keys, DISTINCT sets, ordered-aggregate queues, group snapshots,
  aggregate contexts, and growable `group_concat` bytes reserve from the one
  execution-wide `PrivateStateByteBudget` already used by relational private
  state. Reservation is atomic: compute checked complete deltas, reserve before
  mutation, and roll back newly reserved bytes and owned Mem/context state on
  failure. There is no aggregate-local reset of the shared ceiling. Group change,
  reset, finalize, step error, cancellation, and statement destruction release
  exactly once; suspended execution retains charges. Host OOM remains outside the
  promised catchable surface, while configured exhaustion is `limit`.

### Admitted first implementation and gates

The first admitted surface is one SELECT level over the currently supported
no-FROM/single-table/multi-source/compound inputs: GROUP BY and HAVING; built-in
`count(*)`, `count(X)`, `sum`, `avg`, `total`, `min`, `max`, and `group_concat`;
DISTINCT and FILTER; aggregate-local ORDER BY for `group_concat`; aliases,
collations, bare columns/minmax, result ORDER/LIMIT, reset/rebind, and existing
metadata. Window syntax, user-defined functions, subqueries, recursive CTEs, and
unmapped aggregate-local ORDER BY uses remain temporary unsupported. This is a
bounded implementation sequence, not permission to silently reject a matrix case:

1. resolver/classification and immutable AggInfo, with prepare-time errors;
2. accumulator Mem/context and no-GROUP reset/step/final/error cleanup;
3. GROUP sorter/change detection, HAVING, bare-column/minmax behavior;
4. FILTER, per-aggregate DISTINCT, and ordered aggregate input;
5. compositions, all fixture encodings, reset/rebind, metadata, budget/cancel/
   finalize fault tests; then promote each public case explicitly.

Every temporary feature gate must be atomic: reject during prepare before a
statement/program is published. Runtime `limit`, overflow, cancellation, or
function errors retain their actual step phase, invalidate any pending row, and
leave reset/finalize cleanup deterministic. No internal/native companion earns TS
credit. The public runner deliberately fails if an aggregate unexpectedly prepares
until it also compares full tagged native output; this prevents accidental parser
acceptance from becoming compatibility credit.

### Storage-history reconciliation

The earlier "historical storage-only checkpoint" paragraph in this guide remains
history, not a current capability claim. Current committed code has shared Mem,
collation/comparison, scalar functions, compiler/VDBE, relational private state,
and multi-source execution. Aggregate state was only a staged Mem slot and current
aggregate SQL remained temporary unsupported when this gate was authored. This
research does not alter storage.

### Initial aggregate execution tranche (Stage 3)

The working tree now translates the non-grouped aggregate route for one ordinary
rowid table (or no FROM), with optional WHERE, and scalar composition around the
result. `src/internal/vdbe.ts` resolves aggregate class/arity separately from
scalar functions, builds AggInfo-like accumulator entries, and emits source-shaped
`AggStep`/`AggFinal` operations into the shared expression/VDBE path. Accumulator
ownership uses the existing aggregate-capable `Mem`; reset, finalize, replacement,
and failure therefore run cleanup once. Text/min/max retained bytes reserve the
execution's one `PrivateStateByteBudget`. Step/input work and cancellation/deadline
checks remain in the VDBE loop, and the existing saved-error cleanup precedence is
unchanged.

Core `count`, `sum`, `total`, `avg`, `min`, `max`, and `group_concat` follow the
pinned `src/func.c` step/final routines for NULL and empty-input results, integer
sum overflow, REAL transition, collation comparison, and concatenation. The exact
admitted surface currently excludes GROUP BY/HAVING, DISTINCT/FILTER/aggregate
ORDER BY, subqueries/compounds/joins, and window forms atomically at prepare. This
is deliberately a narrow first aggregate route, not general aggregate support.

### GROUP admission ownership correction ([[card:card-l-c]], 2026-09-17)

Aggregate routing and the bounded grouped path now classify calls from generated
expression reductions rather than scanning SQL token spelling. Group/result/ORDER
compatibility likewise compares generated expression structure (including
qualification and COLLATE wrappers), and source-column/result-alias collisions are
kept atomic temporary unsupported until `resolve.c` source-first alias identity is
carried end-to-end. This follows pinned `resolve.c:resolveExprStep` and
`resolveOrderGroupBy`: spelling does not make a scalar identifier an aggregate,
and copied/lowercased token text is not expression identity. Public adversarial
checks cover aggregate-looking aliases/scalar expressions, qualified keys,
COLLATE-wrapped keys, and the alias-collision rejection. The exact manifest gate
remains 32 attempted, 11 credited, 21 typed temporary unsupported; this correction
is architectural, not expanded compatibility credit. HAVING alias completion and
remaining composition are still open.

### HAVING finalization repair ([[card:card-l-c]], 2026-09-17)

The bounded grouped path now lowers HAVING through the same generated expression
and AggInfo register owners as the result list. Result aliases are substituted only
when no source column owns the name (the pinned `resolve.c:lookupName/resolveAlias`
precedence), aggregate calls share accumulator lowering, and the predicate is
emitted after `AggFinal` but before projection/`ResultRow`, matching
`select.c:finalizeAggFunctions` and the HAVING branch. A public focused check proves
`sum(x) AS s ... HAVING s>40` filters finalized groups exactly. The immutable
manifest count remains 11/32 because its `having-alias` case also requires a
multi-term aggregate-result ORDER destination not yet admitted; this is a precise
producer repair, not false whole-case credit.

### Group collation promotion ([[card:card-l-c]], 2026-09-17)

The bounded grouping producer now admits the pinned `collation-group` case. GROUP
comparison continues through group `KeyInfo`/shared `compareMem` with the resolved
column's NOCASE collation; an ORDER term that explicitly wraps the same generated
GROUP expression with COLLATE is recognized structurally without erasing that
wrapper or comparing reconstructed SQL. Tagged native rows and direct-column
metadata match. Exact aggregate manifest accounting is now 12/32 credited and
20 atomic temporary unsupported.

### Grouped HAVING reset/rebind promotion ([[card:card-l-c]], 2026-09-17)

The prepare-time exclusion for variables in grouped HAVING is removed now that
HAVING uses ordinary generated `Variable` lowering after finalization. Public
execution binds `?1=3`, exhausts the statement, resets, rebinds `?1=2`, and compares
both complete tagged row sets with the pinned capture. Existing VDBE reset cleanup
releases sorter and aggregate state before replay, so no separate grouping state or
budget is retained. Exact aggregate accounting is 13/32 credited and 19 atomic
temporary unsupported.

### Finalized-group ORDER/LIMIT destination ([[card:card-l-c]], 2026-09-17)

Finalized, HAVING-passing group rows may now feed a second private `SorterCursor`
when ORDER BY resolves structurally to result expressions or aliases. Its `KeyInfo`
carries direction, NULL placement, and result collation; payloads are projected
rows. The ordinary LIMIT/OFFSET register program and top-N capacity apply at this
output destination, while the first sorter remains the GROUP boundary producer.
Both sorters debit the execution's single `PrivateStateByteBudget`. This promotes
pinned `having-aggregate`, `having-alias`, `order-limit-groups`, and
`metadata-aggregate`, including exact rows and metadata. Accounting is 17/32 with
15 atomic temporary unsupported.

### Grouped inner-join producer ([[card:card-l-c]], 2026-09-17)

The bounded grouped path now drives GROUP sorter insertion from a cursor-qualified
nested-loop inner/cross-join producer with ON then WHERE filtering. Resolved
columns retain separate physical `(cursor,column)` identity and flattened sorter
payload identity; conflating those identities previously addressed `b.x` as a
later physical field. Aggregate stepping still consumes only sorter payload
registers, and all cursors/sorters share the execution byte budget. Outer/NATURAL/
USING joins remain atomic temporary unsupported here. Pinned `join-group-valid`
passes exactly; aggregate accounting is 18/32.

### Aggregate UNION ALL result destination ([[card:card-l-c]], 2026-09-17)

A bounded aggregate `UNION ALL ... ORDER BY 1` route now compiles every arm with
the same aggregate producer and redirects each arm's `ResultRow` to one shared
result `SorterCursor`. Arm control branches are relocated, terminal Halt becomes
a continuation, and the sorter drains once after all arms. The compound remains
one Program and one `PrivateStateByteBudget`; no arm materializes host rows.
Other aggregate compound operators, parameters, LIMIT/OFFSET, and non-ordinal or
multi-term ORDER remain atomic temporary unsupported. Pinned
`compound-composition` passes; accounting is 19/32.

### Grouped result DISTINCT and aggregate lifecycle ([[card:card-l-c]], 2026-09-17)

For the admitted grouped producer, SELECT-level `DISTINCT` now uses the existing
VDBE destination protocol after aggregate finalization, HAVING, and projection:
one `EphemeralIndexCursor` receives the complete projected `Mem` tuple under an
immutable all-result `KeyInfo`; `Found` skips duplicates and `IdxInsert` retains
the first representative before the existing result ORDER/LIMIT destination.
This follows `select.c`'s distinct result destination and does not implement
aggregate-local DISTINCT, FILTER, or ORDER BY (those remain atomically temporary
and belong to [[card:card-l-d]]). It introduces no host grouping, `Map`/`Set`, or
second evaluator. The GROUP sorter, result DISTINCT cursor, and optional result
sorter all reserve against the statement's single `PrivateStateByteBudget`.

Public source-based tests cover NULL collapse, numeric projection, NOCASE
collation, ordering, reset after a yielded row and after completion, finite entry,
key-byte, total-private-byte and work limits, suspension with live cancellation,
deadline injection, exactly-once private-cursor cleanup, first-error retention
when cleanup also fails, finalize/reset reporting, and restored connection
admission. The three existing encoding fixtures now execute this path in UTF-8, UTF-16le,
and UTF-16be. Their single-column non-rowid PRIMARY KEY autoindex is reconstructed
from the table declaration and sqlite_schema root page; broader implicit index
layouts retain the atomic temporary schema gate. Exact aggregate manifest
accounting is **20/32** credited and **12** typed temporary unsupported; grouped
result DISTINCT is a focused companion outside that frozen denominator.

### Aggregate-local modifiers ([[card:card-l-d]], 2026-09-17)

Aggregate calls now retain generated-parser DISTINCT, FILTER, and internal ORDER
terms through resolution and AggInfo-like lowering. Following pinned
`src/select.c:updateAccumulator`/`finalizeAggFunctions` (around lines 6680-6942),
FILTER branches precede argument evaluation; a per-call `EphemeralIndexCursor`
performs KeyInfo/Mem DISTINCT before stepping or queueing; and a per-call
`SorterCursor` retains ordering keys plus argument payload and replays `AggStep`
before `AggFinal`. Group boundaries clear those cursors and release their entries;
all modifier cursors and aggregate retained values debit the execution-wide
`PrivateStateByteBudget`. The implementation uses the existing stable private
merge sorter rather than host `Array.sort`, and numeric aggregate state remains a
function context behind step/final callbacks rather than a frozen sum-only model.

The pinned public aggregate gate now credits **30/34** successful cases out of a
39-case native artifact (34 native-success attempts plus 5 exact prepare errors),
including DISTINCT, FILTER, ordered `group_concat`, NOCASE duplicate
representatives, and ordered aggregates on UTF-8/UTF-16le/UTF-16be fixtures. Each
aggregate-internal order term retains its own generated `sortlist` production:
direction and NULL placement are read from that item's direct `sortorder` and
`nulls` children, matching pinned `parse.y:918-934`, rather than from the complete
list. Immutable oracle cases distinguish mixed ASC/DESC terms and mixed NULLS
FIRST/LAST terms with nullable keys. Four successful native cases requiring
FROM-subquery execution remain atomically temporary unsupported; this modifier
milestone does not claim window execution.

### Aggregate definition context and compensated numeric correction ([[card:card-l-b]], 2026-09-17)

The aggregate registry now owns definitions rather than names alone. Each definition
exposes `step`, optional `inverse`, optional non-destructive `value`, and `final`,
plus state creation/cleanup. The VDBE constructs an aggregate function context over
the accumulator `Mem`; the context supplies the database encoding, resolved
collation, maximum result size, the one execution-owned `PrivateStateByteBudget`,
and first-error/result facilities. `AggStep`, `AggValue`, and `AggFinal` dispatch
through this seam. `AggValue` copies a result to a distinct register without
clearing the accumulator; the slot and callback are present for later work but no
window execution surface is admitted.

`sum`, `avg`, and `total` translate SQLite 3.53.4 `func.c` `SumCtx`,
`kahanBabuskaNeumaierStep`, `kahanBabuskaNeumaierStepInt64`, initialization,
`sumStep`, and the three finalizers. The integer route remains exact int64; overflow
initializes compensated REAL state while retaining the overflow diagnostic until a
later non-integer input; large int64 steps split at the pinned 2^52/16384 boundary;
and finalization includes the finite correction term. Public differentials cover
cancellation, large signed integers, overflow followed by REAL, persistent integer
overflow, and INTEGER/REAL/NULL result classes. This is an algorithm translation,
not a host summation substitution.

### Aggregate retained-state budget correction ([[card:card-l-d]], 2026-09-17)

The earlier initial-tranche statement that text min/max retained bytes already
reserved the execution budget was premature and is superseded here. Extrema state
now tracks the complete retained TEXT/BLOB byte count. A winning value reserves
only the positive old-to-new delta before copying; a failed copy releases that
reservation without changing the prior winner; after commit, a smaller replacement
releases the negative delta and the prior `Mem` exactly once. Finalization, reset,
step failure, and statement cleanup continue through aggregate-capable `Mem` and
release the state's tracked bytes from the one execution-wide
`PrivateStateByteBudget`. Numeric and NULL extrema retain zero logical bytes.

`group_concat` growth likewise commits its part before increasing the tracked byte
count and rolls back a reservation if host growth throws. Focused public lifecycle
tests exercise initial/replacement TEXT and BLOB extrema, configured failure,
reset/rerun/finalize release, later connection admission, and byte-failure cleanup
of aggregate-local DISTINCT and ordered-input queues. The implementation still
does not promise catchable host OOM; the rollback protects exceptions observable
at this seam. This correction changes no SQL admission or aggregate manifest
credit.

## Subquery and immutable-view architecture gate ([[card:card-m-a]], 2026-09-17)

This section is a **tests-first decision handoff**, not runtime credit.  Its pinned
identity is SQLite 3.53.4, source id
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
The immutable native artifact is
`test/conformance/cases/stage3-subquery-view.json`; all 46 cases are native
captures and public Fetch-backed TypeScript attempted/credited counts remain
0/0.  The spec's `upstream` names are assertion provenance: a name denotes the
canonical test-prefix plus assertion label in the pinned Tcl file (for example,
`with1-2.1` is `test/with1.test` assertion `2.1`).  The project SQL is deliberately
a bounded adaptation to project fixtures unless it is byte-identical; provenance
is not a claim that the SQL text was copied.  The four `stage3-aggregate-group:`
references point to immutable case IDs in that project oracle rather than Tcl.

### Chosen production graph and ownership

1. **Expand, then resolve.** Generated Lemon `Select`/`SourceList` nodes remain the
   semantic input.  A source entry gains an owned derived `Select`; an immutable
   view loads its stored SELECT and explicit column list into that same shape.
   The existing expansion pass derives a transient table/result-column graph,
   following pinned `select.c:selectExpander` and
   `build.c:sqlite3ViewGetColumnNames`. It must preserve alias, duplicate-name
   disambiguation, declared affinity/collation and database/table/origin identity
   separately. It does not copy view rows or mutate schema.
2. **Lexical resolution is structural.** Each nested SELECT receives a linked
   `NameContext`; `resolve.c:lookupName`-shaped lookup searches the innermost
   source first and follows `pNext`. Multiple matches in one level are ambiguous;
   only no match advances outward. An outer hit increments the relevant reference
   count and marks the source/expression correlated. Token scans and guessed
   qualifier strings are forbidden. Width checks (one column for scalar and
   scalar-LHS IN) and missing/ambiguous names fail prepare before a Program is
   published.
3. **Flattening is an optimization, never the semantic implementation.** Port
   `select.c:flattenSubquery` only after its numbered restrictions are represented:
   no aggregate derived SELECT; no derived DISTINCT; a FROM is required; LIMIT,
   OFFSET, dual ORDER, aggregate-parent, compound-parent and outer WHERE/DISTINCT
   interactions (8/9/11/13--16/19/21); UNION-ALL-only compound restrictions and
   equal affinity (17/18/20); recursive/materialized CTE (22/28); windows (25);
   and LEFT/RIGHT/FULL placement rules (3/26/27). If any fact is unavailable,
   choose the non-flattened route rather than weakening a restriction. Rewriting
   substitutes source columns into result/WHERE/GROUP/HAVING/ORDER expressions
   while retaining joins, collations and outer-join provenance.
4. **Non-flattened FROM sources stay VDBE producers.** Follow
   `sqlite3Select` and `fromClauseTermCanBeCoroutine`: eligible single-use sources
   compile to `InitCoroutine`/`Yield`/`EndCoroutine` with result registers; sources
   requiring rewind/multiple access, or not eligible for coroutine, compile into
   the existing typed ephemeral cursor. Materialization is a subprogram entered
   by `Gosub` and terminated by `Return`; uncorrelated sources receive `Once`, while
   correlated sources refill for the applicable outer row. Both routes compile
   through existing SELECT destinations and the join/GROUP/ORDER/compound graph.
   They do not evaluate an AST or collect host rows.
5. **Expression subqueries follow `expr.c:sqlite3CodeSubselect`.** Scalar SELECT
   initializes its destination register to NULL, imposes the equivalent of
   `LIMIT 1`, and overwrites it with the first row's first `Mem`; extra rows are
   ignored. EXISTS initializes integer 0 and sets integer 1 on the first row.
   An uncorrelated expression may be guarded by `Once`; a correlated expression
   is entered for each applicable outer row. IN/NOT IN uses an
   `EphemeralIndexCursor` and immutable `KeyInfo`, applying SQLite comparison
   affinity and resolved collation. Lowering retains distinct states for RHS
   empty, exact match, no match/no NULL, and no match/RHS NULL so NULL LHS,
   NOT IN inversion and three-valued results match the pinned artifact. A JS
   `Set`, array membership, or host equality is not equivalent and is forbidden.
6. **Registers and lifetime.** Every nested producer receives non-overlapping
   contiguous result registers, one coroutine/return register and, where needed,
   an `Once` flag plus ephemeral cursor id. `Gosub` writes its return pc;
   `Return` consumes that register; `Yield` atomically exchanges pc with the
   coroutine register; `EndCoroutine` transfers to the saved caller continuation.
   This is the pinned `vdbe.c` control model adapted only from C arrays/gotos to
   the existing TypeScript opcode array and integer register file. Suspension
   preserves pc, all registers, cursors and `Mem` values without replay.

### Invariants, bounds, and atomic gates

* The statement has one `PrivateStateByteBudget` (public default 256 MiB), shared
  by derived materializations, IN sets, sorters, aggregates and retained `Mem`.
  Existing per-cursor defaults (100,000 entries and 16 MiB key) and result-byte
  limit continue to apply. Every inner and outer opcode spends from the same
  execution work counter (default 10,000,000) and checks signal/deadline at the
  existing step boundary. No nested statement receives a fresh budget.
* Parsing keeps the public `maxParserDepth` 2500 and `maxExpressionDepth` 1000.
  Expansion/resolution/lowering must charge every nested SELECT edge against the
  same expression-depth ceiling; overflow is a prepare-time limit error with no
  published Program. Tests must exercise configured tiny values rather than rely
  on the defaults.
* Reset retains bindings but clears pc, row exposure, coroutine/return/Once
  registers and every nested private cursor; rebind then reruns from pc 0.
  Finalize, close/deferred-close, cancellation, deadline and runtime errors release
  each nested owner exactly once, preserve the first error, invalidate exposed
  rows, and restore connection admission.
* CTE, recursive CTE and window execution are separate gates. Their three native
  cases prove only oracle capture. Until an owning card admits a whole shape, each
  must reject atomically during prepare and contributes zero TS credit. The same
  rule applies to a flatten/materialize/coroutine shape whose required join,
  aggregate, compound or metadata behavior cannot be represented.

### Alternatives rejected and implementation sequence

An AST interpreter, JS generator, recursive `Statement`, host arrays/Map/Set, and
WASM/native delegation would split the production graph, budgets and suspension
semantics and are rejected. Always materializing would preserve many rows but
would diverge from the pinned coroutine/correlation control and resource timing;
always flattening is unsound under the numbered restrictions. The implementation
sequence is therefore: (A) immutable view/derived expansion and linked resolution;
(B) scalar/EXISTS and IN VDBE destinations; (C) non-flattened coroutine and
materialization; (D) only then bounded flattening. Each tranche must turn selected
manifest cases from explicit unsupported to exact public Fetch evidence and add
nesting/work/private-byte/lifecycle companions without changing the denominator.

### Revision: exact FROM-subquery route decision and tests-first companions

This revision addresses `record:///review.md?card=card-m-a&v=3`. The earlier
phrase “eligible single-use source” is superseded by this direct translation of
pinned `select.c:fromClauseTermCanBeCoroutine` (conditions 1--5) and the adjacent
`tag-select-0482`--`0488` dispatch:

| Pinned condition/branch | Required retained TypeScript fact | Decision |
|---|---|---|
| 1a only FROM term | `SourceList.length`, index | coroutine |
| 1b leftmost and next term has `JT_CROSS` | ordered source entries and generated join flags | coroutine |
| 1c leftmost subquery; no `OUTER`/`CROSS` barrier from it leftward; no earlier subquery; not `SF_UpdateFrom` | source order, each join type/isSubquery, SELECT flags | coroutine. The read-only public surface cannot produce UPDATE-FROM, but the flag remains a required false fact rather than being dropped. |
| 2a CTE `M10d_Yes`; 2b CTE use count >=2 unless `M10d_No` | CTE materialization mode and use count | not coroutine; CTE remains atomically gated until these facts exist |
| 3 first source is left operand of RIGHT JOIN (`JT_LTORJ`) | first-source join flags | not coroutine |
| 4 coroutine optimization disabled | compile optimization flags | not coroutine; current public API has no toggle, so the retained default is enabled |
| 5 `isSelfJoinView` finds a later same expanded view/alias identity | immutable schema-view identity, expanded SELECT identity, alias and nested-FROM traversal | not coroutine |

The procedure evaluates 2--5 before condition 1. Missing/unknown facts always
return **not coroutine**. The surrounding dispatch is then exact: an already
filled source is skipped; true eligibility emits 0482; a previously materialized
CTE emits 0484 (`Gosub`, `OpenDup`); `isSelfJoinView` finding a prior compatible
entry emits 0486 (invoke prior fill if present, then `OpenDup`); all others emit
0488 materialization. In 0488, uncorrelated sources get `Once`, correlated sources
do not, and only an uncorrelated CTE publishes reusable fill/return/cursor facts.
Ordinary repeated immutable views use 0486 only after flatten restrictions and
identity checks leave an eligible prior materialization; otherwise each retained
source follows the ordinary decision. `route-coroutine-plan` and
`route-self-view-plan` freeze native EXPLAIN QUERY PLAN discriminators so a
row-equivalent always-materialize implementation cannot satisfy this gate.

`test/conformance/cases/stage3-subquery-view-companions.spec.json` replaces the
five non-executable prose companions as the normative future public-test
contract. Its 15 atomic IDs define SQL, configured-small limit/injection,
operation order, and exact typed/error/cleanup observations for nesting,
coroutine suspension, cancellation/deadline/work inside the inner producer,
materialization and IN growth, overlapping aggregate/sorter/subquery bytes,
reset before/after yield, rebind, finalize, first-error cleanup, deferred close,
and restored admission. They remain unattempted 0/0 until implemented through
Fetch. Injection-only observations use the project's existing test seams and are
not public API promises.

View evidence now distinguishes explicit (`v1`) and inferred (`v_inferred`)
columns, duplicate inferred `b`/`b:1`, lazy explicit-list width failure (`v_bad`),
and inherited NOCASE grouping through `v_collate` with no outer COLLATE override.
Captured column metadata and errors are normative. Every oracle case now carries
hashed bounded Tcl assertion content (or a hash of the exact referenced project
aggregate case), an adaptation classification/rationale, and a pinned
implementing-source hash plus branch markers. The validator recomputes all hashes;
label existence alone no longer passes.

### Historical revision delivery evidence (superseded)

The following records the first review revision; its companion hash and validation
are historical and are superseded by **Latest closed-contract delivery evidence**
below. First-review delivery commit: `9d40efa037d2c803869ecf0585fa8f26e9fb7f6a` (on top of initial
`841a322b3a55777749fca0ee686419823e3eff94`). Artifact SHA-256 values:
`stage3-subquery-view.spec.json` `62d009775694a149acdccc0528265a4766a745ddbf53f731f9c01ab0ad855492`;
native JSON `c98ee1aa64d4a7f16265747ef292f8b714944899318ef86aa33f877ced992d43`;
companion spec `36bab6b076b04f030058e644e8f4ab9d38c0bf9265cafc0d4d9665155803896d`;
fixture catalog `69463bf15fae9a469af1f833ef7ea13a6a2335f2a5dac416211e4efa65ac5f17`.

Exact validation sequence (all passed after correcting an interim stale expected
fixture-count assertion):

```sh
python3 -m py_compile test/conformance/capture-subquery-view.py test/conformance/subquery-view-manifest.test.py
python3 test/conformance/capture-subquery-view.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so" --spec test/conformance/cases/stage3-subquery-view.spec.json --fixture-root test/fixtures --output "$SAIVAGE_CARD_WORK_ROOT/subquery-view-recapture-v2.json"
cmp test/conformance/cases/stage3-subquery-view.json "$SAIVAGE_CARD_WORK_ROOT/subquery-view-recapture-v2.json"
npm run typecheck
npm run test:parser
npm run test:fixtures
npm run test:conformance:accounting
npm run test:conformance:aggregate:manifest
npm run test:conformance:aggregate:native
npm run test:conformance:subquery-view:manifest
npm run test:package-boundary
git diff --check
git status --porcelain
```

The first command through `test:parser` passed in the first sequence; fixture
validation then exposed the stale count. After correction, `test:fixtures`
through `git diff --check` passed, and post-commit `git status --porcelain` was
empty. These are architecture/oracle reproducibility checks, not runtime support.

### Latest closed-contract delivery evidence

The current normative companion artifact is the version delivered by commit
`689c6f27a3044e429420c3bdfb2da05d94a6019a`; its SHA-256 is
`dab7d59e9393d3cb345d79663b7cee34a2d47f13339a93e7033995fa2d02c257`.
This supersedes the historical companion checksum above. The latest focused
validation ran the following exact sequence with `set -e`; all commands passed:

```sh
python3 -m py_compile test/conformance/subquery-view-manifest.test.py
npm run typecheck
npm run test:parser
npm run test:conformance:subquery-view:manifest
git diff --check
! grep -Eq '39/39|all 39|39 cases are native' docs/TRANSLATION.md docs/SQLITE_SOURCE_MAP.md
sha256sum test/conformance/cases/stage3-subquery-view-companions.spec.json
```

The validator result was 46 native captures, 15 literal prepare-valid closed
companions, and 0 TypeScript credit; typecheck and all 27 parser tests passed.
A separate attempt to feed these future cases through the current TypeScript
parser failed at its intentional `subqueries in FROM are not implemented` gate.
That failure is current unsupported behavior, not a waived validation and not
Fetch-backed evidence. No public TypeScript case was attempted or credited.

### Pinned companion-prepare integration revision

System review `record:///review.md?card=card-m-a&v=15` supersedes the prior
host-Python prepare-validation wording. The authoritative companion validator no
longer imports Python's environment-linked `sqlite3`. It requires `--library`,
loads that shared library via `ctypes`, and rejects it unless
`sqlite3_libversion()` and `sqlite3_sourceid()` exactly equal manifest-pinned
3.53.4 / `2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`.
It opens the immutable fixture read-only and prepares `EXPLAIN <case SQL>` for all
15 companions through that verified library, finalizing each statement and
closing the database. There is no authoritative host SQLite fallback or smoke
check.

The one clean-environment package entrypoint is:

```sh
npm run test:conformance:subquery-view:manifest
```

It expands to:

```sh
python3 test/conformance/subquery-view-manifest.test.py --library "$SAIVAGE_CARD_WORK_ROOT/oracle-build/build/libsqlite3-oracle.so"
```

The command passed and printed the exact pinned version/source ID, 46 frozen
native captures, 15 literal SQL cases prepared by the pinned library, and 0
TypeScript credit. This native prepare check remains architecture/oracle evidence;
the TypeScript runtime remains unsupported and Fetch-backed accounting remains
0 attempted / 0 credited.

### Allocated FROM-derived/view promotion ([[card:card-m-f-g]], 2026-09-17)

The pinned 3.53.4 `select.c` routes `flattenSubquery`,
`fromClauseTermCanBeCoroutine`, and tags 0482/0484/0486/0488 remain the route
authority. The public tranche now credits 19 allocated cases (57 encoding-specific
executions): 15 derived/persisted-view cases and the four aggregate 30/34 blockers.
They execute in one VDBE Program through bounded flattening, coroutine,
statement-owned materialization/OpenDup, or bounded `UNION ALL` destinations;
there are no host rows, native fallback, or nested public statements.

The bounded compound-derived aggregate destination is a browser/TypeScript
adaptation of `select.c:multiSelect` destination redirection: child `ResultRow`
opcodes feed ordinary outer aggregate/sorter opcodes in the same Program. This
avoids an unavailable native ephemeral b-tree object while preserving arm order,
SQLite value classes, shared work/private-state accounting, cancellation, and
first-error cleanup. Exact public oracle tests cover the four allocated forms,
including overflow timing and REAL bits, and a differential private-byte test
proves aggregate-local sorter overlap.

This is deliberately not general subquery support. General scalar subqueries,
`EXISTS`, and `IN` remain owned by their separate tranche; only the allocated
persisted-view correlated `EXISTS` composition is admitted here. CTE, recursive
CTE, window, and unmatched unsafe derived shapes reject atomically. Compound and
aggregate-over-derived admission remains limited to represented `UNION ALL`
forms; unsupported general forms must not publish a partial Program.

Accounting: `stage3-subquery-view.json` is 46 native captures, 19 attempted and
19 credited allocated cases. `subquery-view-foundation.test.mjs` is 57/57;
`from-subquery-routes.test.mjs` is 20/20; aggregate public accounting is now
34/34 native-success cases (with five pinned prepare-error comparisons separate).

### Expression-subquery and compound ORDER completion (2026-09-17)

The accepted scalar/EXISTS/IN/correlated tranche now has direct public Fetch coverage in UTF-8, UTF-16le, and UTF-16be, plus the indivisible 15/15 lifecycle/resource companion tranche. Ordered bounded compound arms retain destination-aware subquery lowering into the parent VDBE, sharing work and private-state ownership. Compound ORDER binding follows `resolveCompoundOrderBy`: ordinal and resolved alias ownership first, then generated expression-tree identity with COLLATE decoration ignored for identity but retained in KeyInfo. Token spelling and expanded SQL text are deliberately not expression identity; parentheses, whitespace, identifier case/quoting, qualification, and COLLATE spelling must not alter ownership. Focused structural/alias/collation discriminators accompany the bounded scalar-subquery compound test. CTE, recursive CTE, window, and unsafe unmatched shapes remain atomic prepare-time gates.

## CTE source-model and scope architecture ([[card:card-n-a]], 2026-09-18)

The current CTE contract is `docs/architecture/cte-source-model.md`. Generated
`wqas`/`wqitem`/`wqlist`/`select ::= WITH ...` reductions now own an immutable
`SelectNode.with` graph: the independent `RECURSIVE` marker, ordered declarations,
optional ordered aliases, nested generated Select, and `M10d_Any/Yes/No`-shaped
materialization mode. Duplicate names reject with SQLite's ASCII-insensitive
`duplicate WITH table name` diagnostic. This is semantic retention, not execution.

The implementation handoff keeps relation-name scope source-shaped after
`select.c:searchWith`, `sqlite3WithPush`, `resolveFromTermToCte`, and
`sqlite3SelectPopWith`: a transient inner-to-outer `WithScope` is separate from,
but feeds sources into, the existing linked expression `NameContext`. An unused
declaration has no use state. First successful CTE relation resolution allocates exactly one prepare-lifetime `CteUse` in a declaration-to-use map; every
later reference, clone, and rewrite shares that identity. Resolved sources retain
the pair, `nUse` increments per successful expansion, and the prepare context owns
the association through lowering even after scope pop or tree rewriting. Its
semantic `materializationAddress` field maps exactly to pinned `CteUse.addrM9e`; the
remaining state carries the hint, return register, cursor, and estimate.
Schema-qualified names bypass the CTE chain; nested declarations shadow; views do
not capture caller scope. Coroutine, reusable materialization, and recursive
queue/distinct-queue lowering remain future source-shaped VDBE work.

Until those lookup, diagnostics, and lowering contracts are implemented,
`Connection.prepare()` first loads the immutable schema, then the cycle-safe
`selectGraphContainsWith()` walk visits root/nested expression SELECTs, retained
and flattening-adjacent derived owners, compound-arm graphs, and FROM-reachable
persisted views. CTE bodies remain represented/reachable, but discovery
intentionally short-circuits at their owning WITH because the rejection decision
is complete. Any WITH rejects with exact temporary-unsupported message `common table expressions are not implemented` before any compiler or
statement registration. Public cross-encoding tests prove post-rejection reuse. The machine tranche has 14 credited pinned `with1.test`/
`with2.test` cases and three no-credit companions, captured for three database
encodings (51 native executions), with TypeScript attempted/credited 0/0. This pin
has no `test/with.test`; none is claimed. This current evidence supersedes the
older generic statement that CTE syntax was only retained structurally, but does
not supersede the public execution exclusion.

## Ordinary non-recursive WITH execution (2026-09-18)

The admitted bounded SELECT graph now includes ordinary CTE relation lookup and
execution. Preparation uses lexical innermost-first WITH frames, bypasses CTE
lookup for schema-qualified names, validates explicit alias width, and allocates
one mutable prepare-owned `CteUse` identity lazily per successfully resolved
CTE declaration. Every relation rewrite retains that identity. A represented
single reference may use the existing derived coroutine route; repeated uses and
`AS MATERIALIZED` use one statement-private ephemeral fill and independent
`OpenDup` cursors. `AS NOT MATERIALIZED` remains a planner hint: it permits the
coroutine route but does not override a represented shape that requires shared
materialization. These are translations of pinned `select.c` WITH push/pop,
`resolveFromTermToCte`, `CteUse`, coroutine, and materialization/OpenDup branches,
adapted to immutable parser nodes and browser-private VDBE state.

Public evidence currently covers all three database encodings for scalar/VALUES
and table-backed producers, multiple declarations, repeated references, aliases,
ordinary use under the RECURSIVE scope marker, both materialization hints, WITH
owned by represented derived SELECTs and persisted views, mixed table/CTE CROSS
JOIN, grouped aggregation, and UNION ALL with a scalar arm. Persisted-view lowering
uses a fresh lexical scope, so caller CTEs do not capture stored view bodies.
Recursive queue execution is not admitted: pre-lowering self-reference recognition
returns exact temporary prepare error `recursive common table expressions are not
implemented`, while represented ordinary use under a RECURSIVE marker remains
valid. A separately asserted expression-owned nested-WITH residual still returns
`common table expressions are not implemented`; do not conflate those predicates.
Other unrepresented compositions remain typed temporary gaps, and this bounded
tranche must not be described as general CTE support.

## Recursive CTE queue execution (2026-09-18)

The bounded recursive route translates SQLite 3.53.4 `select.c:generateWithRecursiveQuery`: setup rows enter an ephemeral FIFO Queue (`UNION ALL`) or a stable KeyInfo priority Queue (`ORDER BY`); `UNION` additionally keeps an all-history ephemeral index. Each VDBE iteration removes one Current row, applies recursive LIMIT/OFFSET ordering, emits the destination row, and generates successors with `Goto`; it never recursively invokes JavaScript. Window/aggregate and circular/multiple/nested-reference diagnostics run before opcode publication.

Queue/history values are copied `Mem` cells and share `PrivateStateByteBudget`, entry/key/byte/work/row limits and statement cancellation/deadline checkpoints. VM PC/register/cursor state survives async yield; halt/error/reset/finalize close private cursors and release budget. Public stress covers 20,000 iterations, reset/rebind, finalize, work-limit, pre-abort, deadline, and connection reuse.

Represented scope is deliberately narrower than SQLite: source-free setup arms, direct single recursive source arms with scalar WHERE/results, FIFO/distinct/priority queues and recursive LIMIT/OFFSET; the outer destination supports direct projection and one source-free scalar-derived inner join. Other joins, recursive subqueries, views, grouped consumers, multiple/reused recursive declarations, and broader compounds reject temporarily because their underlying source/destination compiler routes are untranslated—not because recursive evaluation is approximated.
