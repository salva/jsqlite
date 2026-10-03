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
subquery routes and their bounded compositions. This is not a general SQL engine. The admitted public surface includes the
documented bounded ordinary WITH and iterative recursive-CTE routes, plus the
represented aggregate-window surface: ordinary registered aggregates over the
documented default and explicit ROWS/RANGE/GROUPS frames, bounds and EXCLUDE
forms, including the represented join/group/derived/CTE/outer-order compositions.
Residual CTE and window compositions outside those represented routes, writes,
unsafe or unrepresented subquery shapes, and other unmapped SELECT forms remain
atomic typed temporary unsupported. The represented window surface now includes
all eleven pinned ranking, distribution, offset, and value special built-ins;
historical tranche sections below are labeled as such and do not override this
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
`sqlite3BtreeIndexMoveto` descent for seek and retains the positioned descriptor
plus the index ancestor/child path. Index first/last descend only to the selected
boundary, and next/previous now translate `btreeNext`/`btreePrevious` movement:
they move within the current page, descend from an interior cell, or ascend the
retained path without recursively materializing the index. Source-based
table/index exact/inexact GE/LE tests, seek-and-move off-path fault isolation,
selected-path corruption, and path-depth limits pass. The existing lazy forward
scan, record/overflow, owner/close, and borrow-generation behavior remains
covered.
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
primary-key column. Generated CHECK and REFERENCES/FOREIGN KEY reductions now retain ordered immutable read-schema metadata: CHECK expression/source and column ownership, and foreign-key local/referenced columns, target-table links, actions, and deferral state. Column-level REFERENCES deferral is carried by `parse.y`'s following `ccons ::= defer_subclause` reduction rather than the REFERENCES reduction itself; the parser explicitly associates that generated sibling with its owning FK and treats `NOT DEFERRABLE` as immediate even if followed by `INITIALLY DEFERRED`, matching `sqlite3DeferForeignKey`. This translates `parse.y:418-481` and the read-schema portions of `build.c:sqlite3AddCheckConstraint/sqlite3CreateForeignKey/sqlite3DeferForeignKey`; write-enforcement branches are not invoked by this immutable read-only product. Focused tests now exercise the same rich graph in UTF-8, UTF-16le, and UTF-16be. A public Chinook capture from `https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Sqlite.sqlite` is provenance-only because that URL floats; acceptance is bound to 1,007,616 bytes and SHA-256 `7651ba378ac2fcd0dfc3c66fb101f7a7eed3ba39a612ec642b96e20702061f15`, and compares Fetch-backed loading/row access with the source-ID-verified pinned 3.53.4 library. Detailed WITHOUT ROWID storage-key remapping remains progressive work.
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

### FROM-less SRT_Set producer in enclosing scalar SELECT

`expr.c:sqlite3CodeSubselect` sets up the SRT_Set ephemeral cursor in the
parent Parse/Vdbe; `select.c:selectInnerLoop` inserts each RHS row before
`expr.c:sqlite3ExprCodeIN` probes it. The no-FROM, no-clause single-result
RHS now uses the same `SelectProgramBuilder` cursor and register allocator as
its scalar caller; no completed child Program or opcode relocation is involved.
The direct no-FROM and direct one-table IN producer now pass each one-column
row to `emitSelectDestination({kind:"set"})`; its `IdxInsert` implementation
uses the existing ephemeral cursor (a typed VM representation of SRT_Set's
MakeRecord/IdxInsert, not a new IN evaluator). Neither the producer's LIMIT
order nor the outer probe changes. The non-direct child splice is still red.
`InSet` remains the VM's typed ephemeral membership/NULL adaptation. The
one-row FROM-less producer now also admits LIMIT 0/1 in the same enclosing
builder: initialize Mem/Exists before the child LIMIT, open SRT_Set before
its zero guard, skip only RHS expression/insertion on zero, and always
execute the outer probe. The pinned `select.c:computeLimitRegisters` guard
and `expr.c:sqlite3CodeSubselect` destination initialization determine that
ordering. OFFSET is now admitted for this same one-row no-FROM producer:
`select.c:codeOffset` emits `IfPos` before SRT_Mem/Exists/Set, decrementing
only a positive offset and skipping the sole candidate without evaluating its
projection; LIMIT 0 still bypasses OFFSET and the destination. The enclosing
builder retains the set cursor and outer `InSet` probe. Pinned source-ID/public
`select-scalar-child-native.py` / `.test.mjs` pair OFFSET 0/1 with LIMIT 0/1
across scalar, EXISTS and IN, typed rows, metadata and two reset/finalize
cycles. This does not migrate any other child splice. The child's IN comparison now
uses `expr.c:sqlite3CompareAffinity`/`comparisonAffinity` to derive its
membership affinity from the LHS and RHS expression, rather than defaulting
to BLOB: a cast-numeric RHS matches text `'1'` to integer 1, whereas two
unaffine literals do not coerce. `InSet` uses the same cursor, initialized
before the child LIMIT guard. Public
and pinned probes in `select-scalar-child-native.py` / `.test.mjs` compare
INTEGER hits and misses, NULL RHS, names, two iterations and finalize. More
complex RHS producers and the table/aggregate child relocation remain open;
this is not evidence of general subquery parity. The completed-child splice
still fails the structural reproducer.

### Correlated child SELECT LIMIT correction (bounded, not compiler completion)

Pinned `expr.c:sqlite3CodeSubselect` initializes SRT_Mem to NULL or SRT_Exists
to integer 0 before calling `sqlite3Select`; an existing LIMIT 0 is retained
instead of replaced with LIMIT 1. In the current table-backed expression child
producer (`src/internal/vdbe.ts:compileTableSelect`), the previously ignored
child LIMIT yielded a value/1 for correlated LIMIT 0. The parent Vdbe now emits
`computeLimitRegisters` before the child scan and routes its zero branch past
scan/result production, retaining the initialization. For SRT_Set, pinned
`select.c:selectInnerLoop` inserts each selected row and the LIMIT counter
advances only for inserted results, not every source row. The correlated IN
producer now decrements after insertion and exits before the next scan row;
the previous zero guard alone left `LIMIT 1` indistinguishable from no limit.
This is a shared VM budget
and register adaptation, not a replacement for the still-live scalar child
completed-Program splice. Pinned/public paired tests in
`test/conformance/select-scalar-child-native.py` and `.test.mjs` compare types,
rows, names, and reset/finalize. Other pre-existing LIMIT semantics (including
OFFSET and the splice route) require producer-specific coverage; the structural
migration is still red.

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

Resolution uses an immutable built-in registry translated from `func.c`, ASCII case-insensitive names, exact arity before variadic candidates, and SQLite's distinct wrong-arity/no-such-function diagnostics. Initial functions are `typeof`, `length`, `octet_length`, `abs`, `coalesce`/`ifnull`, `nullif`, scalar `min`/`max`, and `substr`/`substring`; later ordinary-function tranches add the remaining represented registrations, including translated LIKE/GLOB. `coalesce`/`ifnull`, CASE, AND, and OR compile as lazy control flow, not eager callbacks.

Expression flags carry resolved affinity and CollSeq: explicit COLLATE wins; otherwise comparisons follow SQLite left/right precedence, and column affinity is applied at comparison/cast call sites. Scalar min/max consume the selected CollSeq and preserve SQLite's first selected tie behavior. Required VDBE growth is literal loads, Cast, CollSeq, value and branch comparisons, Goto/If/IfNot/IsNull/NotNull, and Function/PureFunc over shared `Mem`.

A function context owns output `Mem`, arguments, selected CollSeq, first-error state and cleanup. Cleanup runs once on replacement/reset/failure/finalize and cannot replace the first error. Every opcode/function invocation is charged; text scans, decoding, copies and output growth need bounded incremental charging with abort/deadline checks and pre-materialization byte limits. Result names remain SQLite expression text or aliases; duplicate order is preserved, and origin metadata is null except for direct resolved columns. Evidence: pinned `expr.c` expression/branch code generators; `resolve.c`; `vdbe.c` arithmetic, comparison, Cast, CollSeq, control and Function opcodes; `func.c` registrations/implementations; `vdbemem.c`, `util.c`, `utf.c`; exact tests enumerated in the manifest.

Evidence limitations remain explicit: these companions and the dedicated native harness are no-credit implementation targets, not TS compatibility. The harness observes deterministic interruption rather than wall-clock timeout duration, and its host-registered error function is development provenance only. Detailed translated opcode/function work charges and injected deadline behavior still require implementation-side tests. This does not narrow the owner scope.

Ordinary-function work after this historical tranche proceeded through separately mapped deliveries. The current represented registry includes translated `replace`, LIKE/GLOB, and the other ordinary scalar rows; aggregates/windows, date/time, math and JSON retain their own scope sections rather than being implied here.

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

The same integration commit carried the previously blocked relational foundation work: bounded private sorter/ephemeral state, source-shaped SeekGE/Next state transitions, deterministic accounting, and cleanup/reset coverage. That statement is historical: the current public relational manifest attempts/passes 3 of 18 and credits 2 exact-setup cases. `up-distinct-3.0` remains no-credit solely because automatic-index schema loading prevents fixture parity with upstream `UNIQUE(a,b)`. At that relational-foundation checkpoint, compounds, aggregates, windows, joins, and generalized consumers remained explicitly staged. Later bounded compound, aggregate, aggregate-window, join, and consumer sections supersede those checkpoint gaps.

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
metadata. At this historical aggregate-planning checkpoint, window syntax,
user-defined functions, subqueries, recursive CTEs, and unmapped aggregate-local
ORDER BY uses remained temporary unsupported; the later ordinary/recursive WITH
sections supersede that CTE status. This is a bounded implementation sequence, not permission to silently reject a matrix case:

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
* At this historical subquery-planning checkpoint, CTE, recursive CTE and window
  execution were separate gates and their native cases proved only oracle capture.
  The later ordinary/recursive WITH sections supersede the CTE gates; window and
  any still-unrepresented composition continue to reject atomically and receive no
  TS credit. The same
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

The bounded `compileRepeatedImmutableView` consumer now resolves a one-table
view producer before emitting and calls `compileInnerTableSelect` with the
*enclosing* `SelectProgramBuilder` and `SRT_EphemTab` destination, rather than
relocating a finished child program and replacing `ResultRow`. Its fill returns
before two independently positioned ephemeral readers scan the view rows; the
parent's LIMIT/OFFSET is compiled separately from the view's own LIMIT/OFFSET.
Pinned `src/select.c:sqlite3Select` tags 0486/0488 establish the shared
materialization/duplication ordering, while `selectInnerLoop` owns delivery to
the destination. Paired source-ID checked native/public tests
`select-repeated-view-parent-native.py` and `.test.mjs` exercise the limited
view self-join with INTEGER rows, duplicate `a` column names, missing-name
error, parent LIMIT 0/2 OFFSET 1, two reset cycles and finalize/close;
`-builder.test.mjs` rejects finished-child PC copying. This is deliberately a
bounded materialized representation for the admitted self-join view consumer:
pinned SQLite can choose a coroutine for the first `v_limited` occurrence and
materialize the second, so this is **not** an EXPLAIN-plan equivalence claim.
Flattenable views, other view bodies and general multi-source/WHERE consumers
retain their existing routes or must reject atomically; no shared WHERE
interface was changed.

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

That negative grep was a contextual guard for the then-closed **subquery/view**
architecture handoff: it prevented its 39 future cases from being mislabeled as
native or TypeScript credit. It is not a current prohibition on the separate CTE
execution harness's subsequently verified 39/39 public observations; the final CTE
fidelity-audit reconciliation records that denominator and supersedes the older
36/39 CTE checkpoints.

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
This allocated FROM-derived checkpoint predated WITH execution: CTE, window, and
unmatched unsafe derived shapes then rejected atomically. The ordinary/recursive
WITH sections below supersede its CTE status. Compound and
aggregate-over-derived admission remains limited to represented `UNION ALL`
forms; unsupported general forms must not publish a partial Program.

Accounting: `stage3-subquery-view.json` is 46 native captures, 19 attempted and
19 credited allocated cases. `subquery-view-foundation.test.mjs` is 57/57;
`from-subquery-routes.test.mjs` is 20/20; aggregate public accounting is now
34/34 native-success cases (with five pinned prepare-error comparisons separate).

### Expression-subquery and compound ORDER completion (2026-09-17)

The accepted scalar/EXISTS/IN/correlated tranche now has direct public Fetch coverage in UTF-8, UTF-16le, and UTF-16be, plus the indivisible 15/15 lifecycle/resource companion tranche. Ordered bounded compound arms retain destination-aware subquery lowering into the parent VDBE, sharing work and private-state ownership. Compound ORDER binding follows `resolveCompoundOrderBy`: ordinal and resolved alias ownership first, then generated expression-tree identity with COLLATE decoration ignored for identity but retained in KeyInfo. Token spelling and expanded SQL text are deliberately not expression identity; parentheses, whitespace, identifier case/quoting, qualification, and COLLATE spelling must not alter ownership. Focused structural/alias/collation discriminators accompany the bounded scalar-subquery compound test. At that tranche checkpoint, CTE, recursive CTE, window, and unsafe unmatched shapes were atomic prepare-time gates; the ordinary/recursive WITH sections below supersede its CTE status.

## Historical CTE source-model foundation ([[card:card-n-a]], 2026-09-18; superseded below)

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
not capture caller scope. At this foundation checkpoint, coroutine, reusable materialization, and recursive
queue/distinct-queue lowering remained future source-shaped VDBE work. The
ordinary and recursive execution sections below supersede that implementation
status while retaining this ownership model.

At that historical checkpoint, until those lookup, diagnostics, and lowering contracts were implemented,
`Connection.prepare()` first loads the immutable schema, then the cycle-safe
`selectGraphContainsWith()` walk visits root/nested expression SELECTs, retained
and flattening-adjacent derived owners, compound-arm graphs, and FROM-reachable
persisted views. CTE bodies remain represented/reachable, but discovery
intentionally short-circuits at their owning WITH because the rejection decision
is complete. Any WITH rejects with exact temporary-unsupported message `common table expressions are not implemented` before any compiler or
statement registration. Public cross-encoding tests prove post-rejection reuse. The machine tranche has 14 credited pinned `with1.test`/
`with2.test` cases and three no-credit companions, captured for three database
encodings (51 native executions), with TypeScript attempted/credited 0/0. This pin
has no `test/with.test`; none is claimed. This architecture-only accounting is
historical; the ordinary and recursive execution evidence below supersedes its
public execution exclusion without relabeling any architecture case as TS credit.

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
JOIN, grouped aggregation, and UNION ALL with a scalar arm. The nested derived
matrix directly covers `with1.test` 3.4/3.5 and the applicable `with2.test`
1.6/1.7/1.8 semantics: inner shadowing, outer-frame fallback, nested ownership,
and `main.` qualification bypassing CTE lookup, with typed rows and metadata in
UTF-8/UTF-16LE/UTF-16BE. These five public cases are read-only-fixture
adaptations of the pinned assertions rather than relabeled native executions. A
focused production-opcode discriminator shows eligible one-use unhinted and
`AS NOT MATERIALIZED` owners taking the coroutine route, repeated unhinted use
taking one ephemeral fill plus `OpenDup`, repeated compound-arm `AS NOT
MATERIALIZED` taking independent coroutine routes, and `AS MATERIALIZED` taking
ephemeral fill; the hint remains subject to all other coroutine eligibility
rules. Persisted-view lowering
uses a fresh lexical scope, so caller CTEs do not capture stored view bodies.
At the ordinary-only checkpoint, recursive queue execution was not yet admitted:
pre-lowering self-reference recognition returned exact temporary prepare error
`recursive common table expressions are not implemented`. The recursive execution
section immediately below supersedes that historical rejection for represented
recursive shapes, while ordinary use under a RECURSIVE marker remains valid. A separately asserted expression-owned nested-WITH residual still returns
`common table expressions are not implemented`; do not conflate those predicates.
Other unrepresented compositions remain typed temporary gaps, and this bounded
tranche must not be described as general CTE support.

## Recursive CTE queue execution (2026-09-18)

The bounded recursive route translates SQLite 3.53.4 `select.c:generateWithRecursiveQuery`: setup rows enter an ephemeral FIFO Queue (`UNION ALL`) or a stable KeyInfo priority Queue (`ORDER BY`); `UNION` additionally keeps an all-history ephemeral index. Each VDBE iteration removes one Current row, applies recursive LIMIT/OFFSET ordering, emits the destination row, and generates successors with `Goto`; it never recursively invokes JavaScript. Window/aggregate and circular/multiple/nested-reference diagnostics run before opcode publication.

Queue/history values are copied `Mem` cells and share `PrivateStateByteBudget`, entry/key/byte/work/row limits and statement cancellation/deadline checkpoints. VM PC/register/cursor state survives async yield; halt/error/reset/finalize close private cursors and release budget. Public stress covers 20,000 iterations, reset/rebind, finalize, output-row and queue/history entry/key/aggregate-byte limits, work-limit, pre-abort, cancellation delivered during a real VM yield, deadline, first-error retention, and connection reuse.

Represented scope is deliberately narrower than SQLite: source-free setup arms,
direct single recursive source arms with scalar WHERE/results,
FIFO/distinct/priority queues and recursive LIMIT/OFFSET. The outer destination
supports direct projection, one source-free scalar-derived inner join, and a
bounded cross join of distinct recursive declarations when every producer column
is projected directly; that multi-owner route materializes each iterative VDBE
producer into statement-private stable payload sorters (with no value-comparison
key) and may apply a represented output ORDER BY over direct projected columns,
including explicit BINARY/NOCASE/RTRIM collation, direction, and NULL policy. The
admitted aggregate-consumer boundary is exact: one outer, ungrouped
`sum(<direct recursive-output column>)` over one recursive CTE is lowered by
`compileRecursiveAggregateSelect`, which keeps the iterative queue producer and
replaces its output destination with VDBE `AggStep`/`AggFinal`; public Fetch
coverage verifies `sum(x)` = INTEGER 55 and metadata across
UTF-8/UTF-16LE/UTF-16BE. This does not admit arbitrary grouped recursion. Other
joins, recursive subqueries, views, outer `GROUP BY`/`HAVING`, aggregate
expressions or modifiers beyond that direct `sum` boundary, reused recursive
declarations, expression projections in the multi-owner route, and broader
compounds reject temporarily because their underlying source/destination compiler
routes are untranslated—not because recursive evaluation is approximated.

Recursive evidence accounting (2026-09-18): `stage3-recursive-cte.spec.json` adds 5 exact upstream assertions (`with2-1.14`, `with1-5.6.1`, `with1-7.5`, `with1-16.1`, `with1-16.2`) and 2 no-credit companions (LIMIT/OFFSET plus multi-owner explicit-collation/NULL ordering), recaptured with pinned 3.53.4 across three encodings: 21/21 native executions. Internal opcode/queue tests are not upstream credit. Public tests separately execute UNION history, priority ORDER, LIMIT/OFFSET, typed INTEGER rows, metadata, prepare diagnostics, lifecycle and controls; the all-encoding matrix is 3 encodings × 4 behaviors = 12/12 public observations.

The broad Node glob's apparent hang was bounded to `compound-collation.test.mjs`: its four existing cases pass individually in 21.3s, 6.3s, 3.3s and 15.3s, so the prior 40s file timeout was too small for their ~46s serial total. This is unrelated to recursive CTE control/lifecycle.

## Window-function architecture decision ([[card:card-o-a-a]], 2026-09-18)

This is a **source-derived pre-implementation decision**, not an admission or a
TypeScript execution claim. The baseline is pinned SQLite 3.53.4, source id
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`
from `reference/sqlite/manifest.json`. Inspection of the current generated parser,
compiler, tests and revision-labelled fidelity audit confirms that the current
runtime has aggregate, subquery/view, ordinary WITH and bounded recursive-WITH
routes described above, but no admitted `Window` graph or window lowering. Window
syntax/compositions therefore continue to fail atomically through the current
unsupported boundary. Nothing below changes `docs/api.md`, claims manifest credit,
or permits AST evaluation, host registration, native delegation, or a second SQL
parser.

### Generated graph, resolution, and frame validation

The generated Lemon actions in pinned `src/parse.y` remain the sole producer.
`filter_over`, `over_clause`, `window`, `frame_opt`, bounds, exclusion, and
`window_clause` construct owned, mutable `Window` nodes with the source fields in
`src/sqliteInt.h`: names/base name, PARTITION/ORDER expressions, frame kind and
bounds, implicit-frame bit, exclusion, filter/function/owner links and the later
cursor/register fields. A TypeScript object and discriminated enums are ordinary
representational adaptations of this graph, not a replacement algorithm. The
function expression owns its attached window; a SELECT owns its named definitions
and the compatible execution chain. Parser-error destruction must release each
expression/list/node once, and unsupported syntax must remain represented far
enough to issue an honest prepare error rather than being dropped.

Resolution follows `resolve.c`'s `NC_AllowWin`/`NC_HasWin` discipline. Window
functions are legal only at the same SELECT level and expression positions as the
pinned resolver; nested aggregate/window misuse, unknown functions/windows,
`DISTINCT` window calls, and FILTER on a built-in non-aggregate window function
fail during prepare. Function lookup precedes `sqlite3WindowUpdate`; that routine
resolves `OVER name`, copies the definition, validates offset RANGE has exactly
one ORDER term, and records the `FuncDef`. `sqlite3WindowChain` resolves a base
only against earlier definitions and copies inherited PARTITION and, when present,
ORDER. A derived window may not add PARTITION, may not override an inherited
ORDER, and may not extend a base with an explicit frame. These are graph-copy
rules, not prototype lookup at execution.

`frame_opt` supplies SQLite's implicit `RANGE BETWEEN UNBOUNDED PRECEDING AND
CURRENT ROW`; preserve `bImplicitFrame` so inheritance can distinguish omission
from an explicit frame. `sqlite3WindowAlloc` owns start/end legality and normalizes
explicit `0 PRECEDING`/`0 FOLLOWING` as upstream does; `sqlite3WindowUpdate` then
coerces built-ins exactly: `row_number` to ROWS unbounded/current;
`dense_rank`/`rank` to RANGE unbounded/current; `percent_rank` to GROUPS
current/unbounded; `cume_dist` to GROUPS 1 FOLLOWING/unbounded; `ntile` to ROWS
current/unbounded; `lead` to ROWS unbounded/unbounded; and `lag` to ROWS
unbounded/current, clearing EXCLUDE and offset expressions. The remaining
first/last/nth value functions retain the user's/default frame.

Bound expressions are evaluated once at each partition initialization, not per
output row. ROWS/GROUPS offsets must be non-negative integers; RANGE offsets must
be non-negative numeric values. Runtime type/range failures retain SQLite's frame
error distinction. RANGE with an offset requires one ORDER expression. ROWS moves
by physical rows; GROUPS moves by peer groups; RANGE uses the single ORDER value,
sort direction, affinity/collation comparison and SQLite's non-numeric `IS`-peer
behavior. With no ORDER term all rows are peers. CURRENT ROW for RANGE/GROUPS
therefore includes the appropriate peer group, whereas ROWS addresses the current
physical row. EXCLUDE NO OTHERS, CURRENT ROW, GROUP and TIES are applied after
frame-bound membership; GROUP removes the current peer group even for ROWS, and
TIES retains the current row while removing its peers. No host `<`, equality,
sort, or numeric coercion may replace existing `Mem`/`KeyInfo` semantics.

### Rewrite ownership, compatible sharing, and nesting

After expansion/name resolution and aggregate analysis, and before the ordinary
WHERE loop, port `sqlite3WindowRewrite`. For the main compatible window it moves
the original FROM, WHERE, GROUP BY and HAVING into one generated subquery, orders
that producer by PARTITION then ORDER expressions, and leaves the parent ORDER,
LIMIT and OFFSET at the outer level. It rewrites terminal/column expressions from
the parent result and ORDER lists into buffered subquery columns; appends partition,
order, function arguments and FILTER inputs; allocates `regAccum` and `regResult`
per function; and assigns `iEphCsr` plus three duplicate cursors to the main window.
The existing immutable Select/source/name graphs remain the compiler input. The
rewrite walker must preserve the pinned nested-expression boundary: when
`selectWindowRewriteSelectCb` enters a scalar subselect,
`selectWindowRewriteExprCb` may lift only `TK_COLUMN` nodes whose cursor belongs
to the outer SELECT's original `SrcList`. It must not lift that subselect's local
columns, aggregates, or window functions into the outer window buffer. After the
generated subquery layer is attached, `sqlite3WindowExtraAggFuncDepth` walks it
with SELECT-depth tracking and increments `Expr.op2` only for qualifying
`TK_AGG_FUNCTION` references whose recorded depth reaches across the inserted
layer. This preserves current scalar-subquery correlation and aggregate ownership
instead of relying on generic expression rewriting.

Validation and sort-copy branches execute in pinned order. Before mutating a
SELECT not marked `SF_Aggregate`, `disallowAggregatesInOrderByCb` walks its ORDER
BY and retains the prepare-time `misuse of aggregate` diagnostic for an unowned
aggregate (`pAggInfo==0`). To create the generated producer ORDER, the
`exprListAppendList(..., bIntToNull=1)` path copies PARTITION then ORDER terms,
retains every term's sort flags, and changes a copied integer literal (after
COLLATE/likely wrappers) to NULL; the original frame expressions remain owned and
unchanged. If the parent's ORDER BY is expression-identical to a prefix no longer
than that generated sort list, `sqlite3WindowRewrite` deletes the redundant parent
ORDER before rewriting its remaining result/ORDER expressions. Snapshot and
source-derived tests must assert this validation ordering, copied-node identity,
integer-to-NULL behavior, sort flags, prefix comparison/elision, scalar-subselect
cursor filtering, and post-layer `op2` repair. Together these branches preserve
metadata, affinity/collation, admitted aggregate/subquery/CTE callers, observable
errors, sorter work, and correlated references.

`sqlite3WindowLink` and `sqlite3WindowCompare` define sharing. The comparator is
tri-state: only an exact return value of `0` permits one SELECT scan and chain;
`1` (different) and `2` (indeterminate expression identity) are both
non-shareable and follow the nesting path. Exact equality covers frame
kind/bounds/exclusion/PARTITION/ORDER; the FILTER is function-local and does not
split that frame chain. A non-shareable window is left outside the chain. Recursive
`sqlite3Select` compilation then wraps
the SELECT again, yielding source-shaped nested scans for different windows rather
than one host multiplexer. Differing PARTITION marks the multi-part condition.
This same-window sharing/different-window nesting is load-bearing: a shortcut that
materializes all windows together changes sorting, callback order, memory timing,
and errors. Compound arms retain their own SELECT/window ownership. Flattening
must continue to honor the existing window restriction; CTE, derived-source,
aggregate, join, compound, DISTINCT and ORDER/LIMIT composition is admitted only
when every required underlying route can preserve this rewrite. Otherwise the
whole statement fails before Program publication—never partial lowering or a
runtime “unsupported” after side effects.

### VM interface and execution modes

The rewritten subquery is an ordinary SELECT producer. `select.c` supplies each
sorted producer row through the existing select-loop destination/coroutine
contract; `sqlite3WindowCodeInit` opens `iEphCsr` and three duplicate cursors and
allocates partition/application state. `sqlite3WindowCodeStep` consumes producer
columns, detects partition boundaries with `KeyInfo`, and enters the outer row
subroutine using `Gosub(regGosub, addrGosub)`; that subroutine reads window
`regResult` values and terminates with `Return(regGosub)`. This is distinct from,
but composes with, `InitCoroutine`/`Yield`/`EndCoroutine` used by derived/CTE
producers. The existing VM integer pc/register adaptation must preserve pinned
Gosub return-address and coroutine pc-exchange semantics across async suspension;
there is no recursive Statement or JavaScript generator substitution.

Each partition buffer stores the rewritten producer record. The current, write,
frame-start and frame-end cursors share it; peer-register arrays use resolved
ORDER `KeyInfo`. The source state machine advances `WINDOW_AGGSTEP`,
`WINDOW_AGGINVERSE`, and `WINDOW_RETURN_ROW`, deleting a row only at the
source-selected safe point (after leaving the frame, after entering it, or after
return), or retaining the partition when required. ROWS uses counters, GROUPS
advances on peer transitions, and RANGE uses the source range tests with ASC/DESC
and collation-aware comparisons. Partition transition calls the flush subroutine,
finishes every pending row, resets cursor/accumulator state, then admits the next
partition. Empty and inverted frames still invoke the source result/finalization
path and produce SQLite values/errors.

Preserve the source's two modes rather than imposing “always sliding” or “always
cache”. Ordinary inverse-capable aggregate windows call step as rows enter,
inverse as rows leave, value for interim output, and final exactly at accumulator
teardown. Frames/functions for which `windowCacheFrame` is true retain the needed
partition/frame and may recompute or random-access it; EXCLUDE uses the full-scan
path over the selected frame with the exclusion predicate. `lead`/`lag` are
bytecode-owned random accesses; first/nth value use application cursor/registers;
sliding min/max owns its keyed ephemeral structure. Built-in `row_number`, rank,
dense-rank, percent-rank, cume-dist, ntile, first/last/nth and lead/lag retain the
callback-versus-bytecode split registered by `sqlite3WindowFunctions`; do not
replace them with generic aggregate callbacks. Aggregate functions from `func.c`
reuse their existing `FuncDef` step/final/value/inverse ownership and FILTER gates.
A function lacking the callbacks required by an admitted mode must be rejected at
prepare, not emulated by an unrelated host algorithm.

### Bounds, lifecycle, integration gates, and avoided complexity

Window buffers, peer/application ephemerals, retained aggregate values and copied
`Mem` payloads consume the statement's one immutable `PrivateStateByteBudget` and
existing private entry/key ceilings; they are not charged to `maxRows` or
`maxResultBytes`. A buffered row is one private entry, each auxiliary min/max key
is an entry, and all simultaneously live nested-window/subquery/CTE/sorter state
shares the execution-wide byte ceiling. Reserve before growth, roll back failed
growth, release on safe row deletion/partition reset, and include copied logical
bytes and every `KeyInfo` term/cursor move/callback in deterministic work charging.
No implementation may rely on a partition fitting host memory merely because
SQLite may cache one. These are bounded adaptations required by the browser-safe
product contract; they preserve SQL values, ordering, callback order and errors,
while resource excess remains project `kind:"limit"`, not a counterfeit SQLite
code.

Every input advance, peer/range comparison, frame move, callback, scan and emitted
outer opcode observes the existing cancellation/deadline/yield boundary. A host
yield retains producer/coroutine pc, Gosub return register, all window cursors,
peer/bound registers, accumulators, private reservations and the current output
row without replay. `maxRows` is charged only when the outer `ResultRow` publishes.
Reset invalidates the row and tears down every partition/application cursor and
accumulator exactly once, clears pcs/register state, retains bindings, and rebuilds
execution from pc 0; rebind after reset sees no cached frame. Finalize/error/
cancellation/deadline and deferred connection destruction continue cleanup,
release all reservations once, and preserve the first operation error. Busy close
and valid zombie/deferred-close behavior remain exactly the public lifecycle
contract above; a pending step continues to own connection admission across yields.

Load-bearing prerequisites are generated semantic values for all window
productions; full Window/Expr ownership and resolver flags; source `Mem`,
comparison/collation and numeric coercion; aggregate callback contexts including
inverse/value/final; typed ephemeral duplicate cursors and shared byte accounting;
Gosub/Return plus coroutine state; nested SELECT rewrite/lowering; and existing
aggregate, subquery/view, CTE, join, compound, ORDER/DISTINCT/LIMIT destinations.
Implementation should proceed graph/resolution tests, rewrite snapshots, VM
control/private-state tests, then pinned public oracle matrices for defaults,
inheritance, peers/bounds/EXCLUDE, every built-in and aggregate callback mode,
identical/different windows, and admitted compositions. Inject tiny limits,
yields, cancellation/deadlines, reset/rebind/finalize and cleanup faults. Compare
INTEGER/REAL/NULL/TEXT encoding/BLOB, rows, metadata and prepare-versus-step errors.
Until those gates are promoted, runtime support remains zero.

The immutable native sidecar described in `docs/CONFORMANCE.md` adds a fail-closed
setup-provenance gate: every one of its 10 credited upstream assertions uses setup
SQL reconstructed from a hashed complete pinned setup assertion, including the
post-`reset_db` state at `window1-6.1` for case 6.3 and the complete
`window4-4.0` state for case 4.1. Its 28/28 native executions and 10/10 upstream
credit remain native evidence only; all 29 TS entries remain unattempted and
zero-credit.

Rejected alternatives are an AST interpreter, host array sort/slice, JS
Map/equality peer grouping, one materialize-all window engine, recursive prepared
statements, and native/WASM delegation. They duplicate existing semantic owners or
lose source control/resource timing. No exceptional algorithm substitution is
selected by this decision; ordinary objects, `BigInt`, typed byte arrays and async
VM suspension are representation/execution adaptations under the invariants above.

### Window graph implementation checkpoint ([[card:card-o-b-a]], 2026-09-18)

The generated-parser/resolver owners now expose an immutable resolved-window handoff corresponding to the mutable upstream graph before rewrite: named definitions are chained against earlier declarations, function-owned `OVER` nodes copy resolved definitions, built-in lookup/arity and frame coercion run in update order, and compatible functions carry a common link-group identity while different frames/partitions remain separate for nested rewrite. Parser frame nodes retain implicit/default identity, exclusion and bound expressions, including `sqlite3WindowAlloc`'s explicit integer-zero-to-CURRENT canonicalization. This checkpoint does not admit execution or alter the window conformance denominator; `sqlite3WindowRewrite` and frame VM work remain separate mapped work.

### Window rewrite foundation checkpoint ([[card:card-o-b-f]], 2026-09-18)

`src/internal/window-rewrite.ts` now represents the selected pinned pre-code-generation branches from `window.c:sqlite3WindowRewrite` as an immutable compiler handoff. Resolver-owned cursor/depth evidence drives the post-attachment equivalent of `sqlite3WindowExtraAggFuncDepth`: an aggregate inside a scalar subquery is repaired only when its resolved column ownership crosses the newly inserted producer SELECT; a nested aggregate over its own local cursor is unchanged. The immutable rewrite graph records before/after depth rather than mutating parser reductions. Before rewrite construction, non-aggregate SELECT `ORDER BY` aggregates retain the `disallowAggregatesInOrderByCb`-owned exact `misuse of aggregate: name()` diagnostic. Public table-backed prepare now reaches resolution and this rewrite phase before ordinary aggregate-shape dispatch, then rejects window execution atomically before Program/Statement publication. Scalar prepare retains the same publication gate. This is a TypeScript immutable-graph representation adaptation, not an algorithm substitution: the selected predicates and depth walk follow pinned `window.c`, and focused source/public tests cover changed and unchanged depths and exact errors. This checkpoint does not claim the complete mutable SELECT rewrite or emitted `OpenEphemeral`/`OpenDup`/`Gosub`/`Return` program: the handoff records their planned ownership only. Frame lowering/stepping remains unimplemented and receives no conformance credit.

### Window emitted setup checkpoint ([[card:card-o-b-g]], 2026-09-18; historical)

The statements in this checkpoint describe the then-current pre-frame boundary; the aggregate and special execution sections below supersede its runtime and admission claims.

`src/internal/vdbe.ts:compileWindowSelectLowering` now consumes the resolved/rewrite graph and emits a non-publishable compiler-owned producer-loop `Program`. Following pinned SQLite 3.53.4 `window.c:sqlite3WindowCodeInit` and the `select.c` select-loop handoff, each compatible layer emits one `OpenEphemeral`, three `OpenDup` operations, partition-register NULL initialization, `regOne=1`, accumulator NULL initialization, and a layer-owned `Gosub`/`Return`; `regResult` identities are reserved by the same register allocator. Compatible functions share the cursor family while incompatible nested layers retain distinct cursor/register ownership. `KeyInfo` carrying the producer width is this VDBE's typed ephemeral equivalent. This is a representation adaptation, not an algorithm substitution. `sqlite3WindowCodeStep`, frame buffering, callbacks, and row production remain absent. Public scalar/table prepare still rejects atomically before returning a `Program` or `Statement`; the setup compiler is internal evidence only and window conformance remains exactly 29 declared, 0 TypeScript attempted, 0 credited.


### Window recursive ownership correction ([[card:card-o-b-b]], 2026-09-18; historical checkpoint)

The pre-frame statements in this checkpoint are retained as provenance and are superseded by the execution sections below. Accepted root review `record:///review.md?card=card-o-b&v=3` corrected the earlier flat-layer description. `WindowRewriteGraph.root` is now an explicit recursive compiler-owned SELECT/subquery chain: only its innermost `kind:"original"` producer owns FROM, WHERE, GROUP BY, and HAVING, while every incompatible outer group has a `kind:"rewritten-select"` edge to the complete prior rewrite. Compatible functions remain in one layer. The internal lowering compiler walks these edges inside-out and binds each layer to the ordinary generated producer loop instead of treating `layers` alone as ownership. Focused tests traverse the recursive chain, prove exactly one original-clause owner, and verify compiler setup order. This is still pre-frame architecture evidence: the pre-step lowering Program scans the ordinary producer but does not evaluate frame rows, `sqlite3WindowCodeStep` remains absent, and public prepare rejects before Program/Statement publication. The select-loop integration is now emitted; the non-common `sqlite3WindowCodeInit` branches called out by that review remain deferred; no runtime or conformance credit is claimed.

### Producer-loop integration correction ([[card:card-o-b-g]], 2026-09-18; historical checkpoint)

The no-publication boundary here is historical and superseded by the represented execution surface below. In response to `record:///review.md?card=card-o-b&v=3`, `compileWindowSelectLowering` now follows the corrected recursive graph from [[card:card-o-b-b]], opens the ordinary resolved table producer exactly once, and emits each compatible group’s `Gosub` inside that producer’s row loop in inside-out recursive order. The matching `Return` is owned by the outer continuation. Both public compiler routes invoke this lowering before deliberately discarding it and throwing temporary unsupported, so no Program/Statement is published. The mapped `sqlite3WindowCodeInit` scope is explicitly only its common prefix. EXCLUDE’s rowid/application cursor and the min/max, first/nth-value, lead/lag application state are deferred because they are consumed only by `sqlite3WindowCodeStep` frame navigation; emitting inert allocations before that owner exists would overstate behavior. Their resolved syntax/function identity remains preserved for honest rejection and source-based later lowering.

### Window ORDER-prefix structural identity correction ([[card:card-o-b-b]], 2026-09-18)

The fidelity notification accompanying immutable review `record:///review.md?card=card-o-b&v=9` identified token normalization as an invalid stand-in for pinned `expr.c:sqlite3ExprListCompare` in `window.c:sqlite3WindowRewrite`. Parent ORDER-prefix elision now uses the resolver's generated-tree structural identity with top-level COLLATE retained, together with parser-derived direction and NULL-placement flags. Generated sort copies therefore compare by expression operators, wrappers, collation identity, literals and sort semantics rather than SQL token spelling. Focused discriminators cover case-insensitive identical COLLATE trees, different collations, direction mismatch, `bIntToNull` changing an integer sort tree to NULL, grouping-wrapper equivalence, and independent flags on recursive multi-term sortlists. The latter prevents a prior term's DESC/NULLS tokens from leaking into a later item, matching per-item `ExprList_item.sortFlags`. Recursive ownership and lifting were unchanged at this historical checkpoint; its pre-frame/public-admission boundary is superseded by the represented execution sections below.

### Recursive producer lowering correction ([[card:card-o-b-g]], 2026-09-18; historical checkpoint)

The non-publishable boundary in this checkpoint is superseded by later aggregate and special execution. Accepted review `record:///review.md?card=card-o-b&v=9` supersedes the earlier claim that placing all Gosubs in one original-source loop realized recursive ownership. `compileWindowSelectLowering` now emits the graph itself as a coroutine chain. The innermost generated producer alone owns original FROM/WHERE/GROUP/HAVING and uses properly nested ordinary source loops (each outer row rewinds its inner source). Each layer owns PARTITION/ORDER sorter production, consumes its child coroutine, emits its per-row Gosub, and yields to a distinct outer producer; every incompatible group therefore has a separate loop/coroutine boundary. Compatible functions remain one layer and one producer. This remains a non-publishable pre-step product: no frame stepping or result publication is admitted.

### Aggregate-window execution contract ([[card:card-o-c-a]], 2026-09-18)

This is the historical executable **preimplementation** handoff for aggregate windows. Its no-admission statements are superseded by “Aggregate-window execution completion” below. It
supersedes no public admission statement above: `sqlite3WindowCodeStep` remains
unimplemented, prepare still rejects the whole statement before publishing a
Program/Statement, and the new matrix has **0 TypeScript attempts/credit**. The
pinned identity is SQLite 3.53.4/source-id and archive hash in
`reference/sqlite/manifest.json`. Accepted [[card:card-o-b]] evidence at clean
`e6007667362d7ce3e2eca4caf136a4fbc940c3f0` supplies the generated graph,
recursive rewrite, producer coroutine chain and common `CodeInit` prefix; this
contract starts at the missing step owner and preserves those boundaries.

#### Exact source control map

* `window.c:sqlite3WindowCodeInit` (line 1388) owns one ephemeral partition
  cursor and three duplicates, `regOne`, accumulator/result/application
  registers, and non-common branches: min/max keyed cursors; cached-frame
  `regStartRowid/regEndRowid`; and first/nth/lead/lag application cursors. Those
  branches must be added at their source-selected consumers, not as inert setup.
* `select.c:sqlite3Select` lines 8284/8332 owns the call order around the ordinary
  WHERE loop and the `regGosub/addrGosub` continuation. `window.c` lines
  1619-2435 own peer reads, `windowAggStep`, `windowAggFinal`, EXCLUDE
  `windowFullScan`, `windowReturnOneRow`, accumulator initialization,
  `windowCacheFrame`, `windowIfNewPeer`, `windowCodeRangeTest`, and
  `windowCodeOp`; `sqlite3WindowCodeStep` starts at line 2784. Partition change
  compares copied PARTITION registers with `KeyInfo`, gosubs the flush path, and
  only then resets/restarts for the newly inserted partition.
* The frame decision is source-shaped, not a generic host recomputation. The
  three start/end families (PRECEDING/CURRENT/FOLLOWING, with legal UNBOUNDED
  endpoints) select the `WINDOW_AGGSTEP`, `WINDOW_AGGINVERSE`, and
  `WINDOW_RETURN_ROW` schedule. ROWS advances physical rows; GROUPS repeats an
  operation through peers using `windowIfNewPeer`; RANGE offset uses
  `windowCodeRangeTest`, reversing arithmetic/operators for DESC, handling
  BIGNULL explicitly, skipping arithmetic for non-numeric peer values, and
  comparing with the resolved collation plus `SQLITE_NULLEQ`. Inverted same-side
  bounds emit empty frames without moving a cursor past its counterpart.
* `windowCacheFrame` is true for EXCLUDE (`regStartRowid`) and
  first/nth/lead/lag. EXCLUDE uses `windowFullScan`: clear each accumulator,
  scan frame rows, skip CURRENT/GROUP/TIES according to current rowid and peer
  comparison, step accepted rows, then `AggFinal`. The ordinary inverse-capable
  route streams with safe-point deletion selected by start/end shape; it calls
  step on entry, inverse on departure, value for output, and final only at
  teardown. first/nth and lead/lag remain cursor/bytecode owned; sliding min/max
  keeps its keyed ephemeral. There is no accepted always-cache engine, JS array
  frame, or generic callback substitute.
* `windowCheckValue` owns runtime bound checks: ROWS/GROUPS require a
  non-negative integer, RANGE a non-negative number, and nth/ntile their
  positive-integer diagnostics. Expressions are evaluated once at partition
  initialization. Parser/update legality (including one ORDER term for offset
  RANGE and illegal bound order) remains prepare-time. Do not collapse these
  prepare/step phases or their pinned messages.
* `vdbe.c` lines 7837-8019 own `AggStep/AggInverse/AggValue/AggFinal`, including
  inverse-count checks, context/error propagation and finalization; lines
  1119-1175 own `Gosub/Return`. `vdbeaux.c` remains the Program/op/P4 lifetime
  owner. Every emitted callback uses the existing aggregate registry definition,
  FILTER gate, argument `Mem`s, collation and one accumulator context; a missing
  inverse/value callback required by an admitted schedule is a prepare rejection.

#### Consumer execution and lifetime contract

One window layer owns its producer coroutine pc, sorter, partition cursor family,
peer/bound registers, callback contexts, Gosub return register and outer
continuation. Compatible windows share that layer and producer scan; incompatible
windows retain the nested coroutine layers already established by
[[card:card-o-b]]. `Gosub` stores the next VM pc and `Return` resumes it. A public
row suspension preserves all coroutine/window pcs, cursors, current row,
accumulators, contexts and reservations; resumption must neither replay a producer
row nor repeat step/inverse/value/final. No recursive Statement or JS generator is
introduced.

All window rows, sorter records, copied `Mem`s, min/max keys and retained callback
values reserve atomically from the statement execution's single
`PrivateStateByteBudget`; nested window/subquery/CTE/aggregate state shares it.
Existing private entry/key limits and deterministic `maxWorkUnits` cover each row
admission, logical byte copy, KeyInfo term, cursor move, range/peer comparison and
callback. `maxRows` remains exclusively outer-`ResultRow` publication and
`maxResultBytes` remains delivered values. Reserve before mutation, roll back a
failed growth, release at the source safe point, partition reset or teardown.
Reset/finalize/error/cancel/deadline closes every cursor and context exactly once;
the first operation error wins over cleanup diagnostics. Reset retains bindings
but no frame state. These browser bounds are the existing product adaptation, not
an algorithm substitution, and do not alter successful SQL values/order/errors.

Preparation is atomic for every composition. A join, grouped producer, scalar
subquery, ordinary/recursive CTE, compound or outer ORDER/LIMIT route is admitted
only when its complete recursive producer, every window frame mode and final
result destination are represented. Otherwise reject before Program publication;
never run a partial producer and never recompute a window in host code.

#### Executable allocation and denominator

`test/conformance/cases/stage3-aggregate-window.spec.json` is the immutable-input
allocation: exactly **44 declared = 25 literal upstream source-credit + 19 local
companions**. Of these, **43 are native executable and 43/43 were captured** from
the independently built pinned library; one local private-control declaration is
source-only. Source-credit bodies carry exact source assertion hashes and setups
carry full setup assertion hashes. They cover default aggregate windows, every
ROWS bound family (including inverted/empty), RANGE/GROUPS, all four EXCLUDE
forms, shared/different windows, registry aggregates, grouped and recursive-CTE
composition, and prepare/runtime errors. Local companions supply all three
encodings, typed INTEGER/REAL/NULL/TEXT/BLOB values, ASC/DESC/collation/NULL peer
policy, RANGE/GROUPS offsets, offset coercion diagnostics, join/subquery/ordinary
CTE/outer ORDER/LIMIT, registry breadth, same-window FILTER sharing, and project
resource/lifecycle controls. Source credit and companions are deliberately never
interchangeable. Current accounting is native **43 attempted/43 passed, 25
credited**; TypeScript executable **43 attempted/43 passed, 25 source-credited**;
source-only private controls **1 validator attempted/1 passed** (no source credit);
this is bounded evidence, not exhaustive SQLite window compatibility.

#### EXCLUDE source-case correction ([[card:card-o-c-a]], 2026-09-18)

Implementation inspection found that the original source-credit ordinals 22–25,
`window8-2.1.2` through `window8-2.4.2`, call `nth_value()`. That special value
built-in uses dedicated `window.c` application cursor/register state and control;
it is outside this aggregate-window step contract. The allocation now uses the
adjacent literal upstream aggregate cases `window8-2.1.3`, `2.2.3`, `2.3.3`, and
`2.4.3`. Each runs `min(c)`, `max(c)`, and `sum(c)` over the corresponding
`EXCLUDE NO OTHERS`, `CURRENT ROW`, `GROUP`, or `TIES` frame. This preserves all
four EXCLUDE modes, literal source provenance, and the 44/25/19 denominator while
removing any implication that `nth_value` state or execution is in scope.

The replacement changes the sampled frame from unbounded-to-unbounded with a
single special value function to unbounded-preceding-to-current-row with three
ordinary registered aggregates. It therefore tests aggregate EXCLUDE full-scan
results directly, but no longer supplies evidence for an unbounded-following
EXCLUDE frame in these four source-credit slots. `nth_value`, first/last value,
and lead/lag remain separate specialized consumers and are not admitted by this
contract.

#### Sliding min/max and group-concat lifecycle (aggregate-window implementation)

Pinned `window.c:sqlite3WindowCodeInit` selects an ordered ephemeral structure for
sliding `min()`/`max()`, while pinned `func.c:groupConcatInverse` removes the
oldest value and its following separator. The browser/read-only adaptation stores
the same frame-owned logical entries inside the aggregate context: min/max keep a
collation-ordered multiset of owned `Mem` cells, and group-concat keeps FIFO text
plus per-entry separators. This avoids introducing another VDBE cursor kind while
preserving step/inverse/value results, duplicate extrema, variable separators,
and NULL handling. Only extrema accumulators whose emitted program contains a
matching `AggInverse` use the multiset. Ordinary aggregate min/max continues to
follow `func.c:minmaxStep`: it owns only the current best `Mem` and atomically
replaces that value's byte reservation, so adding sliding support does not retain
all ordinary inputs. Every retained logical value/separator is charged to the
statement `PrivateStateByteBudget`; inverse and exact-once context cleanup release
it. The source-based `companion-aggregate-registry` case exercises count, sum,
avg, total, duplicate-capable min/max, and group-concat over one shared bounded
ROWS scan.


#### Aggregate-window execution completion ([[card:card-o-c-b]], 2026-09-19)

`compileWindowSelectLowering` now publishes the represented aggregate-window
program and translates the pinned CodeInit/CodeStep control families described
above. Typed ephemeral cursors, coroutine pc/register state, aggregate callbacks,
peer/partition keys and frame caches remain VM-owned across yield. Represented
recursive CTEs use the existing queue VDBE as a coroutine producer: its
`ResultRow` destination becomes payload copies plus `Yield`, rather than host
recursion or frame recomputation. Unsupported shapes still reject before Program
publication. At that aggregate-only checkpoint, ranking and value special built-ins
remained outside the tranche; the special-built-in execution section below
supersedes that limitation for the bounded represented surface.

Final evidence is executable 43/43 (25/25 source-credit) through the public API
plus the separate no-credit ordinal-44 validator for private entry/key/byte, work,
row, cancellation, deadline, reset and first-error behavior.

### Special built-in window executable gate ([[card:card-o-d-a]], 2026-09-19)

The zero-credit implementation contract is
`test/conformance/cases/stage3-special-window.spec.json`; the adjacent captured
JSON is the immutable pinned-native expectation. It declares 43 cases: 11 exact
`window1.test` assertions, 30 executable no-credit companions, and two source-only
safety/atomic-rejection companions. Native capture executes 41/41. This historical
allocation checkpoint recorded TypeScript as 0/43 before implementation; the
execution section below supersedes that runtime accounting with 41/41 executable
cases plus both separately validated source-only companions. This gate supplements,
and does not relabel, the aggregate-window 44-case denominator.

Pinned `src/window.c:sqlite3WindowFunctions` registers `row_number`, `rank`, and
`dense_rank` as zero-argument `WINDOWFUNCX`; `percent_rank` and `cume_dist` as
zero-argument `WINDOWFUNCALL`; `ntile(1)`, `last_value(1)`, `first_value(1)`, and
`nth_value(2)` as `WINDOWFUNCALL`; and `lead`/`lag` arities 1, 2, and 3 as
`WINDOWFUNCNOOP`. The latter are not callback algorithms: `windowReturnOneRow`
uses the buffered rowid plus `AddImm` or evaluated offset and `SeekRowid`, installing
the third argument or NULL before lookup. `first_value`/`nth_value` also read the
frame through duplicate cursors/result registers and therefore force
`windowCacheFrame`; `lead`/`lag` force partition caching independent of the stated
frame. `last_value`, ranking, distribution and `ntile` retain callback step,
inverse/value/final behavior as registered.

`sqlite3WindowUpdate` discards user frame bounds and EXCLUDE for: row_number
(ROWS UNBOUNDED PRECEDING..CURRENT), rank/dense_rank (RANGE UNBOUNDED..CURRENT),
percent_rank (GROUPS CURRENT..UNBOUNDED FOLLOWING), cume_dist (GROUPS 1 FOLLOWING..
UNBOUNDED FOLLOWING), ntile (ROWS CURRENT..UNBOUNDED FOLLOWING), lead (ROWS
UNBOUNDED..UNBOUNDED), and lag (ROWS UNBOUNDED..CURRENT). Value functions
first/last/nth retain the user/default frame and EXCLUDE semantics. FILTER on every
special built-in is rejected exactly as `FILTER clause may only be used with
aggregate window functions`.

Implementation must extend the existing source-shaped frame engine, shared
`Mem`/aggregate context, typed ephemeral cursors and compiler register allocator;
it must not add a host-array window evaluator. `sqlite3WindowCodeInit` owns the
main ephemeral cursor plus three duplicates, per-function application cursors and
registers, and EXCLUDE full-scan state. `sqlite3WindowCodeStep` evaluates frame
bounds once per partition, buffers rewritten input records, detects partition and
peer changes with `KeyInfo`, chooses delete timing (`inverse`, return, step, or
never), finalizes/values into each reserved `regResult`, and returns rows through
the existing Gosub result subroutine. The gate covers peer NULL/NOCASE ordering,
no-ORDER partitions, explicit-frame coercion, value-function ROWS/GROUPS/RANGE and
EXCLUDE behavior, argument errors/parameters, mixed sharing, illegal nesting,
join/group/derived/CTE/recursive/compound compositions, three database encodings,
progress interruption, and project cleanup/limit policy. Unavailable read-only
compositions and non-result contexts remain indivisible atomic prepare rejections;
no partial Program or execution may escape.

### 2026-09-19 — REAL-affinity column extraction correction

Pinned `expr.c:sqlite3ExprCodeTarget` emits `OP_RealAffinity` after `OP_Column`
when the resolved table column has `SQLITE_AFF_REAL`; pinned
`vdbe.c:OP_RealAffinity` realifies only `MEM_Int|MEM_IntReal`. This matters because
record serial types deliberately retain compact integral values as INTEGER. The
single-table projection lowering now emits a separate `RealAffinity` operation for
resolved direct REAL columns, rather than changing record decode or applying a
JavaScript-number heuristic. Fresh native baseline execution against source ID
`2026-07-24 19:02:57 bf7c7f30031888f4e796e429ab3978879485813aaca6f641c7b33e4e09459bcc`
returned `real|20.0`, `real|10.0`, `real|35.5`, and `null|NULL` for
`orders.amount` in every encoding; the pre-repair public path instead returned
INTEGER/`bigint` for the compact 20 and 10 records. Commit
`ab674fd7b84ddeb5ff0b0b4dde9ffa19a9cfc1ff` corrected direct projection, but was
partial: expression-tree column reads still emitted bare `Column`. A fresh pinned
oracle baseline for `typeof(amount),amount`, `sum/total/avg(amount)` on a single
10.0 row, and `amount+0` returns REAL at every column consumer; the pre-follow-up
public path reported `typeof` as `integer`, `sum` and arithmetic as INTEGER/`bigint`
while direct `amount`, `total`, and `avg` happened to be REAL. Column-expression
lowering now follows all applicable `expr.c:sqlite3ExprCodeTarget` branches and
emits `RealAffinity` immediately after reading a resolved REAL column, before
function, aggregate, or arithmetic consumers. Direct projection retains its
existing operation. Public Fetch tests in `test/select/real-column-affinity.test.mjs`
over source-ID-pinned UTF-8, UTF-16le, and UTF-16be fixtures cover these consumers,
optimized 20.0/10.0, 35.5, NULL, signed int64 boundaries, neighboring
NUMERIC/INTEGER columns, metadata, stable `columnType`, reset/finalize, and later
connection use. Raw record decode and NUMERIC/INTEGER semantics are unchanged.
The generalized expression-consumer repair is commit
`ad433c2a4ae92bf679ff6303e3ea421ce73f0234`; unsupported SQL consumers are not
included in the verified set.

#### Special built-in window execution ([[card:card-o-d-b]], 2026-09-19)

`compileWindowSelectLowering` now executes the eleven pinned special built-ins on
the existing callback/frame engine. Registration arities and
`sqlite3WindowUpdate` coercions stay resolver-owned; callback built-ins use
`AggStep`/`AggInverse`/`AggValue`, while lead/lag and first/nth application paths
retain duplicate ephemeral cursors and rowid access. Compatible windows share a
layer and incompatible windows consume nested coroutine payloads. The represented
composition surface includes joins, grouping, subqueries, CTE/recursive producers,
compound arms, and outer ordering/limits. Unsupported expressions remain an
atomic prepare-time rejection; this is not a general window/SQL completeness
claim.

The window source producer also preserves ordinary scalar predicates while moving
FROM/WHERE into the rewritten subquery. Its reduction-to-VDBE binder descends into
function arguments and retains SQLite's reversed pattern/candidate argument order
for infix LIKE/GLOB. `count(*)` is represented as the zero-argument aggregate call
that reaches `countStep`, not as a synthetic buffered argument. Public Fetch
coverage in `test/conformance/ordinary-scalars-pattern-window.test.mjs` exercises
both branches with LIKE in WHERE and `count(*) OVER ()`.

The public special-window gate passes 42/42 tests: 41 executable declarations and
one denominator test accounting for all 43 declarations, including two source-only
companions. The aggregate-window/rewrite gate passes 92/92. Current publication is bounded to the represented aggregate and eleven special-built-in shapes described in these execution sections; every residual unrepresented frame, expression, or composition is classified and rejected during prepare before a Program/Statement is published. The immutable 29-case `stage3-window` manifest remains historical parser/resolver/rewrite/allocation evidence at 0/29 TypeScript attempts by design, not current runtime accounting.

A bounded ROWS
EXCLUDE scan now rewinds and skips rowids below a possibly absent lower bound, and
the one-preceding GROUPS specialization is selected only for a proven literal 1;
runtime/multi-group bounds use the general peer-group queue. These are source-shaped
cursor/control repairs, not host partition recomputation.

### Ordinary scalar registry tests-first contract ([[card:card-p-a-a]])

The source-pinned inventory, implementation slicing rules, current resolver/VDBE status, and typed native corpus are in [`research/card-p-a-a-ordinary-scalars.md`](research/card-p-a-a-ordinary-scalars.md) and `test/conformance/cases/stage3-ordinary-scalars.spec.json`. Its denominator is 50 active in-scope production ordinary-scalar registration rows. The immutable tests-first capture classified its then-current baseline as 12 dispatched/38 absent; that historical classification, including its 114 unsupported observations, is not current TS credit. Current accounting is stated below. Profile-specific validation parses balanced catalog macro calls and checks pinned macro-definition hashes, current-profile flags, raw/effective arities (including min/max aggregate dispatch), source ownership, physical fixtures, and exact assertion/setup hashes; it is not a general C preprocessor. `sqlite_log` preserves SQL result/argument semantics while routing diagnostics to an internal no-op sink: the browser API exposes no host callback. Translate source routines with shared Mem/UTF/FunctionContext/bounded-work behavior; LIKE/GLOB may not use regex, and printf/round may not use host formatting as an algorithm substitute. Date/time, math and JSON remain future root-owned scope.

Independent review `record:///review.md?card=card-p-a&v=3` corrected two scalar handoff gaps. Persisted-column scalar expectations now run over physical UTF-8/UTF-16LE/UTF-16BE Fetch fixtures with TEXT, embedded-NUL TEXT, BLOB, and NULL rows, plus equivalent typed native setup; current unsupported public outcomes remain zero credit. Each of all 50 registry rows now maps its exact implementation routine into its slice/cases, or an explicit compiler owner for inline forms. `charFunc`, `unistrFunc` and UNISTR escape helpers are distinct from `unicodeFunc`.

After the persisted-column UTF-16 equivalence refutation, scalar native capture and validation open the exact hashed physical fixtures directly with the manifest-pinned oracle. Synthetic `CAST(X'410042' AS TEXT)` setup is prohibited for this evidence. The validator executes every persisted case against every physical encoding fixture and compares typed rows. The all-50 routine-owner mapping remains intact; public unsupported executions remain zero credit.

The current ordinary-scalar denominator is 50 active rows. The immutable profile registry in `src/internal/functions.ts` now represents all 50 names, exact/variadic effective arities, macro-derived flags, and dispatchability. Resolver matching follows `callback.c:matchQuality`'s exact-before-variadic result (including scalar min/max only at two or more arguments), preserves SQLite wrong-arity/no-such-function diagnostics, and reports represented but untranslated callbacks as typed temporary unsupported rather than claiming dispatch. Ordinary SELECT calls lower to the existing VDBE `Function`, matching pinned `sqlite3VdbeAddFunctionCall`: `PureFunc` is selected by a nonzero special call context (CHECK/index/generated-column), not by the registration's CONSTANT flag. The registry nevertheless retains source flags for later context validation. The shared `FunctionContext` now owns indexed aux state as well as its result Mem: replacement/final cleanup is once-only and the first evaluation error retains precedence over cleanup failures. This foundation does not implement or claim printf/format, round formatting, or any other staged callback. The source contract remains 37 cases/59 native observations. The initial inventory was 12 dispatched/38 non-dispatchable rows; the first implementation tranche adds `upper`/`lower`, leaving 14 dispatched/36 non-dispatchable rows. `src/func.c:upperFunc/lowerFunc` is translated as UTF-8 text coercion followed by bytewise ASCII-only mapping, preserving non-ASCII bytes and embedded NUL; result limits and execution checks are applied while scanning. Four immutable-corpus observations exercise public Fetch, no-FROM, NULL, BLOB-to-TEXT, and embedded-NUL behavior in `test/conformance/run-ordinary-scalars-ascii-case-ts.mjs`. Remaining unsupported public observations remain zero credit. `test/conformance/run-ordinary-scalar-foundation-ts.mjs` and the extended cleanup runner provide focused foundation evidence.

The current ordinary-scalar denominator was initially captured as 50 active rows, 37 cases/59 native observations, and 12 dispatched/38 absent. Its physical-fixture gate must be run with a pinned library, for example `python3 test/conformance/ordinary-scalars-manifest.test.py --library /work/jsqlite2/.saivage/work/cards/card-p-a-a/oracle-build/build/libsqlite3-oracle.so`; an argument-less invocation is not a valid check. The final rerun verified the source ID and both persisted cases against all three exact fixtures.

### Ordinary non-pattern/non-format scalar delivery ([[card:card-p-b-a-b]])

At this tranche checkpoint the 50-row pinned registry dispatched 45 rows. This tranche translates the 31
previously absent owned rows through the shared `FunctionContext`/VDBE path:
`unlikely`, `likelihood`, `likely`, `ltrim`, `rtrim`, `trim`, `subtype`, `instr`,
`unicode`, `unhex`, `concat`, `concat_ws`, `unistr`, `quote`, `unistr_quote`,
`zeroblob`, `substring`, `sign`, `ifnull`, `coalesce`, `iif`, `if`, `random`,
`randomblob`, `last_insert_rowid`, `changes`, `total_changes`, `sqlite_version`,
`sqlite_source_id`, `sqlite_log`, `sqlite_compileoption_used`, and
`sqlite_compileoption_get`; `upper`/`lower` were the preceding tranche. Read-only
connection mutation counters are observably zero. `sqlite_log` preserves its SQL
NULL result but intentionally has no host diagnostic callback because this browser
API exposes none. The compiler-inline forms retain short-circuit control flow.
`quote(REAL)` shares the translated `util.c:sqlite3FpDecode` formatter for
`func.c:sqlite3QuoteValue` `%!0.17g`, preserving manifest REAL literals, signed
zero, round-trip boundaries, and SQLite's `±9.0e+999` infinity spelling. TEXT and
BLOB quote expansion is result-limit checked before host-string construction.

At that checkpoint exactly three represented sibling rows remained non-dispatchable: `printf`, `format`,
and `round`; the formatting delivery below supersedes this limitation. LIKE/GLOB translate pinned `func.c:patternCompare`/`likeFunc` as an
explicit work-list state machine (not host regex), preserving ASCII-only LIKE fold,
GLOB sets/ranges/inversion, ESCAPE validation, NUL termination, encoding-aware BLOB
conversion, the 50,000-byte pattern limit, and execution control checks. Date/time,
math, and JSON remain out of this registry.
The owned public Fetch gate compares 26 cases/44 observations, including parameters,
no-FROM expressions, compositions, expected prepare errors, and persisted physical
UTF-8/UTF-16 columns. Mixed-owner corpus rows are projected to owned columns, so
unsupported sibling functions receive no TypeScript credit. `func.c:upperFunc`
first requests UTF-8 text; for BLOB input that conversion begins in the database
encoding, which is why the persisted embedded-NUL BLOB result differs across the
three physical encodings.

### Ordinary-scalar bounded builders (2026-09-20 revision)

Pinned `src/func.c` scalar loops remain the semantic reference, while the browser implementation must additionally honor the public execution controls. Owned output-growing functions now compute UTF-8/BLOB bytes with overflow-safe incremental preflight before joining/encoding/allocating: `unistr`, escaped `unistr_quote`, `concat`/`concat_ws`, `char`, `unhex`, `zeroblob`, and `randomblob`. Linear builders/searches checkpoint every 256 visited characters/comparisons and charge one deterministic work unit per 256 bytes/steps; `instr` retains pinned `instrFunc`'s candidate/needle nested comparison order and charges those comparisons, including adversarial near-matches. Web Crypto remains an adaptation: unlike SQLite's PRNG call, browsers cap `getRandomValues` requests at 65,536 bytes, so `randomblob` pre-admits output/work, allocates once, and checks control between 65,536-byte chunks. `zeroblob` is eagerly materialized because public `columnBlob()` exposes bytes and the current read-only `Mem` has no deferred-zero representation; unlike pinned deferred `MEM_Zero`, output/work are admitted before allocation. Both adaptations preserve result storage class, length/content constraints, SQL errors, and cancellation/error lifecycle; public low-limit/control and source-shaped tests cover them.

### SQL printf/format and round translation (2026-09-20)

The ordinary-scalar path translates pinned `src/printf.c:sqlite3_str_vappendf`
for SQL-supported conversions and `src/func.c:printfFunc`/`roundFunc` in
`src/internal/printf.ts`. It intentionally does not call host printf, Intl, or
locale conversion. The existing translated SQLite floating digit decoder is
shared with the formatter; browser string accumulation is the allocation
adaptation and remains guarded by the connection result-byte limit. Focused
public tests preserve NULL/missing arguments, embedded-NUL termination,
flags/width/precision, integer/REAL boundaries, escaping, composition,
parameters, and statement saved-error cleanup.

### 2026-09-20 formatting fidelity correction ([[card:card-p-b-b]])

The formatting translation now includes source branches omitted by its first
revision: `etORDINAL` (`%r`), decimal comma grouping, terminal `%`, negative
dynamic precision, ordinary byte-counted versus `!` character-counted UTF-8
width, and explicit NaN/infinity zero-padding/sign handling. Width, precision,
padding, grouping, escaping, and floating temporary sizes are admitted before
host string allocation, so hostile dimensions fail as the public `limit` error
rather than a JavaScript `RangeError`. These are direct pinned `printf.c`
branches, not an algorithm substitution; the public gate also checks saved-error
identity, finalize cleanup, and subsequent connection use.

#### Conversion-specific precision admission correction

Precision parsing is overflow-safe but no longer treated as promised output size.
Following pinned `printf.c` `etSTRING`/escape loops, `%s`/`%z`/`%q`/`%Q`/`%w`
scan only the available NUL-terminated input up to byte (or `!` character)
precision, checkpoint that scan, and admit actual escaped and padded output. `%c`
admits actual encoded repetitions; numeric conversions retain their required
materialization preflight. Thus large precision with a short value succeeds under
a small result ceiling while actual excess remains a typed `limit` failure.

#### Conversion-specific width admission correction

Width parsing now follows the pinned 32-bit/capped parser independently of output
admission. Emitting conversions continue to admit actual padding/output before
allocation, while SQL `%n` (`etSIZE`) clears/ignores width, emits nothing, and
consumes no conversion value argument after any dynamic-width argument. This
preserves both hostile emitting-width protection and non-emitting source behavior.

### Value-list `IN` expression tranche (2026-09-20 revision)

The generated reduction `expr ::= expr in_op LP exprlist RP` now owns nonempty
value-list `IN`/`NOT IN` syntax; the empty-list reduction is retained separately.
Lowering follows the pinned `src/expr.c:sqlite3ExprCodeIN` no-index path selected
by `sqlite3FindInIndex`/`IN_INDEX_NOOP`: evaluate the LHS once, compare ordered RHS
terms with shared affinity/collation comparison, stop after a match, and preserve
NULL for no-match lists containing NULL before applying `NOT`. This is register and
control-flow lowering in the shared VDBE compiler, not JavaScript `Set`/`includes`
or a separate evaluator. Predicate `AND`/`OR` remains lazy; projection preserves
pinned eager nonliteral behavior while literal decisive `0 AND` and nonzero `OR`
use the VDBE-shaped `ShortCircuit`/`Boolean` path.

The zero-credit audit has 21 cases executed through the public API against UTF-8,
UTF-16LE and UTF-16BE fixtures (63 observations). It checks storage classes,
collation/affinity, NULL and empty-list truth, parameters, lazy later RHS terms,
projection errors, ordered metadata, reset replay, first-error identity and
finalize handling. Value-list execution does not credit or imply subquery/index-
backed `IN`, planner index selection, or broader relational support.

## Date/time translation handoff ([[card:card-q-a-a]])

The source-backed design, browser clock/timezone seam, full production registration
inventory, exact `DateTime`/iJD flag model, parsing/modifier/result/error branches,
and tests-first accounting are in
[`research/card-q-a-a-date-time.md`](research/card-q-a-a-date-time.md). The mapping
is pinned to `src/date.c` in SQLite 3.53.4 and to `sqlite3StmtCurrentTime` in
`src/vdbeapi.c`; it does not substitute JavaScript `Date` parsing/formatting for
SQLite algorithms. `test/conformance/cases/stage3-date-time.spec.json` declares 18 exact, body-hashed
upstream assertions and 11 exact `src/date.c` source-control assertions for the
24:00 cache-retain/invalidate branches, plus two result-class and nine range
companions across three database encodings. Six concrete clock/timezone contracts have SQL, injected
responses, lifecycle/call-count expectations, typed outcomes, and an executable
public production seam runner. Native capture validates all 120 typed observations
but remains reference-only; public TypeScript execution now carries 29/29 selected
assertion credit as recorded in the execution revision below. The range
contract preserves signed output years: parser/`computeJD` accepts -4713..9999,
final iJD is 0..464269060799999, year 0000 is valid, and callbacks format negative
years with a leading minus.

### Date/time execution revision ([[card:card-q-a-b]])

`src/internal/date-time.ts` now translates the pinned `src/date.c` DateTime/iJD
calendar, parser, modifier, formatter, `timediff`, and result-function control
through the existing builtin registry and VDBE Function/PureFunc dispatch.
Bare `CURRENT_DATE`, `CURRENT_TIME`, and `CURRENT_TIMESTAMP` lower to the same
zero-argument registrations. The private connection environment described in the
handoff is sampled lazily once per execution; reset starts a new execution. Local
field conversion is the sole host-Date adaptation and reports SQLite code 1 when
unavailable; parsing and UTC calendar arithmetic do not use `Date.parse`.

The private environment is intentionally not a public API, so `docs/api.md` needs no
new contract. `docs/CONFORMANCE.md` retains project-wide accounting policy while the
exact date/time denominator lives in its manifest; no global policy changed. The
mutable fidelity audit is updated only when a current finding changes. Ambient local
civil fields remain host timezone/tzdata dependent, while deterministic injected
provider tuples are validated as real civil dates before conversion. Shared VDBE
output, work, cancellation, deadline, saved-error, reset, and finalize contracts
apply; `strftime` scans checkpoint work/cancellation and every TEXT result is size-
preflighted.

The implementation preserves INTEGER `unixepoch`, REAL `julianday`/subsecond
results, NULL invalid/range branches, source modifier ordering, parsed invalid-day state, and independently authoritative iJD/YMD/HMS cache state:
time-only 24:00 formats normalized iJD, while timezone-free full-date 24:00 retains
parsed YMD/HMS until a source branch clears them. `subsec` and no-op `auto`
preserve the caches; numeric modifiers and `ceiling`/`floor` clear them; `Z` and zero offsets retain
fields, while a nonzero timezone clears and recomputes them. This is semantic state,
not a formatter-only hour flag. The implementation also preserves the inclusive
iJD range. `strftime` scans charge shared
work so cancellation/deadline checks happen within variable format input, and all
TEXT callbacks use the VDBE output-size preflight. Public Fetch evidence is in
`run-date-time-cases-ts.mjs` (120 stored typed native observations across all three
encodings plus branch/composition/parameter/column/reset checks) and
`run-date-time-seams-ts.mjs` (clock/timezone call counts, reset/error lifecycle,
and output/work limits). These selected vectors are not a blanket compatibility
claim; the manifest denominator is reconciled at 29/29: 18 body-hashed upstream
assertions plus 11 pinned `date.c` source-control assertions for 24:00 state.

### Ordinary math function tests-first decision

Before runtime translation, the complete pinned `SQLITE_ENABLE_MATH_FUNCTIONS`
registry is frozen in `test/conformance/cases/stage3-math.spec.json`: 30 FuncDef
rows/29 names and all five callback families (`ceilingFunc`, `logFunc`,
`math1Func`, `math2Func`, `piFunc`). Translation must preserve
`sqlite3_value_numeric_type` acceptance (numeric TEXT but not prefixes or BLOB),
`ceilingFunc`'s INTEGER-preserving branch, log's explicit domain checks, and
`sqlite3_result_double`/`sqlite3VdbeMemSetDouble` NaN-to-NULL while retaining
infinities and signed zero. `pow`/`power` and `ceil`/`ceiling` share callbacks but
remain distinct registry rows; `log` retains both arities and its base-first
argument order. The exact-oracle corpus includes upstream `test/func7.test`
assertions and source-derived parameter, persisted-column, composition, storage
class, domain/pole, overflow, and precision cases in every database encoding.
Current runtime absence receives zero credit and requires no substitute evaluator.
The captured Linux host provides the C99 rows; finite libm last-bit portability is
an explicit unresolved question, so future implementation comparison must report
bit differences rather than silently widening expectations.

### Enabled ordinary math translation (2026-09-20, [[card:card-q-b-b]])

The profile's `SQLITE_ENABLE_MATH_FUNCTIONS` block is now represented by 30
`FuncDef` rows / 29 names in the immutable built-in registry and lowered through
the existing `PureFunc`/`FunctionContext` VDBE path. `math.ts` translates pinned
`func.c:ceilingFunc`, `logFunc`, `math1Func`, `math2Func`, and `piFunc`: wrapper-
gated arguments use numeric TEXT conversion but BLOB/non-numeric rejection;
`log(B,X)` preserves pinned `sqlite3_value_double(X)` numeric-prefix/BLOB
conversion in the database encoding. INTEGER preservation for the
rounding wrapper, domain and NaN-to-NULL behavior, infinity, signed zero, REAL
callback results, aliases, exact arities, and two-argument log control flow.

ECMAScript `Math` is the required browser-safe replacement for C libm; no native,
WASM, eval, host registration, or separate expression evaluator is introduced.
The concrete wrapper behavior remains source-translated, while finite
transcendental last-bit identity on libm hosts other than the pinned capture host
is not guaranteed. Public typed comparison passes all 22 immutable cases / 66
encoding-specific observations, including parameters, columns, composition and
all three fixture encodings. The `signed-int64-extrema` case makes both signed
64-bit endpoints load-bearing: `ceil`/`ceiling`/`floor`/`trunc` retain exact
INTEGER payloads, while representative `sqrt`, `sin`, `pow`, and `mod` calls
record the pinned INTEGER-to-double conversion, REAL payloads, and domain NULL.
`math-manifest.test.py` enforces those types and IEEE-754 payloads in every
encoding so this coverage cannot silently disappear. Commands: `npm run typecheck` and
`node --experimental-strip-types test/conformance/run-math-cases-ts.mjs`.

### JSON/JSONB representation foundation (2026-09-21, [[card:card-r-a]])

`src/internal/json.ts` translates the pinned 3.53.4 `src/json.c` JSONB type/header
layout, text/JSON5 recursive descent, canonical renderer, `json_valid` flag split,
and `JsonParse`-shaped ordered tree. Objects are ordered entry arrays, not host
objects, so duplicate labels survive; numbers retain source spelling until the
same JSON5 canonicalization boundary. JSON text travels as `Mem` subtype 74;
JSONB travels as an ordinary BLOB with subtype 0 and is recognized by its
validated JSONB header/payload, matching `json.c:jsonArgIsJsonb` and the
`JFUNCTION(jsonb, ..., bRS=0, ..., bJsonB=1, ...)` registration. This distinction
is load-bearing when JSONB composes into constructors and aggregates: binary
structure is preserved without fabricating the JSON-text subtype. Both forms use
existing copy/move/release rules. Parsing and
JSONB descent are charged through statement control, depth is capped at 1000, and
result bytes use the connection length limit. Host `JSON.parse/stringify` is not
used. Browser-safe `Uint8Array`, `BigInt`, and `TextEncoder/Decoder` replace C
buffers without changing the serialized bytes.

The coherent public tranche is `json`, `jsonb`, `json_valid`, `json_extract`, JSON
array/object aggregates, and bounded read-only table routes:
`json_each`, `json_tree`, `jsonb_each`, and `jsonb_tree` with one or two
ordinary scalar-expression arguments, visible expression projections and WHERE.
Their runtime statement-owned filter/next state is produced by internal/native
TypeScript table machinery and exposed through the ordinary Fetch statement API;
this is not host registration. `json_tree` recursively walks the ordered node tree
depth-first. The VDBE now owns an incremental current-row cursor: rewind validates
and retains one ordered parse image, while each next operation alone constructs
and charges the next row, so an unsorted LIMIT can halt without traversing or
materializing unconsumed descendants. Retained input, parsed nodes, current path,
and traversal depth debit the statement private-state budget and cursor close on
exhaustion, replacement rewind, reset, finalize, or error. For JSONB, decoder
metadata preserves original element bounds and object-label offsets (including
nonminimal headers); `id`/`parent` therefore use the input parse-image offsets and
`jsonb_*` container values slice the original representation rather than canonical
re-encoding. Text input continues to use its canonical internal JSONB offsets.
Parameters, reset, rooted scans, hidden `json`/`root` reads, and JSONB container
BLOB results have direct public evidence. Result metadata follows pinned
`select.c:sqlite3GenerateColumnNames`/`generateColumnTypes`: a resolved direct JSON
virtual column (qualified, unqualified, or COLLATE-wrapped) reports its underlying
column name and `main`/function/origin fields, unless an explicit alias wins;
computed results retain their exact source span and null origins. The visible fields
have null declared type, while hidden `json`/`root` retain SQLite's empty declared-
type string; physical-left direct fields keep their own declared/origin metadata.
Duplicate result
names remain positional. RIGHT/FULL mixed joins, reverse correlation, and advanced aggregate modifiers remain
atomic typed temporary unsupported. Scalar mutation/path consumers are described
below. Pinned-oracle evidence includes JSON5 canonical spellings, duplicate keys,
exact JSONB hex, nonminimal headers, malformed/truncated validation, NULL/BLOB and
subtype behavior; public Fetch tests add work/output/depth and statement cleanup.

### JSON scalar completion (2026-09-21, [[card:card-r-b]])

The scalar JSON registration and normal expression/VDBE path now translate pinned
`src/json.c` inspection (`json_type`, `json_array_length`, `json_error_position`),
construction (`json_quote`, `json_array`, `json_object`), mutation
(`json_insert`, `json_replace`, `json_set`, `json_remove`), RFC-7396 merge patch,
and `->`/`->>` lowering. These operate on the ordered private `JsonNode` tree,
copy on edit, preserve duplicate-key order and JSON subtype value arguments, and
charge parsing/result work through statement controls. `test/conformance/json-scalar-full.test.mjs`
exercises the public prepared-statement path. JSONB edit output also preserves
decoded source label encodings and follows `jsonLookupStep` when a path creates an
object member: unescaped labels use `JSONB_TEXTRAW`, while escaped quoted labels
retain `JSONB_TEXT5` payload spelling. This is a direct translation needed because
canonical tree re-encoding with `JSONB_TEXT` is observably byte-different; the
public suite pins constructor, set, patch, and array-insert bytes against 3.53.4.
Remaining conformance risk is broader exact error-position, quoted-path, numeric
boundary, and malformed-path corpus breadth; this is not a blanket compatibility
claim.

### JSON aggregate translation (2026-09-21, [[card:card-r-c]])

The four pinned 3.53.4 `WAGGREGATE` registrations (`json_group_array`,
`json_group_object`, and their `jsonb_` forms) now use the shared VDBE
`AggregateContext`/`Mem` owner.  `jsonArrayStep`, `jsonObjectStep`, their
value/final callbacks, and `jsonGroupInverse` are represented by ordered JSON-node
state: ordinary SQL text is quoted, subtype 74 text/JSONB is embedded, NULL and
64-bit numeric classes are retained, ordinary BLOB raises SQLite's diagnostic,
and object duplicates remain ordered.  Text results are canonical JSON; binary
results use the translated SQLite JSONB encoder.  Empty aggregates produce
`[]`/`{}` and JSONB `0B`/`0C`.

This is an ordinary browser-safe representation adaptation, not an algorithm
substitution: node arrays replace `JsonString` byte splicing while preserving
step order and removing exactly the oldest entry on inverse.  The reason is that
`Mem` and the existing JSON parser already own encoding-independent JSON nodes;
public source-based tests cover duplicate labels, subtype embedding, exact JSONB,
sliding windows, cleanup, and limits.  Retained bytes are charged to
`PrivateStateByteBudget`; final/reset/finalize use the common exactly-once cleanup
path. No host JSON parser/stringifier or native registration is used.

### JSON scalar review correction (2026-09-21, [[card:card-r-b]])

Pinned `src/json.c:jsonErrorFunc` character-position semantics now come from parser
failure state rather than a placeholder. JSONB construction/edit production rows
(`jsonb_array/object/insert/replace/set/remove/patch`) and both array-insert rows
use the shared ordered tree and SQLite JSONB encoder. The production registration
inventory also confirms `json_pretty` arities 1/2; those rows are registered but
atomically return typed temporary-unsupported until the pretty renderer is ported.

### JSON mutation control-flow correction (2026-09-21, [[card:card-r-b]])

The shared TEXT/JSONB mutation owner now follows pinned
`jsonInsertIntoBlob`/`jsonRemoveFunc`/`jsonLookupStep`: NULL paths skip complete
path/value pairs for set/insert/replace/array-insert without disturbing later
pairs; root removal returns SQL NULL and stops sequential removal; and `[#-N]`
resolves from array end (including `#-0` append, out-of-range no-op, and
array-insert-before distinctions). Malformed neighboring path syntax still errors.

#### Ordinary BLOB document compatibility (2026-09-21 correction)

The shared document parser now translates `json.c:jsonArgIsJsonb` and
`jsonParseFuncArg` tag-20240123-a: a BLOB recognized by the SQLite JSONB header,
size, and small ambiguous-prefix deep check remains JSONB; any other BLOB document
falls through to UTF-8 text conversion and JSON/JSON5 parsing. `json_valid` applies
text flags 1/2 only after that classification and JSONB flags 4/8 only to recognized
JSONB. This compatibility is limited to document arguments. Constructors and
aggregates still reject an ordinary BLOB value with `JSON cannot hold BLOB values`,
as `jsonFunctionArgToBlob`/`jsonAppendSqlValue` require.
## WHERE planning representation and staged admission contract (draft, 2026-09-21, [[card:card-s-a-a]])

This section is the mutable architecture gate for parent [[card:card-s-a]]. It
commits the shared representation before any runtime consumer, but implements no
planner or opcode. SQLite 3.53.4 is the pin. The owning source model is
`src/whereInt.h:WhereClause`/`WhereTerm`/`WhereLoop`/`WherePath`/`WhereLevel`;
term derivation is `src/whereexpr.c:exprAnalyze` (1121) and `sqlite3WhereSplit`
(1599); loop generation/dominance and path solving are
`src/where.c:whereLoopInsert` (2832), `whereLoopAddBtreeIndex` (3220),
`whereLoopAddBtree` (4004), and `wherePathSolver` (5835); ownership enters and
leaves through `sqlite3WhereBegin` (6829) and `sqlite3WhereEnd` (7520).

### Current-system finding and boundary

Current `src/internal/vdbe.ts` still opens every resolved table in source order,
emits nested `Rewind`/`Next`, and evaluates all ON/WHERE predicates in the inner
body (around 523-545). It has no shared WhereClause/Loop/Path/Level object and no
persistent-index seek/deferred-seek opcodes. This is a truthful scan compiler, not
a WHERE planner. Preserve its source-order and null-row controls as the fallback
and semantic reference while replacing loop choice at one owner. Also preserve:
`src/internal/btree.ts`'s page-local table/index seek translation,
`src/internal/comparison.ts`'s identity-bearing immutable `KeyInfo` and shared
Mem comparison, schema object identity, and VDBE reset/finalize cleanup.

The schema graph represents explicit simple and expression `IndexNode` terms and
a bounded primary-key autoindex. It atomically rejects partial indexes and other
ambiguous automatic indexes; WITHOUT ROWID tables are represented but their
implicit index layout is not admitted. No sqlite_stat data is loaded. Resolver
already validates `INDEXED BY` names and retains join source order/provenance, but
there is no plan-time parameter sensitivity or reprepare. These are integration
facts, not reasons to infer index capability.

### Shared TypeScript model

The first implementation should place an internal model in one planner module
(`where-plan.ts` is the proposed name). Names may change together, but the
following semantic fields and identities may not be split into caller-local
copies:

```ts
type SourceMask = bigint; // dense source-bit positions, never JS bitwise number

type TermOrigin =
  | { kind: "where" }
  | { kind: "join-on"; rightSource: number; join: "inner"|"left"|"right"|"full" }
  | { kind: "using"; rightSource: number; name: string }
  | { kind: "derived"; parentTerm: number; reason: "commuted"|"transitive"|"range" };

type WhereOperator = "eq"|"is"|"is-null"|"lt"|"le"|"gt"|"ge";
interface WhereTerm {
  readonly id: number; readonly expression: Expression; readonly origin: TermOrigin;
  readonly operator: WhereOperator|null; readonly left: ColumnBinding|null;
  readonly prereqRight: SourceMask; readonly prereqAll: SourceMask;
  readonly parentId: number|null; readonly childIds: readonly number[];
  readonly virtual: boolean; coded: boolean;
  readonly outerJoinSafe: { readonly mayDrive: boolean; readonly mayOmitResidual: boolean };
}
interface WhereClause { readonly split: "and"|"or"; readonly terms: readonly WhereTerm[];
  readonly outer: WhereClause|null; }

type LogicalEstimate = bigint; // SQLite LogEst units; no 32-bit coercion
interface PhysicalIndexField {
  readonly role: "declared"|"rowid-tail"; readonly column: ColumnNode|null;
  readonly collation: BuiltinCollation; readonly descending: boolean;
  readonly nullsLarge: boolean;
}
interface PhysicalRowidIndex {
  readonly index: IndexNode; readonly fields: readonly PhysicalIndexField[];
  readonly declaredFieldCount: number; readonly rowidField: number;
  readonly keyInfo: KeyInfo;
}
type SeekComparisonMode =
  | { readonly kind: "comparison"; readonly affinity: MemAffinity;
      readonly collation: BuiltinCollation } // validated effective term collation
  | { readonly kind: "is-null" }; // no RHS affinity or effective term collation
interface IndexConstraintAdmission {
  readonly term: WhereTerm; // exact clause-owned identity
  readonly physicalIndex: PhysicalRowidIndex;
  readonly fieldOrdinal: number;
  readonly field: PhysicalIndexField; // === physicalIndex.fields[fieldOrdinal]
  readonly keyInfoTerm: KeyInfo["terms"][number]; // exact term identity at fieldOrdinal
  readonly operator: WhereOperator; // canonical indexed-left operator
  readonly originalIndexedOperand: "left"|"right";
  readonly comparison: SeekComparisonMode;
  readonly bound: "equality"|"lower-inclusive"|"lower-exclusive"|
                  "upper-inclusive"|"upper-exclusive";
}
interface BtreeCapability {
  readonly index: IndexNode|null; readonly physicalIndex: PhysicalRowidIndex|null;
  readonly equalityPrefix: readonly IndexConstraintAdmission[];
  readonly lower: IndexConstraintAdmission|null;
  readonly upper: IndexConstraintAdmission|null; readonly constrainedFields: number;
  readonly orderTermsSatisfied: number; readonly reverse: boolean;
  readonly covering: boolean; readonly needsTableLookup: boolean;
}
interface WhereLoop { readonly source: ResolvedSource; readonly prereq: SourceMask;
  readonly capability: BtreeCapability|null; readonly kind: "table-scan"|"rowid"|"index";
  readonly setupCost: LogicalEstimate; readonly runCost: LogicalEstimate;
  readonly outputRows: LogicalEstimate; readonly terms: readonly WhereTerm[]; }
interface WherePath { readonly loops: readonly WhereLoop[]; readonly ready: SourceMask;
  readonly reverse: SourceMask; readonly rows: LogicalEstimate;
  readonly cost: LogicalEstimate; readonly unsortedCost: LogicalEstimate;
  readonly orderTermsSatisfied: number|null; }
interface WhereLevel { readonly loop: WhereLoop; readonly sourceOrdinal: number;
  readonly tableCursor: number; readonly indexCursor: number|null;
  readonly continueLabel: Label; readonly breakLabel: Label;
  readonly nullRowRegister: number|null; readonly deferredSeek: boolean; }
```

`Expression`, `ColumnBinding`, and `ResolvedSource` refer to resolved object
identity, not reparsed text. `BtreeCapability.index` is the exact frozen
`IndexNode` linked from its `TableNode`; `physicalIndex` and its `keyInfo` are the
one exact immutable descriptors built once from that physical index's complete
key layout and encoding.
Selection, unpack, compare, cursor open, and deferred table lookup must retain
those identities and reject structurally-equal substitution. A capability records
an equality prefix followed by at most one lower/upper range on the next key term;
no skipped leading column is implied. Each array/bound member is the immutable
admission result, not a bare term. Candidate construction creates it once after
all affinity/collation and physical-identity checks. The `WhereLoop` and selected
`WherePath` retain that same object unchanged, and lowering consumes it without
rerunning eligibility or deriving field association from array position.
`field`, `keyInfoTerm`, and `physicalIndex` use exact object identity; construction
asserts their ordinal correspondence. `operator` is the post-commutation,
indexed-left operator, while `originalIndexedOperand` preserves orientation for
audit/debugging and prevents original-order collation from being reconstructed.
`bound` is stored explicitly so DESC traversal affects cursor direction, not the
semantic lower/upper test. Equality includes `eq` and admitted `is`; `is-null`
has no RHS coercion and may only carry `bound: "equality"`. For ordinary
comparisons, `comparison.affinity` is the pinned comparison affinity—not merely
the index column affinity—and `comparison.collation` is the already validated
original-order term result. For `comparison.kind === "is-null"`, neither fact
exists: the exact `field` and `keyInfoTerm` still own packed-key ordering, but
candidate construction and lowering must not fabricate an effective term
collation from that physical metadata or apply RHS affinity. `WhereLoop.terms`
remains the residual/usage term set; it is not the lowering contract.
`orderTermsSatisfied`, direction, and
covering are independently derived facts—not consequences of “uses index”.
Covering must include every column needed by result, residual predicates, join,
ORDER/GROUP/DISTINCT, and lowering; otherwise `needsTableLookup` is true.

The W2 schema-to-physical-key owner is one `physicalRowidIndex(IndexNode,
DatabaseEncoding)` construction performed while the immutable schema graph is
published, not in candidate or opcode callers. It maps
`sqliteInt.h:Index.nKeyCol/nColumn/aiColumn/aSortOrder/azColl` and
`KeyInfo.nKeyField/nAllField` through `build.c:sqlite3KeyInfoOfIndex` (5653).
For the initially admitted ordinary rowid index, `IndexNode.terms` are exactly the
declared fields and one implicit final `rowid-tail` field is appended; therefore
`declaredFieldCount = IndexNode.terms.length`, `rowidField` is that count, and
`KeyInfo.totalFieldCount` is declared count plus one. The tail is the sole source
for `IdxRowid`/deferred table positioning and is also available as rowid for a
covering read; it is not a declared index column. Ordinary table columns are
covering only if an identity-matched declared field stores that column.

Each declared field copies its resolved built-in collation and DESC bit; the
descriptor carries the database encoding. The rowid tail is BINARY, ASC, and
`nullsLarge=false`. SQLite's index `KEYINFO_ORDER_BIGNULL` assertion means W2
admits no declared index NULLS-order flag; unknown collations, expressions, or
any metadata that does not determine these fields are gated before candidates.
For a non-UNIQUE index, or a UNIQUE index with any nullable declared key field,
`KeyInfo.keyFieldCount = totalFieldCount`, so the rowid tie-break is part of full
record ordering. This preserves SQLite UNIQUE semantics: NULL in a declared key
does not collapse distinct rows, and the appended rowid orders them. Only a
UNIQUE index whose every declared field is a simple `NOT NULL` column has
`keyFieldCount = declaredFieldCount`; its rowid remains an auxiliary packed field
(`nAllField`) but is excluded from key equality. Seek prefix/range admission is
still bounded by `declaredFieldCount`, never by the implicit tail.

W2 rejects the whole index descriptor before candidate generation if it cannot
prove exactly that rowid-table layout: non-rowid tables; physically ambiguous
terms; expression/partial/unknown automatic-index
terms; unsupported collation or index NULL-order metadata; a missing/unexpected
rowid suffix; or field/count/encoding disagreement. A forced ambiguous index is
temporary unsupported for the statement; an unforced one is unavailable while a
truthful scan remains eligible. The same `PhysicalRowidIndex` and `KeyInfo`
identities flow through selection, seek-key unpack/comparison, index cursor open,
termination, covering-column selection, rowid extraction, and deferred seek.


### Index-term affinity and collation eligibility

W2 does not treat a syntactically shaped comparison as a seek constraint until a
single planner helper proves it compatible with the next physical index field.
This ports the term scan in `src/where.c:whereScanInit`/`whereScanNext` (485-521
and the affinity/collation branch around 386-422), called by
`whereLoopAddBtreeIndex` at 3220 (term scan initialization around 3290), together
with `src/expr.c:sqlite3CompareAffinity` (342), `comparisonAffinity` (364),
`sqlite3IndexAffinityOk` (387), `sqlite3BinaryCompareCollSeq` (424), and
`sqlite3ExprCompareCollSeq` (452). It is part of candidate admission, before cost
or lowering, and returns either the `IndexConstraintAdmission` above or “not
usable for this index field”; it never weakens a residual predicate. Construction
is the sole owner of effective affinity, collation, orientation, field/KeyInfo
identity, and bound classification; later phases may validate invariants but may
not recompute or replace those facts.

The helper consumes the resolved `Expression` operands and exact
`PhysicalIndexField`/`KeyInfo` term. Term analysis first orients the indexed
column on the left and reverses `<`, `<=`, `>`, or `>=` when commuting. It retains
a `commuted` provenance bit corresponding to `EP_Commuted`: effective collation
is computed in original SQL operand order even after canonical orientation.
Derived/transitive terms undergo the same check independently; compatibility is
not inherited from their parent.

Affinity follows the pinned decision, not JavaScript value types. Resolve each
operand's expression affinity (column declaration, CAST, or no affinity), combine
it exactly as `sqlite3CompareAffinity`/`comparisonAffinity` do, then apply
`sqlite3IndexAffinityOk`: no-affinity/BLOB-class comparisons are eligible;
TEXT comparison affinity is eligible only for a TEXT-affinity index field; and a
numeric comparison affinity is eligible only for an INTEGER, REAL, or NUMERIC
field. The field affinity comes from the identity-matched resolved `ColumnNode`,
not from a bound value or `KeyInfo` collation term. `IS NULL` follows
`whereScanNext` and bypasses the ordinary affinity/collation compatibility test;
planner-IN remains gated, so `indexInAffinityOk` is mapped but not admitted in W2.

Collation then follows `sqlite3BinaryCompareCollSeq`: explicit COLLATE on the
original left operand wins, then explicit COLLATE on the original right, then the
left operand's resolved/default collation, then the right's, finally BINARY.
The resulting resolved built-in collation must equal the candidate field's exact
`KeyInfo` collation (SQLite name comparison is case-insensitive). DESC and NULL
sort metadata remain separate `KeyInfo` facts; they do not repair a collation or
affinity mismatch. Unknown/unregistered collations, lost explicit-collation
provenance, an unresolved operand affinity, ambiguous column identity, or a
mismatch excludes that term from the equality/range prefix. No later residual
check can make an unsafe seek complete because a seek may already have omitted
rows. If `INDEXED BY` cannot be honored by an admitted full index scan plus
residuals, or depends on such an unproved seek decision, preparation rejects the
whole statement as temporary unsupported before cursor/program publication;
unforced planning simply omits that term/candidate and retains a truthful scan.

The TypeScript owner must reuse, then consolidate rather than fork, current
`src/internal/vdbe.ts:expressionAffinity`, `expressionCollation`,
`explicitCollation`, and `binaryCollation`; resolved column affinity/collation
comes from `resolve.ts`/`schema.ts`. For `comparison` mode the seek-key lowerer applies the decision's affinity
through `Mem.applyAffinity` exactly as the current comparison opcodes do; for
`is-null` mode it constructs the NULL key without RHS coercion or term-collation
selection. Packed-key comparison in both modes uses the same identity-bearing
`KeyInfo` and `compareMem`, so physical field collation remains available without
being mislabeled as effective term collation. Residual evaluation uses those same
owners. This prevents a new
planner evaluator or host coercion from diverging from execution.

High-risk behavior is therefore explicit. Against a numeric index, numeric-looking
TEXT is converted by numeric affinity while non-numeric TEXT remains TEXT; BLOB
is not parsed or textified by numeric affinity and remains BLOB for storage-class
ordering. Against a TEXT index, an INTEGER or REAL operand is text-affinitized
before seek and residual comparison. INTEGER and REAL retain the shared numeric
comparison rules, including exact integer/real boundaries. Ordinary `=`, `IS`,
and ranges involving NULL retain the existing NULL truth/ordering behavior;
`IS NULL` may seek the NULL key, while `= NULL`/ordered comparisons cannot be
invented as matches. Collation applies only to TEXT; BLOB byte order and NULL
ordering come from shared `compareMem`/record comparison. Tests must pair each
selected seek with the residual result for numeric-looking/non-numeric TEXT,
INTEGER/REAL boundary values, BLOB, and NULL, plus explicit/default BINARY,
NOCASE, and RTRIM cases in both operand orientations and supported database
encodings.

`SourceMask` uses `bigint` dense bits mapped once from resolver cursor identities.
This is the ordinary TS representation adaptation of `WhereMaskSet`/SQLite's
64-bit `Bitmask`, not an algorithm substitution. Admission still enforces the
product/parser source-count limit; no `number` bitwise operator may truncate it.
`LogicalEstimate` also uses `bigint` for exact logical `LogEst` units and stat
counts. Arithmetic ports upstream saturation/comparison intentionally; it never
uses floating host cost as an accidental tie-breaker. Deterministic ties preserve
the upstream loop insertion/path iteration ordering. Arrays replace linked lists
and labels replace C instruction addresses; these are ordinary allocation/codegen
adaptations. No exceptional planner algorithm substitution is proposed.

`WhereClause` owns terms and derived-term parent/child disable relationships.
Candidate loops borrow terms and schema/KeyInfo identities. A selected `WherePath`
owns its immutable loop sequence. Lowering alone allocates mutable `WhereLevel`
state and marks terms coded; reset/finalize owns cursor, register, IN/private-state,
and borrow cleanup. Thus candidates never own cursors, and statement execution
never mutates the selected path.

### Provenance, outer joins, and prerequisites

Port `exprAnalyze` prerequisite calculation branch-for-branch, including
`EP_OuterON`/`EP_InnerON` behavior around `whereexpr.c:1187-1197` and derived-term
flag propagation around 506-507. A term from ON/USING is tagged with the exact
right-hand join boundary before splitting. `prereqRight` means sources needed to
evaluate the RHS; `prereqAll` includes all references plus source-order barriers.
A loop is eligible only when `(prereq & ~ready) == 0n`. A derived/commuted term may
constrain a seek only where its origin allows it, and `mayOmitResidual` is false
until source rules prove the original term coded. WHERE terms must not be moved
inside an outer join in a way that rejects its synthetic NULL row; ON terms must
not be delayed so that unmatched-row detection changes. Existing join null-row
register/control remains the lowerer's owner, represented by `WhereLevel` rather
than hidden in predicate compilation.

### Statistics, costs, and staged admission

Stage W0 (representation) admits no changed SQL behavior. Stage W1 admits table
scan and INTEGER PRIMARY KEY equality/range loops using existing table seek; this
establishes term/prerequisite/path/level lowering while preserving residual tests.
Stage W2 admits explicit ordinary rowid-table indexes: complete leading equality
prefix, optional next-field range, forward/reverse order contribution, covering
reads, and deferred table seek. It ports loop proposal/dominance and bounded
N-best path expansion rather than selecting an index ad hoc. Stage W3 may load
supported sqlite_stat1 values and refine costs; STAT4 samples stay gated until the
`analyze.c` sample decode/probe path and matching KeyInfo comparisons are ported.
IN-loop, OR/multi-index, skip-scan, automatic-index construction, and expression
or partial-index implication each require their own later source/test tranche.


W1/W2 have a statement-wide RIGHT/FULL admission boundary. Before term creation,
candidate generation, cursor allocation, or partial planner lowering, any SELECT
statement containing a RIGHT or FULL join is dispatched unchanged to the current
source-order compiler; no SELECT core or nested part of that statement uses the
new path solver. This is a supported fallback, not a rejection and not a claim
that generic provenance models right-join execution. The current compiler remains
the owner of matched-rowid tracking, physical-left NULL rows, unmatched-right
second pass, ON-versus-WHERE placement, and reset/error cleanup. Planner admission
requires a separate later tranche mapping `whereInt.h:WhereRightJoin` and
`WhereLevel.pRJ`, `where.c`'s `bFirstPastRJ` barriers and setup/end branches around
7393-7422/7540-7550/7726-7731, and `wherecode.c` matched-set and
`sqlite3WhereRightJoinLoop` branches around 2740-2946. Until then,
`nullRowRegister` covers admitted LEFT-join lowering only and an N-best path can
never reorder a RIGHT/FULL query.

Absent statistics use pinned default LogEst estimates from the same
`whereLoopAddBtree*` branches; never infer cardinality by eagerly decoding the
whole tree. Stat fields are logical non-32-bit values, validated atomically before
schema/planner publication. Pinned owners for later loading are
`src/analyze.c:decodeIntArray`, `analysisLoader`, and `sqlite3AnalysisLoad`; corrupt
catalog/stat state is SQLite corruption, while a configured work ceiling is
`limit` and an unrepresented valid stat format is temporary unsupported.

Admission is atomic before candidate generation/lowering:

* any participating WITHOUT ROWID table/index is temporary unsupported until its
  physical primary-key/suffix layout and seek/column lowering are represented;
* partial indexes are already rejected by schema construction and remain so until
  predicate implication is translated; expression indexes may remain in the
  schema graph but cannot form a loop until expression identity, affinity and
  collation matching are source-derived;
* an index with unknown autoindex terms, unsupported collation/KeyInfo layout, or
  unrepresented sqlite_stat payload is rejected rather than ignored when forced
  by `INDEXED BY`; an unforced unusable index is excluded without affecting a
  truthful table-scan plan;
* `IN` terms are not downgraded into equality. Any query whose correctness or
  forced access depends on planner IN-loop state is rejected as one prepare-time
  unit until `codeEqualityTerm`/`WhereLevel.u.in` lowering exists. Existing
  independently implemented expression-IN routes remain separate and cannot be
  mislabeled index planning.

Unsupported gates run before opening cursors or emitting a partial program. This
keeps malformed/corrupt distinct from valid-but-temporary unsupported and prevents
fallback from violating `INDEXED BY`/`NOT INDEXED` promises.

This preserved earlier fallback check excludes unsupported index candidates by ordinal in `planWhere`, not by cloning a resolved source. The latter broke column-use/source identity (`invalid source ordinal` at prepare). Its all-encoding unhinted-versus-`NOT INDEXED` test checks fresh/partial-step/reset NULL rebind, typed rows, zero selected seeks and scan movement **for that historical unsupported path**. Subsequent selected per-slot IN lowering supersedes the general scan-only claim; see the later multi-slot revision and source map.

The joined reverse `ORDER BY y.b DESC` review neighbor retains its sorter deliberately: `wherePathSolver` does not prove ORDER for multi-source paths, so local reversible index order is not a global ORDER proof. All-encoding fresh/reset tests check correct typed rows, selected movement, and retained sorter; physical reverse traversal and future joined ORDER-proof work remain unclaimed (source map and audit).

Historical joined selected equality-prefix `IN` admission gate (superseded by the selected per-slot lowering below): pinned `src/wherecode.c:codeINTerm/sqlite3WhereCodeOneLoopStart` requires per-value index restarts. At that checkpoint the joined lowerer could not emit them, so forced selection rejected at prepare and unforced selection replanned without the index. Those scan/reset and parameter/NULL-rebind tests established safe fallback, **not** permanent selected-IN exclusion. Current joined selected execution is covered by the later single-/multi-slot revisions, including forced physical seeks and LEFT null-row tests in `in-range-selected-red.test.mjs`; vector/unsupported RHS shapes are not thereby admitted.

The joined residual `IN` operand is resolved through the same source-aware recursion as other expressions: pinned `src/resolve.c:resolveExprStep` resolves operands in their owning NameContext before `src/expr.c:sqlite3ExprCodeIN` evaluates the left value. The all-encoding forced-index and scan joined `y.b IN (1,3)` fresh/reset regression now returns the typed rows rather than reading `x.b` at cursor zero; this does not prove joined selected IN-prefix restart or exact counters (see source map and mutable audit).

### Lowering and lifecycle contract

Lower selected levels using the control branches in
`src/wherecode.c:codeEqualityTerm` (803) and `sqlite3WhereCodeOneLoopStart`
(1466), with matching
`sqlite3WhereEnd` tails. Required branches are: table scan `Rewind/Next`;
rowid exact/range `SeekGE/SeekGT/SeekLE/SeekLT` plus bound checks; index prefix/range
seek and `Idx*` termination; reverse traversal; covering `Column` from the index;
and non-covering index rowid extraction followed by `DeferredSeek`/table column
materialization. VDBE seek comparison must consume the shared Mem/KeyInfo path,
and B-tree movement must call the existing page-local translations of
`btree.c:sqlite3BtreeTableMoveto` (5805) and `sqlite3BtreeIndexMoveto` (6036).
Residual terms are coded only after the required cursors are positioned; errors
preserve opcode ordering and no failure becomes an empty result.

A prepared statement owns its selected path/program. Bind values are Mem cells
copied at execution as today. Reset retains bindings, clears registers/cursors and
all mutable `WhereLevel` execution state, and restarts the same valid plan.
SQLite's parameter-sensitive LIKE/STAT4 planning and schema-change reprepare are
not silently approximated: until an explicit plan-sensitivity descriptor and
reprepare owner are implemented, such shapes are atomically temporary
unsupported (or use a parameter-independent admitted scan), never replanned during
`step()`. Immutable main storage means ordinary reset needs no schema cookie
reprepare; adding mutable schemas is outside this decision. Finalize releases plan
references only after VM cleanup. Public API and registration do not change, so
`docs/api.md` is intentionally unchanged.

### Audit reconciliation and validation plan

The mutable fidelity audit was checked against current code rather than copied.
Finding 3 is closed by current path-local B-tree seeks and is a planner foundation,
not planner completion. Findings 6 and 8 are closed in shared comparison/boolean
and numeric-conversion owners; planner term admission must use those owners rather
than reimplement coercion. Finding 9 is closed in shared NOCASE comparison and is
inherited through `KeyInfo`. Finding 10's ORDER/DISTINCT lowering is current and
multi-term, but scans still do not report index-provided order/distinctness; the
new `orderTermsSatisfied`/covering contract must feed the existing sorter and
DISTINCT decisions only after complete-path proof. No finding is reopened or used
as a compatibility claim.

Consumer implementation requires tests-first: exact typed public comparisons to
the pinned oracle for INTEGER/REAL/NULL/TEXT/BLOB keys; equality/range boundary
and composite-prefix neighbors; collation, DESC and NULL order; covering versus
deferred seek; outer-join ON versus WHERE placement and empty/null rows; join
prerequisites/path order; ORDER/DISTINCT sorter elision; reset/rebind/error cleanup;
and every atomic gate above. Add path-local corruption tests showing unrelated
subtrees remain untouched.

#### Executable persistent-index planner boundary ([[card:card-s-a-b]])

`test/conformance/cases/stage3-index-planner.spec.json` and its pinned capture now
make W1/W2 a tests-first, zero-credit executable contract. The 512-byte-page immutable
fixture is created only by manifest-pinned SQLite 3.53.4, reopened read-only for
capture, and records exact schema root pages plus `index_xinfo`, including the
`sqlite_autoindex_t_1` identity for `UNIQUE(tag)`. Thirteen native cases cover
rowid and explicit/implicit persistent-index equality/range, composite prefixes,
NOCASE/NULL/DESC, satisfied and unsatisfied ordering, covering versus
`DeferredSeek`, reset/rebind expectations, REAL class, residual predicates, and
LEFT JOIN ON/WHERE provenance. The source-derived anchor `test/index3.test` cases
`index3-2.1`/`index3-2.2` is retained alongside `whereLoopAddBtreeIndex`,
`codeEqualityTerm`, and `sqlite3WhereCodeOneLoopStart`.

Native `EXPLAIN QUERY PLAN`, selected VDBE cursor opcodes, and `sqlite3_stmt_status`
are capture evidence only. The TS contract requires per-execution private counters
starting at zero for candidates, paths, index/table seeks and movement, residual
tests, and sorter rows; elapsed time is never a counter. Machine accounting keeps
all 13 attempted public assertions at zero TS credit and separately records five
unattempted atomic gates: WITHOUT ROWID, partial indexes, expression indexes,
sqlite_stat-driven choice, and index-backed IN. No wrong partial plan may prepare.
The capture/validator and one public attempted assertion add no runtime planner,
public API, or extension-registration change.
. Program-shape tests must prove the selected lowering,
while oracle results prove behavior; neither alone is compatibility evidence.
The fallback boundary also requires matched and unmatched RIGHT and FULL cases,
ON-versus-WHERE filtering, nested joins/subqueries, and reset/error cleanup to
prove dispatch leaves the current source-order machinery unchanged; these are
fallback regressions, not planner-credit tests.

### Revision 2026-09-22 — aggregate scalar composition and joined correlated EXISTS

Two later composition gaps were in the VDBE splice, not in SQL parsing or host-side
fallbacks. For a no-FROM parent, an aggregate scalar child is now compiled through
`compileAggregateSelect` and its complete child register/cursor ownership is
relocated before its `ResultRow` destination is replaced. This follows
`expr.c:sqlite3CodeSubselect`/`SRT_Mem`: each child has a disjoint destination,
NULL initialization and first-row transfer while sharing the parent VM lifecycle.
The admitted child-opcode audit covers the register operands emitted by scalar and
aggregate plans (`AggStep` arguments/accumulator, `AggFinal`, `AggValue`,
`AggInverse`, scalar sources/destinations, comparisons, functions, result and
index keys) and table read positioning (`OpenRead`, `Rewind`, `Next`, `Column`,
`Rowid`, `NullRow`). Aggregate plans needing other cursor families remain behind
the existing shape gates rather than receiving partial relocation.

For an aggregate outer consumer, a correlated `EXISTS` with a two-table equality
join now follows the parent-Parse ownership of `sqlite3CodeSubselect` and the
bounded probe shape selected by pinned `where.c`. The inner join-key and qualifying
correlation-key ephemeral indexes are materialized under `Once` only because they
are independent of the outer row; the outer correlation probe is after that guard
and reruns for every aggregate input row. This set-probe optimization is limited
to SQL `=`/`==`: NULL-safe `IS` remains on the generic correlated loop so an
outer NULL can match an inner NULL. This avoids the incorrect Cartesian
work profile without widening the admitted join shape. Tests cover all database
encodings, independent/correlated destinations, metadata, reset, work limits,
first-error cleanup and restored operation admission, including the `IS NULL`
discriminator.

### Ordinary WITH B3 bounded materialization route (2026-09-22)

A grouped, ordered, limited CTE producer consumed as source 0 of a two-source
ordinary join now uses a bounded materialization route after lexical CTE lowering.
The existing aggregate compiler produces typed rows into a VDBE sorter; the same
program opens the ordinary schema table, evaluates the represented join predicate
and result expressions, and applies the single supported outer `ORDER BY` term.
No nested statement or host-row evaluator is introduced, and existing work,
private-state, cancellation, reset, and connection lifecycle controls remain the
owners. `test/conformance/cte-chinook-lead.test.mjs` proves exact public metadata
and typed rows through Fetch in UTF-8, UTF-16LE, and UTF-16BE on the asserted
Chinook digest, followed by connection reuse. The separately obtained Python
SQLite 3.45.1 result is comparison evidence, not pinned-native 3.53.4 credit.
Represented derived/CTE graphs outside translated consumers still reject with a
typed temporary error before retained lexical names can leak into schema lookup.

### `BETWEEN` and exact result spans (2026-09-22 revision)

Generated `expr ::= expr between_op expr AND expr` reductions now produce a
structured expression; no token parser or range evaluator is used. Lowering follows
pinned `src/expr.c:exprCodeBetween`: evaluate the lhs into one register, compare
`lhs>=lower` then `lhs<=upper` with the shared affinity and CollSeq owners, combine
with SQL three-valued AND, and apply NOT afterward. Projection follows
`sqlite3ExprCodeTarget` operand order (the upper operand is evaluated even after a
false lower result); predicate control may jump on a decisive false lower result.
A structural test verifies one Function and reuse of its destination register by
both comparisons without exposing a host-function API. The development-only C
probe remains the independent native one-call oracle and earns no TS credit.

Unaliased computed output names retain the exact UTF-8 byte slice from the original
SQL through generated reductions. AS remains authoritative, while resolved direct
columns retain the column name rather than a qualified source slice, matching
`select.c:sqlite3GenerateColumnNames`. The 22-case audit compares 56 public
executions (Chinook plus UTF-8/UTF-16LE/UTF-16BE synthetic fixtures), including
comments, Unicode, whitespace, repeated prepare, reset, error phase/code/message/
identity and finalize handling. SQL input is still a JavaScript string adapted to
UTF-8 bytes; alternate SQL input encodings are not proved.

#### Encoding, affinity, and private-counter completion ([[card:card-s-a-b]])

The executable W1/W2 boundary now builds three separate databases with pinned
SQLite 3.53.4 after setting `PRAGMA encoding` before schema creation: UTF-8,
UTF-16le, and UTF-16be. Each is reopened read-only and independently records its
encoding, SHA-256, bytes, 512-byte page size, schema roots, and complete
`index_xinfo`; recapture compares all physical bytes and typed observations. The
23-case matrix runs in every encoding (69 pinned captures/public attempts), adding
neighboring INTEGER/REAL/TEXT affinity probes for numeric-looking and non-numeric
TEXT, BLOB, numeric-to-TEXT, NULL, commuted operands, explicit RHS NOCASE, and a
BINARY mismatch fallback. Rows, storage classes, EQP access shape, and encoding
invariance are machine checked at zero TS credit.

Every case now carries private `exact` or bounded `min`/`max` expectations for
all eight declared counters: planner candidates/paths, index seeks/movement,
table seeks/movement, residual tests, and sorter rows, plus a mandatory fresh-zero
start for every binding run. Bounds describe semantic fixture cardinality rather
than native statement-status counts. They require non-vacuous seek and movement
for rowid/index equality, range, composite-prefix, ordering, covering, deferred,
and reset/rebind claims; exact zero forbids the opposite cursor or sorter where
that work is not allowed. Full index/table fallback cases instead require bounded
movement without a seek. These expectations make covering access require zero
table work, deferred access require table seeks, proved order require zero sorter
rows, fallback sorting require nonzero sorter rows, residual cases require
residual activity, and reset/rebind prohibit carried work. The validator requires
every field and independently rejects vacuous access-claim expectations. Native
stmt-status remains corroborating capture evidence, not a substitute for future
TypeScript private counters. Credit remains zero until both public rows and these
private invariants pass; no public API is added.

Later shared integrations `o53a127`, `m18e3a345`, `n5e1df973`, `a3268c13`, and
`b50b2a59` are regression requirements only and confer no index-planner credit.

### W1/W2 immutable planner foundation implementation (2026-09-22, [[card:card-s-b-a-a-a-a]])

`src/internal/where-plan.ts` now owns the shared immutable term/admission/loop/path
contract and `schema.ts:physicalRowidIndex` constructs the sole ordinary rowid
index descriptor and `KeyInfo` while publishing the schema graph. Candidate
admission retains exact term, physical descriptor, field, and KeyInfo-term
identities (including cached admission identity), original operand orientation,
comparison affinity/collation or the distinct IS-NULL mode, and semantic bound.
The bounded `whereLoopAddBtree` translation admits complete leading equality
prefixes plus lower/upper bounds on only the next field, derives direction/order
and covering independently, excludes an unforced unproved layout while retaining
the truthful scan, and rejects a forced unproved/unusable layout before a path is
published. The bigint prerequisite solver keeps one deterministic best path per
ready mask using no-stat LogEst-shaped costs.

This is deliberately the W1/W2 production foundation, not W3 lowering credit.
`vdbe.ts` remains the unchanged source-order scan compiler, so RIGHT/FULL bypass
this model and retain their existing fallback. No seek/deferred-seek opcode or
private index-work counter is claimed, and the executable 69-attempt artifact
therefore remains 0 credited pending the separate lowering owner. The TypeScript
module uses immutable objects, bigint masks/estimates, and a WeakMap admission
identity cache as browser-safe representations of the pinned structs and linked
candidate ownership; it does not substitute an algorithm or evaluate SQL.
Focused source-shaped tests cover descriptor/admission identity, composite
prefix/range, commuted orientation, collation/affinity exclusion, IS NULL,
ASC/DESC reverse contribution, covering, forced/unforced gates, bigint
prerequisites, and deterministic path selection.

### W1/W2 correction: production analysis, rowid loops, and N-best solver (2026-09-22)

The foundation now includes a production `analyzeWhere(ResolvedSelect)` owner for
the admitted `sqlite3WhereSplit`/`exprAnalyze` subset. It splits AND terms from
WHERE and ON reductions, uses resolver-owned column identities, canonically
commutes indexed RHS operands while preserving original orientation and
original-order collation, computes bigint prerequisite masks, and records LEFT ON
provenance/residual safety. Any RIGHT/FULL source returns a statement-wide
`right-full` fallback before terms or candidates are published.

`btreeLoops` now proposes INTEGER PRIMARY KEY/rowid equality and range loops,
honors NOT INDEXED, allows a forced supported index's full scan, atomically rejects
forced unsupported/conflicting layouts, and omits unconstrained unforced indexes
unless they prove requested order. Covering includes the caller's complete needed
column identity set, so missing projection/residual/order needs retain deferred
table lookup.

The earlier one-state-per-ready-mask solver has been replaced, not retained as an
exception. The admitted translation ports `sqlite3LogEstAdd` exactly in bigint
units and keeps bounded N-best paths at each depth, applying ready-mask,
cost/rows/order dominance before deterministic truncation, following
`whereLoopInsert` and `wherePathSolver`. Statistics, OR/IN, skip-scan, automatic
indexes, and opcode lowering remain outside this tranche; the fixed no-stat loop
estimates are intentionally the documented admitted input to the translated path
algorithm. Focused tests exercise production parsing/resolution, rowid and
composite neighbors, typed literals and NULL admission, order/reverse,
covering/deferred facts, forced/NOT INDEXED gates, LEFT prerequisites, N-best
LogEst selection, and unchanged RIGHT/FULL dispatch. This remains no public
69-attempt execution credit.

### W1/W2 review correction: barriers, choice widths, ordering, and layout preflight (2026-09-22)

The immutable handoff now carries a source-level prerequisite mask on every scan,
rowid, and explicit-index loop. `planWhere` derives a conservative LEFT boundary
from source order: the RHS and subsequent sources cannot become ready before all
sources to the left of the applicable LEFT boundary. Term-derived prerequisites
are unioned with that barrier for both operand orientations and for WHERE- and
ON-driven candidates. RIGHT/FULL continues to return the unchanged statement-wide
fallback before W1/W2 publication.

The admitted `wherePathSolver` width policy now follows pinned `where.c`: 1 path
for one source, 5 for two, and 12 for three or more (the star-query 18-path
extension is outside this admitted subset). Its same-ready-mask cost/row/order
dominance and deterministic bounded insertion are tested with competing,
equal/dominated, truncated, and prerequisite-delayed candidates.

Ordering now accounts for requested leading fields fixed by equality before
matching the remaining physical fields and scan direction. Required coverage is
`NeededColumn`, which explicitly distinguishes `ROWID_NEEDED` from declared
column identity; the immutable physical rowid tail can therefore prove an
INTEGER PRIMARY KEY/rowid-only read covering. `planWhere` also preflights all
participating tables and atomically rejects WITHOUT ROWID before analysis or
candidate publication because its primary-key/suffix layout and lowering are not
yet represented.

Production tests connect each UTF-8, UTF-16LE, and UTF-16BE schema descriptor to
resolved analysis, exact admission identity, candidate capability, and selected
path. They distinguish numeric-looking/nonnumeric TEXT and NOCASE orientation,
INTEGER/REAL boundary-neighbor literals, BLOB, ordinary `= NULL` and `IS NULL`,
composite prefix/order direction, and rowid-tail coverage. These are planning
contract tests only; no storage execution or public 69-attempt credit is claimed.

### W1/W2 renewed-review correction: outer-ON admission and virtual commutation (2026-09-22)

Production analysis now translates the applicable `whereexpr.c:exprAnalyze`
`EP_OuterON`/`extraRight` rule. A LEFT-ON term whose indexed operand belongs to a
source before the join RHS is retained as a residual but has `mayDrive=false`, so
it cannot enter that preserved source's rowid or explicit-index capability.
Equivalent WHERE terms remain eligible, and right-side LEFT-ON constraints remain
eligible with the preserved source in their prerequisite mask.

When both comparison operands are indexable columns, analysis now publishes the
source-derived virtual commuted child. The parent owns the child's exact id and
the child owns the exact parent id; the child has `derived/commuted` provenance,
canonical reversed range operator, original-expression collation, independent
RHS prerequisite mask, and independently evaluated outer safety. Thus either SQL
operand spelling exposes the same safe nullable/RHS physical field admission,
while the original preserved-side LEFT-ON orientation cannot drive.

For the admitted flat join subset, source-order prerequisites now implement the
verified three-source rule: once a LEFT boundary is encountered, its nullable RHS
and all later INNER/CROSS sources retain the complete prefix through that nullable
RHS; an explicit CROSS boundary similarly retains its complete left prefix.
Term prerequisites are unioned with these barriers. Production three-source tests
cover `a LEFT JOIN b JOIN c ON b.k=c.k` and `a LEFT JOIN b CROSS JOIN c`, proving
that `c` cannot cross `b` and that the nullable-side commuted term requires `b`.
Nested/unrepresented RIGHT/FULL shapes remain on statement-wide fallback.

### W1/W2 immutable-review correction: affinity, alternatives, and global order (2026-09-22)

Admission now follows pinned `expr.c:sqlite3CompareAffinity` and
`sqlite3IndexAffinityOk`: literal runtime storage class is not expression
affinity. A column compared with a literal uses the column affinity; two
column-affinity operands use NUMERIC if either is numeric and otherwise no
(BLOB) comparison affinity. No-affinity comparisons are index-compatible,
TEXT comparison affinity requires a TEXT index, and NUMERIC comparison affinity
requires a numeric index. Collation remains an independent exact gate. Tests run
positive and negative cases in both orientations through each UTF encoding and
retain exact selected admission/descriptor identity; this is planning metadata,
not encoded-key execution evidence.

`btreeLoops` now proposes every admitted equality alternative at each complete
leading-prefix position and every applicable lower/upper pair on the next field.
As in pinned `where.c:whereLoopAddBtreeIndex` (saved `nEq`/`nBtm`/`nTop`
restored for each scanned term), the range alternatives on a field remain
available even when that same field also has equality/IN alternatives; the
prefix recursion must not return before visiting those competing terms.
`where-plan-analysis.test.mjs` checks an IN-first-slot + two-ended second-slot
candidate alongside a two-ended first-slot candidate in all three encodings.
This is candidate admission, not proof of selected-index cursor access.
Rowid equality and range alternatives follow the same rule. Each loop retains its
own exact admissions and prerequisite union; deterministic dependency-first
proposal order and normal path dominance replace prior first-term selection.
Constant and column RHS alternatives, forced indexes, LEFT barriers, and reversed
WHERE text order are covered by production tests.

Until the applicable multi-source `wherePathSatisfiesOrder` state machine is
translated completely, `WherePath.orderTermsSatisfied` is conservatively zero
for every multi-source path. Per-loop capability order remains a local physical
fact only and cannot authorize global sorter elision. Single-source equality-
fixed and reverse order facts remain published. Tests prove the inner-restart
negative, mixed-source/reverse negative, and single-source positive; dominance
therefore never favors a local inner-loop order as global order.

### W1/W2 selected-path lowering (2026-09-23)

Production `compileTableSelect` now consumes the immutable `planWhere` selection
rather than repeating affinity, collation, constraint-admission, physical-index,
`KeyInfo`, or ordering decisions. The admitted translation of pinned
`where.c:sqlite3WhereBegin/sqlite3WhereEnd`,
`wherecode.c:codeEqualityTerm/sqlite3WhereCodeOneLoopStart`, and VDBE B-tree
operations lowers rowid equality/ranges and persistent explicit/implicit rowid
indexes, including composite equality prefixes, a following range, reverse
movement, covering reads, and deferred table lookup. Residual tests are emitted
after required cursor positioning. Every multi-source path publishes zero global
ordering until the complete pinned `wherePathSatisfiesOrder` state machine is
translated; lowering therefore retains the sorter even when a narrower local
argument might establish order for one shape.

This is a direct page-local B-tree/Mem/KeyInfo translation; no host/native/eval
substitution or runtime auto-index construction is used. Each binding execution
has exactly eight production-private physical-work counters, freshly zeroed and
cleared with mutable cursor/key state on reset; they are intentionally absent
from the public API. The pinned public matrix now credits 23 cases in each of
UTF-8, UTF-16LE, and UTF-16BE (69 executions), including exact/min/max private
invariants. The REAL-affinity positive case expects no table seek because pinned
EQP and VDBE use covering `ix_c` (`IdxRowid` and index `Column`, with no table
cursor), matching the selected covering identity.

## Advanced-index native contract (tests-first historical checkpoint; runtime status below)

`test/conformance/cases/stage3-advanced-index.spec.json` and its pinned capture add 30 native assertions (10 cases across UTF-8/UTF-16LE/UTF-16BE). They cover WITHOUT ROWID composite primary lookup/prefix scans and secondary records whose physical suffix is the composite primary key; partial-index implication and its non-implying neighbor; expression-index structural identity and a function-shape mismatch; index-backed IN; and composite equality/range plus multiple-range neighbors. Typed captures preserve INTEGER/REAL/TEXT/NULL distinctions, exact row order, EQP-selected identity, schema roots, `index_xinfo` fields, fixture bytes and SHA-256.

At the tests-first checkpoint this tranche was native-only (TS 0/0); the current bounded public credit is 24/30 including two selected partial/expression cases in three encodings. This is not an algorithm substitution. Pinned owners are `where.c:whereLoopAddBtreeIndex/whereUsablePartialIndex/wherePathSolver`, `whereexpr.c:exprAnalyze`, `wherecode.c:sqlite3WhereCodeOneLoopStart/codeEqualityTerm`, `expr.c:sqlite3ExprCompare/sqlite3ExprImpliesExpr`, `build.c:convertToWithoutRowidTable/sqlite3CreateIndex`, `btree.c:sqlite3BtreeIndexMoveto/sqlite3BtreeTableMoveto`, and `analyze.c:sqlite3AnalysisLoad`; assertion provenance is `without_rowid1.test`, `index6.test`, `indexexpr1.test`, and `in4.test`. Every success case also has machine-required `provenanceRationale` fields separating inherited upstream behavior from facts established by the local native capture. In particular, the composite and multiple-range cases do not claim `in4-3.21/.22` as direct provenance: exact hashed `wherecode.c` Case 4 and `where.c:whereLoopAddBtreeIndex` ranges own equality-prefix/first-range admission and later residual behavior. The validator requires composite-range category, both planner/lowering owners, range branch markers, and source-range provenance for those cases; adjacent tests are labeled neighbors only. `futurePrivateExpected` separately freezes the unattempted/uncredited TS selected-access contract for every case: selected root, cursor roles, covering/deferred/base mode, and per-case exact/min/max planner, seek, movement, lookup, residual, sorter, and IN-probe counters. Every private counter is re-audited against SQL and fixture cardinality using the ordinary-counter convention: seek counts positioning, Next counts successful row-to-row movement with at most one terminal boundary probe, residual counts visited candidates rather than emitted rows, and sorter rows count sorter insertions. Validator semantics require non-IN cases to have zero `inProbes`, actual IN cases to equal distinct RHS probes (two here) and matching index seeks, base scans to traverse/test the full table cardinality, deferred lookups to match emitted rows, covering paths to avoid table access, and EQP sorter cases to admit at least every emitted row.

The spec and captures also execute statement reset/clear/rebind/finalize, a prepare error and two configured resource-limit branches (`SQLITE_LIMIT_LENGTH` at bind phase, with prepare success and no step, and index-backed-IN `SQLITE_LIMIT_VARIABLE_NUMBER` at prepare phase) with first-code/connection-reuse evidence, and statement-status bounded-work counters. Two non-duplicative selected physical-page companions are pinned in each encoding: a malformed `wr_c` b-tree root exercises `moveToRoot`/`getAndInitPage`, while a malformed `ov_k_payload` overflow-chain page reached while materializing an indexed 1200-byte payload exercises `accessPayload`/`getOverflowPage`. Each preserves an unrelated off-path query before and after the selected error. Corrupt companions remain native-only and no-credit. Reproduce with `npm run test:conformance:advanced-index:manifest` and `npm run test:conformance:advanced-index:native`.

### Revision 2026-09-23: scoped advanced-index public execution

[[card:card-s-c-b-b]] promotes only the six advanced cases now passing through the public TypeScript API in all three database encodings: represented WITHOUT ROWID exact and prefix primary traversal, covering secondary access with exact composite-PK physical fields, index-backed expression-list `IN`, and the two ordinary composite-range neighbors. At this 2026-09-23 checkpoint the harness executed all 30 public row cases with 18 credited pairs (36 fresh reset/rebind accounting executions); the 2026-09-29 selected-access reconciliation below supersedes this tally. The frozen positive `partial-implied` and `expression-identical` cases now earn six selected-access encoding pairs: loaded physical roots, KeyInfo and live seek/position plus typed rows and pinned EQP/counters meet the bounded criterion in CONFORMANCE. Negative `partial-not-implied` and `expression-mismatch` remain attempted row runs but `unattempted`/zero for selected-access credit because their truthful unforced execution scans the base table. This is not generic partial/expression optimizer parity; joined selected-IN remains gated.

The represented WITHOUT ROWID physical boundary is column-only primary terms with built-in BINARY/NOCASE/RTRIM collation, ASC/DESC direction, default NULL ordering, and column-only secondary terms. Physical secondary records append every absent primary-key term using the same immutable `KeyInfo` identity. Exact/prefix primary and covering secondary paths are admitted. A non-covering secondary gathers the immutable per-PK-term physical-field mapping for a primary-table BLOBKEY lookup (`wherecode.c:2171-2185`, `OP_NotFound`); the all-encoding `wr_c` discriminator requires one secondary seek, one primary seek, no primary scan, and typed payload `w2`. Unrepresented expression/partial indexes, unsupported collations/NULLS modifiers, or incomplete physical descriptors are excluded from selection atomically rather than approximated.

Covering analysis uses every value read after positioning (residual WHERE, projection, and ORDER/sorter inputs). It is not narrowed to projection-only columns. The all-encoding planner regression forces an ordinary index missing residual `blob` and requires `covering=false`/`needsTableLookup=true`; public ordinary and partial residual discriminators independently require base-table reads. This follows the source ownership split: `where.c`/`whereexpr.c` establish safe omitted terms before `wherecode.c` covering/deferred-seek lowering.

### Revision 2026-09-23: WITHOUT ROWID secondary PK field remapping

The immutable physical secondary descriptor now carries one exact record-field ordinal for every primary `KeyInfo` term in PK order. This replaces the earlier incorrect contiguous-auxiliary-suffix assumption identified by `record:///review.md?card=card-s-c-b&v=3`. Mapping matches both column identity and the required PK collation: declared PK components may be mixed, reordered, or interspersed; all components may already be declared with no suffix; and a declared different-collation copy does not mask SQLite's appended PK-collation copy. `DeferredIndexSeek` gathers precisely those mapped values to construct the primary BLOBKEY.

Pinned native fixtures and all-encoding public tests cover four non-covering layouts: one declared plus one auxiliary PK component, reordered/interspersed components, all PK components declared (no suffix), and a BINARY-declared/NOCASE-PK duplicate. Each payload discriminator requires one secondary seek, one primary seek, no primary scan, and no residual fallback. The PK is composite DESC and the mixed case selects a NULL secondary term. The represented boundary remains column-only terms, built-in collations, and default NULL policy; partial/expression selected access remains uncredited [[card:card-s-c-c]] scope.

### 2026-09-23 aggregate-predicate scalar ORDER/LIMIT destination

For the admitted single-table aggregate predicate, an uncorrelated scalar subquery with a one-term ordered producer and `LIMIT 1` is lowered into the same `Program`. This follows pinned `expr.c:sqlite3CodeSubselect`: initialize the SRT_Mem-equivalent destination to NULL, guard the producer with `Once`, and retain the first ordered row; the existing budgeted sorter supplies the ordered destination. Registers and private cursors are allocated from the aggregate compiler, so reset and all database encodings rebuild one statement-wide private state rather than invoking a host evaluator. The adjacent shapes remain atomic temporary prepare errors. The hash-matched Chinook oracle returns 10—not the initially reported 4—for `Track.AlbumId=(SELECT AlbumId FROM Album ORDER BY AlbumId LIMIT 1)`; public tests preserve that discrepancy plus plain, aggregate, and empty scalar controls.

### Revision 2026-09-22 — C5 qualified outer ownership in SELECT-list subqueries

Native SQLite 3.53.4 on the digest-pinned Chinook image returns `AC/DC|2` for
`SELECT Name,(SELECT COUNT(*) FROM Album a WHERE a.ArtistId=ar.ArtistId) FROM
Artist ar WHERE ar.ArtistId=1`; the public path previously rejected
`ar.ArtistId` as a missing column. Pinned `resolve.c:lookupName` walks linked
`NameContext` frames local-first, while `expr.c:sqlite3CodeSubselect` emits a
correlated (`EP_VarSelect`) child in the parent VDBE without `OP_Once`.

The semantic resolver already preserved that linked ownership. The divergence
was at the lowering handoff: `expressionFromReduction` represents
`alias.column` as one column node, but `compileTableSelect` handed that combined
spelling to its source resolver as if it were an unqualified identifier. It now
reconstructs the qualified identifier components for the same source-aware
resolution path. Child binding therefore keeps local-first shadowing, the
resolved outer cursor, and parent-VDBE register/correlation ownership; no alias
map, textual substitution, nested public statement, host fallback, or widened
plan is introduced.

Digest/source-ID-bound native and public C5 evidence preserves the exact SQL and
`AC/DC|2` result. All-encoding composition coverage exercises qualified outer
WHERE filtering, two aggregate children, arithmetic composition, typed metadata,
reset, empty/NULL neighbors, lifecycle, work/private-state ownership, and cleanup.
Correction: [[card:card-m-f-k]], commit
`30894db664433bc3ebaba3b3467963fd34adafdc`.

#### Owner C4 shared REAL decoder correction

`mem.ts:sqliteFpDecode` now directly owns pinned `util.c:sqlite3FpDecode` state:
IEEE sign/special/subnormal extraction, `sqlite3Fp2Convert10`, conversion-specific
`iRound`, ordinary 16 versus altform2 20 digit limits, carry/trailing-zero handling,
and the 17-digit round-trip shortening decision. Its integer/BigInt decimal-to-
binary comparison replaces the C `sqlite3AtoF` check without host number
formatting. Mem text conversion (therefore CAST/columnText), `quote`, and
`printf`/`format` share this decoder; raw REAL remains a JavaScript number.
Explicit C `sqlite3_column_text` evidence covers overflow Inf, subnormal text,
integer-boundary REAL and `%!.17g`/`%!.20g`.

#### C4 altform2 floating caller correction

The common pinned `printf.c` decoder limit (`flag_altform2 ? 20 : 16`) now reaches
fixed `%f` and exponential `%e`/`%E` as well as generic `%g`/`%G`. Altform2
trailing-zero removal follows the shared floating branch after rendering; ordinary
non-`!` calls and `round()` retain their existing policy. Pinned C column-text and
public tests distinguish 20-digit decode for positive/negative, subnormal,
exponent, width/zero/sign cases; pinned `%F` remains unsupported and emits empty.

### Revision 2026-09-28 ([[card:card-s-c-c-b]] joined selected-index bound repair)

Pinned `src/wherecode.c:sqlite3WhereCodeOneLoopStart` codes each selected loop's probe and termination with prerequisite cursors positioned; `src/where.c:whereLoopAddBtreeIndex` supplies admitted equality prefix and range. Joined lowering had opened and advanced the selected physical root but ignored these admissions, causing the shared `storage_values` inner self-join to exhaust the default work budget. `compileInnerTableSelect` now emits `IndexSeekPrefix` after prerequisite loops, with selected `PhysicalIndex.keyInfo` and admitted affinities, and `IndexPrefixEnd`/`IndexRangeEnd` before `DeferredSeek`; termination exits to the enclosing loop's next/LEFT empty transition. The bound RHS uses the joined source binder. Unsupported IN and unavailable-prerequisite probes do not use this seek; residual predicates remain. This bounded repair does not establish arbitrary joined path-order, reverse-scan, or IN-probe lowering.

### Joined partial-proof operand identity correction (2026-09-29)

`where.c:whereUsablePartialIndex` (3700–3734) tests each eligible join/WHERE term with `sqlite3ExprImpliesExpr(...,iTab)`; `expr.c:exprImpliesNotNull` (6698–6765) compares the *operand* against the predicate target, not merely a whole-term source mask. A query equality `p.a=m.c` has a `p` prerequisite but its `m.c` operand cannot prove `p.c IS NOT NULL`. The previous `sameResolvedExpression` last-name fallback falsely did so and omitted the nullable p row. Partial-proof column comparison now requires a depth-zero resolved column use, the indexed source object and its declared column identity; no matching use means no proof. The independently parsed schema predicate supplies the target table column name. This gate is local to partial proof: expression-index structural matching is unchanged. For unproved predicates, unforced plans retain the table path and forced `INDEXED BY` rejects at preparation. The public three-encoding `joined same-name operand` regression exercises forward/reversed/LEFT join order, reset and nullable scan controls; do not extrapolate to unrepresented inference branches.

Joined selected IN-prefix handoff ([[card:card-s-c-d-a]]): the bounded single-field
multi-source branch iterates distinct affinity/KeyInfo-collated RHS keys rather
than repeating source-list keys. Pinned `wherecode.c:codeINTerm` uses a distinct
RHS cursor produced by `expr.c:sqlite3CodeRhsOfIN`; the TS register-list
iterator uses comparison instead of allocating an ephemeral B-tree (O(n²) for
this bounded list), preserving non-NULL set probes, per-entry rebind, and LEFT
loop exhaustion. This paragraph records the original single-field checkpoint;
subsequent selected composite/ranged IN and bounded stat1 slices below supersede
its pending-work assertion. See `docs/SQLITE_SOURCE_MAP.md` for boundaries.

### Revision 2026-09-29: immutable native IN/range/stat choice discriminator ([[card:card-s-c-d-c]])

The bounded pinned evidence at `test/conformance/cases/in-range-stat-native.json` supplements, but does not expand, W3 admission: native `codeINTerm` iterates RHS values and re-seeks a composite `a IN (...) AND b>=... AND b<=...` index without an `a=?` confounder. Native `ANALYZE` changes a separate IN candidate's chosen root (`t_a` to covering `t_ab`) on generated stat1 snapshots; this build does not carry sqlite_stat4, so STAT4 sample probing remains gated. That statement described the earlier tests-first checkpoint: the six stat-choice cases now execute through the bounded immutable stat1 planner slice below; selected composite IN is separately owned and its full six-case access remains under validation. The source-based tests and controls are in `docs/CONFORMANCE.md`; do not count matching scan rows as indexed behavior or adapt W3 estimates by SQL text.

### Selected single IN slot with composite range (2026-09-29)

`wherecode.c:codeINTerm` (pinned 3.53.4) opens an IN iterator per selected
index equality slot; the seek is repeated after advancing the RHS, while
`where.c:whereLoopAddBtreeIndex` preserves the equality prefix and following
range and `whereexpr.c:exprAnalyze` records RHS prerequisites. The single-table
VDBE caller now keeps one selected IN slot's set iterator outside its composite
prefix/range seek, and reuses that slot's affinity and KeyInfo term collation for
NULL/duplicate suppression. An IN prefix does **not** certify output order:
repeated seeks follow RHS iteration order, so an ORDER BY still needs its sorter.
The bounded in-memory RHS set used by the existing single-slot translation is
retained as a browser-safe replacement for an ephemeral Btree; for this path
its observable comparison and typed rows are checked against the pinned
three-encoding `in-range-stat-native.json` through the public interface in
`in-range-selected-red.test.mjs`. Multiple IN slots need nested iterators and
remain an atomic temporary rejection. This is not full wherecode.c parity:
joined composite IN, stat-driven choice, corruption and lifecycle/reset cases
still need independent selected-path verification.

### Joined composite single-IN-slot restart correction (2026-09-29)

The historical joined admission gate above is superseded for **one** selected
IN equality slot (with preceding equality prefix and optional following range).
Pinned `wherecode.c:codeEqualityTerm/codeINTerm` creates an IN iterator per slot;
`sqlite3WhereCodeOneLoopStart` combines its register with the remaining prefix
and range seek, then `sqlite3WhereEnd` advances the RHS before the LEFT
unmatched-once path. Joined `compileInnerTableSelect` now emits that restart
within the source level, after prerequisite cursors are positioned, reuses
`IndexPrefixEnd`/`IndexRangeEnd` on each seek, and suppresses NULL/duplicates
using the selected KeyInfo slot. Two or more selected IN slots still need
nested restarts and reject forced access atomically (unforced replans without
that index). The in-memory finite RHS list replaces the ephemeral RHS Btree
for browser-safe execution; public typed rows and actual selected probes for
joined LEFT and reset/rebind in UTF-8/16LE/16BE are covered by
`in-range-selected-red.test.mjs` and `run-advanced-index-ts.test.mjs`.
Global joined ORDER remains a sorter, not a local-index-order claim.

Selected composite IN private-work revision: `expr.c:sqlite3CodeRhsOfIN`/
`wherecode.c:codeINTerm` use an ephemeral Btree with cursor movement, whereas
this browser-safe finite RHS array compares affinity/KeyInfo-normalized values
in memory. Unlike a SQLite Btree, its duplicate walk can be quadratic. The
`InListValue` VM primitive now checkpoints and charges each candidate and
prior-value comparison under the same operation `maxWorkUnits`, releasing
borrowed `Mem` values in `finally` on cancellation/limit/collation failures.
Six frozen encoding/state variants verify selected-vs-scan corruption isolation
(SQLite CORRUPT code 11), post-error finalize/connection reuse, and a selected
seek followed by bounded duplicate elimination; these are bounded safety and
fixture parity, not a proof of equivalent Btree complexity or statistics choice.

Selected two-slot IN revision (supersedes the earlier multi-IN rejection for
**two** selected equality slots): `wherecode.c:codeINTerm` creates an RHS cursor
per equality slot, and `where.c:sqlite3WhereEnd` advances the innermost cursor
first, rewinding it when the outer RHS advances. The selected single-table and
joined VDBE callers now assign independent registers and iterators per slot,
restart the prefix seek after each inner probe, route inner exhaustion to the
outer iterator, and reset the inner register for each outer probe. Frozen six
encoding/state fixture tests cover forced/unforced two-slot selected seek counts,
duplicate INTEGER/REAL/NULL probes and LEFT unmatched-once. This finite-array
substitution remains bounded by `maxWorkUnits` as described above. This
paragraph records the **two-slot** fixture proof, not the current admission
ceiling: the later three-slot selected tests in `in-range-selected-red.test.mjs`
exercise single-table rebind and joined LEFT in UTF-8/16le/16be; unrepresented
RHS shapes still reject/replan atomically. Two-slot fixture expectations
were checked independently with host SQLite 3.45.1; separate unsorted RHS
cases have pinned 3.53.4 read-only comparisons. Three-slot native evidence
is now independently frozen in `test/conformance/cases/three-in-native.json`
by `capture-three-in.py` against the immutable advanced-index images: the
exact existing single/rebind and LEFT SQL plus an unmatched LEFT neighbor,
typed ordered rows, EQP, selected root/IN cursor/restart/seek VDBE, counters and
fixture hashes/roots in UTF-8/16le/16be; both native binds execute on one
prepared statement separated by reset/clear bindings. `three-in-native-ts.test.mjs` compares
exact SQL via public fresh/reset/rebound calls, scan controls and selected-root
corruption versus off-path scan isolation. The in-memory
ordered finite `InListValue` set is a browser-safe ephemeral Btree substitution:
unlike source `wherecode.c:codeINTerm`'s `Rewind`/`Column`/`IsNull` per RHS
cursor and `codeAllEqualityTerms`' per-slot register/affinity setup, TS holds
bounded KeyInfo-ordered arrays, resets inner slot registers when outer advances,
and seeks the composite prefix for each non-NULL probe. Native 3.53.4 executes
`SeekGE`/`IdxGT` on the covering `m_abc` root and advances RHS `Next`; this
coverage checks ordered typed results and selected work, not native cursor
complexity or broad optimizer parity.

Selected IN RHS physical-order correction (supersedes the earlier array-order
claim): pinned `expr.c:sqlite3CodeRhsOfIN` inserts RHS values into a KeyInfo
ordered ephemeral Btree; `wherecode.c:codeINTerm` traverses that set with
per-slot `bRev` toggled for a descending physical index field. A source-list
iterator changes public no-ORDER row order even when each seek returns correct
rows. `vdbe.ts:InListValue` now caches a per-iterator, affinity/collation-ordered,
deduplicated finite set, with reverse per physical field; the joined and
single-table callers pass physical index direction to the owning opcode.
The in-memory ordered array is a browser-safe substitute for an ephemeral Btree,
not a claim of native Btree complexity. It charges each comparison under
`maxWorkUnits`, bounds retained entries/keys/aggregate bytes with existing
private-state limits, releases cells on failed construction, inner-iterator
reset, halt and statement reset. Six frozen UTF-8/16 variants compare public
unsorted two-IN rows with independently queried pinned 3.53.4 read-only
fixtures; the old selected-seek-before-budget-exhaustion test was updated to
reflect the source-required RHS materialization before the first seek. Global
ORDER/stats parity and general multi-slot coverage remain open.

### Immutable stat1 choice slice ([[card:card-s-c-d-f]], 2026-09-29)

`schema.ts` reads the immutable `sqlite_stat1` b-tree in database encoding and
attaches represented index prefix LogEst estimates to the loaded index identity.
`where-plan.ts` applies `build.c:sqlite3DefaultRowEst` absolute prefix defaults
when absent, `analyze.c:analysisLoader/decodeIntArray` numeric stat1 prefixes
when present, and `where.c:whereLoopAddBtreeIndex/wherePathSolver` IN iterations
and order-dependent single-source sort cost. The six-case pinned stat-choice
fixture chooses ordered t_a before ANALYZE and covering t_ab with a sorter after;
forced t_a/t_ab controls retain rows in all three encodings. This is bounded
choice evidence, not a full port of `whereLoopInsert` pruning, STAT4 sample
estimation, or multi-source order analysis. Nonempty sqlite_stat4 sample tables
reject at graph load rather than silently treating stat1 as equivalent; stat1
extensions beyond decimal prefixes and `unordered` reject rather than supply
plausible estimates. The source also accepts `sz=`/`noskipscan`, table-only
statistics and legacy malformed data: these are not represented here. A matched
non-NULL stat1 value stored as BLOB is also explicitly unsupported, not an
absent estimate: `analyze.c:sqlite3AnalysisLoad/analysisLoader` receives it
through sqlite3_exec callback text (and `decodeIntArray` may recognize `sz=`),
whereas the read-only record loader retains its storage class. In three-encoding
pinned BLOB `sz=` fixtures both forced and unforced public prepares reject;
unknown-table rows still fall through and table-only rows preserve typed results.
This explicit rejection avoids inventing an index cost without claiming BLOB
stat representation. See `test/conformance/stat-record-boundary.test.mjs`.

`where.c:whereLoopCheaperProperSubset` case 2 additionally admits strict
subsets of represented constraint terms across indexes (unless a covering
subset would outrank a noncovering superset). `whereLoopAdjustCost` adjusts
run/output estimates in insertion order against earlier retained templates;
the earlier same-index shorter equality-prefix case 1 remains. This corrected
selected composite IN and joined two-slot access in the focused reproducer.
Unlike native `whereLoopInsert`, this slice does not replace/discard candidates
via `whereLoopFindLesser`, nor represent skip-scan or sampled STAT4 paths.
Prior width and unused-term-output experiments did not repair the selected
access and were reverted; do not infer general cost parity from these tests.

The joined forced single-field IN probe-count regression was a test-oracle
mistake, not a reason to force the IN candidate. Read-only pinned 3.53.4
EXPLAIN on the advanced-index UTF8 fixture for both INNER and LEFT joins picks
`m_abc (a=?)` from the join equality and evaluates IN as residual (one
SeekGE/IdxGT pair), per `where.c:whereLoopAddBtreeIndex` candidate competition.
The corrected test asserts one selected equality seek and typed rows after
rebind; it does not credit distinct IN probes for that join.

Stat1 choice follow-up ([[card:card-s-c-d-f]]): pinned `where.c:whereRangeScanEst` applies `whereRangeAdjust` to each bound (20 LogEst per default bound), another 20 for a pair, floors at 10 and caps against prior `nOut` minus bound count; the previous TS 10/20 total reduction was divergent. The corrected bounded range estimate preserves the frozen six choices but does not resolve post-stat composite selected access. `whereLoopAddBtreeIndex` additionally scales index-row visits by `szIdxRow/szTabRow`, adds table lookup separately, and only then applies IN iteration and `whereLoopOutputAdjust`; these source quantities and adjustments remain unrepresented. A trial of unscaled `rows+1` visits failed selected access and was reverted; it must not be substituted for row-width estimation. Two-slot unforced selected access remains red; typed result equality is not proof of selected probes.

A subsequent branch comparison against `build.c:estimateTableWidth/estimateIndexWidth` and `where.c:whereLoopOutputAdjust` tested default row-width-scaled visits and residual-term output adjustment independently and together. Neither repaired post-stat composite or joined two-slot selected access (combined 42/52); both experiments were reverted rather than left as incomplete substitutions. Instrumented post-stat single-source candidates with both experiments temporarily enabled: `t_b` range run 50 / output 20 / scored 59 versus `t_ab` IN+range run 62 / output 29 / scored 72. This isolates a large remaining divergence in candidate formation/estimation, not merely a tie-break. The C row-width cost also requires the exact `Column.szEst` semantics and potential stat1 `sz=` override before porting. No claimed parity from this measurement.

Stat1 choice follow-up ([[card:card-s-c-d-f]]): the bounded subset adjustment
now follows `where.c:whereLoopCheaperProperSubset` case 1's **index identity and
prefix length** comparison rather than requiring equal term identity. Case 2
(term-subset/covering), insertion order, and `whereLoopOutputAdjust` are not
ported by this change. Isolated source-branch experiments showed that replacing
per-candidate sorting with a fixed guessed row count breaks the frozen choice,
while dropping subset adjustment reverses the before-ANALYZE choice. Adding the
source's stat1 IN seek/scan inequality as a cost penalty did not repair the
unforced composite selected probe: seek-scan is a different cursor operation
and must not be represented as an IN seek candidate. The six stat-choice
snapshots pass, but post-stat unforced composite selected access and joined
multi-slot selected probes remain red; do not infer broad optimizer parity.

Stat1 solver follow-up ([[card:card-s-c-d-f]]): `where.c:whereBegin` calls
`wherePathSolver` first without ORDER BY, then again with the first pass's
estimated output cardinality plus one; `whereSortingCost` uses this fixed
cardinality, output-column count, sorted-prefix fraction and `estLog`, rather
than the candidate's own output rows. The bounded single-source TS solver now
makes the same two passes and uses the ordinary ORDER BY branch of that cost.
`wherePathSatisfiesOrderBy` also requires an IN prefix matching an ORDER term
to agree in direction with later indexed terms. These changes preserve the six
frozen pre/post stat choices, but still fail selected post-stat composite access
and two-slot selected probes (focused run 42/52). A diagnostic post-stat
candidate dump showed `t_b` range run/output 52/22, `t_ab` IN+range 63/30;
the first-pass cardinality alone cannot fix that candidate-estimate gap. This
is not a full translation of `whereInterstageHeuristic`, `whereLoopInsert`,
row widths or multi-source ordering. Do not claim selected access from typed
rows alone.

#### Table RHS IN affinity follow-up (card-t-b)
For a finished table-child SRT_Set splice still admitted by the scalar caller,
`expr.c:comparisonAffinity` reads the **RHS result expression** (not its
result-column declared type). The latter is NULL for CAST projections, so the
old `affinityOf(declaredType ?? "")` incorrectly chose BLOB. The bounded caller
now uses the same `comparisonAffinity` primitive as its parent-owned no-FROM
child, sourcing the RHS expression reduction. The pinned/public paired
`CAST(x AS INTEGER)` and `CAST(x AS TEXT)` table-child test covers types,
metadata, reset and finalize. This corrects affinity only; the table/aggregate
child completed-Program relocation remains and the structural reproducer is red.

#### Parent-owned aggregate child forwarding across flattening (card-t-b, partial)
`expr.c:sqlite3CodeSubselect` invokes `sqlite3Select` in the enclosing Parse/Vdbe;
`select.c:flattenSubquery` and view expansion must not turn that caller into a
standalone Program. `compileAggregateSelect` now forwards its parent builder,
ops, parameters and Mem/Exists/Set destination through bounded derived and
immutable-view flattening recursion. This preserves the same destination and
register/cursor allocator if the flattened query reaches the no-GROUP producer.
This does not migrate compound/group/zero-source aggregate routes or remaining
table children: completed-child relocation remains live and the unfiltered
structural reproducer is red. Pinned/public `select-scalar-child-native.py` /
`.test.mjs` now pair bounded derived aggregate children across scalar, EXISTS
and IN destinations: four-row count, filtered count, LIMIT/OFFSET NULL,
typed names, and two reset/finalize cycles. The prior qualified `d.x`
predicate failure was traced to the aggregate flattening column-name map:
it used fabricated `column1` for unaliased `SELECT x`, whereas ordinary
flattening and `select.c:substExpr` address the resolved result column.
`compileAggregateSelect` now uses the result expression name before
substituting the qualified predicate. The pinned/public qualified case now
passes alongside the unqualified variant. This only repairs the bounded
flattened one-table aggregate path; it is not evidence of general child
compiler ownership.

#### Direct table-child destination tranche (card-t-b, in progress)
`src/internal/vdbe.ts:compileScalarSelect` now sends one bounded table-child
producer and its scalar/Exists/IN consuming caller into the enclosing builder:
a resolved direct column or rowid of one ordinary table, no WHERE, sort,
DISTINCT, group, compound, OFFSET or window. `resolve.c:NameContext`/
`expandAndResolveSelect` supplies the direct result and table; `select.c:
sqlite3Select`/`selectInnerLoop` positions `OpenRead`/`Rewind`/`Next`, writes
the Mem/Exists/Set destination inside the loop, and applies child LIMIT before
scanning. `expr.c:sqlite3CodeSubselect` initializes Mem/Exists before the
child and opens the SRT_Set cursor before the LIMIT-zero guard; the outer
`InSet` always probes. The TS VM retains its async scan and ephemeral Mem
adaptations. Pinned/public paired cases cover first row, zero and nonzero
LIMIT, sibling cursors, typed NULL/INTEGER, metadata and two reset/finalize
cycles. Other table and aggregate children still use completed-Program opcode
relocation; this tranche does not pass the scalar-child structural test or
establish general SELECT compilation parity.

The direct table-child producer additionally consumes a resolved single-table
WHERE predicate in its parent loop. `resolve.c:NameContext` column-use identity
binds each predicate leaf to the already allocated child cursor; `IfNot`
skips rejected rows to `Next` *before* SRT_Mem/Exists/Set and child LIMIT
accounting (`select.c:selectInnerLoop`, `where.c:sqlite3WhereCodeOneLoopStart`).
The emitter rejects unrepresented predicate AST ownership instead of running
unbound expressions. Pinned/public cases in the scalar-child pair exercise
WHERE with LIMIT 0/1 and multiple destination kinds. This does not replace
the other aggregate/correlated completed-child splice. A bounded single-key
ORDER BY direct table child now inserts key/payload into a sorter while the
WHERE loop scans, then drains to Mem/Exists/Set before applying the child's
LIMIT (`select.c:selectInnerLoop` / `pushOntoSorter` / `generateSortTail`,
`expr.c:sqlite3CodeSubselect`). Only a resolved ordinal, result alias, or
simple source-column key is admitted by this parent-owned path; other keys
still fall through to the pre-existing completed-child route. Paired pinned
source-ID/public probes cover descending and ascending keys, LIMIT 0/1/2,
sibling destination isolation, typed rows, names, two resets and finalize.
This is not evidence that the remaining aggregate/table splice is removable;
the unfiltered structural reproducer still fails on that splice.

#### Aggregate-parent IN child destination/limit (card-t-b, partial)
`expr.c:sqlite3CodeRhsOfIN` creates an ephemeral SRT_Set destination in the
parent Vdbe, and `select.c:selectInnerLoop` inserts rows after OFFSET and
LIMIT-zero gating. The bounded aggregate-parent one-table direct-column IN
child now applies `computeLimitRegisters` before its scan and emits each
eligible cell through `emitSelectDestination({kind:'set'})`, before probing
with the aggregate parent's left operand. Paired pinned-source-ID and public
`select-scalar-child-native.py`/`.test.mjs` compare `count(*)-3` against
LIMIT 0/1/1 OFFSET 1 with typed results, metadata, reset and finalize.
This does not migrate scalar-child completed-Program relocation or general
aggregate child production; the structural reproducer remains red.

#### Aggregate-parent EXISTS LIMIT guard (card-t-b, partial)
`expr.c:sqlite3CodeSubselect` initializes SRT_Exists to zero, retains a
preexisting zero limit when capping the child at one row, then invokes
`sqlite3Select` in the parent Vdbe; `select.c:selectInnerLoop` does not set
Exists until an eligible row survives OFFSET. The separate aggregate-parent
`compileAggregateSubquery` path now emits its child LIMIT guard after result
initialization and before opening child cursors, and skips matching rows for
OFFSET. Source-ID-checked `select-scalar-child-native.py` and public
`select-scalar-child.test.mjs` pair LIMIT 0/1/1 OFFSET 4 inside a count(*)
parent, including metadata and two reset iterations. This repairs one
previously unsupported child composition, **not** aggregate/table child
program ownership: completed-child relocation in the scalar-parent path and
other separate aggregate-parent lowering remain; structural ownership is red.

#### Child aggregate classification boundary (card-t-b, partial)
`resolve.c:resolveExprStep` walks `TK_SELECT`, `TK_EXISTS`, and the SELECT RHS
of `TK_IN` in a child NameContext; the `TK_IN` left expression still belongs
to the enclosing context. `selectHasAggregate` now prunes the child while
visiting that left expression, matching `resolveSelectStep`'s `NC_HasAgg`
ownership rather than allowing a child count to route its parent through the
aggregate producer. `select-aggregate-ownership.test.mjs` checks all four
syntactic boundaries; the paired source-ID/public scalar-child count/EXISTS/IN
case checks rows, types, metadata and resets. The aggregate producer now
lowers IN-left (and IN-list/BETWEEN) aggregate expressions through its shared
AggInfo register entries before compiling the IN probe, rather than passing
an execution-only aggregate directly to scalar code. The pinned/public
`count(*) IN (SELECT x FROM t2)` case compares typed results, names, two resets
and finalize. This is not child-program ownership parity: completed-child
relocation remains, and further aggregate expression forms need differential
coverage before claiming them broadly.

#### GROUP BY child destination ownership (card-t-b, bounded)

Pinned `expr.c:sqlite3CodeSubselect` initializes SRT_Mem/Exists/Set and calls
`select.c:sqlite3Select` in the enclosing Parse. In `select.c` the grouping
sorter feeds `selectInnerLoop` on each completed group; HAVING rejects before
SRT emission, OFFSET skips groups, LIMIT stops after emitted groups. The
one-source `simpleGroupShape` child now calls
`compileAggregateSelect` with the scalar parent's builder, ops, parameters
and destination. Its sorter cursor comes from the builder, group projection
uses the producer's reserved output range rather than fixed register 1, and
its finish jumps return to the caller rather than emitting a child Halt or
freezing the caller ops. The caller allocates the Once guard and IN set/probe.
Pinned source-ID/public `select-scalar-child-native.py` / `.test.mjs` pair
HAVING, OFFSET, LIMIT 0 and Mem/Exists/Set typed rows, metadata and two
executions/reset/finalize. The group's result DISTINCT cursor now allocates
from the enclosing builder, and `Found`/`IdxInsert` consume the reserved
projection range instead of the completed program's fixed register 1. This
preserves SQLite `selectInnerLoop` ordering: HAVING, result DISTINCT, OFFSET,
then destination/LIMIT. Pinned/public paired DISTINCT-group probes cover
OFFSET/LIMIT and filtered Mem/Exists/Set with reset. Before this change the
finished-child audit rejected OpenEphemeral/Found/IdxInsert; after allocating
the cursor but before correcting its key range, a scalar result was NULL
rather than the pinned INTEGER. The earlier public attempt rejected `OffsetLimit,
AggReset, CompareGroup` during finished-Program relocation. This bounded
producer now also owns the bounded result sorter: allocate its cursor in
the enclosing builder, insert reserved projection registers as keys/payload,
drain into that register range, and emit to the caller's Mem/Exists/Set
destination after OFFSET; LIMIT counts only emitted rows. Pinned/public
`ORDER BY count(*) DESC` paired tests cover LIMIT 0/1 OFFSET 1 and all three
destinations with typed rows, names and reset. Previously the finished-child
opcode audit rejected OffsetLimit/AggReset/CompareGroup. This does not
establish arbitrary ORDER expressions, multi-source group or
remaining table-child ownership; the structural test is still red.

#### Bounded immutable-view scalar child (card-t-b)

Pinned `select.c:sqlite3Select` expands views and `flattenSubquery` splices a
single underlying SrcList; `build.c:sqlite3ViewGetColumnNames` names exposed
columns before substitution; `expr.c:sqlite3CodeSubselect` consumes the
result through the enclosing Mem/Exists/Set destination. The scalar child
caller now reuses `flattenImmutableView` for an eligible single-source view
before entering its parent-owned direct scan (including the view's predicate,
outer WHERE, ORDER and LIMIT). A single-source view alias is an exposed
NameContext qualifier, not a reason to forbid flattening: substitution uses
the alias for qualified leaves while the view-visible column mapping still
comes from `build.c:sqlite3ViewGetColumnNames`. The view restrictions otherwise
remain those of the existing flattening helper. No completed child Program
is used on this route; nonflattenable view children stay with the audited
fallback. Paired `select-scalar-child-native.py` / `.test.mjs` cover named/
inferred view columns with and without aliases, qualified projections,
WHERE, ORDER, LIMIT/OFFSET and LIMIT zero, typed rows, metadata and reset.
This does not resolve the remaining structural ownership failure.

#### Bounded derived scalar child flattening (card-t-b)

`select.c:flattenSubquery` replaces a transient source with its underlying
SrcList and substitutes result expressions before `sqlite3Select` invokes
`selectInnerLoop`; `expr.c:sqlite3CodeSubselect` retains the enclosing
Mem/Exists/Set destination. The scalar caller now applies the existing
immutable derived substitution to bounded single-source derived scalar/EXISTS/IN children with resolved transient columns,
no-inner-sort/limit/distinct/group/window, combining inner and outer
predicates before handing the flattened tree back to the parent-owned direct
scan compiler. The substitution owner now reads Lemon qualified-column leaves
rather than assuming immediate `nm` terminals, and synchronizes the ExprNode
token carrier with substituted reductions: `resolve.c`'s direct NameContext
binding reads tokens before the expression walker. Thus scan cursor, sorter,
registers, LIMIT and destination stay in one builder; no completed child
Program is published for this branch. Paired `select-scalar-child-native.py` /
`.test.mjs` cover qualified and unqualified projection/WHERE/ORDER, scalar
OFFSET, EXISTS, IN, combined predicates, LIMIT zero, typed names and reset.
More complex/nonflattenable derived producers retain the fallback. The
structural ownership assertion remains red for other producers.

#### Ordered constant set child (card-t-b)

Pinned `select.c:multiSelect` routes an ordered set compound through
`multiSelectByMerge`, where `multiSelectByMergeKeyInfo` keeps ORDER collation
and direction distinct from set duplicate comparison; `expr.c:sqlite3CodeSubselect`
uses the enclosing Mem/Exists/Set destination. For bounded one-column
constant set arms with a single resolved result-column ORDER term, the
parent-owned typed set cursor applies UNION/EXCEPT/INTERSECT first, then its
sorted drain inserts surviving values into the parent-owned ORDER sorter.
The latter drains through the existing destination and LIMIT/OFFSET path.
These budgeted async cursors replace the two upstream coroutines only in this
finite no-source branch; no general merge equivalence is claimed. Paired
`select-scalar-child-native.py` / `.test.mjs` cover descending alias, ascending
NULL/offset, empty intersection, LIMIT zero, INTEGER/NULL names and reset.
Ordered mixed set/ALL and source-backed producers retain the fallback.

#### Mixed set-prefix / UNION ALL child (card-t-b)

`select.c:multiSelect` hands a set-operation prefix to the merge path,
then reuses its destination and LIMIT/OFFSET registers for subsequent
unordered UNION ALL arms. The bounded single-column no-source child now drains
its typed set cursor *before* compiling trailing ALL rows, sharing the same
parent-owned Mem/Exists/Set and LIMIT/OFFSET registers. Stop jumps target the
end of the whole child, not merely the end of the set drain, so scalar and
EXISTS do not overwrite an already delivered result. This also preserves
empty-prefix and LIMIT-zero transitions. Paired pinned/public
`select-scalar-child-native.py` / `.test.mjs` cases cover these branches,
INTEGER/NULL, names and resets. Ordered set and source-backed children still
use the fallback; the structural ownership check remains red.

#### Bounded constant set-compound scalar child (card-t-b)

Pinned `select.c:multiSelect` dispatches UNION/EXCEPT/INTERSECT to
`multiSelectByMerge` and sends sorted distinct candidates through the shared
`SelectDest` from `expr.c:sqlite3CodeSubselect`. A finite single-column,
no-source, unordered set-compound child now allocates two typed ephemeral
cursors in the enclosing builder: UNION inserts/replaces, EXCEPT deletes,
INTERSECT retains the second cursor's keys, and the sorted first cursor
feeds Mem/Exists/Set after OFFSET/LIMIT. The existing async ephemeral cursor
is the browser adaptation for pinned merge coroutines; source comparison
and paired pinned/public scalar/Exists/IN, INTEGER/NULL, duplicates, LIMIT 0,
metadata and reset cases are in `select-scalar-child-native.py` / `.test.mjs`.
Ordered/mixed set children and source-backed arms retain the audited fallback;
structural ownership is not yet complete.

#### Bounded ordered constant compound child (card-t-b)

Pinned `select.c:multiSelectByMerge` sorts compound arms before sending rows
through the shared `SelectDest`; `expr.c:sqlite3CodeSubselect` supplies
Mem/Exists/Set and initializes the scalar result before production. For
single-column constant UNION ALL arms with one resolved result-column ORDER
term, the existing budgeted typed sorter is a browser/async adaptation to
merge's two-coroutine cursor protocol: each arm's key equals its payload,
and sorted rows are drained into the enclosing builder's destination after
OFFSET, with LIMIT-zero guarding production. This does not generalize to
source-backed arms, multiple keys, set operators, or arbitrary ORDER terms.
Pinned/public `select-scalar-child-native.py` / `.test.mjs` compare alias
DESC and ordinal ASC, INTEGER/NULL, names, scalar/Exists/IN and two resets.
The remaining completed-Program splice still fails structural ownership.

#### Constant compound LIMIT-zero error order (card-t-b)

Pinned `select.c:multiSelect` unordered UNION ALL propagates the shared limit
to its left arm and tests `iLimit` before compiling the right arm; a zero
LIMIT skips offset coercion. The bounded compound scalar child now requests
`computeLimitRegisters`' compound-zero-before-offset ordering, unlike the
single-row no-FROM/VALUES route. The pinned oracle returns NULL/INTEGER 0
for `LIMIT 0 OFFSET 'bad'` rather than a datatype mismatch; public paired
scalar/IN test checks that order across resets. This is a control-flow
correction in the existing parent-owned producer, not completion of general
compound ownership.

#### Constant UNION ALL child producer (card-t-b, bounded)

Pinned `select.c:multiSelect` unordered UNION ALL branch runs left and right
SELECT arms into the same `SelectDest` with shared LIMIT registers; the
`expr.c:sqlite3CodeSubselect` Mem/Exists/Set consumer supplies the destination.
The bounded no-FROM, single-column, non-aggregate/non-window UNION ALL arm
sequence now consumes the existing parent-owned constant-row production path
used for VALUES, rather than compiling a child Program for relocation. Source
order and destination early stop are preserved for Mem/Exists, and Set inserts
all candidates before IN probing. Pinned/public
`select-scalar-child-native.py` / `.test.mjs` compare INTEGER/NULL, metadata
and two reset/finalize cycles. This does not establish table-backed/ordered
compound ownership or replace the remaining live audited fallback; structural
ownership is still red.

#### VALUES scalar-child producer (card-t-b, bounded)

Pinned `select.c:multiSelectValues` emits each constant row through
`selectInnerLoop` to the supplied destination; scalar `expr.c:sqlite3CodeSubselect`
adds a one-row limit while `SRT_Set` retains all qualifying rows. The bounded
single-column VALUES child now builds its rows in the enclosing builder with
parent-owned registers, optional set cursor, Once guard, and Mem/Exists/Set
result destination. The scalar/Exists path stops after its first candidate;
the IN path inserts each candidate and probes only after production. The
pinned/public `select-scalar-child-native.py` / `.test.mjs` pair checks typed
INTEGER and NULL results, metadata and two reset/finalize cycles. This does
not migrate general compounds or table-backed VALUES consumers; audited
completed-child relocation still has live users and structural ownership is
red.

#### One-source CASE projection child (card-t-b, bounded)

Pinned `expr.c:sqlite3ExprCodeTarget` TK_CASE compiles its optional base
once, then WHEN tests and THEN results in order, followed by ELSE and an
end label; `resolve.c:resolveExprStep` resolves its column references in the
child NameContext. The bounded one-source child binder now descends those
CASE reductions in the same operand/pair/ELSE order, binding each column to
its parent-builder cursor before `compileExpressionTree` emits the branches
and the result reaches DISTINCT/sorter/SRT destination. Previously the binder
rejected CASE wholesale and OFFSET could enter completed-child relocation.
Pinned source-ID/public `select-scalar-child-native.py` / `.test.mjs` compare
searched and simple CASE as scalar, EXISTS and IN children with typed rows,
metadata and two reset/finalize cycles. This is not migration of nested
subqueries in CASE or of multi-source child producers; structural ownership
remains red.

#### One-source arbitrary result ORDER key (card-t-b, bounded)

Pinned `resolve.c:resolveOrderGroupBy` first checks alias/ordinal/equal result
expression and then resolves an unmatched ORDER term as an ordinary expression;
`select.c:selectInnerLoop` inserts a separately computed sorter key with the
projected payload before the destination on sorter drain. A bounded one-source
child with a distinct ORDER expression now binds that key against its resolved
child NameContext and compiles it into the enclosing builder's registers before
sorter insertion. It does not replace the projection with the sort key. The
pinned/public `select-scalar-child-native.py` / `.test.mjs` pair verifies
`SELECT x+2 ... ORDER BY x*2 DESC LIMIT/OFFSET` consumed as Mem/Exists/Set,
including typed values, names and two reset/finalize cycles. Arbitrary
multi-source, derived and compound children still use the audited fallback;
structural ownership remains red.

#### One-source result-expression ORDER child (card-t-b, bounded)

Collated one-source projections no longer fall through solely because the
expression has a COLLATE reduction. Pinned `resolve.c:resolveExprStep` and
`expr.c:sqlite3ExprCodeTarget` (`TK_COLLATE`) keep the collation wrapper while
compiling its operand; the resolved column use may be attached to that wrapper
rather than the inner ID reduction. The bounded child binder passes that use
down to the operand, leaving the typed projection and DISTINCT/sorter/SRT
sequence in the enclosing builder. Pinned source-ID/public paired
`select-scalar-child-native.py` / `.test.mjs` cases cover INTEGER and CAST TEXT
collated projections, DISTINCT, result ORDER, LIMIT/OFFSET, IN, names and two
reset/finalize cycles. This is not migration of arbitrary collated ORDER or
multi-source children; the structural completed-child fallback is still present.

Pinned `resolve.c:resolveOrderGroupBy` first recognizes output aliases and
ordinals and subsequently compares ORDER expressions with result expressions;
`select.c:selectInnerLoop` constructs the result and sorter key before the
SRT destination, applying DISTINCT before the sorter, then OFFSET on drain.
The enclosing builder's one-source child now routes alias/ordinal/equal
result-expression ORDER through its resolved projection register as sorter
key, while a direct source-column ORDER keeps its own typed key. DISTINCT
reuses its result register for the sorter payload; no completed child Program
is relocated in this bounded path. The remaining arbitrary ORDER-expression
path is not migrated. Pinned/public `select-scalar-child-native.py` and
`.test.mjs` compare `x+1` result ORDER by expression/ordinal/alias with
DISTINCT, LIMIT zero, OFFSET, scalar/IN/EXISTS, names, typed rows and two
reset/finalize cycles. Prior to this change these expressions fell into the
OffsetLimit relocation rejection. Structural ownership remains red.

#### One-source expression-projection scalar child (card-t-b, bounded)

Pinned `resolve.c:NameContext` binds projected and predicate column uses in
one child scope; `select.c:selectInnerLoop` loads the projected expression
before result DISTINCT (when present), checks duplicates before OFFSET,
then inserts into the sorter or emits SRT_Mem/Exists/Set. The direct
one-source child producer now binds the result expression through its
resolved column uses instead of requiring `item.columnIndex`, and calls
`compileExpressionTree` in its own cursor/register builder; DISTINCT uses
that typed result register for both key and downstream payload, avoiding
reevaluation. The one-key ORDER route still requires a resolved column or
ordinal; other ORDER expressions fall back to the existing producer. Pinned
source-ID/public `select-scalar-child-native.py`/`.test.mjs` compare `x+1`
through WHERE, DISTINCT, descending ORDER, LIMIT 0/1/2, OFFSET,
Mem/Exists/Set, types, names and two resets/finalize. Before this change
OFFSET sent these children to completed-Program relocation and the opcode
audit rejected OffsetLimit. This does not migrate other table/compound/derived
children; structural ownership remains red.

#### Interim nested multi-source OFFSET/LIMIT register preservation (card-t-b)

`select.c:computeLimitRegisters` allocates `iLimit`, `iOffset`, then the
combined register in one Parse; `vdbe.c:OP_OffsetLimit` reads both and writes
that combined register. The still-live completed-child relocation in
`compileScalarSelect` previously rejected `OffsetLimit`, so an otherwise
admitted two-source expression child with OFFSET failed prepare. Pending
migration of the multi-source compiler into the enclosing builder, its
interim explicit relocation now includes all three register operands. This
is **not** a source-faithful replacement for child Program relocation and
must be removed with that fallback, not treated as a technical exception.
Pinned/public `select-scalar-child-native.py` / `.test.mjs` compare join
predicate, ORDER/LIMIT/OFFSET and Mem/Exists/Set values, names and two
reset/finalize cycles. The public differential failed with `unsupported
(OffsetLimit)` before this change; the structural ownership test still fails.

#### Bounded multi-source grouped child destination (card-t-b)

Pinned `select.c:sqlite3Select` GROUP BY feeds `selectInnerLoop`'s SRT_Mem,
SRT_Exists or SRT_Set in the same Parse as `expr.c:sqlite3CodeSubselect`.
`compileAggregateSelect` already allocates grouped multi-source cursors,
sorter and result registers from an optional enclosing builder. Its scalar
child caller previously restricted that shared-builder route to one source;
a bounded two-source grouped child instead reached completed-Program opcode
relocation (whose limited opcode vocabulary could reject it). That caller now
uses the existing builder and destination for supported multi-source groups.
Paired pinned/public `select-scalar-child-native.py` / `.test.mjs` cover an
inner join predicate, grouped count, HAVING, ORDER/LIMIT/OFFSET, empty groups,
LIMIT zero before OFFSET NULL, typed Mem/Exists/Set rows and two resets. This
is not general join or grouped ownership and the remaining fallback and
structural red check are not waived.

#### One-candidate no-FROM child ORDER ownership (card-t-b, bounded)

Pinned `resolve.c:resolveOrderGroupBy` maps a result alias/ordinal to the
result expression; `select.c:sqlite3Select` / `selectInnerLoop` sends one
qualifying candidate to `expr.c:sqlite3CodeSubselect`'s Mem/Exists/Set.
The parent-owned no-FROM child now accepts one ORDER key that resolves to
its sole result (alias, ordinal or equal expression). Sorting one candidate
cannot change destination delivery; WHERE rejection precedes delivery and
LIMIT/OFFSET retains its earlier guard. An independent or multiple ORDER key
remains unsupported rather than silently dropping expression errors. Paired
source-ID/public `select-scalar-child-native.py` / `.test.mjs` cover typed
scalar/EXISTS/IN alias and ordinal keys, descending key, WHERE false,
LIMIT/OFFSET, metadata and two resets. This adds no completed child Program,
but other child shapes still relocate one and the structural gate remains red.

#### One-source child LIMIT-zero setup (card-t-b, bounded)

Pinned `select.c:sqlite3Select` invokes `computeLimitRegisters` before
`sqlite3WhereBegin`, `selectInnerLoop` and its Mem/Exists/Set destination.
`computeLimitRegisters` emits the zero-count jump before generating OFFSET
coercion, even for a noncompound table child. The enclosing-builder
single-source child previously used the late-zero branch and raised a
`datatype mismatch` for `LIMIT 0 OFFSET NULL`. Its existing parent-owned
cursor/register and destination producer now consumes the shared primitive's
early-zero branch; false/NULL WHERE, ORDER and scan operations remain after
the guard. The same source ordering applies to bounded scalar, table,
aggregate, recursive and compound callers: the former
`compoundZeroBeforeOffset` switch and late-zero path were a translation
divergence, not a compound exception. Paired pinned/public
`select-scalar-child-native.py` / `.test.mjs` check aliased view child
scalar/EXISTS/IN and top-level no-FROM/table (including nested child)
LIMIT zero and OFFSET NULL, types, names and two resets. This does not remove
the completed-child fallback or establish untested cross-shape parity.

#### Zero-source child WHERE candidate (card-t-b, bounded)

Pinned `select.c:sqlite3Select` emits `computeLimitRegisters` before the
nonaggregate `sqlite3WhereBegin` / `selectInnerLoop` path. A zero-source WHERE
is a predicate of the one candidate, before `selectInnerLoop`'s OFFSET and
SRT_Mem/Exists/Set delivery. `expr.c:sqlite3CodeSubselect` initializes the
Mem/Exists destination and owns the IN set in the enclosing Parse/Vdbe.
The one-row child branch now compiles a WHERE predicate into its parent
builder and branches over candidate evaluation/insertion when false or NULL;
LIMIT remains initialized before WHERE, the IN probe remains after child
production. The one-candidate branch now uses the pinned
`computeLimitRegisters` integer-zero early exit *before* OFFSET coercion;
this is not applied to all SELECT routes. This is not a general no-FROM SELECT
WHERE compiler. Paired `select-scalar-child-native.py` / `.test.mjs` compare
typed NULL/INTEGER, names, scalar/EXISTS/IN, LIMIT 0/OFFSET NULL, and two
resets. The initial public test failed with datatype mismatch because the
TS no-FROM child computed OFFSET NULL before its LIMIT-zero branch; after
correcting the branch order it passes the pinned case. Remaining
completed-child relocation still fails the structural ownership assertion.

#### No-FROM child result DISTINCT (card-t-b, bounded)

Pinned `select.c:selectInnerLoop` applies result DISTINCT before OFFSET/SRT;
for the single-candidate no-FROM child there cannot be a duplicate. The
existing parent-owned one-row producer therefore admits DISTINCT without
opening a redundant ephemeral, preserving its LIMIT-zero guard, OFFSET and
Mem/Exists/Set emission. `expr.c:sqlite3CodeSubselect` keeps the destination
in the enclosing Vdbe. Pinned source-ID/public paired `select-scalar-child`
probes cover LIMIT 0/1, OFFSET 0/1, typed NULL/INTEGER, names and two resets.
Before this change its shape gate rejected DISTINCT at prepare. This does not
migrate remaining multi-row/compound/derived child production; the structural
reproducer is still red.

#### Direct one-table child result DISTINCT (card-t-b, bounded)

Pinned `select.c:sqlite3Select` opens result DISTINCT's ephemeral in the
same Parse and `selectInnerLoop` checks `Found`/`IdxInsert` before OFFSET;
`generateSortTail` applies OFFSET when sorting. `expr.c:sqlite3CodeSubselect`
keeps Mem/Exists/Set destinations in that Parse. The direct-column,
one-table child producer now admits result DISTINCT: it allocates a cursor
from the enclosing builder, reads the typed projected column once for the
DISTINCT key after WHERE, branches duplicates to Next without consuming
LIMIT/OFFSET, and retains its existing sorted drain and destinations.
Pinned source-ID/public `select-scalar-child-native.py` / `.test.mjs` pair
unsorted and descending-sorted duplicates, WHERE, LIMIT 0/1/2, OFFSET,
Mem/Exists/Set types, names and two reset/finalize cycles. Before migration
its completed-child relocation audit rejected OffsetLimit/OpenEphemeral/
Found/IdxInsert. This is not general expression projection or table-child
ownership; the structural reproducer remains red.

#### Direct one-table child OFFSET ownership (card-t-b, bounded)

Pinned `select.c:selectInnerLoop` invokes `codeOffset` (`OP_IfPos`, decrement
by 1) after a qualifying WHERE row but before projection when no sorter; the
sort tail applies OFFSET when ORDER BY is present. In `compileScalarSelect`'s
existing direct one-table child producer, `computeLimitRegisters` now owns
OFFSET in the enclosing builder: an `IfPos` skips qualifying rows before
Mem/Exists/Set emission and a sorter-drain `IfPos` skips sorted rows. Both
advance to the same Next/SorterNext transition without consuming LIMIT;
LIMIT 0 still exits before scanning. Pinned source-ID/public paired
`select-scalar-child-native.py` / `.test.mjs` cover unsorted WHERE + OFFSET,
single-key sorted OFFSET and LIMIT 0 OFFSET across Mem/Exists/Set, with typed
rows, names and two executions/reset/finalize. Previously the `!nested.offset`
caller gate sent these children to completed-Program relocation and rejected
`OffsetLimit`. This is only the direct one-table producer; other admitted
child producers still relocate Programs and the unfiltered structural test
remains red.

#### Aggregate-parent child cursor ownership (card-t-b, subsequent bounded attempt)
Pinned `expr.c:sqlite3CodeSubselect` and `select.c:sqlite3Select` compile a nested
SELECT into the enclosing Parse/Vdbe; `selectInnerLoop` consumes its destination
before the enclosing program is published. The aggregate-parent EXISTS, IN,
and scalar one-table child paths in `compileAggregateSubquery` now allocate
child cursors through the enclosing `SelectProgramBuilder` rather than starting
at an arbitrary cursor 1000. Until the aggregate parent's source/sorter/modifier
cursors are all allocated by the builder, `reserveCursorsThrough` advances the
builder over their fixed live range before the child compiles. This is a
transitional ownership boundary, not a claim that the child producer is shared
with the scalar-parent compiler. Paired pinned/public `select-scalar-child` tests
include an aggregate parent with simultaneous WHERE EXISTS and result IN child,
checking typed row, metadata, two executions and finalize. Scalar-parent
completed aggregate/table child Program relocation remains and the unfiltered
structural ownership test still fails; no compatibility claim follows.

#### No-GROUP aggregate result DISTINCT in enclosing child (card-t-b, bounded)

Pinned `src/select.c:sqlite3Select` opens result DISTINCT's ephemeral before
aggregate final output; `selectInnerLoop` checks `Found`/`IdxInsert` before
OFFSET and SRT destination. `expr.c:sqlite3CodeSubselect` provides Mem/Exists/Set
in the enclosing Vdbe. The one-source/no-ORDER aggregate shape now admits
result DISTINCT; the producer allocates its ephemeral through the parent
builder and checks its reserved output range after `AggFinal`/HAVING, before
OFFSET/SRT. A duplicate branches past emission. Pinned source-ID/public
`select-scalar-child-native.py` / `.test.mjs` compare LIMIT 0/1 OFFSET 1,
empty filtered count, typed rows/names and two reset/finalize cycles. This
is result DISTINCT, not `count(DISTINCT ...)` accumulator modification; other
child shapes still relocate completed Programs and the structural check remains
red.

### No-GROUP aggregate child LIMIT (partial SELECT ownership repair)

Pinned `src/select.c:computeLimitRegisters` gates the accumulator producer before
scan, while `selectInnerLoop` emits SRT_Mem/SRT_Exists/SRT_Set only for a produced
row; `src/expr.c:sqlite3CodeSubselect` initializes scalar/exists destinations
before invoking that producer. `compileAggregateSelect` previously excluded
no-GROUP aggregates with LIMIT/OFFSET at its shape gate. It now allocates the
limit registers before scan/steps, patches the zero branch to halt, and skips
one final row on a positive OFFSET. Paired pinned/public scalar, exists, and IN
aggregate-child probes in `select-scalar-child-native.py` / `.test.mjs` cover
LIMIT 0 and filtered empty inputs with typed rows, names and reset. This does
not migrate the completed child Program splice into the enclosing builder; the
structural ownership test remains red. It also does not establish general
aggregate LIMIT/parameter/cross-shape parity.

### Joined no-GROUP aggregate children (card-t-b, bounded subsequent producer)

Pinned `src/select.c:sqlite3Select` (no-GROUP branch around `sqlite3WhereBegin`,
`updateAccumulator`, `sqlite3WhereEnd`, `finalizeAggFunctions`) scans the joined
SrcList before final delivery via `selectInnerLoop`; `src/expr.c:sqlite3CodeSubselect`
initializes Mem/Exists/Set in the enclosing Vdbe. The parent-builder no-GROUP
aggregate route now allocates one cursor per source and nests Rewind/Next;
ON rejection advances its join depth, WHERE rejection advances the innermost
cursor, and finalization runs once even for empty input. This is the existing
aggregate accumulator producer rather than relocation of a completed child.
The paired pinned/public `select-scalar-child-native.py` / `.test.mjs` cases
exercise joined scalar/Exists/IN, empty groups, HAVING, LIMIT-zero OFFSET-NULL,
typed columns and two reset/finalize cycles. The newly added extended cases
were written after the producer change and do not demonstrate pre-migration
coverage. The structural ownership reproducer still fails: nonaggregate
multi-source and other child producers retain completed-Program relocation.
Do not remove that fallback until its admitted consumers share parent allocation.

### Joined child rowid seek in the interim producer (card-t-b, subsequent evidence)

The pre-migration pinned/public paired scalar/Exists/IN join probe with
`t1.a=3` exposed an admitted `wherecode.c` rowid-equality loop that the
completed-child fallback rejected at prepare (`SeekRowid`). In the interim
splice, `SeekRowid.p1` is a cursor, `key` a register and `p2` an exit
address; all three must be rebased, unlike `OffsetLimit`'s three register
operands. The paired case checks typed results, names and two reset/finalize
cycles; the ordinary joined predicate case checks the same destinations.
This is preservation of a formerly rejected path, **not** a parent-owned
joined producer. Pinned `src/select.c:sqlite3Select`/`selectInnerLoop` consumes
`wherecode.c`'s seek in the same Parse/Vdbe and emits SRT_Mem/Exists/Set;
`src/expr.c:sqlite3CodeSubselect` owns the caller destination. Next migration
must make `compileInnerTableSelect` allocate its source/index/sorter cursors and
result registers in the caller builder and deliver the destination at the
scan/sorter drain (including LIMIT/OFFSET and empty exits), then audit remaining
reachable fallback consumers before removing relocation. The new rowid-seek
probe is pre-migration evidence for that move, not general index parity.

### Nonflattenable ordered LIMIT producer, outer WHERE (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (19) forbids folding an
outer WHERE before a LIMIT-bearing producer. `selectInnerLoop` feeds the
producer sorter, and `generateSortTail` drains its bounded ORDER/LIMIT before
the caller tests outer WHERE and writes Mem/Exists/Set. The bounded one-table
single-result producer now reuses the enclosing builder's sorter and payload;
source ORDER AS-name/ordinal binds against the producer result before drain,
and the outer predicate reads the materialized result register (never a
cursor left after source scan). Sorted producer LIMIT uses a bounded top-N
capacity on insert and decrements on *every drained row*, including rows
rejected by outer WHERE. Source-ID-checked paired typed scalar/EXISTS/IN,
metadata and two resets pass with DESC LIMIT 2, alias ORDER, and a rejected
highest row. The pre-edit public preparation failed `no such table: d`;
during repair an unbounded sorter and a pre-sort outer predicate returned
incorrect rows, corrected at the owning scan/drain transitions. This slice
requires the consumer result to match one materialized producer expression;
a producer may project additional columns when its ORDER key is still
resolvable against the producer EList before the caller consumes that one
column. Paired source-ID/public `x AS a, x+1 AS b ORDER BY 2 DESC LIMIT 2`
cases cover both `d.a` and `d.b` with an outer filter, typed scalar/EXISTS/IN,
names and two resets. A follow-up source-ID-checked case selects `d.b`
while filtering on `d.a`: the producer scan now carries each required direct
column as a contiguous extra sorter payload register, and the sorted drain
binds the predicate to those registers before Mem/Exists/Set. This matches
`select.c:generateSortTail` keeping row data until the consumer and restriction
(19) keeping the outer predicate after producer LIMIT. Direct-column binding
of substituted reductions is limited to the single resolved producer source;
no host row evaluator or completed-Program relocation is introduced for this
path. The test compares typed 4/1/1, names and two resets; before this repair
preparation rejected `nested source expression binding is not implemented`.
The bounded sorter contract also applies when the derived consumer has no
outer predicate: `select.c:pushOntoSorter` bounds insertion by the producer's
LIMIT(+OFFSET), not by the presence of an outer WHERE. The one-table scalar
producer now supplies its existing `computeLimitRegisters` capacity to
`SorterInsert` on both filtered and unfiltered paths; Mem/Exists/Set still
consume the sorted drain in the enclosing Parse. Pinned/public `SELECT x FROM
t2 ORDER BY x DESC LIMIT 2` as scalar/EXISTS/IN returns typed 9/1/1,
metadata and two resets. This does not remove the live generic completed-child
fallback or establish general resource-limit parity.

`select.c:generateSortTail` applies producer OFFSET before the caller
predicate, while `expr.c:sqlite3CodeSubselect` caps Mem/Exists to the first
accepted row even when the producer's pre-existing LIMIT is greater than one
(and keeps the OFFSET). The bounded one-table ordered LIMIT producer now
admits OFFSET in the same shared sorter/drain path. At the sorted destination,
Mem/Exists exit after the first post-filter row independently of the producer
LIMIT counter; Set drains and decrements that counter. Source-ID-checked
native/public `x AS a, x+1 AS b ORDER BY 2 DESC LIMIT 2 OFFSET 1`
(and LIMIT 1 OFFSET 1) with an outer `d.a<9` compares typed 4/1/1,
metadata and two resets. The initial admission-only probe returned 2 instead
of native 4: Mem was overwriting its first accepted row with the next drain
row. Repairing that destination stop, rather than changing the predicate or
sort key, restores the caller's one-row contract. The generic completed-child
fallback remains live and the structural regression remains red.

An independent scalar expression in the admitted one-table producer's
projection, WHERE or ORDER BY is now compiled by its own `compileSubquery`
callback in the enclosing Parse/Vdbe rather than being rejected during
producer-column binding. `resolve.c` gives that expression its own
NameContext; the producer binder must not descend into its SELECT and
mistake nested columns for source columns. `expr.c:sqlite3ExprCodeTarget`
and `sqlite3CodeSubselect` own the nested destination, initialization and
once/reset behavior. Pinned-source-ID/public scalar/EXISTS/IN cases with
`ORDER BY (SELECT 1) DESC LIMIT 2` return typed 1/1/0, names and two resets.
This does not authorize arbitrary correlated expressions. The producer
binder now binds only the left expression of a nested IN to the producer's
NameContext, leaving the RHS SELECT to `expr.c:sqlite3CodeSubselect` and its
existing enclosing-builder callback. Pinned/public `x IN (SELECT 4)` with
outer Mem/Exists/Set returns typed NULL/0/0, names and two resets;
a complementary `x IN (SELECT 1)` producer returns typed 1/1/1,
preventing the all-empty outcome from masking a lost left binding. General
correlated RHS and transient source binding remain unestablished.
The completed-child fallback and structural regression remain open.

The same destination stop contract applies to the unsorted producer path:
`select.c:selectInnerLoop` decrements the producer LIMIT after result events,
while `expr.c:sqlite3CodeSubselect` caps Mem/Exists after their first accepted
outer row. Previously the non-sorter path with a post-producer predicate
continued writing Mem until producer LIMIT was exhausted; pinned/public
`x AS a, x+1 AS b LIMIT 3` with `d.a>0` exposed 4 instead of native 2.
The shared no-sort stop now exits Mem/Exists on the first accepted row;
rejected rows still advance and consume the producer LIMIT and Set continues
through the producer rows. Paired pinned/public LIMIT 3, LIMIT 3 OFFSET 1,
and LIMIT 1 OFFSET 1 compare typed scalar/EXISTS/IN (including a null/0/0
case), names and two resets. This repairs the bounded caller, not general
materialized transient sources.

This is not a full multi-column derived table: DISTINCT,
other producer shapes, general NameContext and limits/atomicity parity remain
open; the generic completed-child fallback is still live.

The sorted-drain predicate now also translates the `expr.c:TK_CASE` child
walk: the producer scan carries direct columns from WHEN/THEN/ELSE in its
sorter payload, and the drain replaces *each* occurrence with the matching
register before compiling the outer WHERE. Previously only collection walked
CASE, leaving a CASE child bound to the exhausted scan cursor. The pinned
source-ID/public paired `CASE WHEN d.a<9 THEN d.a ELSE 99 END<9` case over
`d.b` with DESC LIMIT 2 returns typed 4/1/1, names and two resets. This
repairs payload binding, not general CASE or a full transient table.

### Nonflattenable one-table LIMIT producer with outer WHERE (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (19) forbids moving a
LIMIT producer's outer WHERE into its scan: the producer must consume LIMIT
before the outer filter. `selectInnerLoop` applies producer WHERE, OFFSET,
then LIMIT to each produced row before outer WHERE and Mem/Exists/Set. The
bounded one-table no-ORDER/non-DISTINCT scalar/EXISTS/IN caller now keeps
producer and substituted outer predicates distinct while lowering into the
same enclosing builder; the producer's limit counter decrements even when
the outer predicate rejects its row. This is not general ephemeral/coroutine
materialization: it applies only when the transient expressions bind to one
ordinary table with an admitted one-column consumer. An expression result
`x+1 AS y FROM t2 LIMIT 1` followed by `d.y>2` failed public prepare
(`no such table: d`) before the repair; source-ID-checked native/public
scalar NULL, EXISTS 0, IN 0, metadata and two resets pass after. Producer
ORDER, DISTINCT, multirow outer consumers, and general NameContext remain
unmigrated. No independent evaluator or child Program is invoked.

### COLLATE-wrapped producer ORDER references (card-t-b, 2026-09-29)

Pinned `src/resolve.c:resolveOrderGroupBy` uses
`sqlite3ExprSkipCollateAndLikely` to bind AS-names and integer ordinals
through explicit COLLATE, then `sqlite3ResolveOrderGroupBy` replaces the
underlying reference with its producer result expression while preserving
the outer collation. The bounded `src/select.c:flattenSubquery` ORDER
transfer now follows this order: unwrap COLLATE for producer EList binding,
replace the referenced reduction, and preserve the COLLATE carrier before
the enclosing parent's sorter consumes it. Before repair, `x+1 AS y ORDER
BY y COLLATE BINARY DESC LIMIT 1` returned public 4 versus pinned 10 and
`ORDER BY 1 COLLATE BINARY` returned public 2 versus pinned 10. Paired
source-ID-checked native/public typed rows, names and two resets pass. This
does not establish general ORDER NameContext or nonflattenable materialization.

### Producer ORDER ordinal before flatten transfer (card-t-b, 2026-09-29)

Pinned `src/resolve.c:resolveOrderGroupBy` resolves integer ordinals against
producer EList width before `src/select.c:flattenSubquery` moves the ORDER
list to its parent. The bounded transfer formerly passed `ORDER BY 2` from
a two-column producer to a one-column parent, failing with a 1..1 error.
It now checks producer width and replaces an admitted ordinal with its
producer result expression before parent substitution/sorter compilation.
Paired source-ID-checked native/public `x AS a, x+1 AS b ORDER BY 2` and
`ORDER BY b` typed rows, metadata and resets pass; native/public `ORDER BY
3` against width two rejects at prepare with the pinned diagnostic. This
is not general multi-column derived materialization.

### Producer ORDER AS-name before flatten transfer (card-t-b, 2026-09-29)

Pinned `src/resolve.c:resolveOrderGroupBy` binds producer ORDER AS-names to
its EList before `src/select.c:flattenSubquery` transfers ORDER to the parent
and clears `iOrderByCol`. Previously `SELECT d.y FROM (SELECT x+1 AS y FROM
t2 ORDER BY y DESC LIMIT 1) d` returned 4 instead of pinned 10: the
transferred `y` was not bound to producer `x+1`. The bounded transfer now
resolves producer AS-names against producer result expressions before parent
substitution; the parent sorter then compares the translated result
expression. Source-ID-checked native/public paired alias and ordinal,
rows/types/names and two resets pass. General ORDER NameContext or
multi-column parent projections are not established.

### Source-permitted nonzero-source derived LIMIT transfer (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restrictions (13), (14), (19)
forbid producer LIMIT with parent LIMIT, producer OFFSET, or parent WHERE,
respectively. When none applies, its transfer moves producer LIMIT onto the
parent before `selectInnerLoop` and sorter drain. The bounded one-table
scalar/EXISTS/IN caller now transfers LIMIT together with producer ORDER
into its enclosing-builder scan/destination. Source-ID-checked paired native
and public rows, types, names and two resets pass for LIMIT 0/1 and ORDER
plus LIMIT 1/2; the pre-edit public probe failed `no such table: d`.
This does not flatten a producer LIMIT past an outer WHERE or replace
nonflattenable multirow materialization; that remains a live gap.

### Nonzero-source derived ORDER transfer (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restrictions (7), (11), (19)
permit a single-source, nonaggregate, non-DISTINCT producer with ORDER and
without LIMIT to flatten into an unordered parent. The transfer zeroes the
producer's result-list order references and installs its ORDER list on the
parent; `selectInnerLoop` then feeds the parent's sorter and Mem/Exists/Set.
The bounded caller now carries that producer ORDER into the substituted
single-source SELECT and recursively compiles it through the enclosing
builder's already translated scan/sorter path. An outer ORDER still blocks
this transfer. Paired source-ID-checked native/public scalar/EXISTS/IN rows,
metadata and two resets pass for the ordered one-table producer; the first
public probe failed `no such table: d`. No claim is made for LIMIT-bearing
producer materialization or general CTE/derived multirow ownership.

### ORDER term resolution for no-FROM derived producer (card-t-b, 2026-09-29)

Pinned `src/resolve.c:resolveOrderGroupBy` resolves producer ORDER terms
against the producer result list: explicit AS-name first, integer ordinal
second (with prepare-time range error), then ordinary NameContext expression.
The bounded singleton producer now maps alias and ordinal to its transient
result registers before evaluating its ORDER keys; out-of-range ordinals
reject before publishing a statement with pinned message. The prior
literal-as-value treatment passed a singleton row by coincidence and did
not represent the resolver contract. Paired source-ID-checked native/public
alias/ordinal typed rows and two resets, plus native error/public atomicity
cases for 0 and 3 against width 2 pass. This does not establish general
multirow ORDER or all NameContext error behavior.

### ORDER no-FROM derived producer (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (7) retains the producer;
`selectInnerLoop` loads its result row and `pushOntoSorter` computes ORDER
keys before sorter LIMIT/OFFSET and the outer row consumer. For a no-FROM
producer at most one row reaches the sorter: key comparisons and a multirow
drain cannot occur. The bounded caller now binds ORDER keys to producer
result registers, evaluates them once after the candidate result and before
producer OFFSET, then consumes the same transient row through outer WHERE,
OFFSET and Mem/Exists/Set. This is a singleton register representation of
the C sorter; multirow ORDER still requires its actual sorter and drain.
Paired source-ID-checked native/public typed scalar/EXISTS/IN rows,
absent candidates, names and two resets pass. General derived/CTE ORDER
and generic relocation remain open.

### DISTINCT no-FROM derived producer (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (7) retains this
producer; `sqlite3Select` plans DISTINCT with `sqlite3WhereBegin` and
`selectInnerLoop` consults the resulting DISTINCT mode before emitting its
row. With no FROM, WHERE/LIMIT/OFFSET can admit at most one candidate;
DISTINCT cannot suppress that candidate. The bounded producer/caller now
accepts DISTINCT, fills its transient result registers once per admitted row
and consumes the outer Mem/Exists/Set as before without a redundant dedup
cursor. This is not a general DISTINCT substitution: multirow producers
still require upstream dedup planning. Paired source-ID-checked native/public
typed scalar/EXISTS/IN rows, absent candidates, names and two resets pass.
ORDER and general derived/CTE, and generic relocation remain open.

### Multi-column no-FROM derived producer row (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (7) retains a no-FROM
producer even when it exposes multiple columns; `selectInnerLoop` populates
producer result registers before the outer WHERE, result and destination.
`src/resolve.c:resolveExprStep` binds the transient source names, and
`src/expr.c:sqlite3CodeSubselect` retains Mem/Exists/Set in one Parse.
The previous one-column branch fell through to `no such table: d` for
`SELECT d.b FROM (SELECT 7 a, 8 b LIMIT 1) d`. The bounded branch now
allocates producer result registers through the enclosing builder, evaluates
each producer expression once on an admitted row, binds outer result and
WHERE column references to those registers, and emits the outer destination
only after its predicate and OFFSET. Paired source-ID-checked native/public
scalar/EXISTS/IN typed rows/names, absent producers, expression over two
columns and two resets pass. General derived/CTE relations, independent
ORDER and generic completed-child relocation remain open. This is register
binding in lieu of C's ephemeral row cursor for a one-row no-FROM producer;
producer row values and ordering are retained, not a general alternative
materializer.

### Outer expression on zero-source derived column child (card-t-b, 2026-09-29)

Pinned `src/resolve.c:resolveExprStep` binds column references throughout
an outer result expression in its NameContext; `src/select.c:flattenSubquery`
restriction (7) retains the no-FROM producer, whose `selectInnerLoop` row
event precedes outer result evaluation and destination. The previously
bounded branch admitted only a direct derived-column projection and fell
through to `no such table: d` for `d.n+1`. Its caller now substitutes the
transient producer reduction throughout the outer result expression and
lowers that result after producer and outer WHERE/OFFSET gates into the same
Mem/Exists/Set. An unresolved column is rejected before emitting operations;
this is not general derived materialization. Paired source-ID-checked
native/public scalar/EXISTS/IN value, absent producer, typed names/rows and
reset pass. Independent ORDER and wider producer shapes, as well as live
generic completed-child relocation, remain unresolved.

### Outer WHERE on zero-source derived column child (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (7) retains the
no-FROM producer; `selectInnerLoop` gates its result event before the outer
SELECT evaluates WHERE. `src/resolve.c:resolveExprStep` binds the outer
qualified column in its NameContext to the transient producer column;
`src/expr.c:sqlite3CodeSubselect` consumes Mem/Exists/Set in one Parse.
The bounded child previously rejected an outer predicate and attempted to
resolve the derived alias as a physical table. Its caller now substitutes the
transient column in the outer WHERE reduction and emits its predicate after
producer suppression, before outer OFFSET and destination. Source-ID-checked
native/public scalar/EXISTS/IN cases cover matched/rejected and absent
producer candidates, typed names/rows and reset. Independent outer ORDER and
wider derived producers remain outside this branch; completed-child relocation
and its global structural assertion remain red.

### Nested outer LIMIT on zero-source derived column child (card-t-b, 2026-09-29)

Pinned `src/select.c:sqlite3Select` initializes each SELECT's LIMIT before
entering its source; `selectInnerLoop` applies OFFSET to each SELECT's own row
event, and `src/expr.c:sqlite3CodeSubselect` calls the outer SELECT using the
same Parse/Vdbe destination. The bounded no-FROM derived-column producer
already emits its inner candidate, but the outer LIMIT/OFFSET previously
fell through to a physical-table lookup (`no such table: d`). Its caller now
allocates outer LIMIT before producer LIMIT, gates producer absence first,
and applies outer OFFSET before emitting Mem/Exists/Set; both zero-limit jumps
leave destination defaults intact. Paired source-ID-checked native/public
scalar/EXISTS/IN cases cover inner and outer skipped candidates, names/types
and two resets. Independent outer WHERE/ORDER and general derived materialization
remain unimplemented; the global completed-child relocation assertion is red.

### Nonflattenable zero-source derived column child (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (7) retains a FROM
producer with no source; `selectInnerLoop` only supplies a row to the outer
SELECT after its WHERE/LIMIT/OFFSET, while `src/expr.c:sqlite3CodeSubselect`
allocates Mem/Exists/Set in the enclosing Parse. The scalar child previously
fell through physical-table resolution (`no such table: d`) rather than
feeding its derived column into the destination. A bounded single-result,
no-source producer now emits WHERE/OFFSET, its value and the outer
Mem/Exists/Set in the enclosing builder, then probes IN after the Once
boundary. A direct derived-column projection alone is admitted; independent
outer WHERE/ORDER/LIMIT, producer compound/window/aggregate and wider derived
relations remain outside this branch. Paired source-ID-checked native/public
value, empty candidate, producer LIMIT/OFFSET, typed metadata and two resets
pass. This does not remove the generic completed-child fallback; its live
consumers still require migrations.

### Nonflattenable zero-source derived count child (card-t-b, 2026-09-29)

Pinned `src/select.c:flattenSubquery` restriction (7) leaves a FROM subselect
with no source unflattened. Its one-row `selectInnerLoop` result event feeds
the enclosing count accumulator even when WHERE, LIMIT or OFFSET suppresses
that event; `src/expr.c:sqlite3CodeSubselect` keeps Mem/Exists/Set in the same
Parse/Vdbe. The existing top-level `compileZeroSourceDerivedCount` built a
complete scalar producer and rewrote its ResultRow/Halt into AggStep/branches.
Passing the parent builder/destination into this bounded producer now emits
the zero-source WHERE/OFFSET and result event into that builder, finalizes
count even with no event, then emits the caller's destination. Source-ID-checked
native/public cases cover one/zero candidate, producer LIMIT/OFFSET,
Mem/Exists/Set, names/types, and two resets. Top-level compatibility bridge
remains until its callers migrate; this is only count(*) cardinality, not a
new derived-column producer. The reachable generic finished-child fallback
and global structural failure remain.

### Single-row aggregate ORDER admission (card-t-b, 2026-09-29)

Pinned `src/expr.c:sqlite3CodeSubselect` initializes SRT_Mem/Exists/Set and
calls `sqlite3Select` within the same Parse; `src/select.c:sqlite3Select`
finalizes the ungrouped accumulator once before its destination and LIMIT
exit. The TS producer already shares that builder/destination and implements
LIMIT/OFFSET and empty-input finalization, but `aggregateShapeSupported`
rejected even `ORDER BY count(*) DESC` / `ORDER BY` its result alias. A
single ungrouped result row needs no sorter. Admit only ORDER terms bound to
a projected result in `simpleUngroupedAggregateOrder`, retaining existing
window/compound and independent ORDER-expression exclusions. Source-ID-checked
native/public scalar, EXISTS and IN probes cover count, empty source,
LIMIT/OFFSET, typed values, names and two resets. This is not general aggregate
ORDER parity or completion of expression-child ownership; nonflattenable
sources and the completed-child fallback still require producer/caller work.

### Ordered grouped child key ownership (card-t-b, 2026-09-29)

After simple derived/view flattening, `GROUP BY d.x ORDER BY d.x DESC`
retains an ORDER expression that is not a projected aggregate result. The
previous `aggregateShapeSupported` gate rejected it even though the grouped
producer already has a result sorter and SRT destination drain. Pinned
`src/select.c:sqlite3Select` sorts after group finalization, using the group
key even when it is not in the result list; `src/expr.c:sqlite3CodeSubselect`
keeps Mem/Exists/Set in the enclosing Parse/Vdbe. The resolver/aggregate
producer now admits a bound GROUP-key identity as an ORDER key and copies its
saved group register into the result-sorter key range, alongside projected
ORDER results. HAVING rejection, DISTINCT, LIMIT/OFFSET and destination
emission remain at the existing group/sorter drain. Paired source-ID-checked
native/public cases cover derived/view grouped aggregate ordering, descending
keys not in the result, LIMIT/OFFSET, empty and two reset/finalize cycles.
This does not admit arbitrary ORDER expressions, nonflattenable producers or
all grouped plans. The finished-child fallback and global structural failure
remain live.

### Flattenable grouped derived/view child checkpoint (card-t-b, 2026-09-29)

The grouped-child destination call now also admits a simple flattenable
single-source derived table or immutable view. Pinned `src/select.c:flattenSubquery`
substitutes producer expressions before `sqlite3Select` drives the grouped
accumulator, and `src/expr.c:sqlite3CodeSubselect` keeps SRT_Mem/Exists/Set in
its enclosing Parse/Vdbe. `compileAggregateSelect` already passes the parent
builder and destination through both flattening recursions; its scalar caller
now uses that path rather than the finished-child splice. New source-ID-checked
pinned/native and public paired cases cover derived empty/HAVING/LIMIT/OFFSET,
view grouping, typed rows/names and two reset/finalize cycles. The oracle's
`ORDER BY d.x DESC` and `ORDER BY count(*) DESC` candidates initially exposed
an `aggregateShapeSupported` admission limit after flattening. This revision
moves group-key identity and aggregate-result ordering into the grouped
producer's result sorter (see checkpoint above), not arbitrary ORDER
expressions. Nonflattenable derived/CTE and remaining fallback consumers
still need migration; the global structural assertion remains red.

### Grouped scalar child destination checkpoint (card-t-b, 2026-09-29)

Pinned `src/expr.c:sqlite3CodeSubselect` passes SRT_Mem/Exists/Set to
`src/select.c:sqlite3Select` within the same Parse/Vdbe; grouped rows are
emitted after group-boundary/final accumulator handling, including HAVING,
DISTINCT, sorter drain, LIMIT and OFFSET exits. The bounded physical-table
GROUP BY scalar/EXISTS/IN caller now passes its builder and destination to
`compileAggregateSelect` rather than relocating its finished program. The
producer already shares registers/cursors and emits destinations at both group
and sorted drain. The existing paired pinned/public grouped cases exercise
empty groups, offsets, DISTINCT and HAVING, typed rows/names and two reset
cycles; this does not establish derived/view or all grouped shape ownership.
The completed-child relocation remains live for those and other reachable
plans; the full structural assertion remains red. No new execution algorithm
was substituted.

### Joined nonaggregate child builder checkpoint (card-t-b, 2026-09-29)

Pinned `src/select.c:sqlite3Select` / `selectInnerLoop` and
`src/expr.c:sqlite3CodeSubselect` keep the joined WHERE loop and SRT_Mem,
SRT_Exists or SRT_Set in one Parse/Vdbe. `compileScalarSelect` now passes its
shared builder, parameters and destination to `compileInnerTableSelect` for
nonaggregate multi-source children. The producer reserves a contiguous result
range, source/index/sorter cursors and temporary registers in that builder,
including the sorter drain, and patches its own LIMIT and first-row exits to
the enclosing continuation rather than emitting Halt. `expandAndResolveSelect`
uses the builder cursor base so resolved column cursor IDs stay intact. This
reuses the existing nested join/WHERE/index producer rather than a second
SQL-text evaluator. The pre-migration paired native/public joined rowid-seek
and non-seek cases check typed rows, metadata and reset/finalize twice. This
is **not** complete SELECT ownership: the remaining completed-child splice for
nonflattenable derived/aggregate or other reachable plans still needs a
consumer audit and migration, and the full scalar-child structural test is red.
No broad index or encoding parity is inferred.

### Correlated IN in a one-table scalar producer (card-t-b, 2026-09-29)

Pinned `src/resolve.c:lookupName` increments the inner NameContext reference
when a nested SELECT resolves a column from its parent; `resolveExprStep`
marks the expression `EP_VarSelect`. `src/expr.c:sqlite3CodeSubselect` emits
`OP_Once` only when this flag is absent. For the bounded no-FROM RHS of an
IN predicate inside the one-table scalar producer, `expandAndResolveSelect`
records the RHS column-use owner and `compileScalarSelect` now carries its
cursor, index, affinity and collation into RHS expression lowering. The RHS
set is built at the predicate's position in the producer scan, not hoisted
into a once-per-statement child. This fixes the pinned-source-ID/public
`x IN (SELECT x)` scalar/EXISTS/IN discriminator (typed 9/1/0, metadata and
two resets); the previous public result was 3/0/0. Only immediate references
to the physical producer source in this bounded RHS are bound here; other
correlation depths and transient-source references still require their owning
NameContext lowering. The generic completed-child relocation and its structural
test remain red; this checkpoint is not complete SELECT compiler ownership.

#### Correlated no-FROM RHS WHERE owner (card-t-b, follow-up)

The earlier correlated `x IN (SELECT x)` probe only exercised the nested
result expression. A source-ID-checked pinned 3.53.4 probe with
`x IN (SELECT x WHERE x>1)` in a one-table scalar producer discriminates
WHERE ownership: scalar/EXISTS/IN returns typed 9/1/0; before this repair the
public result was 9/1/1. Pinned `src/resolve.c:lookupName` attributes both
nested result and WHERE columns to the immediate outer NameContext;
`src/expr.c:sqlite3CodeSubselect` enters the correlated producer at each
predicate evaluation, and `src/select.c:sqlite3Select` tests WHERE before
SRT_Set. `compileScalarSelect` now binds the no-FROM child WHERE using the
same resolved column-use map as its result, before compiling the predicate
for both SRT_Set and Mem/Exists. Literal/independent RHSs do not gain an outer
cursor. This does not implement general correlated subqueries, arbitrary
nested expression forms or remove the completed-child relocation fallback.

### Correlated no-FROM function arguments (bounded SELECT child)

Pinned `src/resolve.c:lookupName` resolves column uses beneath function
arguments against the enclosing NameContext; `sqlite3ResolveExprNames` walks
function expression lists. `src/expr.c:sqlite3ExprCodeTarget` codes those
arguments before the call, while `src/select.c:sqlite3Select` evaluates the
no-FROM RHS WHERE before its Set/Mem destination. In the admitted one-table
producer, `compileScalarSelect` now carries resolved column ownership through
`exprlist` argument reductions for both no-FROM child projection and WHERE,
not just direct columns/unary/binary expressions. This preserves the native
`x IN (SELECT abs(x) WHERE abs(x)>1)` scalar/EXISTS/IN typed 9/1/0 and
metadata across two resets (paired `select-scalar-child` harnesses). It does
not establish arbitrary correlated trees/depths or eliminate the remaining
completed-child relocation in another reachable shape.

### One-source scalar scan destination (bounded follow-up, card-t-b)

In pinned `src/expr.c:sqlite3CodeSubselect`, Mem/Exists/Set calls
`sqlite3Select` with the *enclosing* Parse and Vdbe. Pinned
`src/select.c:selectInnerLoop` loads the producer result and sends it to that
SRT destination, including on sorter drain; it does not compile a completed
child Program and renumber its control graph. `src/resolve.c:lookupName` owns
result and ORDER references before coding; `src/vdbeaux.c:sqlite3VdbeAddOp3`
appends into the same Vdbe. When the bespoke one-source scalar fast path
cannot consume an ORDER/result expression, the nonaggregate one-source guard
now passes the resolved producer to `compileInnerTableSelect` with the parent
`SelectProgramBuilder` and Mem/Exists/Set destination (previously only joins
used that path). The paired source-ID-checked native/public
`select-scalar-child-native.py` / `.test.mjs` include two-key ORDER, LIMIT 0,
OFFSET and typed Mem/Exists/Set values, names and resets. This is a guard
expansion, **not** completion of the compiler: the completed-child relocation
fallback remains reachable for other shapes, and broader one-source coverage,
unsupported atomicity and cross-encoding parity are not established by these
cases. Do not delete the fallback without migrating those consumers.

Grouped LEFT JOIN scalar producer (bounded card-t-b repair): pinned
`src/select.c:sqlite3Select` GROUP BY sorter receives rows from
`src/where.c:sqlite3WhereBegin`/`src/wherecode.c:sqlite3WhereEnd`, including
one NULL-extended row for an unmatched right source; `src/expr.c:sqlite3CodeSubselect`
retains the enclosing SRT_Mem/Exists/Set destination. The grouped accumulator
in `src/internal/vdbe.ts:compileAggregateSelect` now tracks right-side matches
before ON rejection, re-enters the row body with `NullRow` exactly once after
exhausting right matches, and routes an empty right scan to that transition.
The simple-group admission no longer rejects LEFT solely by join kind. This
uses the same sorter and destination as inner-join groups, not a relocated
child Program. Source-ID-checked native/public `select-scalar-child` cases
exercise matched and unmatched groups, ORDER/LIMIT, typed Mem/Exists/Set,
metadata and two iterations. RIGHT/FULL/USING grouped joins remain excluded;
other grouped correlations and general compiler fallback migration are not
proven by this slice.

Revision (grouped LEFT, card-t-b): a `count(*)` unmatched row cannot detect
re-entering the ON predicate on the synthetic NULL row. Pinned
`src/wherecode.c:sqlite3WhereEnd` jumps to the loop body *after* ON when
`NullRow` supplies the unmatched row; `src/select.c:sqlite3Select` then feeds
that row to GROUP BY, with post-join WHERE evaluated on the NULL extension.
The grouped scan now saves an after-ON label for each source and sends its
synthetic row there instead of back to the physical cursor body. Paired
source-ID-checked `count(t2.x)` / `WHERE t2.x IS NULL` and ON-rejection
cases verify typed 0/1, Set membership, names and reset. This fixes the
semantic producer, not the still-live completed-child relocation fallback.

Revision (card-t-b, grouped ORDER expressions): `src/select.c:sqlite3Select`
analyses both the result list and `sSort.pOrderBy` with the same AggInfo,
then `selectInnerLoop`/`generateSortTail` sort finalized groups before the
SRT_Mem/Exists/Set destination. `src/resolve.c:sqlite3ResolveOrderGroupBy`
substitutes result ordinals/aliases, but an unmatched ORDER expression remains
independently resolved. The grouped builder now lowers those expressions
before AggStep, maps their source columns to saved group payload, and computes
sort keys at group emission; previously its admission predicate required an
ORDER term to match only the result or a group key. This is ordinary compiler
lowering, not an exceptional algorithm substitution. Paired source-ID-checked
`count(*)+1`, `x+1`, and ORDER-only `sum(y)` cases cover typed scalar,
EXISTS/IN, LIMIT/OFFSET and reset. Completed child relocation still exists
for other producers; these checks do not establish general ORDER parity.

### Unordered table-backed UNION ALL IN producer (bounded card-t-b)

Pinned `src/select.c:multiSelect` TK_ALL without ORDER BY calls
`sqlite3Select(pParse,pPrior,&dest)` then `sqlite3Select(pParse,p,&dest)`;
`src/expr.c:sqlite3CodeSubselect` provides SRT_Set, and
`selectInnerLoop` inserts each arm's value into that destination. For
unlimited unordered nonaggregate table-backed IN arms, `compileScalarSelect`
now passes each arm to `compileInnerTableSelect` with one enclosing builder,
parameter owner and Set cursor, rather than compiling a child Program and
relocating its graph. A single Once owns the set fill, followed by the left
operand's `InSet`; the browser-safe ephemeral KeyInfo/Mem encoding retains
NULL and affinity comparison. The paired source-ID-checked
`select-scalar-child-native.py` / `.test.mjs` checks typed hit/miss, names,
and two iterations. This is not a general compound lowering: set operators,
ORDER, shared LIMIT/OFFSET, VALUES, aggregate/window arms and scalar/EXISTS
compound consumers remain outside this branch. The generic completed-child
relocation still exists and the structural guard remains red.

Follow-up (card-t-b, scalar/EXISTS compound destinations): pinned
`select.c:multiSelect` forwards the same SRT destination to left then right;
`selectInnerLoop` SRT_Mem/Exists records only the first accepted row, including
NULL, and later arms must not replace it. For the same unordered unlimited
nonaggregate table-backed UNION ALL producer, `compileInnerTableSelect` now
consumes the parent Mem/Exists destination per arm. Mem's separate `found`
register, set only by `emitSelectDestination`, distinguishes a NULL result
from no result; checking the value register's nullness would incorrectly run
the next arm. `IfPos` skips subsequent arms after the first accepted result,
while Set still drains every arm. Paired source-ID-checked public tests cover
first/empty-left/no-rows and NULL-first typed rows, names and reset. This
branch still excludes ordered/limited compounds and other compound operators;
the completed-child fallback and its structural test remain red.

Follow-up (card-t-b, mixed no-FROM UNION ALL arm): pinned
`src/select.c:multiSelect` TK_ALL calls `sqlite3Select` for consecutive arms
with the same destination, whether an arm has a table SrcList or no FROM;
`selectInnerLoop` emits a no-FROM arm's single candidate through that
destination. The unordered, unlimited nonaggregate table-backed compound
branch now admits a simple no-FROM arm interspersed with table-backed arms:
`compileExpressionTree` emits its row directly into the enclosing
Mem/Exists/Set destination, preserving the Mem found flag across arms.
Source-ID-checked paired public cases cover empty/nonempty first table,
no-FROM RHS, Set membership and a NULL middle arm with two iterations.
This does not admit no-FROM WHERE or independent ORDER/LIMIT, nor remove the
generic completed-child fallback. The no-FROM mixed branch has not been shown
to cover every compound producer.

Follow-up (card-t-b, left no-FROM/right table arm): two earlier scalar
classification guards inspected only the rightmost `SelectNode.from`, which
is empty for `SELECT 7 UNION ALL SELECT x FROM t2`. Pinned
`src/select.c:multiSelect` instead walks the arm chain, forwarding one
SelectDest and executing the left arm before the right. `compileSubquery`
now restricts the constant/VALUES compound producer to **all** no-FROM arms,
and restricts the simple no-FROM child to no-FROM arms throughout. The mixed
arm path then receives left no-FROM plus table RHS without splicing a child
Program. Paired pinned source-ID/public typed first/NULL-first Mem, Exists and
Set cases with metadata and two iterations test this decision. Still neither
general compound ownership nor completion of the generic fallback.

Follow-up (card-t-b, mixed compound no-FROM WHERE): `src/select.c:multiSelect`
forwards one destination to both TK_ALL arms; `sqlite3Select` enters
`sqlite3WhereBegin` before its inner result loop. Pinned `src/where.c`'s
constant-term path (`sqlite3ExprIfFalse` to `iBreak`) rejects the no-FROM
candidate **before** coding/emitting its projection. The existing shared
compound builder now admits a no-FROM arm with a represented WHERE, lowers the
predicate in that arm's binding context before its projection, and patches the
false/NULL exit past destination emission. Earlier arms still stop Mem/Exists
on the first accepted row, including NULL; Set drains all arms. Paired
source-ID/public 7 WHERE 0 and NULL WHERE 1 with table RHS cover typed
Mem/Exists/Set, names and reset. Independent ORDER/LIMIT and general compounds
are not admitted; completed-child fallback remains and structural guard is red.

Follow-up (card-t-b, all-no-FROM WHERE compound): source-ID-checked
`SELECT 7 WHERE 0 UNION ALL SELECT 3 WHERE 1` and NULL-first variants exposed
an earlier caller classification gate, not a destination defect. The
all-constant compound path rejects WHERE, then the simple no-FROM guard
intercepts any all-no-FROM compound and throws before the enclosing mixed
arm builder is reached. For an unordered, unlimited TK_ALL child with a
represented arm WHERE, defer to the already shared builder, even when neither
arm has a table. `src/select.c:multiSelect` invokes `sqlite3Select` on both
arms with the same `SelectDest`; `src/where.c:sqlite3WhereBegin` guards the
no-FROM candidate before result production, while `src/expr.c:sqlite3CodeSubselect`
consumes Mem/Exists/Set. This change leaves no-WHERE constant compounds on
their existing branch and keeps ordered/limited/set-operator cases gated.
Paired native/public typed 3/1/1 and NULL/1/1, names and reset pass; generic
completed-child relocation is still unresolved.

### Independent ORDER aggregate in an ungrouped scalar child (card-t-b)

The completed-child fallback was reachable for `count(*) FROM t2 ORDER BY
sum(x)` but its aggregate shape gate rejected the child before relocation.
Pinned `src/select.c:sqlite3Select` (ungrouped aggregate path, tag-select-0820)
uses one accumulator row; `src/resolve.c:resolveOrderGroupBy` resolves ORDER
expressions independently of result columns, and `src/expr.c:sqlite3CodeSubselect`
consumes Mem/Exists/Set in the same VDBE. The ungrouped producer now lowers
independent ORDER expressions before stepping so ORDER-only aggregates own
registers; bare columns in those expressions use the first accepted row's
saved registers. There is no sorter for the single ungrouped result row. This
is not a generic compound/window/order translation. The generic completed-
child splice remains and the structural test is red. The source-ID-checked
public differential case in `select-scalar-child.test.mjs` checks typed
count/EXISTS/IN and LIMIT 0 plus metadata, two resets and finalize against
pinned 3.53.4. The first attempt extended ORDER lowering without removing
an obsolete `:[]` branch and failed syntax checking; after correcting that,
TS checking passed and focused public tests passed 19/20 (structural failure).

### Zero-source aggregate expression destination (card-t-b, bounded repair)

`src/select.c:sqlite3Select` tag-select-0820 initializes/finalizes an ungrouped
accumulator once even with no FROM; `src/where.c:sqlite3WhereBegin` tests the
sole candidate before `updateAccumulator`, so false WHERE yields `count(*)=0`
but does not remove its output row. `src/expr.c:sqlite3CodeSubselect` sends the
result to Mem/Exists/Set in the enclosing VDBE. The scalar child dispatcher
now delegates admitted unordered, ungrouped zero-source aggregates to
`compileAggregateSelect` with its parent builder/destination *before* the
ordinary no-FROM expression lowering, which cannot evaluate aggregate calls.
Shared Once, register, cursor, and LIMIT handling remain in the aggregate
producer. The independent pinned native/public differential checks count,
false-WHERE count, sum, LIMIT 0, typed cells, metadata, reset and finalize.
Ordered/grouped/compound variants were not newly admitted in that slice. Completed-
child relocation is still present and its structural regression still fails.

### Zero-source aggregate HAVING destination (card-t-b follow-up)

Pinned `src/select.c:sqlite3Select` tag-select-0820 emits `WhereBegin`,
`updateAccumulator`, `WhereEnd`, `finalizeAggFunctions`, then checks HAVING
before `selectInnerLoop`; `src/expr.c:sqlite3CodeSubselect` uses the enclosing
Mem/Exists/Set. The preceding no-FROM aggregate repair mistakenly left a
`hasHaving` admission exclusion even though the aggregate producer already
lowers HAVING after `AggFinal` and before its destination/limit publication.
Removing that exclusion, not evaluating HAVING in the scalar walker, allows
false-WHERE count, false-HAVING null Mem/zero Exists and LIMIT 0 through the
same parent builder. Source-ID-checked native typed cases are exercised twice
through public `select-scalar-child.test.mjs` with names/reset/finalize.
This remains a bounded ungrouped unordered noncompound slice; relocation and
its structural test remain red.

### Zero-source independent aggregate ORDER (card-t-b follow-up)

The previous parent entry still blocked all ORDER BY clauses on no-FROM
aggregate expression children, even though `compileAggregateSelect` already
resolves independent ORDER expressions and adds their aggregate registers
before AggStep. Pinned `src/select.c:sqlite3Select` tag-select-0820 emits one
ungrouped accumulator row, not a result sorter; `src/resolve.c:resolveSelectStep`
resolves ORDER ordinals/names and `src/expr.c:sqlite3CodeSubselect` consumes
the Mem/Exists/Set output in the parent VDBE. The entry now admits ORDER for
this same noncompound ungrouped aggregate slice; independent ORDER-only sum
and count, WHERE rejection, HAVING and LIMIT 0 were paired with the pinned
native source ID and public typed names/reset/finalize. Out-of-range ORDER
ordinals still resolve as errors, not ignored keys. This does not admit
nonaggregate independent no-FROM ORDER or migrate the generic completed-child
fallback; the structural test remains red.

### Independent ORDER keys on zero-source nonaggregate expression children (card-t-b)

Pinned `src/resolve.c:resolveSelectStep` resolves **every** ORDER term after
result resolution, including ordinal range and unknown-name errors, before
`src/select.c:sqlite3Select` enters its zero-source WhereBegin and
`selectInnerLoop` destination. In a one-candidate no-FROM producer, a resolved
independent ORDER expression cannot change row order; the earlier scalar
routing gate incorrectly required one ORDER key matching the result. The
bounded no-FROM scalar child now invokes the shared resolver on the full child
before emitting its enclosing Mem/Exists/Set producer, rather than constructing
a sorter or suppressing invalid keys. This is not permission to skip ORDER
resolution or to expand to multirow/compound children. The pinned native
source-ID comparison for `ORDER BY 8+0`, false WHERE, LIMIT 0, ordinal 2 and
unknown names is exercised through public typed cells/names/two resets and
prepare errors in `select-scalar-child.test.mjs`. The completed-child fallback
still exists; its structural regression is not green.

### Zero-source grouped expression children (card-t-b follow-up)

`src/resolve.c:resolveSelectStep` binds GROUP terms before
`src/select.c:sqlite3Select` grouped `sqlite3WhereBegin` and sorter/accumulator
processing. With no FROM, WhereBegin admits one candidate if WHERE succeeds;
otherwise there is **no group** (unlike the ungrouped aggregate, which still
finalizes a row). The existing `compileAggregateSelect` grouped producer had
required a source table and routed no-source grouped expression children to a
rejected scalar path. It now accepts that grouped shape, and its WHERE rejection
jumps to SorterSort rather than a nonexistent `Next` cursor. Scalar/EXISTS/IN
consume the grouped producer's existing enclosing Mem/Exists/Set destination,
including LIMIT 0. The bounded no-source group is source-shaped sorter/aggregate
lowering, not an independent expression evaluator. Native 3.53.4 two-step
comparisons and public typed/name/reset/finalize coverage are in
`test/conformance/select-scalar-child.test.mjs`. This does not retire the
completed-child splice or admit arbitrary grouped compounds/windows.

### Nested count destination with *outer* LIMIT/OFFSET (card-t-b continuation)

The bounded nonflattenable zero-source derived `count(*)` producer already
accepted a parent builder but rejected an outer LIMIT/OFFSET and therefore
fell into the separate aggregate route (which attempted to resolve the
transient derived alias as a schema table). In pinned `src/select.c:sqlite3Select`
`computeLimitRegisters` (tag-select-0650) runs at each SELECT entry: the
inner zero-source candidate's limiter gates `AggStep`, whereas the outer
limiter gates the *final* aggregate row before `src/expr.c:sqlite3CodeSubselect`
SRT_Mem/Exists/Set. The parent-owned producer now computes the outer limiter
before the inner producer, then applies its OFFSET/zero jump after AggFinal;
the inner WHERE/LIMIT/OFFSET still skip only the input event, not finalization.
The standalone bridge retains its previous admission until its consumer moves.
Pinned native two-step public comparisons (`select-scalar-child.test.mjs`)
cover inner empty and present rows, outer LIMIT 0, positive/negative OFFSET,
scalar/EXISTS/IN typed results, names, reset and finalize. This is not a
lowering of arbitrary derived aggregate sources; the generic completed-child
relocation remains and the structural ownership assertion still fails.

### Nonflattenable zero-source derived count HAVING (card-t-b continuation)

Pinned `src/select.c:sqlite3Select` tag-select-0820 finalizes the ungrouped
accumulator even when the derived producer had zero accepted rows, then calls
`sqlite3ExprIfFalse(pHaving, addrEnd, SQLITE_JUMPIFNULL)` before
`selectInnerLoop` publishes SRT_Mem/Exists/Set. Previously
`compileZeroSourceDerivedCount` excluded HAVING, falling into the aggregate
schema-table resolver (`no such table: d`). Its parent-owned branch now binds
count(*) HAVING references to the finalized accumulator output register and
runs ordinary expression lowering and IfNot after AggFinal but before the outer
OFFSET/destination. This bounded count-only translation rejects other
aggregates and derived-column/subquery references rather than returning a
wrong value; it does not provide a general derived aggregate resolver. The
standalone bridge still excludes HAVING. Pinned-source-ID native versus public
cases compare true/false HAVING with empty/present producer, LIMIT 0/OFFSET,
scalar/EXISTS/IN integer/null cells, names, two resets and finalize. The
completed-child relocation fallback is still present; its structural test
still fails.

### ORDER term resolution before zero-source derived count destination (card-t-b)

Pinned `src/resolve.c:resolveSelectStep` / `resolveOrderGroupBy` validates
ORDER BY aliases, ordinals and names before `src/select.c:sqlite3Select`
suppresses the sorter for an ungrouped aggregate (tag-select-0820). The
bounded parent-owned derived count with HAVING previously excluded ORDER,
falling into schema lookup of the transient alias (`no such table: d`). It
now resolves these terms through the existing resolver using a transient
schema description of the derived result column, without opening a physical
table; the one-row aggregate needs no sorter. This also binds ORDER terms
referring to that derived column, including qualified names, and reports
missing derived names at prepare even with LIMIT 0. It does not materialize
a general derived-table aggregate source. Invalid ordinals and missing names
must fail at prepare even with LIMIT 0. Pinned-native and public scalar/IN,
count alias, count expression, derived-column and independent ORDER expression,
empty producer, metadata and reset/error probes cover this admitted route.
Generic completed-child relocation remains a failing structural criterion.

### WHERE after the bounded derived row event (card-t-b continuation)

Pinned `src/select.c:sqlite3Select` tag-select-0820 loops the derived FROM
producer through `sqlite3WhereBegin(pWhere)` before `finalizeAggFunctions`,
then tests HAVING before `selectInnerLoop`. The zero-source derived `count(*)`
parent now resolves outer WHERE with a transient result-column schema (the
same name resolution context used for ORDER), but evaluates its predicate on
the producer's projected register only after the producer's WHERE and
LIMIT/OFFSET gates. A false outer WHERE skips AggStep yet still finalizes the
empty accumulator to zero. Qualified/unqualified derived columns and
independent predicates are bounded to this one candidate; nested subqueries
in outer WHERE are still rejected rather than compiled as a separate program.
`resolveSelectStep` rejects aggregate use in WHERE during preparation before
ORDER processing, including when LIMIT 0 would skip execution. This bounded
path preserves the no-FROM child producer's actual row event and avoids a
fictitious table cursor. Native source-ID/public reset/typed/error probes in
`test/conformance/select-scalar-child.test.mjs` cover empty/present producer,
HAVING, scalar/EXISTS/IN and invalid names/aggregate use. General materialized
derived aggregate production and the completed-child splice remain outstanding.

### Multi-column no-FROM derived producer for count (card-t-b continuation)

Pinned `src/select.c:sqlite3ColumnsFromExprList` assigns distinct transient
names to all derived projections before `resolveSelectStep` binds outer WHERE
and ORDER. `sqlite3Select` produces a row of those columns, but an outer
`count(*)` in tag-select-0820 counts only its accepted row event; it does not
read a particular result column. The parent-owned zero-source derived count
previously admitted only one projection and bound all WHERE references to its
single register. The producer now evaluates its complete result list in order
under its own WHERE/LIMIT/OFFSET gates, and the outer WHERE binds each resolved
name to the corresponding emitted register. It still counts at most one row,
including false/empty outer WHERE finalization; no physical cursor is opened
for the transient name-resolution table. Source-ID native/public comparisons
cover two different columns, colliding names (`x`, `x:1`), NULL tests,
empty/present producer, ORDER, HAVING, LIMIT 0, scalar/EXISTS/IN and invalid
names with two reset/finalize cycles. This is not a multirow materialized
derived source; generic completed-child relocation remains.

### Inner ORDER on the one-candidate derived producer (card-t-b continuation)

Pinned `src/resolve.c:resolveSelectStep` / `resolveOrderGroupBy` resolves the
inner SELECT's ORDER expressions, aliases and integer ordinals before
`src/select.c:sqlite3Select` generates its sorter. With no FROM, at most one
row survives inner WHERE/LIMIT/OFFSET; its ordering is invariant, but ORDER
validation is not optional (an invalid name or out-of-range ordinal fails
prepare even at LIMIT 0). `compileZeroSourceDerivedCount` now admits that
bounded ORDER after running the existing resolver on the inner SelectNode;
it leaves the candidate's projection/limit/outer WHERE/aggregate destination
in its parent builder, without compiling or relocating an independent
Program. Pinned-source-ID/native and public tests cover x/y ORDER by name,
expression and ordinal; inner/outer LIMIT 0, HAVING and Mem/Exists/Set;
prepare-time errors and two reset/finalize cycles. This does not substitute
for materialized multirow derived sorting or generic scalar child migration.

### Inner DISTINCT on the one-candidate derived producer (card-t-b continuation)

Pinned `src/select.c:selectInnerLoop` evaluates the result row, runs
`codeDistinct` to discard a row already seen, and then applies OFFSET and the
SRT destination. The zero-FROM derived producer has at most one candidate
before this stage: there is no earlier row with which it can collide, whether
its result has one or several columns. Its parent-owned count(*) path now
admits inner DISTINCT while preserving projection, inner WHERE/LIMIT/OFFSET,
outer WHERE/AggStep and HAVING/destination order. The TS no-op for duplicate
filtering here is a bounded cardinality adaptation, not an alternative
multirow DISTINCT algorithm: upstream compares only with previously produced
rows; there are none in this slice. `resolve.c:resolveSelectStep` still
validates DISTINCT projection and ORDER during preparation even with LIMIT 0.
Source-ID/native and public scalar/EXISTS/IN, empty producer, HAVING, ORDER,
LIMIT and error/reset probes are in `test/conformance/select-scalar-child.test.mjs`.
General DISTINCT and materialized derived aggregation, and the completed-child
splice, remain outside this migration.

### Nullable `count(expr)` in the bounded derived accumulator (card-t-b continuation)

Pinned `src/select.c:sqlite3Select` tag-select-0820 invokes AggStep only for
rows surviving WHERE; `src/func.c:countStep` increments for zero arguments or
for a non-NULL argument, and AggFinal supplies zero even with no rows. The
parent-owned one-candidate derived accumulator previously accepted only
`count(*)`, counting the row irrespective of projected value. It now admits a
single `count(expr)` argument and binds its derived-result column to the
producer's projected register after inner gates and outer WHERE; the VM's
AggStep applies SQLite's NULL rule. The transient derived-result schema is
used at prepare even without WHERE/ORDER so missing arguments fail before
LIMIT 0, and matching HAVING aggregate references reuse the finalized count.
Distinct/filter/order aggregate variants and different HAVING aggregate
arguments are still temporarily unsupported, not assumed equal. Pinned native
and public typed/reset/error cases compare NULL/non-NULL, Mem/Exists/Set,
WHERE, HAVING and LIMIT; a different HAVING argument is observed natively but
is not claimed supported here. This is not multirow materialization or
retirement of the completed-child splice.

### Separate HAVING aggregate identities in the bounded derived count path

Pinned `src/select.c:sqlite3Select` analyzes aggregate expressions in result,
ORDER and HAVING into AggInfo (`sqlite3ExprAnalyzeAggList` and
`sqlite3ExprAnalyzeAggregates`) before the tag-select-0820 row loop. It steps
each distinct aggregate on accepted rows, finalizes all on empty input, then
evaluates HAVING before the destination. The previous bounded count(expr)
route only reused the projected count in HAVING and rejected a different count
argument. It now collects distinct `count(*)` / `count(expr)` HAVING identities,
allocates their own accumulator and result registers in the enclosing builder,
steps them using the same accepted projected row, finalizes all, and binds
HAVING references to the corresponding finalized registers. Source/outer WHERE,
inner LIMIT/OFFSET, NULL arguments, outer LIMIT and destination still own their
original order. `src/func.c:countStep` supplies the nullable-argument rule.
This supersedes the previous temporary exclusion of *different count HAVING
arguments* in this one-candidate branch; non-count, DISTINCT/FILTER/ordered
aggregates and derived-column HAVING without an aggregate remain unsupported.
Pinned native and public source-first tests cover independent count(x)/count(y)
identities, empty input, Mem/Exists/Set, compound HAVING predicates, typed
rows/reset and invalid HAVING column at prepare. This is not multirow derived
materialization or a removal of the completed-child fallback.

### DISTINCT count on the one-candidate derived aggregate

Pinned `src/select.c:resetAccumulator` opens a distinct ephemeral key for an
aggregate with exactly one argument; `updateAccumulator` calls `codeDistinct`
on that argument before `AggStep`. An accepted no-FROM derived producer can
emit at most one candidate: no earlier aggregate argument can collide. This
bounded branch therefore admits `count(DISTINCT expr)` without an ephemeral
comparison cursor, but keeps the argument's NULL handling in `func.c:countStep`
and keeps DISTINCT and ordinary counts as **separate AggInfo identities** in
result/HAVING. A different multirow producer must actually track distinct
keys; this cardinality adaptation does not license omission there. Other
aggregate families, FILTER/order variants and DISTINCT with no argument are
not admitted here. Source-ID native/public scalar/EXISTS/IN probes cover
NULL/non-NULL, mixed ordinary/DISTINCT HAVING counts, LIMIT 0, preparation
errors and reset/finalize; the completed-child fallback still remains.

### FILTER gates for bounded derived count AggInfo entries

Pinned `src/select.c:updateAccumulator` tests each aggregate's FILTER with
NULL-as-false *before* coding its arguments, distinct key or AggStep, jumping
to the next aggregate entry. `resolve.c` rejects nested aggregate calls in
FILTER/arguments at prepare, including LIMIT 0; `sqlite3Select` collects the
result and HAVING aggregate entries before emitting the row loop. The
parent-owned one-candidate no-FROM derived accumulator now compiles each
count entry's own bound FILTER gate after inner and outer row gates, keeps
ordinary/DISTINCT and different FILTER predicates as distinct accumulator
identities, and finalizes all counts on empty input before HAVING and the
Mem/Exists/Set destination. A single accepted candidate needs no distinct
key set, but this does not replace multirow DISTINCT/FILTER processing.
Source-ID native/public typed/reset/error comparisons cover NULL FILTER,
NULL count argument, mixed HAVING FILTERs, DISTINCT+FILTER, LIMIT 0 and
nested-aggregate preparation errors. Other aggregate functions, aggregate
ORDER and general derived table materialization remain unmigrated.

### Ordered count on the sole derived candidate

Pinned `src/select.c:updateAccumulator` tests FILTER, codes aggregate ORDER
keys, then arguments, inserts into the aggregate sorter, and replays the
ordered arguments into AggStep. For this bounded no-FROM derived source at
most one candidate reaches the accumulator; its ordering cannot change the
AggStep sequence. The parent builder still binds/codes the keys after FILTER
and before the argument, checks nested aggregates and unknown columns at
prepare even with LIMIT 0, and treats distinct ORDER lists as different
result/HAVING aggregate identities. No sorter is needed solely for ordering
one accepted argument. This cardinality adaptation does not apply to
multirow ordered aggregates or to order-dependent aggregates. Count with an
ORDER list requires an argument; all other aggregate families remain outside
this bounded bridge. Source-ID native/public typed/reset/error comparisons
cover Mem/Exists/Set, NULL count argument, FILTER, HAVING and LIMIT 0.

### Numeric AggInfo on the one-candidate derived producer

Pinned `src/select.c:sqlite3Select` collects result and HAVING aggregate
identities, steps each after the derived producer's accepted row event, and
finalizes all on empty input before HAVING and destination emission. Pinned
`src/func.c:sumStep`/`sumFinalize`/`totalFinalize`/`avgFinalize` distinguish
NULL, integer, floating-point and empty-input results. The parent-owned
one-candidate no-FROM derived route now uses the *existing translated VM
aggregate implementations* for count/sum/avg/total, rather than assuming all
AggInfo entries are count; their names participate in identity and determine
AggStep/AggFinal. Single-argument numeric aggregates retain the already
bounded per-entry FILTER, DISTINCT and ORDER gates. The sole accepted row
needs no duplicate set or sorter, but multirow numeric aggregates require
real distinct/sort resources. Source-ID native/public Mem/Exists/IN,
INTEGER/REAL/NULL, FILTER/DISTINCT/HAVING, empty-result and prepare-time name
errors are covered; this is not ownership of a general derived table.

### Extrema on the one-candidate derived producer

Pinned `src/select.c:updateAccumulator` passes the argument collation to
min/max's AggStep; `src/func.c:minmaxStep` skips NULL and compares with that
collation, `minMaxFinalize` returns NULL on empty input. The parent-owned
no-FROM derived accumulator now admits one-argument min/max in both result
and HAVING alongside count/sum/avg/total, preserving distinct function
identities and the argument collation in the existing translated VM
AggStep/AggFinal. Its <=1 accepted candidate cannot require comparisons
between candidates, but name binding, NULL handling, FILTER/ORDER gates and
empty finalization still run in source order. Source-ID native/public typed
Mem/Exists/IN, text COLLATE NOCASE, NULL/empty, HAVING/FILTER, reset and
prepare-error probes cover this bounded branch. Multirow min/max and general
derived materialization are not established by these cases.

### Multi-argument aggregate entries on the single-event producer

Pinned `src/select.c:updateAccumulator` codes each aggregate argument after
FILTER and ORDER keys, and `src/func.c:groupConcatStep` ignores NULL value,
using the optional second argument as separator only between accepted values;
`groupConcatFinalize` returns NULL on empty input. The bounded no-FROM
derived aggregate bridge now records an argument vector per result/HAVING
entry and emits it in order to the existing VM group_concat/string_agg
step/final implementations. Aggregate identity retains function name and both
arguments. It does not substitute text concatenation for the aggregate or
claim multirow separator/sorter behavior from this <=1 accepted event. Pinned
native/public Mem/Exists/IN, TEXT/NULL, empty, mixed HAVING, FILTER,
DISTINCT/ORDER, typed metadata, reset/finalize and invalid name preparation
cases cover the bounded route. The generic completed-child fallback remains.

### Zero-source grouped derived producer

Pinned `src/select.c:sqlite3Select`'s aggregate GROUP BY path forms groups
from accepted input rows; its no-FROM producer offers at most one row and
therefore at most one group (zero when WHERE rejects it). `src/resolve.c`
validates GROUP BY ordinals, columns and aggregate misuse at preparation,
including when LIMIT 0 later prevents emission. The parent-owned derived
aggregate route now resolves a GROUP BY in the inner no-FROM SELECT before
coding the same single candidate/WHERE/LIMIT/ORDER event into the outer
accumulator. This is a bounded single-group optimization, not a replacement
for general GROUP BY sorting or HAVING on the inner producer (which remains
outside this route). Native/public typed Mem/Exists/IN, empty group,
GROUP BY ordinal/name, ORDER/LIMIT, outer HAVING, reset/finalize and errors
are compared. Inner HAVING and multirow grouping need their own owner.

### Inner GROUP BY HAVING on the single-candidate derived producer

Pinned `select.c:sqlite3Select` GROUP BY result generator calls
`finalizeAggFunctions`, tests HAVING, then `selectInnerLoop` delivers the row
(and applies OFFSET). For a no-FROM nonaggregate GROUP BY source, at most one
group exists. The derived accumulator route resolves inner HAVING at prepare,
binds a nonaggregate HAVING expression to that group's projected registers,
and tests it before producer OFFSET and the enclosing aggregate step. Rejected
WHERE creates no group; rejected/NULL HAVING emits no row. Aggregate functions
inside the inner HAVING require an inner accumulator and are **not** admitted
by this route. Native/public typed Mem/Exists/IN and reset tests check
accepted/rejected/NULL, OFFSET, and missing-name errors under LIMIT 0;
this is not multirow grouping or aggregate-HAVING support.

### Single-group aggregate HAVING on the inner derived producer

The pinned `select.c:sqlite3Select` GROUP BY result generator resets/steps
AggInfo on the accepted group, finalizes it and tests HAVING before
`selectInnerLoop` applies OFFSET and sends the row to its destination.
`func.c:countStep/countFinalize` make `count(*)` on the one accepted input
INTEGER 1; a WHERE-eliminated input creates **no group**, not a finalized
zero-count row. The no-FROM derived producer now allocates its own count(*)
accumulator, steps/finalizes it only when its sole group exists, binds any
repeated count(*) calls in its HAVING to that finalized register, then uses
the existing group result gate before producer OFFSET and the enclosing
aggregate's accumulator. The bounded route supports only zero-argument
count(*) in inner aggregate HAVING; other aggregate arguments/functions,
inner expression subqueries and multirow groups still need their own owner.
Name resolution occurs before this admission gate, including errors at LIMIT
0. Pinned/public tests cover accepted/rejected/empty groups, mixed HAVING
predicates, typed Mem/Exists/IN, OFFSET/ORDER/LIMIT and reset/finalize.

### Inner one-group HAVING aggregate vector

Pinned `select.c:updateAccumulator` emits each AggInfo function's FILTER
before arguments and step; the GROUP BY output subroutine finalizes all
entries before HAVING (`select.c:sqlite3Select`). The no-FROM derived producer
now keeps separate inner accumulator registers per HAVING aggregate expression
and emits FILTER, argument evaluation, step and finalization before testing
the group. The existing VM `func.c` count/sum/avg/total/min/max and
string-aggregate step/finalizers supply NULL, INTEGER/REAL, collation and
TEXT semantics. DISTINCT on a one-candidate group has no earlier key to
collide with; this is **not** a multirow DISTINCT or ORDER-BY-aggregate
implementation. Name resolution precedes bounded admission even at LIMIT 0.
The admitted inner HAVING aggregate vector retains count(expr), numeric,
extrema and string arguments; aggregate ORDER BY and nested expression
subqueries remain outside the bounded route. Public/native checks cover
NULL, FILTER, DISTINCT, multiple functions, collation, Mem/Exists/IN and
reset. Separate inner and outer accumulators are not interchangeable.

### Inner aggregate ORDER keys on the bounded one-group producer

Pinned `select.c:updateAccumulator` evaluates an aggregate's FILTER, ORDER
keys and argument vector before its step/sorter insertion; the GROUP BY
result subroutine finalizes before HAVING. The no-FROM single-candidate
inner HAVING aggregate vector now binds/codes ORDER keys before arguments
and steps on the accepted group. With at most one accepted value there is
no second key to sort, so a runtime sorter is unnecessary **for this
bounded producer only**; this does not translate multirow aggregate ORDER
sorting. `resolve.c` still validates key names at prepare under LIMIT 0.
Source-ID native/public string_agg, group_concat, sum, NULL and invalid-key
probes check typed Mem/IN, names and two reset cycles. Multirow materialized
derived producers and the generic completed-child relocation remain open.

### Multirow derived count composition (bounded, source-owned)
Pinned `select.c:flattenSubquery` restrictions (9)/(16) leave the aggregate
consumer separate from a limited or ordered subquery; `sqlite3Select` builds
its producer before the outer `count(*)` finalization. For the nonaggregate
ordinary-table producer accepted by `compileInnerTableSelect`, the enclosing
scalar compiler now supplies an `aggregate-expression` destination with no argument: scan/sorter drain,
inner LIMIT/OFFSET and `AggStep` share one builder; the outer accumulator is
reset once, finalized even for zero producer rows, and delivered through
Mem/Exists/Set. The destination is an internal TS adaptation of SQLite's
SRT_Coroutine/SRT_EphemTab materialization followed by aggregate iteration:
streaming is safe here because this consumer needs only cardinality and never
re-reads the transient table. Other aggregate argument expressions/predicates, grouped,
window and compound producers remain on their existing paths; this is **not**
a general materialized table implementation. Source-ID oracle and public tests
cover multirow ORDER/LIMIT/OFFSET, zero rows, type/name/reset and Mem/Exists/IN.
The generic completed-child relocation remains present and the structural
assertion still fails; do not remove it until all admitted consumers migrate.

### Projected-column steps over bounded multirow derived producer (revision)
Pinned `select.c:flattenSubquery` (9)/(16) retains the separate ordered/limited
producer; `updateAccumulator` steps on accepted rows and `func.c:sumStep` /
`countStep` distinguish numeric/NULL arguments and empty finalization. For a
single uncorrelated outer `count(column)`, `sum(column)`, `avg(column)` or
`total(column)` with no filter/distinct/group/outer predicate, the producer's
result-register vector now feeds `aggregate-expression` in the enclosing builder.
The alias/column is resolved before producer execution, including LIMIT 0;
OFFSET and sorter drain remain producer-owned. Streaming row events rather
than materializing a transient table is a TS read-only adaptation valid for
this single-pass consumer, not for rereads, grouping or arbitrary expressions.
Pinned source-ID `native-multirow-values.py` and public scalar-child tests
compare INTEGER/REAL/NULL, Mem/IN, name errors and two reset cycles. Generic
completed-child relocation remains present; its structural test still fails.

### Bounded multirow derived extrema (revision)
Pinned `select.c:updateAccumulator` supplies the argument collation to
`func.c:minmaxStep`; its NULL branch does not change the winner and
`minMaxFinalize` returns NULL for an empty input. The existing projected-row
aggregate-expression destination now carries that collation and admits directly
referenced derived `min(column)`/`max(column)` (including COLLATE) in the same
parent builder. Sorter/LIMIT/OFFSET stay producer-owned; name resolution
occurs even at LIMIT 0. Source-ID `native-multirow-extrema.py` and public
`select-scalar-child.test.mjs` compare INTEGER/NULL, collation, IN/EXISTS,
invalid name, metadata and reset. This remains a single-pass, uncorrelated,
non-grouped consumer, not general multirow materialization or aggregate
ORDER sorting. The completed-child relocation structural check remains red.

### Bounded derived-row aggregate argument expressions (revision)
Pinned 3.53.4 `select.c:updateAccumulator` calls `sqlite3ExprCodeExprList`
for the argument after the inner SELECT has delivered its row; `resolve.c`
resolves names before stepping, even for LIMIT 0. For the uncorrelated,
non-grouped single-pass derived aggregate bridge, `aggregate-expression`
now binds references to the producer's projected row registers and codes a
nonaggregate argument expression at the scan/sorter drain before AggStep.
Its producer still owns ORDER/LIMIT/OFFSET; the enclosing accumulator resets
and finalizes on empty input. Nested SELECT/aggregate expressions are excluded
from this bounded route; the generic child relocation remains live and its
structural assertion remains red. The pinned `native-multirow-expr.py` oracle
and public `select-scalar-child.test.mjs` check sum/count/avg/min expression
arguments, NULL, invalid column under LIMIT 0, metadata and two reset cycles.
This does not implement general derived-table materialization or remove the
completed-child fallback.

### Derived aggregate argument collation correction (revision)
Pinned `src/select.c:updateAccumulator` selects `sqlite3ExprCollSeq` on each
argument before `AggStep`; `src/expr.c:sqlite3ExprCollSeq` follows a bare
column, CAST or unary plus for implicit column collation, but a binary
expression inherits only an explicit EP_Collate child. The derived argument
binder previously substituted projected columns with bare registers before
collation selection and defaulted `max(d.z)` to BINARY: with the fixture's
RTRIM `z`, pinned max of `q`, `q ` is `q`, not `q `. Select argument
collation from the original expression using the resolved producer result
column descriptor for a bare reference, while binary expressions remain
BINARY unless explicitly COLLATEd. Binding for row evaluation still targets
the producer registers. Pinned `native.py` in the card collation-probe work
and public two-cycle cases compare bare RTRIM, concatenation, explicit BINARY;
this repairs the bounded route, not the remaining completed-child fallback.

### Bounded derived aggregate FILTER row step (revision)
Pinned `src/select.c:updateAccumulator` resolves a FILTER and calls
`sqlite3ExprIfFalse(...,SQLITE_JUMPIFNULL)` **before** argument coding or
AggStep. The single-pass derived aggregate consumer now binds projected
columns in FILTER at preparation (even if producer LIMIT 0), codes the
predicate on each accepted producer result row, and skips both argument
coding and AggStep for false/NULL. This is the same `aggregate-expression`
destination used by unfiltered count(*) (zero arguments), projected-column
and expression arguments; the redundant `count-step` and `aggregate-step`
destinations have been retired. Producer ORDER/LIMIT/OFFSET still gate rows;
AggFinal still runs for zero steps. Only non-nested FILTER expressions in the
bounded uncorrelated, non-grouped, single-aggregate derived consumer are
admitted. DISTINCT, aggregate ORDER BY, nested SELECT/filter, outer WHERE,
and general materialization are not claimed. The pinned `filter-probe/native.py`
and public scalar-child two-reset cases check typed filtered sum/count, NULL,
zero producer rows and LIMIT 0 invalid FILTER column. Completed-child
relocation still blocks structural ownership.

### Bounded derived aggregate DISTINCT row gate (revision)
Pinned `src/select.c:resetAccumulator` opens a per-aggregate ephemeral index
with `sqlite3KeyInfoFromExprList`; `updateAccumulator` tests FILTER, codes
arguments, runs `codeDistinct` (Found/IdxInsert), then calls AggStep. The
single-pass derived-row `aggregate-expression` destination now admits one
argument DISTINCT for its existing uncorrelated non-grouped aggregate
consumer. It opens the argument-collated ephemeral index after accumulator
reset, evaluates FILTER before argument, and skips duplicate keys before
AggStep. Producer ORDER/LIMIT/OFFSET still gates which rows are candidates;
NULL and numeric comparisons remain Mem/KeyInfo/VM-owned; per-statement
private-state budgets and reset/finalize retain their VM lifecycle. Pinned
`distinct-probe/native.py` and public scalar-child cases check typed
count/sum/max, RTRIM, FILTER, Mem/EXISTS/IN, LIMIT 0, invalid names, two
reset cycles. No aggregate ORDER sorter, multiple aggregate vectors or
general derived materialization are claimed. Generic completed-child
relocation remains live and the structural assertion stays red.

### Bounded multirow derived aggregate ORDER sorter (revision)
Pinned `src/select.c:resetAccumulator` opens an aggregate ORDER ephemeral
index; `updateAccumulator` tests FILTER, evaluates ORDER keys before the
argument, applies DISTINCT, inserts accepted keys/argument instead of
stepping; `finalizeAggFunctions` drains sorted arguments into AggStep before
AggFinal. The uncorrelated, non-grouped single-aggregate derived-row
consumer now carries an optional ORDER sorter in `aggregate-expression`:
producer ORDER/LIMIT/OFFSET first chooses input rows, then FILTER, ORDER
keys, argument, DISTINCT and sorter insertion occur at the producer row
boundary. Drain follows producer completion and runs even when it accepted
zero rows; VM SorterCursor owns stable equal-key order, Mem payload, async
budgets and resource cleanup. Key and argument names bind before LIMIT 0.
This is a bounded single-argument count/sum/avg/total/min/max path, not
string_agg/group_concat, multi-aggregate vectors, arbitrary materialized
derived tables or a replacement for the remaining completed-child fallback.
The pinned `order-probe/native.py` and public scalar-child cases check typed
FILTER/DISTINCT/order, empty count, IN/EXISTS, invalid ORDER key, metadata
and two reset cycles. Earlier one-candidate aggregate ORDER note remains
limited to that separate route; multirow sorting is now mapped only here.

### Bounded derived-row group_concat ORDER consumer (revision)
Pinned `src/select.c:resetAccumulator`, `updateAccumulator`, and
`finalizeAggFunctions` open an aggregate ORDER table, evaluate FILTER before
ORDER keys/argument/DISTINCT, then drain sorted arguments into AggStep and
AggFinal. The existing one-argument `aggregate-expression` row destination
now also accepts `group_concat(x)` (default comma separator) for the same
uncorrelated, non-grouped ordinary-table derived producer. Its VM aggregate
state and sorter still own typed Mem values, private budgets and reset cleanup.
The pinned 3.53.4 `order-probe/native.py` and public scalar-child cases test
ORDER, FILTER/DISTINCT, NULL on LIMIT 0, IN, names and two resets. This does
not admit two-argument group_concat, string_agg, grouping, correlated rows or
general materialization. Completed-child relocation remains live.

### Derived-row aggregate argument vector (revision)
Pinned `src/select.c:updateAccumulator` allocates the aggregate's argument
range after ORDER keys (and sequence) and before DISTINCT, then stores each
argument in the ORDER record; `finalizeAggFunctions` extracts `nArg` values
for each sorted AggStep. `src/func.c:groupConcatStep` consumes two arguments,
using the second as the separator between non-NULL values. The bounded
`aggregate-expression` destination now emits an argument vector, preserves
FILTER -> ORDER keys -> arguments -> DISTINCT -> sorter/step ordering, and
allocates a full sortable payload range. Its caller binds every argument
before executing the derived producer, including LIMIT 0. This admits
`group_concat(value,separator)` and `string_agg(value,separator)` in the
existing uncorrelated non-grouped ordinary-table derived-row route, with
single-argument DISTINCT only; it is not a general grouped/materialized or
correlated consumer. Oracle `order-probe/oracle-vector.log` and public
scalar-child tests cover ordered custom separator, string_agg FILTER, NULL,
IN, invalid second-argument name at LIMIT 0, names and two reset cycles.
Previous notes excluding two-argument string aggregation from *this bounded
route* are superseded. Generic completed-child relocation remains red.

### Bounded derived-row aggregate outer WHERE gate (revision)
Pinned `src/select.c:sqlite3Select` non-GROUP scan passes `pWhere` to
`sqlite3WhereBegin` before `updateAccumulator` (near lines 8884–8891);
`updateAccumulator` owns separate aggregate FILTER/ORDER/argument/DISTINCT.
For the existing uncorrelated ordinary-table derived-row producer,
`src/internal/vdbe.ts:compileScalarSelect` binds the outer projected-column
WHERE before starting the producer (even at LIMIT 0), and the
`src/internal/select-program.ts:aggregate-expression` destination rejects
rows failing WHERE before FILTER, keys, arguments or AggStep. The producer
ORDER/LIMIT/OFFSET selects candidates *before* the outer predicate. This is
not general WHERE planning, correlated predicates or materialized rereads.
Pinned source-ID oracle `order-probe/oracle-where.log` and public scalar-child
two-reset cases cover typed count/sum/DISTINCT/ORDER/FILTER/string aggregation/
IN, zero rows and invalid WHERE name at LIMIT 0. Completed-child relocation
and its structural assertion remain red.

### Bounded derived-row aggregate outer limiter (revision)
Pinned `src/select.c:sqlite3Select` sets its limiter before scan setup
(tag-select-0650); after `finalizeAggFunctions`, the non-GROUP branch emits
its one row via `selectInnerLoop` to SRT_Mem/Exists/Set (near lines 8900–
8935). `src/internal/vdbe.ts:compileScalarSelect` now initializes the *outer*
LIMIT/OFFSET before resetting and scanning the aggregate, while the producer
retains its independent ORDER/LIMIT/OFFSET. The aggregate finalizes even if
outer OFFSET suppresses its sole result; LIMIT 0 skips the outer row and its
scan. The destination receives no row under LIMIT 0 or OFFSET 1, including
IN/EXISTS. Names bind before the limiter executes, including at LIMIT 0.
This removes the outer-limit exclusion only for the existing uncorrelated
non-grouped ordinary-table derived-row aggregate consumer, not grouped or
materialized shapes. Pinned ctypes source-ID oracle
`where-validation/outer-limit-oracle.log` and public scalar-child two-reset
typed/name/error probes test these branches. The generic completed-child
relocation still exists for other shapes; structural assertion remains red.

### Bounded derived-row aggregate outer ORDER binding (revision)
Pinned `resolve.c:resolveOrderGroupBy` (around 1805–1865) resolves the
noncompound ORDER alias/ordinal against the EList before ordinary source
expression binding. `select.c:sqlite3Select` non-GROUP finalization sends a
single accumulator row through `selectInnerLoop` (around 8910–8935), so this
outer ORDER does not sort the producer's rows: aggregate-internal ORDER and
producer ORDER/LIMIT/OFFSET retain their independent stages. The existing
uncorrelated ordinary-table derived-row aggregate destination now validates
outer ORDER alias/ordinal or projected-column expressions before the limiter
executes, including at LIMIT 0; a one-row finalization needs no outer sorter.
This does not add grouped ORDER, arbitrary expression rewrites or transient
materialization. Pinned source-ID ctypes `where-validation/outer-order-oracle.log`
and two-reset public scalar/IN/EXISTS typed/name/error cases exercise the
branch. The completed-child fallback and structural check remain red.

### Zero-source derived aggregate count bridge boundary (revision)

Pinned `src/select.c:sqlite3Select` feeds each producer result to the parent's
aggregate step; `src/func.c:groupConcatStep` consumes the actual argument value
and separator, not merely a row count. The legacy completed-producer fallback
in `compileZeroSourceDerivedCount` emits `AggStep count` on each ResultRow and
therefore may only own plain `count(*)` with no FILTER/ORDER/DISTINCT. It had
intercepted compound-derived `group_concat(v,NULL)` before the separate row
consumer, returning INTEGER 3 in place of TEXT `ba`. Rejecting that ownership
lets `compileCompoundDerivedAggregate` consume producer rows and aggregate
arguments in order. This guard does not make its completed-child relocation
source-owned; it remains a migration gap. The captured pinned
`aggregate30-group-concat-null-separator` and the utf8/utf16le/utf16be
private-budget baseline/sorter/error tests in `from-subquery-routes.test.mjs`
exercise this boundary through the public API.

### Multiple recursive producer destination repair ([[card:card-t-d]])

Pinned `src/select.c:generateWithRecursiveQuery` emits queue seed/shift/recursive
steps into the current Parse/Vdbe; `selectInnerLoop` selects the output
destination while emitting rows. Previously `compileMultipleRecursiveCtes`
compiled completed recursive Programs, then copied their ops while rewriting
PC/register/cursor offsets, ResultRow and Halt. The recursive compiler now
accepts an enclosing `SelectProgramBuilder<Op>` and sorter destination: each
producer allocates queue/history/registers in the same builder, branches to
its own forward break label, and inserts directly into a zero-key stable sorter.
The outer consumer retains its existing nested sorter scan and output ORDER
lowering. `emitSelectDestination` accepts sorter `keyCount:0` separately from
payload width; VM `SorterInsert` still owns insertion and work budgets. This
removes only the superseded multiple-recursive relocation; other completed-child
fallbacks and independent SELECT dispatch remain live. No observable public
contract change. Source-ID-checked
`test/conformance/select-recursive-composition-native.py` checks typed INTEGER
rows and reset against the pinned oracle; public `cte-admission.test.mjs`
covers cross join, output ordering, encodings and lifecycle. The structural
reproducer is `select-compound-owner.test.mjs`. Full C1–C6/Chinook,
suspended-concurrency and general fallback relocation parity are not claimed.

### Mixed IN/range future-RHS qualification (card-s-c-d-j)

The selected inner-join `wherePathSolver` ordinals now drive multi-source VDBE
loop entry, prerequisite-ready masks, and selected-cursor Next/Prev continuation.
Before this repair the planner chose `[x,z,y]` for `y.a IN (x.a,z.a)` but the
lowerer executed `[x,y,z]`, reading an unpositioned RHS. Reordering entry alone
created a duplicate row when Next still advanced a source-order cursor. Compare
pinned `where.c:wherePathSolver`, `whereexpr.c:exprAnalyze` (RHS prerequisites),
`wherecode.c:codeEqualityTerm`/Case 4 (RHS positioning) and `sqlite3WhereEnd`
(loop continuation). Source-order outer-join NULL-row continuation remains in
place. `mixed-in-range-red.test.mjs` exercises the chosen dependency, competing
first-slot range, later residual, NULL, empty and LEFT controls in three encodings.
The observed forced non-leading-column traversal succeeds; this is not a claim
of general forced-index, STAT4, DESC physical-index or optimizer parity.

Follow-up register correction: the standalone `compileInnerTableSelect` range
allocator returned the second unallocated register while reserving only
`count-1`; a one-key sorter therefore emitted `Copy` to a nonexistent Mem.
Reserve `count` and return the old high-water mark plus one, as the shared
`SelectProgramBuilder.range` does. Pinned `select.c:selectInnerLoop` reserves
`pParse->nMem+1` through `+nResultCol` for result ranges; this is register
ownership, not a SQL-specific join exception. The broader three-source
USING/NATURAL and RIGHT/FULL sorter regression now executes without an
undefined destination in addition to the mixed-IN reproducer.

### Review-v6 original branch disposition — [[card:card-s-c-d-m]]

`test/conformance/cases/in-range-branch-applicability.json` is a pinned-3.53.4
read-only capture built by `capture-in-range-branch.py` against a separate
four-column-index fixture. `in-range-branch-applicability.test.mjs` compares
public typed rows and private seek/traversal counters. This is an applicability
matrix, not an optimizer-completeness promise:

| dimension | disposition in admitted TS route | pinned owner / TS owner |
| --- | --- | --- |
| fourth-IN-slot | selected | `wherecode.c:codeINTerm/codeAllEqualityTerms` creates one RHS cursor per prefix IN; `where.c:sqlite3WhereEnd` unwinds innermost first. `where-plan.ts:btreeLoops` and `vdbe.ts:compileInnerTableSelect/sqlite3WhereEnd` iterate the prefix without a three-slot cap. |
| equality-range-alternative | selected | `where.c:whereLoopAddBtreeIndex` restores state per term; `where-plan.ts:btreeLoops` proposes equality and range branches. Later terms are residual (`wherecode.c:Case 4`). |
| subquery-IN-RHS | safe residual traversal | `whereexpr.c:exprAnalyze` and `wherecode.c:codeINTerm` can use subquery RHS sets. Here `where-plan.ts:comparisonOperator` admits only list IN as selected access; `vdbe.ts` evaluates the SELECT as residual during forced index traversal. Not a selected seek. |
| selected-versus-residual | safe table scan | `NOT INDEXED` forbids index access; rows are tested as residual. |
| multi-source-prerequisite | selected | `whereexpr.c:exprAnalyze` prerequisites and `where.c:wherePathSolver` precede `vdbe.ts:compileInnerTableSelect` dependent RHS evaluation. |
| forced-index-traversal | safe residual index traversal | `where.c:whereLoopAddBtree` forced access on non-leading field; TS traverses physical index, tests residual, does not invent a seek. |
| prepare-unsupported | typed temporary unsupported | Pinned native accepts `(a,b) IN (...)`; the TS SELECT producer does not lower vector IN, so prepare rejects atomically rather than dropping a component. |

Literal/parameter RHS use shared Mem/key-affinity sets (NULL and rebind are
covered by existing suites); the fourth-slot capture uses unsorted multi-value
RHS. Neither arbitrary STAT4 choices, pruning/order parity, native VM steps nor
unforced selected-access identity is an unqualified public guarantee. The
admitted observable promise is correct typed rows/order/error/reset with safe
residual scan/traversal where selected access is not translated. Source controls:
`where.c:whereLoopInsert` (cost/subset dominance), `wherePathSolver`
(prerequisite-ready paths), `wherecode.c:Case 4` (prefix plus first range),
`codeINTerm/codeAllEqualityTerms` and `where.c:sqlite3WhereEnd` (restart).
Finite TS RHS sets replace C ephemeral cursor allocation for represented lists;
this capture and prior three-slot/corruption/work-bound suites constrain that
browser-safe substitution. This does not resolve [[card:card-t]]'s shared four
SELECT producer reds or supersede i/j/k evidence.

### Compound-derived zero-source aggregate child destination ([[card:card-t-b]], bounded revision)

Pinned `src/select.c:multiSelect` TK_ALL sends each arm's result into the
outer aggregate's row consumer; `sqlite3Select` finalizes that accumulator
before `selectInnerLoop` sends its single row to the `SelectDest` initialized
by `src/expr.c:sqlite3CodeSubselect`. For the unordered, no-FROM literal-arm, unfiltered count(*) / one-argument
sum/avg/total/min/max slice,
`compileCompoundDerivedAggregate` now emits arm projections and AggStep/AggFinal
into the caller's register/ops builder and sends the final register through
Mem/Exists/Set. It does not freeze the enclosing ops before the caller patches
Once or emits IN's probe. Unlike the previous completed-child bridge this
keeps both arm row events and aggregate finalization in the same allocation
space. The independent top-level compound-derived branch still constructs finished arms; the generic scalar fallback now emits through the parent destination (see the bounded bridge retirement below). This is not general compound or grouped migration. Arms
with source/order/limit or other excluded semantics do not enter this bounded
parent branch; remaining shape routing and unsupported behavior need review.
The pinned-ID ctypes comparison and public twice-step/reset typed cases are
in `test/conformance/select-scalar-child.test.mjs` and the card's
`compound-probe/oracle.py`. For an outer LIMIT/OFFSET the parent branch computes
the counter before accumulating arms, then guards destination publication after
AggFinal. This follows `select.c:computeLimitRegisters` (zero jumps before
OFFSET expression evaluation) and `selectInnerLoop` (OFFSET skips the one
aggregate result), with `expr.c:sqlite3CodeSubselect` initializing the
Mem/Exists/Set destination. The scalar NULL, EXISTS/IN zero, LIMIT 1 and
OFFSET 1 behavior is compared with pinned-ID ctypes via
`$SAIVAGE_CARD_WORK_ROOT/limit-review/oracle.py` and the public twice-reset
typed/metadata test in `select-scalar-child.test.mjs`. No general LIMIT,
error/budget differential or structural fallback retirement is established.

### Expression SELECT completed-child bridge retirement ([[card:card-t-b]], bounded)

Pinned `src/expr.c:sqlite3CodeSubselect` allocates the Mem/Exists destination,
initializes it, applies scalar limit handling and invokes `sqlite3Select` on the
**same** Parse/Vdbe (`src/select.c:selectInnerLoop` SRT_Mem/Exists/Set). The
remaining generic expression-subquery branch in `compileScalarSelect` used to
compile a finished table/aggregate Program, whitelist and renumber its opcodes,
then replace ResultRow/Halt. It now allocates its destination, Once, registers
and cursor in the enclosing builder, invokes the existing aggregate compiler
or resolved multi-source scan generator with that destination, and emits the
IN probe afterward. This is a TS builder/register adaptation of the upstream
shared Parse rather than relocation of an independently finalized program.
Resolution failure propagates before statement publication; the emitter does
not freeze the parent ops while callers still patch Once and append probes.
Earlier bounded branches (compound-derived aggregate, grouped, view/flattened,
and direct joined child) retain their existing source-owned lowering.

`test/conformance/select-scalar-child.test.mjs` guards against renewed generic
relocation and tests the admitting expression paths; the pinned-source-ID ctypes
comparison in the card's `parent-migration/oracle.py` covers scalar/EXISTS/IN,
limit-empty, compound expression and missing-table preparation, and top-level
UNION ALL, with two step/reset passes. Public counterparts include
`select-output-differential.test.mjs`. The generic fallback had no successful
consumer in the instrumented selected/conformance and Chinook inventory; this
is *observed test coverage*, not a proof of all SQL shapes. Top-level
`compileCteUnionAll` and derived compound finished-arm bridges remain separate
migration tasks; neither compound ownership nor comprehensive error/budget parity
is claimed by this repair.

[[card:card-t-b]] unordered UNION ALL arm-owner revision (bounded): pinned
`select.c:multiSelect` copies the caller destination and invokes `sqlite3Select`
for both arms on the existing Vdbe, whereas the former `compileCteUnionAll`
assembled finished child Programs by rewriting Halt and branch targets. Its
unordered unlimited table/no-FROM/aggregate arms now share a
`SelectProgramBuilder`, parameter state and output destination; `resolve.c`
resolution is run even for zero-FROM arms before emitting their candidate row.
Compound classification must precede rightmost aggregate classification, but
only unlimited unordered SELECT-origin UNION ALL is redirected at the
entry: ordered, limited, VALUES and set routes still retain their admitted owners.
A width mismatch rejects before publication. This is not a general compound
migration: ordered arms still use the previous sorter/child route, and derived
and other compound consumers have separate ownership. The regression and
source-ID-checked native probe are `select-compound-owner.test.mjs` and
`$SAIVAGE_CARD_WORK_ROOT/compound-validation/oracle.py`; budget and multi-table
parity for this particular redirected route remain to be checked.

### Ordered compound builder migration (in progress, card-t-b)

Pinned `select.c:multiSelectByMerge` (3399-3710) emits arms into one Vdbe
through `SRT_Coroutine` destinations. The bounded ordered UNION ALL route now
allocates arm state on one `SelectProgramBuilder` and emits directly into a
shared typed sorter destination; it no longer relocates completed child Programs.
The sorter rather than coroutine merge is an async/browser adaptation: it keeps
INTEGER/REAL Mem keys and the existing sorter budget/lifecycle; it is **not**
a claim of merge scheduling or full ORDER/collation/LIMIT equivalence. In
particular, CTE-derived arm resolution requires a shared parent source owner:
ordinary `expandAndResolveSelect` does not resolve a CTE as a base table, and
returning to the old compound fallback rejects a formerly admitted public case.
The ordered public control now passes after a bounded single-use ordinary CTE
flattening handoff: substitute exposed columns and producer WHERE before resolving
the arm on the parent builder (compare `select.c:flattenSubquery` and
`resolve.c:resolveSelectStep`). This is restricted to an eligible single-source
producer; materialized/repeated or nested CTE arms and broader merge/collation
parity remain open. Pinned source-ID-checked native rows/types/metadata for
INTEGER/REAL/NULL, empty CTE, and outer predicate are paired with twice-stepped
public controls in `test/conformance/select-compound-owner.test.mjs`; LIMIT and
preparation errors remain covered there as existing-route controls.

### Bounded table-backed compound owner (card-t-b)

Pinned `select.c:multiSelect` copies the caller `SelectDest`, dispatches ordered
and set operations through `multiSelectByMerge` and codes arms on one Parse/Vdbe;
`selectInnerLoop` directs each arm row to its destination. The remaining
`compileSimpleTableCompound` bounded single-column direct-table owner now uses
`SelectProgramBuilder` for registers and distinct scan/ephemeral/sorter cursors,
and `emitSelectDestination` for output after offset gating; its set/ordered
transitions retain the previously admitted typed ephemeral and sorter operation
with shared row/key registers. This is a bounded TS/async adaptation rather than
translation of upstream merge scheduling. Each scan explicitly supplies its
selected cursor to OpenRead/Rewind/Column/Next so that table provenance does not
fall back to VM cursor zero. Error validation occurs before publishing a Program.
The independently source-ID-checked native read-only fixture probe is
`$SAIVAGE_CARD_WORK_ROOT/table-compound-oracle/probe.py`; paired twice-stepped
public INTEGER/TEXT/name/set/order/LIMIT and atomic prepare controls live in
`test/conformance/select-compound-owner.test.mjs`. Existing private-state and
unsupported-boundary cases remain in `compound-union-all.test.mjs` and
`compound-values-unsupported.test.mjs`. WHERE scan planning, CTE/derived/window
composition and broader merge/budget/collation equivalence remain separate
owners and are not inferred from the bounded controls.

### Materialized CTE bounded owner (card-t-b, in progress)
Pinned `src/select.c:sqlite3Select` tag-select-0484/0488 uses a shared Vdbe,
`SRT_EphemTab`, `Gosub`/`OpenDup`, then the outer WHERE and LIMIT on the
consumer side of the materialization fence. The bounded direct-projection
producer in `compileCteDerivedSources` now emits table/VALUES rows into a
parent `SelectProgramBuilder` ephemeral destination, allocating registers and
cursors there; direct column/literal outer comparisons remain outside the
producer, with OFFSET skipped only after passing the filter. The ephemeral
representation and VM ops are browser/TS adaptations of SQLite's ephemeral
B-tree, not a general sorted CTE implementation. Only a single ascending
ORDER BY the output column (or ordinal 1) is admitted on this route; other
shapes retain the separate finished-child fallback and are **not migrated**.
The source-first pinned-oracle public rows/types/metadata/reset/errors probe
and owner check are `test/conformance/select-compound-owner.test.mjs`.
Do not delete the legacy bridge until its remaining consumers have a
source-owned replacement; this is not general CTE or ORDER BY parity.

Filtered table-backed materialized CTE producers now use the same bounded
parent destination when `compileInnerTableSelect` can resolve their source and
predicate; its existing `resolveTree`/`compilePredicate` owns expression
registers, column cursor identity and VM predicate branches (pinned
`src/expr.c:sqlite3ExprCodeTarget`, `src/select.c:sqlite3Select` tag-select-0488).
The producer WHERE is evaluated *inside* materialization; the outer WHERE is
still evaluated after it. Scalar VALUES producers with WHERE and other complex
producer shapes retain fallback rather than dropping their predicate.
Pinned-oracle filtered typed/reuse/prepare-error/reset tests are adjacent to
this route in `test/conformance/select-compound-owner.test.mjs`. The old
finished-child relocation remains in use for unmigrated producer shapes.

### Bounded two-SrcItem compound-derived materialization ([[card:card-t-c]])

Pinned `src/select.c:sqlite3Select` (around 8050–8130) owns a generated Select
per FROM SrcItem and emits each producer into the enclosing Vdbe before scanning
its transient cursor; `multiSelect` (around 2935) emits UNION ALL arms into the
same destination, and `selectInnerLoop` (around 1139) owns output/sorter delivery.
`parse.ts:sourceList` now retains the ordered `derivedSources` prefix, rather than
losing the earlier SrcItem when the second derived table is reduced. A bounded
consumer in `vdbe.ts:compileCteDerivedSources` emits two constant, unordered
UNION ALL producers into separate ephemeral destinations on one builder, then
applies the represented inner-join equality or column/literal ON predicate and
sorts ordinal outer results before output. This does **not** copy completed
child Programs/PCs and uses the existing Mem/KeyInfo/async VM. The parent
builder is not yet a general compound-derived SELECT/WHERE lowering: child
FROM, DISTINCT, grouped, windowed, ordered/LIMIT, non-UNION ALL and unsupported
parent projections/predicates remain temporary unsupported; wider branch,
collation, NULL, limits, lifecycle and fixture fidelity is unresolved. The paired
pinned source-ID-checked native/public probes are
`test/conformance/select-derived-composition-native.py` and
`test/conformance/select-derived-composition.test.mjs` (names, INTEGER types,
rows, public reset). This is an ordinary technical branch boundary, not a
product-scope exclusion.

### MATERIALIZED compound CteUse pair on enclosing SELECT ([[card:card-t-c]])

Pinned `src/select.c:sqlite3Select` tags select-0484/0488 (~8075–8145)
reuses a prior `CteUse` fill or emits a materialization subroutine with
`SRT_EphemTab`; `multiSelect` (~2935 onward) writes `UNION ALL` arms into the
same `SelectDest`, with `selectInnerLoop` delivering arm rows. The existing
`cte.ts` lowering retains `cteDerived` declaration/use identities. Previously,
`compileCteDerivedSources` declined compound producers, falling through to
`compileTableSelect`, which misreported a CTE as `no such table`. The bounded
parent-builder route now accepts two explicitly MATERIALIZED compound CTEs,
compiles constant no-FROM unordered UNION ALL arms into separate ephemeral
cursors, then consumes their joined rows, admitted equality `ON` and ascending
ordinal outer sorter. Its `owners` map still keys by CteUse for reuse/dup;
registers, cursor positioning, Gosub/Return, output metadata and reset belong
to the enclosing Program. It does not copy finished Program PCs. The paired
source-ID-checked `test/conformance/select-cte-compound-composition-native.py`
and public `.test.mjs` assert INTEGER rows, names and two executions with reset.

This is not general CTE/compound support: nonmaterialized declarations,
non-UNION ALL, child table-backed arms, child ORDER/LIMIT, aggregates, windows,
collations, nonordinal outer order and unsupported parent predicates remain
unmigrated. The existing fallback is retained for other live consumers. The
upstream branch comparison concerns parent-builder ownership, not a claim
that the bounded emitted op sequence covers all source control branches.

The follow-up per-arm no-FROM WHERE path uses pinned `src/resolve.c:resolveSelectStep`
for each arm (including the gate's name error before publishing a Program),
`src/select.c:sqlite3Select` for WHERE-before-`selectInnerLoop`, and
`src/expr.c:sqlite3ExprCodeTarget` for the predicate value. In the parent
builder `compileCteDerivedSources` now emits each arm's `IfNot` gate before
its result projection and ephemeral destination, patching the branch to the
next arm (not to the end of the compound). This replaces the previous rejection
and avoids completed-child PC relocation; the parent still owns join/ORDER,
metadata and VM cursor lifecycle. Paired pinned/public source-ID-checked tests
`test/conformance/select-cte-compound-where-native.py` and
`select-cte-compound-where.test.mjs` assert typed filtered rows, names, reset,
finalize and close. It is not a general expression/resolver or table-backed
compound migration; error/NULL/collation/limits matrices require further tests.

### Table-backed compound CteUse arm in enclosing parent ([[card:card-t-c]])

The next paired native/public discriminator, `test/conformance/select-cte-table-compound-parent-native.py`
and `.test.mjs`, combines a filtered physical `t1`-backed `UNION ALL` CTE
with a second constant compound MATERIALIZED CTE in a joined parent. Previously
`compileCteDerivedSources` declined every FROM-bearing compound arm, then
`compileCteDerivedSourcesFallback` did not claim the pair; independent table
dispatch reported `no such table: a`. Pinned `src/select.c:multiSelect`
(~2935–3050) invokes `sqlite3Select` for each arm with the same destination;
`sqlite3Select` tags select-0484/0488 (~8075–8145) fills a CteUse ephemeral
cursor before the parent join; `selectInnerLoop` (~1139–1327) emits each row
into that destination. `src/resolve.c:resolveSelectStep` resolves each arm's
physical FROM, WHERE and projection in its own NameContext; `src/expr.c`
expression code generates the predicate/projection. The existing
`compileInnerTableSelect` consumes the where.c/wherecode.c plan handoff and
already accepts an enclosing builder/destination. This compound owner now
constructs an arm-local SELECT, resolves it, and emits a FROM-bearing arm
through that existing table producer into the *same* parent builder and
SRT_EphemTab as its no-FROM peer; it does not relocate completed Program PCs.
Arm-local aggregate/window classification and multiple-FROM/derived arm guards
remain admission checks. Unadmitted shapes decline without publishing a
partial Program; actual name-resolution errors propagate. This is a bounded
caller migration, not a new generic evaluator or a change to root-owned
[[card:card-s]] WHERE files. Pinned fixture/native and public tests compare
names, INTEGER rows `(3,10),(3,20)`, reset and finalize. General correlated,
parameterized, aggregate, window, JSON, child ORDER/LIMIT, NULL, collation,
encoding, error/limit and C1–C6/Chinook matrices remain open; the finished-child
fallback and independent recursive/aggregate/table/scalar dispatch still live.

### Mixed ordered table / compound MATERIALIZED CteUse parent ([[card:card-t-c]])

A source-ID-checked fixture differential (`test/conformance/select-cte-ordered-mixed-parent-native.py`
and `.test.mjs`) exposed a missing caller edge: an ordered/LIMIT, WHERE-filtered
physical-table SELECT CteUse and an unordered constant UNION ALL CteUse joined by
the same parent. Native returns names `x,y` and INTEGER `(5,10),(5,20)` across
reset; before admission, TS fell through to table dispatch with `no such table: a`.
Pinned `src/select.c:sqlite3Select` (~8075–8145) materializes each CteUse into
its own SRT_EphemTab; `multiSelect` (~2935–3050) is invoked *within* the
compound CteUse only, not as a condition on its sibling. `selectInnerLoop`
(~1139–1327) delivers table rows after WHERE and ORDER/LIMIT handling to that
same per-CteUse destination. `src/resolve.c:resolveSelectStep` owns distinct
arm/table NameContexts; `src/expr.c` expression coding owns predicates and
projection. The existing parent `compileInnerTableSelect` already emits the
bounded table ORDER/LIMIT and where.c/wherecode.c handoff into the parent builder.
The mixed CteUse admission now allows two explicitly MATERIALIZED uses when
*at least one* has a compound producer; it leaves the other use's established
ordered table producer, its sorter/register/limit state, and the compound peer's
arm-local destination unchanged. This corrects dispatch ownership, not generic
compound lowering, and copies no completed child Program PCs. Ordinary two
noncompound CteUses retain their previous route. Unsupported child shapes and
broader ordering/parameter/correlation/error/budget matrices remain unproven;
remaining fallback and independent SELECT dispatch stay live.

### Zero-source materialized CTE WHERE producer ownership ([[card:card-t-d]])

Pinned `src/select.c:sqlite3Select` codes a no-FROM WHERE gate before
`selectInnerLoop` sends the candidate to `SRT_EphemTab`; `src/vdbeaux.c:sqlite3VdbeAddOp3` builds addresses in one Vdbe and `src/vdbe.c:sqlite3VdbeExec` executes the resulting PC/register/cursor state. The bounded `compileCteDerivedSources` parent builder now emits a single-arm no-FROM SELECT's predicate, projection and destination in that order. Previously this form was rejected from the parent owner and routed through `compileCteDerivedSourcesFallback`, which compiles a separate Program, manually offsets its PC branches, and rewrites ResultRow/Halt. The remaining fallback stays live for unmigrated producers; this change does not make it removable or consolidate independent aggregate/scalar/table dispatch. The where.c handoff for table-backed producers remains in `compileInnerTableSelect`, not in the VM switch. Source-ID-checked native typed zero/one-row and repeated CteUse/reset controls (`$SAIVAGE_CARD_WORK_ROOT/cte-vm/oracle.py`) are compared with public `test/conformance/select-cte-zero-source-owner.test.mjs`. Unsupported nested, grouped, ordered and compound forms still follow their existing routes; this focused comparison is not C1–C6/Chinook or a global budget/concurrency proof.

### Table-backed CTE LIMIT producer migration ([[card:card-t-d]])

The earlier no-FROM WHERE migration did not cover table-backed `LIMIT`.
Pinned `src/select.c:sqlite3Select` tag-select-0488 invokes its producer into
`SRT_EphemTab` in the same Vdbe, and `selectInnerLoop` emits the destination
before LIMIT's loop-exit branch. The existing `compileInnerTableSelect` owner
already emits `computeLimitRegisters` and the `DecrJumpZero`/`IfNot` exits into
its parent `SelectProgramBuilder`, including OFFSET and LIMIT 0. Admission in
`compileCteDerivedSources` now sends table-backed LIMIT producers to that
owner; prior admission diverted them to completed-child PC relocation. The
producer still returns via the parent Gosub/Return; `Vdbe.step` owns execution
and `where.c`'s path identity remains consumed by `compileInnerTableSelect`.
Pinned typed oracle `$SAIVAGE_CARD_WORK_ROOT/cte-order/oracle.py` and public
`test/conformance/select-cte-order-owner.test.mjs` compare LIMIT 0, LIMIT 2,
OFFSET 1 and repeated use/reset. A trial of admitting producer ORDER BY instead
failed: native emits 7,5,3 while the current ephemeral cursor's KeyInfo sort
reorders 3,5,7; pinned `select.c:selectInnerLoop` SRT_EphemTab uses a rowid
insertion (and `generateSortTail` drains an ORDER BY sorter into that table),
whereas the current `IdxInsert`/`EphemeralSort` path sorts by record value.
ORDER BY admission was reverted. Do not treat the LIMIT pass as an ORDER fix or
proof of full CTE/compound, budget, lifecycle or C1–C6/Chinook compatibility.

### 2026-10-01 selected RIGHT unmatched cursor and continuation ([[card:card-t-d]])

Pinned `src/wherecode.c:sqlite3WhereRightJoinLoop` (2842–2950) emits
`OP_NullRow` for each left table **and its selected index** before the
unmatched-right RHS scan. `src/vdbe.c:OP_NullRow` (6195–6228) clears Btree
position/cache; `OP_Rewind` (6372–6410) positions the fresh RHS scan.
`compileInnerTableSelect` now emits both null-row operations for each
left level using the loop's source ordinal. VM `Rewind` discards any prior
seek/deferred cursor for that same table cursor, so the unmatched pass's
`Next` advances its new scan, not the earlier matched seek. The compiler
copies the shared RHS continuation with `relocateControlTargets` rather than
an incomplete hand-written opcode list: the prior `ShortCircuit` jump into
the original body caused the observed sorter-entry-limit exhaustion. PC,
register, cursor and work accounting remain VM-owned; this change does not
alter [[card:card-s]] index admission or c's window-derived lowering.
Public forced selected-vs-scan RIGHT rows (INTEGER/NULL) with reset/rebind,
a source-order assertion, and a read-only pinned source-ID-checked typed
native comparison across three encodings cover this seam. RIGHT/FULL and
advanced-index regressions pass, but exact native work-unit parity, all
RIGHT/IN branches, C1–C6/Chinook and suspended concurrency remain open.

### 2026-09-30 selected LEFT null-row ownership ([[card:card-t-d]])

Pinned `src/where.c:sqlite3WhereEnd` (7655–7710) advances the IN
iterators before the LEFT unmatched-row edge and emits `OP_NullRow` first
for the table and then for a selected index, before re-entering the loop
body. Pinned `src/vdbe.c:OP_NullRow` (6195–6228) marks a cursor null and
clears its Btree position/cache; subsequent column reads must not expose
a previous hit. `compileInnerTableSelect` now emits both null-row opcodes
when a selected index exists. VM `NullRow` clears decoded row/rowid and
pending deferred table seek on the addressed cursor, invalidates borrowed
row state and clears positioned TableCursor/IndexCursor while retaining
opened cursor identity for future seeks/restarts. `CursorBase.clearPosition`
is the browser read-only Btree equivalent of clearing the underlying cursor;
`first`/`seek` may reposition it. Source-only assertions protect the
producer/VM state boundary; public forced/scan LEFT rows across all three
encodings and reset/rebind, plus a pinned read-only source-ID-checked typed
native comparison, cover the observed row/NULL behavior. Previously those
public row checks passed even without the cursor-state transition; they
cannot establish exact upstream work units or broader VM parity. No root
[[card:card-s]] admission or API guarantee changed.

### 2026-09-30 joined selected nullable range-start exit ([[card:card-t-d]])

Pinned `src/wherecode.c:sqlite3WhereCodeOneLoopStart` Case 4
(1990–2042) evaluates nullable `pRangeStart` and branches with `OP_IsNull`
to `addrNxt` before affinity and the start seek. The joined caller
`compileInnerTableSelect` previously evaluated the start register then
immediately emitted `IndexSeekPrefix`; residual WHERE tests could hide
extra cursor seeks in public rows. It now emits the same register-based
`IsNull` before the seek and patches the compiler-owned exit together with
the failed seek: inner IN restart when present, LEFT unmatched-row path,
or the next outer loop, including pre-copy RIGHT JOIN continuation targets.
The existing VM opcode executes the branch without opening/seeking the
index; VM still owns Mem, PC, cursor state, limits, and cleanup. This
corrects the joined producer without changing root [[card:card-s]] planner
admissions or introducing a second evaluator. Public all-encoding tests
cover NULL, duplicate keys, `=`/`IS`, nested IN, joined reset/rebind and
sticky budget errors; `select-joined-index-null-native.py` uses read-only
pinned source-ID-checked typed INTEGER/NULL forced-vs-scan differentials.
The source-only guard checks pre-seek ordering; public rows alone would
not establish that ordering. General outer-loop and suspended concurrency
parity remains open.

### 2026-09-30 nullable selected range start ([[card:card-t-d]])

Pinned `src/wherecode.c:sqlite3WhereCodeOneLoopStart` Case 4 (1990–2042)
computes a nullable range-start RHS, then emits `OP_IsNull` to `addrNxt`
before affinity and `aStartOp` seeking; `src/vdbe.c:OP_IsNull` (2755–2763)
reads the register and branches without moving the cursor. The selected
`compileTableSelect` caller previously formed `IndexSeekPrefix` directly on
an appended NULL bound: forward `a=1 AND b>=NULL` admitted three keys rather
than none. The compiler now emits `IsNull` on the range-start register only
(not equality-prefix `IS NULL` keys), routes it through the same loop-exit
edge as failed seeks, including IN restarts, and leaves the VM responsible
for register state, branch PC, seek, and cleanup. This translates a source
branch rather than substituting a separate SQL predicate evaluator. Public
`run-advanced-index-ts.test.mjs` forward/reverse bound cases compare forced
selected to table control over NULL/rebind/reset in three encodings; pinned
source-ID-checked `select-nullable-index-range-native.py` compares typed
INTEGER rows with read-only native forced/control statements for both
orientations. Other selected-end, NULL-order and VM/suspension parity remain
open; no owner scope or API guarantee was changed.

### 2026-09-30 unbounded reverse selected-index start ([[card:card-t-d]])

Pinned `src/wherecode.c:sqlite3WhereCodeOneLoopStart` Case 4 `aStartOp`
(1850–1866) emits `OP_Last` for an unconstrained reverse selected-index
loop, matched to `OP_Prev` in `sqlite3WhereEnd`; `src/vdbe.c:OP_Last`,
`OP_Rewind`, `OP_Prev` position/step the cursor, not the compiler. The
single-table selected producer in `src/internal/vdbe.ts` formerly emitted
`IndexRewind` even when the chosen loop was reverse, then `IndexPrev`:
it produced the first physical row only. Its no-bound selected branch now
emits `IndexLast` for reverse and retains `IndexRewind` for forward, leaving
bound seeks, table scan and VM execution alone. Pinned source-ID-checked
`test/conformance/select-unbounded-reverse-index-native.py` verifies typed
INTEGER rows in three encodings for both selected and scan, twice each;
`run-advanced-index-ts.test.mjs` compares public selected/scan results,
checks no masking sorter and reset after partial execution. This is compiler
start/continuation ownership, not a replacement index evaluator. Full VM/WHERE
integration and C1–C6/Chinook/lifecycle/suspension gates remain open.

### 2026-09-30 bounded CTE ORDER producer traversal correction ([[card:card-t-d]])

Pinned `vdbe.c` OP_Last/OP_Rewind and OP_Prev/OP_Next initialize and advance a
cursor in the same direction; `wherecode.c` loop direction must be carried into
both ends of the loop. For a parent-owned, table-backed MATERIALIZED producer,
`compileInnerTableSelect` now emits Last/IndexLast for reverse full traversal and
Prev/IndexPrev for continuation, not Rewind then Prev (or Rewind then Next).
The VM owns cursor positioning and advancement; the enclosing SELECT builder owns
PC targets and destination. `select.c` `sqlite3Select`/`selectInnerLoop` drains
sorted rows to SRT_EphemTab in insertion order; the dedicated ephemeral cursor
retains that order rather than sorting by record key. The bounded outer CTE caller
now orders its admitted single projected ORDER term when requested; otherwise
producer DESC order survives an unordered consumer. Existing specialized fallback
and completed-child relocation remain live outside admitted forms. This does not
establish general ORDER/index or VM construction/execution ownership equivalence.
Focused public oracle-derived regression: `select-cte-order-owner.test.mjs` checks
DESC, repeated references, LIMIT/OFFSET and reset against pinned native results.

Current bounded expression-producer evidence: the correlated scalar aggregate
probe over constant `UNION ALL` derived rows now keeps transient source columns
in resolution but emits the producer into the enclosing aggregate rather than
opening a root-page-zero Btree. See the linked scalar aggregate entry in
`SQLITE_SOURCE_MAP.md`; this does not retire other SELECT compiler fallbacks or
establish general compound/derived expression support.

In the bounded linked scalar aggregate, predicate/argument lowering now consumes
`ResolvedColumnUse` source and column identities rather than repeating a name
search in the compiler (including implicit rowid). See the linked identity
correction in `SQLITE_SOURCE_MAP.md`; the transient derived schema and other
independent walkers remain to be migrated.

The physical-table scalar expression-subquery consumer now binds resolved
reduction/source/column identities from the linked NameContext, including
implicit rowid, for result/WHERE/ORDER trees. CASE operands, WHEN tests, THEN results and ELSE results in the bounded physical-table expression-subquery target now retain these same linked reduction identities in expr.c TK_CASE order; the source-ID-verified users fixture CASE IN/NOT IN probe and public three-encoding two-cycle/error regression cover this correction. No new generic CASE/subquery shape is admitted. See the physical scalar linked
identity entry in `SQLITE_SOURCE_MAP.md`; the separate joined caller and
compound-derived transient descriptor remain separate unfinished work.

The joined-row scalar aggregate consumer now binds linked NameContext reduction
identities (including outer rowid and the second joined source) directly to its
physical parent cursors. Its old independent spelling/ambiguity walk is retired;
the parent scan and scalar aggregate destination are unchanged. See the joined
scalar correlated target entry in `SQLITE_SOURCE_MAP.md`. This does not fold
the derived-row register binder into a physical cursor binder or remove the
finished-child fallback.

For the bounded scalar aggregate over a constant compound-derived source, the
resolver's transient descriptor now assigns collision-free first-arm EList
names before the linked NameContext walks its WHERE expression. The child
producer writes each arm's projected value into its matching ordinal register
before the predicate and AggStep read it. This preserves the pinned
`select.c:sqlite3ColumnsFromExprList` naming and positional producer contract
without opening a root-page-zero Btree. See the compound-derived duplicate
entry in `SQLITE_SOURCE_MAP.md`. The independent transient-name implementation
in other producer branches, general derived shapes and finished-child fallback
are not retired by this bounded repair.

Table-backed compound-derived output has a separate consumer from the bounded
correlated scalar aggregate. The first-arm transient names determine both the
outer projection ordinals and public result names (`select.c:sqlite3ColumnsFromExprList`),
including collision suffixes. `compileSingleCompoundDerived` now resolves each admitted table arm onto one
`SelectProgramBuilder` and calls `compileInnerTableSelect` with the same
`SelectDest` (output or sorter), not completed child Programs. The old ad hoc
control-edge list missed WHERE `ShortCircuit.jump` and skipped a first-arm row;
child relocation is retired for this caller. `compileInnerTableSelect` previously
terminated every parent-owned output row as if it were SRT_Mem; the source's
`selectInnerLoop` only exits after a one-row destination. It now continues
SRT_Output/SRT_Sorter scans and exits SRT_Mem/SRT_Exists on their first row.
This is bounded table-arm ownership, not unified compound/derived lowering. See `SQLITE_SOURCE_MAP.md` and paired
`select-table-compound-names-*`.

#### Window-derived materialization on one enclosing builder (card-t-c)
Pinned `select.c:sqlite3Select` tag-select-0488 initializes `SRT_EphemTab`,
compiles the window child with `sqlite3Select(pSub,&dest)` before the outer
predicate, and leaves the outer ORDER/LIMIT to its consumer. For the admitted
single-source window-derived predicate route, `compileDerivedProducer` now
resolves the child and invokes `compileWindowSelectLowering` with a parent
`SelectProgramBuilder` and typed sorter destination (zero keys), rather than
copying a finished child's ops and substituting `ResultRow` afterward. The
window lowering's output loop consumes that destination at emission time; its
nested coroutine PCs retain their owning stream. Child Halt exits continue to
the parent spool scan, which applies WHERE then ORDER and LIMIT/OFFSET. The
`select-derived-window-parent-*` pinned/public pair verifies INTEGER ranks,
name, zero and nonzero LIMIT, reset and missing-name prepare diagnostics; the
structural gate checks the owning builder/destination. The existing other
window/compound/CTE fallbacks remain live, not covered by this bounded test.

#### Bounded table-backed LIMIT-derived coroutine (card-t-c)
Pinned `select.c:sqlite3Select` tag-select-0482 calls `sqlite3Select(pSub,
&dest)` with an `SRT_Coroutine` in the enclosing Vdbe; `selectInnerLoop`
consumes the child LIMIT/scan before the outer SELECT consumes its yielded
register range. For admitted single-source table-backed, one-result-column
inner SELECTs with LIMIT (no inner WHERE/ORDER, DISTINCT, windows or compound),
`compileDerivedProducer` resolves child metadata then calls the existing
`compileInnerTableSelect` with the parent `SelectProgramBuilder` and coroutine
destination. Its scan owner patches exits to the enclosing `EndCoroutine`;
the parent owns its independent LIMIT/OFFSET and final output. Neither a
completed child nor PC relocation is used for this branch. Pinned/public
`select-derived-table-parent-*` verify integer type, transient name, inner and
outer limits, zero rows, reset, missing name and cleanup; the structural gate
asserts the owner handoff. Other table/window/compound fallback branches remain
live and separately unverified, and the shared WHERE planner interface remains
owned by [[card:card-s]].

### Ordered constant UNION ALL derived coroutine (card-t-c bounded non-VALUES caller)
Pinned `select.c:sqlite3Select` tag-select-0482 (8054–8073) creates the
FROM coroutine in its enclosing Parse/Vdbe, initializes an `SRT_Coroutine`
destination, calls `sqlite3Select(pSub, &dest)`, and ends the coroutine before
the outer consumer. For the admitted ordered single-column, no-FROM UNION ALL
producer, `compileDerivedProducer` now allocates the typed compound sorter,
limit/offset registers, row range and return register on one parent
`SelectProgramBuilder`, and emits drained rows through `emitSelectDestination`
instead of relocating a completed `compileScalarSelect` Program. Constant-arm
sorter lowering is the existing documented bounded browser adaptation of
`multiSelectByMerge` (preserves ordered typed keys and compound LIMIT/OFFSET);
this change only moves its owner to the enclosing coroutine. Native/public
`select-derived-nonvalues-parent-*` compare typed cells, names, zero/outer
limits, missing name, reset and lifecycle, alongside VALUES and compound
controls. Table-backed, window and other compound derived fallback producers
still need independent source comparisons and tests; this is not general
coroutine composition.

### Derived no-FROM VALUES coroutine destination (card-t-c bounded caller)
Pinned `select.c:multiSelectValues` (2862–2900) walks linked VALUES terms in
order, calling `selectInnerLoop` with the *same* `SelectDest` for every row;
`sqlite3Select` then lets the parent read the derived producer through its
coroutine. For the admitted single-source no-FROM multirow VALUES shape,
`compileDerivedProducer` now allocates one parent `SelectProgramBuilder` and
emits each term's expression registers to a shared coroutine `SelectDest`
(`Copy` into stable output registers, then `Yield`), followed by
`EndCoroutine`. It no longer compiles/relocates a finished `compileScalarSelect`
Program on that route. Outer ORDER/LIMIT/OFFSET remain parent destination
operations; parameters, Mem cells and VM private-state cleanup remain shared.
`resolve.c`'s prepare-time derived column name failure is preserved at this
consumer boundary instead of falling through to a synthetic table/CTE error.
Paired pinned/public `select-derived-values-parent-{native.py,test.mjs}` checks
INTEGER/REAL/TEXT/BLOB/NULL, names, missing name, rows, reset and lifecycle;
`derived-values-registers.test.mjs` covers parameters, encodings and limits.
Other no-FROM compound/ordered child and physical/window derived producers still
use independent finished-child fallbacks and are not covered by this migration.

### 2026-10-01 compound-arm CTE identity (bounded repair, [[card:card-t-c]])

Pinned `src/select.c:multiSelect` TK_ALL invokes each `sqlite3Select` with a
shared destination, and `resolve.c:resolveSelectStep` resolves a CTE FROM term
before generating its arm. `lowerOrdinaryCtes` already retained declaration/use
identity in each arm's `cteDerived`; `compileCteUnionAll` incorrectly sent these
arms through physical-table resolution and reported `no such table: q`. For the
represented single-column no-FROM SELECT/VALUES CTE producer, it now resolves
and emits rows into a parent-builder ephemeral destination, sharing the cursor
by `CteUse`, then scans an independent duplicate reader per arm into the
compound output. No finished-child PC relocation or schema-table fiction is
involved. Unsupported producer/consumer shapes reject atomically as temporary;
this is not general CTE, merge, WHERE, or compound support. Pinned/public pair
`select-cte-compound-source-native.py` / `.test.mjs` covers ordinary, forced
materialized and repeated NOT MATERIALIZED use, typed rows, names, missing
column, reset and close. Physical-table `wherecode` is unchanged.

#### Zero-source scalar derived coroutine, bounded ownership slice ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 calls the inner SELECT with
`SRT_Coroutine` in the enclosing Vdbe; `selectInnerLoop` computes LIMIT before
row production and jumps to the coroutine end for empty predicates/limits.
`vdbeaux.c:sqlite3VdbeAddOp3` appends to that same stream. For a simple
non-aggregate/non-window, non-compound, no-FROM derived SELECT without inner
ORDER/DISTINCT/GROUP/HAVING, `compileDerivedProducer` now emits the zero-source
candidate into the parent builder's coroutine destination rather than compiling
and relocating a completed scalar Program. Parent controls graph/labels and
child LIMIT, predicate and result registers; `vdbe.ts` stepping still owns
runtime PC, Mem and coroutine suspension (`vdbe.c:OP_InitCoroutine`, `OP_Yield`,
`OP_EndCoroutine`), reset and sticky errors (`vdbeaux.c:sqlite3VdbeReset`).
`select-derived-scalar-owner-{native.py,test.mjs}` use source-ID-checked public
SQLite and TS public API for INTEGER/REAL/TEXT/BLOB/NULL, WHERE false, LIMIT 0,
OFFSET exhaustion, reset/finalize and missing-column prepare error. Ordered,
aggregate, compound and other scalar fallback shapes still use the completed
child relocation: `select-vdbe-owner-boundary.test.mjs` continues to fail and
is not a whole-path acceptance check. This is not proof of exact work-budget
parity, all three encodings or suspended-concurrency equivalence. The adjacent
single-table owner gate now admits WHERE/multiple columns/no LIMIT when no
inner ORDER; its broader typed native parity is not established by this slice.

#### Unordered zero-source UNION ALL derived coroutine OFFSET ([[card:card-t-d]])
Pinned `src/select.c:multiSelect` TK_ALL forwards the shared LIMIT/OFFSET to
its arms and `codeOffset` (near line 879) jumps to the arm continuation before
`selectInnerLoop` decrements the output LIMIT. In the bounded no-FROM,
non-aggregate/non-window unordered UNION ALL derived producer,
`compileDerivedProducer` emits arms into the enclosing builder's coroutine
`SelectDest`. Its `IfPos` must target *after* `DecrJumpZero`, not merely after
`Yield`: offset candidates do not consume output quota. The VM `IfPos` and
coroutine PC handoff remain owned by stepping, not compiler relocation.
Source-ID-checked pinned public pair `select-derived-union-owner-native.py` /
`.test.mjs` checks typed INTEGER/REAL/TEXT/BLOB/NULL, LIMIT/OFFSET, LIMIT 0,
reset/finalize and prepare errors. The remaining finished-child fallback
(`select-vdbe-owner-boundary.test.mjs`) stays red: ordered/aggregate/other
compound callers are not migrated by this slice. This check does not establish
C1–C6/Chinook or broad suspended-concurrency/limits parity.

#### Ordered single-candidate derived SELECT ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 compiles the FROM subquery
into the enclosing coroutine. For a no-FROM, non-aggregate scalar candidate,
ORDER BY an admitted EList alias or valid ordinal cannot reorder its sole
candidate, so the same parent-owned zero-source destination handles it without
a sorter. `resolve.c:resolveOrderGroupBy` still owns validation before
production; the bounded gate recognizes an alias/valid ordinal and resolves
the SELECT before emitting the body. LIMIT/WHERE/OFFSET and VM coroutine
handoff remain as before. Public paired pinned tests
`select-derived-union-owner-{native.py,test.mjs}` add ordered alias, descending
ordinal with exhausted OFFSET, and LIMIT 0 to typed/reset/prepare-error cases.
This does not admit arbitrary ORDER expressions, multiple keys or other
finished-child fallbacks; the whole structural ownership check remains red.

#### Zero-source aggregate derived coroutine owner ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 calls the inner SELECT with
`SRT_Coroutine` in the enclosing Vdbe; aggregate accumulator update/finalize
precedes its `selectInnerLoop` output. The previously admitted no-FROM
aggregate derived shape went through `compileScalarSelect`, whose aggregate
expression is execution-only (an internal prepare error). The bounded
non-compound, non-window, non-grouped/non-ordered aggregate (including HAVING)
now calls the
existing `compileAggregateSelect` with the enclosing builder, parameters and
coroutine destination. Its `AggStep`/`AggFinal`, false WHERE, LIMIT-0 jump and
output go to the common `EndCoroutine`, not a completed child `Program`.
Source-ID-checked `select-derived-union-owner-{native.py,test.mjs}` compares
count(*), false WHERE count, LIMIT-0 sum, true/false HAVING after AggFinal,
typed output, two reset passes and
a prepare error. It is not a general aggregate/derived implementation:
compound, grouped, ordered and window producers and other fallback callers
remain separately gated; structural relocation test remains red.

#### Bounded table-derived DISTINCT and ascending sorter destinations ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 emits a table-backed subquery
into the enclosing coroutine. The existing `compileInnerTableSelect` already
owns `OpenEphemeral`/`Found`/`IdxInsert` for DISTINCT and a `SorterOpen` /
`SorterSort` / `SorterData` drain for ORDER; both lead through its common
`emitSelectDestination`, with LIMIT/OFFSET and empty exits patched to the
parent continuation (not OP_Halt). `compileDerivedProducer` formerly excluded
both from its `tableProducer` gate, even though the finished-child fallback
composed precisely these instructions with manual PC relocation. The bounded
single-table/non-window/non-grouped gate now passes its resolved plan, parent
builder, shared parameters and coroutine destination to that source compiler.
The existing descending-order atomic exclusion remains: it is not repaired by
changing compiler ownership. A source-ID-checked public pinned pair,
`select-derived-table-parent-{native.py,test.mjs}`, covers DISTINCT expression,
ascending index/ORDER and descending expression sorter with LIMIT, typed rows,
metadata, two reset cycles, finalize and prepare error. This is a caller
migration, not a VM state machine change or an assurance that all derived
fallback/ORDER/WHERE shapes are accepted; structural owner check remains red.

#### Bounded ordered ungrouped aggregate coroutine ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 calls the no-FROM aggregate
with an enclosing `SRT_Coroutine`. Its ungrouped aggregate branch finalizes
accumulators, checks HAVING, clears `sSort.pOrderBy` (one aggregate output row),
then invokes `selectInnerLoop` before the enclosing `EndCoroutine`; the sorter
tail is not needed. The existing `compileAggregateSelect` similarly resolves
ORDER through `resolveOrderGroupBy`, emits one finalized candidate and applies
LIMIT/OFFSET before the parent destination. `compileDerivedProducer` now sends
bounded single-key aliases/ordinals for this shape directly to that parent
compiler, including out-of-range positive ordinal literals so the resolver
can issue the pinned prepare error rather than an unrelated scalar unsupported
error. Multiple ORDER keys and arbitrary expressions remain outside this gate.
The paired public source-ID-checked `select-derived-union-owner-{native.py,test.mjs}`
adds descending alias, exhausted OFFSET ordinal and invalid ordinal, with typed
rows, two reset passes, finalize and prepare errors. Other child Program
composition still exists; this is not a broad sorter, limits or VM parity claim.

#### Bounded zero-source GROUP BY derived coroutine ([[card:card-t-d]])
`select.c:sqlite3Select` tag-select-0482 compiles the child into the enclosing
`SRT_Coroutine`. In the GROUP BY branch it computes/sorts group keys, detects
group transitions, finalizes accumulators, checks HAVING and feeds
`selectInnerLoop` before the coroutine ends; no separate finished Vdbe is
copied. The existing `compileAggregateSelect` already owns this bounded
`simpleGroupShape` path with parent builder/parameters/destination, including
zero-source one-candidate grouping, sorted payload, accumulator reset,
HAVING reject and LIMIT/OFFSET exits. `compileDerivedProducer` now routes that
shape to the parent even when no aggregate function exists (`hasGroupBy` alone
triggers aggregate grouping in SQLite). Source-ID-checked paired public
`select-derived-union-owner-{native.py,test.mjs}` adds true/false group HAVING
and exhausted OFFSET, typed cells, reset twice, finalize. Table-backed grouped,
compound/window and other fallback callers remain separately gated; this
slice does not claim full grouping, VM or budget parity.

#### Bounded single-table grouped derived coroutine ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 compiles the derived SELECT
against the enclosing Vdbe. Its GROUP BY branch obtains source rows through
`sqlite3WhereBegin`, sorts/compares group keys, updates/resets accumulators,
finalizes groups, checks HAVING, and calls `selectInnerLoop` on the enclosing
`SRT_Coroutine` before ending the coroutine. The existing parent-aware
`compileAggregateSelect` owns the corresponding source cursor, grouped sorter,
HAVING, LIMIT/OFFSET and coroutine destination; `compileDerivedProducer` now
routes bounded single-table `simpleGroupShape` there rather than falling into
`compileTableSelect` (which rejects GROUP BY). The gate still excludes
multi-source, compound, window, DISTINCT and arbitrary multi-key ORDER; its
single-key ORDER uses the existing alias/ordinal resolver. The source-ID-checked
paired public `select-derived-table-parent-{native.py,test.mjs}` adds a grouped
row and grouped HAVING, type/name, two passes of reset and finalize on the
pinned subquery fixture. Fixture t1 has only odd values: grouped `a%2` yields
`1`, not a fabricated zero group. VM runtime state stays under the stepping
loop; other finished-child fallbacks remain, and no broad WHERE/index, work
budget or full grouped SELECT equivalence is claimed.

#### Bounded single-table ungrouped aggregate producer ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 generates the aggregate child
into the enclosing Vdbe. Its no-GROUP branch calls `sqlite3WhereBegin`, updates
the accumulator on matching rows, calls `sqlite3WhereEnd`, finalizes, clears
`sSort.pOrderBy`, checks HAVING and feeds `selectInnerLoop` into
`SRT_Coroutine`. This is not ordinary scalar table-row projection: a
`count(*)` cannot reach `compileExpressionTree` as an execution-only scalar.
`compileDerivedProducer` now excludes aggregate expressions from the ordinary
`tableProducer` gate and admits bounded single-table ungrouped aggregates in
the parent-aware `compileAggregateSelect` gate. That existing compiler owns
the table scan, WHERE skip, accumulator/finalization, HAVING, LIMIT and
coroutine destination. The source-ID-checked paired public
`select-derived-table-parent-{native.py,test.mjs}` adds WHERE count and
HAVING-rejected count with a child LIMIT, typed name/cells, reset twice and
finalize. It retains exclusions for compound, window, DISTINCT, multi-source
and arbitrary multi-key ORDER; other finished-child fallbacks remain. No full
aggregate, WHERE/index, work-limit or VM parity is implied.

#### Bounded zero-source UNION derived destination ([[card:card-t-d]])
Pinned `src/select.c:multiSelect` builds compound arms in the enclosing Vdbe;
`sqlite3Select` tag-select-0482 supplies `SRT_Coroutine`, while `vdbe.c`
executes ephemeral insertion and traversal. `compileDerivedProducer` now emits
single-column, integer-literal-only unordered UNION arms into a parent-owned
`OpenEphemeral`/`IdxInsert` set, sorts and drains with `EphemeralRewind`/
`EphemeralNext` into its coroutine destination. LIMIT/OFFSET applies to the
sorted distinct output, not the input arms; the skip continues at Next and
cannot consume the output limit. This bounded routing removes the finished-child
PC relocation for these cases, not for other compounds: expression affinity,
collations, noninteger keys, mixed operators, multi-column and ordered compounds
still retain their previous compilation paths. Paired source-ID-checked public
`select-derived-union-owner-{native.py,test.mjs}` verifies distinct sorted typed
rows, offset, two reset passes and finalize. This does not establish the
structural ownership test or broad work-budget/suspension parity.

#### Bounded zero-source EXCEPT/INTERSECT derived set ([[card:card-t-d]])
Correction to the preceding UNION mapping: pinned `src/select.c:multiSelect`
(lines 2990–3005) actually synthesizes ORDER BY 1 and dispatches unordered
non-ALL compounds to `multiSelectByMerge`, not the unordered set loop. The
bounded one-column integer-literal parent emitter retains the VM's typed
set/delete/intersection + ordered-drain representation already used by direct
`compileScalarSelect` as an adaptation; it is not an opcode-for-opcode
translation of merge. This is safe only under the gated integer literals:
no collation/affinity variation, duplicate sort keys or observable branch
expression effects; LIMIT/OFFSET applies after distinct ordering. The new
EXCEPT/INTERSECT arms use parent `SetDelete` and auxiliary-set
`SetRetainIntersection`/`ClearEphemeral` before draining, preserving set
operation order. Public pinned/source-ID paired `select-derived-union-owner-*`
checks typed EXCEPT and INTERSECT with LIMIT/OFFSET and two reset passes.
This does not establish work-unit or error-order parity with upstream merge;
all other types/ORDER/compound forms retain their prior path. Residual child
relocation and the structural ownership failure remain.

#### Bounded mixed set-prefix / UNION ALL derived coroutine ([[card:card-t-d]])
Pinned `src/select.c:multiSelect` lines 2990–3047 recursively codes a non-ALL
left prefix using `multiSelectByMerge` (implicit ORDER BY 1 when unordered),
then for a final TK_ALL passes the same destination and LIMIT/OFFSET to the
right arm. The bounded one-column integer-literal-only parent producer now
materializes the set prefix in typed ephemeral state and drains it in key order
into `SRT_Coroutine`, then emits trailing UNION ALL arms with the shared output
limit and offset. A skipped prefix row advances the cursor; reaching LIMIT
jumps past the tail; a skipped tail arm does not decrement LIMIT. This is the
same restricted ephemeral adaptation noted above, **not** a translation of
SQLite's merge coroutine state or its exact work/error order. Only set-prefix
then ALL-tail, no-FROM no-WHERE integer literals enter this gate. Source-ID
paired public `select-derived-union-owner-{native.py,test.mjs}` now tests
prefix duplicates, tail duplicates, exhausted offset, limit stopping in prefix
and limit crossing into tail over two reset passes. Other mixed forms still
use finished-child composition, so structural ownership remains red.

#### Bounded BINARY text set-prefix derived coroutine ([[card:card-t-d]])
Pinned `select.c:multiSelect` dispatches unordered non-ALL via implicit ORDER
BY 1 into `multiSelectByMerge`; `multiSelectByMergeKeyInfo` and result
collation govern comparison, while TK_ALL shares the destination and limit.
For single-column literal strings without COLLATE, the result collation is
BINARY and the existing `KeyInfo`-driven ephemeral comparison and `Mem` text
encoding preserve typed order, duplicates and OFFSET before coroutine output.
Expanded the parent-only set/mixed gate from integer literals to include
literal strings; no explicit COLLATE, numeric coercion, arbitrary expressions,
BLOB, NULL or compound ORDER BY enters it. Pinned source-ID public paired
`select-derived-union-owner-*` now covers BINARY text UNION sort, duplicate
removal, EXCEPT, ALL tail and OFFSET over two reset passes. This does not prove
upstream merge work/error parity; remaining nonliteral callers retain fallback.

#### Scalar storage-class set prefix in derived coroutine ([[card:card-t-d]])
Pinned `select.c:multiSelect` (2990–3050) uses implicit ORDER BY 1 / merge
for non-ALL and forwards the destination and shared LIMIT for TK_ALL;
`multiSelectByMergeKeyInfo` chooses comparison, with `vdbeaux.c` Mem/record
comparison and `vdbe.c` coroutine step controlling runtime ordering. The
existing bounded single-column parent set gate now accepts *unadorned literal*
INTEGER, finite REAL, TEXT, NULL and BLOB; typed `Mem` and `KeyInfo` (BINARY)
keep NULL < numeric < text < blob, NULL deduplication and integer/real equality
in the ephemeral state rather than converting keys to JS strings. This is an
exceptional finite-literal browser set-materialization adaptation, not pinned
merge's comparison-by-step control flow: exact work budget, intermediate error
order and native suspension parity are not established. Paired source-ID
`select-derived-union-owner-*` tests NULL/REAL type/order/offset/ALL and BLOB
sort/EXCEPT/ALL through public prepare, step, reset and finalize. Explicit
COLLATE, arbitrary expressions, multiple columns, ORDER and table/window
producers remain outside this gate and completed-child fallback remains live.

#### EXCEPT/INTERSECT-only set prefix with ALL tail ([[card:card-t-d]])
Pinned `select.c:multiSelect` 2990–3055 uses implicit ORDER BY 1 merge for a
non-ALL left prefix, then TK_ALL forwards its destination, limit and offset
and conditionally skips the right arm after exhausted LIMIT (`OP_IfNot` and
`OP_OffsetLimit`). The existing parent literal set-prefix/drain plus ALL-tail
path already implements empty prefix and output offset/limit transitions, but
its gate mistakenly required a UNION arm. Admitted EXCEPT/INTERSECT-only
prefixes into that same bounded typed one-column literal path. Public paired
source-ID `select-derived-union-owner-*` exercises empty EXCEPT prefix and
INTERSECT prefix with offset crossing to right arm, plus reset. Remaining
nonliteral/ordered and full merge work/error differences stay excluded.

#### Constant-expression set arms in parent derived coroutine ([[card:card-t-d]])
Pinned `src/select.c:multiSelect` (2990–3055) compiles each scalar arm into
the enclosing destination; non-ALL prefixes use implicit ORDER BY 1 merge,
TK_ALL shares LIMIT/OFFSET. `vdbeaux.c:sqlite3VdbeAddOp3` constructs opcodes
rather than executing scalar arms, and `vdbe.c` owns their runtime `Mem`
values/step order. An actual admitted residual nonliteral arm was unary signed
number or binary sum of two INTEGER literals. The parent set/mixed gate now
admits just unary +/- on finite numeric literals and one binary integer +
(no parameters, columns, function side effects or exception-producing
operations); existing `compileExpression` emits opcodes into the enclosing
builder, and typed KeyInfo compares evaluated results before coroutine output.
This finite materialization remains an explicit merge adaptation, not a general
constant folder; integer overflow and work/error ordering must not be inferred
from these bounded tests. Source-ID paired `select-derived-union-owner-*`
exercises signed arm and integer addition in set prefix and ALL tail, with
reset/finalize. Remaining nonliteral shapes still use fallback.

#### Bound parameters in bounded derived set-prefix coroutine ([[card:card-t-d]])
Pinned `vdbe.c:OP_Variable` 1575–1590 reads the bound Mem at execution time;
`OP_Yield`/`OP_EndCoroutine` retain the enclosing statement's program counter
and register state across `step`. `select.c:multiSelect` 2990–3055 compiles
non-ALL prefix then TK_ALL with one destination and shared output limit;
`vdbeaux.c:sqlite3VdbeAddOp3` is construction, not binding execution. A
nonconstant, already admitted finished-child caller `?1 UNION SELECT 2 UNION
ALL SELECT ?2` previously bypassed the parent set path. Its typed one-column
prefix/tail now emits `Variable` into the enclosing builder via existing
`compileExpression`, sharing parameter builder, bindings and reset with the
parent VM; `?` numbering is assigned in arm order before limit compilation.
Paired source-ID `select-derived-bound-native.py` and public `.test.mjs` bind,
step, reset/rebind, finalize across UNION and EXCEPT + ALL offset transitions.
The finite ephemeral set/drain remains a bounded merge adaptation; exact
native work/error ordering and nonliteral expression/collation combinations
are not established. Binding lifetime/large-blob parity needs separate evidence.

#### Multi-source table producer in derived coroutine ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 invokes `sqlite3Select` on the
FROM subquery with SRT_Coroutine in the enclosing Vdbe; `selectInnerLoop`
routes result registers through this destination, and `wherecode.c` loops
advance and unwind before `vdbeaux.c` opcode construction ends. Runtime
`vdbe.c:OP_Yield`/`OP_EndCoroutine` controls PC/register handoff, not the
compiler. The TS `compileInnerTableSelect` already takes a parent builder,
parameter builder and coroutine destination, while its independent-Program
route remains for top-level selects. The derived-table gate formerly admitted
only a single physical source. It now forwards noncompound, nonaggregate,
nonwindow table producers with multiple sources through that same owner path;
where.c path selection, join ON, selected indexes and loop exits remain with
`compileInnerTableSelect`, and the outer coroutine consumes produced rows.
Paired source-ID public `select-derived-join-*` covers inner join with sorted
LIMIT/OFFSET, LEFT JOIN ON expression and LIMIT 0, two reset passes. This does
not claim all RIGHT/index/order/suspension parity. Other compound/window
fallbacks still copy child PCs and are not removed; structural ownership test
remains red. No [[card:card-s]] WHERE planning policy is changed.

#### Multi-source UNION ALL table arms and outer sorter key width ([[card:card-t-d]])
Pinned `select.c:multiSelect` TK_ALL sends each arm to the same destination;
`sqlite3Select` tag-select-0482 builds derived coroutine in the enclosing
Vdbe. `selectInnerLoop` and `pushOntoSorter` (730ff) keep ORDER key count
separate from result payload count; runtime sorter insertion is VM-owned.
`compileSingleCompoundDerived` already compiles table arms into one parent
builder via `compileInnerTableSelect`, but restricted each arm to one source.
The arm gate now permits one or more physical sources under its unchanged
UNION ALL, projection and outer-clause guards. The existing sorter destination
must carry `keyCount: ordinal.length`, not default to the wider two-column
result payload: first run exposed `sorter key width does not match KeyInfo`,
an invariant explicitly enforced by `SorterCursor.insert`. The owning
`SelectDest` supplies the distinct key width while the payload retains all
output columns. Pinned/public `select-derived-joined-union-*` pairs ordered
and unordered JOIN/LEFT JOIN arms, typed two-column rows and reset. This is a
bounded outer-order adaptation; mixed, inner ORDER/LIMIT and unrelated
compound forms remain separate. Existing finished-child fallback still lives.

#### Multi-source derived aggregate producer ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 compiles the child into the
parent SRT_Coroutine; aggregate path `sqlite3WhereBegin` / `updateAccumulator`
/ `sqlite3WhereEnd` (8878ff) visits joined rows before finalization and
`selectInnerLoop` forwards a single result (including the empty-input
count), subject to LIMIT. In TS `compileAggregateSelect` already accepts
parent builder and destination and has a multi-source accumulator branch,
but `compileDerivedProducer` admitted only zero/one-source aggregates to
that destination. It now routes represented multi-source noncompound,
nonwindow, nondistinct aggregate children through the existing parent path;
`aggregateShapeSupported` and resolver still enforce the aggregate subset.
Before the edit, pinned source-ID public paired `select-derived-joined-aggregate-*`
confirmed count 2, empty count 0 and LIMIT 0, twice across reset. Public TS
hit `execution-only expression reached scalar lowering` because the child
fell into table compilation. After the gate fix the same public cases pass.
This does not establish joined aggregate GROUP BY/RIGHT/index/work parity.
The finished-child fallback remains live for other producer shapes.

#### Materialized window child without outer WHERE ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 emits the FROM window
producer in the enclosing Vdbe; `window.c:sqlite3WindowRewrite` and
`select.c` sorter/result path produce window values before an outer
WHERE/ORDER/LIMIT. An outer WHERE is not mandatory: for a SELECT without
it, the outer scan enters projection directly after each materialized
`SorterData`, before advancing `SorterNext`. The bounded
`compileDerivedProducer` window branch already uses the parent builder and
materialized destination, but required `select.where`, and its predicate
jump was unconditional. It now emits that jump only when WHERE exists.
Pinned/public `select-derived-window-no-where-*` pairs cover integer
`row_number` rows, outer descending ORDER/LIMIT/OFFSET, LIMIT 0, reset and
missing-column prepare error. Before migration, pinned oracle passed but TS
rejected the shape at the table-scan exclusion. This only extends that
bounded materialized window route, not the live finished-child fallback or
general window/compound work/error equivalence.

#### DISTINCT joined aggregate derived coroutine ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 constructs the derived
producer in the same Vdbe, then the aggregate path accumulates joined rows
(`sqlite3WhereBegin`/`updateAccumulator`/`sqlite3WhereEnd`), finalizes,
filters the result through its DISTINCT ephemeral set (`selectInnerLoop` /
`codeDistinct`) and forwards the row to the coroutine; the DISTINCT set
precedes destination OFFSET/LIMIT. `vdbeaux.c:sqlite3VdbeAddOp3` construction
is compiler-side, whereas `vdbe.c:OP_Found` and `OP_Yield` execute the set
and coroutine state. TS `compileAggregateSelect` already implemented the
aggregate distinct-result cursor and parent `SelectDest`, but its derived
admission gate rejected `hasDistinct`, sending count(*) to scalar table
lowering (internal error). Admit that existing path; do not alter VM state or
WHERE planner. Pinned/public `select-derived-distinct-aggregate-*` tests
exercise integer count 2, empty count 0, LIMIT 0, two resets. This does not
establish general DISTINCT grouping/index/work-error parity, nor remove the
remaining finished-child relocation.

#### Zero-source DISTINCT derived coroutine ([[card:card-t-d]])
Pinned `select.c:sqlite3Select` tag-select-0482 builds the child in the
parent Vdbe; `selectInnerLoop` calls `codeDistinct` before `codeOffset` and
`SRT_Coroutine`. The default unordered DISTINCT branch emits `OP_Found` then
`OP_IdxInsert` (`select.c:codeDistinct`); `vdbeaux.c` constructs these ops and
`vdbe.c:OP_Found` performs the VM lookup. TS previously rejected zero-source
DISTINCT from parent scalar-producer admission and sent it to
`compileScalarSelect`, which rejected its clause. For this finite scalar
producer, allocate an ephemeral typed KeyInfo set in the shared builder and
filter the evaluated result before OFFSET/Yield; LIMIT 0 exits before result
expression evaluation and WHERE false before insertion. No VM PC/register,
WHERE planner or binding lifecycle policy changed. Pinned/public
`select-derived-distinct-scalar-*` tests cover integer, LIMIT 0,
OFFSET and WHERE false with two reset passes. Multiple-result rows, complex
collations, and precise native work/error order are not proven. The finished
child relocation remains live for other unadmitted forms; the earlier joined
DISTINCT table-arm probe already passed through the existing parent route.

#### Joined UNION ALL child with shared compound LIMIT ([[card:card-t-d]])
Pinned `select.c:multiSelect` TK_ALL copies the rightmost LIMIT/OFFSET into
its left prefix, compiles the prefix in the same Vdbe/destination, tests the
remaining `iLimit` before the tail, and forwards the shared registers to the
tail (`selectInnerLoop` applies OFFSET before output LIMIT). `vdbeaux.c`
constructs the branches and `vdbe.c` executes PC, counter, cursor and
suspension state. The already parent-owned joined table-arm producer had
rejected a child compound LIMIT and the fallback rejected complex table arms.
For its existing bounded table-arm UNION ALL, initialize compound LIMIT once
in the parent builder, pass the shared register pair through
`compileInnerTableSelect`, and branch over later arms when exhausted. Arm
loops still own their WHERE/index scan and break patching; the VM still owns
PC, registers, typed Mem and suspension. Pinned/public
`select-derived-compound-limit-*` pair covers joined LEFT/INNER table arms,
OFFSET crossing arms, LIMIT exhausted before the tail, LIMIT 0, outer ORDER,
and two reset passes. This does not implement ordered child compounds, set
operators, general compound arms, or exact native work/error ordering; the
finished-child fallback remains live.

#### Ordered joined UNION ALL derived producer ([[card:card-t-d]])
Pinned `select.c:multiSelectByMerge` generates source coroutines, comparison
keys and merge output into the enclosing `SRT_Coroutine` destination;
`select.c:sqlite3Select` tag-select-0482 keeps the derived producer in its
parent Vdbe. The current bounded TS route for joined `UNION ALL` table arms
already builds scans in one `SelectProgramBuilder` but rejected a child ORDER
BY. A finite prefix-ordinal BINARY child order now has its own typed sorter
and drain *before* the existing outer ORDER sorter/output. This is an
**exceptional algorithm substitution**, not a translation of native merge:
the current TS table-arm compiler exposes scan-to-destination but lacks two
independently resumable arm coroutines with comparison/permutation state;
a parent-owned sorter keeps typed Mem/KeyInfo ordering, one VDBE budget and
consumer-visible child/outer order for the restricted key while retaining
source graph and scan ownership. Source-based pinned/public
`select-derived-ordered-joined-*` tests check joined INNER/LEFT arms, child
ascending first-column order, outer ascending/descending order, typed integer
results and reset. This does not establish native incremental work/error
order, equal-key tie order, DESC child, non-prefix keys, COLLATE, or
other operators: retain rejection and fallback, and replace sorter with
source merge lowering as coroutine dependencies mature. The VM still owns
PC/register/cursor/suspension; no independent evaluator was introduced.

#### Ordered joined compound output LIMIT ([[card:card-t-d]])
Pinned `select.c:multiSelectByMerge` computes the compound LIMIT/OFFSET,
clones `iOffset+1` (or `iLimit`) into **separate** input limits for each
coroutine, clears the right input OFFSET, then applies original OFFSET and
LIMIT at merge output (`generateOutputSubroutine`), before returning to the
outer consumer. Unlike unordered `multiSelect` TK_ALL, input scans must not
consume the shared output counter. In the restricted parent-owned sorter
adaptation, both joined table arms now feed the child typed sorter without
output LIMIT/OFFSET; the child drain skips OFFSET candidates and decrements
LIMIT only after emitting to the outer destination. Zero limit exits the
producer before scanning. This preserves tested output ordering and counters,
not pinned input-capacity, incremental suspension, budget or error ordering:
the native arm-specific capacities/merge remain to be translated. Pinned and
public `select-derived-ordered-limit-*` tests compare five typed cases twice
across reset (cross-arm OFFSET, outer ORDER asc/desc, zero LIMIT, final row).
No new VM execution or WHERE planner policy was added.

#### Zero-source scalar derived ORDER expression ([[card:card-t-d]])
`resolve.c:resolveOrderByTermToExprList` resolves simple SELECT ORDER terms
against the result NameContext, and `select.c:sqlite3Select`
tag-select-0482 emits the derived child into the enclosing `SRT_Coroutine`.
A no-FROM scalar has at most one candidate, so its ORDER expression must be
resolved (including missing-column errors) but need not compare or sort any
rows; LIMIT 0 still exits before candidate evaluation. The previous
`compileDerivedProducer` admission required an ordinal or bare alias and
sent an otherwise valid `ORDER BY n+1` to the finished-child scalar compiler,
which rejected it. The source-owned scalar branch now admits a single ORDER
expression and calls `expandAndResolveSelect` before publishing the coroutine
body; existing LIMIT/WHERE/DISTINCT/destination logic remains unchanged.
Pinned/public `select-derived-scalar-order-expression-*` cover expression
ORDER asc/desc, LIMIT 0/OFFSET, INTEGER type and reset. Multi-term ORDER is likewise resolved but needs no sorter for one candidate;
expression evaluation/error parity beyond resolution is not claimed;
finished-child relocation elsewhere remains.

#### Multi-term zero-source derived scalar ORDER ([[card:card-t-d]])
Pinned `resolve.c` resolves *each* simple SELECT ORDER term before
`select.c:sqlite3Select` tag-select-0482 compiles the zero-FROM child into
its parent SRT_Coroutine. The scalar producer has one candidate: changing its
ORDER admission from at most one term to any number preserves its already
parent-owned LIMIT/WHERE/DISTINCT/destination branches, while resolution
validates every term before publication. Aggregate ORDER admission remains
independent and at most one term; no aggregate admission was widened.
Pinned/public `select-derived-scalar-multi-order-*` checks mixed asc/desc
terms, LIMIT 0, OFFSET, INTEGER and two reset passes. This does not prove
runtime evaluation of unused ORDER expressions or error/work parity. Other
finished-child fallback callers remain.

#### Ungrouped aggregate derived multi-term ORDER ([[card:card-t-d]])
`select.c:sqlite3Select` tag-select-0482 compiles the derived accumulator
into the enclosing SRT_Coroutine; `resolve.c:resolveOrderGroupBy` checks
ORDER terms against the aggregate NameContext. The no-GROUP accumulator
produces at most one output candidate, so multiple resolved ORDER terms do
not need a result sorter. In `compileDerivedProducer` the independent
`aggregateProducer` admission now permits multiple ORDER terms only without
GROUP BY; `compileAggregateSelect` already lowers these into AggInfo before
steps and emits into the parent builder. Grouped aggregate admission remains
bounded and the earlier table-scan DESC exclusion remains intact. Pinned/public
`select-derived-aggregate-multi-order-*` cover joined count, empty count,
LIMIT 0, INTEGER and resets. This does not establish general grouped ORDER,
DESC table scans, work/error parity or removal of the remaining fallback.

#### No-FROM UNION ALL arm predicates in parent coroutine ([[card:card-t-d]])
`select.c:multiSelect` TK_ALL forwards the same SRT_Coroutine and shared
LIMIT/OFFSET across arms; `selectInnerLoop` applies each arm's WHERE before
expression loading, OFFSET, destination and LIMIT decrement. `resolve.c`
resolves both arms before stepping. The previously excluded no-FROM arm WHERE
fell through to the finished-child `compileScalarSelect` and rejected at
prepare. `compileDerivedProducer` now resolves each admitted arm in the child's
SELECT context, emits `IfNot` to the next arm *before* loading its row, and
keeps the existing shared LIMIT, OFFSET and coroutine destination. The
parent builder owns jump targets; `vdbe.c:OP_IfNot` and `OP_Yield` retain PC,
register and suspension state at runtime. Paired
`select-derived-union-where-*` tests cover true/false/NULL predicates,
LIMIT 0, OFFSET across an arm boundary, INTEGER and two resets. This does not
remove the remaining relocation fallback or establish work/error parity or
arbitrary expressions/compound arm scans. WHERE/index contracts of
[[card:card-s]] were not modified.

#### Ordered no-FROM UNION ALL arm predicates ([[card:card-t-d]])
The preceding unordered-arm predicate repair exposed a distinct fallback:
`ORDER BY 1` sent no-FROM `UNION ALL` arm WHERE through finished-child
`compileScalarSelect`, rejecting at prepare. In pinned `select.c:multiSelectByMerge`,
`resolveOrderGroupBy` resolves compound keys, A/B coroutines apply their own
WHERE before emitting rows and `generateOutputSubroutine` applies final
OFFSET/LIMIT after merge. The bounded one-key constant-arm parent builder
still uses its documented typed sorter adaptation (not native A/B merge);
it now resolves each arm using the full SELECT context, branches on WHERE
before expression loading/sorter insertion, and retains the existing shared
outer drain counters. `vdbe.c` remains PC/register/cursor owner. Paired
`select-derived-ordered-arm-where-*` checks true/false/NULL, LIMIT 0, OFFSET,
INTEGER and two resets. Incremental merge, per-arm capacity, work/error
ordering, collations, ties and physical table/index WHERE remain unproven;
finished-child fallback remains live for other shapes.

### Resumed derived table-set destination slice (HEAD f5bb86ef plus peer dirt)

`compileDerivedProducer`'s single-source outer direct projection with LIMIT/OFFSET
can bypass `compileSingleCompoundDerived` and formerly splice a completed
`compileSimpleTableCompound` Program. The represented single-column physical
rowid table arms now emit through that primitive into the enclosing builder's
SRT_Coroutine. Allocation, set/order transitions, limit exits and parameters stay
in the caller Parse; completion falls through to EndCoroutine, not child Halt.
Pinned `select.c:multiSelect`, `selectInnerLoop`, tag-select-0482 own this path.
The owning table-arm read now also follows `expr.c:TK_COLUMN` INTEGER PRIMARY KEY
alias lowering to Rowid rather than the NULL payload field. Source-ID guarded
`select-derived-table-parent-native.py` and public companion cover UNION ALL,
UNION and empty EXCEPT, INTEGER/name/reset/inner and outer limits; the new slice
structural test requires parent builder/destination emission. This is not the
whole ownership gate: remaining non-table compound/aggregate guards can still
reach finished-Program relocation; the broader owner assertion stays red and
must not be weakened to credit this slice. Joined continuation copying (~3146)
is distinct remaining work. No WHERE interface or new index breadth changed.

The next bounded resumed slice migrates no-FROM SELECT-arm ordered UNION ALL
with wider rows/multiple ORDER keys from the completed-program fallback into
that same enclosing coroutine. `resolve.c:resolveCompoundOrderBy` alias/ordinal/
structural identity order and `select.c:multiSelectCollSeq` result collation feed
KeyInfo; each arm fills a complete payload and separate key range. The existing
finite-row typed sorter adaptation remains, rather than adding a merge evaluator.
`select-derived-table-parent-native.py`/public companion now include a two-column,
two-key child with outer OFFSET, checked before consuming this migration. The
public case already returned the right INTEGER row under the old fallback: this
is ownership correction, not a claimed new row difference. The slice structural
gate requires wide rows/multiple keys in the parent. VALUES arms, set/mixed richer
expressions and aggregate-order misses still require a full caller census and
migration; the general ownership gate remains red.

Compound VALUES tails/intermediate arms now feed every `valuesRows` entry into
the existing ordered or streaming parent UNION ALL destination. Pinned
`select.c:multiSelectValues` iterates SELECT rows under the same Parse/destination;
this representation keeps that row cardinality instead of only `arm.result`.
Paired oracle/public coverage includes SELECT UNION ALL VALUES with outer OFFSET
and an intermediate VALUES arm followed by SELECT with ORDER/LIMIT. A final
VALUES followed directly by ORDER is native syntax error and was discarded from
the proposed valid-shape matrix, not silently accepted as an oracle case. Both
valid cases were supported under relocation before this ownership migration.

The resumed scalar set/mixed slice admits represented single-column no-FROM
expression arms (not just a spelling whitelist of literals), including VALUES.
`select.c:multiSelect` UNION/EXCEPT/INTERSECT feeds complete right-arm rows into
its set destination; INTERSECT retention occurs only after that complete arm.
The shared KeyInfo now obtains first explicit arm result collation from
multiSelectCollSeq. UNION ALL before the final set operation accumulates there;
only the final ALL tail streams without deduplication. Paired pinned/public
arithmetic + multi-row VALUES UNION and mixed ALL/INTERSECT/ALL cases preserve
previously supported INTEGER/name/reset/limit behavior under parent ownership.
Remaining wider/ordered sets and aggregate-order misses still reach fallback.

The same scalar set owner now carries complete multi-column rows: each result
column supplies its multiSelectCollSeq KeyInfo term; contiguous parent ranges
feed insertion/deletion, intersection and coroutine output. This prevents
projected-column-only deduplication (two rows equal in x but different in y must
both survive). Paired oracle/public two-column UNION VALUES and mixed intersection
cases were passing under the old completed child before ownership migration;
slice structure now requires full-width keys/output. Ordered sets remain open.

Ordered set/mixed derived producers now consume the existing supported
one-column/one-key scalar contract in the parent: resolve compound ordinal,
alias or structural identity; feed the complete set prefix and ALL tail to one
parent sorter, then apply shared LIMIT/OFFSET and coroutine destination. Native
`multiSelectByMerge` sorts/merges arms; this retains the existing documented typed
set-plus-sort finite-producer adaptation, not a new evaluator. Paired public/native
descending UNION and mixed intersection/ALL cases passed before migration and
retain INTEGER/name/reset/limits/lifecycle. Proposed two-column ordered sets were
native-valid but public temporary unsupported; they remain outside this bounded
ownership slice, not silently promoted to support.

Grouped derived aggregate producers now delegate their full represented ORDER
list to the existing parent-aware `compileAggregateSelect` owner, instead of a
redundant one-term guard falling through to non-aggregate table compilation.
Pinned `select.c:sqlite3Select` grouped output sort and selectInnerLoop destination
share the enclosing Parse; TS aggregate owner already resolves multiple result/
group ORDER keys and emits that destination. Paired pinned/public aggregate
alias plus group alias keys (`a%3`, count) expose the previous typed-temporary
misdispatch and now verify INTEGER/name/limits/reset/lifecycle. Earlier physical
scan-descending exclusion remains unchanged: this slice does not approve it or
claim descending derived grouped support. Broader ownership gate remains red.

Zero-source set/mixed derived arms now resolve each arm context and branch on
WHERE false/NULL before inserting or streaming rows. As in `select.c:sqlite3Select`
and `multiSelect`, a filtered INTERSECT right arm still completes its set
transition: the branch skips production, not intersection retention. ALL tails
skip their own output; no WHERE is discarded in a finished-child fallback.
Paired pinned/public false UNION, NULL prefix/tail and empty right INTERSECT
cases cover this owner. Shared physical WHERE planner interfaces are unchanged.

Compound zero-source DISTINCT is an arm property, not global compound
output deduplication. `select.c:selectInnerLoop/codeDistinct` filters each SELECT
candidate before its destination; represented scalar SELECT arms have at most
one candidate, so DISTINCT is redundant (including false WHERE). Parent ALL,
ordered ALL and set owners now admit it locally, excluding VALUES/multi-row and
aggregate/group arms from that proof. Pinned/public duplicate DISTINCT arms
under UNION ALL retain both rows; ordered and set probes preserve destinations.

Zero-source unordered UNION ALL accumulator arms now compile through the
parent-aware aggregate owner. WHERE belongs to accumulator input: count with
WHERE false still produces zero, not no output. A parent ephemeral destination
bridges its at-most-one completed accumulator row to the common ALL limits and
coroutine, without finished Program copying. This bounded materialization is
needed because aggregate owner currently completes local output limit jumps;
upstream multiSelect passes one destination directly. Mem/KeyInfo and row order,
empty-input semantics and shared compound limits are retained and paired tests
cover false-input count and inner/outer OFFSET. Arm HAVING is not yet carried as
an expression by SelectArm; it remains typed temporary, not dropped or inferred
from the top SELECT. Direct shared aggregate limit ownership remains a gap.

SELECT semantic arms now retain their own HAVING ExprNode reduction from
`having_opt` (VALUES null). The optional internal field permits existing
synthetic arm producers; admission requires an actual reduction when hasHaving
is true. Unordered zero-source aggregate ALL arms use that exact carrier for
resolver validation and aggregate final-row filtering; no top-level/rightmost
HAVING reuse. The CTE per-arm projection retains it too. Pinned/public first-arm
false HAVING and middle NULL/final true HAVING probes establish empty output
versus empty accumulator input; missing HAVING column remains SQLite code 1 and
subsequent prepare succeeds. The one-row parent bridge remains an adaptation
gap pending direct shared-limit aggregate destinations.

The zero-source unordered aggregate ALL bridge above is superseded: the existing
aggregate owner now consumes an explicit compoundLimit carrier (including absent
limit), emits directly to the common SRT_Coroutine, and returns exhaustion jumps
to the compound owner. Only that owner patches the initial zero-limit jump and
common break. HAVING rejection and OFFSET bypass decrement; successful yielded
output decrements after resumption, exactly as selectInnerLoop/multiSelect TK_ALL.
No ephemeral row copying remains in this slice. Grouped aggregate calls cannot
use this bounded compound carrier; their existing output-sort owner is unchanged.

Physical one-column compound arm DISTINCT: live inspection disproved the
suggested zero-source noncompound DISTINCT exclusion (scalarProducer already
admits it). The actual defect was compileSimpleTableCompound ignoring each
physical arm's hasDistinct, including ALL tails. Each arm now owns an unordered
transient distinct cursor/KeyInfo from its output column collation. Found skips
to that arm's Next before destination/compound limits, matching
select.c:codeDistinct/selectInnerLoop. Duplicate suppression is local, not a
compound global set, and sorter insertion occurs only after that check. Pinned
public duplicate INTEGER ALL and ordered ALL/OFFSET probes cover this repair;
text/NULL distinct comparator machinery is reused but not independently probed
by this slice. No broader compound expression admission is implied.

Physical compound GROUP/HAVING admission audit: the raw one-column table scan
was accepting these flags and silently ignoring them. Unlike DISTINCT, GROUP
needs its own arm expression list/AggInfo (SelectArm currently carries only the
flag, not the GROUP list). compileSimpleTableCompound now rejects any such arm
before resolution/emission as typed temporary; this is not rejection of correct
supported execution. Pinned grouped t2.x returns [1,3,9], whereas the former raw
scan forwards [1,1,3,9]. First/last GROUP and first HAVING tests enforce atomic
rejection, and a subsequent valid prepare still works. Standalone grouped and
noncompound derived aggregate owners are unchanged. Full grouped compound
production requires GROUP carrier plus resolver/aggregate destination migration;
this guard is a truthful boundary, not completion of that migration.

Grouped ALL parent slice supersedes the raw-scan rejection only for represented
unordered derived compounds whose every physical arm owns a supported GROUP
list. parse.armAction now retains that list (optional internal synthetic-arm
carrier, VALUES empty), CTE arm projection preserves it, and groupedAllProducer
uses the exact arm result/FROM/WHERE/GROUP/HAVING for resolution and existing
compileAggregateSelect destination production. Group continuation emits directly
to common coroutine; shared limit jumps leave all arms, and only compound owner
patches initial zero. HAVING false/empty groups and OFFSET do not decrement.
Mixed grouped/raw arms, ordered compounds and set operators still reject via
raw-owner guard; no blanket grouped compatibility claim. Paired tests cover
cross-arm LIMIT/OFFSET, rejected-first groups and zero limit.

Mixed grouped/raw unordered derived ALL supersedes the all-grouped-only
restriction: physical ordinary arms delegate to compileInnerTableSelect with an
explicit compoundLimit carrier, not the raw compound scan. Both existing owners
share destination and break; the ordinary owner leaves initial zero and output
exhaustion to compound, but preserves local empty-scan/WHERE/OFFSET continuation.
No direct WHERE-plan changes. At least one grouped arm is required by this
specialized route; raw-only existing compound routes remain unchanged. Non-group
HAVING cannot enter the ordinary producer, and ordered/set forms remain temporary.
Pinned/public probes cover group-first/raw-first, exhaustion before later groups,
false ordinary WHERE, cross-arm OFFSET and zero limit. Existing type/name/reset
checks remain; origin metadata differential and broader join/resource checks are
not established by this slice.

Grouped/mixed physical ALL metadata correction: columnTypeImpl in pinned
select.c:1984–2004 follows a derived result column to its source expression,
not a generic null descriptor. The represented compound route now resolves its
rightmost arm with that arm's WHERE/GROUP/HAVING carriers for descriptor production,
using the existing expanded result descriptors and outer projection rename.
Production and metadata therefore share resolver ownership; no second SQL walker
or metadata-only expression evaluator. Pinned C/public probes compare name,
declaredType/database/table/origin for grouped-first, raw-first and aliased t1.a
first followed by t2.x (origin is t2.x). Non-column/aggregate expression
metadata and general nested compound origin coverage remain open.

Raw-only physical compound derived metadata follows the same pinned
columnTypeImpl ownership as grouped/mixed: last Select arm supplies origin/type,
leftmost result supplies names. The former conditional first-arm plan produced
t1.a metadata for `(SELECT a AS x FROM t1 UNION [ALL] SELECT x AS other FROM t2)`;
pinned C reports name x and origin main.t2.x. Both raw and grouped routes now
share resolved last-arm descriptors with independent leftmost names, retaining
actual arm WHERE/GROUP/HAVING. Paired public C/public TS ALL and UNION metadata
probes plus name/descriptor structural assertion cover the change. Standalone
compound descriptors and general noncolumn/nested type inference remain unaudited.

Standalone compound metadata countercheck: independently pinned direct
`SELECT a AS x FROM t1 UNION [ALL] SELECT x AS other FROM t2` reports
x/INTEGER/main/t1/a, unlike its derived wrapper's rightmost origin. Existing
compileSimpleTableCompound left/output descriptor is correct for these direct
cases; do not propagate the derived-origin fix into standalone publication.
Paired native/public assertions retain both contracts. This disproves the
proposed standalone-origin defect; no production change was warranted.

Joined ordered ALL first-scan migration: live census found compileJoinedUnionAll
still compiled a finished table Program and copied PCs by +1 into an enclosing
sorter. The same represented specialized branch now supplies its builder,
parameters and sorter SelectDest to compileInnerTableSelect while emitting.
No finished child or PC mapping remains within this branch. Source destination
ownership follows selectInnerLoop SRT_Sorter; the finite joined-plus-scalar
sort strategy remains the existing adaptation, not upstream multiSelectByMerge
completion. Pinned/public join ON, duplicate join output and scalar tail ORDER1
probe precedes implementation; structural assertion requires parent destination
and excludes copying. General derived fallback and joined scan continuation
relocation inside compileInnerTableSelect remain separate unresolved paths.

Live ordered ALL VALUES repair supersedes the predicted joined-tail caller:
compileCteUnionAll dispatches ordered statements to compileOrderedCteUnionAll
before compileJoinedUnionAll. A pinned joined ON arm + intermediate VALUES(4),(5)
+ SELECT9 ORDER1 returned all six rows; public dropped 5. Changing the dormant
joined-tail loop did not affect the reproducer and was reverted. The actual
ordered composer's zero-source producer now traverses every valuesRows member
and emits each complete row through existing SelectDest, consistent with
select.c:multiSelectValues forward pNext/selectInnerLoop iteration. Shared
parameters/register range, arm predicate skip and sorter remain unchanged.
Pinned count(*) tail already passed: no aggregate defect inferred here.

Ordered per-arm GROUP/HAVING: pinned sqlite3Select's compound ownership precedes
per-arm aggregate production; select.c:8747/8909 suppress output on false/NULL
HAVING. Public entry previously classified rightmost HAVING as the entire
aggregate (name t2.x instead of x), while ordered composer rebuilt empty GROUP
and null HAVING. Bounded physical-source one-column ORDER1 ALL now dispatches to
compound owner first; compileTableSelect attempts its represented ordered owner
before ordinary clause rejection. Actual arm GROUP/HAVING carriers are retained,
GROUP even without aggregate calls uses existing aggregate producer, and
nonaggregate HAVING errors rather than disappears. Missing carriers reject typed
temporary. Pinned/public join+count HAVING0/NULL and grouped x HAVING x>1/0 with
scalar tail compare INTEGER rows/name/two reset cycles. Other compound admission
and finite-sort adaptation remain incomplete; no generic merge claim.

Ordered ALL KeyInfo now follows select.c:multiSelectCollSeq (2574–2590) and
multiSelectByMergeKeyInfo (2600–2630): traverse arm result collations left-first,
stop at first actual collation (a literal without COLLATE is not implicit BINARY),
then apply explicit ORDER COLLATE override or default BINARY. Consume actual
flattened arm resolution once for descriptor/ordinary producer and collation;
finalize parent SorterOpen KeyInfo before publication. Pinned/public text probes
cover left explicit NOCASE, later explicit NOCASE after uncollated literal and
ORDER BINARY override with two reset cycles. Expression-level implicit collation
through non-direct functions/casts remains a gap; direct-source descriptors and
explicit expression COLLATE are covered by this branch, not a complete expr.c
sqlite3ExprCollSeq translation.

Implicit collation follow-up: `resolve.ts:resolvedImplicitCollation` consumes
resolver columnUses identity, peeling parentheses, CAST and unary plus only,
matching expr.c:sqlite3ExprCollSeq248–279 column/CAST/UPLUS branches. Ordered ALL
uses this owning resolver-linked primitive before direct/merged descriptor fallback.
It does not infer implicit collation through concatenation or ordinary functions.
Pinned/public existing NOCASE orders.note fixture: CAST and +note sort 'a' before
'Alpha'; note||'' sorts 'Alpha' before 'a'. Name/text/two resets/finalize checked.
No new SQL matching or recursive generic expression evaluator. Deferred-affinity
function/vector/register variants and reuse by other comparison callers remain
unmigrated; broader expressionCollation walker still needs source comparison.

Comparison collation follow-up: expressionCollation now follows expr.c:
sqlite3ExprCollSeq COLUMN/MEM, CAST/UPLUS and explicit EP_Collate path; ordinary
concat/function/CASE do not inherit an implicit column collation. binaryCollation
implements sqlite3BinaryCompareCollSeq420–441: explicit left/right, then nullable
implicit left/right, default BINARY last. Previously left default BINARY hid
right column NOCASE, and broad walkers overpropagated implicit collation.
Pinned/public orders.note comparisons cover concat/lower/CASE negative controls,
CAST/+ positive controls, right column and explicit override, with min(note,'Z')
regression control. Function argument NEEDCOLL ownership is distinct: its existing
explicit-only argument selection remains unresolved, not claimed repaired by
these expression-result changes. Deferred-affinity function branches still open.

Scalar NEEDCOLL follow-up: functionArgumentCollation uses the existing immutable
registry need-collation flag and expr.c:5400/5457 first non-null argument collation
loop/default. Both opcode generation and retained constant expression evaluator
consume it. Earlier implicit column wins over later explicit COLLATE, unlike
binary comparison's explicit precedence. This does not assign argument collation
to function result. Pinned/public beta/Z min/max, reversed argument/explicit
BINARY order, concat negative control and nullif(note,'BETA') NULL cover the
owning contract. Shared Mem/async Function dispatch unchanged. Remaining implicit
deferred-affinity/vector/register variants and duplicated generator walkers
remain open; not general expression/source-composition acceptance.

Ordered ALL per-arm DISTINCT admission: actual compileInnerTableSelect already
owns select.c:codeDistinct/selectInnerLoop filtering (ephemeral KeyInfo, Found,
IdxInsert before destination and continuation to Next). The ordered composer
incorrectly rejected top-level hasDistinct (the rightmost arm's flag), routing
legitimate right-arm DISTINCT plus join into unsupported fallback. Removed this
compound-wide guard, not the per-arm DISTINCT filter. Ordinary arms still use
the existing owner; single-row zero-source DISTINCT is locally redundant; an
unrepresented DISTINCT multirow VALUES carrier rejects atomically. Pinned/public
left DISTINCT t2 + raw9, raw join + right DISTINCT t2 and NOCASE/NULL orders.note
DISTINCT + Z cover local dedup, ALL retained duplicates and typed reset/finalize.
No global ALL dedup and no new filter/evaluator. Expression DISTINCT collation
through arbitrary result expressions remains unverified.

DISTINCT expression KeyInfo follow-up: compileInnerTableSelect now follows
select.c:sqlite3KeyInfoFromExprList1598–1620 (ExprNNCollSeq), consuming exact
resolved result reduction for explicit/CAST/UPLUS implicit collation instead of
public type/origin descriptor. Normalize/validate built-in name before KeyInfo;
default BINARY only when expression has no collation. Public/pinned CAST/+note
DISTINCT ALL removes Alpha/ALPHA duplicates, concat retains both; NULL and two
resets/finalize checked. Other DISTINCT owners remain to be audited, not claimed
migrated. No new dedup algorithm or global ALL filter.

Direct physical DISTINCT follow-up: public single-table CAST/+note DISTINCT
also retained ALPHA incorrectly; native pinned removes it, concat retains both.
Direct physical and ordinary parent-destination producers now share
resolvedResultKeyTerms (select.c:sqlite3KeyInfoFromExprList1598–1620), consuming
resolver-linked reduction plus explicit flag walk, final default and name
validation. Removed duplicated term construction rather than changing the
Found/IdxInsert/scan continuation algorithms. Both paths are regression-tested
with NULL/text and reset/finalize; descriptor metadata remains separate.

#### Top-level zero-FROM GROUP BY admission contract ([[card:card-t-b]])
Pinned `resolve.c:resolveOrderGroupBy` resolves integer GROUP BY ordinals to
result expressions and `resolveSelectStep` rejects aggregate keys. Pinned
`select.c:sqlite3Select` grouped branch admits a zero-FROM candidate: one
accepted row forms one group, a WHERE-rejected row forms none. Current public
support matches this bounded contract. `test/select/first-select.test.mjs`
replaces the stale unsupported expectation with native-pinned INTEGER/REAL/NULL,
name, empty-group, reset/done/finalize and invalid-key assertions. This contract
correction does not waive the separate finished-child ownership gate or claim
general grouped composition parity.

### card-t-d RIGHT continuation output-break ownership (2026-10-01)
Pinned wherecode.c:sqlite3WhereRightJoinLoop invokes the one right-join interior subroutine (Gosub), with sqlite3VdbeNoJumpsOutsideSubrtn controlling exits; select.c:selectInnerLoop owns output LIMIT/iBreak. Current compileInnerTableSelect still clones the interior body instead of translating that subroutine architecture. The parent scalar SRT_Mem caller in compileScalarSelect exposed a concrete divergence: a cloned DecrJumpZero retained zero target, restarted at caller initialization, and erased its output to NULL. Track output-limit exits as compiler-owned addresses, including the cloned copy, and resolve both to the enclosing continuation/common compound break. VM PC/register/Mem/budget/suspension behavior is unchanged; no WHERE/index policy expansion. Public/pinned select-right-continuation pair covers OFFSET first/late/end/exhausted and LIMIT0, INTEGER/NULL and two resets. Remaining clone/subroutine substitution is not native error/work parity and is NOT full ownership acceptance. Parent card-t-c owns general derived fallback migration; card-t-d owns this WHERE continuation output contract. Do not remove other live splices based on this repair.

Joined ordered ALL derived fallback migration: compileDerivedProducer now admits
physical joined first arm plus zero-source ALL tails with ORDER ordinal 1 (no
inner LIMIT/window/GROUP/HAVING). It resolves descriptors without publishing a
child; compileOrderedCteUnionAll consumes enclosing builder/parameters and
SRT_Coroutine destination. Sorter drain emits through selectInnerLoop destination,
empty exit falls through to parent's EndCoroutine; no finished child/pcMap in
this branch (select.c:sqlite3Select8054–8074). Existing finite-sorter ordered ALL
adaptation unchanged, not claimed upstream merge migration. Public/native
wrapped join+scalar outer LIMIT/OFFSET tests, zero limit/empty join/bound tail
public probes and source branch assertion preserve ownership distinction.
Other derived fallback remains; window sourceProgram and derived aggregate
children, wider compound/nested transient shapes and complete runtime census
remain open. RIGHT continuation/outputLimitStops belongs to card-t-d, untouched.

Unordered mixed physical/scalar ALL derived producer: compileDerivedProducer
mixedPhysicalAllProducer now delegates to compileCteUnionAll owner overload,
sharing enclosing builder/parameters/SRT_Coroutine (select.c:multiSelect TK_ALL
3020–3060; sqlite3Select8057–8074). Physical WHERE/Next stays in ordinary
producer, zero-source output uses same destination, exhaustion falls through
parent EndCoroutine. Descriptor names follow first arm, derived origins/types
follow last arm; no child Program/pcMap for this slice. Admit ordinary SELECT
ALL arms without inner LIMIT, DISTINCT, VALUES, CTE/derived, aggregate/GROUP or
window; keep other source-specialized owners. Pinned/public physical/scalar,
reverse order, empty and outer LIMIT0 variants; missing tail column prepare error
public. Joined ordered family remains. Other fallback consumers remain red.

### card-t-d RIGHT interior: one parent subroutine (2026-10-01)
Supersedes the RIGHT clone adaptation above, not the retained general derived
fallback. `wherecode.c` BeginSubrtn after ON/match recording and
`sqlite3WhereRightJoinLoop`, `where.c:sqlite3WhereEnd` RIGHT continue/break
Returns, and `vdbe.c` BeginSubrtn/Gosub/Return now map to the live
`compileInnerTableSelect` path: one inline body, compiler entry/continue/break
addresses (`rightBody`), NULL return register on matched entry, and Gosub of
that same body on unmatched RHS rows. Downstream WHERE/index empty/IN/LEFT exits
reach the RIGHT continue Return; right-source exhaustion has a separate Return.
Unmatched scan nulls both left table/index cursors and RHS selected index.
No completed body slicing, delta relocation, or copied output-limit fixups remain.
Scalar, EXISTS, coroutine, sorter and compound callers still share their original
destinations/counters; output exhaustion leaves the producer, not merely the call.

VM Return now mirrors pinned P3 NULL-fallthrough; Gosub preserves already-advanced
TS PC (C stores current PC then increments in its dispatch). Mem remains the
address owner. The live window child composer remaps new register-bearing ops;
its larger finished-child path is not retired. Boundary validation translates
vdbeaux.c:sqlite3VdbeNoJumpsOutsideSubrtn's *debug* invariant, not runtime rewriting:
interior/Return targets and producer early termination are admitted. Gosub and
coroutine transfers retain their separate caller contracts. This is narrower
than native debug opcode classification and is not complete opcode parity.

Pinned/public `select-right-continuation` now covers eight typed cases/two resets,
NULL, matched/unmatched IN, downstream LEFT/index-IN, scalar LIMIT/OFFSET and
sorter drain; structural gate demands one body and subroutine ops. No scope or
index policy expansion. Bloom acceleration, multiple RIGHT barriers, full native
work/error order and general window/derived ownership remain gaps. Broad owner
gate remains red; focused convergence is not full compatibility acceptance.

Compound-derived standalone aggregate no longer compiles per-arm Programs or
rewrites their ResultRow/Halt/PCs. select.c:sqlite3Select8114–8128 SRT_EphemTab
and multiSelect TK_ALL guide one enclosing builder: resolve each arm, ordinary
physical/aggregate owner emits ephemeral destination; zero-source/VALUES rows
emit same destination. Insertion-order ephemeral preserves ALL duplicates and
source order (existing browser representation of rowid transient table), scanned
with EphemeralRewind/Data/Next before aggregate finalization. Empty scan skips
steps but finalizes count0; output metadata/existing LIMIT admission unchanged.
Source updateAccumulator6808/call8891 owns step semantics. Pinned/public count,
sum, empty, duplicate rows, name/type/reset/finalize and public missing-column
error cover this replacement. Existing aggregate expression lower/forRow walkers
remain a separate resolver/AggInfo fidelity gap; no complete aggregate migration
claimed. Other derived/window armPrograms copying remains explicitly RED.

Ordinary mixed ALL arm DISTINCT is now delegated, not a compound admission
exclusion. compileDerivedProducer reuses mixedPhysicalAllProducer's enclosing
coroutine contract; compileCteUnionAll no longer treats rightmost select.hasDistinct
as compound-wide. Physical arm compileInnerTableSelect retains its own resolved
KeyInfo/Found/IdxInsert before destination (select.c:codeDistinct933 and
selectInnerLoop1297); zero-source SELECT has one candidate, so its DISTINCT is
locally redundant. DISTINCT VALUES remains excluded from this composer pending
its own multirow filter, rather than silently yielding duplicates. No new shape
compiler/state or evaluator. Pinned/public constant duplicate physical arm plus
DISTINCT scalar tail returns [4,4], not global ALL dedup; reverse arm order,
outer LIMIT0, typed/name/reset/finalize and missing-column error covered. These
ordinary arm semantics now reach the shared builder rather than generic child
Program relocation; generic derived/window copying still explicitly red.

Ordinary unordered ALL now owns compound LIMIT/OFFSET in its enclosing
builder (select.c:multiSelect3018–3041 iLimit/iOffset across arms).
compileCteUnionAll computes registers once, passes compoundLimit/stops to
compileInnerTableSelect, applies offset/output/decrement to zero-source rows,
and resolves stop targets only after all arms are compiled. Exhaustion falls
through parent EndCoroutine (or standalone Halt); outer coroutine LIMIT stays
independent. LIMIT0 still resolves every arm for atomic missing-column errors.
Limited aggregate/window/transient/group destinations stay excluded until they
carry shared-limit ownership. No separate limited-shape evaluator/compiler.
Native/public WHERE physical+scalar ALL inner limits now pass (previously typed
unsupported, not an executed clone); parent mixed ordinary destination can now
consume inner limits instead of taking generic child fallback. This is a producer
prerequisite, not proof of exhaustive admitted fallback retirement. Reverse arms,
negative limit/offset, LIMIT0 and DISTINCT-before-offset covered. Generic pcMap
and window sourceProgram remain red until actual consuming paths are retired.

Grouped window rewritten source now emits AggInfo directly on the enclosing
window builder with SRT_Coroutine (select.c8055–8074, window.c39–53).
compileWindowSelectLowering retains the rewritten Select, reserves the current
window register/cursor ranges, allocates the payload range, and calls the existing
compileAggregateSelect owner overload at source-coroutine construction. Producer
high-water registers/cursors feed back to later window/outer sorter allocation;
EndCoroutine is emitted by the window caller. Buffer width/deferred OVER slots,
rewrite layers, Mem/KeyInfo/async lifecycle remain unchanged. No grouped child
Program, offset/pcMap or ResultRow rewriting remains in this branch. Recursive
CTE source copier is now retired by the source-coroutine destination below.
Pinned/public grouped sum/row_number, empty/LIMIT0 and parent ORDER a DESC
LIMIT/OFFSET with reset/type/name/finalize covered. ORDER BY window alias r was reproduced as a prepare error and repaired:
resolve.c resolveOrderGroupBy1818–1853 assigns result ownership to AS names
before ordinals/source lookup. Immutable resolver now carries orderResultColumns;
window rewrite lifts the referenced result expression, never the bare alias as
an input column. Parent drain consumes that result slot (window or lifted
aggregate), preserving parent sort flags/LIMIT/OFFSET. This corrects the prior
stale-carrier hypothesis: child order arrays were cleared, but parent alias r
was erroneously lifted into the child's result buffer. Alias r/s and ordinal2
native/public regressions preserve INTEGER pairs/names/reset/finalize. No
resolver diagnostic bypass, alias-specific SQL predicate or new evaluator. Broad generic copier gate stays
red. This is actual supported producer retirement, not a compatibility claim.


Recursive window source (select.c:generateWithRecursiveQuery2666–2848,
sqlite3Select8055–8074): compileRecursiveWindowSelect obtains CTE names from
explicit column names or seed expressions (no discarded metadata Program),
resolves the transient source, defers recursive Select to source-coroutine
construction. Existing compileRecursiveCteSelect shared builder/parameter and
SRT_Coroutine emit queue/current/output/recursive enqueue on enclosing window
ops after reserving window ranges. Registers/cursor high-water propagate back;
caller EndCoroutine and final builder.finish resolve empty-Queue labels before
publication. Standalone shared producers omit Halt; no source Program/copy/PC
remapping remains in window lowering. Initial unfinalized label gave repeated
empty Queue execution/work limit, corrected at publication owner, not VM symptom.
Native/public admitted recursive row_number, queue LIMIT0 and OFFSET/parent alias
ORDER reset/finalize regressions pass. Generic derived pcMap and other aggregate
copy owners remain; this is not exhaustive census or full compatibility acceptance.


Ordered aggregate ALL dependency (progressive, generic derived gate still RED):
select.c multiSelect2990 routes ORDER to multiSelectByMerge. The existing finite
sorter adaptation remains (browser async typed sorter; bounded represented arm
results, observable order/duplicates/types retained); this change does not claim
to translate merge or authorize wider substitution. compileAggregateSelect now
emits each arm with shared builder/parameters/SRT_Sorter, allocates a disjoint
sorter and output range, drains to caller SelectDest, omits Halt when shared.
Former completed armPrograms/control relocation/max-register reuse removed.
Derived ordered aggregate caller resolves first-arm descriptors without a
completed metadata Program and forwards its coroutine destination. Native/public
sum(a)/scalar ordered ALL returns INTEGER[8,16], s name/reset/finalize.
Generic derived residual pcMap is retained: exact negative admission partition
and transitive unresolved families in card-t-c status. This is a dependency
repair, not requested generic-owner completion or exhaustive census acceptance.


Residual ordinary physical compound dependency (card-t-c progressive):
compileTableCompoundProducer now owns the production table compound dispatch
(ORDER owner before clause rejection; unordered ALL then table-set owner).
Top-level compileTableSelect and residual physical compound FROM caller consume
it with their own SelectDest. FROM descriptors resolve last arm origins/types
and first arm names without completing a metadata Program. Source: select.c
multiSelect3010–3047 copies caller destination for TK_ALL arm calls; enclosing
sqlite3Select8055–8074 owns coroutine exhaustion. WHERE-bearing physical ALL
native/public rows INTEGER[3,9,1,1,3]; child LIMIT/OFFSET, outer limits, empty,
LIMIT0 and public missing tail column covered with two resets. General fallback
pcMap retained: CTE/nested/complex aggregate transitive admission census still
open. This shared dispatch dependency does not constitute general SELECT owner
completion; standalone JoinedUnionAll fallback remains pending exact overlap
census (not silently deleted). API unchanged; finite sort adaptations unchanged.

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

### CTE metadata acceptance investigation (card-t-c, still incomplete)
The residual CTE structural failure is a helper-placement assertion, not evidence
of compile/discard metadata: compoundArmColumns calls resolveTransientArm and
transientSourceTable owns unique names. Both existing structural reds remain
unchanged pending semantic/transitive acceptance. Pinned parse.y609 and1955ff
assign CTE SELECTs independent clause owners. A native/public metadata probe
with physical CTE LIMIT2 exposed selectAction's misplaced-clause guard incorrectly
counting WITH-body LIMIT as outer compound LIMIT. The guard now excludes tokens
owned by each WithClause.ctes Select, as it already excludes derived/expression
Select tokens; genuine outer misplaced LIMIT remains SQLITE. Native metadata
is x/INTEGER/main/t1/a with INTEGER rows1,3,9, but public now correctly reaches
atomic temporary at the existing scalar-only CTE producer admission, not row
parity. This is prerequisite error ownership repair, not metadata/composition
completion or widened producer admission. Native/type87/diff pass; earlier public
row assertion still failed temporary after this fix. Next required work: source-
faithful physical CTE consuming destination and transitive metadata acceptance;
no narrower supported behavior or structural assertion waiver.

### Physical CTE compound destination and metadata convergence
The preceding CTE LIMIT2 acceptance now passes rows/types/metadata/reset, not merely
temporary rejection. compileCteUnionAll materializes single-column physical child
on the shared builder via compileInnerTableSelect SRT_EphemTab, retaining child
LIMIT/predicate ownership. Existing CteUse-keyed cache, Gosub/Return and OpenDup
consumers remain (select.c8102–8139); no completed child relocation added.
Parent projection is bound by resolveTransientArm instead of duplicate name walk.
compoundArmColumns CTE results now follow producer semantic descriptors with parent
name; tested physical result INTEGER/main/t1/a. Scalar bounds remain unchanged;
outer compound LIMIT with specialized CTE arms remains temporary.
Structural acceptance now17/18: metadata gate checks transitive semantic helpers,
no compilation/ops/pcMap and physical ephemeral destination; old names/first/last
literal assumptions updated to actual shared-helper and names/current owners only
after production/public acceptance. Generic copier remains red, not waived.
Native/type233/diff pass; source gate17/18 exit1. No complete caller census/integration
claim: compileDerivedProducer fallback still copies inner Program with pcMap.
Other remaining copiers include compound aggregate paths and relocation helpers;
window owner itself emits shared grouped/recursive/retained sources. Caller inputs
and fallback reachability need complete classification before deleting generic debt.

### Generic fallback census exposed singleton ORDER regression
A temporary diagnostic at the generic pcMap branch ran the existing derived/CTE/
window/select suite:180 tests,174 pass,6 fail, **no branch hits**. Removed diagnostic
immediately. This is coverage evidence, not proof unreachable. Three failures were
old textual copier gates; three public regressions were the shared scalar owner
rejecting already-admitted zero-FROM ORDER expressions/multiple terms. Pinned
where.c6943–6952 explicitly satisfies the entire ORDER BY for zero tables and
marks DISTINCT unique; select.c ordinary loop consumes that ordering proof.
compileScalarSelect now resolves singleton ORDER terms before suppressing the
unnecessary sort carrier, retaining WHERE/LIMIT/OFFSET and expression ownership.
Missing ORDER identifier with LIMIT0 is SQLITE, not silent discard. Existing pinned
expression/multi-order public pairs pass, as do types/235 selected tests. Broad
suite now177/180 (three structural reds); main owner gate remains17/18. No generic
copier deletion or blanket admission narrowing.

Caller census continuation: nested scalar compileDerivedProducer(owner.scalarRetained)
rejects nested/window/aggregate and shares builder; ordered compound/ALL callers
pass owner.destination and reject nested/compound unsupported producers. Top-level
caller has no owner restriction. Within single-source retained parent branch,
VALUES, ordered ALL, scalar sets/mixed sets, ordinary physical, scalar singleton,
ungrouped/grouped aggregate, physical compounds, joined ordered ALL, mixed physical
ALL, and residual compounds have explicit shared emitters. Remaining fallback
compiles child via compileTableSelect or compileScalarSelect before copying; caller
admission includes shapes not covered by tests (nested derived, combinations of
VALUES/compound/aggregate/window exclusions). Complete rejection/producer-success
intersection is not proved. Do not replace this with throw based on no test hits.
Two-source JOIN-derived manual copies at later branches and compound aggregate
relocation are distinct debt, not hidden by the primary pcMap gate. Next work must
map successful compiler admission for each excluded flag combination against the
actual source owner, pin public oracle cases first, and replace reachable producer
paths using shared destinations. Full integration/C1–C6/Chinook still not run.

### Nested retained source admission census repair
Ten targeted public admission probes (generic-admission/probe4.log) again found no
pcMap hits, but nested LIMIT child fabricated SQLITE `no such table: (subquery)`.
This is tableProducer's synthetic-source misuse, not generic fallback reachability.
A bounded nestedProducer branch now builds semantic descriptors and recursively
calls compileDerivedProducer with the same builder/coroutine destination, per
select.c8048–8077; bypasses physical table lookup, not upstream producer ownership.
Each retained child owns SQL LIMIT independently. Native/public INTEGER1, metadata
main/t1/a, two reset cycles, nested OFFSET1→3 and LIMIT0 empty pass. Owner gate
18/19 after extending actual semantic-inner assertion; generic copier still red.
Native/type235/diff pass. Temporary probe setup failed three times (encoded node
imports, then relative fixture path); corrected purpose-work copy, no product
inference from those failures. Diagnostics removed. Recursive admission remains
bounded by existing owner checks; deeper nested/CTE/window/complex parent predicates
not widened. Source-based fallback admission intersection and no-copy replacements
still required; do not infer dead code from absent diagnostic hits.

### Residual retained producer copier retirement (bounded structural acceptance)
The actual compileDerivedProducer residual branch no longer compiles a child
Program for metadata then relocates PCs. Metadata comes from compoundArmColumns;
residual emission dispatches existing semantic owners on the same builder:
scalar multiSelect merge, table multiSelect, aggregate, physical inner SELECT,
and zero-source scalar SELECT. Each forwards the same SRT_Coroutine destination
and ends with EndCoroutine; parameter/register state remains parent-owned.
Pinned select.c8048–8077 calls sqlite3Select(pSub,&dest) on enclosing Parse;
select.c2987ff compound dispatch and selectInnerLoop own result production, not
post-hoc ResultRow/Halt conversion. No new evaluator or generic child relocation.

Caller census: scalar nested/ordered compound/ALL owner calls remain restricted
by existing owner guard; top-level residual follows the above dispatch. Prior
explicit VALUES/scalar/physical/aggregate/ordered/grouped/CTE routes are retained.
Successful child compiler intersection previously unproved is no longer grounds
for throw: semantic owners perform their own capability/error gates, atomically
before Program publication. This replaces the residual metadata compile and
ResultRow→Copy/Yield, Halt→EndCoroutine mapping without blanket rejection.
Remaining two-source JOIN-derived inner.ops manual copies and compound aggregate
relocation are distinct debt, as are wider specialized view/CTE and full resource/
metadata integration census. No global completion claim.

Verification: first broad199:196 pass/3 fail, all old structural test slice end
markers named uniqueTransientColumnNames, now outside this owner. Corrected to
substituteViewExpression; then278/279 exposed stale ordered-only branch delimiter
(the current branch combines setProducer||mixedProducer||ordered). Corrected
that actual boundary, keeping coroutine and no-copy assertions; added residual
semantic-dispatch/no-metadata-Program checks. Final native window/scalar/multi,
type279/279/diff0; owner gate20/20 included. Logs and dirty hashes in
work:///cards/card-t-c/generic-destination-repair/. Full C1–C6/Chinook not run.

### Second-source retained destination ownership
compileDerivedProducer's index1/two-source caller now resolves child columns
with compoundArmColumns and emits scalar/table compound, window, aggregate,
physical or scalar child through existing shared-builder owners. Pinned
select.c8048–8077 coroutine destination uses explicitly allocated payload range;
8102–8134 materialization destination uses enclosing ephemeral cursor and
Gosub/Return. Removed both actual inner.ops PC-copy loops and child metadata
compiler in this branch. InitCoroutine resets each outer-row child traversal;
EndCoroutine targets the parent's next outer row; empty materialization skips
inner scan. LIMIT/OFFSET remain child-owned. Parent output allocation follows
child high-water, no assumed innerColumn+1 payload. Legacy scan cursor range
0..30 is reserved before allocating materialized cursor; root-owned physical
WHERE interfaces untouched. Async/Mem/Btree/KeyInfo retained.

Caller bounds remain index1/two sources/direct two-column ordinal ORDER without
parent WHERE/group/limits. First-source spool copier, repeated/view/CTE and
compound aggregate relocation remain separate debt; no generic ownership claim.
Native/public CROSS and ordinary JOIN LIMIT2, CROSS LIMIT0, OFFSET2 preserve
INTEGER/name/reset behavior; selected284/284 includes residual no-copy/admission
regressions and owner20/20. Stronger destination/payload/no-Program gate passes.
The red's initial fixture expectation1,3 was incorrect (native independently
1,1); no row regression was invented. Logs/hashes:
work:///cards/card-t-c/two-source-repair/. No full C1–C6/Chinook/integrated candidate
or exhaustive window/compound second-source admission census in this evidence.

### First-source retained CTE spool ownership
The index0/two-source retained CTE caller resolves compoundArmColumns rather
than compiling a metadata Program. Its child now emits existing semantic
producer owners on the enclosing builder with a zero-key sorter destination;
no inner.ops copying, first-instruction splice or ResultRow/Halt rewriting.
Pinned select.c8102–8134 owns materialization before the next source. The
existing browser VM spool representation remains (bag, not deduplicating set):
SorterOpen→child destination→SorterSort/Data→outer Rewind/Next→SorterNext,
then parent ordering/output. Empty child goes directly to parent final sorter;
child LIMIT/OFFSET remain private, register high-water flows to parent payload,
output and expression temporaries. Parent spool/output/outer cursors now come
from builder.cursor; physical legacy cursor0..30 reservation is transitional,
not final nTab ownership. Root WHERE source identities are not changed here.

Caller map: actual CTE source0 reaches this retained branch; direct-derived
source0 probe still falsely reports no such table:d before it (separate gap).
Index1 shared destination and generic residual dispatch remain intact. Existing
specialized child dispatch invokes shared production owners, not a new evaluator;
consolidating remaining call dispatch requires wider admission evidence.
First-source pinned/public LIMIT2, LIMIT0, OFFSET2 INTEGER/names/reset and
missing-column LIMIT0 lexical error pass. Native second-source controls and
selected289/289/owner20/20/diff0 pass. Full metadata origin/type derivation,
limits/resources, C1–C6/Chinook integration and compound aggregate relocation
remain gaps. Artifact directory work:///cards/card-t-c/first-source-repair/;
initial type check found a leftover independent ++registers for parent sort key,
corrected to builder allocation before focused4/4 and final289/289.

### Compound aggregate consumer allocation correction
Current census supersedes predictions of compound aggregate PC relocation:
compileCompoundDerivedAggregate already emits UNION ALL producer arms through
shared owners on one builder. The remaining top-level materialized consumer
had detached registers/cursors and hardcoded output register1. Now accumulator,
aggregate ORDER sorter, input row, keys/payload/arguments, output and expression
temporaries all allocate on that builder; output uses SelectDest output through
emitSelectDestination. No child copier was invented or removed in this slice.
Pinned select.c aggregate finalizeAggFunctions → selectInnerLoop keeps Parse
nMem/nTab and result destination; producer materialization8102–8134 precedes
EphemeralRewind/Data/Next, empty scan still finalizes aggregates, ORDER sorter
finishes before AggFinal, then output expression compilation/publication.
Parent simple scalar-arm aggregate destination branch remains bounded and
unchanged; broader physical parent intersection is NOT enabled by this repair.
Only caller compileAggregateSelect invokes this helper before ordinary lowering.

Native/public physical+scalar count3, empty physical+scalar sum8, all-empty count0
and ordered sum+count exercise INTEGER/names/two resets; selected294/294 and
owner20/20 pass. Initial focused4/4/type/native pass, then stronger builder/output
assertions + ordered multi-result pair pass. Full metadata origins/errors,
resource limits/NULL-REAL corpus and wider parent contracts remain gaps. Logs
work:///cards/card-t-c/compound-aggregate-repair/. Direct-derived source0 lexical
reproducer/owner handoff and root WHERE legacy0..30 allocator seam remain as
recorded, not global blockers; no integrated candidate/C1–C6/Chinook claim.

### Current d integration after c714/b532 (2026-10-02)
See `docs/research/card-t-d-integration-c714.md` for current actual compiler/caller,
VM, remaining manual CTE fallback relocation, specialized walkers and root/s
cursor reservation contracts. Supersedes old live-derived/window-copy predictions
and old owner-gate0/1: integrated owner gate passes. Integrated652/648/4 red includes
internal merge context and trivial admission work-budget fixture failures; native
current aggregate/RIGHT/window, type and diff pass, not whole compatibility.
Preservation exports are mixed, not approved attributable combined patches.

#### d integration caller-contract repair
The four c714 integration reds were stale test inputs: internal UNION defaults
compiler must receive real schema/Btree merge context; coroutine inner six-unit
work budget must tighten that producer operation rather than constrain subsequent
same-connection admission SELECT1. Tests retain the set/SQL, exact error/finalize
and immutable defaults assertions. No VM budget relaxation/product change.
See integration census repair addendum and scoped two-test review patch.

### Forced/repeated CTE fallback destination repair
compileCteDerivedSources4374–4401 retains its fast paths; actual fallback now
uses semantic compoundArmColumns, one builder/ParameterBuilder and existing
producer owners with ephemeral destination. Removed finished-child Program map,
inner.ops PC offsets/ResultRow/Halt conversion, cursor60 and max-register merge.
Pinned select.c8102–8145 CteUse fill: owner cursor and Once/Gosub/Return are
parent-owned; repeated references OpenDup same bag. Legacy physical0..30 range
reserved pending root WHERE seam, not final allocator acceptance. EphemeralSort
and independent nested rewind/data/next preserve existing ordinal order/reuse.
First empty exits outer/inner next correctly; SQL LIMIT/OFFSET child-owned;
reset clears VM Once/cursors, recompilation is not used for reset.
Caller bounds still forced single/direct projections or two direct cross/equality
references, ordinal1 order; computed/filter probes were native-success/public
failure before this repair, not admitted fallback regressions. Preserve exact
probes in cte-fallback-red/native.log/public.log; no new feature breadth.
Native/public four LIMIT/empty/offset/repeated cases plus missing identifier
LIMIT0 lexical error pass; selected300/300/owner20/diff0. Wider branch dispatch,
bind lifetimes, metadata origins/resource limits not exhaustively paired. Root
allocator seam/source0 lexical admission handoff and C1–C6/Chinook remain gaps.

### Current d integration after c723 (supersedes c714 fallback census)
`docs/research/card-t-d-integration-c723.md` traces actual forced/repeated CTE
producer/fill/reuse/empty/next/reset and VM consumers against select.c8102–8145.
No finished child Program copier remains in that fallback. Fresh pinned typed
fallback/error and RIGHT controls plus integrated658/658/type/diff pass; previous
652 is stale-input, not used as acceptance. Report supplies linked resolver/
aggregate walker/dispatch next sequence and exact candidate attribution boundary:
root must select overlapping cumulative c/d/WHERE hunks, not stage mixed files.
Physical0..30 reservation preserved pending root/s actual nTab/identity contract.
No full C1–C6, whole architecture or metadata/resource parity claim.

### Linked correlated expression carrier (bounded first consumer)
resolve.ts resolvedExpressionCarrier retains normalized reduction identity,
linked lookup column use (source/iColumn/selectDepth/merged FULL sources) and
children, including unsupported productions. compileJoinSubquery now consumes
that carrier via reusable bindResolvedExpression rather than local reduction
walker/columnUses searches. Runtime cursor mapping is supplied by the caller;
affinity/collation/rowid and merged coalesce still derive from lexical source.
Pinned resolve.c lookupName/resolveExprStep resolves before emission; expr.c
sqlite3ExprCodeTarget column/COLLATE branches consume resolved source metadata.
No spelling re-resolution or new evaluator. Joined scalar aggregate admission
is unchanged; unsupported nodes remain typed temporary before execution.
Native/public correlated physical JOIN COLLATE count/name/INTEGER/reset and
ambiguous/missing LIMIT0 first errors pass; selected304/304. Literal/NULL in
this specialized binder still intentionally unsupported pending source-based
admission work; no NULL/codegen compatibility claim. Other duplicated consumers
remain migration debt, not converted by this contract. Source0 synthetic lexical
admission defect and root physical reservation remain separate concrete handoffs.

### Second linked carrier consumer: ordinary scalar subquery
compileTableSelect→compileExpressionSubquery ordinary scalar branch now consumes
resolvedExpressionCarrier through bindResolvedExpression for result, WHERE and
ORDER; removed local bind reduction walker/columnUses search. Caller maps
nestedReadCursors or lexical cursor; resolver source/depth ownership stays linked.
Explicit preserveScalarLeaves mode retains that caller's prior prebound columns,
literals/NULL/variables, CASE reduction order, BETWEEN and IN-subquery LHS.
First joined aggregate caller keeps narrow admission, not silently broadened.
Pinned resolve.c lookupName pNext and expr.c sqlite3ExprCodeTarget TK_COLUMN,
COLLATE/CASE conventions retain semantic binding before evaluation. Unsupported
nodes pass intact to scalar codegen's existing typed rejection; no evaluator.
Native/public correlated projection, NULL literal, CASE/BETWEEN/literal result,
COLLATE/aliases/type/reset and ambiguous/missing LIMIT0 pass; native first
consumer and selected490/490 pass. Source0 synthetic admission remains separate;
window substituted-reduction binder and special aggregate argument binder remain
live debt. Broader flags/merged-source/affinity/origin/resource/limits/combined
acceptance unproved. d658 predates carrier inputs, not current integration.

### Current d integration after c732/c741
`docs/research/card-t-d-integration-c741.md` supersedes prior prediction that
ordinary scalar and joined correlated consumers still own local resolution
walkers. Actual carrier/binder callers compared against lookupName/expr lowering;
scalar-leaf admission stays explicit, special aggregate/window substitution still
live. Fresh combined674/674 explicitly includes both new linked/scalar owner
files, native typed/error/reset + RIGHT controls/type/diff pass. Prior658 stale
for this change. Report records exact changed blocks, overlap/root selection
boundary, next register/AggInfo/window ownership sequence and unproved depth/
merged/resource/C1–C6 guarantees. No broad architecture acceptance.

### Derived scalar aggregate register-phase carrier consumer
compileTableSelect→compileExpressionSubquery derived scalar ALL branch now
binds predicate and aggregate arguments via resolvedExpressionCarrier and shared
bindResolvedExpression. ResolvedExpressionBinding.location receives resolved
source/iColumn and selectDepth, returning cursor or explicitly producer-row
register destination; caller owns rows[iColumn] range validation and outer
lexical cursor. No name re-resolution, stale substituted reduction or evaluator.
Derived policy keeps prior binary/unary/cast/COLLATE/call/column admission,
including prior rejection of literal predicate/argument leaves; producer arm
NULL/literals still admitted. Ordinary scalar leaves and joined narrow policy
are unchanged. Local bindDerived/argument reduction walker removed.
Pinned expr.c sqlite3ExprCodeTarget TK_AGG_COLUMN (4990–5023) distinguishes
AggInfoColumnReg from direct/sorter/column access; current producer-row register
binding is NOT AggInfo accumulation or finalized-row ownership. resolve.c
lookupName linked depth remains semantic; window.c sqlite3WindowRewrite creates
new subquery/column identities, so its substitution binder remains separate.
Native/public duplicate+NULL count, no-match/all-NULL sum, COLLATE/alias types,
outer LIMIT0, lexical errors and reset pass; selected496 tests/type/diff pass.
First typecheck attempt found mistaken use.name and leftover reduction args;
corrected to expression display name and carrier children before public runs.
Broader window/AggInfo/flags/merged/source metadata/resource/lifecycle/limits
and source0 lexical admission remain debt. d674 predates this change, not current
combined acceptance. Exact blocks/logs/hashes: card-t-c register-carrier-repair.

### Window FILTER semantic handoff
window-rewrite.ts rewrite function construction captures filterCarrier from the
owned FILTER expression (not its filter_clause wrapper). Its linked source/depth
identity travels with WindowRewriteFunction into compileWindowSelect producer
payload emission. Rewritten parent/buffer substitutions are NOT passed to this
carrier. Pinned window.c selectWindowRewriteExprCb/sqlite3WindowRewrite move
FILTER evaluation to producer payload; select.c invokes rewrite before producer
scan. Replaced actual local bindColumns traversal/search with shared binding,
window-filter location mapping lexical cursor or retained producer-row register.
Window policy retains former cursor/index-only column semantics, infix LIKE
argument reversal, IN-list/BETWEEN/CASE/NULL and literal admission; previous
three consumer policies remain unchanged. Source WHERE walker still live.
Native/public physical FILTER BETWEEN/COLLATE/ROWS EXCLUDE/NULL, empty LIMIT,
window missing/ambiguous LIMIT0 and reset pass; selected502/type/diff pass.
Retained-derived FILTER probes with and without child LIMIT passed native but
public returned temporary unsupported: no broadened admission/fix claim; logs
retained in card-t-c/window-carrier-repair. Retained register mapping structural
control remains, independently paired retained FILTER behavior still a gap.
Window argument/order/lifted substitution identity ownership beyond this FILTER
handoff and AggInfo finalized-row phase remain separate debt, as do source0/root
seam/full lifecycle/metadata/limits/combined acceptance. d674 is stale input.

### Window original-source predicate carrier
sqlite3WindowRewrite's original producer edge now owns sourcePredicates carriers
for ON (source order) then WHERE; capture uses original resolved reductions,
never lifted/substituted parent identities. compileWindowSelect physical source
loop consumes these through shared window-source location policy before Yield.
Rewind/Next/IfNot ordering is unchanged; local bindSourceExpression walk/search
removed. Policy retains cursor/index-only column semantics, IN/BETWEEN/infix
argument ordering and prior literal/NULL support. Unlike FILTER, prior source
binder did not bind CASE/aggregate/IN-subquery interiors; do not conflate policies.
Retained/group/recursive branches still delegate source predicates to their own
producer, not this original physical-loop carrier or invented register mapping.
Pinned window.c sqlite3WindowRewrite pWhere/pSrc handoff, select.c invocation,
resolve.c lookupName linked contexts and expr.c target column/register distinction
own this transition. Source carriers retain linked depth/merged provenance.
Native/public WHERE BETWEEN/COLLATE + FILTER IN/EXCLUDE, WHERE IN + NULL FILTER,
WHERE NULL/LIMIT empty and missing/ambiguous WHERE LIMIT0 errors/reset pass;
selected508/type/diff pass. Retained FILTER temporary probes remain gaps; no
new admission. AggInfo finalized-phase/source0 lexical/root nTab and broader
metadata/resources/lifecycle/limits/combined acceptance remain unresolved.

### Compound aggregate phase consumer (standalone)
compileCompoundDerivedAggregate resolves original outer expressions against the
existing transient derived SrcItem context, then lower carries linked aggregate
arguments and ORDER reductions with explicit accumulator and finalized-output
locations. Shared aggregate-source binding maps linked iColumn to source-row
payload registers, retiring forRow name lookup/traversal. AggStep and AggFinal
consume accumulator location; output register is read only after finalization.
Pinned expr.c TK_AGG_COLUMN directMode vs AggInfoColumnReg and TK_AGG_FUNCTION,
select.c analyzeAggregate/finalizeAggFunctions/selectInnerLoop distinguish phases;
resolve aggregate context remains upstream semantic owner. Same builder,
ephemeral destination and iteration remain. Parent narrow branch and ordinary
GROUP/bare/FILTER/DISTINCT lower/binders remain live debt, not a generic evaluator.
Source policy preserves former forRow admission, including unsupported interiors.
Native/public empty/NULL/ordered sum/count/INTEGER-REAL sum/avg names/reset and
non-LIMIT missing column errors pass; selected518/type/diff pass. LIMIT0 native
first-error probes public failed inherited temporary admission before this caller;
not fixed/narrowed or counted passed. GROUP/bare/ties/FILTER/DISTINCT intersections
need their actual owners. Retained FILTER/source0/root seam/full acceptance remain.

### Ordinary aggregate original-result phase (in progress)
Original result lower now retains resolved arguments/ORDER and accumulator/output
locations; actual argument/ORDER code generation uses shared ordinary-aggregate
binding. Pinned expr.c analyzeAggregate NC_UAggInfo/NC_InAggFunc and
TK_AGG_COLUMN/FUNCTION, select.c finalizeAggFunctions distinguish these phases.
GROUP/bare cache consumers keep their existing payload ownership. Original trees
still pass the old spelling resolver before this lower; HAVING/ORDER alias lower
and FILTER remain legacy. Thus this is partial implementation, not retirement of
the complete duplicate binding path. Selected native/type30 pass; strengthened
REAL/ties/error LIMIT0 and full regression remain required before green.

### Ordinary original-result binding correction
The prior partial note is superseded for the original result edge: trees no
longer call the spelling resolver. bindResolvedExpression ordinary-aggregate
consumes original linked column/argument/FILTER/ORDER identities once, mapping
resolved SrcItem/iColumn to caller cursor and GROUP payloadIndex. lowerResult
retains argument/ORDER identities with accumulator/finalized-output locations;
AggStep/AggFinal consume accumulator, then projection reads finalized registers.
Pinned expr.c analyzeAggregate TK_COLUMN→TK_AGG_COLUMN and TK_FUNCTION→
TK_AGG_FUNCTION, directMode/AggInfoColumnReg and select.c finalizeAggFunctions
own these phase distinctions. GROUP sorted payload and bare min/max tie caches
remain their existing specialized consumers; alias HAVING/ORDER lowerAlias,
WHERE/GROUP spelling resolution and aggregate subquery local binder remain debt.
Initial linked rowid mapping used iColumn=-1 as payloadIndex, causing GROUP
metadata crash: fixed owning cursor→payload location to map INTEGER PRIMARY KEY
rowid back to its declared slot, not the crash site. Native/public GROUP/ORDER,
FILTER/DISTINCT, bare min/tie, empty NULL/count, ordered REAL sum/avg, two resets,
LIMIT0 missing/nested misuse exact errors pass. native/type527/diff and exact9
pass; standalone compound LIMIT0 temporary-before-caller mismatch remains.
No admission widening or root cursor remapping. Full AggInfo migration and
C1–C6/Chinook/integrated acceptance are not established by these selected checks.

#### R1 bounded public unordered UNION ALL context ([[card:card-t-b]])
Public `compileSelect` now allocates the enclosing builder, parameter state and
output destination for unlimited unordered SELECT-origin UNION ALL before
rightmost aggregate classification. Existing `compileCteUnionAll` shared-owner
overload emits actual scalar/table/window/aggregate arm consumers into that
state; c's carriers are reused, not re-bound by a new aggregate walker.
`select.c:sqlite3Select` SelectPrep/multiSelect and `selectInnerLoop` are the
source contract: one Vdbe allocation domain and propagated destination. The
entry publishes one Halt/Program only after successful arm compilation. An
undefined result is a pre-emission admission decline; a thrown error is terminal
and never invokes another generator. Child callers retain their existing overload
and destination; passing an owner returns columns without Halt or publication.
This does not finish R1: ordered/set/recursive entry branches remain independently
owned, including recursive `vdbe.ts` ResultRow/Halt rewrite near 1816. Physical
0..30 WHERE seam remains unchanged. Tests: `select-entry-context.test.mjs`.

### R3 prepare correction in progress
Compound-derived aggregate now calls existing transient resolution before
capability decline, including LIMIT0 (select.c sqlite3Select SelectPrep order).
Pinned missing/d.missing errors pass. Parser ordinary SrcItem append now retains
prior generated source carriers: parse.y stl_prefix(A)/seltablist(A) and
build.c sqlite3SrcListAppendFromTerm preserve the list, not just its item names.
Source0 now reaches existing materialized join producer; its LIMIT admission
still rejects LIMIT0. Full R3 regression remains red; producer LIMIT/OFFSET must
use normal computeLimitRegisters/output sequencing, not SQL LIMIT0 special case.

R3 bounded prepare correction completed: retained first-source materialized join
now uses computeLimitRegisters and applies OFFSET/count at final destination
(after sorter extraction when ordered); IfZero/DecrJumpZero share parent end.
Child LIMIT remains before join, lexical binding before parent limit evaluation.
This translates select.c computeLimitRegisters/selectInnerLoop output ordering,
without remapping reserved physical0..30 or replacing the child producer.
Ordered bag, LIMIT0, positive LIMIT/OFFSET, negative LIMIT and unsorted offset
native/public INTEGER rows, names/two resets pass; exact missing errors retained.
Initial selected536 had three existing UTF8/16 derived-join regressions: carrying
flattenedDerived to the appended ordinary SrcItem spuriously activated standalone
ORDER exclusion. Retain only unflattened derived carriers on prefix append; the
already-spliced flattened annotation is not a retained SrcItem producer. Existing
three regressions restored, native/type536/diff pass. Full R2/metadata/resources/
limits and retained FILTER historical admission/root seam remain outstanding.

### Ordinary aggregate HAVING/unmatched ORDER linked alias edge
resolve.c lookupName/resolveAlias resolves sources first for HAVING, substitutes
result EList only after lexical miss, and checks aggregate/window restrictions
in its NameContext. resolve.ts now retains that substitution as reduction→result
reduction identity in aliasUses. resolvedExpressionCarrier follows it; the shared
binder expands substituted expressions before binding arguments/FILTER/ORDER.
compileAggregateSelect HAVING and unmatched ORDER now consume that linked carrier
through lowerResult and ResolvedAggregatePhaseCarrier, retiring lowerAlias and
resolve(aliasExpression(...)) on these edges. Original and alias aggregates use
source cursor/payloadIndex, accumulator AggStep/AggFinal and output registers;
GROUP/bare cache still supplies existing payload/bare relationships, not a claim
that expr.c TK_AGG_COLUMN directMode/useSortingIdx/REAL/RIGHT-null is fully migrated.
Native/public paired alias tests cover source-shadowing empty HAVING, alias sum,
GROUP/bare min ties, NULL/REAL, FILTER/DISTINCT/aggregate ORDER, CASE short circuit,
missing/nested errors, names/types/reset. Native/type547/diff pass. Initial type
failure was optional aliasUses exactOptionalPropertyTypes, fixed at plan creation.
WHERE/GROUP spelling owners, subquery/parent aggregate paths and complete AggInfo
column phase relationships remain substantive obligations. No new admission,
cursor remapping, b541 or R3 dispatch replacement, algorithm substitution.

### Ordinary aggregate source WHERE linked consumer
The ordinary compileAggregateSelect WHERE edge now uses aggregatePlan's resolved
carrier and existing source cursor/payload location, not resolve(whereTree).
resolve.c resolveSelectStep validates WHERE under alias/aggregate restrictions;
select.c sqlite3WhereBegin precedes updateAccumulator. Existing TS WHERE branches
remain before sorter capture/AggStep with their reject targets unchanged. This
retires the spelling walker on that consuming edge only, preserving shared binder
scalar-subquery leaves and linked CASE/IN children. Native/public paired
select-aggregate-source-owner covers GROUP IPK/CAST REAL, CASE short circuit,
FILTER DISTINCT/NULL, bare min ties, empty GROUP, names/types/reset and exact
missing/nested LIMIT0 errors. Native/type555/diff pass. No algorithm substitution,
new admission or physical remapping. GROUP, ON, subquery/parent binders and actual
source→sorter→bare/accumulator/finalized AggInfoColumnReg/directMode/sorter REAL/
RIGHT-null relationships still require migration; root WHERE/index seam unchanged.

### Third checkpoint linked wrapper identity repair ([[card:card-t-d]])

The checkpoint's grouped DISTINCT COLLATE/encoding regression was a resolver
producer defect, not a GROUP alias/sorter algorithm defect. `direct()` strips
parentheses and COLLATE for metadata lookup; `lookupName()` had recorded only
the outer reduction as a column use. The shared linked binder descends to the
actual ID leaf (as C resolve.c `resolveExprStep` TK_ID/lookupName under
`sqlite3WalkExpr` does), so its use was absent. Publish the unwrapped leaf with
identical source/iColumn/depth/mergedSources, retaining the wrapper use for
existing result metadata consumers. No spelling fallback, evaluator, GROUP
special case or runtime PC change. This representation bridge preserves COLLATE
ownership and lexical ambiguity/error ordering; it does not migrate a producer.
Original lifecycle regression retained; nested parentheses added.
`test/conformance/select-linked-wrapper-identity-native.py` independently checks
pinned source ID, typed NULL/TEXT and two resets for bare/nested COLLATE in
expr-where and UTF8/UTF16LE/UTF16BE fixtures. Scope excludes unresolved joint
checkpoint attribution and C1–C6 acceptance. Exact evidence/status is
`record:///status.md?card=card-t-d` and work:///cards/card-t-d/group-identity/.

### Third-checkpoint regression correction (bounded, no producer breadth)
Compound-derived aggregate ordinary ALL arms now stream through enclosing
SRT_Coroutine register row/Yield rather than allocating SRT_EphemTab. Pinned
select.c selectInnerLoop SRT_Coroutine publishes each row; caller advances Yield
until EndCoroutine redirects to caller end. Same builder, parameters, linked
aggregate source register binding, KeyInfo and accumulator/local ORDER sorter
remain. Unordered source incurs no ephemeral private charge; aggregate-local
ORDER retains its existing shared private-state budget/error/finalize owner.
Private24-byte tests across three encodings now distinguish successful baseline
from ordered sorter limit (including finalize preserving error), no budget change.
Retained compound scalar aggregate reaches existing compileAggregateSelect parent
Mem/Exists/Set owner before generic derived projection gate; output LIMIT/OFFSET
stays computeLimitRegisters + finalized-row destination, not child row limit.
No changed generic gate/admission or physical reservation. Paired native rows/types
and existing destination reset/metadata tests pass; current shared424 pass.
Structural tests now assert live shared producer/destination and no completed-child
splices, not obsolete inner.ops copying or a required ephemeral row store.
R2 GROUP/AggInfo/ON/subquery/parent obligations remain paused/incomplete. Frozen
coroutine test handoff remains d-owned; this is not exported isolated acceptance.


### R1 partial Boolean implication correction (2026-10-02)

`expr.c:exprImpliesNotNull` (6698–6768) distinguishes true-only from non-NULL proof and has no TK_AND/TK_OR cases. `where.c:whereUsablePartialIndex` (3700–3735) consumes that proof before choosing a partial index. The former TS unconditional AND recursion under NOT was unsound: NULL AND false is false, so NOT can be true while the partial predicate column is NULL. Nested AND now yields no proof; top-level conjunct splitting remains in `analyzeWhere`. Query-side OR is **not a direct translation of this switch**: the bounded true-only extension requires both arms independently prove the target and is disabled in every seenNot/non-NULL context. This compensates for absent upstream OR-derived analysis terms in the represented scalar path, rather than installing general OR optimization. If OR is true at least one arm is true; requiring both true-only proofs is sufficient. It cannot establish non-NULL OR operands (NULL OR true is true). Pinned public capture confirms `a=1 AND (c>0 OR c<0)` still admits forced p_live; removing this positive branch would reject a represented valid proof. Index-predicate-side OR remains a separate pinned `sqlite3ExprImpliesExpr` branch.

Verified pinned 3.53.4 native read-only fixture behavior in UTF-8/UTF-16LE/UTF-16BE: `a=1 AND NOT(c>0 AND a=2)` and reversed arms reject forced p_live at prepare and return INTEGER ids 1,2 unforced/NOT INDEXED. Parameter neighbors `[1,1]` and `[NULL,2]` return empty controls. The public regression checks both orders, reset/rebind, NULL, forced preparation rejection, zero unsafe index seeks, damaged partial-root off-path isolation, and a valid c>0 selected neighbor. No output filtering is used to compensate for an incomplete index. Frozen 24/30 selected-access accounting is unchanged; no general optimizer or complete implication claim follows.


#### R1 ordered enclosing entry ([[card:card-t-b]])
R1 continuation: production compileSelect now owns builder/parameter/output state for unlimited single-column ordered table UNION ALL (physical source in any arm), invoking the existing compileOrderedCteUnionAll shared-owner overload. Arm/window/aggregate/derived coroutine consumers are reused unchanged; entry publishes the terminal Halt/Program. Compound ordinal range diagnostics precede specialized merge-key admission (resolve.c:resolveCompoundOrderBy); invalid ordinals no longer become unsupported declines. Nonmatching keys still decline before emission; selected errors are terminal. Existing c828 child destinations and WHERE physical0..30 seam unchanged. Recursive ResultRow/Halt rewriting remains live; R1 remains incomplete beyond these entry slices.

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

### [[card:card-t-d]] bounded completed-producer repair (2026-10-02)

Supersedes the preceding live recursive ResultRow/Halt-rewrite finding **only for
recursive sum and zero-source derived count**. The latter loop belonged to
`compileZeroSourceDerivedCount`, not `compileRecursiveAggregateSelect`; the
postcommit status's attribution of both loops to recursive aggregation was wrong.

Owner/caller map: `compileRecursiveAggregateSelect` allocates accumulator/output
and parameters on one SelectProgramBuilder, calls `compileRecursiveCteSelect`
with its existing shared producer overload and an aggregate-expression destination,
then emits AggFinal/Copy/ResultRow/Halt and publishes builder.finish().
`compileZeroSourceDerivedCount` retains its count-only/no-source admission gate,
allocates the same enclosing state, and calls `compileScalarSelect` with that
builder/parameters/destination. Scalar ordinary ALL and ordered/set merge paths
emit to the selected owner; window/CTE early branches forward the owner to their
existing shared overloads. No child terminal Halt or completed ops copy survives
in these two consumers. Child LIMIT/OFFSET governs rows reaching AggStep;
LIMIT 0 completes with count 0; NULL-only sum finalizes NULL. Parent output is
published once after producer completion, not by intercepting runtime ResultRow.

Pinned comparison: select.c selectInnerLoop 1441–1456 selects Coroutine Yield vs
Output ResultRow during construction; generateWithRecursiveQuery 2695 onward
allocates Current/Queue/Distinct and LIMIT state before extraction/output/restart.
vdbeaux.c 610–655 resolves construction labels while VDBE_INIT_STATE, not while
executing. vdbe.c ResultRow 1746 saves next PC and returns ROW; AggStep1 7881
owns accumulator arguments, AggFinal 7976 finalizes Mem and propagates errors.
The existing bounded aggregate-expression destination emits AggStep directly:
it fuses the upstream producer/coroutine consumer handoff in one construction
loop (browser-safe existing specialized branch), preserving queue order,
argument Mem, producer LIMIT, finalization and error ordering without an
independent evaluator or post-publication PC relocation. It is not a claim that
upstream SRT has an aggregate destination or that all coroutine compositions
have been translated. Actual VM PC, registers, Mem/KeyInfo/Btree cursors,
budgets, binding/reset/finalize and suspended admission remain runtime-owned;
physical WHERE cursor reservations and root [[card:card-s]] contracts unchanged.

Evidence: recursive-cte-aggregate public matrix covers six typed controls × three
encodings with binding and two reset executions; select-vdbe-owner-boundary
asserts both production owners no longer rewrite completed ops. Pinned native
six-control capture matched (source-ID and Chinook digest checked). This capture
was performed **after implementation**, not new native-first evidence; prior
postcommit native baseline preceded this repair. Focused 27/27, neighbors55/55,
final shared433/433, canonical/group/Chinook/compound/private/index/STAT164/164,
type and diff checks pass. Commands/hashes and earlier evidence are in the card
status and work:///cards/card-t-d/recursive-destination-repair/. No full R1–R4,
GROUP AggInfo phase, general recursive/window composition or optimizer parity
claim. Peer dirty changes remain preserved; no new export/commit or scope change.

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
Ordinary recursive output entry now owns builder/parameters/output destination and reserves physical cursor0 before invoking compileRecursiveCteSelect(shared). Queue/history/current row ranges and break labels are emitted into that parent builder; entry resolves/finalizes one Halt/Program. Specialized recursive window/SUM/multiple-CTE branches retain separate ownership and admission; selected errors remain terminal. Source: select.c sqlite3Select SelectPrep and generateWithRecursiveQuery queue/output/limit flow. Existing body LIMIT/private/binding lifecycle unchanged. Outer consumer LIMIT/error-resolution gaps remain explicitly unsupported/mismatched, not repaired or waived by this context migration. d238 removed the former SUM/derived COUNT rewrites; c846 carriers untouched.

#### Recursive outer destination LIMIT repair ([[card:card-t-d]], after b559)
`compileRecursiveCteSelect` now allocates outer consumer LIMIT/OFFSET separately
from the recursive body's queue LIMIT/OFFSET. The existing enclosing builder
and destination remain the owners; no finished Program splice or runtime row
filter is introduced. Pinned select.c `selectInnerLoop`1168–1173 gates consumer
OFFSET before evaluating output, while `generateWithRecursiveQuery`2809–2827
owns body offset/output/decrement/restart. An outer OFFSET skip therefore still
passes through the body decrement and recursive expansion; a body OFFSET skip
bypasses both output and body decrement. Outer LIMIT exhaustion terminates the
producer; LIMIT0 jumps to completion before seed execution, but output binding
still occurs at compile time, preserving missing-column code1. Producer-only
aggregate destinations retain their original body-only limits. Queue/history,
physical cursor0, root WHERE reservations and VM PC/Mem/budget/suspension are
unchanged. Tests cover paired body/outer bounds, negative and zero outer LIMIT,
parameter rebinding/reset across three encodings and original missing-column
reproducer. Native controls independently assert integer rows and code1. This
repairs only the accepted ordinary recursive outer LIMIT slice; specialized
window/multiple/aggregate admission and actual R2 AggInfo phases remain debt.

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

#### GROUP ordinal production repair (d after c855)
resolve.c `resolveOrderGroupBy`/`sqlite3ResolveOrderGroupBy`1835+ replaces valid
GROUP integer ordinals with the selected result expression, after range and
aggregate/window rejection. resolve.ts now publishes that substitution through
the existing linked reduction substitution map. compileAggregateSelect obtains
the group AST from the carrier's owning reduction, not the original integer
literal, and binds it with the same column phase owner as non-ordinal groups.
Thus REAL/collation/source identity remain owned by the selected expression.
No execution grouping special case or VM change. Native-first original GROUP1
reproducer and REAL GROUP1/HAVING/order regression preserve four groups and typed
values. Grouped parent over derived compound remains a distinct consuming gap:
c828's ungrouped streaming route does not supply grouped source payload/column
phase capture. It must migrate through actual shared producer/consumer contracts,
not fabricated schema or post-output grouping.

#### Grouped retained UNION ALL consumer (d grouped-stream repair)
The reproduced grouped derived parent now resolves through resolveTransientArm,
retaining the transient SrcItem identity and underlying descriptors. Its shared
builder emits each UNION ALL arm into SRT_Coroutine register rows; the grouped
capture loop resumes Yield, applies parent WHERE, copies group keys plus producer
payload into the existing sorter, and restarts the coroutine. EndCoroutine's
consumer Yield exit enters SorterSort. No persistent OpenRead/Rowid/Next is issued
for the transient source. select.c retained coroutine construction and grouped
sorter capture (tag-select-0482;8579+) and vdbe.c1163–1248 own these transitions.
The existing AggregateColumnOwner now optionally owns sourceRegisters, so shared
column emission copies current producer Mem (and restores REAL affinity without
mutating it), then the same owner selects sorter/saved phases for arguments,
FILTER/local ORDER/bare result/HAVING/order. Existing group change/minmax and
private sorter/error/reset/suspension behavior remains. Producer child ordering
or LIMIT still rejects explicitly; UNION/set/multiple source/general correlated
parent/RIGHT analyzer branches remain specialized or unfinished, not widened by
silently dropping clauses. Output metadata follows resolved parent descriptors,
not invented main.d provenance. Browser row-register adaptation follows c828's
coroutine row contract; no evaluator/materialized shadow table or budget change.
Original pinned/native-first parent failure now returns typed1/REAL2,3/REAL6,
5/NULL,7/NULL. Expanded WHERE/GROUP ordinal/HAVING/local ORDER and first-error
private admission/metadata tests are paired/public controls; expanded native was
captured after implementation, not claimed native-first.

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
Final zero-source scalar/VALUES/set entry now allocates builder, ParameterBuilder and output destination; compileScalarSelect(owner) consumes them for actual row/setup/limit/set/sorter/window/CTE producers. emitRow uses emitSelectDestination; selected errors propagate without retry; entry appends Halt and finishes labels only after success. Existing owner branches already omit terminal Halt. No completed ops copying or relocation. Standalone scalar callers remain live; specialized aggregate/table/recursive entry ownership remains open. Source: select.c sqlite3Select SelectPrep/multiSelect/selectInnerLoop. Typed set/sorter representation remains existing adaptation, not new algorithm substitution.

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
Ordinary nonwindow aggregate public entry now owns builder/ParameterBuilder/output before compileAggregateSelect(parent), terminal Halt and label publication after success. Reserve physical0..30 before parent private cursors to preserve WHERE seam. Grouped/ungrouped/sourceRegisters/correlated phase consumers remain existing semantic owners. A live zero-source derived COUNT compound/VALUES consumer previously declined parent mode; repaired its count destination path to share enclosing builder/parameters and publish through parent destination, omitting child Halt. Singleton richer aggregate admission stays separate; no retry after emission. Source select.c sqlite3Select aggregate analysis/finalization/selectInnerLoop; typed accumulator-event destination remains bounded TS adaptation, not native SRT claim.

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
Correction to b574 parent migration: compileCompoundDerivedAggregate now uses its existing coroutine/linked aggregate-phase producer for parent and standalone callers alike. Removed narrow parent-only zero-source walker/admission and columns[] publication; shared builder/parameters/destination drive physical and scalar arms, multiple aggregates/ordered queues and complete result metadata. Outer LIMIT allocated before inline producer, final offset/output gate patched to enclosing end; child Halt omitted in parent mode. This retires actual superseded owner mechanism, not unsupported waiver. Source select.c sqlite3Select SelectPrep/AggInfo/finalize/selectInnerLoop plus SRT_Coroutine; browser typed registers/sorters retain existing adaptation. COUNT singleton structural assertion now recognizes existing compound/VALUES exclusion, not weakened behavior requirements.

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

Final bounded lexical-owner repair evidence: [repair report](research/card-t-d-lexical-owner-repair.md)
records native typed controls, corrected construction-test boundary, failed
admission hypotheses, exact final hashes and resumed set-e verification:
focused14/14, selected broad686/686 (including C1–C6/Chinook), type/diff clean.
This closes the reproduced all-outer SUM ownership gap, not general preparation
or analyzer/RIGHT parity. Root where-plan.ts hash remains
03b27fa85df8bc4ec2744a50f4ea43343ac41cabc7e972e5a689624790cb04d7.

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

### Outer window transient-source preparation repair ([[card:card-t-d]])
Pinned select.c7699 invokes sqlite3WindowRewrite before ordinary downstream
scan/flattening; window.c958 moves source production under the rewritten
window coroutine. The table preparer now dispatches its already-existing
bounded retained outer-window consumer before the ordinary derived ORDER
rejection/flattening. Nonrecursive CTE lowering reaches that same derived owner.
The retained-source lowerer forwards a compound source into existing multiSelect
construction with the same builder, ParameterBuilder and SRT_Coroutine payload;
simple physical producers still use compileInnerTableSelect. Each child owns its
LIMIT, predicate and empty exits; the outer window owns FILTER, frame, ORDER and
consumer LIMIT. Shared register highwater and EndCoroutine continuation remain
published; no child finished-program copying or independent evaluator added.

The ordinary-physical shared-entry fence and lexical preparation guards are
unchanged. This is not broader window/general preparation completion: WHERE on
the parent, grouped/ordered/distinct/window children and deeper transient shapes
still need their actual consuming migration. Native-first retained UNION ALL
and CTE regressions plus native-before-public expanded empty-arm/child-versus-
consumer LIMIT cases are in select-window-transient-preparation.test.mjs.
Exact commands, failures and hashes live in card status and window-transient-repair
work artifacts; passing these does not settle analyzer/RIGHT ownership.


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

Source: window.c1814–1910 windowFullScan supplies EXCLUDE reset/frame-bound/step/value ownership; windowReturnOneRow1930–1955 uses regApp-bounded seek for non-EXCLUDE first/nth (not cumulative inverse). The initial bounded repair used full-scan callbacks for both. That was a temporary implementation gap, not a browser constraint or approved algorithm substitution; the endpoint migration below supersedes it for admitted non-EXCLUDE ROWS. Historical verification below describes the pre-endpoint revision only.

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

### Bounded R1 specialized parent publications (2026-10-03)

`compileJoinedUnionAll`, `compileSingleCompoundDerived`,
`compileRepeatedImmutableView`, and `compileCteDerivedSources` (including fallback)
now accept the **actual** enclosing builder, ParameterBuilder and SelectDest. The
table producer forwards its shared owner, publishes those same ops/registers with
the returned columns, and leaves Halt/finish to compileSelect/standalone table
wrapper. Shared compound dispatch also tries joined UNION ALL before its simple
table arm route. Standalone paths retain independent publication only without a
parent; compound-derived aggregate was already shared and is unchanged.

Pinned select.c sqlite3Select7590ff, FROM tags0482/0486/0488 and selectInnerLoop1139ff
recursively consume one Parse/Vdbe and chosen destination. Local child ephemeral/
sorter destinations remain distinct from enclosing output: CteUse identity,
OpenDup positioning, shared one-fill, coroutine labels and existing limit drains
are not replaced by finished-Program copying. Register/label allocation uses the
existing builder. Joined compound sources resolve beyond the enclosing cursor
frontier; its sorter reserves a private cursor beyond both frontier and sources.
This is not a blind remap of fixed physical0..30/private24 or a claim of complete
Parse.nTab/WHERE fidelity. Other JSON/retained-window publishers and their live
fall-through publication ownership remain outside this bounded correction.

Construction regression `select-specialized-parent-entry-owner.test.mjs` retains
the initial five failing edge checks and adds actual parent allocation, destination,
no raw ResultRow, conditional Halt and columns publication/caller obligations.
Existing repeated-view, CTE fallback, derived-table/compound, ordinary-entry,
scalar/window and lifecycle public tests retain typed rows/names/reset/finalize,
limits and error guards. Source-ID-asserted native joined-derived, CTE fallback
and derived-bind probes ran before consuming edits; repeated-view native probe
was run **after** edits (not native-FIRST). Those finite captures do not certify
all origins/encoding/BLOB/error/destination combinations or parent architecture.
Exact commands, immutable input hashes and attempted-script failure are retained
in [[card:card-t-b]] status and its specialized-entry-repair evidence.

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

### 2026-10-03 d: physical outer-join aggregate input closure

Supersedes only the admitted ungrouped RIGHT failure in
`docs/research/card-t-d-final-finite-assessment.md`. `compileAggregateSelect`
now hands physical LEFT/RIGHT/FULL input to `compileInnerTableSelect` using an
emission-time `consumeRow` continuation, not a SELECT result projection or a
finished child Program. The aggregate owner retains WHERE/FILTER, DISTINCT,
bare-column capture, single finalization, HAVING and result destination/LIMIT;
the joined owner retains ON, matched-key tracking, downstream joins, unmatched
completion and continue/Return boundaries. Its NullRow and RHS Rewind/Rowid/Next
now all consume the same `cursorFor` map as OpenRead and ordinary positioning.
This fixes a real previously latent remapping divergence, not the VM crash site.

Pinned select.c8884–8904 emits WhereBegin → updateAccumulator → WhereEnd →
finalizeAggFunctions; wherecode.c2842ff nulls left table/index cursors and invokes
the same interior for unmatched RHS. vdbeaux.c610ff labels remain compiler-owned;
vdbe.c1152 Return and6204 NullRow execution remains VM-owned. No VM opcode,
Mem/KeyInfo/Btree, binding or lifecycle changes. The browser callback emits
bytecode during prepare, not a runtime evaluator or algorithm substitution.
The independent nested aggregate loops remain live for INNER/CROSS callers;
recursive/transient `parent.input`, grouped and specialized admissions remain.
Grouped RIGHT still rejects honestly; multiple RIGHT barriers remain unsupported.
No general nTab, metadata or native resource-count parity claim.

Original native-before two witnesses plus six post-first-edit independent pinned
controls are in `select-outer-join-aggregate-input.test.mjs`: INTEGER types/names,
two executions/reset/finalize, ON0, WHERE/FILTER, DISTINCT FULL, LEFT, empty input,
result OFFSET and downstream INNER continuation. Native sourceid is asserted by
the disposable ctypes capture. Exact attempts/commands/hashes are in
[[card:card-t-d]] status and work:///cards/card-t-d/right-aggregate-repair/.
Full frozen conformance with C1–C6/Chinook/lifecycle/limits:1347/1347, no skips;
not 1347 fresh native differentials. Root [[card:card-s]] index/table NullRow
contracts preserved; no new root planner finding.


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
