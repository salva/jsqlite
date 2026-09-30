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
statistics and legacy malformed data: these are not represented here.

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
